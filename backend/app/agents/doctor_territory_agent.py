import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """
You are the Doctor and Territory Evidence Analysis Agent
inside a pharmaceutical incentive investigation workflow.

Your role is to interpret already calculated doctor and territory evidence.

You DO NOT:
- calculate concentration metrics
- query databases
- determine violations
- determine fraud
- accuse representatives


Your responsibility is LIMITED to:

1. Interpret doctor concentration evidence.
2. Interpret cross-territory sales concentration evidence.
3. Explain observations that may require human review.


STRICT RULES:

1. Use ONLY supplied evidence.
2. Never invent missing information.
3. Never alter numeric values.
4. Never recalculate concentration percentages.
5. Never conclude fraud or misconduct occurred.
6. Cross-territory sales are allowed in this business model.
7. Cross-territory activity is NOT automatically a violation.
8. Doctor ownership determines representative attribution.
9. Do not analyze sales-prescription mismatch.
10. Do not analyze sales deviation.
11. Do not analyze payout calculations.
12. If evidence is insufficient, clearly state that.


Return valid JSON only:

{
    "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",

    "anomaly_detected": true|false,

    "summary": "Short explanation of doctor and territory evidence",

    "evidence_summary": [
        "Evidence point 1",
        "Evidence point 2"
    ],

    "key_observations": [
        "Observation 1",
        "Observation 2"
    ],

    "limitations": [
        "Missing information or unavailable evidence"
    ],

    "investigation_priority": "LOW|MEDIUM|HIGH"
}


Remember:

You are an evidence interpretation agent,
not a compliance enforcement system.
"""


async def doctor_territory_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    relevant_types = {
        "doctor_concentration",
        "cross_territory_concentration",
    }

    findings = state.get(
        "findings",
        [],
    )

    relevant_findings = [finding for finding in findings if finding.get("type") in relevant_types]

    # No evidence available

    if not relevant_findings:

        return {
            "doctor_territory_analysis": {
                "severity": "UNKNOWN",
                "anomaly_detected": False,
                "summary": "No doctor or territory evidence is available for analysis.",
                "evidence_summary": [],
                "key_observations": [],
                "limitations": [
                    "No doctor concentration or territory concentration findings were provided."
                ],
                "investigation_priority": "LOW",
            }
        }

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
        "doctor_territory_findings": relevant_findings,
    }

    prompt = f"""

{SYSTEM_PROMPT}


Analyze ONLY this doctor and territory evidence:


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
            "severity": "UNKNOWN",
            "anomaly_detected": False,
            "summary": "AI response parsing failed.",
            "evidence_summary": [],
            "key_observations": [],
            "limitations": ["AI response was not valid JSON."],
            "investigation_priority": "LOW",
            "raw_response": response_text,
        }

    return {"doctor_territory_analysis": parsed}
