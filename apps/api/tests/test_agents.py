"""Tests for the deterministic parts of the agent graph.

LLM-calling parts (interviewer / evaluator / reporter network calls) are
covered by separate integration tests; here we focus on:
  - orchestrator decision tree
  - evaluator JSON coercion
  - service helpers (record_answer)
  - prompt builders produce expected substrings
"""
from __future__ import annotations

import pytest

from src.agents.evaluator import _coerce, apply_evaluation
from src.agents.interviewer import build_interviewer_messages
from src.agents.orchestrator import decide_next
from src.agents.reporter import build_reporter_messages
from src.agents.service import record_answer
from src.schemas import InterviewState, Round


def _make_state(**kwargs) -> InterviewState:
    defaults = dict(
        session_id="s1",
        job_id="frontend",
        job_title="Senior Frontend Engineer",
        jd="Build performant React UIs.",
        resume="5 yrs React, led design system at X.",
        stage="opening",
    )
    defaults.update(kwargs)
    return InterviewState(**defaults)


# ---------------- orchestrator ----------------


def test_orchestrator_starts_in_opening():
    s = _make_state()
    d = decide_next(s)
    assert d["action"] == "ask"
    assert d["stage"] == "opening"


def test_orchestrator_evaluates_pending_answer_first():
    s = _make_state()
    s.rounds.append(
        Round(question="Tell me about your last project", stage="opening", answer="I built X")
    )
    d = decide_next(s)
    assert d["action"] == "evaluate"
    assert d["stage"] == "opening"


def test_orchestrator_followup_when_evaluator_flags():
    s = _make_state(stage="tech")
    s.rounds.append(
        Round(
            question="Explain reconciliation",
            stage="tech",
            answer="It diffs the tree.",
            score=4,
            should_followup=True,
            followup_hint="ask about keys and lists",
        )
    )
    d = decide_next(s)
    assert d["action"] == "followup"
    assert d["is_followup"] is True
    assert d["followup_hint"] == "ask about keys and lists"


def test_orchestrator_does_not_followup_twice():
    s = _make_state(stage="tech")
    s.rounds.append(
        Round(
            question="Q1",
            stage="tech",
            answer="A1",
            score=4,
            should_followup=True,
            followup_hint="probe deeper",
        )
    )
    # The followup round was already asked + answered + scored.
    s.rounds.append(
        Round(
            question="Q1-followup",
            stage="tech",
            is_followup=True,
            answer="A2",
            score=6,
            should_followup=False,
        )
    )
    d = decide_next(s)
    # Should NOT keep asking followups; should advance.
    assert d["action"] == "ask"


def test_orchestrator_advances_through_stages():
    s = _make_state(
        stage_budget={"opening": 1, "tech": 1, "project": 1, "reverse": 1, "closing": 1}
    )
    # Burn each stage by adding a fully-evaluated round.
    for stage in ["opening", "tech", "project", "reverse"]:
        s.rounds.append(
            Round(
                question=f"q-{stage}",
                stage=stage,
                answer="a",
                score=7,
                should_followup=False,
            )
        )
    d = decide_next(s)
    assert d["action"] == "ask"
    assert d["stage"] == "closing"


def test_orchestrator_reports_when_budget_exhausted():
    s = _make_state(
        stage_budget={"opening": 1, "tech": 1, "project": 1, "reverse": 1, "closing": 1}
    )
    for stage in ["opening", "tech", "project", "reverse", "closing"]:
        s.rounds.append(
            Round(
                question=f"q-{stage}",
                stage=stage,
                answer="a",
                score=7,
                should_followup=False,
            )
        )
    d = decide_next(s)
    assert d["action"] == "report"


def test_orchestrator_done_when_report_present():
    s = _make_state(completed=True, final_report="# Report")
    d = decide_next(s)
    assert d["action"] == "done"


def test_followups_do_not_count_against_budget():
    s = _make_state(
        stage="tech",
        stage_budget={"opening": 0, "tech": 2, "project": 0, "reverse": 0, "closing": 0},
    )
    # One primary tech round, then a followup, both fully evaluated.
    s.rounds.append(
        Round(question="q1", stage="tech", answer="a", score=6, should_followup=False)
    )
    s.rounds.append(
        Round(
            question="q1-fu",
            stage="tech",
            is_followup=True,
            answer="a",
            score=6,
            should_followup=False,
        )
    )
    # Should still ask another *primary* tech question (budget=2, primaries=1).
    d = decide_next(s)
    assert d["action"] == "ask"
    assert d["stage"] == "tech"


# ---------------- evaluator coercion ----------------


def test_evaluator_coerce_clamps_score():
    out = _coerce({"score": 99, "strengths": [], "weaknesses": []})
    assert out["score"] == 10
    out = _coerce({"score": -3, "strengths": [], "weaknesses": []})
    assert out["score"] == 1


def test_evaluator_coerce_drops_hint_when_no_followup():
    out = _coerce({"score": 6, "should_followup": False, "followup_hint": "ignored"})
    assert out["followup_hint"] is None


def test_evaluator_coerce_caps_lists():
    out = _coerce(
        {
            "score": 5,
            "strengths": ["a", "b", "c", "d", "e"],
            "weaknesses": ["x", "y", "z", "w"],
        }
    )
    assert len(out["strengths"]) == 3
    assert len(out["weaknesses"]) == 3


def test_apply_evaluation_mutates_round():
    r = Round(question="q", stage="tech", answer="a")
    apply_evaluation(
        r,
        {
            "score": 7,
            "strengths": ["clear"],
            "weaknesses": ["shallow"],
            "should_followup": True,
            "followup_hint": "go deeper",
        },
    )
    assert r.score == 7
    assert r.strengths == ["clear"]
    assert r.should_followup is True
    assert r.followup_hint == "go deeper"


# ---------------- prompt builders ----------------


def test_interviewer_prompt_uses_followup_instruction():
    s = _make_state(stage="tech")
    s.rounds.append(Round(question="prior", stage="tech", answer="prior ans"))
    sys, user = build_interviewer_messages(
        s,
        target_stage="tech",
        is_followup=True,
        followup_hint="probe X",
        rag_questions=None,
        language="zh",
    )
    assert "probe X" in user
    assert "ONE focused question" in user


def test_interviewer_prompt_uses_stage_instruction_for_primary():
    s = _make_state(stage="project")
    sys, user = build_interviewer_messages(
        s,
        target_stage="project",
        is_followup=False,
        followup_hint=None,
        rag_questions=[
            {"id": "be-001", "topic": "system-design", "document": "design a queue"}
        ],
        language="zh",
    )
    assert "PROJECT DEEP-DIVE" in user
    assert "system-design" in user


def test_reporter_prompt_includes_transcript():
    s = _make_state()
    s.rounds.append(
        Round(question="q1", stage="tech", answer="a1", score=6, strengths=["clear"])
    )
    sys, user = build_reporter_messages(s, language="zh")
    assert "q1" in user and "a1" in user
    assert "Score: 6/10" in user


# ---------------- service ----------------


def test_record_answer_sets_latest_unanswered():
    s = _make_state()
    s.rounds.append(Round(question="q1", stage="opening"))
    idx = record_answer(s, "  my answer  ")
    assert idx == 0
    assert s.rounds[0].answer == "my answer"


def test_record_answer_raises_when_nothing_pending():
    s = _make_state()
    s.rounds.append(Round(question="q1", stage="opening", answer="done"))
    with pytest.raises(ValueError):
        record_answer(s, "late")
