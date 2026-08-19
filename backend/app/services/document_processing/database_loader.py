from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import MetaData, Table, insert, update, and_

from .duplicate_checker import normalize_column_value

from sqlalchemy.sql.sqltypes import Date

from sqlalchemy.ext.asyncio import AsyncSession

metadata = MetaData()


# ======================================================
# Normalize incoming values
# ======================================================


def clean_empty_values(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:

    cleaned = []

    for record in records:

        new_record = {}

        for key, value in record.items():

            if isinstance(value, str):

                value = value.strip()

                if value == "":
                    value = None

            new_record[key] = value

        cleaned.append(new_record)

    return cleaned


def normalize_date_columns(
    table: Table,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:

    date_columns = {
        column.name for column in table.columns if isinstance(column.type, Date)  # noqa: E501
    }
    cleaned = []

    for record in records:

        row = record.copy()

        for column in date_columns:

            value = row.get(column)

            if value in ("", None):
                row[column] = None

            elif isinstance(value, datetime):
                row[column] = value.date()

            elif isinstance(value, date):
                row[column] = value

            elif isinstance(value, str):

                row[column] = datetime.strptime(
                    value,
                    "%Y-%m-%d",
                ).date()

        cleaned.append(row)

    return cleaned


# ======================================================
# Reflection
# ======================================================


async def reflect_table(
    session: AsyncSession,
    table_name: str,
) -> Table:

    connection = await session.connection()

    return await connection.run_sync(
        lambda sync_connection: Table(
            table_name,
            metadata,
            autoload_with=sync_connection,
        )
    )


# ======================================================
# Filters
# ======================================================


def build_key_filter(
    table: Table,
    record: dict[str, Any],
    duplicate_keys: list[str],
):

    conditions = []

    for key in duplicate_keys:

        if key not in record:
            raise ValueError(f"Duplicate key '{key}' missing")

        conditions.append(table.c[key] == record[key])

    return conditions[0] if len(conditions) == 1 else and_(*conditions)


# ======================================================
# Clean columns
# ======================================================


def clean_record_for_table(
    table: Table,
    record: dict[str, Any],
) -> dict[str, Any]:

    valid_columns = {column.name for column in table.columns}

    return {key: value for key, value in record.items() if key in valid_columns}  # noqa: E501


# ======================================================
# Insert
# ======================================================


async def insert_records(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
) -> int:

    if not records:
        return 0

    table = await reflect_table(
        session,
        table_name,
    )

    cleaned_records = [
        clean_empty_values(
            [
                clean_record_for_table(
                    table,
                    record,
                )
            ]
        )[0]
        for record in records
    ]

    if not cleaned_records:
        return 0

    await session.execute(
        insert(table),
        cleaned_records,
    )

    return len(cleaned_records)


# ======================================================
# Overwrite
# ======================================================


async def discard_duplicates_and_insert_new(
    session: AsyncSession,
    table_name: str,
    new_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    User selected:

        Keep existing database rows
        and discard incoming duplicates.

    Only insert incoming records that are not duplicates.
    """

    try:

        inserted_count = await insert_records(
            session=session,
            table_name=table_name,
            records=new_records,
        )

        await session.commit()

        return {
            "status": "completed",
            "action": "discard_duplicates",
            "table": table_name,
            "inserted": inserted_count,
            "updated": 0,
        }

    except Exception:
        await session.rollback()
        raise


async def overwrite_duplicates_and_insert_new(
    session,
    table_name,
    new_records,
    duplicate_records,
    duplicate_keys,
):

    try:

        updated_count = await overwrite_records(
            session=session,
            table_name=table_name,
            records=duplicate_records,
            duplicate_keys=duplicate_keys,
        )

        inserted_count = await insert_records(
            session=session,
            table_name=table_name,
            records=new_records,
        )

        await session.commit()

        return {
            "status": "completed",
            "action": "overwrite_duplicates",
            "table": table_name,
            "inserted": inserted_count,
            "updated": updated_count,
        }

    except Exception:
        await session.rollback()
        raise


async def overwrite_records(
    session,
    table_name,
    records,
    duplicate_keys,
):

    table = await reflect_table(
        session,
        table_name,
    )

    updated_count = 0

    primary_keys = [column.name for column in table.primary_key.columns]

    for record in records:

        if "incoming_record" in record:
            record = record["incoming_record"]

        cleaned_record = clean_record_for_table(
            table,
            record,
        )

        cleaned_record = clean_empty_values([cleaned_record])[0]

        for key, value in list(cleaned_record.items()):

            if key in table.c:

                cleaned_record[key] = normalize_column_value(
                    table.c[key],
                    value,
                )

        # PK match first
        pk_conditions = []

        for pk in primary_keys:

            if pk in cleaned_record:

                pk_conditions.append(table.c[pk] == cleaned_record[pk])

        if pk_conditions:

            where_clause = and_(*pk_conditions)

        else:

            where_clause = build_key_filter(
                table,
                cleaned_record,
                duplicate_keys,
            )

        update_values = {
            key: value
            for key, value in cleaned_record.items()
            if key not in duplicate_keys
            and key not in primary_keys
            and key != "created_at"  # noqa: E501
        }

        if not update_values:
            continue

        result = await session.execute(
            update(table).where(where_clause).values(**update_values)
        )  # noqa: E501

        updated_count += result.rowcount or 0

    return updated_count


# ======================================================
# Actions
# ======================================================


async def insert_all_records(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
):

    try:

        inserted_count = await insert_records(
            session,
            table_name,
            records,
        )

        await session.commit()

        return {
            "status": "completed",
            "action": "insert",
            "table": table_name,
            "inserted": inserted_count,
            "updated": 0,
        }

    except Exception:

        await session.rollback()
        raise
