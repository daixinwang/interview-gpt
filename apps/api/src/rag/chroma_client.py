"""Embedded ChromaDB PersistentClient.

We avoid running ChromaDB as a separate service so the MVP deploys to a
single container. The default embedding function (sentence-transformers
all-MiniLM-L6-v2) is downloaded on first use and cached on disk.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb.api import ClientAPI
from chromadb.api.models.Collection import Collection
from chromadb.config import Settings as ChromaSettings

from src.config import settings

COLLECTION_NAME = "interview_questions"


@lru_cache(maxsize=1)
def get_client() -> ClientAPI:
    """Return a singleton PersistentClient for the configured directory."""
    persist_path = Path(settings.chroma_persist_dir).resolve()
    persist_path.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(persist_path),
        settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
    )


def get_collection() -> Collection:
    """Get-or-create the question bank collection."""
    return get_client().get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "InterviewGPT question bank with job + stage metadata"},
    )


def reset_collection() -> Collection:
    """Drop and recreate the collection. Used by the seeder to refresh seeds."""
    client = get_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:  # noqa: BLE001 - collection may not exist yet
        pass
    return get_collection()
