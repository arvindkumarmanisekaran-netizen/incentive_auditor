from __future__ import annotations

from typing import Any, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field

from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..services.document_processing.database_loader import (
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
    prefix="/api/document-processing",
    tags=["document-processing"],
)


SUPPORTED_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".json",
    ".docx",
}


class PendingData(BaseModel):
    file_name: str | None = None

    duplicate_keys: list[str]

    new_records: list[dict[str, Any]]

    duplicate_records: list[dict[str, Any]]

    duplicate_actions: dict[str, Literal["keep", "replace"]] = Field(default_factory=dict)


class ConfirmDocumentRequest(BaseModel):
    document_type: str

    target_table: str

    action: Literal[
        "insert",
        "resolve_duplicates",
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

    filename = document.filename or "uploaded_document"

    extension = get_file_extension(filename)

    if not extension:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported document type. " "Supported formats are CSV, XLSX, JSON, and DOCX."
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

        # process_document can return success=False
        # without throwing an exception.
        if not result.get(
            "success",
            False,
        ):
            return result

        return result

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=("Document processing failed: " f"{exc}"),
        ) from exc


@router.post("/confirm")
async def confirm_document(
    payload: ConfirmDocumentRequest,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:

    # -------------------------------------------------
    # CANCEL
    # -------------------------------------------------

    if payload.action == "cancel":

        return {
            "success": True,
            "status": "cancelled",
            "action": "cancel",
            "inserted": 0,
            "updated": 0,
            "discarded": 0,
        }

    # -------------------------------------------------
    # LOAD DOCUMENT CONFIG
    # -------------------------------------------------

    registry = load_document_registry()

    document_config = registry.get(payload.document_type)

    if document_config is None:

        raise HTTPException(
            status_code=400,
            detail=f"Unknown document type: {payload.document_type}",
        )

    configured_table = document_config.get("table")

    if configured_table != payload.target_table:

        raise HTTPException(
            status_code=400,
            detail="Target table does not match configured document type.",
        )

    required_columns = document_config.get(
        "required_columns",
        [],
    )

    configured_duplicate_keys = document_config.get(
        "duplicate_keys",
        [],
    )

    if payload.pending_data.duplicate_keys != configured_duplicate_keys:

        raise HTTPException(
            status_code=400,
            detail="Duplicate key configuration mismatch.",
        )

    # -------------------------------------------------
    # BUILD RECORD LIST
    # -------------------------------------------------

    duplicate_incoming_records = []

    for item in payload.pending_data.duplicate_records:

        incoming_record = item.get("incoming_record")

        if isinstance(
            incoming_record,
            dict,
        ):
            duplicate_incoming_records.append(incoming_record)

    all_records = [
        *payload.pending_data.new_records,
        *duplicate_incoming_records,
    ]

    file_name = payload.pending_data.file_name or "uploaded_document"

    if not all_records:

        raise HTTPException(
            status_code=400,
            detail="No records were provided.",
        )

    # -------------------------------------------------
    # VALIDATION
    # -------------------------------------------------

    validation = validate_records(
        table_name=payload.target_table,
        records=all_records,
        required_columns=required_columns,
        file_name=file_name,
    )

    if not validation["valid"]:

        raise HTTPException(
            status_code=400,
            detail={
                "type": "VALIDATION_ERROR",
                "message": "Validation failed.",
                "errors": validation.get(
                    "errors",
                    [],
                ),
            },
        )

    # -------------------------------------------------
    # CHECK CURRENT DATABASE DUPLICATES
    # -------------------------------------------------

    try:

        duplicate_result = await check_duplicates(
            session=session,
            table_name=payload.target_table,
            records=all_records,
            duplicate_keys=configured_duplicate_keys,
            filename=file_name,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Duplicate verification failed: {exc}",
        ) from exc

    current_new_records = [item["incoming_record"] for item in duplicate_result["new_records"]]

    # IMPORTANT:
    # keep complete objects with index/order

    current_duplicate_records = duplicate_result["duplicate_records"]

    # -------------------------------------------------
    # NORMAL INSERT
    # -------------------------------------------------

    if payload.action == "insert":

        if current_duplicate_records:

            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicates found. Resolve duplicates first.",
                    "count": len(current_duplicate_records),
                },
            )

        try:

            result = await insert_all_records(
                session=session,
                table_name=payload.target_table,
                records=current_new_records,
            )

            await session.commit()

            return {
                "success": True,
                **result,
            }

        except Exception as exc:

            await session.rollback()

            raise HTTPException(
                status_code=500,
                detail=f"Insert failed: {exc}",
            ) from exc

    # -------------------------------------------------
    # INDIVIDUAL DUPLICATE RESOLUTION
    # -------------------------------------------------

    if payload.action == "resolve_duplicates":

        duplicate_actions = payload.pending_data.duplicate_actions or {}

        records_to_replace = []

        discarded_count = 0

        for index, duplicate in enumerate(current_duplicate_records):

            decision = duplicate_actions.get(
                str(index),
                "keep",
            )

            incoming_record = duplicate.get("incoming_record")

            if not incoming_record:

                continue

            if decision == "replace":

                records_to_replace.append(incoming_record)

            else:

                discarded_count += 1

        inserted_count = 0

        updated_count = 0

        try:

            # -----------------------------------------
            # Replace selected duplicates
            # -----------------------------------------

            if records_to_replace:

                overwrite_result = await overwrite_duplicates_and_insert_new(
                    session=session,
                    table_name=payload.target_table,
                    new_records=current_new_records,
                    duplicate_records=records_to_replace,
                    duplicate_keys=configured_duplicate_keys,
                )

                inserted_count += overwrite_result.get(
                    "inserted",
                    0,
                )

                updated_count += overwrite_result.get(
                    "updated",
                    0,
                )

            # -----------------------------------------
            # Only keep duplicates
            # Insert new records only
            # -----------------------------------------

            else:

                if current_new_records:

                    insert_result = await insert_all_records(
                        session=session,
                        table_name=payload.target_table,
                        records=current_new_records,
                    )

                    inserted_count += insert_result.get(
                        "inserted",
                        0,
                    )

            await session.commit()

            return {
                "success": True,
                "inserted": inserted_count,
                "updated": updated_count,
                "discarded": discarded_count,
            }

        except Exception as exc:

            await session.rollback()

            raise HTTPException(
                status_code=500,
                detail=f"Duplicate resolution failed: {exc}",
            ) from exc

    raise HTTPException(
        status_code=400,
        detail="Unsupported confirmation action.",
    )
