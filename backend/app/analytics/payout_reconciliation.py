from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable


MONEY_TOLERANCE = Decimal("0.02")
PERCENT_TOLERANCE = Decimal("0.02")
MULTIPLIER_TOLERANCE = Decimal("0.01")


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _number(value: Decimal) -> float:
    return float(_money(value))


def _month_index(value: Any) -> int:
    text = str(value or "")[:7]
    try:
        year, month = (int(part) for part in text.split("-"))
    except (TypeError, ValueError):
        return -1
    return year * 12 + month


def expected_multiplier(achievement: Decimal) -> Decimal:
    if achievement < 50:
        return Decimal("0.50")
    if achievement < 75:
        return Decimal("0.75")
    if achievement < 100:
        return Decimal("1.00")
    if achievement < 125:
        return Decimal("1.25")
    return Decimal("1.50")


def severity_for_amount(amount: Decimal) -> str:
    absolute = abs(amount)
    if absolute >= 5000:
        return "HIGH"
    if absolute >= 1000:
        return "MEDIUM"
    if absolute > MONEY_TOLERANCE:
        return "LOW"
    return "NORMAL"


def _severity_max(values: Iterable[str]) -> str:
    rank = {"NORMAL": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3}
    return max(values, key=lambda value: rank.get(value, 0), default="NORMAL")


def _failed_check(
    checks: list[dict[str, Any]],
    *,
    subtype: str,
    recorded: Any,
    calculated: Any,
    difference: Any,
    severity: str,
    rule: str,
) -> None:
    checks.append(
        {
            "subtype": subtype,
            "recorded_value": recorded,
            "calculated_value": calculated,
            "difference": difference,
            "severity": severity,
            "rule": rule,
        }
    )


def reconcile_payout_record(row: dict[str, Any]) -> dict[str, Any]:
    attributed_sales = _decimal(row.get("attributed_actual_sales"))
    recorded_sales = _decimal(row.get("actual_sales"))
    target = _decimal(row.get("sales_target"))
    recorded_achievement = _decimal(row.get("sales_achievement"))
    recorded_multiplier = _decimal(row.get("achievement_multiplier"))
    recorded_base = _decimal(row.get("base_incentive"))
    recorded_calculated = _decimal(row.get("calculated_payout"))
    recorded_maximum = _decimal(row.get("maximum_payout"))
    recorded_expected = _decimal(row.get("expected_payout"))
    actual_payout = _decimal(row.get("actual_payout"))
    recorded_difference = _decimal(row.get("payout_difference"))

    calculated_achievement = (
        Decimal("0") if target == 0 else _money(attributed_sales / target * 100)
    )
    calculated_multiplier = expected_multiplier(calculated_achievement)
    calculated_base = _money(attributed_sales * Decimal("0.05"))
    independently_calculated_payout = _money(calculated_base * calculated_multiplier)
    calculated_maximum = _money(calculated_base * Decimal("1.50"))
    calculated_expected = min(independently_calculated_payout, calculated_maximum)
    calculated_difference = _money(actual_payout - calculated_expected)
    difference_from_stored_expected = _money(actual_payout - recorded_expected)

    checks: list[dict[str, Any]] = []

    def compare_money(subtype: str, recorded: Decimal, calculated: Decimal, rule: str) -> None:
        difference = _money(recorded - calculated)
        if abs(difference) > MONEY_TOLERANCE:
            check = {
                "subtype": subtype,
                "recorded_value": _number(recorded),
                "calculated_value": _number(calculated),
                "difference": _number(difference),
                "percentage_difference": (
                    None
                    if calculated == 0
                    else float(_money(difference / abs(calculated) * 100))
                ),
                "variance_classification": (
                    "rounding_variance" if abs(difference) <= Decimal("1.00") else "material_variance"
                ),
                "severity": severity_for_amount(difference),
                "rule": rule,
            }
            checks.append(check)

    compare_money(
        "sales_attribution_mismatch",
        recorded_sales,
        attributed_sales,
        "Recorded actual sales must equal eligible sales attributed through the representative's effective doctor assignments.",
    )

    if abs(recorded_achievement - calculated_achievement) > PERCENT_TOLERANCE:
        _failed_check(
            checks,
            subtype="achievement_miscalculation",
            recorded=float(recorded_achievement),
            calculated=float(calculated_achievement),
            difference=float(_money(recorded_achievement - calculated_achievement)),
            severity="MEDIUM",
            rule="Sales achievement must equal attributed sales divided by sales target, multiplied by 100.",
        )

    if abs(recorded_multiplier - calculated_multiplier) > MULTIPLIER_TOLERANCE:
        _failed_check(
            checks,
            subtype="multiplier_mismatch",
            recorded=float(recorded_multiplier),
            calculated=float(calculated_multiplier),
            difference=float(recorded_multiplier - calculated_multiplier),
            severity="HIGH",
            rule="Achievement multiplier must match the configured achievement band.",
        )

    compare_money(
        "base_incentive_mismatch",
        recorded_base,
        calculated_base,
        "Base incentive must equal 5% of independently attributed sales.",
    )
    compare_money(
        "calculated_payout_mismatch",
        recorded_calculated,
        independently_calculated_payout,
        "Calculated payout must equal the independently calculated base incentive multiplied by the valid achievement multiplier.",
    )
    compare_money(
        "maximum_cap_mismatch",
        recorded_maximum,
        calculated_maximum,
        "Maximum payout must equal 150% of the independently calculated base incentive.",
    )
    compare_money(
        "expected_payout_mismatch",
        recorded_expected,
        calculated_expected,
        "Expected payout must be the lower of independently calculated payout and maximum payout.",
    )

    if abs(calculated_difference) > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="actual_payout_variance",
            recorded=_number(actual_payout),
            calculated=_number(calculated_expected),
            difference=_number(calculated_difference),
            severity=severity_for_amount(calculated_difference),
            rule="Actual payout must equal the independently reconstructed expected payout.",
        )

    if calculated_expected == 0 and actual_payout > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="unexpected_positive_payout",
            recorded=_number(actual_payout),
            calculated=0.0,
            difference=_number(actual_payout),
            severity="HIGH",
            rule="A positive actual payout cannot be issued when the independently reconstructed expected payout is zero.",
        )

    if abs(recorded_difference - difference_from_stored_expected) > MONEY_TOLERANCE:
        difference = _money(recorded_difference - difference_from_stored_expected)
        _failed_check(
            checks,
            subtype="recorded_difference_mismatch",
            recorded=_number(recorded_difference),
            calculated=_number(difference_from_stored_expected),
            difference=_number(difference),
            severity=severity_for_amount(difference),
            rule="Recorded payout difference must equal actual payout minus recorded expected payout.",
        )

    if actual_payout - calculated_maximum > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="payout_cap_exceeded",
            recorded=_number(actual_payout),
            calculated=_number(calculated_maximum),
            difference=_number(actual_payout - calculated_maximum),
            severity="HIGH",
            rule="Actual payout must not exceed the independently reconstructed maximum payout.",
        )

    if attributed_sales == 0 and actual_payout > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="payout_without_eligible_sales",
            recorded=_number(actual_payout),
            calculated=0.0,
            difference=_number(actual_payout),
            severity="HIGH",
            rule="A positive payout requires eligible attributed sales.",
        )

    if target == 0 and actual_payout > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="payout_with_zero_target",
            recorded=_number(actual_payout),
            calculated=0.0,
            difference=_number(actual_payout),
            severity="HIGH",
            rule="A positive payout with a zero sales target requires review.",
        )

    negative_fields = {
        "sales_target": target,
        "actual_sales": recorded_sales,
        "base_incentive": recorded_base,
        "calculated_payout": recorded_calculated,
        "maximum_payout": recorded_maximum,
        "expected_payout": recorded_expected,
        "actual_payout": actual_payout,
    }
    for field, value in negative_fields.items():
        if value < 0:
            _failed_check(
                checks,
                subtype="invalid_negative_value",
                recorded=_number(value),
                calculated=0.0,
                difference=_number(value),
                severity="HIGH",
                rule=f"{field.replace('_', ' ').title()} cannot be negative.",
            )

    status = str(row.get("status") or "").strip()
    if status == "Paid" and actual_payout <= MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="invalid_payout_status",
            recorded=status,
            calculated="A paid record should contain a positive actual payout.",
            difference=None,
            severity="MEDIUM",
            rule="Paid payout records must contain a positive actual payout.",
        )
    if status == "Pending" and actual_payout > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="status_amount_inconsistency",
            recorded=status,
            calculated="Confirm whether actual payout is a proposed or disbursed amount.",
            difference=None,
            severity="LOW",
            rule="Pending records containing an actual payout require status reconciliation.",
        )

    duplicate_count = int(row.get("duplicate_count") or 1)
    if duplicate_count > 1:
        _failed_check(
            checks,
            subtype="duplicate_payout",
            recorded=duplicate_count,
            calculated=1,
            difference=duplicate_count - 1,
            severity="HIGH",
            rule="Only one payout record may exist per representative, product and payout month.",
        )

    excluded_sales = _decimal(row.get("excluded_status_sales"))
    potentially_included_excluded_sales = min(
        max(recorded_sales - attributed_sales, Decimal("0")),
        max(excluded_sales, Decimal("0")),
    )
    if potentially_included_excluded_sales > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="ineligible_sales_included",
            recorded=_number(recorded_sales),
            calculated=_number(attributed_sales),
            difference=_number(potentially_included_excluded_sales),
            severity=severity_for_amount(potentially_included_excluded_sales),
            rule="Cancelled or returned sales must not contribute to payout calculations.",
        )

    outside_assignment_sales = _decimal(row.get("outside_assignment_sales"))
    if outside_assignment_sales > MONEY_TOLERANCE:
        _failed_check(
            checks,
            subtype="sales_outside_assignment_period",
            recorded=_number(outside_assignment_sales),
            calculated=0.0,
            difference=_number(outside_assignment_sales),
            severity="MEDIUM",
            rule="Sales outside the representative's effective doctor-assignment period must not contribute to payout.",
        )

    severity = _severity_max(check["severity"] for check in checks)
    return {
        "type": "payout_discrepancy",
        "product_id": row.get("product_id"),
        "product_name": row.get("product_name"),
        "severity": severity,
        "evidence": {
            "payout_id": row.get("payout_id"),
            "payout_month": str(row.get("payout_month") or ""),
            "status": status,
            "expected_payout": _number(recorded_expected),
            "actual_payout": _number(actual_payout),
            "payout_difference": _number(calculated_difference),
            "payout_difference_percent": (
                None
                if calculated_expected == 0
                else float(_money(calculated_difference / abs(calculated_expected) * 100))
            ),
            "recorded_payout_difference": _number(recorded_difference),
            "attributed_actual_sales": _number(attributed_sales),
            "recorded_actual_sales": _number(recorded_sales),
            "calculated_sales_achievement": float(calculated_achievement),
            "calculated_achievement_multiplier": float(calculated_multiplier),
            "calculated_base_incentive": _number(calculated_base),
            "independently_calculated_payout": _number(independently_calculated_payout),
            "calculated_maximum_payout": _number(calculated_maximum),
            "reconstructed_expected_payout": _number(calculated_expected),
            "failed_checks": checks,
            "discrepancy_subtypes": [check["subtype"] for check in checks],
            "include_in_payout_totals": True,
        },
    }


def missing_payout_finding(row: dict[str, Any]) -> dict[str, Any]:
    attributed_sales = _decimal(row.get("attributed_actual_sales"))
    return {
        "type": "payout_discrepancy",
        "product_id": row.get("product_id"),
        "product_name": row.get("product_name"),
        "severity": "HIGH",
        "evidence": {
            "payout_id": None,
            "payout_month": str(row.get("payout_month") or ""),
            "expected_payout": 0.0,
            "actual_payout": 0.0,
            "payout_difference": 0.0,
            "attributed_actual_sales": _number(attributed_sales),
            "failed_checks": [
                {
                    "subtype": "missing_payout",
                    "recorded_value": None,
                    "calculated_value": "Payout record required",
                    "difference": None,
                    "severity": "HIGH",
                    "rule": "Eligible attributed sales must have a corresponding representative, product and month payout record.",
                }
            ],
            "discrepancy_subtypes": ["missing_payout"],
            "include_in_payout_totals": False,
        },
    }


def temporal_payout_findings(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_month_amount: dict[tuple[str, float], list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        by_product[str(row.get("product_id") or "")].append(row)
        amount = _number(_decimal(row.get("actual_payout")))
        if amount > 0:
            by_month_amount[(str(row.get("payout_month") or ""), amount)].append(row)

    for product_rows in by_product.values():
        # Duplicate records are a separate anomaly. Use one record per month
        # here so duplicates cannot masquerade as a repeated temporal pattern.
        rows_by_month = {
            str(row.get("payout_month") or ""): row for row in product_rows
        }
        ordered = sorted(rows_by_month.values(), key=lambda row: _month_index(row.get("payout_month")))
        directional_rows: list[tuple[int, int]] = []
        near_threshold_rows: list[dict[str, Any]] = []
        for row in ordered:
            difference = _decimal(row.get("actual_payout")) - _decimal(row.get("expected_payout"))
            if abs(difference) > MONEY_TOLERANCE:
                directional_rows.append(
                    (_month_index(row.get("payout_month")), 1 if difference > 0 else -1)
                )
            absolute_difference = abs(difference)
            if (
                Decimal("900") <= absolute_difference < Decimal("1000")
                or Decimal("4500") <= absolute_difference < Decimal("5000")
            ):
                near_threshold_rows.append(row)
        has_repeated_direction = any(
            current_month == previous_month + 1 and current_direction == previous_direction
            for (previous_month, previous_direction), (current_month, current_direction)
            in zip(directional_rows, directional_rows[1:])
        )
        if has_repeated_direction:
            latest = ordered[-1]
            findings.append(
                _portfolio_finding(
                    latest,
                    "repeated_payout_variance",
                    "MEDIUM",
                    "Repeated overpayments or underpayments were detected across the selected months.",
                )
            )

        has_repeated_threshold_proximity = any(
            _month_index(current.get("payout_month"))
            == _month_index(previous.get("payout_month")) + 1
            for previous, current in zip(near_threshold_rows, near_threshold_rows[1:])
        )
        if has_repeated_threshold_proximity:
            findings.append(
                _portfolio_finding(
                    near_threshold_rows[-1],
                    "review_threshold_proximity",
                    "MEDIUM",
                    "Payout differences repeatedly appear immediately below a configured review threshold.",
                )
            )

        for previous, current in zip(ordered, ordered[1:]):
            if _month_index(current.get("payout_month")) != _month_index(
                previous.get("payout_month")
            ) + 1:
                continue
            previous_payout = _decimal(previous.get("actual_payout"))
            current_payout = _decimal(current.get("actual_payout"))
            previous_sales = _decimal(previous.get("attributed_actual_sales"))
            current_sales = _decimal(current.get("attributed_actual_sales"))
            if previous_payout <= 0 or previous_sales <= 0:
                continue
            payout_change = abs(current_payout - previous_payout) / previous_payout
            sales_change = abs(current_sales - previous_sales) / previous_sales
            if payout_change >= Decimal("0.50") and sales_change <= Decimal("0.05"):
                findings.append(
                    _portfolio_finding(
                        current,
                        "unexplained_payout_change",
                        "MEDIUM",
                        "Payout changed by at least 50% while attributed sales changed by no more than 5%.",
                    )
                )

    for (_month, _amount), matching_rows in by_month_amount.items():
        products = {str(row.get("product_id") or "") for row in matching_rows}
        if len(products) < 2:
            continue
        example = matching_rows[0]
        findings.append(
            _portfolio_finding(
                example,
                "identical_cross_product_payout",
                "LOW",
                "The same non-zero payout amount appears across multiple products in the same month.",
                related_products=sorted(products),
            )
        )

    return findings


def _portfolio_finding(
    row: dict[str, Any],
    subtype: str,
    severity: str,
    rule: str,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "type": "payout_discrepancy",
        "product_id": row.get("product_id"),
        "product_name": row.get("product_name"),
        "severity": severity,
        "evidence": {
            "payout_id": row.get("payout_id"),
            "payout_month": str(row.get("payout_month") or ""),
            "expected_payout": _number(_decimal(row.get("expected_payout"))),
            "actual_payout": _number(_decimal(row.get("actual_payout"))),
            "payout_difference": _number(
                _decimal(row.get("actual_payout")) - _decimal(row.get("expected_payout"))
            ),
            "failed_checks": [{"subtype": subtype, "severity": severity, "rule": rule}],
            "discrepancy_subtypes": [subtype],
            "include_in_payout_totals": False,
            **extra,
        },
    }
