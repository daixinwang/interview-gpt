FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install uv (fast Python package manager)
RUN pip install --upgrade pip && pip install uv

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY pyproject.toml ./
COPY README.md ./

# Sync dependencies into a virtualenv at /app/.venv
RUN uv venv && uv sync --no-dev

# Copy source
COPY src ./src

# ChromaDB persistence path (mount a volume to keep across deploys)
ENV CHROMA_PERSIST_DIR=/app/chroma_data
RUN mkdir -p /app/chroma_data

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
