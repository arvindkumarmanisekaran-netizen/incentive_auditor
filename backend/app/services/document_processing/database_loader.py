
from __future__ import annotations

from typing import Any

from sqlalchemy import (
    MetaData,
    Table,
    insert,
    update,
)

from sqlalchemy.ext.asyncio import AsyncSession


metadata = MetaData()


async def reflect_table(
    session: AsyncSession,
    table_name: str,
) -> Table:
    """
    Reflect an existing PostgreSQL table.
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


def build_key_filter(
    table: Table,
    record: dict[str, Any],
    duplicate_keys: list[str],
):
    """
    Build a WHERE clause using the configured
    duplicate keys.
    """

    conditions = []

    for key in duplicate_keys:

        if key not in record:
            raise ValueError(
                f"Duplicate key '{key}' "
                f"is missing from record."
            )

        conditions.append(
            table.c[key] == record[key]
        )

    if len(conditions) == 1:
        return conditions[0]

    from sqlalchemy import and_

    return and_(*conditions)


def clean_record_for_table(
    table: Table,
    record: dict[str, Any],
) -> dict[str, Any]:
    """
    Remove incoming fields that do not exist
    in the database table.

    This also prevents user-controlled column
    names from reaching SQLAlchemy inserts.
    """

    valid_columns = {
        column.name
        for column in table.columns
    }

    return {
        key: value
        for key, value in record.items()
        if key in valid_columns
    }


async def insert_records(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
) -> int:
    """
    Insert records that have already been
    validated and confirmed as new.
    """

    if not records:
        return 0

    table = await reflect_table(
        session,
        table_name,
    )

    cleaned_records = [
        clean_record_for_table(
            table,
            record,
        )
        for record in records
    ]

    await session.execute(
        insert(table),
        cleaned_records,
    )

    return len(cleaned_records)


async def overwrite_records(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
    duplicate_keys: list[str],
) -> int:
    """
    Update existing rows using configured
    duplicate keys.

    This is safer than DELETE + INSERT because
    foreign keys may reference the existing row.
    """

    if not records:
        return 0

    table = await reflect_table(
        session,
        table_name,
    )

    updated_count = 0

    for record in records:

        cleaned_record = (
            clean_record_for_table(
                table,
                record,
            )
        )

        where_clause = build_key_filter(
            table=table,
            record=cleaned_record,
            duplicate_keys=duplicate_keys,
        )

        update_values = {
            key: value
            for key, value
            in cleaned_record.items()
            if key not in duplicate_keys
            and key not in {
                "created_at",
            }
        }

        if not update_values:
            continue

        statement = (
            update(table)
            .where(where_clause)
            .values(**update_values)
        )

        result = await session.execute(
            statement
        )

        updated_count += (
            result.rowcount or 0
        )

    return updated_count


async def discard_duplicates_and_insert_new(
    session: AsyncSession,
    table_name: str,
    new_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    User selected:

        Keep existing database rows
        and discard incoming duplicates.

    Only new incoming records are inserted.
    """

    inserted_count = await insert_records(
        session=session,
        table_name=table_name,
        records=new_records,
    )

    await session.commit()

    return {
        "status":
            "completed",

        "action":
            "discard_duplicates",

        "table":
            table_name,

        "inserted":
            inserted_count,

        "updated":
            0,
    }


async def overwrite_duplicates_and_insert_new(
    session: AsyncSession,
    table_name: str,
    new_records: list[dict[str, Any]],
    duplicate_records: list[dict[str, Any]],
    duplicate_keys: list[str],
) -> dict[str, Any]:
    """
    User selected:

        Overwrite incoming duplicate rows
        and insert new rows.

    Everything runs in one transaction.
    """

    try:

        inserted_count = (
            await insert_records(
                session=session,
                table_name=table_name,
                records=new_records,
            )
        )

        updated_count = (
            await overwrite_records(
                session=session,
                table_name=table_name,
                records=duplicate_records,
                duplicate_keys=duplicate_keys,
            )
        )

        await session.commit()

        return {
            "status":
                "completed",

            "action":
                "overwrite_duplicates",

            "table":
                table_name,

            "inserted":
                inserted_count,

            "updated":
                updated_count,
        }

    except Exception:

        await session.rollback()

        raise


async def insert_all_records(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Used when the uploaded data contains
    no duplicates.
    """

    try:

        inserted_count = (
            await insert_records(
                session=session,
                table_name=table_name,
                records=records,
            )
        )

        await session.commit()

        return {
            "status":
                "completed",

            "action":
                "insert",

            "table":
                table_name,

            "inserted":
                inserted_count,

            "updated":
                0,
        }

    except Exception:

        await session.rollback()

        raise
