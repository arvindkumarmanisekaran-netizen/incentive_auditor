from __future__ import annotations

from typing import Any, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.database_loader import (
    discard_duplicates_and_insert_new,
    insert_all_records,
    overwrite_duplicates_and_insert_new,
)
from ..services.document_processing.processor import (
    process_document,
)
from ..services.document_processing.validator import (
    validate_records,
)
from ..services.document_processing.classifier import (
    load_document_registry,
)
from ..services.document_processing.duplicate_checker import (
    check_duplicates,
)


router = APIRouter(
    prefix="/document-processing",
    tags=["document-processing"],
)


SUPPORTED_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".json",
    ".xml",
}


class PendingData(BaseModel):
    duplicate_keys: list[str]
    new_records: list[dict[str, Any]]
    duplicate_records: list[dict[str, Any]]


class ConfirmDocumentRequest(BaseModel):
    document_type: str
    target_table: str

    action: Literal[
        "insert",
        "overwrite_duplicates",
        "discard_duplicates",
        "cancel",
    ]

    pending_data: PendingData


def get_file_extension(
    filename: str,
) -> str:

    filename = filename.lower().strip()

    for extension in SUPPORTED_EXTENSIONS:

        if filename.endswith(extension):
            return extension

    return ""


@router.post("/upload")
async def upload_document(
    document: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Upload and analyze one structured document.

    Supported:
        CSV
        XLSX
        JSON
        XML

    IMPORTANT:
    This endpoint performs no database writes.
    """

    filename = (
        document.filename
        or "uploaded_document"
    )

    extension = get_file_extension(
        filename
    )

    if extension not in SUPPORTED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported document type. "
                "Supported formats are "
                "CSV, XLSX, JSON, and XML."
            ),
        )

    try:

        content = await document.read()

        if not content:

            raise HTTPException(
                status_code=400,
                detail="Uploaded document is empty.",
            )

        result = await process_document(
            session=session,
            filename=filename,
            content=content,
        )

        return result

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Document processing failed: "
                f"{exc}"
            ),
        ) from exc

    finally:

        await document.close()


@router.post("/confirm")
async def confirm_document(
    payload: ConfirmDocumentRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Confirm database action after the upload
    preview has been shown to the user.

    The incoming data is validated and duplicate
    status is checked again before committing.
    """

    if payload.action == "cancel":

        return {
            "success": True,
            "status": "cancelled",
            "action": "cancel",
            "inserted": 0,
            "updated": 0,
        }

    registry = load_document_registry()

    document_config = registry.get(
        payload.document_type
    )

    if document_config is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown document type: "
                f"{payload.document_type}"
            ),
        )

    configured_table = document_config.get(
        "table"
    )

    if configured_table != payload.target_table:

        raise HTTPException(
            status_code=400,
            detail=(
                "Target table does not match "
                "the configured document type."
            ),
        )

    required_columns = document_config.get(
        "required_columns",
        [],
    )

    configured_duplicate_keys = (
        document_config.get(
            "duplicate_keys",
            [],
        )
    )

    if (
        payload.pending_data.duplicate_keys
        != configured_duplicate_keys
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Duplicate key configuration "
                "does not match backend configuration."
            ),
        )

    all_records = [
        *payload.pending_data.new_records,
        *payload.pending_data.duplicate_records,
    ]

    if not all_records:

        raise HTTPException(
            status_code=400,
            detail="No records were provided.",
        )

    # -------------------------------------------------
    # Revalidate before database write
    # -------------------------------------------------

    validation = validate_records(
        table_name=payload.target_table,
        records=all_records,
        required_columns=required_columns,
    )

    if not validation["valid"]:

        raise HTTPException(
            status_code=400,
            detail={
                "message":
                    (
                        "Validation failed before "
                        "database confirmation."
                    ),

                "validation":
                    validation,
            },
        )

    # -------------------------------------------------
    # Recheck duplicates using current DB state
    # -------------------------------------------------

    try:

        duplicate_result = await check_duplicates(
            session=session,
            table_name=payload.target_table,
            records=all_records,
            duplicate_keys=configured_duplicate_keys,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Duplicate verification failed: "
                f"{exc}"
            ),
        ) from exc

    current_new_records = [
        item["incoming_record"]
        for item in duplicate_result[
            "new_records"
        ]
    ]

    current_duplicate_records = [
        item["incoming_record"]
        for item in duplicate_result[
            "duplicate_records"
        ]
    ]

    # -------------------------------------------------
    # INSERT
    # -------------------------------------------------

    if payload.action == "insert":

        if current_duplicate_records:

            raise HTTPException(
                status_code=409,
                detail={
                    "message":
                        (
                            "Duplicates now exist. "
                            "Please review the document "
                            "again before inserting."
                        ),

                    "duplicate_record_count":
                        len(
                            current_duplicate_records
                        ),
                },
            )

        try:

            result = await insert_all_records(
                session=session,
                table_name=payload.target_table,
                records=current_new_records,
            )

        except Exception as exc:

            await session.rollback()

            raise HTTPException(
                status_code=500,
                detail=(
                    "Database insert failed: "
                    f"{exc}"
                ),
            ) from exc

        return {
            "success": True,
            **result,
        }

    # -------------------------------------------------
    # DISCARD DUPLICATES
    #
    # Existing DB rows are kept.
    # Incoming duplicate rows are ignored.
    # -------------------------------------------------

    if (
        payload.action
        == "discard_duplicates"
    ):

        try:

            result = (
                await discard_duplicates_and_insert_new(
                    session=session,
                    table_name=payload.target_table,
                    new_records=current_new_records,
                )
            )

        except Exception as exc:

            await session.rollback()

            raise HTTPException(
                status_code=500,
                detail=(
                    "Database operation failed: "
                    f"{exc}"
                ),
            ) from exc

        return {
            "success": True,
            "discarded":
                len(
                    current_duplicate_records
                ),
            **result,
        }

    # -------------------------------------------------
    # OVERWRITE DUPLICATES
    #
    # New rows are inserted.
    # Existing duplicate rows are updated.
    # -------------------------------------------------

    if (
        payload.action
        == "overwrite_duplicates"
    ):

        try:

            result = (
                await overwrite_duplicates_and_insert_new(
                    session=session,
                    table_name=payload.target_table,
                    new_records=current_new_records,
                    duplicate_records=current_duplicate_records,
                    duplicate_keys=configured_duplicate_keys,
                )
            )

        except Exception as exc:

            await session.rollback()

            raise HTTPException(
                status_code=500,
                detail=(
                    "Database overwrite failed: "
                    f"{exc}"
                ),
            ) from exc

        return {
            "success": True,
            **result,
        }

    raise HTTPException(
        status_code=400,
        detail="Unsupported confirmation action.",
    )
