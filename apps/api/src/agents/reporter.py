"""Reporter agent — generates the final Markdown evaluation report.

Streams tokens straight back to the client (a long Markdown body benefits
from progressive rendering) and also has a non-streaming variant for tests.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from src.agents import prompts
from src.llm.llm_client import complete_text, stream_text
from src.schemas import InterviewState


def _format_transcript(state: InterviewState) -> str:
    if not state.rounds:
        return "(no rounds)"
    lines: list[str] = []
    for i, r in enumerate(state.rounds, start=1):
        if r.skipped:
            tag = "[SKIPPED]"
        elif r.is_followup:
            tag = "[followup]"
        else:
            tag = f"[{r.stage}]"
        lines.append(f"### Round {i} {tag}")
        lines.append(f"Q: {r.question}")
        if r.skipped:
            lines.append("A: (candidate chose to skip — DO NOT score this round)")
        else:
            lines.append(f"A: {r.answer or '(no answer)'}")
        if r.score is not None:
            lines.append(f"Score: {r.score}/10")
            if r.strengths:
                lines.append(f"Strengths: {'; '.join(r.strengths)}")
            if r.weaknesses:
                lines.append(f"Weaknesses: {'; '.join(r.weaknesses)}")
        lines.append("")
    return "\n".join(lines)


def _skipped_topics(state: InterviewState) -> str:
    """Bullet list of questions the candidate skipped, for the report's
    'unfamiliar topics' section. Empty string when nothing was skipped."""
    skipped = [r for r in state.rounds if r.skipped]
    if not skipped:
        return "(none — the candidate attempted every question)"
    lines = []
    for r in skipped:
        topic = r.topic or r.stage
        # Trim long questions to keep the prompt compact.
        q = r.question.strip().replace("\n", " ")
        if len(q) > 140:
            q = q[:140] + "…"
        lines.append(f"- [{topic}] {q}")
    return "\n".join(lines)


def build_reporter_messages(
    state: InterviewState, *, language: str = "zh"
) -> tuple[str, str]:
    system = prompts.REPORTER_SYSTEM.format(language=language)
    user = prompts.REPORTER_USER_TEMPLATE.format(
        job_title=state.job_title,
        jd=state.jd[:1500],
        transcript=_format_transcript(state),
        skipped_topics=_skipped_topics(state),
    )
    return system, user


async def stream_report(
    *,
    api_key: str,
    state: InterviewState,
    language: str = "zh",
) -> AsyncIterator[str]:
    system, user = build_reporter_messages(state, language=language)
    async for chunk in stream_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=2048,
        base_url=state.base_url,
    ):
        yield chunk


async def complete_report(
    *,
    api_key: str,
    state: InterviewState,
    language: str = "zh",
) -> str:
    system, user = build_reporter_messages(state, language=language)
    return await complete_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=2048,
        base_url=state.base_url,
    )
