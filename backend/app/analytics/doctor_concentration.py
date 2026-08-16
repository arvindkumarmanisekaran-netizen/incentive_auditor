def calculate_doctor_concentration(
    doctor_sales: list[dict],
) -> dict:
    """
    doctor_sales example:
    [
        {"doctor_id": "D001", "sales": 80000},
        {"doctor_id": "D002", "sales": 15000},
        {"doctor_id": "D003", "sales": 5000},
    ]
    """

    if not doctor_sales:
        return {
            "total_sales": 0,
            "top_doctor_sales": 0,
            "top_doctor_share_percent": 0,
            "top_3_share_percent": 0,
            "severity": "UNKNOWN",
        }

    sorted_doctors = sorted(
        doctor_sales,
        key=lambda x: x["sales"],
        reverse=True,
    )

    total_sales = sum(
        item["sales"]
        for item in sorted_doctors
    )

    if total_sales <= 0:
        return {
            "total_sales": 0,
            "top_doctor_sales": 0,
            "top_doctor_share_percent": 0,
            "top_3_share_percent": 0,
            "severity": "UNKNOWN",
        }

    top_doctor_sales = sorted_doctors[0]["sales"]

    top_doctor_share = (
        top_doctor_sales
        / total_sales
        * 100
    )

    top_3_sales = sum(
        item["sales"]
        for item in sorted_doctors[:3]
    )

    top_3_share = (
        top_3_sales
        / total_sales
        * 100
    )

    if top_doctor_share >= 70:
        severity = "HIGH"

    elif top_doctor_share >= 50:
        severity = "MEDIUM"

    elif top_doctor_share >= 35:
        severity = "LOW"

    else:
        severity = "NORMAL"

    return {
        "total_sales": round(total_sales, 2),
        "top_doctor_sales": round(
            top_doctor_sales,
            2,
        ),
        "top_doctor_share_percent": round(
            top_doctor_share,
            2,
        ),
        "top_3_share_percent": round(
            top_3_share,
            2,
        ),
        "severity": severity,
        "doctor_breakdown": sorted_doctors,
    }