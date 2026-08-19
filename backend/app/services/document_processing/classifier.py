from __future__ import annotations

import json

from pathlib import Path
from typing import Any

from .column_mapper import (
    map_columns_for_table,
)

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


REGISTRY_FILE = CONFIG_DIR / "document_registry.json"


COLUMN_ALIAS_FILE = CONFIG_DIR / "column_aliases.json"


# ======================================================
# Configuration loaders
# ======================================================


def load_document_registry() -> dict[str, Any]:
    """
    Load document/table classification configuration.
    """

    if not REGISTRY_FILE.exists():

        raise FileNotFoundError(f"Document registry not found: " f"{REGISTRY_FILE}")  # noqa: E501

    with REGISTRY_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


def load_column_aliases() -> dict[str, Any]:
    """
    Load column alias configuration.
    """

    if not COLUMN_ALIAS_FILE.exists():

        raise FileNotFoundError(
            f"Column alias file not found: " f"{COLUMN_ALIAS_FILE}"
        )  # noqa: E501

    with COLUMN_ALIAS_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


# ======================================================
# Scoring helpers
# ======================================================


def calculate_required_match_score(
    mapped_columns: set[str],
    required_columns: list[str],
) -> float:
    """
    Calculate required column coverage.
    """

    if not required_columns:
        return 0.0

    required = set(required_columns)

    matched = mapped_columns & required

    return len(matched) / len(required)


def calculate_optional_match_score(
    mapped_columns: set[str],
    optional_columns: list[str],
) -> float:
    """
    Calculate optional column coverage.
    """

    if not optional_columns:
        return 0.0

    optional = set(optional_columns)

    matched = mapped_columns & optional

    return len(matched) / len(optional)


def get_table_aliases(
    table_name: str,
    column_aliases: dict[str, Any],
) -> dict[str, list[str]]:
    """
    Extract aliases for a table.

    Example:

    {
        "doctors": {
            "doctor_id": [
                "doctor id",
                "dr code"
            ]
        }
    }
    """

    return column_aliases.get(
        table_name,
        {},
    )


# ======================================================
# Main classifier
# ======================================================


def classify_document(
    source_columns: list[str],
) -> dict[str, Any]:
    """
    Identify uploaded document type.

    Flow:

    Uploaded columns
          |
          v
    column_aliases.json
          |
          v
    canonical columns
          |
          v
    document_registry.json
          |
          v
    confidence scoring
    """

    registry = load_document_registry()

    candidates: list[dict[str, Any]] = []

    for (
        document_type,
        config,
    ) in registry.items():

        table_name = config["table"]

        required_columns = config.get(
            "required_columns",
            [],
        )

        optional_columns = config.get(
            "optional_columns",
            [],
        )

        try:
            mapping_result = map_columns_for_table(
                table_name=table_name,
                source_columns=source_columns,
            )
        except Exception as exc:
            print(
                f"Column mapping failed for table '{table_name}': {type(exc).__name__}: {exc}"  # noqa: E501
            )
            continue

        mapped_columns = set(mapping_result["mapped_target_columns"])

        required_score = calculate_required_match_score(
            mapped_columns,
            required_columns,
        )

        optional_score = calculate_optional_match_score(
            mapped_columns,
            optional_columns,
        )

        alias_confidence = mapping_result.get(
            "average_confidence",
            0,
        )

        total_score = (
            required_score * 0.70 + optional_score * 0.10 + alias_confidence * 0.20  # noqa: E501
        )

        missing_required = [
            column for column in required_columns if column not in mapped_columns  # noqa: E501
        ]

        candidates.append(
            {
                "document_type": document_type,
                "table": table_name,
                "confidence": round(
                    total_score,
                    3,
                ),
                "required_match_score": round(
                    required_score,
                    3,
                ),
                "optional_match_score": round(
                    optional_score,
                    3,
                ),
                "alias_confidence": round(
                    alias_confidence,
                    3,
                ),
                "mapping": mapping_result,
                "missing_required_columns": missing_required,
            }
        )

    candidates.sort(
        key=lambda item: item["confidence"],
        reverse=True,
    )

    if not candidates:

        return {
            "identified": False,
            "status": "unidentified",
            "reason": ("No configured table matched " "uploaded columns."),
            "candidates": [],
        }

    best = candidates[0]

    second = candidates[1] if len(candidates) > 1 else None

    # ------------------------------------------
    # Confidence threshold
    # ------------------------------------------

    if best["confidence"] < 0.70:

        return {
            "identified": False,
            "status": "low_confidence",
            "reason": ("Confidence score below " "required threshold."),
            "candidates": candidates[:3],
        }

    # ------------------------------------------
    # Required columns validation
    # ------------------------------------------

    if best["required_match_score"] < 0.75:

        return {
            "identified": False,
            "status": "missing_required_columns",
            "reason": ("Required columns missing " "for detected document."),
            "candidate": best,
            "candidates": candidates[:3],
        }

    # ------------------------------------------
    # Ambiguity check
    # ------------------------------------------

    if second:

        difference = best["confidence"] - second["confidence"]

        if difference < 0.08:

            return {
                "identified": False,
                "status": "ambiguous",
                "reason": ("Multiple document types " "have similar confidence."),  # noqa: E501
                "candidates": candidates[:3],
            }

    return {
        "identified": True,
        "status": "identified",
        "document_type": best["document_type"],
        "table": best["table"],
        "confidence": best["confidence"],
        "mapping": best["mapping"],
        "missing_required_columns": best["missing_required_columns"],
        "candidates": candidates[:3],
    }
