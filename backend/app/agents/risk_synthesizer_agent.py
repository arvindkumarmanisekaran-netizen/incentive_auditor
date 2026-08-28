import json
from typing import Any

from ..graph.state import InvestigationState

from ..core.llm import gemini_chat_with_fallback
from ..core.risk_validator import validate_risk_synthesis

from ..services.investigation_stream import emit_workflow_event

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
5. Peer benchmark analysis


Your role:

- Combine independent evidence.
- Identify strongest review areas.
- Explain why evidence requires investigation.
- Prioritize audit attention.


STRICT RULES:

1. Use ONLY supplied evidence.

2. Never invent facts.

3. Never modify numerical values.

4. Never calculate new metrics.

5. Never conclude fraud occurred.

6. Never accuse any representative of misconduct.

7. Risk means "requires review", not wrongdoing.

8. Recommendations must follow supplied evidence.

9. Cross-territory selling is allowed unless evidence shows another issue.

10. Prescription mismatch is supporting evidence only.

11. Payout conclusions must only use supplied payout evidence.

12. Peer comparison is STRICTLY contextual benchmarking.

13. Peer comparison MUST NOT be treated as a risk indicator.

14. Peer comparison MUST NEVER appear in:
    - top_risk_drivers
    - investigation priorities
    - recommended_actions
    - risk scoring rationale

15. Differences from peer averages including:
    - higher sales
    - lower sales
    - higher payout
    - lower payout
    - Rx differences
    - benchmark variance

    are NOT anomalies.

16. Peer analysis may only be discussed as:
    - contextual benchmark information
    - specialist_summary.peer_analysis

17. If evidence is insufficient, state that clearly.


Risk scoring:

NORMAL:
No meaningful anomalies.

LOW:
Minor deviations.

MEDIUM:
Multiple indicators requiring review.

HIGH:
Strong indicators requiring detailed audit.

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
    "string",

    "peer_analysis":
    "string"
 },

 "recommended_actions":[
    "string"
 ],

 "human_review_required": true
}

"""


def remove_peer_risk_items(
    items: list[str],
) -> list[str]:

    blocked_terms = [
        "peer",
        "benchmark",
        "average",
        "percentile",
        "comparison",
        "variance",
    ]

    cleaned = []

    for item in items:

        text = str(item).lower()

        if any(term in text for term in blocked_terms):
            continue

        cleaned.append(item)

    return cleaned


async def risk_synthesizer_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    agent_id = "risk_synthesizer"

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Starting final risk synthesis across specialist evidence.",
    )

    evidence = {
        "representative_id": state.get(
            "representative_id",
        ),
        "investigation_period": {
            "start_date": state.get(
                "start_date",
            ),
            "end_date": state.get(
                "end_date",
            ),
        },
        "products_analyzed": state.get(
            "products_analyzed",
            [],
        ),
        "detected_findings": state.get(
            "findings",
            [],
        ),
        "investigation_plan": state.get(
            "investigation_plan",
            {},
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
        "peer_analysis": state.get(
            "peer_analysis",
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

    try:

        response_text = await gemini_chat_with_fallback(prompt)

    except Exception:

        emit_workflow_event(
            event_type="agent_status",
            agent=agent_id,
            status="error",
        )

        raise

    cleaned_response = response_text.replace("```json", "").replace("```", "").strip()

    try:

        parsed = json.loads(cleaned_response)
        parsed = validate_risk_synthesis(parsed)

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
                "peer_analysis": "",
            },
            "recommended_actions": [],
            "human_review_required": True,
        }

    # -------------------------------------------------
    # POST PROCESSING GUARDRAIL
    # Peer benchmarking cannot become risk
    # -------------------------------------------------

    parsed["top_risk_drivers"] = remove_peer_risk_items(
        parsed.get(
            "top_risk_drivers",
            [],
        )
    )

    parsed["recommended_actions"] = remove_peer_risk_items(
        parsed.get(
            "recommended_actions",
            [],
        )
    )

    severity = parsed.get(
        "overall_severity",
        "UNKNOWN",
    )

    severity_scores = {
        "NORMAL": 0,
        "LOW": 25,
        "MEDIUM": 50,
        "HIGH": 75,
        "UNKNOWN": 0,
    }

    score = severity_scores.get(
        severity,
        0,
    )

    parsed["overall_risk_score"] = score

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            f"Risk synthesis completed with {severity} severity "
            f"and an overall risk score of {score} / 100."
        ),
    )

    emit_workflow_event(
        event_type="agent_result",
        agent=agent_id,
        status="complete",
        output=parsed,
    )

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="complete",
    )

    return {
        "overall_risk_score": score,
        "overall_severity": severity,
        "findings": state.get(
            "findings",
            [],
        ),
        "final_report": parsed,
    }
