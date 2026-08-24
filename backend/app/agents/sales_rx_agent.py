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

You ONLY:

1. Interpret sales deviation evidence.
2. Interpret sales-prescription mismatch evidence.
3. Explain observations.
4. Provide review context.

STRICT RULES:

- Use only supplied evidence.
- Never invent information.
- Never assume misconduct.
- Never state fraud occurred.
- Never modify numerical values.
- Never calculate new percentages.
- Prescription data is supporting evidence only.
- Prescription does not determine incentive payout.

Return JSON only.

Format:

{
    "severity": "NORMAL|LOW|MEDIUM|HIGH|UNKNOWN",
    "anomaly_detected": true|false,
    "summary": "",
    "evidence_summary": [],
    "key_observations": [],
    "limitations": [],
    "investigation_priority": "LOW|MEDIUM|HIGH"
}
"""


def extract_product_metrics(
    findings: list[dict[str, Any]],
) -> dict[str, dict[str, float]]:

    metrics = {}

    for finding in findings:

        product_id = finding.get("product_id")

        if not product_id or product_id == "ALL":
            continue

        evidence = finding.get(
            "evidence",
            {},
        )

        metrics.setdefault(
            product_id,
            {
                "sales": 0.0,
                "rx": 0.0,
                "payout": 0.0,
            },
        )

        finding_type = finding.get("type")

        # -------------------------------
        # SALES
        # -------------------------------

        if finding_type == "sales_deviation":

            metrics[product_id]["sales"] = float(
                evidence.get(
                    "current_sales",
                    0,
                )
                or 0
            )

        # -------------------------------
        # RX
        # -------------------------------

        if finding_type == "sales_prescription_mismatch":

            metrics[product_id]["rx"] = float(
                evidence.get(
                    "current_rx",
                    0,
                )
                or 0
            )

        # -------------------------------
        # PAYOUT
        # -------------------------------

        if finding_type == "payout_discrepancy":

            metrics[product_id]["payout"] = float(
                evidence.get(
                    "actual_payout",
                    0,
                )
                or 0
            )

    return metrics


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

    findings = state.get(
        "findings",
        [],
    )

    relevant_types = {
        "sales_deviation",
        "sales_prescription_mismatch",
    }

    relevant_findings = [finding for finding in findings if finding.get("type") in relevant_types]

    product_metrics = extract_product_metrics(relevant_findings)

    if not relevant_findings:

        result = {
            "severity": "UNKNOWN",
            "anomaly_detected": False,
            "summary": "No sales or prescription evidence available.",
            "evidence_summary": [],
            "key_observations": [],
            "limitations": ["No sales findings were provided."],
            "investigation_priority": "LOW",
            "product_metrics": {},
        }

        return {"sales_rx_analysis": result}

    evidence = {
        "representative_id": state.get("representative_id"),
        "period": {
            "start_date": state.get("start_date"),
            "end_date": state.get("end_date"),
        },
        "sales_prescription_findings": relevant_findings,
    }

    prompt = f"""
    {SYSTEM_PROMPT}


    Analyze this evidence:

    {json.dumps(
        evidence,
        indent=2,
        default=str,
    )}


    Return JSON only.
    """

    try:

        response = await gemini_chat_with_fallback(prompt)

    except Exception:

        raise

    cleaned = (
        response.replace(
            "```json",
            "",
        )
        .replace(
            "```",
            "",
        )
        .strip()
    )

    try:

        parsed = json.loads(cleaned)

    except json.JSONDecodeError:

        parsed = {
            "severity": "UNKNOWN",
            "anomaly_detected": False,
            "summary": "Unable to parse specialist response.",
            "evidence_summary": [],
            "key_observations": [],
            "limitations": ["AI response was not valid JSON."],
            "investigation_priority": "LOW",
        }

    # IMPORTANT:
    # Attach deterministic metrics
    # for peer comparison

    parsed["product_metrics"] = product_metrics

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
