"""Interview HTTP + SSE endpoints.

Conventions:
- BYOK: every endpoint that calls an LLM requires the `X-API-Key` header.
  The key is never logged, never persisted, never echoed back. The backend
  speaks the OpenAI Chat Completions protocol, so the key works against
  any OpenAI-compatible provider (OpenAI, DeepSeek, Qwen, Doubao, OpenRouter,
  Ollama, etc.) by pairing it with `base_url` at /start.
- The streaming endpoint uses `EventSourceResponse` so the browser sees
  proper `event:` / `data:` framing.

Flow (matches the architecture diagram in the README):

  1. POST /start  -> { session_id }
  2. GET  /stream/{sid}     -> SSE: stage event + question deltas
  3. POST /answer/{sid}     -> 200 OK; client then GET /stream/{sid} again
  4. POST /finish/{sid}     -> SSE: full Markdown report streamed
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from src.agents import service
from src.config import settings
from src.schemas import (
    AnswerRequest,
    InterviewState,
    StartRequest,
    StartResponse,
)
from src.state import session_store

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_api_key(header_value: str | None) -> str:
    """Prefer the per-request header; fall back to the optional server-side
    key from settings (handy for local dev). Raise 400 if neither set."""
    key = (header_value or "").strip()
    if not key and settings.llm_api_key:
        key = settings.llm_api_key
    if not key:
        raise HTTPException(
            status_code=400,
            detail="API key required. Send X-API-Key header.",
        )
    return key


def _resolve_model(request_model: str | None) -> str:
    return request_model or settings.default_model


@router.post("/start", response_model=StartResponse)
async def start(req: StartRequest) -> StartResponse:
    state = await session_store.create(
        {
            "job_id": req.job_id,
            "job_title": req.job_title,
            "jd": req.jd,
            "resume": req.resume,
            "model": _resolve_model(req.model),
            "base_url": (req.base_url.strip() if req.base_url else None) or None,
        }
    )
    logger.info(
        "Created session %s for job_id=%s title=%s",
        state.session_id,
        state.job_id,
        state.job_title,
    )
    return StartResponse(session_id=state.session_id)


async def _sse_turn_events(
    *,
    state: InterviewState,
    api_key: str,
    language: str,
    request: Request,
) -> AsyncIterator[dict]:
    """Wrap `service.stream_next_turn` into SSE event dicts, persisting state
    after each meaningful boundary so a disconnect doesn't lose progress."""
    try:
        async for event in service.stream_next_turn(
            api_key=api_key, state=state, language=language
        ):
            if await request.is_disconnected():
                logger.info("Client disconnected during turn for %s", state.session_id)
                break
            event_name = event.get("type", "delta")
            yield {"event": event_name, "data": json.dumps(event, ensure_ascii=False)}
            # Persist on lifecycle events.
            if event_name in {"evaluated", "round_committed", "report_ready", "done"}:
                await session_store.save(state)
    except HTTPException:
        raise
    except Exception as err:
        logger.exception("Turn streaming failed for %s", state.session_id)
        yield {
            "event": "error",
            "data": json.dumps(
                {"type": "error", "message": str(err)}, ensure_ascii=False
            ),
        }


@router.get("/stream/{session_id}")
async def stream(
    session_id: str,
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    language: str = "zh",
):
    api_key = _resolve_api_key(x_api_key)
    try:
        state = await session_store.get(session_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail="session not found") from err

    lock = await session_store.lock_for(session_id)
    if lock.locked():
        raise HTTPException(status_code=409, detail="another turn is in progress")

    async def gen() -> AsyncIterator[dict]:
        async with lock:
            async for ev in _sse_turn_events(
                state=state, api_key=api_key, language=language, request=request
            ):
                yield ev
            await session_store.save(state)

    return EventSourceResponse(gen())


@router.post("/answer/{session_id}")
async def answer(session_id: str, req: AnswerRequest) -> dict:
    try:
        state = await session_store.get(session_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail="session not found") from err

    try:
        idx = service.record_answer(state, req.answer)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    await session_store.save(state)
    return {"ok": True, "round_index": idx}


@router.post("/finish/{session_id}")
async def finish(
    session_id: str,
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    language: str = "zh",
):
    api_key = _resolve_api_key(x_api_key)
    try:
        state = await session_store.get(session_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail="session not found") from err

    async def gen() -> AsyncIterator[dict]:
        buffer: list[str] = []
        try:
            async for chunk in service.stream_report(
                api_key=api_key, state=state, language=language
            ):
                if await request.is_disconnected():
                    break
                buffer.append(chunk)
                yield {
                    "event": "delta",
                    "data": json.dumps(
                        {"type": "delta", "text": chunk}, ensure_ascii=False
                    ),
                }
            state.final_report = "".join(buffer)
            state.completed = True
            await session_store.save(state)
            yield {
                "event": "done",
                "data": json.dumps({"type": "done"}, ensure_ascii=False),
            }
        except Exception as err:
            logger.exception("Report streaming failed for %s", session_id)
            yield {
                "event": "error",
                "data": json.dumps(
                    {"type": "error", "message": str(err)}, ensure_ascii=False
                ),
            }

    return EventSourceResponse(gen())


@router.get("/state/{session_id}")
async def get_state(session_id: str) -> dict:
    """Expose the full state for the frontend to rehydrate after refresh.
    No API key required — state never leaves the server's memory anyway and
    contains no secrets."""
    try:
        state = await session_store.get(session_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail="session not found") from err
    return state.model_dump()
