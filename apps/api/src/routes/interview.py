"""Interview endpoints. The handlers are placeholders that return 501 until the
agent graph and SSE streaming are implemented in the next iteration."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/start", status_code=501)
async def start() -> dict:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/stream/{session_id}", status_code=501)
async def stream(session_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/answer/{session_id}", status_code=501)
async def answer(session_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/finish/{session_id}", status_code=501)
async def finish(session_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not implemented yet")
