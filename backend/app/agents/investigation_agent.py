import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """
You are the Investigation Summary Agent
inside a pharmaceutical incentive audit workflow.

Your role is to convert the completed investigation output
into a concise audit summary for human reviewers.

You receive:

1. Risk synthesis output
2. Specialist evidence interpretations
3. Deterministic anomaly findings


Your responsibility:

- Explain what was observed.
- Summarize important evidence.
- Highlight review priorities.
- Suggest evidence-based next actions.


STRICT RULES:

1. Use ONLY supplied evidence.
2. Never invent facts.
3. Never create new findings.
4. Never modify numeric values.
5. Never recalculate metrics.
6. Never state fraud occurred.
7. Never accuse a representative.
8. An anomaly only indicates that review may be required.
9. Recommendations must directly follow from evidence.
10. If evidence is insufficient, clearly state that.


Return valid JSON only:

{
  "executive_summary": "string",

  "key_findings": [
      "string"
  ],

  "investigation_priorities": [
    {
      "priority": 1,
      "area": "string",
      "reason": "string"
    }
  ],

  "recommended_next_actions": [
      "string"
  ],

  "human_review_required": true
}

"""


async def investigation_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    investigation_data = {
        "representative_id": state.get("representative_id"),
        "investigation_period": {
            "start_date": state.get("start_date"),
            "end_date": state.get("end_date"),
        },
        "findings": state.get(
            "findings",
            [],
        ),
        "sales_rx_analysis": state.get(
            "sales_rx_analysis",
            {},
        ),
        "doctor_territory_analysis": state.get(
            "doctor_territory_analysis",
            {},
        ),
        "payout_analysis": state.get(
            "payout_analysis",
            {},
        ),
        "final_risk_assessment": state.get(
            "final_report",
            {},
        ),
    }

    prompt = f"""
{SYSTEM_PROMPT}


Completed investigation evidence:


    {json.dumps(
        investigation_data,
        indent=2,
        default=str,
    )}


Return JSON only.
"""

    response_text = await gemini_chat_with_fallback(prompt)

    cleaned_response = response_text.replace("```json", "").replace("```", "").strip()

    try:

        parsed = json.loads(cleaned_response)

    except json.JSONDecodeError:

        parsed = {
            "executive_summary": response_text,
            "key_findings": [],
            "investigation_priorities": [],
            "recommended_next_actions": [],
            "human_review_required": True,
        }

    return {"investigation_summary": parsed}
