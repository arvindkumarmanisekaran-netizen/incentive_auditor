from __future__ import annotations

from typing import Any

from sqlalchemy import MetaData, Table, and_, select, or_
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.sqltypes import Integer, Numeric, Float, Date, DateTime

metadata = MetaData()


async def reflect_table(
    session: AsyncSession,
    table_name: str,
) -> Table:
    """
    Reflect an existing PostgreSQL table
    using the current async SQLAlchemy engine.
    """

    connection = await session.connection()

    table = await connection.run_sync(
        lambda sync_connection: Table(
            table_name,
            metadata,
            autoload_with=sync_connection,
        )
    )

    return table


def normalize_duplicate_value(
    column,
    value: Any,
):
    """
    Convert incoming duplicate key values
    according to the database column type.
    """

    if value is None:
        return None

    column_type = column.type

    # VARCHAR / TEXT / CHAR
    if hasattr(column_type, "length"):
        return str(value)

    # INTEGER
    if isinstance(column_type, Integer):
        return int(value)

    # FLOAT / NUMERIC
    if isinstance(
        column_type,
        (
            Numeric,
            Float,
        ),
    ):
        return float(value)

    # DATE / DATETIME
    if isinstance(
        column_type,
        (
            Date,
            DateTime,
        ),
    ):
        return value

    return value


def normalize_column_value(
    column,
    value,
):
    """
    Convert incoming values to match
    database column types.
    """

    if value is None:
        return None

    # DATE / DATETIME columns
    if isinstance(column.type, (Date, DateTime)):

        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        if isinstance(value, str):

            value = value.strip()

            if not value:
                return None

            # Handles YYYY-MM-DD
            return datetime.strptime(
                value[:10],
                "%Y-%m-%d",
            ).date()

    return value


def build_key_filter(
    table,
    record,
    duplicate_keys,
):

    conditions = []

    for key in duplicate_keys:

        column = table.c[key]
        value = record.get(key)

        if value is None:
            continue

        # convert dates coming from CSV/excel/json
        if column.type.python_type is date:

            if isinstance(value, str):
                value = datetime.strptime(
                    value,
                    "%Y-%m-%d",
                ).date()

        conditions.append(column == value)

    return and_(*conditions)


def serialize_row(
    row: Any,
) -> dict[str, Any]:
    """
    Convert SQLAlchemy RowMapping values into
    JSON-friendly dictionaries.
    """

    if row is None:
        return {}

    return dict(row._mapping)


def clean_record_for_table(
    table,
    record: dict,
) -> dict:

    cleaned = {}

    for column in table.columns:

        key = column.name

        if key not in record:
            continue

        value = record[key]

        if value is None:
            cleaned[key] = None
            continue

        column_type = column.type.python_type

        # DATE columns
        if column_type is date:

            if isinstance(value, str):

                try:
                    value = datetime.strptime(
                        value.strip(),
                        "%Y-%m-%d",
                    ).date()

                except ValueError:
                    pass

        # DATETIME columns
        elif column_type is datetime:

            if isinstance(value, str):

                try:
                    value = datetime.fromisoformat(value.strip())

                except ValueError:
                    pass

        # Decimal / numeric columns
        elif column_type is Decimal:

            if isinstance(value, str):

                try:
                    value = Decimal(value.replace(",", "").strip())

                except Exception:
                    pass

        # Strings
        elif column_type is str:

            if isinstance(value, str):
                value = value.strip()

        cleaned[key] = value

    return cleaned


async def check_duplicates(
    session,
    table_name,
    records,
    duplicate_keys,
    filename=None,
):

    table = await reflect_table(
        session,
        table_name,
    )

    new_records = []
    duplicate_records = []

    primary_keys = [column.name for column in table.primary_key.columns]

    for index, record in enumerate(records, start=1):

        cleaned_record = clean_record_for_table(
            table,
            record,
        )

        duplicate_conditions = []

        # 1. Primary key duplicate check
        pk_conditions = []

        for pk in primary_keys:

            if pk in cleaned_record:

                pk_conditions.append(table.c[pk] == cleaned_record[pk])

        if pk_conditions:
            duplicate_conditions.append(and_(*pk_conditions))

        # 2. Business key duplicate check
        business_conditions = []

        for key in duplicate_keys:

            if key in cleaned_record:

                business_conditions.append(table.c[key] == cleaned_record[key])

        if business_conditions:
            duplicate_conditions.append(and_(*business_conditions))

        # nothing to compare
        if not duplicate_conditions:

            new_records.append(
                {
                    "row": index,
                    "incoming_record": cleaned_record,
                }
            )
            continue

        # PK match OR all business keys match
        where_clause = or_(*duplicate_conditions)

        result = await session.execute(select(table).where(where_clause).limit(1))  # noqa: E501

        existing = result.first()

        if existing:

            duplicate_records.append(
                {
                    "row": index,
                    "incoming_record": cleaned_record,
                    "existing_record": serialize_row(existing),
                }
            )

        else:

            new_records.append(
                {
                    "row": index,
                    "incoming_record": cleaned_record,
                }
            )

    return {
        "filename": filename,
        "table": table_name,
        "total_records": len(records),
        "new_record_count": len(new_records),
        "duplicate_record_count": len(duplicate_records),
        "new_records": new_records,
        "duplicate_records": duplicate_records,
        "has_duplicates": bool(duplicate_records),
    }
