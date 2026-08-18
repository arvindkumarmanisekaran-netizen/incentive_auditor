from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)


async def check_existing_ids(
    session: AsyncSession,
    table: str,
    column: str,
    values: set[str],
):

    if not values:
        return set()

    result = await session.execute(
        text(f"""
            SELECT {column}
            FROM {table}
            WHERE {column} = ANY(:values)
            """),
        {"values": list(values)},
    )

    return {row[0] for row in result.fetchall()}


def find_missing_rows(
    records: list[dict],
    column: str,
    missing_values: set[str],
    table: str,
):
    """
    Convert missing FK values into
    row-level validation errors.
    """

    errors = []

    for index, record in enumerate(
        records,
        start=1,
    ):

        value = record.get(column)

        if value in missing_values:

            errors.append(
                {
                    "row_id": index,
                    "table": table,
                    "column": column,
                    "value": value,
                }
            )

    return errors


async def validate_foreign_keys(
    session: AsyncSession,
    table_name: str,
    records: list[dict],
):

    errors = []

    if table_name == "sales":

        # -----------------------------
        # Doctors
        # -----------------------------

        doctor_ids = {r["doctor_id"] for r in records if r.get("doctor_id")}

        existing_doctors = await check_existing_ids(
            session,
            "doctors",
            "doctor_id",
            doctor_ids,
        )

        missing_doctors = doctor_ids - existing_doctors

        errors.extend(
            find_missing_rows(
                records=records,
                column="doctor_id",
                missing_values=missing_doctors,
                table="doctors",
            )
        )

        # -----------------------------
        # Products
        # -----------------------------

        product_ids = {r["product_id"] for r in records if r.get("product_id")}

        existing_products = await check_existing_ids(
            session,
            "products",
            "product_id",
            product_ids,
        )

        missing_products = product_ids - existing_products

        errors.extend(
            find_missing_rows(
                records=records,
                column="product_id",
                missing_values=missing_products,
                table="products",
            )
        )

        # -----------------------------
        # Territories
        # -----------------------------

        territory_ids = {
            r["selling_territory_id"] for r in records if r.get("selling_territory_id")  # noqa:
        }

        existing_territories = await check_existing_ids(
            session,
            "territories",
            "territory_id",
            territory_ids,
        )

        missing_territories = territory_ids - existing_territories

        errors.extend(
            find_missing_rows(
                records=records,
                column="selling_territory_id",
                missing_values=missing_territories,
                table="territories",
            )
        )

    return errors
