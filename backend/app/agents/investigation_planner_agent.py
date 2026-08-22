import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """
You are an investigation planning AI
for a pharmaceutical incentive audit platform.

Your job is ONLY to decide which analytical areas
should be investigated.

You DO NOT:
- calculate metrics
- analyze sales data
- determine fraud
- make conclusions
- modify risk scores

The deterministic analytics engine performs calculations.

Your output will be used to decide which specialist
AI agents should review the investigation.

STRICT RULES:

1. Use only the supplied investigation context.
2. Never invent missing information.
3. Never claim fraud or misconduct.
4. Return JSON only.
5. Keep recommendations aligned with available modules.


Return exactly this JSON structure:

{
    "focus_areas": [],
    "priority": "",
    "reasoning": []
}


Allowed focus areas:

- sales_trend

  Used for:
  Sales deviation analysis.


- prescription_alignment

  Used for:
  Sales versus prescription relationship analysis.


- territory_behavior

  Used for:
  Doctor concentration and cross-territory patterns.


- payout_validation

  Used for:
  Incentive payout discrepancy analysis.

"""


async def investigation_planner_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    evidence = {
        "representative_id": state.get("representative_id"),
        "start_date": state.get("start_date"),
        "end_date": state.get("end_date"),
        "products_analyzed": state.get("products_analyzed", []),
        "available_findings": state.get("findings", []),
    }

    prompt = f"""
{SYSTEM_PROMPT}


Investigation Context:

    {json.dumps(
        evidence,
        indent=2,
        default=str,
    )}


Create the investigation plan.

Return JSON only.
"""

    response_text = await gemini_chat_with_fallback(prompt)

    cleaned_response = response_text.replace("```json", "").replace("```", "").strip()

    try:

        plan = json.loads(cleaned_response)

    except json.JSONDecodeError:

        plan = {
            "focus_areas": [],
            "priority": "UNKNOWN",
            "reasoning": ["Gemini response could not be parsed as JSON."],
        }

    return {"investigation_plan": plan}
