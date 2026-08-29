from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import re
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..agents.investigation_chat_agent import investigation_chat_agent
from ..db.session import get_db

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class InvestigationContext(BaseModel):
    representative_id: str | None = None
    representative_name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    result: dict[str, Any] | None = None
    selected_evidence: list[dict[str, Any]] = Field(default_factory=list)
    focused_finding: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation: list[dict[str, str]] = Field(default_factory=list)
    context: InvestigationContext | None = None


TABLE_ALIASES = {
    "rep": "representatives", "reps": "representatives",
    "representative": "representatives", "representatives": "representatives",
    "doctor": "doctors", "doctors": "doctors",
    "product": "products", "products": "products",
    "territory": "territories", "territories": "territories",
    "assignment": "representative_doctor_assignments", "assignments": "representative_doctor_assignments",
    "sale": "sales", "sales": "sales",
    "prescription": "prescriptions", "prescriptions": "prescriptions",
    "payout": "incentive_payouts", "payouts": "incentive_payouts",
}

DISPLAY_COLUMNS = {
    "representatives": ["representative_id", "first_name", "last_name", "territory_id", "status"],
    "doctors": ["doctor_id", "doctor_name", "specialization", "territory_id", "status"],
    "products": ["product_id", "product_name", "product_category", "status"],
    "territories": ["territory_id", "territory_name", "region", "country", "status"],
    "representative_doctor_assignments": ["assignment_id", "representative_id", "doctor_id", "effective_from", "effective_to", "status"],
    "sales": ["sale_id", "sale_date", "doctor_id", "product_id", "quantity", "sales_amount", "status"],
    "prescriptions": ["prescription_id", "prescription_date", "doctor_id", "product_id", "quantity", "status"],
    "incentive_payouts": ["payout_id", "representative_id", "product_id", "payout_month", "expected_payout", "actual_payout", "payout_difference", "status"],
}


def json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def product_label(item: dict[str, Any] | None) -> str:
    item = item or {}
    evidence = item.get("evidence") or {}
    product_id = str(item.get("product_id") or "").strip()
    product_name = str(item.get("product_name") or evidence.get("product_name") or "").strip()
    if not product_id or product_id.upper() == "ALL":
        return product_name or "All Products"
    if not product_name:
        return product_id
    if f"({product_id.lower()})" in product_name.lower():
        return product_name
    return f"{product_name} ({product_id})"


def representative_label(name: Any, representative_id: Any) -> str:
    display_name = str(name or "").strip()
    identifier = str(representative_id or "").strip()
    if not identifier:
        return display_name or "Representative"
    if not display_name:
        return f"Representative ({identifier})"
    if f"({identifier.lower()})" in display_name.lower():
        return display_name
    return f"{display_name} ({identifier})"


def context_representative_label(context: InvestigationContext | None) -> str:
    return representative_label(
        context.representative_name if context else None,
        context.representative_id if context else None,
    )


def requested_table(message: str, entities: dict[str, Any]) -> str | None:
    supplied = str(entities.get("table") or entities.get("entity") or "").lower()
    if supplied in TABLE_ALIASES:
        return TABLE_ALIASES[supplied]
    lowered = message.lower()
    for alias in sorted(TABLE_ALIASES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", lowered):
            return TABLE_ALIASES[alias]
    return None


def conversation_table(conversation: list[dict[str, str]]) -> str | None:
    """Recover the active read-only table for terse follow-up questions."""
    for item in reversed(conversation[-8:]):
        table = requested_table(str(item.get("content") or ""), {})
        if table:
            return table
    return None


def representative_filter(message: str, entities: dict[str, Any]) -> str | None:
    supplied = entities.get("representative_name") or entities.get("representative_id") or entities.get("name")
    if supplied:
        return str(supplied).strip()
    cleaned_message = re.sub(r"([A-Za-z])['’]s\b", r"\1", message)
    name_token = r"([A-Za-z0-9][A-Za-z0-9' -]{1,60})"
    patterns = (
        rf"(?:fetch|get|find|show|give|give me|tell me about|look up|lookup|retrieve|display|open|pull up|bring me|details? (?:for|of)|information (?:for|on|about)|profile (?:for|of))\s+(?:me\s+)?(?:the\s+)?(?:rep(?:resentative)?\s+)?(?:(?:details?|information|profile|records?)\s+(?:for|of|on|about)\s+)?{name_token}",
        rf"(?:i want|only|just)\s+{name_token}",
        rf"^\s*{name_token}\s+(?:rep(?:resentative)?\s+)?(?:details?|information|profile|record)(?:\s+please)?\s*[?.!]*\s*$",
    )
    for pattern in patterns:
        match = re.search(pattern, cleaned_message, flags=re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            value = re.sub(r"\s+(?:rep(?:resentative)?\s+)?(?:details?|records?|information|profile)(?:\s+to me)?$", "", value, flags=re.IGNORECASE)
            value = re.sub(r"\s+(?:rep|representative)$", "", value, flags=re.IGNORECASE)
            generic_scope = r"(?:(?:display|get|show|fetch|retrieve|list)\s+)?(?:database(?: information)?|data|governed data|operational(?: records?)?|stored(?: information)?|application data|table|records?)"
            if value and not re.fullmatch(rf"(?:(?:all|active|inactive)\s+)?(?:reps?|representatives?)|{generic_scope}", value, flags=re.IGNORECASE):
                return value
    return None


def is_representative_detail_request(message: str, entities: dict[str, Any] | None = None) -> bool:
    lowered = message.lower()
    asks_for_detail = any(word in lowered for word in ("detail", "information", "profile", "record"))
    conversational_lookup = bool(re.search(r"\b(?:tell me about|open|pull up|bring me)\b", lowered) and re.search(r"\b(?:rep|representative)\b", lowered))
    return (asks_for_detail or conversational_lookup) and representative_filter(message, entities or {}) is not None


def has_any(text_value: str, phrases: tuple[str, ...]) -> bool:
    return any(phrase in text_value for phrase in phrases)


def capability_question(lowered: str) -> bool:
    return lowered.startswith(("can you ", "could you ", "what can you ", "are your ", "do you "))


def guarded_request(lowered: str) -> dict[str, Any] | None:
    secret_terms = ("password", "credential", "secret", "api key", "access token", "auth token", "connection string", "private key", "environment variable", "system prompt", "authentication cookie")
    write_terms = ("delete ", "drop table", "update ", "insert ", "overwrite ", "disable read-only", "bypass confirmation", "execute database writes", "set anika", "change anika", "change p022", "modify doctor", "create a new payout", "mark the payout as paid")
    if has_any(lowered, secret_terms):
        return {"action": "ANSWER", "message": "I can’t expose credentials, secrets or private authentication data. I can explain the governed API and workspace requirements instead."}
    if has_any(lowered, write_terms) or re.search(r"\bdrop\b.+\btable\b", lowered):
        return {"action": "ANSWER", "message": "Copilot database access is read-only. I can inspect the relevant records or propose a governed action for confirmation, but I cannot directly modify or delete them."}
    return None


async def resolve_representative(db: AsyncSession, representative_name: str) -> dict[str, Any]:
    result = await db.execute(
        text("""
            SELECT representative_id, first_name, last_name
            FROM representatives
            WHERE LOWER(first_name) LIKE LOWER(:name)
               OR LOWER(last_name) LIKE LOWER(:name)
               OR LOWER(first_name || ' ' || last_name) LIKE LOWER(:name)
               OR LOWER(representative_id) = LOWER(:exact_name)
            ORDER BY first_name, last_name
            LIMIT 5
        """),
        {"name": f"%{representative_name}%", "exact_name": representative_name},
    )
    representatives = result.fetchall()
    if not representatives:
        return {"found": False, "message": f"No representative found for {representative_name}."}
    if len(representatives) > 1:
        return {
            "found": False, "multiple": True,
            "representatives": [{"id": row.representative_id, "name": f"{row.first_name} {row.last_name}"} for row in representatives],
            "message": "I found multiple matching representatives. Please use a full name or ID.",
        }
    row = representatives[0]
    return {"found": True, "representative_id": row.representative_id, "representative_name": f"{row.first_name} {row.last_name}"}


async def run_read_only_query(db: AsyncSession, message: str, entities: dict[str, Any]) -> dict[str, Any]:
    table = requested_table(message, entities)
    if not table:
        return {
            "action": "NEED_QUERY_SCOPE",
            "message": "Which records should I query? I can read representatives, doctors, products, territories, assignments, sales, prescriptions or payouts.",
        }
    columns = DISPLAY_COLUMNS[table]
    lowered = message.lower()
    status = entities.get("status")
    if not status:
        status = "Active" if "active" in lowered and "inactive" not in lowered else "Inactive" if "inactive" in lowered else None
    predicates: list[str] = []
    try:
        limit = int(entities.get("limit") or 20)
    except (TypeError, ValueError):
        limit = 20
    parameters: dict[str, Any] = {"limit": min(max(limit, 1), 50)}
    if status and "status" in columns:
        predicates.append("LOWER(status) = LOWER(:status)")
        parameters["status"] = status
    name_filter = representative_filter(message, entities) if table == "representatives" else None
    if name_filter:
        predicates.append("(LOWER(first_name) LIKE LOWER(:record_name) OR LOWER(last_name) LIKE LOWER(:record_name) OR LOWER(first_name || ' ' || last_name) LIKE LOWER(:record_name) OR LOWER(representative_id) = LOWER(:record_id))")
        parameters.update(record_name=f"%{name_filter}%", record_id=name_filter)
    where_clause = f" WHERE {' AND '.join(predicates)}" if predicates else ""
    query = text(f"SELECT {', '.join(columns)} FROM {table}{where_clause} ORDER BY {columns[0]} LIMIT :limit")
    rows = await db.execute(query, parameters)
    records = [{key: json_value(value) for key, value in dict(row).items()} for row in rows.mappings().all()]
    applied_filters = ([f"status = {status}"] if status else []) + ([f"name or ID = {name_filter}"] if name_filter else [])
    filter_text = "; ".join(applied_filters) or "none"
    return {
        "action": "DATA_RESULT",
        "message": f"Found {len(records)} {table.replace('_', ' ')} record{'s' if len(records) != 1 else ''}.",
        "data": {"table": table, "columns": columns, "records": records},
        "sources": [{"source": table, "filters": filter_text, "record_count": len(records), "access": "read-only"}],
        "suggestions": ["Explain these results", "Narrow the query", "Print this information"],
    }


def explain_finding(context: InvestigationContext | None, message: str) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not findings:
        return {"action": "NO_FINDING", "message": "Run or select an investigation first so I can explain its findings and evidence."}
    lowered = message.lower()
    explicit = next((finding for finding in findings if str(finding.get("type", "")).replace("_", " ") in lowered or (finding.get("product_id") and str(finding["product_id"]).lower() in lowered)), None)
    selected = explicit or (context.focused_finding if context and context.focused_finding else None) or findings[0]
    finding_type = str(selected.get("type", "finding")).replace("_", " ").title()
    severity = str(selected.get("severity", "Unknown")).title()
    evidence = selected.get("evidence") or {}
    failed_checks = evidence.get("failed_checks") or []
    details = []
    for check in failed_checks[:8]:
        if not isinstance(check, dict):
            continue
        label = str(check.get("subtype") or "failed rule").replace("_", " ").title()
        rule = str(check.get("rule") or "Review the recorded and calculated values.")
        recorded = check.get("recorded_value")
        calculated = check.get("calculated_value")
        value_context = ""
        if recorded is not None or calculated is not None:
            value_context = f" Recorded: {recorded}; calculated: {calculated}."
        details.append(f"{label}: {rule}{value_context}")

    if not details:
        details = [
            f"{key.replace('_', ' ').title()}: {value}"
            for key, value in list(evidence.items())[:8]
        ]
    product = product_label(selected)
    return {
        "action": "FINDING_EXPLANATION",
        "message": f"{finding_type} is rated {severity} for {product}. The rating is supported by the recorded metrics below; it is an analytical finding, not a final compliance decision.",
        "details": details,
        "finding": selected,
        "sources": [{"source": "current investigation findings", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}; product={product}", "record_count": 1, "access": "investigation context"}],
        "suggestions": ["Show supporting database records", "Compare with peers", "Print investigation summary"],
    }


def findings_summary(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not findings:
        return {"action": "NO_FINDING", "message": "Run an investigation first so I can summarize its findings."}
    counts: dict[str, int] = {}
    items = []
    for finding in findings:
        severity = str(finding.get("severity", "UNKNOWN")).upper()
        counts[severity] = counts.get(severity, 0) + 1
        items.append({
            "type": str(finding.get("type", "finding")).replace("_", " ").title(),
            "product": product_label(finding),
            "severity": severity,
            "evidence_count": len(finding.get("evidence") or {}),
        })
    return {
        "action": "FINDINGS_SUMMARY",
        "message": f"The investigation contains {len(findings)} findings across {len(set(item['product'] for item in items))} product scope(s).",
        "severity_counts": counts,
        "finding_items": items,
        "sources": [{"source": "current investigation findings", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "investigation context"}],
        "suggestions": ["Run root cause analysis", "Compare with peers", "Run reviewer checks"],
    }


SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "NORMAL": 0, "UNKNOWN": 0}


def root_cause_analysis(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not findings:
        return {"action": "NO_FINDING", "message": "Run an investigation first so I can perform a grounded root-cause analysis."}
    ranked = sorted(findings, key=lambda item: SEVERITY_RANK.get(str(item.get("severity", "UNKNOWN")).upper(), 0), reverse=True)
    drivers = []
    for finding in ranked[:4]:
        evidence = finding.get("evidence") or {}
        numeric = [(key, value) for key, value in evidence.items() if isinstance(value, (int, float)) and key != "severity"]
        preferred_keys = (
            "mismatch_score", "deviation_percent", "payout_difference",
            "sales_change_percent", "prescription_change_percent",
            "top_doctor_share", "cross_territory_share",
        )
        strongest = next(((key, evidence[key]) for key in preferred_keys if isinstance(evidence.get(key), (int, float))), None)
        if strongest is None:
            strongest = max(numeric, key=lambda item: abs(float(item[1])), default=None)
        drivers.append({
            "finding": str(finding.get("type", "finding")).replace("_", " ").title(),
            "product": product_label(finding),
            "severity": finding.get("severity", "UNKNOWN"),
            "strongest_metric": f"{strongest[0].replace('_', ' ').title()}: {strongest[1]}" if strongest else "No numeric driver recorded",
        })
    hypotheses = [
        "The highest-severity finding is the primary analytical driver and should be verified against its supporting records.",
        "If multiple findings share a product, the anomaly may be concentrated rather than portfolio-wide.",
        "Data-quality or assignment changes remain alternative explanations until source records are verified.",
    ]
    return {
        "action": "ROOT_CAUSE_ANALYSIS",
        "message": f"I ranked {len(findings)} findings and identified {len(drivers)} leading analytical drivers. These are evidence-based leads, not confirmed causes.",
        "drivers": drivers,
        "hypotheses": hypotheses,
        "next_steps": ["Focus the highest-severity chart", "Add the leading finding to evidence", "Run reviewer checks"],
        "sources": [{"source": "current investigation findings", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "investigation context"}],
        "suggestions": ["Focus the highest-severity chart", "Run reviewer checks", "Print investigation summary"],
    }


def chart_insight(context: InvestigationContext | None, message: str) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not findings:
        return {"action": "NO_FINDING", "message": "Run an investigation first so I can focus and interpret its charts."}
    lowered = message.lower()
    selected = next((item for item in findings if str(item.get("type", "")).replace("_", " ") in lowered or (item.get("product_id") and str(item["product_id"]).lower() in lowered)), None)
    if selected is None:
        selected = max(findings, key=lambda item: SEVERITY_RANK.get(str(item.get("severity", "UNKNOWN")).upper(), 0))
    finding_type = str(selected.get("type", "finding"))
    product = product_label(selected)
    details = [f"{key.replace('_', ' ').title()}: {value}" for key, value in list((selected.get("evidence") or {}).items())[:6]]
    return {
        "action": "CHART_INSIGHT",
        "message": f"I linked this request to the {finding_type.replace('_', ' ')} visualization for {product}. Use Focus chart to move to the analytical evidence.",
        "focus": {
            "finding_type": finding_type,
            "product_id": selected.get("product_id") or "ALL",
            "product_name": selected.get("product_name") or (selected.get("evidence") or {}).get("product_name"),
        },
        "details": details,
        "finding": selected,
        "suggestions": ["Run root cause analysis", "Explain this finding"],
    }


def peer_comparison(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    peer = result.get("peer_analysis") if result else None
    if not peer:
        return {"action": "NO_PEER_DATA", "message": "Peer comparison data is not available in the current investigation."}
    comparisons = []
    for scope_name in ("territory_peer_comparison", "product_peer_comparison"):
        scope = peer.get(scope_name) or {}
        for product_id, product in (scope.get("products") or {}).items():
            differences = product.get("difference_percentage") or {}
            comparisons.append({
                "scope": scope_name.replace("_peer_comparison", "").title(),
                "product": product_label({
                    "product_id": product_id,
                    "product_name": product.get("product_name"),
                }),
                "peer_group_size": product.get("peer_group_size", 0),
                "sales_difference": differences.get("sales"),
                "rx_difference": differences.get("rx"),
                "payout_difference": differences.get("payout"),
                "severity": product.get("severity", "UNKNOWN"),
            })
    return {
        "action": "PEER_COMPARISON",
        "message": f"I found {len(comparisons)} peer comparison result(s) in the current investigation.",
        "peer_comparisons": comparisons[:12],
        "sources": [{"source": "current peer analysis", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}", "record_count": len(comparisons), "access": "investigation context"}],
        "suggestions": ["Focus the highest-severity chart", "Run root cause analysis"],
    }


def reviewer_assistance(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not result:
        return {"action": "NO_REPORT", "message": "Run an investigation first so I can perform reviewer checks."}
    checks = []
    missing_evidence = [item for item in findings if not item.get("evidence")]
    elevated = [item for item in findings if SEVERITY_RANK.get(str(item.get("severity", "UNKNOWN")).upper(), 0) >= 2]
    review_required = bool((result.get("investigation_summary") or {}).get("human_review_required") or (result.get("final_report") or {}).get("human_review_required"))
    selected_count = len(context.selected_evidence) if context else 0
    checks.append({"status": "pass" if findings else "warning", "label": "Findings available", "detail": f"{len(findings)} finding(s) recorded."})
    checks.append({"status": "pass" if not missing_evidence else "warning", "label": "Evidence completeness", "detail": f"{len(missing_evidence)} finding(s) have no structured evidence."})
    checks.append({"status": "review" if elevated else "pass", "label": "Elevated findings", "detail": f"{len(elevated)} medium-or-higher finding(s) require attention."})
    checks.append({"status": "review" if review_required else "pass", "label": "Human review", "detail": "Human review is required." if review_required else "No mandatory human review flag is set."})
    checks.append({"status": "pass" if selected_count else "warning", "label": "Evidence collection", "detail": f"{selected_count} finding(s) selected for the reviewer package." if selected_count else "No findings have been added to the reviewer evidence collection."})
    return {
        "action": "REVIEW_ASSISTANCE",
        "message": "Reviewer checks are complete. Review warnings indicate gaps or escalation needs; they do not change the investigation decision.",
        "checks": checks,
        "review_questions": ["Are the highest-risk findings supported by source records?", "Could data quality or territory reassignment explain the anomaly?", "Does the recommended action match the recorded severity?"],
        "sources": [{"source": "current investigation result", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "review context"}],
        "suggestions": ["Run root cause analysis", "Print investigation summary"],
    }


PLAYBOOKS = {
    "payout validation": ["Review expected versus actual payout", "Verify achievement multiplier", "Inspect payout caps", "Collect discrepant payout records"],
    "sales prescription alignment": ["Compare sales and prescription direction", "Identify product-level mismatch", "Check historical baseline", "Verify supporting sales and prescription records"],
    "doctor territory concentration": ["Review top-doctor share", "Check cross-territory activity", "Validate active assignments", "Collect concentration evidence"],
}


def playbook_response(context: InvestigationContext | None, message: str) -> dict[str, Any]:
    lowered = message.lower()
    selected_name = next((name for name in PLAYBOOKS if name in lowered), None)
    if not selected_name:
        return {"action": "PLAYBOOK_LIST", "message": "Choose a governed investigation playbook.", "playbooks": [{"name": name.title(), "steps": steps} for name, steps in PLAYBOOKS.items()]}
    has_result = bool(context and context.result)
    return {
        "action": "PLAYBOOK_RESULT",
        "message": f"{selected_name.title()} playbook is ready. It uses the current investigation context and does not modify records.",
        "playbook": {"name": selected_name.title(), "steps": PLAYBOOKS[selected_name], "context_available": has_result},
        "suggestions": ["Run root cause analysis", "Run reviewer checks"] if has_result else ["Investigate a representative"],
    }


def proactive_anomaly_scan(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    findings = result.get("findings", []) if result else []
    if not findings:
        return {"action": "NO_FINDING", "message": "Run an investigation first so I can scan for proactive signals."}
    ranked = sorted(findings, key=lambda item: SEVERITY_RANK.get(str(item.get("severity", "UNKNOWN")).upper(), 0), reverse=True)
    signals = []
    for finding in ranked[:3]:
        evidence = finding.get("evidence") or {}
        signals.append({
            "title": str(finding.get("type", "finding")).replace("_", " ").title(),
            "product": product_label(finding),
            "severity": finding.get("severity", "UNKNOWN"),
            "reason": next((f"{key.replace('_', ' ').title()}: {value}" for key, value in evidence.items() if isinstance(value, (int, float)) and ("percent" in key or "score" in key or "difference" in key)), "Structured evidence is available for review."),
        })
    return {"action": "PROACTIVE_SIGNALS", "message": f"I found {len(signals)} signals worth prioritizing. These are suggestions only.", "signals": signals, "suggestions": ["Focus the highest-severity chart", "Run root cause analysis", "Run reviewer checks"]}


def controlled_action_proposal(context: InvestigationContext | None, message: str) -> dict[str, Any]:
    if not context or not context.result:
        return {"action": "NO_REPORT", "message": "Run an investigation before proposing a controlled review action."}
    return {
        "action": "CONFIRM_ACTION",
        "message": "This action requires confirmation and will be recorded in the current copilot session.",
        "proposed_action": {
            "type": "MARK_FOR_HUMAN_REVIEW",
            "label": "Mark investigation for human review",
            "reason": message,
            "representative_id": context.representative_id,
            "period": f"{context.start_date} to {context.end_date}",
        },
    }


def printable_summary(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    if not result:
        return {"action": "NO_REPORT", "message": "Run an investigation first, then I can prepare a printable evidence summary."}
    return {
        "action": "PRINT_SUMMARY", "message": "Your evidence-backed investigation summary is ready to print.",
        "report": {
            "title": "Investigation Summary", "representative": context_representative_label(context),
            "representative_id": context.representative_id, "period": f"{context.start_date} to {context.end_date}",
            "risk_score": result.get("overall_risk_score"), "severity": result.get("overall_severity"),
            "products": result.get("products_analyzed", []), "findings": result.get("findings", []),
            "executive_summary": (result.get("investigation_summary") or {}).get("executive_summary"),
            "recommended_actions": (result.get("final_report") or {}).get("recommended_actions", []),
            "selected_evidence": context.selected_evidence,
        },
        "sources": [{"source": "current investigation result", "filters": f"representative={context_representative_label(context)}; period={context.start_date} to {context.end_date}", "record_count": len(result.get("findings", [])), "access": "investigation context"}],
    }


@router.post("/investigation")
async def investigation_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    lowered = request.message.lower()
    guarded = guarded_request(lowered)
    if guarded:
        return guarded
    is_capability = capability_question(lowered)
    is_navigation = has_any(lowered, ("open data control", "go to data control", "open document processing", "go to document processing", "open database management", "show investigation workflow", "open investigation workflow", "open investigation evidence", "go to risk summary", "show investigation decision", "open the analysis tab", "open sales and products", "go to peer benchmark", "open doctor and territory", "show trend history", "scroll to document processing", "focus database management", "open the copilot", "close the copilot", "clear the chat", "focus the chat input", "return to the top", "show the investigation form"))
    is_analytical_query = has_any(lowered, ("calculate", "average", "count", "group", "rank", "top ", "bottom ", "growth", "ratio", "total", "sum ", "variance", "month-over-month", "organization average"))
    # Phase 2 commands are deterministic and evaluated before the LLM. This
    # prevents an earlier investigation intent in conversation history from
    # hijacking explicit follow-up actions.
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("root cause", "root-cause", "drill down", "investigate further", "causal analysis"))
        or has_any(lowered, ("investigate the cause", "why did this anomaly happen", "drove the finding", "possible explanations"))
        or (has_any(lowered, ("cause", "caused", "driver", "driving", "drove")) and has_any(lowered, ("finding", "anomaly", "mismatch", "likely", "leading", "primary", "alternative", "possible")))
    ):
        return root_cause_analysis(request.context)
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("show chart", "explain chart", "highlight", "spike", "which bar", "focus chart"))
        or ("table" not in lowered and has_any(lowered, ("chart", "graph", "visualization", "visualisation", "analytical evidence")) and has_any(lowered, ("focus", "show", "open", "explain", "navigate", "take me", "inspect", "relevant", "support")))
        or ("table" not in lowered and has_any(lowered, ("focus", "open")) and has_any(lowered, ("sales performance", "sales prescription", "payout", "peer", "finding")))
    ):
        return chart_insight(request.context, request.message)
    if request.context and request.context.result and not is_capability and has_any(lowered, ("print", "printable", "export", "report", "print-ready", "printout", "pdf-ready", "print preview", "print view", "reviewer output", "audit summary")):
        return printable_summary(request.context)
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("mark for human review", "escalate for review", "flag for review", "human reviewer", "manual review", "manual verification", "review escalation", "route this for", "send this to", "send the investigation", "flag this investigation", "flag the evidence", "flag the case", "escalate this case", "ask a reviewer", "escalate the current finding", "escalate due to missing evidence"))
        or (has_any(lowered, ("mark", "escalate", "flag", "send", "route", "request", "propose")) and has_any(lowered, ("human review", "review required", "governance review", "manual verification", "reviewer")))
    ):
        return controlled_action_proposal(request.context, request.message)
    if request.context and request.context.result and not is_capability and (
        ("review" in lowered and "evidence" in lowered)
        or has_any(lowered, ("reviewer", "review checks", "unsupported conclusion", "unsupported findings", "findings unsupported", "missing evidence", "evidence completeness", "evidence complete", "governance checks", "review warnings", "evidence gaps", "review checklist", "human review is needed", "review requirements"))
        or (has_any(lowered, ("review", "audit", "validate", "evaluate", "check")) and has_any(lowered, ("investigation", "evidence", "supporting records", "reviewer package", "escalation", "human-review")))
    ):
        return reviewer_assistance(request.context)
    if request.context and request.context.result and "peer" in lowered and any(word in lowered for word in ("table", "list", "show", "rows", "tabulate", "comparable")):
        response = peer_comparison(request.context)
        response["display"] = "table"
        return response
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("compare with peer", "peer comparison", "compare to peer", "peer average", "peer benchmark", "benchmark against peer", "benchmark p", "territory comparison", "product peer", "comparable rep"))
        or has_any(lowered, ("current rep to the group", "current representative to the group"))
        or (has_any(lowered, ("peer", "benchmark")) and has_any(lowered, ("compare", "comparison", "difference", "rank", "contrast", "analyze", "performance", "average")))
    ):
        return peer_comparison(request.context)
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("summary of the findings", "summarize the findings", "summarise the findings", "findings summary", "key findings"))
        or has_any(lowered, ("what findings were detected", "how many findings", "show all finding severities", "what did the investigation find", "show the result summary", "overview the detected issues"))
        or (has_any(lowered, ("finding", "findings", "anomalies", "investigation result", "investigation outcome", "detected issues")) and has_any(lowered, ("summary", "summarize", "summarise", "overview", "recap", "list", "count", "how many", "what did", "describe", "present", "severities")))
    ):
        return findings_summary(request.context)
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("explain this finding", "explain current finding", "what does this finding mean", "interpret this finding", "current analytical result", "help me understand this result", "simple explanation of this finding"))
        or (has_any(lowered, ("explain", "explanation", "why", "interpret", "describe", "understand", "break down", "what does")) and has_any(lowered, ("finding", "flagged", "severity", "normal", "low", "medium", "high", "critical", "mismatch", "deviation", "discrepancy", "concentration", "supporting metrics", "p022", "evidence")))
    ):
        return explain_finding(request.context, request.message)
    if request.context and request.context.result and not is_capability and not is_navigation and has_any(lowered, ("playbook", "governed workflow", "investigation workflows", "investigation routine", "investigation procedure", "what workflows", "workflows are available")):
        return playbook_response(request.context, request.message)
    if request.context and request.context.result and not is_capability and (
        has_any(lowered, ("proactive scan", "suggest anomalies", "prioritize anomalies", "what should i investigate next", "anomaly scan", "proactive signal", "signals worth", "investigative leads"))
        or has_any(lowered, ("scan for unusual activity", "what stands out", "suggest the next analysis", "deserves attention next", "emerging issues", "hidden anomalies"))
        or (has_any(lowered, ("anomaly", "anomalies", "signal", "signals", "finding", "findings", "issues")) and has_any(lowered, ("scan", "prioritize", "prioritise", "prioritizing", "suggest", "recommend", "strongest", "stands out", "top three", "next", "noteworthy", "find hidden")))
    ):
        return proactive_anomaly_scan(request.context)
    if any(word in lowered for word in ("finding", "evidence supports", "why was")) and request.context and request.context.result:
        return explain_finding(request.context, request.message)
    query_table = requested_table(request.message, {})
    is_rep_detail_request = is_representative_detail_request(request.message)
    if not is_navigation and not is_analytical_query and ((query_table and any(word in lowered for word in ("show", "list", "table", "query", "find", "fetch", "get", "display", "retrieve", "open", "pull", "bring"))) or is_rep_detail_request):
        return await run_read_only_query(db, request.message, {"table": query_table or "representatives"})
    intent = await investigation_chat_agent(message=request.message, conversation=request.conversation, context=request.context.model_dump() if request.context else {})
    intent_name = intent.get("intent")
    entities = intent.get("entities") or {}
    if intent_name == "DATABASE_QUERY":
        if not requested_table(request.message, entities):
            prior_table = conversation_table(request.conversation)
            if prior_table:
                entities = {**entities, "table": prior_table}
        return await run_read_only_query(db, request.message, entities)
    if intent_name == "FINDING_QUERY" or (request.context and request.context.result and any(word in lowered for word in ("finding", "explain this", "why was"))):
        return explain_finding(request.context, request.message)
    if intent_name == "PRINT_SUMMARY" or (request.context and request.context.result and any(word in lowered for word in ("print", "printable", "export summary"))):
        return printable_summary(request.context)
    if intent_name != "INVESTIGATION_REQUEST":
        return {**intent, "action": "ANSWER", "message": intent.get("message") or "I can help investigate, query governed data, explain findings or prepare a printable summary.", "suggestions": ["Investigate a representative", "Show active representatives", "Explain the current finding"]}
    representative_name = entities.get("representative_name") or entities.get("representative_id")
    if not representative_name:
        return {**intent, "action": "NEED_REPRESENTATIVE", "message": "Please provide a representative name or ID."}
    representative = await resolve_representative(db, representative_name)
    if not representative.get("found"):
        return {"intent": "INVESTIGATION_REQUEST", "action": "NEED_REPRESENTATIVE", **representative}
    start_date, end_date = entities.get("start_date"), entities.get("end_date")
    if not start_date or not end_date:
        return {"intent": "INVESTIGATION_REQUEST", "action": "NEED_DATE", **representative, "message": "Please provide a month or date range for the investigation."}
    return {
        "intent": "INVESTIGATION_REQUEST", "action": "PROPOSE_FILTERS", **representative,
        "start_date": start_date, "end_date": end_date,
        "message": "I prepared these investigation filters. Review them before I update the form.",
        "sources": [{"source": "representatives", "filters": f"name match={representative_name}", "record_count": 1, "access": "read-only"}],
    }
