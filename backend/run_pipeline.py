"""
run_pipeline.py
----------------
Multi-agent orchestration via LangGraph.

The pipeline is a directed graph, not a flat sequential script: the 4
specialist agents (renal, neuropathy, retinal, cardiovascular) fan out from
START and run in parallel, then fan back in to a single synthesis node that
produces the final recommendation. State is passed between nodes via
LangGraph's StateGraph.

Setup:
   pip install langgraph langchain-core

Usage:
   python3 run_pipeline.py --patient P93758
   python3 run_pipeline.py
"""

import argparse
from pathlib import Path
from typing import TypedDict, Optional
import pandas as pd

from langgraph.graph import StateGraph, START, END

from specialists import run_specialist
from synthesis_agent import synthesize
from agent_core import has_llm

BACKEND_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Shared state that flows through the graph. Each specialist node writes to
# its own key - LangGraph merges these automatically since they don't overlap.
# ---------------------------------------------------------------------------
class PipelineState(TypedDict):
    patient: dict
    renal_result: Optional[dict]
    neuropathy_result: Optional[dict]
    retinal_result: Optional[dict]
    cardiovascular_result: Optional[dict]
    synthesis: Optional[dict]


# ---------------------------------------------------------------------------
# Node functions - one per agent.
# ---------------------------------------------------------------------------
def make_specialist_node(name: str):
    def node(state: PipelineState) -> dict:
        result = run_specialist(name, state["patient"])
        return {f"{name}_result": result}
    return node


def synthesis_node(state: PipelineState) -> dict:
    specialist_results = [
        state["renal_result"],
        state["neuropathy_result"],
        state["retinal_result"],
        state["cardiovascular_result"],
    ]
    synthesis = synthesize(state["patient"], specialist_results)
    return {"synthesis": synthesis}


# ---------------------------------------------------------------------------
# Build the graph: START fans out to all 4 specialists in parallel,
# all 4 fan back in to synthesis, synthesis goes to END.
# ---------------------------------------------------------------------------
def build_graph():
    graph = StateGraph(PipelineState)

    graph.add_node("renal", make_specialist_node("renal"))
    graph.add_node("neuropathy", make_specialist_node("neuropathy"))
    graph.add_node("retinal", make_specialist_node("retinal"))
    graph.add_node("cardiovascular", make_specialist_node("cardiovascular"))
    graph.add_node("synthesis", synthesis_node)

    graph.add_edge(START, "renal")
    graph.add_edge(START, "neuropathy")
    graph.add_edge(START, "retinal")
    graph.add_edge(START, "cardiovascular")

    graph.add_edge("renal", "synthesis")
    graph.add_edge("neuropathy", "synthesis")
    graph.add_edge("retinal", "synthesis")
    graph.add_edge("cardiovascular", "synthesis")

    graph.add_edge("synthesis", END)

    return graph.compile()


def run_patient(app, patient_row: dict, verbose=True):
    if verbose:
        from agent_core import get_provider_detail
        provider = get_provider_detail()
        mode = f"LIVE LLM AGENTS ({provider})" if provider else "LLM OFFLINE - no fallback, analysis will be reported unavailable"
        print(f"\n{'='*70}")
        print(f"Patient {patient_row['patient_id']}  |  Mode: {mode}  |  Graph: LangGraph")
        print(f"A1c: {patient_row['a1c_percent']}%  |  Age: {patient_row['age']}  |  "
              f"Years with diabetes: {patient_row.get('years_with_diabetes', 'N/A')}")
        print(f"{'='*70}")

    final_state = app.invoke({"patient": patient_row})

    if verbose:
        for name in ["renal", "neuropathy", "retinal", "cardiovascular"]:
            result = final_state[f"{name}_result"]
            if result.get("available", True) is False:
                print(f"[{name.upper():15s}] UNAVAILABLE  -> {result['reasoning']}")
                continue
            flag_marker = "[!] FLAGGED" if result["flag"] else "    clear"
            print(f"[{name.upper():15s}] risk={result['risk_score']:.2f}  {flag_marker}")
            print(f"                  -> {result['reasoning']}")
        print(f"\n>>> SYNTHESIS: {final_state['synthesis']}\n")

    return final_state


def run_patient_streaming(app, patient_row: dict):
    """Yields (node_name, node_output) tuples as each graph node completes,
    instead of blocking until the whole graph finishes. Node completion order
    is NOT guaranteed to be renal->neuropathy->retinal->cardiovascular since
    all 4 specialists fan out from START in parallel - it'll be whichever
    finishes first. Consumers should key off node_name, not assume order.
    """
    for chunk in app.stream({"patient": patient_row}, stream_mode="updates"):
        # chunk is a dict like {"renal": {"renal_result": {...}}}
        for node_name, node_output in chunk.items():
            yield node_name, node_output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--patient", type=str, default=None)
    args = parser.parse_args()

    df = pd.read_csv(BACKEND_DIR / "real_patients.csv")
    if args.patient:
        df = df[df["patient_id"] == args.patient]
        if df.empty:
            print(f"No patient with ID {args.patient} found.")
            return

    app = build_graph()

    for _, row in df.iterrows():
        patient_row = row.to_dict()
        run_patient(app, patient_row)


if __name__ == "__main__":
    main()
