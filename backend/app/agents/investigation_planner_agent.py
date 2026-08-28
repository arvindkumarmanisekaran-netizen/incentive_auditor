import json
import re
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


def _display_product(product_name: Any, product_id: Any) -> str:
    name = str(product_name or "").strip()
    identifier = str(product_id or "").strip()
    if not identifier or identifier.upper() == "ALL":
        return name or "All Products"
    if not name:
        return f"Product ({identifier})"
    if f"({identifier.lower()})" in name.lower():
        return name
    return f"{name} ({identifier})"


def _display_representative(representative_name: Any, representative_id: Any) -> str:
    name = str(representative_name or "").strip()
    identifier = str(representative_id or "").strip()
    if not identifier:
        return name or "Representative"
    if not name:
        return f"Representative ({identifier})"
    if f"({identifier.lower()})" in name.lower():
        return name
    return f"{name} ({identifier})"


def _normalize_reasoning_labels(
    value: Any,
    findings: list[dict[str, Any]],
    representative_name: Any,
    representative_id: Any,
) -> str:
    text_value = str(value)

    # Planner focus-area identifiers are part of the agent's structured
    # contract, but they must never leak into human-readable commentary.
    focus_area_labels = {
        "sales_trend": "sales trend",
        "prescription_alignment": "prescription alignment",
        "territory_behavior": "territory behaviour",
        "payout_validation": "payout validation",
    }
    for focus_area, readable_label in focus_area_labels.items():
        text_value = re.sub(
            rf"\b{re.escape(focus_area)}\b",
            readable_label,
            text_value,
            flags=re.IGNORECASE,
        )

    for finding in findings:
        product_id = str(finding.get("product_id") or "").strip()
        if not product_id or product_id.upper() == "ALL":
            continue
        product_name = finding.get("product_name") or (finding.get("evidence") or {}).get(
            "product_name"
        )
        label = _display_product(product_name, product_id)
        text_value = re.sub(
            rf"(?<!\()\b{re.escape(product_id)}\b",
            lambda _match: label,
            text_value,
            flags=re.IGNORECASE,
        )

    representative_id_text = str(representative_id or "").strip()
    if representative_id_text:
        representative_label = _display_representative(
            representative_name,
            representative_id_text,
        )
        text_value = re.sub(
            rf"(?<!\()\b{re.escape(representative_id_text)}\b",
            lambda _match: representative_label,
            text_value,
            flags=re.IGNORECASE,
        )
    return text_value


async def investigation_planner_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    # ==========================================================
    # INVESTIGATION CONTEXT
    # ==========================================================

    representative_id = state.get("representative_id")
    representative_name = state.get("representative_name")
    if not representative_name:
        representative = next(
            (
                item
                for item in state.get("representatives", [])
                if item.get("representative_id") == representative_id
            ),
            None,
        )
        if representative:
            representative_name = " ".join(
                part
                for part in (
                    str(representative.get("first_name") or "").strip(),
                    str(representative.get("last_name") or "").strip(),
                )
                if part
            )
    start_date = state.get("start_date")
    end_date = state.get("end_date")

    products_analyzed = state.get("products_analyzed", [])
    findings = state.get("findings", [])

    evidence = {
        "representative": _display_representative(representative_name, representative_id),
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
        message=(
            "Starting investigation planning for representative "
            f"{_display_representative(representative_name, representative_id)}."
        ),
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

    reasoning = [
        _normalize_reasoning_labels(
            reason,
            findings,
            representative_name,
            representative_id,
        )
        for reason in reasoning
    ]

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
