from typing import Any
from pydantic import BaseModel


class Finding(BaseModel):
    type: str
    severity: str
    evidence: dict[str, Any]


class InvestigationResponse(BaseModel):
    representative_id: str
    product_id: str
    month: str

    findings: list[Finding]

    overall_risk_score: int
    overall_severity: str


class PeerAnalysisResult(BaseModel):
    peer_group_size: int

    representative_sales: float
    peer_average_sales: float

    representative_rx: float
    peer_average_rx: float

    representative_payout: float
    peer_average_payout: float

    sales_percentile: float
    rx_percentile: float
    payout_percentile: float

    peer_distribution: list[dict]

    anomaly_indicators: list[str]
