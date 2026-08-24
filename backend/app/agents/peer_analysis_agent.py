from typing import Any
from collections import defaultdict

from ..graph.state import InvestigationState

from ..utils.peer_metrics import (
    calculate_peer_comparison,
)

from ..services.investigation_stream import (
    emit_workflow_event,
)


async def peer_analysis_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    agent_id = "peer_analysis"

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Starting peer benchmark analysis.",
    )

    try:

        # ==========================================
        # PEER INPUT
        # ==========================================

        peer_input = state.get(
            "peer_analysis_input",
            {},
        )

        territory_metrics = peer_input.get(
            "territory_peer_analysis",
            {},
        ).get(
            "peer_metrics",
            [],
        )

        product_metrics = peer_input.get(
            "product_peer_analysis",
            {},
        ).get(
            "peer_metrics",
            [],
        )

        territory_peer_count = len(
            {x.get("representative_id") for x in territory_metrics if x.get("representative_id")}
        )

        product_peer_count = len(
            {x.get("representative_id") for x in product_metrics if x.get("representative_id")}
        )

        # ==========================================
        # CURRENT REPRESENTATIVE PRODUCT METRICS
        # SOURCE: state["findings"]
        # ==========================================

        current_metrics = {}

        for finding in state.get(
            "findings",
            [],
        ):

            product_id = finding.get("product_id")

            if not product_id or product_id == "ALL":
                continue

            current_metrics.setdefault(
                product_id,
                {
                    "sales": 0.0,
                    "rx": 0.0,
                    "payout": 0.0,
                },
            )

            evidence = finding.get(
                "evidence",
                {},
            )

            finding_type = finding.get("type")

            # -------------------------------
            # SALES METRICS
            # -------------------------------

            if finding_type == "sales_deviation":

                current_metrics[product_id]["sales"] = float(
                    evidence.get(
                        "current_sales",
                        current_metrics[product_id]["sales"],
                    )
                    or 0
                )

            # -------------------------------
            # RX METRICS
            # -------------------------------

            elif finding_type == "sales_prescription_mismatch":

                current_metrics[product_id]["sales"] = float(
                    evidence.get(
                        "current_sales",
                        current_metrics[product_id]["sales"],
                    )
                    or 0
                )

                current_metrics[product_id]["rx"] = float(
                    evidence.get(
                        "current_rx",
                        current_metrics[product_id]["rx"],
                    )
                    or 0
                )

            # -------------------------------
            # PAYOUT METRICS
            # -------------------------------

            elif finding_type == "payout_discrepancy":

                current_metrics[product_id]["payout"] = float(
                    evidence.get(
                        "actual_payout",
                        current_metrics[product_id]["payout"],
                    )
                    or 0
                )

        # ==========================================
        # TERRITORY COMPARISON
        # ==========================================

        if territory_metrics:

            territory_comparison = calculate_peer_comparison(
                current_metrics,
                territory_metrics,
            )

        else:

            territory_comparison = {
                "comparison_available": False,
                "products": {},
                "peer_distribution": [],
                "observations": ["No territory peer benchmark data available."],
            }

        # ==========================================
        # PRODUCT COMPARISON
        # ==========================================

        product_comparison = {
            "comparison_available": False,
            "products": {},
            "peer_distribution": [],
            "observations": [],
        }

        if product_metrics:

            grouped_peers = defaultdict(list)

            for metric in product_metrics:

                product_id = metric.get("product_id")

                if product_id:

                    grouped_peers[product_id].append(metric)

            product_results = {}

            for product_id, peers in grouped_peers.items():

                current_product = {
                    product_id: current_metrics.get(
                        product_id,
                        {
                            "sales": 0.0,
                            "rx": 0.0,
                            "payout": 0.0,
                        },
                    )
                }

                comparison = calculate_peer_comparison(
                    current_product,
                    peers,
                )

                product_results[product_id] = comparison.get("products", {}).get(
                    product_id, comparison
                )

                product_comparison = {
                    "comparison_available": True,
                    "products": product_results,
                    "peer_distribution": [],
                    "observations": [],
                }

        # ==========================================
        # PEER RESULT
        # IMPORTANT:
        # Peer comparison is contextual only.
        # It must NOT increase investigation risk.
        # ==========================================

        result = {
            "territory_peer_comparison": {
                "peer_group_size": territory_peer_count,
                **territory_comparison,
            },
            "product_peer_comparison": {
                "peer_group_size": product_peer_count,
                **product_comparison,
            },
            "peer_group_size": (territory_peer_count + product_peer_count),
            # Peer benchmarking is informational.
            "severity": "NORMAL",
            "anomaly_detected": False,
        }

        emit_workflow_event(
            event_type="agent_result",
            agent=agent_id,
            status="complete",
            output=result,
        )

        emit_workflow_event(
            event_type="agent_status",
            agent=agent_id,
            status="complete",
        )

        return {"peer_analysis": result}

    except Exception as exc:

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=f"Peer analysis failed: {str(exc)}",
        )

        emit_workflow_event(
            event_type="agent_status",
            agent=agent_id,
            status="error",
        )

        raise
