import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback
from ..services.investigation_stream import emit_workflow_event

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

    # ==========================================================
    # INVESTIGATION CONTEXT
    # ==========================================================

    representative_id = state.get("representative_id")
    start_date = state.get("start_date")
    end_date = state.get("end_date")

    products_analyzed = state.get("products_analyzed", [])
    findings = state.get("findings", [])

    evidence = {
        "representative_id": representative_id,
        "start_date": start_date,
        "end_date": end_date,
        "products_analyzed": products_analyzed,
        "available_findings": findings,
    }

    # ==========================================================
    # WORKFLOW - PLANNER STARTED
    # ==========================================================

    emit_workflow_event(
        event_type="agent_status",
        agent="investigation_planner",
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent="investigation_planner",
        message=(f"Starting investigation planning for representative " f"{representative_id}."),
    )

    # ==========================================================
    # COMMENTARY - DATE RANGE
    # ==========================================================

    emit_workflow_event(
        event_type="commentary",
        agent="investigation_planner",
        message=(f"Reviewing investigation period from " f"{start_date} to {end_date}."),
    )

    # ==========================================================
    # COMMENTARY - PRODUCTS
    # ==========================================================

    product_count = len(products_analyzed)

    if product_count > 0:
        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message=(
                f"{product_count} product"
                f"{'s' if product_count != 1 else ''} "
                f"identified for investigation."
            ),
        )

    else:
        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message="No products were identified for this investigation.",
        )

    # ==========================================================
    # COMMENTARY - FINDINGS
    # ==========================================================

    finding_count = len(findings)

    emit_workflow_event(
        event_type="commentary",
        agent="investigation_planner",
        message=(
            f"Reviewing {finding_count} deterministic finding"
            f"{'s' if finding_count != 1 else ''} "
            f"from the analytics engine."
        ),
    )

    # ==========================================================
    # FIND AVAILABLE FINDING TYPES
    # ==========================================================

    finding_types = {str(finding.get("type")) for finding in findings if finding.get("type")}

    available_areas: list[str] = []

    if "sales_deviation" in finding_types:
        available_areas.append("sales trends")

    if "sales_prescription_mismatch" in finding_types:
        available_areas.append("sales and prescription alignment")

    if "doctor_concentration" in finding_types or "cross_territory_concentration" in finding_types:
        available_areas.append("doctor and territory behaviour")

    if "payout_discrepancy" in finding_types:
        available_areas.append("payout validation")

    if available_areas:
        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message=("Available evidence supports review of " + ", ".join(available_areas) + "."),
        )

    # ==========================================================
    # COMMENTARY - LLM PLANNING
    # ==========================================================

    emit_workflow_event(
        event_type="commentary",
        agent="investigation_planner",
        message=("Determining which specialist investigation areas " "should receive priority."),
    )

    # ==========================================================
    # BUILD PROMPT
    # ==========================================================

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

    # ==========================================================
    # CALL GEMINI
    # ==========================================================

    try:
        response_text = await gemini_chat_with_fallback(prompt)

    except Exception as exc:

        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message="The investigation planner could not complete its AI review.",
        )

        emit_workflow_event(
            event_type="agent_status",
            agent="investigation_planner",
            status="error",
        )

        raise exc

    # ==========================================================
    # CLEAN RESPONSE
    # ==========================================================

    cleaned_response = response_text.replace("```json", "").replace("```", "").strip()

    # ==========================================================
    # PARSE RESPONSE
    # ==========================================================

    try:
        plan = json.loads(cleaned_response)

    except json.JSONDecodeError:

        plan = {
            "focus_areas": [],
            "priority": "UNKNOWN",
            "reasoning": ["Gemini response could not be parsed as JSON."],
        }

        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message=(
                "Planner response was received, but its structured " "output could not be parsed."
            ),
        )

    # ==========================================================
    # NORMALIZE PLAN
    # ==========================================================

    focus_areas = plan.get("focus_areas", [])
    priority = plan.get("priority", "UNKNOWN")
    reasoning = plan.get("reasoning", [])

    if not isinstance(focus_areas, list):
        focus_areas = []

    if not isinstance(reasoning, list):
        reasoning = []

    if not isinstance(priority, str):
        priority = "UNKNOWN"

    plan = {
        "focus_areas": focus_areas,
        "priority": priority,
        "reasoning": reasoning,
    }

    # ==========================================================
    # COMMENTARY - PLANNER DECISION
    # ==========================================================

    emit_workflow_event(
        event_type="commentary",
        agent="investigation_planner",
        message=f"Investigation priority set to {priority}.",
    )

    # ==========================================================
    # COMMENTARY - FOCUS AREAS
    # ==========================================================

    focus_area_labels = {
        "sales_trend": "sales trends",
        "prescription_alignment": "sales and prescription alignment",
        "territory_behavior": "doctor and territory behaviour",
        "payout_validation": "payout validation",
    }

    readable_focus_areas = [focus_area_labels.get(area, str(area)) for area in focus_areas]

    if readable_focus_areas:

        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message=(
                "Planner selected " + ", ".join(readable_focus_areas) + " for specialist review."
            ),
        )

    else:

        emit_workflow_event(
            event_type="commentary",
            agent="investigation_planner",
            message=(
                "Planner did not identify any specialist focus "
                "areas requiring additional review."
            ),
        )

    # ==========================================================
    # COMMENTARY - SAFE REASONING SUMMARY
    # ==========================================================

    for reason in reasoning[:3]:

        if reason:

            emit_workflow_event(
                event_type="commentary",
                agent="investigation_planner",
                message=str(reason),
            )

    # ==========================================================
    # SEND STRUCTURED PLANNER RESULT TO UI
    # ==========================================================

    emit_workflow_event(
        event_type="agent_result",
        agent="investigation_planner",
        status="complete",
        output=plan,
    )

    # ==========================================================
    # PLANNER COMPLETE
    # ==========================================================

    emit_workflow_event(
        event_type="agent_status",
        agent="investigation_planner",
        status="complete",
    )

    # ==========================================================
    # RETURN AUTHORITATIVE LANGGRAPH STATE
    # ==========================================================

    return {
        "investigation_plan": plan,
    }
