from sqlalchemy import text
from sqlalchemy.orm import Session


def calculate_incentives(
    db: Session,
    month: str,
) -> list[dict]:
    """
    Calculate expected incentive payout for all active
    representative/product targets for a given month.

    month format:
        YYYY-MM
    """

    target_month = f"{month}-01"

    query = text("""
        WITH attributed_sales AS (

            SELECT
                rda.representative_id,
                s.product_id,

                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date AS sales_month,

                SUM(
                    s.sales_amount
                ) AS actual_sales

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

            GROUP BY
                rda.representative_id,
                s.product_id,
                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date
        ),


        performance AS (

            SELECT
                st.representative_id,
                st.product_id,
                st.target_month,
                st.target_amount,

                COALESCE(
                    a.actual_sales,
                    0
                ) AS actual_sales,


                ROUND(
                    COALESCE(
                        a.actual_sales,
                        0
                    )
                    /
                    NULLIF(
                        st.target_amount,
                        0
                    )
                    * 100,
                    2
                ) AS sales_achievement,


                pir.incentive_rate,

                ip.program_id,

                ip.maximum_payout_multiplier


            FROM sales_targets st


            LEFT JOIN attributed_sales a
                ON a.representative_id =
                    st.representative_id

                AND a.product_id =
                    st.product_id

                AND a.sales_month =
                    st.target_month


            JOIN incentive_programs ip
                ON st.target_month >=
                    DATE_TRUNC(
                        'month',
                        ip.effective_from
                    )::date

                AND (
                    ip.effective_to IS NULL

                    OR st.target_month <=
                        DATE_TRUNC(
                            'month',
                            ip.effective_to
                        )::date
                )


            JOIN product_incentive_rates pir
                ON pir.product_id =
                    st.product_id

                AND pir.program_id =
                    ip.program_id


            WHERE
                st.target_month = :target_month

                AND st.status = 'Active'

                AND ip.status = 'Active'
        )


        SELECT
            p.representative_id,

            r.first_name,
            r.last_name,

            r.territory_id,

            t.territory_name,

            p.product_id,

            pr.product_name,

            p.program_id,

            p.target_month,

            p.target_amount,

            p.actual_sales,

            p.sales_achievement,

            p.incentive_rate,

            it.tier_id,

            it.minimum_achievement
                AS tier_minimum,

            it.maximum_achievement
                AS tier_maximum,

            it.payout_multiplier,


            ROUND(
                p.target_amount
                * p.incentive_rate / 100,
                2
            ) AS target_incentive,


            ROUND(
                (
                    p.target_amount
                    * p.incentive_rate / 100
                )
                * it.payout_multiplier / 100,
                2
            ) AS calculated_payout,


            ROUND(
                (
                    p.target_amount
                    * p.incentive_rate / 100
                )
                * p.maximum_payout_multiplier / 100,
                2
            ) AS maximum_payout,


            LEAST(

                ROUND(
                    (
                        p.target_amount
                        * p.incentive_rate / 100
                    )
                    * it.payout_multiplier / 100,
                    2
                ),

                ROUND(
                    (
                        p.target_amount
                        * p.incentive_rate / 100
                    )
                    * p.maximum_payout_multiplier / 100,
                    2
                )

            ) AS expected_payout


        FROM performance p


        JOIN incentive_tiers it
            ON it.program_id =
                p.program_id

            AND p.sales_achievement >=
                it.minimum_achievement

            AND (
                it.maximum_achievement IS NULL

                OR p.sales_achievement <
                    it.maximum_achievement
            )


        JOIN representatives r
            ON r.representative_id =
                p.representative_id


        JOIN territories t
            ON t.territory_id =
                r.territory_id


        JOIN products pr
            ON pr.product_id =
                p.product_id


        ORDER BY
            p.representative_id,
            p.product_id
    """)

    result = db.execute(
        query,
        {
            "target_month": target_month
        },
    )

    return [
        dict(row._mapping)
        for row in result
    ]
