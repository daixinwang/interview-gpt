"""Evaluator agent — scores the most recent answered round.

Uses `complete_json` and validates the response against a tight schema before
returning. The orchestrator's `decide_next` flips to action='evaluate' whenever
there's an answered-but-unscored round, so this runs once per answer.
"""
from __future__ import annotations

from src.agents import prompts
from src.llm.llm_client import complete_json
from src.schemas import InterviewState, Round


def build_evaluator_messages(state: InterviewState, round_: Round) -> tuple[str, str]:
    system = prompts.EVALUATOR_SYSTEM
    user = prompts.EVALUATOR_USER_TEMPLATE.format(
        question=round_.question,
        topic=round_.topic or round_.stage,
        expected_dimensions=", ".join(round_.expected_dimensions) or "general fit",
        answer=round_.answer or "(no answer)",
    )
    return system, user


def _coerce(payload: dict) -> dict:
    """Validate + clamp + default the evaluator JSON."""
    out: dict = {}

    score = payload.get("score", 5)
    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 5
    out["score"] = max(1, min(10, score))

    out["strengths"] = [str(s).strip() for s in (payload.get("strengths") or [])][:3]
    out["weaknesses"] = [str(s).strip() for s in (payload.get("weaknesses") or [])][:3]
    out["should_followup"] = bool(payload.get("should_followup", False))

    hint = payload.get("followup_hint")
    out["followup_hint"] = str(hint).strip() if hint else None
    if not out["should_followup"]:
        out["followup_hint"] = None
    return out


async def evaluate_round(
    *,
    api_key: str,
    state: InterviewState,
    round_: Round,
) -> dict:
    """Call Claude to score `round_`. Returns the coerced eval dict; the
    caller is responsible for writing it back into the round."""
    system, user = build_evaluator_messages(state, round_)
    raw = await complete_json(
        api_key=api_key,
        model=state.model,
        system=system,
        user=user,
        max_tokens=512,
        base_url=state.base_url,
    )
    return _coerce(raw)


def apply_evaluation(round_: Round, eval_payload: dict) -> None:
    """Mutate `round_` in place with the evaluator's verdict."""
    round_.score = eval_payload["score"]
    round_.strengths = eval_payload["strengths"]
    round_.weaknesses = eval_payload["weaknesses"]
    round_.should_followup = eval_payload["should_followup"]
    round_.followup_hint = eval_payload["followup_hint"]
