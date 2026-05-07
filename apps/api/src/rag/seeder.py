"""Load JSON seed files into the ChromaDB collection.

Each question is stored as a single document with a body that combines
the question text + key points (so semantic search hits both surface
phrasing and underlying concepts), plus metadata for filtering.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from src.config import settings
from src.rag.chroma_client import get_collection, reset_collection

logger = logging.getLogger(__name__)


def _question_body(question: dict) -> str:
    parts = [question["question"]]
    if question.get("key_points"):
        parts.append("Key points: " + " | ".join(question["key_points"]))
    if question.get("topic"):
        parts.append(f"Topic: {question['topic']}")
    return "\n".join(parts)


def _seeds_root() -> Path:
    """Resolve the seeds directory.

    settings.seeds_dir may be relative to the apps/api working directory
    (local dev) or absolute (Docker). Try both."""
    raw = Path(settings.seeds_dir)
    if raw.is_absolute() and raw.exists():
        return raw
    # Relative to current working dir (where uvicorn was started)
    cwd_resolved = (Path.cwd() / raw).resolve()
    if cwd_resolved.exists():
        return cwd_resolved
    # Relative to this file: apps/api/src/rag/seeder.py -> repo root
    file_resolved = (Path(__file__).resolve().parents[3] / "data" / "seeds")
    if file_resolved.exists():
        return file_resolved
    raise FileNotFoundError(
        f"Could not locate seeds directory. Tried: {raw}, {cwd_resolved}, {file_resolved}"
    )


def load_seeds() -> tuple[list[dict], list[dict]]:
    """Read jobs.json + questions/*.json from disk. Returns (jobs, questions)."""
    root = _seeds_root()
    jobs_path = root / "jobs.json"
    if not jobs_path.exists():
        raise FileNotFoundError(f"Missing jobs.json at {jobs_path}")
    jobs: list[dict] = json.loads(jobs_path.read_text(encoding="utf-8"))

    questions: list[dict] = []
    questions_dir = root / "questions"
    for job in jobs:
        qfile = questions_dir / f"{job['id']}.json"
        if not qfile.exists():
            logger.warning("No question file for job %s at %s", job["id"], qfile)
            continue
        for q in json.loads(qfile.read_text(encoding="utf-8")):
            q = {**q, "job_id": job["id"], "job_title_en": job["title_en"]}
            questions.append(q)
    return jobs, questions


def seed_collection(*, fresh: bool = False) -> int:
    """Insert (or refresh) all seed questions into ChromaDB.

    If `fresh` is True the collection is dropped first; otherwise this is
    idempotent because we use stable IDs (qid) per question.
    """
    _, questions = load_seeds()
    collection = reset_collection() if fresh else get_collection()

    if not fresh and collection.count() >= len(questions):
        logger.info(
            "ChromaDB already has %d documents (>= %d seeds); skipping reseed.",
            collection.count(),
            len(questions),
        )
        return 0

    ids = [q["id"] for q in questions]
    documents = [_question_body(q) for q in questions]
    metadatas: list[dict] = []
    for q in questions:
        metadatas.append(
            {
                "qid": q["id"],
                "job_id": q["job_id"],
                "stage": q["stage"],
                "difficulty": q["difficulty"],
                "topic": q.get("topic", ""),
                # ChromaDB metadata only accepts scalars, so flatten arrays:
                "key_points": " | ".join(q.get("key_points", [])),
                "follow_ups": " | ".join(q.get("follow_ups", [])),
            }
        )

    # upsert is idempotent: existing IDs are overwritten, new ones added.
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    logger.info("Seeded %d questions into ChromaDB.", len(ids))
    return len(ids)
