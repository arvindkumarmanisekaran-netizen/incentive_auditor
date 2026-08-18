from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


from ..db.session import get_db


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

router = APIRouter(

    prefix="/api/analytics",

    tags=[
        "Analytics"
    ],

)

# ======================================================
# SALES + PRESCRIPTION MISMATCH
# ======================================================


@router.get(
    "/sales-prescription-mismatch"
)
async def sales_prescription_mismatch(

    representative_id: str,

    product_id: str,

    month: str = Query(

        ...,

        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",

    ),

    db: AsyncSession = Depends(get_db),

):
    target_month = f"{month}-01"

    query = text(
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

                AND p.prescription_date >= rda.effective_from

                AND (
                    rda.effective_to IS NULL

                    OR p.prescription_date <= rda.effective_to
                )


            WHERE

                p.status = 'Valid'

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


        WHERE

            COALESCE(
                ms.month,
                mp.month
            ) <= :target_month


        ORDER BY month
        """
    )

    result = await db.execute(

        query,

        {

            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,

        },

    )

    rows = result.fetchall()

    if not rows:

        return {
            "message":
                "No sales or prescription data found"
        }

    current_row = None

    historical_rows = []

    for row in rows:

        if str(row.month) == target_month:

            current_row = row

        else:

            historical_rows.append(row)

    if current_row is None:

        return {
            "message":
                "No data found for requested month"
        }

    if not historical_rows:

        return {
            "message":
                "Insufficient historical data"
        }

    historical_sales_average = (

        sum(
            float(row.sales_amount)
            for row in historical_rows
        )

        /

        len(historical_rows)

    )

    historical_prescription_average = (

        sum(
            float(row.prescription_quantity)
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

            historical_sales_average=historical_sales_average,

            current_prescriptions=float(
                                current_row.prescription_quantity
                            ),
                
            historical_prescription_average=historical_prescription_average,
                
        )
    )

    return {

        "representative_id":
            representative_id,

        "product_id":
            product_id,

        "month":
            month,

        **analysis,

    }


# ======================================================
# SALES DEVIATION
# ======================================================


@router.get(
    "/sales-deviation"
)
async def sales_deviation(

    representative_id: str,

    product_id: str,

    month: str = Query(

        ...,

        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",

    ),


    db: AsyncSession = Depends(get_db),

):
    target_month = f"{month}-01"

    query = text(
        """
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

            ON rda.doctor_id = s.doctor_id


        WHERE

            s.status='Valid'

            AND rda.representative_id =
                :representative_id

            AND s.product_id =
                :product_id


        GROUP BY sales_month


        HAVING sales_month <= :target_month


        ORDER BY sales_month
        """
    )

    result = await db.execute(

        query,

        {

            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,

        },

    )

    rows = result.fetchall()

    if not rows:

        return {
            "message":
                "No sales data found"
        }

    sales = {

        row.sales_month:
            float(
                row.total_sales
            )

        for row in rows

    }

    current_date = next(

        (

            d

            for d in sales

            if str(d) == target_month

        ),

        None,

    )

    if not current_date:

        return {
            "message":
                "No sales for requested month"
        }

    previous = [

        value

        for d, value

        in sales.items()

        if d < current_date

    ]

    if not previous:

        return {
            "message":
                "Insufficient historical data"
        }

    analysis = calculate_sales_deviation(

        current_sales=sales[current_date],
            
        historical_average=sum(previous)/len(previous),
    )

    return {

        "representative_id":
            representative_id,

        "product_id":
            product_id,

        "month":
            month,

        **analysis,

    }


# ======================================================
# DOCTOR CONCENTRATION
# ======================================================


@router.get(
    "/doctor-concentration"
)
async def doctor_concentration(

    representative_id: str,

    product_id: str,

    month: str = Query(

        ...,

        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",

    ),


    db: AsyncSession = Depends(get_db),

):
    target_month = f"{month}-01"

    query = text(
        """
        SELECT

            s.doctor_id,

            d.doctor_name,

            SUM(
                s.sales_amount
            ) AS doctor_sales


        FROM sales s


        JOIN doctors d

            ON d.doctor_id=s.doctor_id


        JOIN representative_doctor_assignments rda

            ON rda.doctor_id=s.doctor_id



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

            AND s.status='Valid'


        GROUP BY

            s.doctor_id,

            d.doctor_name


        ORDER BY doctor_sales DESC
        """
    )

    result = await db.execute(

        query,

        {

            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,

        },

    )

    rows = result.fetchall()

    if not rows:

        return {
            "message":
                "No sales data found"
        }

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

        for row in rows

    ]

    analysis = calculate_doctor_concentration(
        doctor_sales
    )

    return {

        "representative_id":
            representative_id,

        "product_id":
            product_id,

        "month":
            month,

        **analysis,

    }


# ======================================================
# CROSS TERRITORY
# ======================================================

@router.get(
    "/cross-territory"
)
async def cross_territory_analysis(

    representative_id: str,

    product_id: str,

    month: str = Query(

        ...,

        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",

    ),


    db: AsyncSession = Depends(get_db),

):

    target_month = f"{month}-01"

    query = text(
        """
        SELECT

            r.territory_id
                AS home_territory_id,


            s.selling_territory_id,


            t.territory_name,


            SUM(
                s.sales_amount
            ) AS territory_sales


        FROM sales s


        JOIN representative_doctor_assignments rda

            ON rda.doctor_id=s.doctor_id


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


            AND s.status='Valid'


        GROUP BY

            r.territory_id,

            s.selling_territory_id,

            t.territory_name


        ORDER BY territory_sales DESC
        """
    )

    result = await db.execute(

        query,

        {

            "representative_id":
                representative_id,

            "product_id":
                product_id,

            "target_month":
                target_month,

        },

    )

    rows = result.fetchall()

    if not rows:

        return {
            "message":
                "No sales data found"
        }

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

        for row in rows

    ]

    analysis = (
        calculate_cross_territory_concentration(

            home_territory_id=rows[0].home_territory_id,
                
            territory_sales=territory_sales,

        )
    )

    return {

        "representative_id":
            representative_id,

        "product_id":
            product_id,

        "month":
            month,

        "home_territory_id":
            rows[0].home_territory_id,

        **analysis,

    }