"""In-process session store backend.

Single-process MVP only — sessions die when the uvicorn worker dies. Useful
for `pnpm dev` zero-config startup; for production we want the redis backend.
Sessions auto-expire after `settings.session_ttl_seconds` of inactivity.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field

from src.config import settings
from src.schemas import InterviewState


@dataclass
class _Entry:
    state: InterviewState
    last_touch: float = field(default_factory=time.time)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


_store: dict[str, _Entry] = {}
_global_lock = asyncio.Lock()


async def init() -> None:
    """No-op for the in-memory backend."""
    return None


async def shutdown() -> None:
    """Drop all sessions on shutdown."""
    async with _global_lock:
        _store.clear()


async def create(state_kwargs: dict) -> InterviewState:
    """Create a new session. Generates the session_id."""
    sid = uuid.uuid4().hex
    state_kwargs = {**state_kwargs, "session_id": sid}
    state = InterviewState(**state_kwargs)
    async with _global_lock:
        _store[sid] = _Entry(state=state)
        _gc_locked()
    return state


async def get(session_id: str) -> InterviewState:
    """Fetch a session, refresh TTL. Raises KeyError if missing/expired."""
    async with _global_lock:
        entry = _store.get(session_id)
        if entry is None:
            raise KeyError(session_id)
        entry.last_touch = time.time()
        return entry.state


async def lock_for(session_id: str) -> asyncio.Lock:
    """Per-session lock so SSE turn handlers don't trample each other."""
    async with _global_lock:
        entry = _store.get(session_id)
        if entry is None:
            raise KeyError(session_id)
        return entry.lock


async def save(state: InterviewState) -> None:
    async with _global_lock:
        entry = _store.get(state.session_id)
        if entry is None:
            raise KeyError(state.session_id)
        entry.state = state
        entry.last_touch = time.time()


async def delete(session_id: str) -> None:
    async with _global_lock:
        _store.pop(session_id, None)


def _gc_locked() -> None:
    """Caller must hold `_global_lock`."""
    cutoff = time.time() - settings.session_ttl_seconds
    expired = [sid for sid, e in _store.items() if e.last_touch < cutoff]
    for sid in expired:
        _store.pop(sid, None)
