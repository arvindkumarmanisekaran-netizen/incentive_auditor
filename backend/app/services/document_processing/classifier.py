from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .column_mapper import (
    map_columns_for_table,
)


CONFIG_DIR = (
    Path(__file__).resolve().parents[2]
    / "config"
)

REGISTRY_FILE = (
    CONFIG_DIR
    / "document_registry.json"
)


def load_document_registry() -> dict[str, Any]:
    """
    Load document/table classification configuration.
    """

    if not REGISTRY_FILE.exists():
        raise FileNotFoundError(
            f"Document registry not found: "
            f"{REGISTRY_FILE}"
        )

    with REGISTRY_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def calculate_required_match_score(
    mapped_columns: set[str],
    required_columns: list[str],
) -> float:
    """
    Calculate how many required columns
    are present after alias mapping.
    """

    if not required_columns:
        return 0.0

    required_set = set(
        required_columns
    )

    matched = (
        mapped_columns
        & required_set
    )

    return (
        len(matched)
        / len(required_set)
    )


def calculate_optional_match_score(
    mapped_columns: set[str],
    optional_columns: list[str],
) -> float:
    """
    Calculate optional-column match score.
    """

    if not optional_columns:
        return 0.0

    optional_set = set(
        optional_columns
    )

    matched = (
        mapped_columns
        & optional_set
    )

    return (
        len(matched)
        / len(optional_set)
    )


def classify_document(
    source_columns: list[str],
) -> dict[str, Any]:
    """
    Identify the most likely target database table.

    The classifier:
    1. Tries source columns against every table's aliases.
    2. Calculates required-column coverage.
    3. Calculates optional-column coverage.
    4. Includes alias mapping confidence.
    5. Selects the strongest candidate.
    """

    registry = load_document_registry()

    candidates: list[
        dict[str, Any]
    ] = []

    for (
        document_type,
        config,
    ) in registry.items():

        table_name = config[
            "table"
        ]

        required_columns = config.get(
            "required_columns",
            [],
        )

        optional_columns = config.get(
            "optional_columns",
            [],
        )

        try:
            mapping_result = (
                map_columns_for_table(
                    table_name,
                    source_columns,
                )
            )

        except ValueError:
            # No alias configuration for
            # this table.
            continue

        mapped_columns = set(
            mapping_result[
                "mapped_target_columns"
            ]
        )

        required_score = (
            calculate_required_match_score(
                mapped_columns,
                required_columns,
            )
        )

        optional_score = (
            calculate_optional_match_score(
                mapped_columns,
                optional_columns,
            )
        )

        alias_confidence = (
            mapping_result[
                "average_confidence"
            ]
        )

        # ------------------------------------------
        # Classification weighting
        #
        # Required columns are the strongest signal.
        # Optional columns help disambiguate.
        # Alias confidence helps avoid weak fuzzy hits.
        # ------------------------------------------

        total_score = (
            required_score * 0.70
            +
            optional_score * 0.10
            +
            alias_confidence * 0.20
        )

        missing_required = [
            column
            for column
            in required_columns
            if column
            not in mapped_columns
        ]

        candidates.append(
            {
                "document_type":
                    document_type,

                "table":
                    table_name,

                "confidence":
                    round(
                        total_score,
                        3,
                    ),

                "required_match_score":
                    round(
                        required_score,
                        3,
                    ),

                "optional_match_score":
                    round(
                        optional_score,
                        3,
                    ),

                "alias_confidence":
                    alias_confidence,

                "mapping":
                    mapping_result,

                "missing_required_columns":
                    missing_required,
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

            "status":
                "unidentified",

            "reason":
                (
                    "No configured database table "
                    "matched the uploaded columns."
                ),

            "candidates":
                [],
        }

    best = candidates[0]

    second = (
        candidates[1]
        if len(candidates) > 1
        else None
    )

    # ----------------------------------------------
    # Minimum confidence
    # ----------------------------------------------

    if best["confidence"] < 0.70:

        return {
            "identified":
                False,

            "status":
                "low_confidence",

            "reason":
                (
                    "Unable to identify the target "
                    "table with sufficient confidence."
                ),

            "candidates":
                candidates[:3],
        }

    # ----------------------------------------------
    # Required columns must mostly match
    # ----------------------------------------------

    if (
        best["required_match_score"]
        < 0.75
    ):

        return {
            "identified":
                False,

            "status":
                "missing_required_columns",

            "reason":
                (
                    "The best matching table is "
                    "missing too many required columns."
                ),

            "candidate":
                best,

            "candidates":
                candidates[:3],
        }

    # ----------------------------------------------
    # Detect ambiguity
    # ----------------------------------------------

    if second is not None:

        score_difference = (
            best["confidence"]
            -
            second["confidence"]
        )

        if score_difference < 0.08:

            return {
                "identified":
                    False,

                "status":
                    "ambiguous",

                "reason":
                    (
                        "The document matches more "
                        "than one database table."
                    ),

                "candidates":
                    candidates[:3],
            }

    return {
        "identified":
            True,

        "status":
            "identified",

        "document_type":
            best[
                "document_type"
            ],

        "table":
            best[
                "table"
            ],

        "confidence":
            best[
                "confidence"
            ],

        "mapping":
            best[
                "mapping"
            ],

        "missing_required_columns":
            best[
                "missing_required_columns"
            ],

        "candidates":
            candidates[:3],
    }
