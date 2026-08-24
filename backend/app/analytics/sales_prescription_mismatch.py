def calculate_sales_prescription_mismatch(
    current_sales: float,
    historical_sales_average: float,
    current_prescriptions: float,
    historical_prescription_average: float,
) -> dict:

    if historical_sales_average <= 0 or historical_prescription_average <= 0:
        return {
            "current_sales": round(current_sales, 2),
            "current_rx": round(current_prescriptions, 2),
            "historical_sales_average": round(
                historical_sales_average,
                2,
            ),
            "historical_prescription_average": round(
                historical_prescription_average,
                2,
            ),
            "sales_change_percent": None,
            "prescription_change_percent": None,
            "mismatch_score": None,
            "severity": "UNKNOWN",
        }

    sales_change_percent = (
        (current_sales - historical_sales_average) / historical_sales_average * 100
    )

    prescription_change_percent = (
        (current_prescriptions - historical_prescription_average)
        / historical_prescription_average
        * 100
    )

    mismatch_score = abs(sales_change_percent - prescription_change_percent)

    if mismatch_score >= 100:
        severity = "HIGH"
    elif mismatch_score >= 50:
        severity = "MEDIUM"
    elif mismatch_score >= 25:
        severity = "LOW"
    else:
        severity = "NORMAL"

    return {
        "current_sales": round(current_sales, 2),
        "current_rx": round(
            current_prescriptions,
            2,
        ),
        "historical_sales_average": round(
            historical_sales_average,
            2,
        ),
        "historical_prescription_average": round(
            historical_prescription_average,
            2,
        ),
        "sales_change_percent": round(
            sales_change_percent,
            2,
        ),
        "prescription_change_percent": round(
            prescription_change_percent,
            2,
        ),
        "mismatch_score": round(
            mismatch_score,
            2,
        ),
        "severity": severity,
    }
