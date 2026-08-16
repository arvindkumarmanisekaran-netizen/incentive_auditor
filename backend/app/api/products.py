from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db.session import get_db


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)


@router.get("")
def get_products(
    db: Session = Depends(get_db),
):
    result = db.execute(
        text("""
            SELECT
                product_id,
                product_name
            FROM products
            ORDER BY product_name
        """)
    )

    return [
        dict(row._mapping)
        for row in result
    ]