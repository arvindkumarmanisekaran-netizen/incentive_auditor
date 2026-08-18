from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..db.session import get_db


router = APIRouter(
    prefix="/api/representatives",
    tags=[
        "Representatives"
    ],
)


@router.get("")
async def get_representatives(
    db: AsyncSession = Depends(get_db),
):

    query = text("""
        SELECT
            r.representative_id,
            r.first_name,
            r.last_name,
            r.territory_id,
            t.territory_name,
            r.joining_date,
            r.status
        FROM representatives r
        JOIN territories t
            ON t.territory_id = r.territory_id
        ORDER BY r.representative_id
    """)

    result = await db.execute(query)
     
    representatives = [
        dict(row._mapping)
        for row in result.fetchall()
    ]

    return representatives
