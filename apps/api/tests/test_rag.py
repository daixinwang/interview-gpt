"""End-to-end test for the RAG seeder + retriever.

Uses a temporary ChromaDB persist dir so the test never pollutes the dev
store. The first run downloads the default sentence-transformers model
(~80MB) and is slow; subsequent runs hit the local cache.
"""
from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_chroma(tmp_path, monkeypatch):
    """Point CHROMA_PERSIST_DIR at a tmp dir and reload modules so the
    cached singleton client picks up the new path."""
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma"))

    # Ensure SEEDS_DIR resolves correctly even when pytest is invoked from
    # a different cwd.
    repo_seeds = Path(__file__).resolve().parents[3] / "data" / "seeds"
    monkeypatch.setenv("SEEDS_DIR", str(repo_seeds))

    # Reload modules that captured settings at import time.
    import src.config

    importlib.reload(src.config)
    import src.rag.chroma_client as chroma_client

    importlib.reload(chroma_client)
    import src.rag.seeder as seeder

    importlib.reload(seeder)
    import src.rag.retriever as retriever

    importlib.reload(retriever)

    yield


def test_seed_then_retrieve_returns_relevant_questions():
    from src.rag.retriever import retrieve_questions
    from src.rag.seeder import seed_collection

    inserted = seed_collection(fresh=True)
    assert inserted >= 30, f"expected ≥30 seed questions, got {inserted}"

    results = retrieve_questions(
        job_id="frontend",
        stage="tech",
        query="how does React render updates to the DOM",
        top_k=3,
    )

    assert len(results) == 3
    # The React rendering question (fe-001) should be the top hit.
    assert results[0]["id"] == "fe-001"
    # All hits must respect the metadata filter.
    for r in results:
        assert r["job_id"] == "frontend"
        assert r["stage"] == "tech"


def test_retriever_excludes_listed_qids():
    from src.rag.retriever import retrieve_questions
    from src.rag.seeder import seed_collection

    seed_collection(fresh=True)
    results = retrieve_questions(
        job_id="backend",
        stage="tech",
        query="caching invalidation strategy",
        top_k=3,
        exclude_qids=["be-003"],
    )
    qids = [r["id"] for r in results]
    assert "be-003" not in qids
    assert all(qid.startswith("be-") for qid in qids)


def test_seeder_is_idempotent_on_warm_collection():
    from src.rag.chroma_client import get_collection
    from src.rag.seeder import seed_collection

    seed_collection(fresh=True)
    count_after_first = get_collection().count()

    second_pass = seed_collection(fresh=False)
    assert second_pass == 0, "warm seed should be a no-op"
    assert get_collection().count() == count_after_first
