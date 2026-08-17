from __future__ import annotations

import json
import re
from pathlib import Path
from difflib import SequenceMatcher
from typing import Any


CONFIG_DIR = (
    Path(__file__).resolve().parents[1]
    / "config"
)

ALIAS_FILE = (
    CONFIG_DIR
    / "column_aliases.json"
)


def normalize_column_name(
    value: str,
) -> str:

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


def load_aliases() -> dict[str, Any]:

    with open(
        ALIAS_FILE,
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


def similarity(
    left: str,
    right: str,
) -> float:

    return SequenceMatcher(
        None,
        normalize_column_name(left),
        normalize_column_name(right),
    ).ratio()


def map_columns(
    table_name: str,
    source_columns: list[str],
) -> dict[str, Any]:

    aliases = load_aliases()

    if table_name not in aliases:
        raise ValueError(
            f"No alias configuration found "
            f"for table '{table_name}'"
        )

    table_aliases = aliases[
        table_name
    ]

    mappings: dict[str, dict[str, Any]] = {}
    unmapped: list[str] = []

    used_targets: set[str] = set()

    for source_column in source_columns:

        normalized_source = (
            normalize_column_name(
                source_column
            )
        )

        best_target = None
        best_confidence = 0.0
        best_method = None

        for target_column, names in (
            table_aliases.items()
        ):

            if target_column in used_targets:
                continue

            candidates = [
                target_column,
                *names,
            ]

            # Exact canonical match

            if (
                normalized_source
                ==
                normalize_column_name(
                    target_column
                )
            ):

                best_target = target_column
                best_confidence = 1.0
                best_method = "canonical"

                break

            # Exact alias match

            exact_alias = any(
                normalized_source
                ==
                normalize_column_name(
                    candidate
                )
                for candidate in candidates
            )

            if exact_alias:

                best_target = target_column
                best_confidence = 0.95
                best_method = "alias"

                break

            # Fuzzy matching

            for candidate in candidates:

                score = similarity(
                    source_column,
                    candidate,
                )

                if score > best_confidence:

                    best_target = (
                        target_column
                    )

                    best_confidence = (
                        score
                    )

                    best_method = (
                        "fuzzy"
                    )

        if (
            best_target
            and best_confidence >= 0.75
        ):

            mappings[source_column] = {
                "target_column":
                    best_target,

                "confidence":
                    round(
                        best_confidence,
                        3,
                    ),

                "method":
                    best_method,
            }

            used_targets.add(
                best_target
            )

        else:

            unmapped.append(
                source_column
            )

    requires_confirmation = any(
        mapping["confidence"] < 0.90
        for mapping
        in mappings.values()
    )

    return {
        "table":
            table_name,

        "mappings":
            mappings,

        "unmapped":
            unmapped,

        "requires_confirmation":
            requires_confirmation,
    }


def apply_column_mapping(
    records: list[dict[str, Any]],
    mapping_result: dict[str, Any],
) -> list[dict[str, Any]]:

    mapped_records = []

    mappings = mapping_result[
        "mappings"
    ]

    for record in records:

        mapped_record = {}

        for source_column, value in (
            record.items()
        ):

            mapping = mappings.get(
                source_column
            )

            if not mapping:
                continue

            target_column = mapping[
                "target_column"
            ]

            mapped_record[
                target_column
            ] = value

        mapped_records.append(
            mapped_record
        )

    return mapped_records