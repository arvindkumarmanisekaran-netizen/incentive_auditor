def calculate_cross_territory_concentration(
    home_territory_id: str,
    territory_sales: list[dict],
) -> dict:

    if not territory_sales:
        return {
            "total_sales": 0,
            "home_territory_sales": 0,
            "cross_territory_sales": 0,
            "cross_territory_share_percent": 0,
            "severity": "UNKNOWN",
        }

    total_sales = sum(
        item["sales"]
        for item in territory_sales
    )

    if total_sales <= 0:
        return {
            "total_sales": 0,
            "home_territory_sales": 0,
            "cross_territory_sales": 0,
            "cross_territory_share_percent": 0,
            "severity": "UNKNOWN",
        }

    home_territory_sales = sum(
        item["sales"]
        for item in territory_sales
        if item["territory_id"] == home_territory_id
    )

    cross_territory_sales = (
        total_sales - home_territory_sales
    )

    cross_territory_share = (
        cross_territory_sales
        / total_sales
        * 100
    )

    if cross_territory_share >= 70:
        severity = "HIGH"
    elif cross_territory_share >= 50:
        severity = "MEDIUM"
    elif cross_territory_share >= 30:
        severity = "LOW"
    else:
        severity = "NORMAL"

    return {
        "total_sales": round(total_sales, 2),
        "home_territory_sales": round(
            home_territory_sales,
            2,
        ),
        "cross_territory_sales": round(
            cross_territory_sales,
            2,
        ),
        "cross_territory_share_percent": round(
            cross_territory_share,
            2,
        ),
        "severity": severity,
        "territory_breakdown": territory_sales,
    }