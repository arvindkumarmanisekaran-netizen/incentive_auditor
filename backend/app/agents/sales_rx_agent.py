import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback


SYSTEM_PROMPT = """
You are the Sales and Prescription Analysis specialist
in a pharmaceutical incentive investigation system.

Your responsibility is LIMITED to:

1. Sales deviation
2. Sales-prescription mismatch

STRICT RULES:

1. Use only the supplied evidence.
2. Never invent facts.
3. Never alter or recalculate numeric values.
4. Never conclude that fraud or misconduct occurred.
5. Prescriptions are supporting anomaly evidence.
6. Prescription performance does not determine incentive payout.
7. Do not analyze doctor concentration.
8. Do not analyze territory concentration.
9. Do not analyze payout calculations.
10. If evidence is insufficient, say so.

Return valid JSON only with this shape:

{
  "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",
  "summary": "string",
  "key_observations": ["string"],
  "investigation_priority": "string"
}
"""


async def sales_rx_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    relevant_types = {
        "sales_deviation",
        "sales_prescription_mismatch",
    }

    relevant_findings = [
        finding
        for finding in state["findings"]
        if finding.get("type") in relevant_types
    ]

    if not relevant_findings:
        return {
            "sales_rx_analysis": {
                "severity": "UNKNOWN",
                "summary": (
                    "No sales or prescription findings available."
                ),
                "key_observations": [],
                "investigation_priority": "No review available",
            }
        }

    evidence = {
        "representative_id": state["representative_id"],
        "product_id": state["product_id"],
        "month": state["month"],
        "findings": relevant_findings,
    }

    prompt = f"""
{SYSTEM_PROMPT}

Analyze this evidence:

{json.dumps(evidence, indent=2)}

Return JSON only.
"""

    response_text = await gemini_chat_with_fallback(
        prompt
    )

    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError:
        parsed = {
            "severity": "UNKNOWN",
            "summary": response_text,
            "key_observations": [],
            "investigation_priority": (
                "AI response could not be parsed as JSON."
            ),
        }

    return {
        "sales_rx_analysis": parsed
    }
