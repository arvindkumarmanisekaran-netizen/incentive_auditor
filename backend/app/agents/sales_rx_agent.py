import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback

SYSTEM_PROMPT = """
You are the Sales and Prescription Evidence Analysis Agent
inside a pharmaceutical incentive investigation workflow.

Your role is to interpret already calculated evidence.

You DO NOT calculate metrics.
You DO NOT query databases.
You DO NOT create new findings.

Your responsibility is ONLY:

1. Interpret sales deviation evidence.
2. Interpret sales-prescription mismatch evidence.
3. Explain why the evidence may require review.
4. Provide observations for the risk synthesis agent.

Scope limitations:

You MUST NOT analyze:

- payout calculations
- incentive eligibility
- doctor concentration
- territory concentration
- representative ranking
- fraud determination


STRICT RULES:

1. Use ONLY the supplied evidence.
2. Never invent missing information.
3. Never assume intent or misconduct.
4. Never say fraud occurred.
5. Never modify numerical values.
6. Never calculate new percentages.
7. If evidence is incomplete, clearly state that.
8. Prescription information is supporting anomaly evidence only.
9. Prescription performance does not determine incentive payout.
10. Separate observations from conclusions.

Return valid JSON only.

Required format:

{
    "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",

    "anomaly_detected": true|false,

    "summary": "Short explanation of what the evidence indicates",

    "evidence_summary": [
        "Evidence point 1",
        "Evidence point 2"
    ],

    "key_observations": [
        "Observation 1",
        "Observation 2"
    ],

    "limitations": [
        "Information missing or unavailable"
    ],

    "investigation_priority": "LOW|MEDIUM|HIGH"
}


Remember:

You are an evidence interpretation agent,
not a fraud detection system.
"""


async def sales_rx_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    relevant_types = {
        "sales_deviation",
        "sales_prescription_mismatch",
    }

    findings = state.get(
        "findings",
        [],
    )

    relevant_findings = [finding for finding in findings if finding.get("type") in relevant_types]

    # No evidence available

    if not relevant_findings:

        return {
            "sales_rx_analysis": {
                "severity": "UNKNOWN",
                "anomaly_detected": False,
                "summary": "No sales or prescription evidence available for analysis.",
                "evidence_summary": [],
                "key_observations": [],
                "limitations": [
                    "No sales deviation or prescription mismatch findings were provided."
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
        "sales_prescription_findings": relevant_findings,
    }

    prompt = f"""

{SYSTEM_PROMPT}


Analyze ONLY this evidence:


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
            "limitations": ["The AI response was not valid JSON."],
            "investigation_priority": "LOW",
            "raw_response": response_text,
        }

    return {"sales_rx_analysis": parsed}
