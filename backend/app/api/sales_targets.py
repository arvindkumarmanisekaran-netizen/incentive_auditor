from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/sales-targets",
    tags=["Sales Targets"],
)


@router.get("")
async def get_sales_targets(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                target_id,
                representative_id,
                product_id,
                target_month,
                target_amount,
                status,
                created_at,
                updated_at
            FROM sales_targets
            ORDER BY target_month DESC, target_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{target_id}")
async def update_sales_target(
    target_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "sales_targets",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "representative_id",
        "product_id",
        "target_month",
        "target_amount",
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
            SELECT target_id
            FROM sales_targets
            WHERE target_id = :target_id
            """),
        {"target_id": target_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Sales target not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    try:
        await db.execute(
            text(f"""
                UPDATE sales_targets
                SET
                    {set_clause},
                    updated_at = CURRENT_TIMESTAMP
                WHERE target_id = :target_id
                """),
            {
                **update_values,
                "target_id": target_id,
            },
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Sales target updated successfully",
        "target_id": target_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_sales_targets(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No target IDs supplied",
        )

    query = text("""
        DELETE FROM sales_targets
        WHERE target_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Sales targets deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{target_id}")
async def delete_sales_target(
    target_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM sales_targets
            WHERE target_id = :target_id
            """),
        {"target_id": target_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Sales target not found",
        )

    await db.commit()

    return {
        "message": "Sales target deleted successfully",
        "target_id": target_id,
    }
