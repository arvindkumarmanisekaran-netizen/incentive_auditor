from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import pandas as pd


SUPPORTED_EXTENSIONS = {
    "csv",
    "xlsx",
    "json",
    "xml",
}


def get_extension(
    filename: str,
) -> str:

    return (
        Path(filename)
        .suffix
        .lower()
        .lstrip(".")
    )


def validate_extension(
    filename: str,
) -> str:

    extension = get_extension(
        filename
    )

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported document type: "
            f"{extension or 'unknown'}"
        )

    return extension


def normalize_record(
    record: dict[str, Any],
) -> dict[str, Any]:
    """
    Normalize parser output so downstream
    services receive consistent Python values.
    """

    normalized: dict[
        str,
        Any
    ] = {}

    for key, value in record.items():

        column_name = str(
            key
        ).strip()

        if pd.isna(value):
            normalized[
                column_name
            ] = None
            continue

        # Pandas Timestamp -> ISO date/time

        if isinstance(
            value,
            pd.Timestamp,
        ):

            normalized[
                column_name
            ] = value.isoformat()

            continue

        # Convert numpy scalar values
        # into normal Python values.

        if hasattr(
            value,
            "item",
        ):

            try:
                value = value.item()

            except (
                ValueError,
                AttributeError,
            ):
                pass

        normalized[
            column_name
        ] = value

    return normalized


def parse_csv(
    content: bytes,
) -> list[dict[str, Any]]:

    text = content.decode(
        "utf-8-sig"
    )

    buffer = io.StringIO(
        text
    )

    reader = csv.DictReader(
        buffer
    )

    if not reader.fieldnames:
        raise ValueError(
            "CSV file does not contain "
            "a header row."
        )

    records = [
        normalize_record(
            dict(row)
        )
        for row in reader
    ]

    return records


def parse_xlsx(
    content: bytes,
) -> list[dict[str, Any]]:

    buffer = io.BytesIO(
        content
    )

    dataframe = pd.read_excel(
        buffer,
        engine="openpyxl",
    )

    if dataframe.empty:
        return []

    records = dataframe.to_dict(
        orient="records"
    )

    return [
        normalize_record(
            record
        )
        for record in records
    ]


def parse_json(
    content: bytes,
) -> list[dict[str, Any]]:

    decoded = content.decode(
        "utf-8-sig"
    )

    parsed = json.loads(
        decoded
    )

    # ----------------------------------------
    # JSON array
    #
    # [
    #   {...},
    #   {...}
    # ]
    # ----------------------------------------

    if isinstance(
        parsed,
        list,
    ):

        if not all(
            isinstance(
                item,
                dict,
            )
            for item in parsed
        ):
            raise ValueError(
                "JSON arrays must contain "
                "objects."
            )

        return [
            normalize_record(
                item
            )
            for item in parsed
        ]

    # ----------------------------------------
    # JSON object
    #
    # {
    #   "records": [...]
    # }
    #
    # or
    #
    # {
    #   "sales": [...]
    # }
    # ----------------------------------------

    if isinstance(
        parsed,
        dict,
    ):

        for value in parsed.values():

            if (
                isinstance(
                    value,
                    list,
                )
                and all(
                    isinstance(
                        item,
                        dict,
                    )
                    for item in value
                )
            ):

                return [
                    normalize_record(
                        item
                    )
                    for item in value
                ]

        # Single-record JSON object

        return [
            normalize_record(
                parsed
            )
        ]

    raise ValueError(
        "Unsupported JSON structure."
    )


def xml_element_to_record(
    element: ElementTree.Element,
) -> dict[str, Any]:

    record: dict[
        str,
        Any
    ] = {}

    for child in element:

        # Only handle flat structured XML
        # in the first version.

        if len(child) == 0:

            record[
                child.tag
            ] = (
                child.text.strip()
                if child.text
                else None
            )

    return normalize_record(
        record
    )


def parse_xml(
    content: bytes,
) -> list[dict[str, Any]]:

    try:

        root = ElementTree.fromstring(
            content
        )

    except ElementTree.ParseError as exc:

        raise ValueError(
            f"Invalid XML document: {exc}"
        ) from exc

    records: list[
        dict[str, Any]
    ] = []

    # Typical structure:
    #
    # <sales>
    #   <record>...</record>
    #   <record>...</record>
    # </sales>

    for child in root:

        record = (
            xml_element_to_record(
                child
            )
        )

        if record:
            records.append(
                record
            )

    # If root itself represents
    # one single record.

    if not records:

        record = (
            xml_element_to_record(
                root
            )
        )

        if record:
            records.append(
                record
            )

    return records


def parse_document(
    filename: str,
    content: bytes,
) -> list[dict[str, Any]]:
    """
    Main entry point used by the document
    processing service.
    """

    extension = validate_extension(
        filename
    )

    if not content:
        raise ValueError(
            "Uploaded document is empty."
        )

    if extension == "csv":

        records = parse_csv(
            content
        )

    elif extension == "xlsx":

        records = parse_xlsx(
            content
        )

    elif extension == "json":

        records = parse_json(
            content
        )

    elif extension == "xml":

        records = parse_xml(
            content
        )

    else:

        raise ValueError(
            f"No parser configured for "
            f"{extension}"
        )

    if not records:
        raise ValueError(
            "Document contains no records."
        )

    return records


def extract_source_columns(
    records: list[
        dict[str, Any]
    ],
) -> list[str]:
    """
    Collect every source column present
    in the document.

    Do not rely only on the first row because
    JSON/XML records may have inconsistent keys.
    """

    columns: list[str] = []

    seen: set[str] = set()

    for record in records:

        for column in record.keys():

            if column not in seen:

                seen.add(
                    column
                )

                columns.append(
                    column
                )

    return columns
