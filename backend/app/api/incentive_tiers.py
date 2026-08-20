from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

router = APIRouter(
    prefix="/api/incentive-tiers",
    tags=["Incentive Tiers"],
)


@router.get("")
async def get_incentive_tiers(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT
                tier_id,
                program_id,
                minimum_achievement,
                maximum_achievement,
                payout_multiplier,
                created_at,
                updated_at
            FROM incentive_tiers
            ORDER BY program_id, minimum_achievement, tier_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]


@router.put("/{tier_id}")
async def update_incentive_tier(
    tier_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    allowed_fields = {
        "program_id",
        "minimum_achievement",
        "maximum_achievement",
        "payout_multiplier",
    }

    update_values = {key: value for key, value in payload.items() if key in allowed_fields}

    if not update_values:
        raise HTTPException(
            status_code=400,
            detail="No valid fields supplied for update",
        )

    existing = await db.execute(
        text("""
            SELECT tier_id
            FROM incentive_tiers
            WHERE tier_id = :tier_id
            """),
        {"tier_id": tier_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Incentive tier not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    try:
        await db.execute(
            text(f"""
                UPDATE incentive_tiers
                SET
                    {set_clause},
                    updated_at = CURRENT_TIMESTAMP
                WHERE tier_id = :tier_id
                """),
            {
                **update_values,
                "tier_id": tier_id,
            },
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Incentive tier updated successfully",
        "tier_id": tier_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_incentive_tiers(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No tier IDs supplied",
        )

    query = text("""
        DELETE FROM incentive_tiers
        WHERE tier_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Incentive tiers deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{tier_id}")
async def delete_incentive_tier(
    tier_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM incentive_tiers
            WHERE tier_id = :tier_id
            """),
        {"tier_id": tier_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Incentive tier not found",
        )

    await db.commit()

    return {
        "message": "Incentive tier deleted successfully",
        "tier_id": tier_id,
    }
