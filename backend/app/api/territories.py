from typing import Any

from fastapi import APIRouter, Body, Depends, Query, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.validator import validate_status

router = APIRouter(
    prefix="/api/territories",
    tags=["Territories"],
)


@router.get("")
async def get_territories(
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
            FROM territories
            """))

    total = count_result.scalar_one()

    result = await db.execute(
        text("""
            SELECT
                territory_id,
                territory_name,
                region,
                country,
                status,
                created_at,
                updated_at
            FROM territories
            ORDER BY territory_id
            LIMIT :limit
            OFFSET :offset
            """),
        {
            "limit": limit,
            "offset": offset,
        },
    )

    records = [dict(row) for row in result.mappings().all()]

    return {
        "records": records,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.put("/{territory_id}")
async def update_territory(
    territory_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    status_errors = validate_status(
        "territories",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "territory_name",
        "region",
        "country",
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
            SELECT territory_id
            FROM territories
            WHERE territory_id = :territory_id
            """),
        {"territory_id": territory_id},
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Territory not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE territories
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE territory_id = :territory_id
            """),
        {
            **update_values,
            "territory_id": territory_id,
        },
    )

    await db.commit()

    return {
        "message": "Territory updated successfully",
        "territory_id": territory_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_territories(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No territory IDs supplied",
        )

    query = text("""
        DELETE FROM territories
        WHERE territory_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Territories deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{territory_id}")
async def delete_territory(
    territory_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM territories
            WHERE territory_id = :territory_id
            """),
        {"territory_id": territory_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Territory not found",
        )

    await db.commit()

    return {
        "message": "Territory deleted successfully",
        "territory_id": territory_id,
    }
