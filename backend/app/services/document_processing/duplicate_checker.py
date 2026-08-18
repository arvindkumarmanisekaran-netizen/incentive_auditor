
from __future__ import annotations

from typing import Any

from sqlalchemy import (
    MetaData,
    Table,
    and_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession


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


def build_duplicate_filter(
    table: Table,
    record: dict[str, Any],
    duplicate_keys: list[str],
):
    """
    Build SQLAlchemy WHERE conditions for
    one record using configured duplicate keys.
    """

    conditions = []

    for key in duplicate_keys:

        if key not in record:
            raise ValueError(
                f"Duplicate key '{key}' "
                f"is missing from record."
            )

        value = record[key]

        conditions.append(
            table.c[key] == value
        )

    return and_(
        *conditions
    )


def serialize_row(
    row: Any,
) -> dict[str, Any]:
    """
    Convert SQLAlchemy RowMapping values into
    JSON-friendly dictionaries.
    """

    if row is None:
        return {}

    return dict(
        row._mapping
    )


async def check_duplicates(
    session: AsyncSession,
    table_name: str,
    records: list[dict[str, Any]],
    duplicate_keys: list[str],
) -> dict[str, Any]:
    """
    Separate incoming records into:

    - new_records
    - duplicate_records

    A duplicate is determined using the
    configured duplicate_keys for the table.
    """

    if not duplicate_keys:
        raise ValueError(
            f"No duplicate keys configured "
            f"for table '{table_name}'."
        )

    table = await reflect_table(
        session,
        table_name,
    )

    new_records: list[
        dict[str, Any]
    ] = []

    duplicate_records: list[
        dict[str, Any]
    ] = []

    for index, record in enumerate(
        records,
        start=1,
    ):

        where_clause = (
            build_duplicate_filter(
                table=table,
                record=record,
                duplicate_keys=duplicate_keys,
            )
        )

        query = (
            select(table)
            .where(where_clause)
            .limit(1)
        )

        result = await session.execute(
            query
        )

        existing_row = (
            result.first()
        )

        if existing_row is None:

            new_records.append(
                {
                    "row":
                        index,

                    "incoming_record":
                        record,
                }
            )

            continue

        duplicate_records.append(
            {
                "row":
                    index,

                "duplicate_keys":
                    {
                        key:
                            record.get(key)
                        for key
                        in duplicate_keys
                    },

                "existing_record":
                    serialize_row(
                        existing_row
                    ),

                "incoming_record":
                    record,
            }
        )

    return {
        "table":
            table_name,

        "total_records":
            len(records),

        "new_record_count":
            len(new_records),

        "duplicate_record_count":
            len(
                duplicate_records
            ),

        "has_duplicates":
            bool(
                duplicate_records
            ),

        "new_records":
            new_records,

        "duplicate_records":
            duplicate_records,
    }
