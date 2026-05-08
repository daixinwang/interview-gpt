"""High-level interview service.

Orchestrates one "turn" of the interview from the route layer's perspective:
- `next_turn(state, api_key)` — runs the graph to get a decision, then yields
  streaming text for the candidate.  When the next action is to evaluate the
  prior answer (after the candidate POSTed it), this runs the evaluator first
  and re-decides.
- `generate_report(state, api_key)` — streams the final Markdown report.

The service mutates the passed-in state directly; the route layer is
responsible for persisting state back to the session store after each call.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from src.agents import interviewer, reference, reporter
from src.agents.evaluator import apply_evaluation, evaluate_round
from src.agents.graph import next_decision
from src.schemas import InterviewState, Round

# Sentinel string written into Round.answer when the candidate skipped.
# Reporter and history formatters look for it to render the skip clearly.
SKIPPED_ANSWER_MARKER = "(skipped)"


async def stream_next_turn(
    *,
    api_key: str,
    state: InterviewState,
    language: str = "zh",
) -> AsyncIterator[dict]:
    """Yield SSE-friendly events for the next turn.

    Event shapes:
      {"type": "evaluating"}                              # before scoring last answer
      {"type": "evaluated", "round_index": int, "score": int}
      {"type": "reference_start", "round_index": int}     # candidate skipped; reference incoming
      {"type": "reference_delta", "text": str}            # streaming reference tokens
      {"type": "reference_done", "round_index": int}
      {"type": "stage", "stage": str, "is_followup": bool}
      {"type": "delta", "text": str}                      # streaming question tokens
      {"type": "round_committed", "round_index": int}
      {"type": "report_ready"}                            # caller should hit /finish
      {"type": "done"}
    """
    # 1a. If the latest round was skipped and has no reference answer yet,
    # stream a reference answer for it. Skipped rounds are NOT evaluated —
    # the candidate explicitly opted out of being scored on this question.
    pending_skip = state.last_pending_skip()
    if pending_skip is not None:
        skip_idx = state.rounds.index(pending_skip)
        yield {"type": "reference_start", "round_index": skip_idx}
        buf: list[str] = []
        async for chunk in reference.stream_reference_answer(
            api_key=api_key, state=state, round_=pending_skip, language=language
        ):
            buf.append(chunk)
            yield {"type": "reference_delta", "text": chunk}
        pending_skip.reference_answer = "".join(buf).strip()
        yield {"type": "reference_done", "round_index": skip_idx}
        # Fall through to the orchestrator below to ask the next question.

    # 1b. Otherwise, if there's an answered-but-unscored round, evaluate it first.
    pending = state.last_unevaluated_round()
    if pending is not None:
        yield {"type": "evaluating"}
        eval_payload = await evaluate_round(
            api_key=api_key, state=state, round_=pending
        )
        apply_evaluation(pending, eval_payload)
        yield {
            "type": "evaluated",
            "round_index": state.rounds.index(pending),
            "score": pending.score,
        }

    # 2. Ask the graph what to do next.
    decision = next_decision(state)
    action = decision.get("action", "ask")

    if action == "done":
        yield {"type": "done"}
        return

    if action == "report":
        # The route layer will follow up with /finish to actually stream
        # report tokens. We just signal readiness.
        yield {"type": "report_ready"}
        return

    # 3. action in {"ask", "followup"} — stream a fresh question.
    is_followup = action == "followup" or bool(decision.get("is_followup"))
    target_stage = decision.get("stage") or state.stage
    followup_hint = decision.get("followup_hint")

    rag = (
        []
        if is_followup
        else interviewer.fetch_rag_for(state, target_stage=target_stage)
    )

    yield {
        "type": "stage",
        "stage": target_stage,
        "is_followup": is_followup,
    }

    buffer: list[str] = []
    async for chunk in interviewer.stream_question(
        api_key=api_key,
        state=state,
        target_stage=target_stage,
        is_followup=is_followup,
        followup_hint=followup_hint,
        rag_questions=rag,
        language=language,
    ):
        buffer.append(chunk)
        yield {"type": "delta", "text": chunk}

    full_question = "".join(buffer).strip()

    # 4. Persist the round skeleton (no answer yet).
    new_round = Round(
        question=full_question,
        question_id=(rag[0]["id"] if rag else None),
        topic=(rag[0].get("topic") if rag else None),
        stage=target_stage,
        expected_dimensions=(rag[0].get("key_points", []) if rag else []),
        is_followup=is_followup,
    )
    state.rounds.append(new_round)
    state.stage = target_stage
    yield {
        "type": "round_committed",
        "round_index": len(state.rounds) - 1,
    }


async def stream_report(
    *, api_key: str, state: InterviewState, language: str = "zh"
) -> AsyncIterator[str]:
    """Stream final report tokens. Caller is responsible for setting
    `state.completed = True` and stashing the assembled report."""
    async for chunk in reporter.stream_report(
        api_key=api_key, state=state, language=language
    ):
        yield chunk


def record_answer(state: InterviewState, answer: str) -> int:
    """Attach the candidate's answer to the most recent unanswered round.
    Returns the index of the round that received the answer.

    Raises ValueError if there is no round awaiting an answer.
    """
    for i in range(len(state.rounds) - 1, -1, -1):
        if state.rounds[i].answer is None:
            state.rounds[i].answer = answer.strip()
            return i
    raise ValueError("No outstanding question to answer")


def record_skip(state: InterviewState) -> int:
    """Mark the most recent unanswered round as skipped.
    Returns the index of the round that was skipped.

    Raises ValueError if there is no round awaiting an answer.
    """
    for i in range(len(state.rounds) - 1, -1, -1):
        if state.rounds[i].answer is None:
            state.rounds[i].answer = SKIPPED_ANSWER_MARKER
            state.rounds[i].skipped = True
            return i
    raise ValueError("No outstanding question to skip")
