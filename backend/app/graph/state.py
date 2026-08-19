from typing import Any, TypedDict


class InvestigationState(TypedDict):

    # ==================================================
    # INVESTIGATION INPUT
    # ==================================================

    representative_id: str

    start_date: str

    end_date: str

    # ==================================================
    # PRODUCTS ANALYZED
    # ==================================================

    products_analyzed: list[str]

    # ==================================================
    # DETERMINISTIC FINDINGS
    # ==================================================

    findings: list[dict[str, Any]]

    # ==================================================
    # RISK SUMMARY
    # ==================================================

    overall_risk_score: int

    overall_severity: str

    # ==================================================
    # SPECIALIST OUTPUTS
    # ==================================================

    sales_rx_analysis: dict[str, Any]

    doctor_territory_analysis: dict[str, Any]

    payout_analysis: dict[str, Any]

    # ==================================================
    # FINAL AI REPORT
    # ==================================================

    final_report: dict[str, Any]
