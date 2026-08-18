from __future__ import annotations

import random

SEED = 42
random.seed(SEED)


def build_schema_variation(
    table_aliases: dict,
    columns: list[str],
):

    mapping = {}

    for column in columns:

        aliases = table_aliases.get(
            column,
            [],
        )

        if aliases:

            mapping[column] = random.choice(aliases)

        else:

            mapping[column] = column

    return mapping


def apply_schema_variation(
    records: list[dict],
    table_aliases: dict,
):

    if not records:
        return []

    schema = build_schema_variation(
        table_aliases,
        list(records[0].keys()),
    )

    varied_records = []

    for record in records:

        varied = {}

        for column, value in record.items():

            varied[schema[column]] = value

        varied_records.append(varied)

    return varied_records


def generate_alias_documents(
    data: dict,
    custom_aliases: dict,
):

    documents = {}

    formats = [
        "csv",
        "xlsx",
        "json",
        "docx",
    ]

    for table, records in data.items():

        table_aliases = custom_aliases.get(
            table,
            {},
        )

        for extension in formats:

            # generate a fresh schema variation
            varied = apply_schema_variation(
                records,
                table_aliases,
            )

            documents[f"{table}.{extension}"] = varied

    return documents
