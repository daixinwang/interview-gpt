"""Redis-backed session store.

Survives ``uvicorn --reload`` and redeploys. Keys live at
``interview:session:{sid}`` and hold the JSON-serialised ``InterviewState``.
TTL is refreshed on every read/write so an active interview stays alive.

Per-session locks are kept in-process (``dict[sid, asyncio.Lock]``). MVP is
single-replica; for multi-replica deployments swap this for a Redlock or a
SETNX-based mutex without touching call sites.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import redis.asyncio as aioredis

from src.config import settings
from src.schemas import InterviewState

if TYPE_CHECKING:
    pass

_KEY_PREFIX = "interview:session:"


def _key(sid: str) -> str:
    return f"{_KEY_PREFIX}{sid}"


# Module-level singletons — initialised by ``init()`` and shared across the
# process. ``shutdown()`` clears them so tests / repeated lifespans don't
# hold a closed connection.
_client: aioredis.Redis | None = None
_locks: dict[str, asyncio.Lock] = {}
_locks_mutex = asyncio.Lock()


async def init() -> None:
    """Connect and ping. Fails fast on bad URL so the app doesn't silently
    fall back to a broken backend at request time."""
    global _client
    if _client is not None:
        return
    _client = aioredis.from_url(
        settings.session_redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    await _client.ping()


async def shutdown() -> None:
    global _client
    if _client is not None:
        try:
            await _client.aclose()
        except Exception:
            pass
        _client = None
    async with _locks_mutex:
        _locks.clear()


def _require_client() -> aioredis.Redis:
    if _client is None:
        raise RuntimeError("redis session_store not initialised; call init() first")
    return _client


# --- Test hook ---------------------------------------------------------------

def _set_client_for_tests(client: aioredis.Redis | None) -> None:
    """Inject a (fake) redis client. Test-only — not used in production paths."""
    global _client
    _client = client
    # Reset in-proc lock dict so different test cases don't share locks.
    _locks.clear()


# --- Public API --------------------------------------------------------------

async def create(state_kwargs: dict) -> InterviewState:
    import uuid
    sid = uuid.uuid4().hex
    state_kwargs = {**state_kwargs, "session_id": sid}
    state = InterviewState(**state_kwargs)
    client = _require_client()
    await client.set(
        _key(sid),
        state.model_dump_json(),
        ex=settings.session_ttl_seconds,
    )
    return state


async def get(session_id: str) -> InterviewState:
    """Fetch + refresh TTL. Raises KeyError if missing/expired."""
    client = _require_client()
    raw = await client.get(_key(session_id))
    if raw is None:
        raise KeyError(session_id)
    # Sliding-window TTL — match the in-memory backend's ``last_touch``
    # refresh on read. Best-effort: if the key happens to expire between
    # GET and EXPIRE, the next call will surface KeyError, which is fine.
    await client.expire(_key(session_id), settings.session_ttl_seconds)
    return InterviewState.model_validate_json(raw)


async def lock_for(session_id: str) -> asyncio.Lock:
    """Per-session lock. Raises KeyError if the session doesn't exist."""
    client = _require_client()
    exists = await client.exists(_key(session_id))
    if not exists:
        raise KeyError(session_id)
    async with _locks_mutex:
        lock = _locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            _locks[session_id] = lock
        return lock


async def save(state: InterviewState) -> None:
    """Overwrite an existing session. Raises KeyError if the sid was
    deleted/expired between create and save (mirrors the in-memory
    backend's behaviour, prevents silently writing a ghost session)."""
    client = _require_client()
    # ``xx=True`` means "only set if key exists" — returns None if missing.
    ok = await client.set(
        _key(state.session_id),
        state.model_dump_json(),
        ex=settings.session_ttl_seconds,
        xx=True,
    )
    if ok is None:
        raise KeyError(state.session_id)


async def delete(session_id: str) -> None:
    client = _require_client()
    await client.delete(_key(session_id))
    async with _locks_mutex:
        _locks.pop(session_id, None)
