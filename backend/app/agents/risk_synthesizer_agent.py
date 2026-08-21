import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """

You are the Final Risk Synthesizer Agent
in a pharmaceutical incentive investigation workflow.

Your responsibility is to combine evidence from specialist agents
and produce an overall audit risk assessment.

You receive:

1. Deterministic anomaly findings
2. Sales and prescription evidence analysis
3. Doctor and territory evidence analysis
4. Payout validation evidence


Your role:

- Combine independent evidence.
- Identify the strongest risk drivers.
- Explain why evidence requires review.
- Prioritize investigation areas.


STRICT RULES:

1. Use ONLY supplied evidence.
2. Never invent facts.
3. Never modify numerical values.
4. Never calculate new metrics.
5. Never conclude fraud occurred.
6. Never accuse any representative of misconduct.
7. Risk means "requires review", not wrongdoing.
8. Recommendations must directly follow from evidence.
9. Cross-territory selling is allowed unless evidence shows another issue.
10. Prescription mismatch is supporting evidence only.
11. Payout findings must only use supplied payout evidence.
12. If evidence is insufficient, say so clearly.


Risk scoring guidance:

NORMAL:
No meaningful anomalies.

LOW:
Minor deviation requiring monitoring.

MEDIUM:
Multiple indicators requiring review.

HIGH:
Strong evidence requiring detailed audit.

UNKNOWN:
Insufficient evidence.


Return JSON only:

{
 "overall_risk_score": number,

 "overall_severity":
 "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",

 "overall_assessment":
 "string",

 "top_risk_drivers":[
    "string"
 ],

 "specialist_summary":{

    "sales_rx":
    "string",

    "doctor_territory":
    "string",

    "payout":
    "string"
 },

 "recommended_actions":[
    "string"
 ],

 "human_review_required": true
}

"""


async def risk_synthesizer_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    evidence = {
        "representative_id": state.get("representative_id"),
        "investigation_period": {
            "start_date": state.get("start_date"),
            "end_date": state.get("end_date"),
        },
        "products_analyzed": state.get(
            "products_analyzed",
            [],
        ),
        "detected_findings": state.get(
            "findings",
            [],
        ),
        "investigation_plan": state.get("investigation_plan", {}),
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
    }

    prompt = f"""

{SYSTEM_PROMPT}


Investigation evidence:


    {json.dumps(
        evidence,
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
            "overall_risk_score": 0,
            "overall_severity": "UNKNOWN",
            "overall_assessment": response_text,
            "top_risk_drivers": [],
            "specialist_summary": {
                "sales_rx": "",
                "doctor_territory": "",
                "payout": "",
            },
            "recommended_actions": [],
            "human_review_required": True,
        }

    return {
        # compatibility with frontend
        "overall_risk_score": parsed.get(
            "overall_risk_score",
            0,
        ),
        "overall_severity": parsed.get(
            "overall_severity",
            "UNKNOWN",
        ),
        "findings": state.get(
            "findings",
            [],
        ),
        "final_report": parsed,
    }
