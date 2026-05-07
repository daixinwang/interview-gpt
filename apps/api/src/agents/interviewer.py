"""Interviewer agent.

Two entry points:
  - `build_interviewer_messages(state, decision)` — prepares (system, user) for
    the LLM call. Pure / no I/O, easy to unit test.
  - `stream_question(...)` / `complete_question(...)` — actually call Claude.

The route layer streams; tests use the non-streaming variant.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from src.agents import prompts
from src.llm.anthropic_client import complete_text, stream_text
from src.rag.retriever import retrieve_questions
from src.schemas import InterviewState

# Followups don't need RAG — they probe a specific weakness from the prior answer.
_INSTRUCTION_BY_STAGE = {
    "opening": prompts.INTERVIEWER_OPENING_INSTRUCTION,
    "tech": prompts.INTERVIEWER_TECH_INSTRUCTION,
    "project": prompts.INTERVIEWER_PROJECT_INSTRUCTION,
    "reverse": prompts.INTERVIEWER_REVERSE_INSTRUCTION,
    "closing": prompts.INTERVIEWER_CLOSING_INSTRUCTION,
}


def _format_history(state: InterviewState, max_rounds: int = 6) -> str:
    if not state.rounds:
        return "Conversation so far: (this is the first turn)"
    tail = state.rounds[-max_rounds:]
    lines = ["Conversation so far:"]
    for i, r in enumerate(tail, start=1):
        lines.append(f"  Q{i} [{r.stage}]: {r.question}")
        if r.answer:
            lines.append(f"  A{i}: {r.answer}")
        if r.score is not None:
            lines.append(f"     (evaluator score: {r.score}/10)")
    return "\n".join(lines)


def _format_rag(rag_questions: list[dict]) -> str:
    if not rag_questions:
        return "Reference questions: (none)"
    lines = ["Reference questions from the bank (for inspiration only):"]
    for q in rag_questions:
        topic = q.get("topic") or q.get("id", "")
        lines.append(f"  - [{topic}] {q.get('document', '').strip()}")
    return "\n".join(lines)


def build_interviewer_messages(
    state: InterviewState,
    *,
    target_stage: str,
    is_followup: bool,
    followup_hint: str | None,
    rag_questions: list[dict] | None,
    language: str = "zh",
) -> tuple[str, str]:
    """Return (system_prompt, user_prompt) for the interviewer LLM call."""
    system = prompts.INTERVIEWER_SYSTEM.format(language=language)

    if is_followup:
        instruction = prompts.INTERVIEWER_FOLLOWUP_INSTRUCTION.format(
            followup_hint=followup_hint or "the candidate was vague"
        )
    else:
        instruction = _INSTRUCTION_BY_STAGE.get(
            target_stage, prompts.INTERVIEWER_TECH_INSTRUCTION
        )

    round_number = state.primary_rounds_in_stage(target_stage) + 1
    stage_budget = state.stage_budget.get(target_stage, 1)

    user = prompts.INTERVIEWER_USER_TEMPLATE.format(
        job_title=state.job_title,
        jd=state.jd[:1500],
        resume=state.resume[:1500],
        stage=target_stage,
        round_number=round_number,
        stage_budget=stage_budget,
        rag_block=_format_rag(rag_questions or []),
        history_block=_format_history(state),
        instruction=instruction,
    )
    return system, user


def fetch_rag_for(state: InterviewState, *, target_stage: str) -> list[dict]:
    """Pull a few seed questions for the upcoming stage. Excludes ids we've
    already asked so we don't repeat the bank verbatim across rounds."""
    if target_stage in ("opening", "reverse", "closing"):
        return []
    asked_ids = [r.question_id for r in state.rounds if r.question_id]
    query = f"{state.job_title} {target_stage} interview question"
    try:
        return retrieve_questions(
            job_id=state.job_id,
            stage=target_stage,
            query=query,
            top_k=4,
            exclude_qids=asked_ids or None,
        )
    except Exception:
        # RAG failure shouldn't block the interview.
        return []


async def stream_question(
    *,
    api_key: str,
    state: InterviewState,
    target_stage: str,
    is_followup: bool,
    followup_hint: str | None,
    rag_questions: list[dict] | None,
    language: str = "zh",
) -> AsyncIterator[str]:
    system, user = build_interviewer_messages(
        state,
        target_stage=target_stage,
        is_followup=is_followup,
        followup_hint=followup_hint,
        rag_questions=rag_questions,
        language=language,
    )
    async for chunk in stream_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=600,
        base_url=state.base_url,
    ):
        yield chunk


async def complete_question(
    *,
    api_key: str,
    state: InterviewState,
    target_stage: str,
    is_followup: bool,
    followup_hint: str | None,
    rag_questions: list[dict] | None,
    language: str = "zh",
) -> str:
    system, user = build_interviewer_messages(
        state,
        target_stage=target_stage,
        is_followup=is_followup,
        followup_hint=followup_hint,
        rag_questions=rag_questions,
        language=language,
    )
    return await complete_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=600,
        base_url=state.base_url,
    )
