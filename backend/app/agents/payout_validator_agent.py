import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback
from ..services.investigation_stream import emit_workflow_event
from ..utils.display_labels import investigation_text

SYSTEM_PROMPT = """
You are the Payout Evidence Analysis Agent
inside a pharmaceutical incentive investigation workflow.

Your role is to interpret already calculated payout evidence.

You DO NOT:
- calculate payouts
- recalculate incentive formulas
- query databases
- determine fraud
- accuse representatives


Your responsibility is ONLY:

1. Interpret expected payout evidence.
2. Interpret actual payout evidence.
3. Interpret payout differences.
4. Review incentive calculation consistency evidence.
5. Explain payout-related observations that may require human review.


STRICT RULES:

1. Use ONLY supplied evidence.
2. Never invent missing payout information.
3. Never modify numeric values.
4. Never perform your own calculations.
5. Never conclude fraud or misconduct occurred.
6. A payout difference is an anomaly indicator, not proof of wrongdoing.
7. Do not analyze sales trends.
8. Do not analyze prescriptions.
9. Do not analyze doctors or territories.
10. If payout evidence is unavailable, clearly state this.
11. Separate evidence from interpretation.


Return valid JSON only:

{
    "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",

    "anomaly_detected": true|false,

    "summary": "Short explanation of payout evidence",

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
not a fraud detection system.
"""


async def payout_validator_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    agent_id = "payout"

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Starting incentive payout evidence review.",
    )

    relevant_types = {
        "payout_discrepancy",
        "incentive_payout_discrepancy",
        "payout_variance",
    }

    findings = state.get("findings", [])

    relevant_findings = [finding for finding in findings if finding.get("type") in relevant_types]

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            f"Found {len(relevant_findings)} payout finding"
            f"{'s' if len(relevant_findings) != 1 else ''} "
            "available for interpretation."
        ),
    )

    if not relevant_findings:

        parsed = {
            "severity": "UNKNOWN",
            "anomaly_detected": False,
            "summary": "No payout evidence is available for analysis.",
            "evidence_summary": [],
            "key_observations": [],
            "limitations": ["No payout discrepancy findings were provided."],
            "investigation_priority": "LOW",
        }

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="No payout discrepancy evidence was available for specialist review.",
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
            "payout_analysis": parsed,
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
        "payout_findings": relevant_findings,
    }

    product_ids = sorted(
        {
            str(finding.get("product_id"))
            for finding in relevant_findings
            if finding.get("product_id") and finding.get("product_id") != "ALL"
        }
    )

    if product_ids:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(
                f"Reviewing payout evidence across {len(product_ids)} product"
                f"{'s' if len(product_ids) != 1 else ''}."
            ),
        )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            "Comparing the supplied expected payout, actual payout "
            "and payout discrepancy evidence."
        ),
    )

    prompt = f"""
    {SYSTEM_PROMPT}

    Analyze ONLY this payout evidence:

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
            event_type="commentary",
            agent=agent_id,
            message="Payout specialist analysis could not be completed.",
        )

        emit_workflow_event(
            event_type="agent_status",
            agent=agent_id,
            status="error",
        )

        raise

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

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="Specialist response was received but could not be parsed as structured JSON.",
        )

    severity = parsed.get("severity", "UNKNOWN")
    priority = parsed.get("investigation_priority", "LOW")

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            f"Payout review completed with {severity} severity "
            f"and {priority} investigation priority."
        ),
    )

    summary = parsed.get("summary")

    if summary:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=investigation_text(summary, state),
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
        "payout_analysis": parsed,
    }
