from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def calculate_incentives(
    db: AsyncSession,
    month: str,
) -> list[dict]:
    """
    Return incentive payout information for the requested month
    using the simplified schema.

    month format:
        YYYY-MM
    """

    payout_month = f"{month}-01"

    query = text("""
        WITH attributed_sales AS (
            SELECT
                rda.representative_id,
                s.product_id,
                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date AS sales_month,
                SUM(s.sales_amount) AS attributed_actual_sales

            FROM sales s

            JOIN representative_doctor_assignments rda
                ON rda.doctor_id = s.doctor_id
                AND s.sale_date >= rda.effective_from
                AND (
                    rda.effective_to IS NULL
                    OR s.sale_date <= rda.effective_to
                )

            WHERE
                s.status = 'Valid'
                AND rda.status = 'Active'

            GROUP BY
                rda.representative_id,
                s.product_id,
                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date
        )

        SELECT
            ip.payout_id,

            ip.representative_id,

            r.first_name,
            r.last_name,

            r.territory_id,
            t.territory_name,

            ip.product_id,
            pr.product_name,

            ip.payout_month,

            ip.sales_target,

            COALESCE(
                a.attributed_actual_sales,
                0
            ) AS attributed_actual_sales,

            ip.actual_sales AS recorded_actual_sales,

            ROUND(
                CASE
                    WHEN ip.sales_target = 0 THEN 0
                    ELSE (
                        COALESCE(
                            a.attributed_actual_sales,
                            0
                        )
                        / ip.sales_target
                    ) * 100
                END,
                2
            ) AS calculated_sales_achievement,

            ip.sales_achievement
                AS recorded_sales_achievement,

            ip.base_incentive,

            ip.achievement_multiplier,

            ip.calculated_payout,

            ip.maximum_payout,

            ip.expected_payout,

            ip.actual_payout,

            ROUND(
                ip.actual_payout
                - ip.expected_payout,
                2
            ) AS calculated_payout_difference,

            ip.payout_difference
                AS recorded_payout_difference,

            ip.status

        FROM incentive_payouts ip

        JOIN representatives r
            ON r.representative_id =
                ip.representative_id

        JOIN territories t
            ON t.territory_id =
                r.territory_id

        JOIN products pr
            ON pr.product_id =
                ip.product_id

        LEFT JOIN attributed_sales a
            ON a.representative_id =
                ip.representative_id
            AND a.product_id =
                ip.product_id
            AND a.sales_month =
                ip.payout_month

        WHERE
            ip.payout_month = :payout_month

        ORDER BY
            ip.representative_id,
            ip.product_id
    """)

    result = await db.execute(
        query,
        {
            "payout_month": payout_month,
        },
    )

    rows = result.fetchall()

    return [dict(row._mapping) for row in rows]
