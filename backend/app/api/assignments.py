from typing import Any

from fastapi import APIRouter, Body, Depends, Query, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/assignments",
    tags=["Assignments"],
)


@router.get("")
async def get_assignments(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(text("""
            SELECT COUNT(*)
            FROM representative_doctor_assignments
            """))

    total = count_result.scalar_one()

    result = await db.execute(
        text("""
            SELECT *
            FROM representative_doctor_assignments
            ORDER BY assignment_id
            LIMIT :limit
            OFFSET :offset
            """),
        {
            "limit": limit,
            "offset": offset,
        },
    )

    rows = [dict(row) for row in result.mappings().all()]

    return {
        "records": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.put("/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "representative_doctor_assignments",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "representative_id",
        "doctor_id",
        "effective_from",
        "effective_to",
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
            SELECT assignment_id
            FROM representative_doctor_assignments
            WHERE assignment_id = :assignment_id
            """),
        {"assignment_id": assignment_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE representative_doctor_assignments
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE assignment_id = :assignment_id
            """),
        {
            **update_values,
            "assignment_id": assignment_id,
        },
    )

    await db.commit()

    return {
        "message": "Assignment updated successfully",
        "assignment_id": assignment_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_assignments(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No assignment IDs supplied",
        )

    query = text("""
        DELETE FROM representative_doctor_assignments
        WHERE assignment_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Assignments deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM representative_doctor_assignments
            WHERE assignment_id = :assignment_id
            """),
        {"assignment_id": assignment_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    await db.commit()

    return {
        "message": "Assignment deleted successfully",
        "assignment_id": assignment_id,
    }
