from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/incentive-payouts",
    tags=["Incentive Payouts"],
)


@router.get("")
async def get_incentive_payouts(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                payout_id,
                representative_id,
                product_id,
                program_id,
                payout_month,
                sales_target,
                actual_sales,
                sales_achievement,
                base_incentive,
                achievement_multiplier,
                calculated_payout,
                maximum_payout,
                expected_payout,
                actual_payout,
                payout_difference,
                status,
                created_at,
                updated_at
            FROM incentive_payouts
            ORDER BY payout_month DESC, payout_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{payout_id}")
async def update_incentive_payout(
    payout_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "incentive_payouts",
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
        "program_id",
        "payout_month",
        "sales_target",
        "actual_sales",
        "sales_achievement",
        "base_incentive",
        "achievement_multiplier",
        "calculated_payout",
        "maximum_payout",
        "expected_payout",
        "actual_payout",
        "payout_difference",
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
            SELECT payout_id
            FROM incentive_payouts
            WHERE payout_id = :payout_id
            """),
        {"payout_id": payout_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Payout not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE incentive_payouts
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE payout_id = :payout_id
            """),
        {
            **update_values,
            "payout_id": payout_id,
        },
    )

    await db.commit()

    return {
        "message": "Payout updated successfully",
        "payout_id": payout_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_incentive_payouts(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No payout IDs supplied",
        )

    query = text("""
        DELETE FROM incentive_payouts
        WHERE payout_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Payouts deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{payout_id}")
async def delete_incentive_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM incentive_payouts
            WHERE payout_id = :payout_id
            """),
        {"payout_id": payout_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Payout not found",
        )

    await db.commit()

    return {
        "message": "Payout deleted successfully",
        "payout_id": payout_id,
    }
