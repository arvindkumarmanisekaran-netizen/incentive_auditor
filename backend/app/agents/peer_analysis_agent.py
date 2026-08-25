from typing import Any

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

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(
                f"Peer input received. "
                f"Territory metrics: {len(territory_metrics)}, "
                f"Product metrics: {len(product_metrics)}"
            ),
        )

        territory_peer_count = len(
            {x.get("representative_id") for x in territory_metrics if x.get("representative_id")}
        )

        product_peer_count = len(
            {x.get("representative_id") for x in product_metrics if x.get("representative_id")}
        )

        # ==========================================
        # REPRESENTATIVE LOOKUP
        # ==========================================

        representative_names = {}

        for rep in state.get(
            "representatives",
            [],
        ):

            rep_id = rep.get("representative_id")

            if not rep_id:
                continue

            representative_names[rep_id] = (
                f"{rep.get('first_name', '')} " f"{rep.get('last_name', '')}"
            ).strip()

        # fallback for current representative

        current_rep_id = state.get("representative_id")

        if current_rep_id and current_rep_id not in representative_names:

            representative_names[current_rep_id] = state.get(
                "representative_name",
                current_rep_id,
            )

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(f"Representative lookup loaded: " f"{representative_names}"),
        )

        # ==========================================
        # CURRENT REPRESENTATIVE METRICS
        # ==========================================

        current_metrics = {}

        product_names = {}

        for finding in state.get(
            "findings",
            [],
        ):

            product_id = finding.get("product_id")

            if not product_id or product_id == "ALL":
                continue

            product_names[product_id] = finding.get(
                "product_name",
                product_id,
            )

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

            if finding_type == "sales_deviation":

                current_metrics[product_id]["sales"] = float(
                    evidence.get(
                        "current_sales",
                        0,
                    )
                    or 0
                )

            elif finding_type == "sales_prescription_mismatch":

                current_metrics[product_id]["sales"] = float(
                    evidence.get(
                        "current_sales",
                        0,
                    )
                    or 0
                )

                current_metrics[product_id]["rx"] = float(
                    evidence.get(
                        "current_rx",
                        0,
                    )
                    or 0
                )

            elif finding_type == "payout_discrepancy":

                current_metrics[product_id]["payout"] = float(
                    evidence.get(
                        "actual_payout",
                        0,
                    )
                    or 0
                )

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(f"Prepared current metrics for " f"{len(current_metrics)} products."),
        )

        # ==========================================
        # TERRITORY COMPARISON
        # ==========================================

        if territory_metrics:

            territory_comparison = calculate_peer_comparison(
                current_metrics,
                territory_metrics,
                product_names,
                representative_names,
                current_rep_id,
            )

            emit_workflow_event(
                event_type="commentary",
                agent=agent_id,
                message=(
                    "Territory comparison generated. "
                    f"Products: "
                    f"{list(territory_comparison.get('products', {}).keys())}"
                ),
            )

        else:

            territory_comparison = {
                "comparison_available": False,
                "peer_group_size": 0,
                "product_count": 0,
                "products": {},
                "chart_data": [],
                "observations": ["No territory peer benchmark data available."],
                "severity": "NORMAL",
                "anomaly_detected": False,
            }

        # ==========================================
        # PRODUCT COMPARISON
        # ==========================================

        if product_metrics:

            product_comparison = calculate_peer_comparison(
                current_metrics,
                product_metrics,
                product_names,
                representative_names,
                current_rep_id,
            )

            emit_workflow_event(
                event_type="commentary",
                agent=agent_id,
                message=(
                    "Product comparison generated. "
                    f"Products: "
                    f"{list(product_comparison.get('products', {}).keys())}"
                ),
            )

            # ==========================================
            # FINAL COMMENTARY SUMMARY
            # ==========================================

            products = product_comparison.get(
                "products",
                {},
            )

            emit_workflow_event(
                event_type="commentary",
                agent=agent_id,
                message=(
                    f"Peer benchmark completed. "
                    f"{len(products)} products compared "
                    f"against peer population."
                ),
            )

            for product_id, product in products.items():

                emit_workflow_event(
                    event_type="commentary",
                    agent=agent_id,
                    message=(
                        f"{product.get('product_name', product_id)} "
                        f"({product_id}): "
                        f"{product.get('peer_group_size', 0)} peers analyzed."
                    ),
                )

            emit_workflow_event(
                event_type="commentary",
                agent=agent_id,
                message=(
                    "Peer distribution analysis completed. "
                    "Benchmark data prepared for visualization."
                ),
            )
        else:

            product_comparison = {
                "comparison_available": False,
                "peer_group_size": 0,
                "product_count": 0,
                "products": {},
                "chart_data": [],
                "observations": [],
                "severity": "NORMAL",
                "anomaly_detected": False,
            }

        # ==========================================
        # FINAL DEBUG
        # ==========================================

        for product_id, product in product_comparison.get(
            "products",
            {},
        ).items():

            emit_workflow_event(
                event_type="commentary",
                agent=agent_id,
                message=(
                    f"FINAL {product_id} distribution: " f"{product.get('peer_distribution')}"
                ),
            )

        # ==========================================
        # FINAL RESULT
        # ==========================================

        result = {
            "territory_peer_comparison": territory_comparison,
            "product_peer_comparison": product_comparison,
            "peer_group_size": max(
                territory_peer_count,
                product_peer_count,
            ),
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

        return {
            "peer_analysis": result,
        }

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
