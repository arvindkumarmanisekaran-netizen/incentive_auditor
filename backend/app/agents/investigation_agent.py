import json
from typing import Any

from ..graph.state import InvestigationState
from ..core.llm import gemini_chat_with_fallback
from ..services.investigation_stream import emit_workflow_event

SYSTEM_PROMPT = """
You are the Investigation Summary Agent
inside a pharmaceutical incentive audit workflow.

Your role is to convert the completed investigation output
into a concise audit summary for human reviewers.

You receive:

1. Risk synthesis output
2. Specialist evidence interpretations
3. Deterministic anomaly findings


Your responsibility:

- Explain what was observed.
- Summarize important evidence.
- Highlight review priorities.
- Suggest evidence-based next actions.


STRICT RULES:

1. Use ONLY supplied evidence.
2. Never invent facts.
3. Never create new findings.
4. Never modify numeric values.
5. Never recalculate metrics.
6. Never state fraud occurred.
7. Never accuse a representative.
8. An anomaly only indicates that review may be required.
9. Recommendations must directly follow from evidence.
10. If evidence is insufficient, clearly state that.


Return valid JSON only:

{
  "executive_summary": "string",

  "key_findings": [
      "string"
  ],

  "investigation_priorities": [
    {
      "priority": 1,
      "area": "string",
      "reason": "string"
    }
  ],

  "recommended_next_actions": [
      "string"
  ],

  "human_review_required": true
}

"""


async def investigation_agent(
    state: InvestigationState,
) -> dict[str, Any]:

    agent_id = "investigation_summary"

    emit_workflow_event(
        event_type="agent_status",
        agent=agent_id,
        status="running",
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Preparing the final human-readable investigation summary.",
    )

    investigation_data = {
        "representative_id": state.get("representative_id"),
        "investigation_period": {
            "start_date": state.get("start_date"),
            "end_date": state.get("end_date"),
        },
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
        "final_risk_assessment": state.get(
            "final_report",
            {},
        ),
    }

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message=(
            "Consolidating deterministic findings, specialist interpretations "
            "and the final risk assessment."
        ),
    )

    emit_workflow_event(
        event_type="commentary",
        agent=agent_id,
        message="Preparing review priorities and evidence-based next actions.",
    )

    prompt = f"""
    {SYSTEM_PROMPT}

    Completed investigation evidence:

    {json.dumps(
        investigation_data,
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
            message="The final investigation summary could not be generated.",
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
            "executive_summary": response_text,
            "key_findings": [],
            "investigation_priorities": [],
            "recommended_next_actions": [],
            "human_review_required": True,
        }

        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message="Summary response was received but could not be parsed as structured JSON.",
        )

    executive_summary = parsed.get(
        "executive_summary",
    )

    if executive_summary:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=str(executive_summary),
        )

    priorities = parsed.get(
        "investigation_priorities",
        [],
    )

    if priorities:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(
                f"Prepared {len(priorities)} investigation "
                f"priorit{'y' if len(priorities) == 1 else 'ies'} "
                "for human review."
            ),
        )

    actions = parsed.get(
        "recommended_next_actions",
        [],
    )

    if actions:
        emit_workflow_event(
            event_type="commentary",
            agent=agent_id,
            message=(
                f"Prepared {len(actions)} evidence-based recommended "
                f"next action{'s' if len(actions) != 1 else ''}."
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
        "investigation_summary": parsed,
    }
