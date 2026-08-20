from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/sales",
    tags=["Sales"],
)


@router.get("")
async def get_sales(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                sale_id,
                sale_date,
                doctor_id,
                product_id,
                selling_territory_id,
                quantity,
                sales_amount,
                status,
                created_at,
                updated_at
            FROM sales
            ORDER BY sale_date DESC, sale_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{sale_id}")
async def update_sale(
    sale_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):

    status_errors = validate_status(
        "sales",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "sale_date",
        "doctor_id",
        "product_id",
        "selling_territory_id",
        "quantity",
        "sales_amount",
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
            SELECT sale_id
            FROM sales
            WHERE sale_id = :sale_id
            """),
        {
            "sale_id": sale_id,
        },
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Sale not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE sales
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE sale_id = :sale_id
            """),
        {
            **update_values,
            "sale_id": sale_id,
        },
    )

    await db.commit()

    return {
        "message": "Sale updated successfully",
        "sale_id": sale_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_sales(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No sale IDs supplied",
        )

    query = text("""
        DELETE FROM sales
        WHERE sale_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {
            "ids": ids,
        },
    )

    await db.commit()

    return {
        "message": "Sales deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM sales
            WHERE sale_id = :sale_id
            """),
        {
            "sale_id": sale_id,
        },
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Sale not found",
        )

    await db.commit()

    return {
        "message": "Sale deleted successfully",
        "sale_id": sale_id,
    }
