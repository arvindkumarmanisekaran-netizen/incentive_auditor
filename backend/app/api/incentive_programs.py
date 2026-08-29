from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
import re
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db


router = APIRouter(prefix="/api/incentive-programs", tags=["Incentive Programs"])


def _normalized_program(payload: dict[str, Any], *, require_id: bool) -> dict[str, Any]:
    allowed = {
        "incentive_program_id",
        "start_date",
        "end_date",
        "products",
        "percentage",
    }
    values = {key: value for key, value in payload.items() if key in allowed}

    required = {"start_date", "end_date", "products", "percentage"}
    if require_id:
        required.add("incentive_program_id")
    missing = [field for field in required if values.get(field) in (None, "")]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(sorted(missing))}")

    if "incentive_program_id" in values:
        identifier = str(values["incentive_program_id"]).strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]{1,20}", identifier):
            raise HTTPException(status_code=400, detail="Invalid incentive program ID")
        values["incentive_program_id"] = identifier

    try:
        start_date = date.fromisoformat(str(values["start_date"]))
        end_date = date.fromisoformat(str(values["end_date"]))
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Program dates must use YYYY-MM-DD")
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date")
    values["start_date"] = start_date
    values["end_date"] = end_date

    products = str(values["products"]).strip()
    if products.upper() == "ALL":
        products = "ALL"
    else:
        product_ids = [item.strip() for item in products.split(",") if item.strip()]
        if not product_ids or any(not re.fullmatch(r"[A-Za-z0-9_.-]{1,20}", item) for item in product_ids):
            raise HTTPException(
                status_code=400,
                detail="Products must be ALL or a comma-separated list of product IDs",
            )
        products = ",".join(dict.fromkeys(product_ids))
    values["products"] = products

    try:
        percentage = Decimal(str(values["percentage"]))
    except (InvalidOperation, KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Percentage must be numeric")
    if percentage <= 0:
        raise HTTPException(status_code=400, detail="Percentage must be greater than zero")
    values["percentage"] = percentage
    return values


async def _validate_products(db: AsyncSession, products: str) -> None:
    if products == "ALL":
        return
    product_ids = products.split(",")
    result = await db.execute(
        text("SELECT product_id FROM products WHERE product_id IN :ids").bindparams(
            bindparam("ids", expanding=True)
        ),
        {"ids": product_ids},
    )
    existing = {str(value) for value in result.scalars().all()}
    missing = [product_id for product_id in product_ids if product_id not in existing]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown product IDs: {', '.join(missing)}")


@router.get("")
async def get_incentive_programs(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(text("SELECT COUNT(*) FROM incentive_programs"))).scalar_one()
    result = await db.execute(
        text("""
            SELECT * FROM incentive_programs
            ORDER BY start_date DESC, incentive_program_id
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
async def create_incentive_program(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    values = _normalized_program(payload, require_id=True)
    await _validate_products(db, values["products"])
    try:
        await db.execute(
            text("""
                INSERT INTO incentive_programs (
                    incentive_program_id, start_date, end_date, products, percentage
                ) VALUES (
                    :incentive_program_id, :start_date, :end_date, :products, :percentage
                )
            """),
            values,
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Incentive program ID already exists") from exc
    return {"message": "Incentive program created", "incentive_program_id": values["incentive_program_id"]}


@router.put("/{incentive_program_id}")
async def update_incentive_program(
    incentive_program_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT * FROM incentive_programs WHERE incentive_program_id = :id"),
        {"id": incentive_program_id},
    )
    existing = result.mappings().first()
    if existing is None:
        raise HTTPException(status_code=404, detail="Incentive program not found")
    merged = dict(existing)
    merged.update(payload)
    merged["incentive_program_id"] = incentive_program_id
    values = _normalized_program(merged, require_id=True)
    await _validate_products(db, values["products"])
    await db.execute(
        text("""
            UPDATE incentive_programs
            SET start_date = :start_date,
                end_date = :end_date,
                products = :products,
                percentage = :percentage,
                updated_at = CURRENT_TIMESTAMP
            WHERE incentive_program_id = :incentive_program_id
        """),
        values,
    )
    await db.commit()
    return {"message": "Incentive program updated", "incentive_program_id": incentive_program_id}


@router.delete("/bulk-delete")
async def bulk_delete_incentive_programs(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No incentive program IDs supplied")
    result = await db.execute(
        text("DELETE FROM incentive_programs WHERE incentive_program_id IN :ids").bindparams(
            bindparam("ids", expanding=True)
        ),
        {"ids": ids},
    )
    await db.commit()
    return {"message": "Incentive programs deleted", "deleted_count": result.rowcount}


@router.delete("/{incentive_program_id}")
async def delete_incentive_program(
    incentive_program_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("DELETE FROM incentive_programs WHERE incentive_program_id = :id"),
        {"id": incentive_program_id},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Incentive program not found")
    await db.commit()
    return {"message": "Incentive program deleted", "incentive_program_id": incentive_program_id}
