"""Orchestrator: pure stage-machine logic. No LLM calls.

Decides which stage the next round belongs to based on stage budget,
round counts, and the most recent evaluator decision (followup or not).
"""
from __future__ import annotations

from src.schemas import Stage

STAGE_ORDER: list[Stage] = ["opening", "tech", "project", "reverse", "closing"]


def decide_next(state) -> dict:
    """Return a dict with 'action', 'stage', 'is_followup', 'followup_hint'.

    'action' is one of:
      - 'evaluate' — there's an answered round that hasn't been scored yet
      - 'followup' — last evaluator said should_followup
      - 'ask'      — ask a normal question in the current/next stage
      - 'report'   — interview is over; generate report
      - 'done'     — fully complete
    """
    if state.completed and state.final_report:
        return {"action": "done", "stage": state.stage}

    if state.completed and not state.final_report:
        return {"action": "report", "stage": "closing"}

    pending = state.last_unevaluated_round()
    if pending is not None:
        return {"action": "evaluate", "stage": pending.stage}

    # If the most recent fully-evaluated round flagged a followup AND we
    # haven't already followed up after it, do the followup.
    last = state.rounds[-1] if state.rounds else None
    if (
        last is not None
        and last.score is not None
        and last.should_followup
        and not _already_followed_up_after(state, last)
    ):
        return {
            "action": "followup",
            "stage": last.stage,
            "is_followup": True,
            "followup_hint": last.followup_hint,
        }

    # Advance stages based on budget.
    target_stage = _next_stage_with_budget(state)
    if target_stage is None:
        return {"action": "report", "stage": "closing"}

    return {"action": "ask", "stage": target_stage, "is_followup": False, "followup_hint": None}


def _already_followed_up_after(state, last_round) -> bool:
    """True if the round AFTER `last_round` was itself a followup.

    Because the orchestrator runs before each interviewer turn, a "yes
    followup" decision results in a new round added to state. If we see
    no round after `last_round`, we haven't asked the followup yet."""
    idx = state.rounds.index(last_round)
    return idx < len(state.rounds) - 1 and state.rounds[idx + 1].is_followup


def _next_stage_with_budget(state) -> Stage | None:
    for stage in STAGE_ORDER:
        budget = state.stage_budget.get(stage, 0)
        if state.primary_rounds_in_stage(stage) < budget:
            return stage
    return None
