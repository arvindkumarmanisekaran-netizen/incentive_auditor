from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..analytics.sales_anomaly import (
    calculate_sales_deviation,
)

from ..analytics.sales_prescription_mismatch import (
    calculate_sales_prescription_mismatch,
)

from ..analytics.doctor_concentration import (
    calculate_doctor_concentration,
)

from ..analytics.cross_territory import (
    calculate_cross_territory_concentration,
)


async def investigate(
    db: AsyncSession,
    representative_id: str,
    product_id: str,
    month: str,
) -> dict:

    target_month = f"{month}-01"

    findings = []

    # ==================================================
    # SALES DEVIATION
    # ==================================================

    sales_query = text(
        """
        WITH monthly_sales AS (

            SELECT

                rda.representative_id,

                s.product_id,

                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date AS sales_month,


                SUM(
                    s.sales_amount
                ) AS total_sales


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

                AND rda.representative_id =
                    :representative_id

                AND s.product_id =
                    :product_id


            GROUP BY

                rda.representative_id,

                s.product_id,

                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date
        )


        SELECT

            sales_month,

            total_sales


        FROM monthly_sales


        WHERE

            sales_month <= :target_month


        ORDER BY sales_month

        """
    )

    sales_result = await db.execute(
        sales_query,
        {
            "representative_id": representative_id,
            "product_id": product_id,
            "target_month": target_month,
        },
    )

    sales_rows = sales_result.fetchall()

    if sales_rows:

        current_row = None

        historical_rows = []

        for row in sales_rows:

            if str(row.sales_month) == target_month:

                current_row = row

            else:

                historical_rows.append(row)

        if current_row and historical_rows:

            current_sales = float(
                current_row.total_sales
            )

            historical_average = (

                sum(
                    float(row.total_sales)
                    for row in historical_rows
                )

                /

                len(historical_rows)

            )

            analysis = calculate_sales_deviation(
                current_sales=current_sales,
                historical_average=historical_average,
            )

            findings.append(
                {
                    "type":
                        "sales_deviation",

                    "severity":
                        analysis["severity"],

                    "evidence":
                        analysis,
                }
            )

    # ==================================================
    # SALES PRESCRIPTION MISMATCH
    # ==================================================

    mismatch_query = text(
        """
        WITH monthly_sales AS (

            SELECT

                rda.representative_id,

                s.product_id,

                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date AS month,


                SUM(
                    s.sales_amount
                ) AS sales_amount


            FROM sales s


            JOIN representative_doctor_assignments rda

                ON rda.doctor_id = s.doctor_id

                AND s.sale_date >= rda.effective_from

                AND (
                    rda.effective_to IS NULL

                    OR s.sale_date <= rda.effective_to
                )


            WHERE

                s.status='Valid'

                AND rda.representative_id =
                    :representative_id

                AND s.product_id =
                    :product_id


            GROUP BY

                rda.representative_id,

                s.product_id,

                DATE_TRUNC(
                    'month',
                    s.sale_date
                )::date

        ),


        monthly_prescriptions AS (

            SELECT

                rda.representative_id,

                p.product_id,


                DATE_TRUNC(
                    'month',
                    p.prescription_date
                )::date AS month,


                SUM(
                    p.quantity
                ) AS prescription_quantity


            FROM prescriptions p


            JOIN representative_doctor_assignments rda

                ON rda.doctor_id = p.doctor_id


                AND p.prescription_date >=
                    rda.effective_from


                AND (
                    rda.effective_to IS NULL

                    OR p.prescription_date <=
                       rda.effective_to
                )


            WHERE

                p.status='Valid'

                AND rda.representative_id =
                    :representative_id

                AND p.product_id =
                    :product_id


            GROUP BY

                rda.representative_id,

                p.product_id,

                DATE_TRUNC(
                    'month',
                    p.prescription_date
                )::date

        )


        SELECT

            COALESCE(
                ms.month,
                mp.month
            ) AS month,


            COALESCE(
                ms.sales_amount,
                0
            ) AS sales_amount,


            COALESCE(
                mp.prescription_quantity,
                0
            ) AS prescription_quantity


        FROM monthly_sales ms


        FULL OUTER JOIN monthly_prescriptions mp

            ON mp.representative_id =
               ms.representative_id

            AND mp.product_id =
                ms.product_id

            AND mp.month =
                ms.month


        WHERE COALESCE(
            ms.month,
            mp.month
        ) <= :target_month


        ORDER BY month

        """
    )

    mismatch_result = await db.execute(
        mismatch_query,
        {
            "representative_id": representative_id,
            "product_id": product_id,
            "target_month": target_month,
        },
    )

    mismatch_rows = mismatch_result.fetchall()

    if mismatch_rows:

        current_row = None

        historical_rows = []

        for row in mismatch_rows:

            if str(row.month) == target_month:

                current_row = row

            else:

                historical_rows.append(row)

        if current_row and historical_rows:
            sales_avg = (
                sum(
                    float(row.sales_amount)
                    for row in historical_rows
                )
                /
                len(historical_rows)
            )

            rx_avg = (
                sum(
                    float(
                        row.prescription_quantity
                    )
                    for row in historical_rows
                )
                /
                len(historical_rows)
            )

            analysis = (
                calculate_sales_prescription_mismatch(
                    current_sales=float(
                        current_row.sales_amount
                    ),

                    historical_sales_average=sales_avg,

                    current_prescriptions=float(
                        current_row.prescription_quantity
                    ),

                    historical_prescription_average=rx_avg,
                )
            )

            findings.append(
                {
                    "type":
                        "sales_prescription_mismatch",

                    "severity":
                        analysis["severity"],

                    "evidence":
                        analysis,
                }
            )

    # ==================================================
    # DOCTOR CONCENTRATION
    # ==================================================

    doctor_query = text(
        """
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

            AND s.product_id =
                :product_id

            AND DATE_TRUNC(
                'month',
                s.sale_date
            )::date =
                :target_month

            AND s.status =
                'Valid'


        GROUP BY

            s.doctor_id,

            d.doctor_name


        ORDER BY

            doctor_sales DESC

        """
    )

    doctor_result = await db.execute(
        doctor_query,
        {
            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,
        },
    )

    doctor_rows = doctor_result.fetchall()

    if doctor_rows:

        doctor_sales = [

            {
                "doctor_id":
                    row.doctor_id,

                "doctor_name":
                    row.doctor_name,

                "sales":
                    float(
                        row.doctor_sales
                    ),
            }

            for row in doctor_rows

        ]

        analysis = calculate_doctor_concentration(
            doctor_sales
        )

        findings.append(
            {
                "type":
                    "doctor_concentration",

                "severity":
                    analysis["severity"],

                "evidence":
                    analysis,
            }
        )

    # ==================================================
    # CROSS TERRITORY CONCENTRATION
    # ==================================================

    territory_query = text(
        """
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

            AND s.product_id =
                :product_id

            AND DATE_TRUNC(
                'month',
                s.sale_date
            )::date =
                :target_month

            AND s.status =
                'Valid'


        GROUP BY

            r.territory_id,

            s.selling_territory_id,

            t.territory_name


        ORDER BY

            territory_sales DESC

        """
    )

    territory_result = await db.execute(
        territory_query,
        {
            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,
        },
    )

    territory_rows = territory_result.fetchall()

    if territory_rows:

        home_territory_id = (
            territory_rows[0]
            .home_territory_id
        )

        territory_sales = [

            {
                "territory_id":
                    row.selling_territory_id,

                "territory_name":
                    row.territory_name,

                "sales":
                    float(
                        row.territory_sales
                    ),
            }

            for row in territory_rows

        ]

        analysis = (
            calculate_cross_territory_concentration(
                home_territory_id=home_territory_id,
                territory_sales=territory_sales,
            )
        )

        findings.append(
            {
                "type":
                    "cross_territory_concentration",

                "severity":
                    analysis["severity"],

                "evidence":
                    analysis,
            }
        )

    # ==================================================
    # PAYOUT DISCREPANCY
    # ==================================================

    payout_query = text(
        """
        SELECT

            payout_id,

            representative_id,

            product_id,

            expected_payout,

            actual_payout,

            payout_difference,

            status


        FROM incentive_payouts


        WHERE

            representative_id =
                :representative_id

            AND product_id =
                :product_id

            AND payout_month =
                :target_month

        """
    )

    payout_result = await db.execute(
        payout_query,
        {
            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,
        },
    )

    payout_row = payout_result.fetchone()

    if payout_row:
        difference = float(
            payout_row.payout_difference
        )

        if (
            payout_row.expected_payout == 0
            and payout_row.actual_payout > 0
        ):

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
                "type":
                    "payout_discrepancy",

                "severity":
                    severity,

                "evidence":
                    {
                        "payout_id":
                            payout_row.payout_id,

                        "expected_payout":
                            float(
                                payout_row.expected_payout
                            ),

                        "actual_payout":
                            float(
                                payout_row.actual_payout
                            ),

                        "payout_difference":
                            difference,

                        "payout_status":
                            payout_row.status,
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

        "UNKNOWN": 0,

    }

    overall_risk_score = 0

    if findings:

        overall_risk_score = max(

            severity_scores.get(

                finding.get(
                    "severity",
                    "UNKNOWN"
                ),

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
    # FINAL INVESTIGATION RESULT
    # ==================================================

    return {

        "representative_id":
            representative_id,


        "product_id":
            product_id,


        "month":
            month,


        "findings":
            findings,


        "overall_risk_score":
            overall_risk_score,


        "overall_severity":
            overall_severity,

    }
