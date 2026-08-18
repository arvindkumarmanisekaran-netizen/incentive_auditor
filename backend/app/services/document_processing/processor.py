from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .classifier import (
    classify_document,
    load_document_registry,
)
from .column_mapper import (
    apply_column_mapping,
)
from .duplicate_checker import (
    check_duplicates,
)
from .parser import (
    extract_source_columns,
    parse_document,
)
from .validator import (
    validate_records,
)


def get_document_config(
    document_type: str,
) -> dict[str, Any]:
    """
    Return registry configuration for the
    classified document type.
    """

    registry = load_document_registry()

    config = registry.get(
        document_type
    )

    if config is None:
        raise ValueError(
            f"No document registry configuration "
            f"found for '{document_type}'."
        )

    return config


def extract_incoming_records(
    duplicate_result: dict[str, Any],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """
    Extract the actual canonical records from
    duplicate-checker output.

    Returns:

        new_records
        duplicate_records
    """

    new_records = [
        item["incoming_record"]
        for item
        in duplicate_result.get(
            "new_records",
            [],
        )
    ]

    duplicate_records = [
        item["incoming_record"]
        for item
        in duplicate_result.get(
            "duplicate_records",
            [],
        )
    ]

    return (
        new_records,
        duplicate_records,
    )


async def process_document(
    *,
    session: AsyncSession,
    filename: str,
    content: bytes,
) -> dict[str, Any]:
    """
    Process one uploaded document.

    Pipeline:

        parse
          ↓
        classify
          ↓
        map columns
          ↓
        validate
          ↓
        check duplicates
          ↓
        return preview

    IMPORTANT:
    This function NEVER inserts, updates,
    or deletes database records.
    """

    # -------------------------------------------------
    # STEP 1
    # Parse the uploaded file
    # -------------------------------------------------

    try:

        source_records = parse_document(
            filename=filename,
            content=content,
        )

    except Exception as exc:

        return {
            "filename":
                filename,

            "status":
                "parse_failed",

            "success":
                False,

            "action_required":
                False,

            "error":
                str(exc),
        }

    # -------------------------------------------------
    # STEP 2
    # Extract uploaded column names
    # -------------------------------------------------

    source_columns = (
        extract_source_columns(
            source_records
        )
    )

    # -------------------------------------------------
    # STEP 3
    # Classify document
    # -------------------------------------------------

    try:

        classification = (
            classify_document(
                source_columns
            )
        )

    except Exception as exc:

        return {
            "filename":
                filename,

            "status":
                "classification_failed",

            "success":
                False,

            "action_required":
                False,

            "source_columns":
                source_columns,

            "error":
                str(exc),
        }

    if not classification.get(
        "identified",
        False,
    ):

        return {
            "filename":
                filename,

            "status":
                classification.get(
                    "status",
                    "unidentified",
                ),

            "success":
                False,

            "action_required":
                False,

            "source_columns":
                source_columns,

            "classification":
                classification,
        }

    document_type = classification[
        "document_type"
    ]

    table_name = classification[
        "table"
    ]

    # -------------------------------------------------
    # STEP 4
    # Load registry configuration
    # -------------------------------------------------

    document_config = (
        get_document_config(
            document_type
        )
    )

    required_columns = (
        document_config.get(
            "required_columns",
            [],
        )
    )

    duplicate_keys = (
        document_config.get(
            "duplicate_keys",
            [],
        )
    )

    # -------------------------------------------------
    # STEP 5
    # Convert uploaded columns into canonical
    # database column names.
    # -------------------------------------------------

    canonical_records = (
        apply_column_mapping(
            source_records,
            classification[
                "mapping"
            ],
        )
    )

    # -------------------------------------------------
    # STEP 6
    # Validate canonical records
    # -------------------------------------------------

    validation = validate_records(
        table_name=table_name,
        records=canonical_records,
        required_columns=required_columns,
    )

    if not validation[
        "valid"
    ]:

        return {
            "filename":
                filename,

            "status":
                "validation_failed",

            "success":
                False,

            "action_required":
                False,

            "document_type":
                document_type,

            "target_table":
                table_name,

            "classification_confidence":
                classification[
                    "confidence"
                ],

            "source_columns":
                source_columns,

            "column_mapping":
                classification[
                    "mapping"
                ],

            "validation":
                validation,
        }

    # -------------------------------------------------
    # STEP 7
    # Check database duplicates
    # -------------------------------------------------

    try:

        duplicate_result = (
            await check_duplicates(
                session=session,
                table_name=table_name,
                records=canonical_records,
                duplicate_keys=duplicate_keys,
            )
        )

    except Exception as exc:

        return {
            "filename":
                filename,

            "status":
                "duplicate_check_failed",

            "success":
                False,

            "action_required":
                False,

            "document_type":
                document_type,

            "target_table":
                table_name,

            "error":
                str(exc),
        }

    (
        new_records,
        duplicate_records,
    ) = extract_incoming_records(
        duplicate_result
    )

    duplicate_count = (
        duplicate_result[
            "duplicate_record_count"
        ]
    )

    new_count = (
        duplicate_result[
            "new_record_count"
        ]
    )

    # -------------------------------------------------
    # STEP 8
    # Determine what the frontend needs to do
    # -------------------------------------------------

    if duplicate_count > 0:

        status = (
            "duplicates_found"
        )

        action_required = True

        available_actions = [
            "overwrite_duplicates",
            "discard_duplicates",
            "cancel",
        ]

    else:

        status = "ready"

        action_required = True

        available_actions = [
            "insert",
            "cancel",
        ]

    # -------------------------------------------------
    # STEP 9
    # Return preview
    #
    # No database modification has occurred.
    # -------------------------------------------------

    return {
        "filename":
            filename,

        "success":
            True,

        "status":
            status,

        "document_type":
            document_type,

        "target_table":
            table_name,

        "classification_confidence":
            classification[
                "confidence"
            ],

        "source_columns":
            source_columns,

        "column_mapping":
            classification[
                "mapping"
            ],

        "validation":
            validation,

        "total_records":
            len(canonical_records),

        "new_record_count":
            new_count,

        "duplicate_record_count":
            duplicate_count,

        "has_duplicates":
            duplicate_count > 0,

        "action_required":
            action_required,

        "available_actions":
            available_actions,

        # These are needed by the confirmation
        # endpoint in the first implementation.
        #
        # The confirmation endpoint MUST validate
        # them again before writing to PostgreSQL.

        "pending_data":
            {
                "duplicate_keys":
                    duplicate_keys,

                "new_records":
                    new_records,

                "duplicate_records":
                    duplicate_records,
            },

        # Useful for showing the user what already
        # exists without exposing every row.

        "duplicate_preview":
            duplicate_result.get(
                "duplicate_records",
                [],
            )[:20],
    }
