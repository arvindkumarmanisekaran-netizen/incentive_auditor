from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)


@router.get("")
async def get_products(
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(text("""
            SELECT
                product_id,
                product_name
            FROM products
            ORDER BY product_id
            """))

    return [dict(row._mapping) for row in result.fetchall()]
