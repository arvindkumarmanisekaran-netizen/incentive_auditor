from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession
from ..services.document_processing.validator import validate_status

from ..db.session import get_db

router = APIRouter(
    prefix="/api/prescriptions",
    tags=["Prescriptions"],
)


@router.get("")
async def get_prescriptions(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                prescription_id,
                prescription_date,
                doctor_id,
                product_id,
                quantity,
                status,
                created_at,
                updated_at
            FROM prescriptions
            ORDER BY prescription_date DESC, prescription_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{prescription_id}")
async def update_prescription(
    prescription_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "prescriptions",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "prescription_date",
        "doctor_id",
        "product_id",
        "quantity",
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
            SELECT prescription_id
            FROM prescriptions
            WHERE prescription_id = :prescription_id
            """),
        {
            "prescription_id": prescription_id,
        },
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE prescriptions
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE prescription_id = :prescription_id
            """),
        {
            **update_values,
            "prescription_id": prescription_id,
        },
    )

    await db.commit()

    return {
        "message": "Prescription updated successfully",
        "prescription_id": prescription_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_prescriptions(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No prescription IDs supplied",
        )

    query = text("""
        DELETE FROM prescriptions
        WHERE prescription_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {
            "ids": ids,
        },
    )

    await db.commit()

    return {
        "message": "Prescriptions deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{prescription_id}")
async def delete_prescription(
    prescription_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM prescriptions
            WHERE prescription_id = :prescription_id
            """),
        {
            "prescription_id": prescription_id,
        },
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Prescription not found",
        )

    await db.commit()

    return {
        "message": "Prescription deleted successfully",
        "prescription_id": prescription_id,
    }
