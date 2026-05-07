# Build context is the repo root (see docker-compose.yml). All paths below
# are therefore relative to the repo root.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# uv = fast Python package manager
RUN pip install --upgrade pip && pip install uv

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY apps/api/pyproject.toml ./
COPY apps/api/README.md ./

# Sync dependencies into a virtualenv at /app/.venv
RUN uv venv && uv sync --no-dev

# Copy source
COPY apps/api/src ./src

# Copy seed data into the image. The container resolves seeds via SEEDS_DIR.
COPY data/seeds /app/data/seeds

# ChromaDB persistence path (mount a volume to keep across deploys)
ENV CHROMA_PERSIST_DIR=/app/chroma_data \
    SEEDS_DIR=/app/data/seeds \
    PORT=8000
RUN mkdir -p /app/chroma_data

EXPOSE 8000

# Use shell form so $PORT is expanded (Railway/Render/Fly inject PORT at runtime).
CMD /app/.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
