from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db.session import get_db


router = APIRouter(
    prefix="/api/anomalies",
    tags=["Anomalies"],
)


@router.get("/payout-discrepancies")
def payout_discrepancies(
    month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
):
    target_month = f"{month}-01"

    query = text("""
        SELECT
            ip.payout_id,
            ip.representative_id,
            r.first_name,
            r.last_name,
            ip.product_id,
            p.product_name,
            ip.payout_month,
            ip.expected_payout,
            ip.actual_payout,
            ip.payout_difference,

            CASE
                WHEN ip.expected_payout = 0
                     AND ip.actual_payout > 0
                    THEN 'HIGH'

                WHEN ABS(ip.payout_difference) >= 5000
                    THEN 'HIGH'

                WHEN ABS(ip.payout_difference) >= 1000
                    THEN 'MEDIUM'

                ELSE 'LOW'
            END AS severity

        FROM incentive_payouts ip

        JOIN representatives r
            ON r.representative_id = ip.representative_id

        JOIN products p
            ON p.product_id = ip.product_id

        WHERE ip.payout_month = :target_month

        ORDER BY ABS(ip.payout_difference) DESC
    """)

    result = db.execute(
        query,
        {"target_month": target_month},
    )

    return [
        dict(row._mapping)
        for row in result
    ]