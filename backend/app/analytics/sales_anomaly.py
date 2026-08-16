def calculate_sales_deviation(
    current_sales: float,
    historical_average: float,
) -> dict:

    if historical_average <= 0:
        return {
            "current_sales": current_sales,
            "historical_average": historical_average,
            "deviation_percent": None,
            "severity": "UNKNOWN",
        }

    deviation_percent = (
        (current_sales - historical_average)
        / historical_average
        * 100
    )

    if deviation_percent >= 150:
        severity = "HIGH"

    elif deviation_percent >= 75:
        severity = "MEDIUM"

    elif deviation_percent >= 30:
        severity = "LOW"

    else:
        severity = "NORMAL"

    return {
        "current_sales": round(current_sales, 2),
        "historical_average": round(historical_average, 2),
        "deviation_percent": round(deviation_percent, 2),
        "severity": severity,
    }