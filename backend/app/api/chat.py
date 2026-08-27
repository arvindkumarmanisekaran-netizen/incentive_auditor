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
        "sources": [{"source": "current investigation findings", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}; product={product}", "record_count": 1, "access": "investigation context"}],
        "suggestions": ["Show supporting database records", "Compare with peers", "Print investigation summary"],
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
        },
        "sources": [{"source": "current investigation result", "filters": f"representative={context.representative_id}; period={context.start_date} to {context.end_date}", "record_count": len(result.get("findings", [])), "access": "investigation context"}],
    }


@router.post("/investigation")
async def investigation_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    intent = await investigation_chat_agent(message=request.message, conversation=request.conversation, context=request.context.model_dump() if request.context else {})
    intent_name = intent.get("intent")
    entities = intent.get("entities") or {}
    lowered = request.message.lower()
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
