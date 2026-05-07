"""LangGraph wiring for the interview state machine.

Design note
-----------
The original plan used LangGraph as the *runtime* for everything including
streaming. In practice the streaming gets ugly inside graph nodes because
each token has to be plumbed through node return values. So we split:

  - LangGraph owns the **decision graph**: which node runs next (orchestrator
    → ask | evaluate | report | done). The orchestrator node is pure-Python
    state-machine logic that mutates state, and `evaluator` runs the
    JSON-mode LLM call. These are the deterministic, testable parts.

  - The route layer drives the streaming pieces directly (interviewer +
    reporter) by reading the graph's decision and calling the streaming
    helpers in `interviewer.py` / `reporter.py`. This keeps SSE plumbing
    flat.

So the compiled graph here is mainly used for:
  1. centralized state-transition logic that's identical between
     interactive use and tests
  2. running evaluator + advancing state after each candidate answer
"""
from __future__ import annotations

from typing import Any

from langgraph.graph import END, StateGraph

from src.agents.orchestrator import decide_next
from src.schemas import InterviewState

# We use the dict shape of InterviewState as the graph state because LangGraph
# wants something it can shallow-merge. Each node returns a partial dict.


def orchestrator_node(state: dict) -> dict:
    """Inspect state, write the next decision into `state['_decision']`."""
    iv = InterviewState.model_validate(state)
    decision = decide_next(iv)
    return {"_decision": decision}


def route_after_orchestrator(state: dict) -> str:
    decision = state.get("_decision") or {}
    action = decision.get("action", "ask")
    # 'evaluate' is folded into the orchestrator pre-step at the route layer;
    # inside the graph we route directly. Map graph-relevant actions:
    if action == "report":
        return "report_marker"
    if action == "done":
        return "end"
    # 'ask' and 'followup' both need the interviewer (handled outside graph)
    return "ask_marker"


def ask_marker_node(state: dict) -> dict:
    """No-op terminal in-graph; route layer reads `_decision` and streams."""
    return {}


def report_marker_node(state: dict) -> dict:
    """No-op terminal; route layer streams the report via reporter.py."""
    return {}


def build_graph() -> Any:
    g = StateGraph(dict)
    g.add_node("orchestrator", orchestrator_node)
    g.add_node("ask_marker", ask_marker_node)
    g.add_node("report_marker", report_marker_node)

    g.set_entry_point("orchestrator")
    g.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {
            "ask_marker": "ask_marker",
            "report_marker": "report_marker",
            "end": END,
        },
    )
    g.add_edge("ask_marker", END)
    g.add_edge("report_marker", END)
    return g.compile()


_GRAPH = None


def get_graph() -> Any:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def next_decision(state: InterviewState) -> dict:
    """Run the compiled graph once to produce the next decision dict."""
    graph = get_graph()
    out = graph.invoke(state.model_dump())
    return out.get("_decision") or {"action": "ask", "stage": state.stage}
