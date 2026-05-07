"""Semantic retrieval over the seeded question bank."""
from __future__ import annotations

from typing import Literal

from src.rag.chroma_client import get_collection

Stage = Literal["opening", "tech", "project", "reverse", "closing"]


def retrieve_questions(
    *,
    job_id: str,
    stage: Stage,
    query: str,
    top_k: int = 5,
    exclude_qids: list[str] | None = None,
) -> list[dict]:
    """Return up to `top_k` questions matching (job_id, stage), ranked by
    semantic similarity to `query`. Each result is a dict with `id`,
    `document`, and the original metadata fields.
    """
    where: dict = {"$and": [{"job_id": job_id}, {"stage": stage}]}
    if exclude_qids:
        where["$and"].append({"qid": {"$nin": exclude_qids}})

    collection = get_collection()
    # Over-fetch to compensate for the metadata filter applied post-search.
    n_results = max(top_k * 3, top_k)
    raw = collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    results: list[dict] = []
    if not raw["ids"] or not raw["ids"][0]:
        return results
    for qid, doc, meta, dist in zip(
        raw["ids"][0],
        raw["documents"][0],
        raw["metadatas"][0],
        raw["distances"][0],
        strict=True,
    ):
        results.append(
            {
                "id": qid,
                "document": doc,
                "distance": dist,
                **meta,
            }
        )
        if len(results) >= top_k:
            break
    return results
