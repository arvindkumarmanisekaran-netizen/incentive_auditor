from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

ALLOWED_STATUS_VALUES: dict[str, set[str]] = {
    "territories": {
        "Active",
        "Inactive",
    },
    "representatives": {
        "Active",
        "Inactive",
    },
    "products": {
        "Active",
        "Inactive",
    },
    "doctors": {
        "Active",
        "Inactive",
    },
    "representative_doctor_assignments": {
        "Active",
        "Inactive",
        "Cancelled",
    },
    "sales": {
        "Valid",
        "Cancelled",
        "Returned",
        "Adjusted",
    },
    "prescriptions": {
        "Valid",
        "Cancelled",
        "Reversed",
    },
    "incentive_payouts": {
        "Pending",
        "Paid",
        "Adjusted",
    },
}


DATE_COLUMNS = {
    "joining_date",
    "effective_from",
    "effective_to",
    "sale_date",
    "prescription_date",
    "payout_month",
}


INTEGER_COLUMNS = {
    "quantity",
}


DECIMAL_COLUMNS = {
    "sales_amount",
    "sales_target",
    "actual_sales",
    "sales_achievement",
    "base_incentive",
    "achievement_multiplier",
    "calculated_payout",
    "maximum_payout",
    "expected_payout",
    "actual_payout",
    "payout_difference",
}


NON_NEGATIVE_COLUMNS = {
    "sales_amount",
    "sales_target",
    "actual_sales",
    "sales_achievement",
    "base_incentive",
    "achievement_multiplier",
    "calculated_payout",
    "maximum_payout",
    "expected_payout",
    "actual_payout",
}


POSITIVE_INTEGER_COLUMNS = {
    "quantity",
}


def is_missing(
    value: Any,
) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        return not value.strip()

    return False


def parse_date_value(
    value: Any,
) -> date | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y-%m",
        ]

        for format_string in formats:
            try:
                parsed = datetime.strptime(
                    text,
                    format_string,
                )

                return parsed.date()

            except ValueError:
                continue

    return None


def parse_integer_value(
    value: Any,
) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if value.is_integer():
            return int(value)

        return None

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        try:
            number = float(text)

            if number.is_integer():
                return int(number)

        except ValueError:
            return None

    return None


def parse_decimal_value(
    value: Any,
) -> Decimal | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    try:
        return Decimal(str(value).strip())

    except (
        InvalidOperation,
        ValueError,
        AttributeError,
    ):
        return None


def validate_required_columns(
    records: list[dict[str, Any]],
    required_columns: list[str],
) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        for column in required_columns:
            if column not in record or is_missing(record.get(column)):
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "code": "required",
                        "message": (f"Required value " f"'{column}' is missing."),
                    }
                )

    return errors


def validate_dates(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        for column in DATE_COLUMNS:
            if column not in record:
                continue

            value = record[column]

            if is_missing(value):
                continue

            parsed = parse_date_value(value)

            if parsed is None:
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "value": value,
                        "code": "invalid_date",
                        "message": (f"Invalid date value " f"for '{column}'."),
                    }
                )

    return errors


def validate_integers(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        for column in INTEGER_COLUMNS:
            if column not in record:
                continue

            value = record[column]

            if is_missing(value):
                continue

            parsed = parse_integer_value(value)

            if parsed is None:
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "value": value,
                        "code": "invalid_integer",
                        "message": (f"'{column}' must " f"be an integer."),
                    }
                )

                continue

            if column in POSITIVE_INTEGER_COLUMNS and parsed <= 0:
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "value": value,
                        "code": "must_be_positive",
                        "message": (f"'{column}' must " f"be greater than 0."),
                    }
                )

    return errors


def validate_decimals(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        for column in DECIMAL_COLUMNS:
            if column not in record:
                continue

            value = record[column]

            if is_missing(value):
                continue

            parsed = parse_decimal_value(value)

            if parsed is None:
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "value": value,
                        "code": "invalid_number",
                        "message": (f"'{column}' must " f"be numeric."),
                    }
                )

                continue

            if column in NON_NEGATIVE_COLUMNS and parsed < 0:
                errors.append(
                    {
                        "row": row_number,
                        "column": column,
                        "value": value,
                        "code": "negative_value",
                        "message": (f"'{column}' cannot " f"be negative."),
                    }
                )

    return errors


def validate_status(
    table_name: str,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    allowed = ALLOWED_STATUS_VALUES.get(table_name)

    if not allowed:
        return []

    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        if "status" not in record:
            continue

        value = record["status"]

        if is_missing(value):
            continue

        status = str(value).strip()

        if status not in allowed:
            errors.append(
                {
                    "row": row_number,
                    "column": "status",
                    "value": value,
                    "code": "invalid_status",
                    "message": (
                        f"Invalid status "
                        f"'{status}'. Allowed "
                        f"values: "
                        f"{', '.join(sorted(allowed))}"
                    ),
                }
            )

    return errors


def validate_date_ranges(
    table_name: str,
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if table_name != "representative_doctor_assignments":
        return []

    errors: list[dict[str, Any]] = []

    for row_number, record in enumerate(
        records,
        start=1,
    ):
        effective_from = parse_date_value(record.get("effective_from"))

        effective_to = parse_date_value(record.get("effective_to"))

        if effective_from and effective_to and effective_to < effective_from:
            errors.append(
                {
                    "row": row_number,
                    "column": "effective_to",
                    "code": "invalid_date_range",
                    "message": ("effective_to cannot " "be earlier than " "effective_from."),
                }
            )

    return errors


def validate_records(
    table_name: str,
    records: list[dict[str, Any]],
    required_columns: list[str],
    file_name: str | None = None,
) -> dict[str, Any]:
    """
    Main validation entry point for the simplified
    8-table Incentive Auditor schema.
    """

    errors: list[dict[str, Any]] = []

    validation_errors: list[dict[str, Any]] = []

    validation_errors.extend(
        validate_required_columns(
            records,
            required_columns,
        )
    )

    validation_errors.extend(validate_dates(records))

    validation_errors.extend(validate_integers(records))

    validation_errors.extend(validate_decimals(records))

    validation_errors.extend(
        validate_status(
            table_name,
            records,
        )
    )

    validation_errors.extend(
        validate_date_ranges(
            table_name,
            records,
        )
    )

    # -----------------------------------------
    # Attach frontend-friendly metadata
    # -----------------------------------------

    for error in validation_errors:
        row_number = error.get("row") or error.get("row_id") or 0

        errors.append(
            {
                "file_name": (file_name or "unknown"),
                "row_id": row_number,
                **error,
            }
        )

    invalid_rows = sorted({error["row_id"] for error in errors if error.get("row_id")})

    return {
        "valid": len(errors) == 0,
        "total_records": len(records),
        "invalid_record_count": len(invalid_rows),
        "valid_record_count": (len(records) - len(invalid_rows)),
        "errors": errors,
    }
