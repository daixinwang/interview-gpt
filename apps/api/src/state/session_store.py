"""Session store façade.

Thin delegate layer that picks the actual backend at import time based on
`settings.session_store_backend`:

- ``memory`` (default): in-process dict, sessions die on restart. Zero
  external dependencies — perfect for ``pnpm dev`` zero-config.
- ``redis``: durable, survives ``uvicorn --reload`` and redeploys, supports
  multi-replica deployments down the road.

Both backends expose the same async surface: ``init / shutdown / create /
get / save / delete / lock_for``. Callers (``routes/interview.py``,
``agents/service.py``, …) import this module — they do not pick a backend.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from src.config import settings

from . import _memory_backend

if TYPE_CHECKING:
    from src.schemas import InterviewState


def _backend():
    """Resolve the active backend. Looked up lazily so tests can flip the
    setting at runtime without re-importing the module."""
    if settings.session_store_backend == "redis":
        from . import _redis_backend  # local import: avoids hard dep when unused
        return _redis_backend
    return _memory_backend


async def init() -> None:
    """Called once on app startup (FastAPI lifespan)."""
    await _backend().init()


async def shutdown() -> None:
    """Called once on app shutdown (FastAPI lifespan)."""
    await _backend().shutdown()


async def create(state_kwargs: dict) -> "InterviewState":
    return await _backend().create(state_kwargs)


async def get(session_id: str) -> "InterviewState":
    return await _backend().get(session_id)


async def lock_for(session_id: str) -> asyncio.Lock:
    return await _backend().lock_for(session_id)


async def save(state: "InterviewState") -> None:
    await _backend().save(state)


async def delete(session_id: str) -> None:
    await _backend().delete(session_id)
