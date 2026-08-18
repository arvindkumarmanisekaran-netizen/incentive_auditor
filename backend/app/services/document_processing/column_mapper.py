from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


CONFIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "config"
)

ALIASES_FILE = (
    CONFIG_DIR
    / "column_aliases.json"
)


def normalize_column_name(
    value: str,
) -> str:
    """
    Normalize source and alias column names
    before comparison.
    """

    value = value.strip().lower()

    value = re.sub(
        r"[_\-]+",
        " ",
        value,
    )

    value = re.sub(
        r"[^a-z0-9 ]+",
        "",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value.strip()


def load_column_aliases() -> dict[str, Any]:
    """
    Load column alias configuration.
    """

    if not ALIASES_FILE.exists():
        raise FileNotFoundError(
            f"Column alias configuration "
            f"not found: {ALIASES_FILE}"
        )

    with ALIASES_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def similarity(
    left: str,
    right: str,
) -> float:
    """
    Return a similarity score between 0 and 1.
    """

    return SequenceMatcher(
        None,
        normalize_column_name(left),
        normalize_column_name(right),
    ).ratio()


def find_best_mapping(
    source_column: str,
    table_aliases: dict[str, list[str]],
) -> dict[str, Any] | None:
    """
    Find the most likely canonical database column
    for one source column.
    """

    normalized_source = normalize_column_name(
        source_column
    )

    best_target: str | None = None
    best_score = 0.0
    best_method: str | None = None

    for target_column, aliases in table_aliases.items():

        normalized_target = normalize_column_name(
            target_column
        )

        # ------------------------------------------
        # Exact canonical match
        # ------------------------------------------

        if normalized_source == normalized_target:
            return {
                "target_column":
                    target_column,

                "confidence":
                    1.0,

                "method":
                    "canonical",
            }

        # ------------------------------------------
        # Exact alias match
        # ------------------------------------------

        for alias in aliases:

            if (
                normalized_source
                == normalize_column_name(alias)
            ):
                return {
                    "target_column":
                        target_column,

                    "confidence":
                        0.95,

                    "method":
                        "alias",
                }

        # ------------------------------------------
        # Fuzzy match
        # ------------------------------------------

        candidates = [
            target_column,
            *aliases,
        ]

        for candidate in candidates:

            score = similarity(
                source_column,
                candidate,
            )

            if score > best_score:
                best_score = score
                best_target = target_column
                best_method = "fuzzy"

    if (
        best_target is None
        or best_score < 0.75
    ):
        return None

    return {
        "target_column":
            best_target,

        "confidence":
            round(best_score, 3),

        "method":
            best_method,
    }


def map_columns_for_table(
    table_name: str,
    source_columns: list[str],
) -> dict[str, Any]:
    """
    Map source columns against aliases for
    one target table.
    """

    aliases = load_column_aliases()

    table_aliases = aliases.get(
        table_name
    )

    if table_aliases is None:
        raise ValueError(
            f"No column aliases configured "
            f"for table '{table_name}'"
        )

    mappings: dict[str, dict[str, Any]] = {}

    unmapped_columns: list[str] = []

    used_target_columns: set[str] = set()

    for source_column in source_columns:

        mapping = find_best_mapping(
            source_column,
            table_aliases,
        )

        if mapping is None:
            unmapped_columns.append(
                source_column
            )
            continue

        target_column = mapping[
            "target_column"
        ]

        # Prevent two source columns from
        # automatically mapping to the same
        # target column.

        if target_column in used_target_columns:
            unmapped_columns.append(
                source_column
            )
            continue

        mappings[source_column] = mapping

        used_target_columns.add(
            target_column
        )

    mapped_target_columns = [
        mapping["target_column"]
        for mapping in mappings.values()
    ]

    average_confidence = 0.0

    if mappings:
        average_confidence = (
            sum(
                mapping["confidence"]
                for mapping
                in mappings.values()
            )
            / len(mappings)
        )

    requires_confirmation = (
        bool(unmapped_columns)
        or any(
            mapping["confidence"] < 0.90
            for mapping
            in mappings.values()
        )
    )

    return {
        "table":
            table_name,

        "mappings":
            mappings,

        "mapped_target_columns":
            mapped_target_columns,

        "unmapped_columns":
            unmapped_columns,

        "average_confidence":
            round(
                average_confidence,
                3,
            ),

        "requires_confirmation":
            requires_confirmation,
    }


def apply_column_mapping(
    records: list[dict[str, Any]],
    mapping_result: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Convert source records into canonical
    database-column records.
    """

    mappings = mapping_result[
        "mappings"
    ]

    canonical_records: list[
        dict[str, Any]
    ] = []

    for record in records:

        canonical_record: dict[
            str,
            Any
        ] = {}

        for (
            source_column,
            value,
        ) in record.items():

            mapping = mappings.get(
                source_column
            )

            if mapping is None:
                continue

            target_column = mapping[
                "target_column"
            ]

            canonical_record[
                target_column
            ] = value

        canonical_records.append(
            canonical_record
        )

    return canonical_records
