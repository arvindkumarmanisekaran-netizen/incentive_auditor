from typing import Any
from fastapi import APIRouter, Body, Depends, Query, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession
from ..services.document_processing.validator import validate_status

from ..db.session import get_db

router = APIRouter(
    prefix="/api/representatives",
    tags=["Representatives"],
)


@router.get("")
async def get_representatives(
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
            FROM representatives
            """))

    total = count_result.scalar_one()

    result = await db.execute(
        text("""
            SELECT *
            FROM representatives
            ORDER BY representative_id
            LIMIT :limit
            OFFSET :offset
            """),
        {
            "limit": limit,
            "offset": offset,
        },
    )

    rows = [dict(row) for row in result.mappings().all()]

    return {
        "records": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/all")
async def get_all_representatives(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT *
            FROM representatives
            ORDER BY first_name, last_name
            """))

    return [dict(row) for row in result.mappings().all()]


@router.put("/{representative_id}")
async def update_representative(
    representative_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
):

    status_errors = validate_status(
        "representatives",
        [payload],
    )

    if status_errors:
        raise HTTPException(
            status_code=400,
            detail=status_errors[0]["message"],
        )

    allowed_fields = {
        "first_name",
        "last_name",
        "territory_id",
        "joining_date",
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
            SELECT representative_id
            FROM representatives
            WHERE representative_id = :representative_id
            """),
        {
            "representative_id": representative_id,
        },
    )

    if existing.first() is None:
        raise HTTPException(
            status_code=404,
            detail="Representative not found",
        )

    set_clause = ", ".join(f"{column} = :{column}" for column in update_values)

    await db.execute(
        text(f"""
            UPDATE representatives
            SET
                {set_clause},
                updated_at = CURRENT_TIMESTAMP
            WHERE representative_id = :representative_id
            """),
        {
            **update_values,
            "representative_id": representative_id,
        },
    )

    await db.commit()

    return {
        "message": "Representative updated successfully",
        "representative_id": representative_id,
    }


@router.delete("/bulk-delete")
async def bulk_delete_representatives(
    payload: dict[str, list[str]] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    ids = payload.get("ids", [])

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No representative IDs supplied",
        )

    query = text("""
        DELETE FROM representatives
        WHERE representative_id IN :ids
        """).bindparams(bindparam("ids", expanding=True))

    result = await db.execute(
        query,
        {"ids": ids},
    )

    await db.commit()

    return {
        "message": "Representatives deleted successfully",
        "deleted_count": result.rowcount,
        "deleted_ids": ids,
    }


@router.delete("/{representative_id}")
async def delete_representative(
    representative_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            DELETE FROM representatives
            WHERE representative_id = :representative_id
            """),
        {
            "representative_id": representative_id,
        },
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Representative not found",
        )

    await db.commit()

    return {
        "message": "Representative deleted successfully",
        "representative_id": representative_id,
    }
