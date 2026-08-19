import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """
You are the final Risk Synthesizer in a pharmaceutical incentive
investigation workflow.

You receive:
- deterministic anomaly findings
- Sales/Rx specialist analysis
- Doctor/Territory specialist analysis
- Payout specialist analysis

STRICT RULES:

1. Use only supplied evidence and specialist outputs.
2. Never invent facts.
3. Never alter numeric values.
4. Never conclude fraud or misconduct occurred.
5. Clearly distinguish high-priority findings from lower-priority findings.
6. If payout analysis is unavailable, state that clearly.
7. Cross-territory sales are allowed and are not automatically violations.
8. Prescriptions are supporting anomaly evidence only.
9. Recommendations must be directly supported by evidence.
10. If evidence is insufficient, explicitly say so.

Return valid JSON only:

{
  "overall_assessment": "string",
  "overall_severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",
  "top_risk_drivers": ["string"],
  "specialist_summary": {
    "sales_rx": "string",
    "doctor_territory": "string",
    "payout": "string"
  },
  "recommended_actions": ["string"],
  "human_review_required": true
}
"""


async def risk_synthesizer_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    evidence = {
        "representative_id": state.get("representative_id"),
        "start_date": state.get("start_date"),
        "end_date": state.get("end_date"),
        "products_analyzed": state.get(
            "products_analyzed",
            [],
        ),
        "overall_risk_score": state.get(
            "overall_risk_score",
            0,
        ),
        "overall_severity": state.get(
            "overall_severity",
            "UNKNOWN",
        ),
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

    try:

        parsed = json.loads(response_text)

    except json.JSONDecodeError:

        parsed = {
            "overall_assessment": response_text,
            "overall_severity": evidence["overall_severity"],
            "top_risk_drivers": [],
            "specialist_summary": {
                "sales_rx": "",
                "doctor_territory": "",
                "payout": "",
            },
            "recommended_actions": [],
            "human_review_required": True,
        }

    return {"final_report": parsed}
