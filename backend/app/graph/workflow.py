from langgraph.graph import START, END, StateGraph

from .state import InvestigationState

from ..agents.sales_rx_agent import sales_rx_agent
from ..agents.doctor_territory_agent import doctor_territory_agent
from ..agents.payout_validator_agent import payout_validator_agent
from ..agents.risk_synthesizer_agent import risk_synthesizer_agent


def build_investigation_graph():

    builder = StateGraph(InvestigationState)

    builder.add_node("sales_rx_agent", sales_rx_agent)
    builder.add_node("doctor_territory_agent", doctor_territory_agent)
    builder.add_node("payout_validator_agent", payout_validator_agent)
    builder.add_node("risk_synthesizer_agent", risk_synthesizer_agent)

    # Fan out in parallel
    builder.add_edge(START, "sales_rx_agent")
    builder.add_edge(START, "doctor_territory_agent")
    builder.add_edge(START, "payout_validator_agent")

    # Fan in to synthesizer
    builder.add_edge("sales_rx_agent", "risk_synthesizer_agent")
    builder.add_edge("doctor_territory_agent", "risk_synthesizer_agent")
    builder.add_edge("payout_validator_agent", "risk_synthesizer_agent")

    builder.add_edge("risk_synthesizer_agent", END)

    return builder.compile()


investigation_graph = build_investigation_graph()
