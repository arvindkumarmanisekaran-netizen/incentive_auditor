from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..analytics.cross_territory import (
    calculate_cross_territory_concentration,
)

from ..analytics.sales_anomaly import (
    calculate_sales_deviation,
)

from ..analytics.sales_prescription_mismatch import (
    calculate_sales_prescription_mismatch,
)

from ..analytics.doctor_concentration import (
    calculate_doctor_concentration,
)


async def investigate(
    db: AsyncSession,
    representative_id: str,
    start_date: str,
    end_date: str,
) -> dict:

    findings = []

    products_analyzed = []

    # ==================================================
    # FIND PRODUCTS SOLD BY REPRESENTATIVE
    # ==================================================

    products_query = text("""
        SELECT DISTINCT

            s.product_id

        FROM sales s


        JOIN representative_doctor_assignments rda

            ON rda.doctor_id = s.doctor_id

            AND s.sale_date >= rda.effective_from

            AND (
                rda.effective_to IS NULL

                OR s.sale_date <= rda.effective_to
            )


        WHERE

            rda.representative_id =
                :representative_id

            AND s.sale_date BETWEEN
                :start_date
                AND
                :end_date

            AND s.status = 'Valid'


        ORDER BY

            s.product_id
        """)

    product_result = await db.execute(
        products_query,
        {
            "representative_id": representative_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    products = product_result.fetchall()

    products_analyzed = [row.product_id for row in products]

    # ==================================================
    # ANALYZE EACH PRODUCT
    # ==================================================

    for product_id in products_analyzed:

        # ==================================================
        # SALES DEVIATION
        # ==================================================

        sales_query = text("""
            WITH monthly_sales AS (

                SELECT

                    DATE_TRUNC(
                        'month',
                        s.sale_date
                    )::date AS sales_month,


                    SUM(
                        s.sales_amount
                    ) AS total_sales


                FROM sales s


                JOIN representative_doctor_assignments rda

                    ON rda.doctor_id =
                       s.doctor_id


                    AND s.sale_date >=
                        rda.effective_from


                    AND (
                        rda.effective_to IS NULL

                        OR s.sale_date <=
                           rda.effective_to
                    )


                WHERE

                    rda.representative_id =
                        :representative_id


                    AND s.product_id =
                        :product_id


                    AND s.status =
                        'Valid'


                    AND s.sale_date <=
                        :end_date


                GROUP BY

                    DATE_TRUNC(
                        'month',
                        s.sale_date
                    )::date

            )


            SELECT *

            FROM monthly_sales


            ORDER BY

                sales_month
            """)

        sales_result = await db.execute(
            sales_query,
            {
                "representative_id": representative_id,
                "product_id": product_id,
                "end_date": end_date,
            },
        )

        sales_rows = sales_result.fetchall()

        if len(sales_rows) >= 2:

            current_sales = float(sales_rows[-1].total_sales)

            historical_rows = sales_rows[:-1]

            historical_average = sum(float(row.total_sales) for row in historical_rows) / len(
                historical_rows
            )

            analysis = calculate_sales_deviation(
                current_sales=current_sales,
                historical_average=historical_average,
            )

            findings.append(
                {
                    "type": "sales_deviation",
                    "product_id": product_id,
                    "severity": analysis["severity"],
                    "evidence": analysis,
                }
            )

        # ==================================================
        # SALES PRESCRIPTION MISMATCH
        # ==================================================

        mismatch_query = text("""
            WITH sales_data AS (

                SELECT

                    DATE_TRUNC(
                        'month',
                        s.sale_date
                    )::date AS month,


                    SUM(
                        s.sales_amount
                    ) AS sales_amount


                FROM sales s


                JOIN representative_doctor_assignments rda

                    ON rda.doctor_id =
                       s.doctor_id


                    AND s.sale_date >=
                        rda.effective_from


                    AND (
                        rda.effective_to IS NULL

                        OR s.sale_date <=
                           rda.effective_to
                    )


                WHERE

                    rda.representative_id =
                        :representative_id


                    AND s.product_id =
                        :product_id


                    AND s.status =
                        'Valid'


                    AND s.sale_date <=
                        :end_date


                GROUP BY

                    DATE_TRUNC(
                        'month',
                        s.sale_date
                    )::date

            ),


            prescription_data AS (

                SELECT

                    DATE_TRUNC(
                        'month',
                        p.prescription_date
                    )::date AS month,


                    SUM(
                        p.quantity
                    ) AS prescription_quantity


                FROM prescriptions p


                JOIN representative_doctor_assignments rda

                    ON rda.doctor_id =
                       p.doctor_id


                    AND p.prescription_date >=
                        rda.effective_from


                    AND (
                        rda.effective_to IS NULL

                        OR p.prescription_date <=
                           rda.effective_to
                    )


                WHERE

                    rda.representative_id =
                        :representative_id


                    AND p.product_id =
                        :product_id


                    AND p.status =
                        'Valid'


                    AND p.prescription_date <=
                        :end_date


                GROUP BY

                    DATE_TRUNC(
                        'month',
                        p.prescription_date
                    )::date

            )


            SELECT

                COALESCE(
                    s.month,
                    p.month
                ) AS month,


                COALESCE(
                    s.sales_amount,
                    0
                ) AS sales_amount,


                COALESCE(
                    p.prescription_quantity,
                    0
                ) AS prescription_quantity


            FROM sales_data s


            FULL OUTER JOIN prescription_data p

                ON s.month = p.month


            ORDER BY month
            """)

        mismatch_result = await db.execute(
            mismatch_query,
            {
                "representative_id": representative_id,
                "product_id": product_id,
                "end_date": end_date,
            },
        )

        mismatch_rows = mismatch_result.fetchall()

        if len(mismatch_rows) >= 2:

            current = mismatch_rows[-1]

            history = mismatch_rows[:-1]

            sales_average = sum(float(row.sales_amount) for row in history) / len(
                history
            )  # noqa: E501

            rx_average = sum(float(row.prescription_quantity) for row in history) / len(history)

            analysis = calculate_sales_prescription_mismatch(
                current_sales=float(current.sales_amount),
                historical_sales_average=sales_average,
                current_prescriptions=float(current.prescription_quantity),
                historical_prescription_average=rx_average,
            )

            findings.append(
                {
                    "type": "sales_prescription_mismatch",
                    "product_id": product_id,
                    "severity": analysis["severity"],
                    "evidence": analysis,
                }
            )

    # ==================================================
    # DOCTOR CONCENTRATION
    # ==================================================

    doctor_query = text("""
        SELECT

            s.doctor_id,

            d.doctor_name,

            SUM(
                s.sales_amount
            ) AS doctor_sales


        FROM sales s


        JOIN doctors d

            ON d.doctor_id =
               s.doctor_id


        JOIN representative_doctor_assignments rda

            ON rda.doctor_id =
               s.doctor_id


            AND s.sale_date >=
                rda.effective_from


            AND (
                rda.effective_to IS NULL

                OR s.sale_date <=
                   rda.effective_to
            )


        WHERE

            rda.representative_id =
                :representative_id


            AND s.sale_date BETWEEN
                :start_date
                AND
                :end_date


            AND s.status =
                'Valid'


        GROUP BY

            s.doctor_id,

            d.doctor_name


        ORDER BY

            doctor_sales DESC
        """)

    doctor_result = await db.execute(
        doctor_query,
        {
            "representative_id": representative_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    doctor_rows = doctor_result.fetchall()

    if doctor_rows:

        doctor_sales = [
            {
                "doctor_id": row.doctor_id,
                "doctor_name": row.doctor_name,
                "sales": float(row.doctor_sales),
            }
            for row in doctor_rows
        ]

        analysis = calculate_doctor_concentration(doctor_sales)

        findings.append(
            {
                "type": "doctor_concentration",
                "product_id": "ALL",
                "severity": analysis["severity"],
                "evidence": analysis,
            }
        )

    # ==================================================
    # CROSS TERRITORY CONCENTRATION
    # ==================================================

    territory_query = text("""
        SELECT

            r.territory_id AS home_territory_id,

            s.selling_territory_id,

            t.territory_name,

            SUM(
                s.sales_amount
            ) AS territory_sales


        FROM sales s


        JOIN representative_doctor_assignments rda

            ON rda.doctor_id =
               s.doctor_id


            AND s.sale_date >=
                rda.effective_from


            AND (
                rda.effective_to IS NULL

                OR s.sale_date <=
                   rda.effective_to
            )


        JOIN representatives r

            ON r.representative_id =
               rda.representative_id


        JOIN territories t

            ON t.territory_id =
               s.selling_territory_id


        WHERE

            rda.representative_id =
                :representative_id


            AND s.sale_date BETWEEN
                :start_date
                AND
                :end_date


            AND s.status =
                'Valid'


        GROUP BY

            r.territory_id,

            s.selling_territory_id,

            t.territory_name


        ORDER BY

            territory_sales DESC
        """)

    territory_result = await db.execute(
        territory_query,
        {
            "representative_id": representative_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    territory_rows = territory_result.fetchall()

    if territory_rows:

        home_territory_id = territory_rows[0].home_territory_id

        territory_sales = [
            {
                "territory_id": row.selling_territory_id,
                "territory_name": row.territory_name,
                "sales": float(row.territory_sales),
            }
            for row in territory_rows
        ]

        analysis = calculate_cross_territory_concentration(
            home_territory_id=home_territory_id,
            territory_sales=territory_sales,
        )

        findings.append(
            {
                "type": "cross_territory_concentration",
                "product_id": "ALL",
                "severity": analysis["severity"],
                "evidence": analysis,
            }
        )

    # ==================================================
    # PAYOUT DISCREPANCY
    # ==================================================

    payout_query = text("""
        SELECT

            payout_id,

            product_id,

            expected_payout,

            actual_payout,

            payout_difference,

            status


        FROM incentive_payouts


        WHERE

            representative_id =
                :representative_id


            AND payout_month BETWEEN

                DATE_TRUNC(
                    'month',
                    CAST(:start_date AS DATE)
                )::date

                AND

                DATE_TRUNC(
                    'month',
                    CAST(:end_date AS DATE)
                )::date
        """)

    payout_result = await db.execute(
        payout_query,
        {
            "representative_id": representative_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )

    payout_rows = payout_result.fetchall()

    for payout in payout_rows:

        difference = float(payout.payout_difference)

        expected = float(payout.expected_payout)

        actual = float(payout.actual_payout)

        if expected == 0 and actual > 0:

            severity = "HIGH"

        elif abs(difference) >= 5000:

            severity = "HIGH"

        elif abs(difference) >= 1000:

            severity = "MEDIUM"

        elif abs(difference) > 0:

            severity = "LOW"

        else:

            severity = "NORMAL"

        findings.append(
            {
                "type": "payout_discrepancy",
                "product_id": payout.product_id,
                "severity": severity,
                "evidence": {
                    "payout_id": payout.payout_id,
                    "expected_payout": expected,
                    "actual_payout": actual,
                    "payout_difference": difference,
                    "status": payout.status,
                },
            }
        )

    # ==================================================
    # OVERALL RISK SCORE
    # ==================================================

    severity_scores = {
        "NORMAL": 0,
        "LOW": 25,
        "MEDIUM": 50,
        "HIGH": 75,
    }

    overall_risk_score = 0

    if findings:

        overall_risk_score = max(
            severity_scores.get(
                finding.get("severity", "NORMAL"),
                0,
            )
            for finding in findings
        )

    if overall_risk_score >= 75:

        overall_severity = "HIGH"

    elif overall_risk_score >= 50:

        overall_severity = "MEDIUM"

    elif overall_risk_score >= 25:

        overall_severity = "LOW"

    else:

        overall_severity = "NORMAL"

    # ==================================================
    # FINAL RESPONSE
    # ==================================================

    return {
        "representative_id": representative_id,
        "start_date": start_date,
        "end_date": end_date,
        "products_analyzed": products_analyzed,
        "findings": findings,
        "overall_risk_score": overall_risk_score,
        "overall_severity": overall_severity,
    }
