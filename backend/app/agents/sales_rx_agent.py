import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback
from ..services.investigation_stream import emit_workflow_event

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

    agent_id = "sales_rx"

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Starting sales and prescription evidence review.",
    )

    relevant_types = {
        "sales_deviation",
        "sales_prescription_mismatch",
    }

    findings = state.get("findings", [])

    relevant_findings = [finding for finding in findings if finding.get("type") in relevant_types]

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            f"Found {len(relevant_findings)} sales and prescription "
            "findings available for interpretation."
        ),
    )

    if not relevant_findings:

        parsed = {
            "severity": "UNKNOWN",
            "anomaly_detected": False,
            "summary": "No sales or prescription evidence available for analysis.",
            "evidence_summary": [],
            "key_observations": [],
            "limitations": ["No sales deviation or prescription mismatch findings were provided."],
            "investigation_priority": "LOW",
        }

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="No sales or prescription evidence was available for specialist review.",
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

        return {"sales_rx_analysis": parsed}

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

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            "Reviewing sales deviation evidence and comparing it with "
            "the available prescription alignment findings."
        ),
    )

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
                f"Evidence covers {len(product_ids)} product"
                f"{'s' if len(product_ids) != 1 else ''}: " + ", ".join(product_ids) + "."
            ),
        )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Requesting specialist interpretation of the supplied evidence.",
    )

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

    try:
        response_text = await gemini_chat_with_fallback(prompt)

    except Exception:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="Sales and prescription specialist analysis could not be completed.",
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
            "limitations": ["The AI response was not valid JSON."],
            "investigation_priority": "LOW",
            "raw_response": response_text,
        }

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="Specialist response was received but could not be parsed as structured JSON.",
        )

    severity = parsed.get("severity", "UNKNOWN")
    anomaly_detected = parsed.get("anomaly_detected", False)
    priority = parsed.get("investigation_priority", "LOW")

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            f"Sales and prescription review completed with "
            f"{severity} severity and {priority} investigation priority."
        ),
    )

    if anomaly_detected:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="The supplied evidence contains observations that may require human review.",
        )
    else:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="No material sales and prescription anomaly was identified by the specialist review.",  # noqa: E501
        )

    summary = parsed.get("summary")

    if summary:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=str(summary),
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
        "sales_rx_analysis": parsed,
    }
