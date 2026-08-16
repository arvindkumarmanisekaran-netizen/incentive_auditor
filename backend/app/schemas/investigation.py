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
