from __future__ import annotations

from decimal import Decimal, InvalidOperation
import re
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db


router = APIRouter(
    prefix="/api/incentive-program-tiers",
    tags=["Incentive Program Tiers"],
)


def _decimal(value: Any, field: str, *, required: bool = True) -> Decimal | None:
    if value in (None, ""):
        if required:
            raise HTTPException(status_code=400, detail=f"{field} is required")
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be numeric")


def _normalize(payload: dict[str, Any], *, require_id: bool) -> dict[str, Any]:
    fields = {
        "incentive_program_tier_id",
        "incentive_program_id",
        "minimum_achievement",
        "maximum_achievement",
        "multiplier",
    }
    values = {key: value for key, value in payload.items() if key in fields}
    required = {"incentive_program_id", "minimum_achievement", "multiplier"}
    if require_id:
        required.add("incentive_program_tier_id")
    missing = [field for field in required if values.get(field) in (None, "")]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(sorted(missing))}")

    for field in ("incentive_program_tier_id", "incentive_program_id"):
        if field not in values:
            continue
        identifier = str(values[field]).strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,20}", identifier):
            raise HTTPException(status_code=400, detail=f"Invalid {field.replace('_', ' ')}")
        values[field] = identifier

    minimum = _decimal(values.get("minimum_achievement"), "minimum achievement")
    maximum = _decimal(values.get("maximum_achievement"), "maximum achievement", required=False)
    multiplier = _decimal(values.get("multiplier"), "multiplier")
    if minimum is None or minimum < 0:
        raise HTTPException(status_code=400, detail="Minimum achievement cannot be negative")
    if maximum is not None and maximum <= minimum:
        raise HTTPException(status_code=400, detail="Maximum achievement must exceed minimum achievement")
    if multiplier is None or multiplier < 0:
        raise HTTPException(status_code=400, detail="Multiplier cannot be negative")
    values.update(
        minimum_achievement=minimum,
        maximum_achievement=maximum,
        multiplier=multiplier,
    )
    return values


async def _validate_relationships(
    db: AsyncSession,
    values: dict[str, Any],
    *,
    excluded_tier_id: str | None = None,
) -> None:
    program_exists = await db.execute(
        text("SELECT 1 FROM incentive_programs WHERE incentive_program_id = :id"),
        {"id": values["incentive_program_id"]},
    )
    if program_exists.first() is None:
        raise HTTPException(status_code=400, detail="Incentive program does not exist")

    overlap = await db.execute(
        text("""
            SELECT incentive_program_tier_id
            FROM incentive_program_tiers
            WHERE incentive_program_id = :program_id
              AND (:excluded_id IS NULL OR incentive_program_tier_id <> :excluded_id)
              AND minimum_achievement < COALESCE(:maximum_achievement, 1000000000)
              AND COALESCE(maximum_achievement, 1000000000) > :minimum_achievement
            LIMIT 1
        """),
        {
            "program_id": values["incentive_program_id"],
            "excluded_id": excluded_tier_id,
            "minimum_achievement": values["minimum_achievement"],
            "maximum_achievement": values["maximum_achievement"],
        },
    )
    if overlap.first() is not None:
        raise HTTPException(status_code=409, detail="Achievement tier overlaps an existing tier")


@router.get("")
async def get_incentive_program_tiers(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(text("SELECT COUNT(*) FROM incentive_program_tiers"))).scalar_one()
    result = await db.execute(
        text("""
            SELECT * FROM incentive_program_tiers
            ORDER BY incentive_program_id, minimum_achievement, incentive_program_tier_id
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    )
    return {
        "records": [dict(row) for row in result.mappings().all()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("")
async def create_incentive_program_tier(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    values = _normalize(payload, require_id=True)
    await _validate_relationships(db, values)
    try:
        await db.execute(
            text("""
                INSERT INTO incentive_program_tiers (
                    incentive_program_tier_id, incentive_program_id,
                    minimum_achievement, maximum_achievement, multiplier
                ) VALUES (
                    :incentive_program_tier_id, :incentive_program_id,
                    :minimum_achievement, :maximum_achievement, :multiplier
                )
            """),
            values,
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive program tier ID already exists") from exc
    return {
        "message": "Incentive program tier created",
        "incentive_program_tier_id": values["incentive_program_tier_id"],
    }


@router.put("/{tier_id}")
async def update_incentive_program_tier(
    tier_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT * FROM incentive_program_tiers WHERE incentive_program_tier_id = :id"),
        {"id": tier_id},
    )
    existing = result.mappings().first()
    if existing is None:
        raise HTTPException(status_code=404, detail="Incentive program tier not found")
    merged = dict(existing)
    merged.update(payload)
    merged["incentive_program_tier_id"] = tier_id
    values = _normalize(merged, require_id=True)
    await _validate_relationships(db, values, excluded_tier_id=tier_id)
    await db.execute(
        text("""
            UPDATE incentive_program_tiers
            SET incentive_program_id = :incentive_program_id,
                minimum_achievement = :minimum_achievement,
                maximum_achievement = :maximum_achievement,
                multiplier = :multiplier,
                updated_at = CURRENT_TIMESTAMP
            WHERE incentive_program_tier_id = :incentive_program_tier_id
        """),
        values,
    )
    await db.commit()
    return {"message": "Incentive program tier updated", "incentive_program_tier_id": tier_id}


@router.delete("/bulk-delete")
async def bulk_delete_incentive_program_tiers(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No incentive program tier IDs supplied")
    result = await db.execute(
        text("DELETE FROM incentive_program_tiers WHERE incentive_program_tier_id IN :ids").bindparams(
            bindparam("ids", expanding=True)
        ),
        {"ids": ids},
    )
    await db.commit()
    return {"message": "Incentive program tiers deleted", "deleted_count": result.rowcount}


@router.delete("/{tier_id}")
async def delete_incentive_program_tier(
    tier_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("DELETE FROM incentive_program_tiers WHERE incentive_program_tier_id = :id"),
        {"id": tier_id},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Incentive program tier not found")
    await db.commit()
    return {"message": "Incentive program tier deleted", "incentive_program_tier_id": tier_id}
