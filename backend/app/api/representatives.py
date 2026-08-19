from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..db.session import get_db

router = APIRouter(
    prefix="/api/representatives",
    tags=["Representatives"],
)


@router.get("")
async def get_representatives(
    db: AsyncSession = Depends(get_db),
):

    query = text("""
        SELECT
            representative_id,
            first_name,
            last_name,
            territory_id,
            joining_date,
            status
        FROM representatives
        ORDER BY representative_id
        """)

    result = await db.execute(query)

    return [dict(row._mapping) for row in result.fetchall()]
