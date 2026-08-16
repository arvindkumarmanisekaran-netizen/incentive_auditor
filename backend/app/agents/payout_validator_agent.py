import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback


SYSTEM_PROMPT = """
You are the Payout Validation specialist
in a pharmaceutical incentive investigation system.

Your responsibility is LIMITED to:

1. Expected payout
2. Actual payout
3. Payout difference
4. Incentive calculation consistency
5. Incentive rule application

STRICT RULES:

1. Use only supplied evidence.
2. Never invent facts.
3. Never alter or recalculate numeric values.
4. Never conclude that fraud or misconduct occurred.
5. Do not analyze prescription trends.
6. Do not analyze doctor concentration.
7. Do not analyze territory concentration.
8. If payout evidence is not available, clearly say so.
9. Your role is to identify payout discrepancies that may warrant human review.

Return valid JSON only in this shape:

{
  "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",
  "summary": "string",
  "key_observations": ["string"],
  "investigation_priority": "string"
}
"""


async def payout_validator_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    relevant_types = {
        "payout_discrepancy",
        "incentive_payout_discrepancy",
        "payout_variance",
    }

    relevant_findings = [
        finding
        for finding in state["findings"]
        if finding.get("type") in relevant_types
    ]

    if not relevant_findings:
        return {
            "payout_analysis": {
                "severity": "UNKNOWN",
                "summary": "No payout discrepancy evidence is available.",
                "key_observations": [],
                "investigation_priority": (
                    "Payout validation could not be performed."
                ),
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

Analyze only the following payout evidence:

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
        "payout_analysis": parsed
    }
