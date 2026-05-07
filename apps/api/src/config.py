"""Application configuration loaded from environment variables."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"
    chroma_persist_dir: str = "./chroma_data"
    # Directory containing jobs.json and questions/*.json. Defaults to the
    # data/seeds directory at the repo root (two levels up from apps/api).
    seeds_dir: str = "../../data/seeds"
    embedding_model: str | None = None
    # Default model used when the client doesn't pin one. Pick a small,
    # fast, widely-available default; users override per-session via the UI.
    default_model: str = "gpt-4o-mini"
    # Optional server-side fallback. Leave empty to enforce BYOK.
    llm_api_key: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
