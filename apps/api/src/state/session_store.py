"""In-memory session store.

Single-process MVP only. Swap for Redis later by re-implementing this
module with the same shape. Sessions auto-expire after `TTL_SECONDS` of
inactivity.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field

from src.schemas import InterviewState

TTL_SECONDS = 60 * 60  # 1 hour idle


@dataclass
class _Entry:
    state: InterviewState
    last_touch: float = field(default_factory=time.time)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


_store: dict[str, _Entry] = {}
_global_lock = asyncio.Lock()


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
    cutoff = time.time() - TTL_SECONDS
    expired = [sid for sid, e in _store.items() if e.last_touch < cutoff]
    for sid in expired:
        _store.pop(sid, None)
