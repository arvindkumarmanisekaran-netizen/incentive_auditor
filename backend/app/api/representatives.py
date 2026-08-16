from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db.session import get_db


router = APIRouter(
    prefix="/api/representatives",
    tags=["Representatives"]
)


@router.get("")
def get_representatives(db: Session = Depends(get_db)):

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

    result = db.execute(query)

    representatives = [
        dict(row._mapping)
        for row in result
    ]

    return representatives