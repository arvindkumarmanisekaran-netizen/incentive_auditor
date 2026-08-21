from typing import TypedDict, Any


class InvestigationState(TypedDict, total=False):

    representative_id: str

    start_date: str

    end_date: str

    # analytics context

    products_analyzed: list[str]

    findings: list[dict[str, Any]]

    overall_risk_score: float

    overall_severity: str

    # AI outputs

    investigation_plan: dict[str, Any]

    sales_rx_analysis: dict[str, Any]

    doctor_territory_analysis: dict[str, Any]

    payout_analysis: dict[str, Any]

    final_report: dict[str, Any]

    investigation_summary: dict[str, Any]
