from typing import Any, TypedDict


class InvestigationState(TypedDict):
    representative_id: str
    product_id: str
    month: str

    findings: list[dict[str, Any]]

    overall_risk_score: int
    overall_severity: str

    sales_rx_analysis: dict[str, Any]
    doctor_territory_analysis: dict[str, Any]
    payout_analysis: dict[str, Any]

    final_report: dict[str, Any]
