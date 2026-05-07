"""Route-level tests using FastAPI's TestClient.

We avoid mocking the LLM here — the streaming endpoints would require
network access. Those are covered by manual smoke tests.  These tests focus
on:
  - BYOK enforcement
  - session lifecycle (create / state / 404)
  - /answer guarding
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def _start(**overrides) -> str:
    payload = {
        "job_id": "frontend",
        "job_title": "Senior Frontend",
        "jd": "Build performant React UIs.",
        "resume": "5 years React.",
    }
    payload.update(overrides)
    r = client.post("/api/interview/start", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["session_id"]


def test_start_creates_session():
    sid = _start()
    assert isinstance(sid, str) and len(sid) >= 16


def test_state_returns_initial_shape():
    sid = _start()
    r = client.get(f"/api/interview/state/{sid}")
    assert r.status_code == 200
    body = r.json()
    assert body["session_id"] == sid
    assert body["stage"] == "opening"
    assert body["rounds"] == []
    assert body["completed"] is False


def test_state_404_for_unknown_session():
    r = client.get("/api/interview/state/does-not-exist")
    assert r.status_code == 404


def test_stream_requires_byok_header():
    sid = _start()
    # Without header — should bail out before any LLM call.
    r = client.get(f"/api/interview/stream/{sid}")
    assert r.status_code == 400
    assert "X-API-Key" in r.text


def test_finish_requires_byok_header():
    sid = _start()
    r = client.post(f"/api/interview/finish/{sid}")
    assert r.status_code == 400


def test_answer_rejects_when_no_pending_question():
    sid = _start()
    r = client.post(f"/api/interview/answer/{sid}", json={"answer": "hi"})
    assert r.status_code == 400


def test_answer_404_for_unknown_session():
    r = client.post("/api/interview/answer/missing", json={"answer": "hi"})
    assert r.status_code == 404
