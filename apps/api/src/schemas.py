"""Pydantic schemas shared across routes, agents, and the session store."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Stage = Literal["opening", "tech", "project", "reverse", "closing", "done"]


class Round(BaseModel):
    """One question / answer pair, optionally followed by an evaluator score."""

    question: str
    question_id: str | None = None  # qid from seed bank if reused
    topic: str | None = None
    stage: Stage = "tech"
    expected_dimensions: list[str] = Field(default_factory=list)
    is_followup: bool = False

    answer: str | None = None

    score: int | None = None  # 1-10
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    should_followup: bool = False
    followup_hint: str | None = None


class StartRequest(BaseModel):
    job_id: str = Field(..., description="One of the IDs in jobs.json")
    job_title: str = Field(..., description="Free-form title shown to the candidate")
    jd: str
    resume: str
    model: str | None = None  # falls back to settings.default_model
    base_url: str | None = None  # optional OpenAI-compatible endpoint URL


class StartResponse(BaseModel):
    session_id: str


class AnswerRequest(BaseModel):
    answer: str


class TurnAction(BaseModel):
    """What the orchestrator decided the service should do next."""

    action: Literal["ask", "report", "done"]
    stage: Stage
    # When action == "ask":
    rag_questions: list[dict] = Field(default_factory=list)
    is_followup: bool = False
    followup_hint: str | None = None


class InterviewState(BaseModel):
    """Authoritative session state. Serializable so we can swap the in-memory
    store for Redis later without changing the schema."""

    session_id: str
    job_id: str
    job_title: str
    jd: str
    resume: str
    model: str = "gpt-4o-mini"
    base_url: str | None = None  # optional OpenAI-compatible endpoint URL

    stage: Stage = "opening"
    rounds: list[Round] = Field(default_factory=list)

    # Per-stage round budget. Followups don't count against this; they
    # extend the current question rather than advancing the stage.
    stage_budget: dict[str, int] = Field(
        default_factory=lambda: {
            "opening": 1,
            "tech": 3,
            "project": 2,
            "reverse": 1,
            "closing": 1,
        }
    )
    completed: bool = False
    final_report: str | None = None

    def primary_rounds_in_stage(self, stage: Stage) -> int:
        """Count of non-followup rounds the candidate has completed in `stage`."""
        return sum(
            1
            for r in self.rounds
            if r.stage == stage and not r.is_followup and r.answer is not None
        )

    def last_unevaluated_round(self) -> Round | None:
        """Most recent round that has an answer but no score yet."""
        for r in reversed(self.rounds):
            if r.answer is not None and r.score is None:
                return r
        return None
