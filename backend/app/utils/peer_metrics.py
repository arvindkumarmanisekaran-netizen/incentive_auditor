from typing import Any


def calculate_peer_comparison(
    current_metrics: dict[str, dict[str, float]],
    peer_metrics: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Compare representative product metrics against peer representatives.

    Peer comparison is contextual benchmarking only.
    It must not create fraud/anomaly signals.
    """

    if not peer_metrics:

        return {
            "comparison_available": False,
            "peer_group_size": 0,
            "products": {},
            "observations": ["No comparable representatives were found."],
            "severity": "NORMAL",
            "anomaly_detected": False,
        }

    # -------------------------------------------------
    # Group peers by product
    # -------------------------------------------------

    product_peers: dict[str, list[dict]] = {}

    for peer in peer_metrics:

        product_id = peer.get("product_id")

        if not product_id:
            continue

        product_peers.setdefault(
            product_id,
            [],
        ).append(peer)

    product_results = {}

    all_observations = []

    # -------------------------------------------------
    # Product comparison
    # -------------------------------------------------

    for product_id, peers in product_peers.items():

        peer_count = len({p.get("representative_id") for p in peers if p.get("representative_id")})

        if peer_count == 0:
            continue

        avg_sales = sum(float(p.get("sales", 0) or 0) for p in peers) / len(peers)

        avg_rx = sum(float(p.get("rx", 0) or 0) for p in peers) / len(peers)

        avg_payout = sum(float(p.get("payout", 0) or 0) for p in peers) / len(peers)

        representative = current_metrics.get(
            product_id,
            {},
        )

        rep_sales = float(representative.get("sales", 0) or 0)

        rep_rx = float(representative.get("rx", 0) or 0)

        rep_payout = float(representative.get("payout", 0) or 0)

        sales_diff = percentage_difference(
            rep_sales,
            avg_sales,
        )

        rx_diff = percentage_difference(
            rep_rx,
            avg_rx,
        )

        payout_diff = percentage_difference(
            rep_payout,
            avg_payout,
        )

        observations = []

        # ---------------------------------------------
        # Context only observations
        # ---------------------------------------------

        if rep_sales > avg_sales:

            observations.append("Representative sales are above peer average.")

        else:

            observations.append("Representative sales are below peer average.")

        if rep_payout > avg_payout:

            observations.append("Representative payout is above peer average.")

        else:

            observations.append("Representative payout is below peer average.")

        product_results[product_id] = {
            "comparison_available": True,
            "peer_group_size": peer_count,
            "representative": {
                "sales": rep_sales,
                "rx": rep_rx,
                "payout": rep_payout,
            },
            "peer_average": {
                "sales": round(avg_sales, 2),
                "rx": round(avg_rx, 2),
                "payout": round(avg_payout, 2),
            },
            "difference_percentage": {
                "sales": round(sales_diff, 2),
                "rx": round(rx_diff, 2),
                "payout": round(payout_diff, 2),
            },
            "sales_comparison": {
                "representative": rep_sales,
                "peer_average": round(avg_sales, 2),
                "difference": round(
                    rep_sales - avg_sales,
                    2,
                ),
            },
            "rx_comparison": {
                "representative": rep_rx,
                "peer_average": round(avg_rx, 2),
                "difference": round(
                    rep_rx - avg_rx,
                    2,
                ),
            },
            "payout_comparison": {
                "representative": rep_payout,
                "peer_average": round(avg_payout, 2),
                "difference": round(
                    rep_payout - avg_payout,
                    2,
                ),
            },
            "peer_distribution": [
                {
                    "representative_id": p.get("representative_id"),
                    "sales": float(p.get("sales", 0) or 0),
                    "rx": float(p.get("rx", 0) or 0),
                    "payout": float(p.get("payout", 0) or 0),
                }
                for p in peers
            ],
            "observations": observations,
            # IMPORTANT:
            # Peer benchmark is not an anomaly signal
            "severity": "NORMAL",
            "anomaly_detected": False,
        }

        all_observations.extend(observations)

    return {
        "comparison_available": True,
        "peer_group_size": len(
            {p.get("representative_id") for p in peer_metrics if p.get("representative_id")}
        ),
        "products": product_results,
        "observations": list(dict.fromkeys(all_observations)),
        # IMPORTANT:
        # Never elevate risk from peer comparison
        "severity": "NORMAL",
        "anomaly_detected": False,
    }


def percentage_difference(
    value: float,
    average: float,
) -> float:

    if average == 0:

        return 0

    return ((value - average) / average) * 100
