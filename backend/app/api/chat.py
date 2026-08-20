from fastapi import APIRouter, Depends

from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import text

from ..db.session import get_db

from ..agents.investigation_chat_agent import (
    investigation_chat_agent,
)

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"],
)


class ChatRequest(BaseModel):

    message: str

    conversation: list[dict[str, str]] = []


async def resolve_representative(
    db: AsyncSession,
    representative_name: str,
):

    result = await db.execute(
        text("""
            SELECT

                representative_id,

                first_name,

                last_name

            FROM representatives

            WHERE

                LOWER(first_name) LIKE LOWER(:name)

                OR

                LOWER(last_name) LIKE LOWER(:name)

            ORDER BY first_name

            LIMIT 5

            """),
        {"name": f"%{representative_name}%"},
    )

    representatives = result.fetchall()

    if len(representatives) == 0:

        return {
            "found": False,
            "message": f"No representative found for {representative_name}",
        }

    if len(representatives) > 1:

        return {
            "found": False,
            "multiple": True,
            "representatives": [
                {
                    "id": row.representative_id,
                    "name": f"{row.first_name} {row.last_name}",
                }
                for row in representatives
            ],
        }

    representative = representatives[0]

    return {
        "found": True,
        "representative_id": representative.representative_id,
    }


@router.post("/investigation")
async def investigation_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):

    intent = await investigation_chat_agent(
        message=request.message,
        conversation=request.conversation,
    )

    if intent.get("intent") != "INVESTIGATION_REQUEST":

        return intent

    entities = intent.get(
        "entities",
        {},
    )

    representative_name = entities.get("representative_name")

    if not representative_name:

        return {
            **intent,
            "message": "Please provide representative name",
        }

    representative = await resolve_representative(
        db,
        representative_name,
    )

    if not representative.get("found"):

        return {
            "intent": "INVESTIGATION_REQUEST",
            "action": "NEED_REPRESENTATIVE",
            **representative,
            "message": representative.get(
                "message",
                "Multiple representatives found",
            ),
        }

    if not entities.get("start_date") or not entities.get("end_date"):

        return {
            "intent": "INVESTIGATION_REQUEST",
            "action": "NEED_DATE",
            "representative_id": representative["representative_id"],
            "representative_name": representative_name,
            "message": "Please provide date range",
        }

    return {
        "intent": "INVESTIGATION_REQUEST",
        "action": "RUN_ANALYSIS",
        "representative_id": representative["representative_id"],
        "start_date": entities["start_date"],
        "end_date": entities["end_date"],
        "message": "Starting investigation",
    }
