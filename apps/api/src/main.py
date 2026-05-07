"""FastAPI entrypoint for the InterviewGPT backend."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routes import health, interview


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Place startup hooks here (e.g. ChromaDB seeding) once those modules land.
    yield


app = FastAPI(
    title="InterviewGPT API",
    description="Multi-agent AI interviewer backend.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "InterviewGPT API", "version": "0.1.0", "status": "ok"}
