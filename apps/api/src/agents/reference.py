"""Reference-answer agent.

Used when the candidate skips a question. We don't score skipped rounds;
instead we generate a structured reference answer they can study afterwards.

Two entry points:
  - `build_reference_messages(state, round_)` — pure prompt builder, easy to test.
  - `stream_reference_answer(...)` / `complete_reference_answer(...)` — call the LLM.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from src.agents import prompts
from src.llm.llm_client import complete_text, stream_text
from src.schemas import InterviewState, Round


def build_reference_messages(
    state: InterviewState,
    round_: Round,
    *,
    language: str = "zh",
) -> tuple[str, str]:
    """Return (system_prompt, user_prompt) for the reference-answer LLM call."""
    system = prompts.REFERENCE_SYSTEM.format(
        job_title=state.job_title, language=language
    )
    user = prompts.REFERENCE_USER_TEMPLATE.format(
        job_title=state.job_title,
        jd=state.jd[:1500],
        resume=state.resume[:1500],
        question=round_.question,
        topic=round_.topic or "(unspecified)",
        expected_dimensions=", ".join(round_.expected_dimensions) or "(unspecified)",
    )
    return system, user


async def stream_reference_answer(
    *,
    api_key: str,
    state: InterviewState,
    round_: Round,
    language: str = "zh",
) -> AsyncIterator[str]:
    system, user = build_reference_messages(state, round_, language=language)
    async for chunk in stream_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=800,
        base_url=state.base_url,
    ):
        yield chunk


async def complete_reference_answer(
    *,
    api_key: str,
    state: InterviewState,
    round_: Round,
    language: str = "zh",
) -> str:
    system, user = build_reference_messages(state, round_, language=language)
    return await complete_text(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=800,
        base_url=state.base_url,
    )
