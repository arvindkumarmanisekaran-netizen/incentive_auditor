from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession
from ..services.document_processing.validator import validate_status


from ..db.session import get_db

router = APIRouter(
    prefix="/api/doctors",
    tags=["Doctors"],
)


@router.get("")
async def get_doctors(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                doctor_id,
                doctor_name,
                specialization,
                territory_id,
                status,
                created_at,
                updated_at
            FROM doctors
            ORDER BY doctor_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):

    status_errors = validate_status(
        "doctors",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "doctor_name",
        "specialization",
        "territory_id",
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
            SELECT doctor_id
            FROM doctors
            WHERE doctor_id = :doctor_id
            """),
        {"doctor_id": doctor_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE doctors
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE doctor_id = :doctor_id
            """),
        {
            **update_values,
            "doctor_id": doctor_id,
        },
    )

    await db.commit()

    return {
        "message": "Doctor updated successfully",
        "doctor_id": doctor_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_doctors(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No doctor IDs supplied",
        )

    query = text("""
        DELETE FROM doctors
        WHERE doctor_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Doctors deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM doctors
            WHERE doctor_id = :doctor_id
            """),
        {"doctor_id": doctor_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    await db.commit()

    return {
        "message": "Doctor deleted successfully",
        "doctor_id": doctor_id,
    }
