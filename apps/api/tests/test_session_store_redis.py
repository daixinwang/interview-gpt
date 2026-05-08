"""Unit tests for the Redis-backed session store.

These run against `fakeredis.aioredis.FakeRedis` — no real Redis instance
required. We toggle `settings.session_store_backend` at runtime so the
session_store façade resolves to the redis backend.
"""
from __future__ import annotations

import asyncio

import fakeredis.aioredis
import pytest

from src.config import settings
from src.schemas import InterviewState, Round
from src.state import _redis_backend, session_store


@pytest.fixture
def redis_backend(monkeypatch):
    """Swap the session store to redis mode and inject a fake client."""
    monkeypatch.setattr(settings, "session_store_backend", "redis")
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    _redis_backend._set_client_for_tests(fake)
    yield fake
    _redis_backend._set_client_for_tests(None)


def _start_kwargs() -> dict:
    return {
        "job_id": "frontend",
        "job_title": "Senior Frontend",
        "jd": "Build performant React UIs.",
        "resume": "5 years of React experience.",
        "model": "gpt-4o-mini",
    }


async def test_create_then_get_roundtrip(redis_backend):
    state = await session_store.create(_start_kwargs())
    assert state.session_id  # uuid populated

    fetched = await session_store.get(state.session_id)
    assert fetched.model_dump() == state.model_dump()


async def test_save_persists_changes(redis_backend):
    state = await session_store.create(_start_kwargs())
    state.rounds.append(Round(question="What is React?", stage="tech"))
    state.stage = "tech"
    await session_store.save(state)

    fetched = await session_store.get(state.session_id)
    assert fetched.stage == "tech"
    assert len(fetched.rounds) == 1
    assert fetched.rounds[0].question == "What is React?"


async def test_save_unknown_sid_raises_keyerror(redis_backend):
    """Mirrors in-memory backend: writing a never-seen sid is a bug, not a
    silent insert."""
    ghost = InterviewState(
        session_id="not-a-real-session",
        job_id="frontend",
        job_title="Frontend",
        jd="x",
        resume="y",
    )
    with pytest.raises(KeyError):
        await session_store.save(ghost)


async def test_delete_removes_session_and_lock(redis_backend):
    state = await session_store.create(_start_kwargs())
    # Acquire a lock so we exercise lock-dict cleanup.
    await session_store.lock_for(state.session_id)
    assert state.session_id in _redis_backend._locks

    await session_store.delete(state.session_id)

    with pytest.raises(KeyError):
        await session_store.get(state.session_id)
    assert state.session_id not in _redis_backend._locks


async def test_get_after_ttl_expiry(redis_backend, monkeypatch):
    """fakeredis honours EX when we shrink the TTL and sleep past it."""
    monkeypatch.setattr(settings, "session_ttl_seconds", 1)
    state = await session_store.create(_start_kwargs())
    await asyncio.sleep(1.2)
    with pytest.raises(KeyError):
        await session_store.get(state.session_id)


async def test_lock_for_returns_same_lock_per_sid(redis_backend):
    state = await session_store.create(_start_kwargs())
    a = await session_store.lock_for(state.session_id)
    b = await session_store.lock_for(state.session_id)
    assert a is b  # same instance — otherwise mutual exclusion is broken


async def test_lock_for_unknown_sid_raises(redis_backend):
    with pytest.raises(KeyError):
        await session_store.lock_for("nope")


async def test_round_skipped_and_reference_survive_roundtrip(redis_backend):
    """Non-trivial fields (skipped flag, reference_answer, stage_budget)
    must round-trip cleanly through JSON."""
    state = await session_store.create(_start_kwargs())
    state.rounds.append(
        Round(
            question="Explain CRDTs.",
            stage="tech",
            skipped=True,
            reference_answer="A CRDT is …",
            answer="(skipped)",
        )
    )
    state.stage_budget["tech"] = 5
    await session_store.save(state)

    fetched = await session_store.get(state.session_id)
    r = fetched.rounds[0]
    assert r.skipped is True
    assert r.reference_answer == "A CRDT is …"
    assert fetched.stage_budget["tech"] == 5


async def test_init_failure_propagates(monkeypatch):
    """Bad redis URL should raise on init() so the app fails fast at
    startup instead of erroring per-request."""
    monkeypatch.setattr(settings, "session_store_backend", "redis")
    monkeypatch.setattr(
        settings, "session_redis_url", "redis://127.0.0.1:1/0"
    )
    # Make sure no fake client is lingering from another test.
    _redis_backend._set_client_for_tests(None)
    with pytest.raises(Exception):
        await _redis_backend.init()
    # Cleanup
    _redis_backend._set_client_for_tests(None)
