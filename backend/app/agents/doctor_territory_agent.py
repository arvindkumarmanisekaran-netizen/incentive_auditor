import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback


SYSTEM_PROMPT = """
You are the Doctor and Territory Analysis specialist
in a pharmaceutical incentive investigation system.

Your responsibility is LIMITED to:

1. Doctor concentration
2. Cross-territory sales concentration

STRICT RULES:

1. Use only supplied evidence.
2. Never invent facts.
3. Never alter or recalculate numeric values.
4. Never conclude that fraud or misconduct occurred.
5. Cross-territory sales are allowed in this business model.
6. Do not describe cross-territory activity as a policy violation.
7. Doctor ownership determines representative attribution.
8. Do not analyze sales-prescription mismatch.
9. Do not analyze sales deviation.
10. Do not analyze payout calculations.
11. If evidence is insufficient, say so.

Return valid JSON only in this shape:

{
  "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",
  "summary": "string",
  "key_observations": ["string"],
  "investigation_priority": "string"
}
"""


async def doctor_territory_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    relevant_types = {
        "doctor_concentration",
        "cross_territory_concentration",
    }

    relevant_findings = [
        finding
        for finding in state["findings"]
        if finding.get("type") in relevant_types
    ]

    if not relevant_findings:
        return {
            "doctor_territory_analysis": {
                "severity": "UNKNOWN",
                "summary": (
                    "No doctor or territory findings available."
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

Analyze only the following doctor and territory evidence:

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
        "doctor_territory_analysis": parsed
    }
