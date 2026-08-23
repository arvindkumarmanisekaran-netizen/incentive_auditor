from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from langgraph.config import get_stream_writer


def emit_workflow_event(
    *,
    event_type: str,
    agent: str,
    message: str | None = None,
    status: str | None = None,
    output: Any | None = None,
) -> None:
    """
    Emit a frontend-only workflow event.

    These events are not part of the authoritative investigation state.
    They are only used for live investigation commentary / progress UI.
    """

    try:
        writer = get_stream_writer()
    except Exception:
        return

    event: dict[str, Any] = {
        "type": event_type,
        "agent": agent,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if message is not None:
        event["message"] = message

    if status is not None:
        event["status"] = status

    if output is not None:
        event["output"] = output

    try:
        writer(event)
    except Exception:
        # Workflow commentary should never break the actual investigation.
        return
