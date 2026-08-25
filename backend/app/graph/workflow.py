from langgraph.graph import START, END, StateGraph

from .state import InvestigationState

from ..agents.investigation_planner_agent import (
    investigation_planner_agent,
)

from ..agents.sales_rx_agent import (
    sales_rx_agent,
)

from ..agents.doctor_territory_agent import (
    doctor_territory_agent,
)

from ..agents.payout_validator_agent import (
    payout_validator_agent,
)

from ..agents.peer_analysis_agent import (
    peer_analysis_agent,
)

from ..agents.risk_synthesizer_agent import (
    risk_synthesizer_agent,
)

from ..agents.investigation_agent import (
    investigation_agent,
)


def evidence_join_node(
    state: InvestigationState,
) -> dict:
    """
    Synchronization node.

    Waits until all specialist evidence agents
    have completed before peer benchmarking
    and risk synthesis continue.
    """

    return {}


def build_investigation_graph():

    builder = StateGraph(InvestigationState)

    # ============================
    # AGENTS
    # ============================

    builder.add_node(
        "investigation_planner_agent",
        investigation_planner_agent,
    )

    builder.add_node(
        "sales_rx_agent",
        sales_rx_agent,
    )

    builder.add_node(
        "doctor_territory_agent",
        doctor_territory_agent,
    )

    builder.add_node(
        "payout_validator_agent",
        payout_validator_agent,
    )

    builder.add_node(
        "peer_analysis_agent",
        peer_analysis_agent,
    )

    builder.add_node(
        "evidence_join_node",
        evidence_join_node,
    )

    builder.add_node(
        "risk_synthesizer_agent",
        risk_synthesizer_agent,
    )

    builder.add_node(
        "investigation_agent",
        investigation_agent,
    )

    # ============================
    # START
    # ============================

    builder.add_edge(
        START,
        "investigation_planner_agent",
    )

    # ============================
    # SPECIALIST ANALYSIS
    # These run in parallel
    # ============================

    builder.add_edge(
        "investigation_planner_agent",
        "sales_rx_agent",
    )

    builder.add_edge(
        "investigation_planner_agent",
        "doctor_territory_agent",
    )

    builder.add_edge(
        "investigation_planner_agent",
        "payout_validator_agent",
    )

    # ============================
    # EVIDENCE JOIN
    #
    # Wait for ALL specialist agents
    # ============================

    builder.add_edge(
        "sales_rx_agent",
        "evidence_join_node",
    )

    builder.add_edge(
        "doctor_territory_agent",
        "evidence_join_node",
    )

    builder.add_edge(
        "payout_validator_agent",
        "evidence_join_node",
    )

    # ============================
    # PEER ANALYSIS
    #
    # Runs only after all evidence
    # agents have completed
    # ============================

    builder.add_edge(
        "evidence_join_node",
        "peer_analysis_agent",
    )

    # ============================
    # RISK SYNTHESIS
    #
    # Requires peer context also
    # ============================

    builder.add_edge(
        "peer_analysis_agent",
        "risk_synthesizer_agent",
    )

    # ============================
    # FINAL REPORT
    # ============================

    builder.add_edge(
        "risk_synthesizer_agent",
        "investigation_agent",
    )

    builder.add_edge(
        "investigation_agent",
        END,
    )

    return builder.compile()


investigation_graph = build_investigation_graph()
