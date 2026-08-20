from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/incentive-programs",
    tags=["Incentive Programs"],
)


@router.get("")
async def get_incentive_programs(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                program_id,
                program_name,
                period_type,
                effective_from,
                effective_to,
                minimum_sales_achievement,
                maximum_payout_multiplier,
                status,
                created_at,
                updated_at
            FROM incentive_programs
            ORDER BY program_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{program_id}")
async def update_incentive_program(
    program_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "incentive_programs",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "program_name",
        "period_type",
        "effective_from",
        "effective_to",
        "minimum_sales_achievement",
        "maximum_payout_multiplier",
        "status",
    }

    update_values = {key: value for key, value in payload.items() if key in allowed_fields}

    if not update_values:
        raise HTTPException(
            status_code=400,
            detail="No valid fields supplied for update",
        )

    existing = await db.execute(
        text("""
            SELECT program_id
            FROM incentive_programs
            WHERE program_id = :program_id
            """),
        {"program_id": program_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Incentive program not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE incentive_programs
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE program_id = :program_id
            """),
        {
            **update_values,
            "program_id": program_id,
        },
    )

    await db.commit()

    return {
        "message": "Incentive program updated successfully",
        "program_id": program_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_incentive_programs(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No program IDs supplied",
        )

    query = text("""
        DELETE FROM incentive_programs
        WHERE program_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Incentive programs deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{program_id}")
async def delete_incentive_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM incentive_programs
            WHERE program_id = :program_id
            """),
        {"program_id": program_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Incentive program not found",
        )

    await db.commit()

    return {
        "message": "Incentive program deleted successfully",
        "program_id": program_id,
    }
