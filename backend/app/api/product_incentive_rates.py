from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

router = APIRouter(
    prefix="/api/product-incentive-rates",
    tags=["Product Incentive Rates"],
)


@router.get("")
async def get_product_incentive_rates(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                rate_id,
                program_id,
                product_id,
                incentive_rate,
                created_at,
                updated_at
            FROM product_incentive_rates
            ORDER BY program_id, product_id, rate_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{rate_id}")
async def update_product_incentive_rate(
    rate_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    allowed_fields = {
        "program_id",
        "product_id",
        "incentive_rate",
    }

    update_values = {key: value for key, value in payload.items() if key in allowed_fields}

    if not update_values:
        raise HTTPException(
            status_code=400,
            detail="No valid fields supplied for update",
        )

    existing = await db.execute(
        text("""
            SELECT rate_id
            FROM product_incentive_rates
            WHERE rate_id = :rate_id
            """),
        {"rate_id": rate_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Product incentive rate not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    try:
        await db.execute(
            text(f"""
                UPDATE product_incentive_rates
                SET
                    {set_clause},
                    updated_at = CURRENT_TIMESTAMP
                WHERE rate_id = :rate_id
                """),
            {
                **update_values,
                "rate_id": rate_id,
            },
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Product incentive rate updated successfully",
        "rate_id": rate_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_product_incentive_rates(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No rate IDs supplied",
        )

    query = text("""
        DELETE FROM product_incentive_rates
        WHERE rate_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Product incentive rates deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{rate_id}")
async def delete_product_incentive_rate(
    rate_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM product_incentive_rates
            WHERE rate_id = :rate_id
            """),
        {"rate_id": rate_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Product incentive rate not found",
        )

    await db.commit()

    return {
        "message": "Product incentive rate deleted successfully",
        "rate_id": rate_id,
    }
