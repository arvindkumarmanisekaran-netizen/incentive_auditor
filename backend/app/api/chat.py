from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
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


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation: list[dict[str, str]] = Field(default_factory=list)
    context: InvestigationContext | None = None


TABLE_ALIASES = {
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


def requested_table(message: str, entities: dict[str, Any]) -> str | None:
    supplied = str(entities.get("table") or entities.get("entity") or "").lower()
    if supplied in TABLE_ALIASES:
        return TABLE_ALIASES[supplied]
    lowered = message.lower()
    for alias in sorted(TABLE_ALIASES, key=len, reverse=True):
        if alias in lowered:
            return TABLE_ALIASES[alias]
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
    where_clause = ""
    try:
        limit = int(entities.get("limit") or 20)
    except (TypeError, ValueError):
        limit = 20
    parameters: dict[str, Any] = {"limit": min(max(limit, 1), 50)}
    if status and "status" in columns:
        where_clause = " WHERE LOWER(status) = LOWER(:status)"
        parameters["status"] = status
    query = text(f"SELECT {', '.join(columns)} FROM {table}{where_clause} ORDER BY {columns[0]} LIMIT :limit")
    rows = await db.execute(query, parameters)
    records = [{key: json_value(value) for key, value in dict(row).items()} for row in rows.mappings().all()]
    filter_text = f"status = {status}" if status else "none"
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
    selected = next((finding for finding in findings if str(finding.get("type", "")).replace("_", " ") in lowered or (finding.get("product_id") and str(finding["product_id"]).lower() in lowered)), findings[0])
    finding_type = str(selected.get("type", "finding")).replace("_", " ").title()
    severity = str(selected.get("severity", "Unknown")).title()
    evidence = selected.get("evidence") or {}
    details = [f"{key.replace('_', ' ').title()}: {value}" for key, value in list(evidence.items())[:8]]
    product = selected.get("product_id") or "All products"
    return {
        "action": "FINDING_EXPLANATION",
        "message": f"{finding_type} is rated {severity} for {product}. The rating is supported by the recorded metrics below; it is an analytical finding, not a final compliance decision.",
        "details": details,
        "finding": selected,
        "sources": [{"source": "current investigation findings", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}; product={product}", "record_count": 1, "access": "investigation context"}],
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
            "product": finding.get("product_id") or "All products",
            "severity": severity,
            "evidence_count": len(finding.get("evidence") or {}),
        })
    return {
        "action": "FINDINGS_SUMMARY",
        "message": f"The investigation contains {len(findings)} findings across {len(set(item['product'] for item in items))} product scope(s).",
        "severity_counts": counts,
        "finding_items": items,
        "sources": [{"source": "current investigation findings", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "investigation context"}],
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
            "product": finding.get("product_id") or "All products",
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
        "sources": [{"source": "current investigation findings", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "investigation context"}],
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
    product = selected.get("product_id") or "ALL"
    details = [f"{key.replace('_', ' ').title()}: {value}" for key, value in list((selected.get("evidence") or {}).items())[:6]]
    return {
        "action": "CHART_INSIGHT",
        "message": f"I linked this request to the {finding_type.replace('_', ' ')} visualization for {product}. Use Focus chart to move to the analytical evidence.",
        "focus": {"finding_type": finding_type, "product_id": product},
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
                "product": product.get("product_name") or product_id,
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
        "sources": [{"source": "current peer analysis", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(comparisons), "access": "investigation context"}],
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
        "sources": [{"source": "current investigation result", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(findings), "access": "review context"}],
        "suggestions": ["Run root cause analysis", "Print investigation summary"],
    }


def printable_summary(context: InvestigationContext | None) -> dict[str, Any]:
    result = context.result if context and context.result else None
    if not result:
        return {"action": "NO_REPORT", "message": "Run an investigation first, then I can prepare a printable evidence summary."}
    return {
        "action": "PRINT_SUMMARY", "message": "Your evidence-backed investigation summary is ready to print.",
        "report": {
            "title": "Investigation Summary", "representative": context.representative_name or context.representative_id,
            "representative_id": context.representative_id, "period": f"{context.start_date} to {context.end_date}",
            "risk_score": result.get("overall_risk_score"), "severity": result.get("overall_severity"),
            "products": result.get("products_analyzed", []), "findings": result.get("findings", []),
            "executive_summary": (result.get("investigation_summary") or {}).get("executive_summary"),
            "recommended_actions": (result.get("final_report") or {}).get("recommended_actions", []),
            "selected_evidence": context.selected_evidence,
        },
        "sources": [{"source": "current investigation result", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(result.get("findings", [])), "access": "investigation context"}],
    }


@router.post("/investigation")
async def investigation_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    lowered = request.message.lower()
    # Phase 2 commands are deterministic and evaluated before the LLM. This
    # prevents an earlier investigation intent in conversation history from
    # hijacking explicit follow-up actions.
    if "root cause" in lowered or "drill down" in lowered or "investigate further" in lowered:
        return root_cause_analysis(request.context)
    if ("focus" in lowered and "chart" in lowered) or any(phrase in lowered for phrase in ("show chart", "explain chart", "highlight", "spike", "which bar")):
        return chart_insight(request.context, request.message)
    if ("review" in lowered and "evidence" in lowered) or any(phrase in lowered for phrase in ("reviewer", "review checks", "unsupported conclusion", "missing evidence")):
        return reviewer_assistance(request.context)
    if "compare with peer" in lowered or "peer comparison" in lowered or "compare to peer" in lowered:
        return peer_comparison(request.context)
    if any(phrase in lowered for phrase in ("summary of the findings", "summarize the findings", "summarise the findings", "findings summary")):
        return findings_summary(request.context)
    intent = await investigation_chat_agent(message=request.message, conversation=request.conversation, context=request.context.model_dump() if request.context else {})
    intent_name = intent.get("intent")
    entities = intent.get("entities") or {}
    if intent_name == "DATABASE_QUERY":
        return await run_read_only_query(db, request.message, entities)
    if intent_name == "FINDING_QUERY" or any(word in lowered for word in ("finding", "explain this", "why was")):
        return explain_finding(request.context, request.message)
    if intent_name == "PRINT_SUMMARY" or any(word in lowered for word in ("print", "printable", "export summary")):
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
