from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.app.services.column_mapper import (
    normalize_column_name,
)


CONFIG_DIR = (
    Path(__file__).resolve().parents[1]
    / "config"
)

REGISTRY_FILE = (
    CONFIG_DIR
    / "document_registry.json"
)


def load_registry() -> dict[str, Any]:

    with open(
        REGISTRY_FILE,
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


def calculate_match_score(
    source_columns: list[str],
    required_columns: list[str],
    optional_columns: list[str] | None = None,
) -> float:

    optional_columns = (
        optional_columns
        or []
    )

    source_set = {
        normalize_column_name(column)
        for column in source_columns
    }

    required_set = {
        normalize_column_name(column)
        for column in required_columns
    }

    optional_set = {
        normalize_column_name(column)
        for column in optional_columns
    }

    if not required_set:
        return 0.0

    required_matches = len(
        source_set
        & required_set
    )

    optional_matches = len(
        source_set
        & optional_set
    )

    required_score = (
        required_matches
        / len(required_set)
    )

    optional_score = 0.0

    if optional_set:

        optional_score = (
            optional_matches
            / len(optional_set)
        )

    return round(
        (
            required_score * 0.90
        )
        +
        (
            optional_score * 0.10
        ),
        3,
    )


def identify_document_type(
    mapped_columns: list[str],
) -> dict[str, Any]:

    registry = load_registry()

    candidates = []

    for document_type, config in (
        registry.items()
    ):

        required_columns = config.get(
            "required_columns",
            [],
        )

        optional_columns = config.get(
            "optional_columns",
            [],
        )

        score = calculate_match_score(
            source_columns=mapped_columns,
            required_columns=required_columns,
            optional_columns=optional_columns,
        )

        candidates.append(
            {
                "document_type":
                    document_type,

                "table":
                    config["table"],

                "confidence":
                    score,
            }
        )

    candidates.sort(
        key=lambda item:
            item["confidence"],
        reverse=True,
    )

    if not candidates:

        return {
            "identified":
                False,

            "reason":
                "No document definitions configured",

            "candidates":
                [],
        }

    best_match = candidates[0]

    if best_match["confidence"] < 0.70:

        return {
            "identified":
                False,

            "reason":
                "Unable to identify target table with sufficient confidence",

            "candidates":
                candidates[:3],
        }

    second_best = (
        candidates[1]
        if len(candidates) > 1
        else None
    )

    ambiguous = (
        second_best is not None
        and
        abs(
            best_match["confidence"]
            -
            second_best["confidence"]
        ) < 0.10
    )

    if ambiguous:

        return {
            "identified":
                False,

            "reason":
                "Document matches multiple tables",

            "candidates":
                candidates[:3],
        }

    return {
        "identified":
            True,

        "document_type":
            best_match[
                "document_type"
            ],

        "table":
            best_match["table"],

        "confidence":
            best_match[
                "confidence"
            ],

        "candidates":
            candidates[:3],
    }
