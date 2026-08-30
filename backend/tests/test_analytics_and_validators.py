from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import Column, Date, DateTime, Integer, MetaData, Numeric, String, Table

from backend.app.analytics.cross_territory import calculate_cross_territory_concentration
from backend.app.analytics.doctor_concentration import calculate_doctor_concentration
from backend.app.analytics.sales_anomaly import calculate_sales_deviation
from backend.app.analytics.sales_prescription_mismatch import calculate_sales_prescription_mismatch
from backend.app.core.investigation_summary_validator import validate_investigation_summary
from backend.app.core.risk_validator import validate_risk_synthesis
from backend.app.services.document_processing.duplicate_checker import (
    build_key_filter,
    clean_record_for_table,
    normalize_column_value,
    normalize_duplicate_value,
)
from backend.app.services.document_processing.validator import (
    parse_date_value,
    parse_decimal_value,
    parse_integer_value,
    validate_records,
)
from backend.app.utils.display_labels import (
    investigation_text,
    product_label,
    representative_label,
)
from backend.app.utils.peer_metrics import calculate_peer_comparison, percentage_difference


@pytest.mark.parametrize(
    ("current", "average", "severity"),
    [(99, 100, "NORMAL"), (130, 100, "LOW"), (175, 100, "MEDIUM"), (250, 100, "HIGH")],
)
def test_sales_deviation_thresholds(current, average, severity):
    result = calculate_sales_deviation(current, average)
    assert result["severity"] == severity
    assert result["deviation_percent"] == current - 100


def test_sales_deviation_unknown_for_nonpositive_history():
    result = calculate_sales_deviation(50, 0)
    assert result["severity"] == "UNKNOWN"
    assert result["deviation_percent"] is None


@pytest.mark.parametrize(
    ("cross_sales", "severity"),
    [(29, "NORMAL"), (30, "LOW"), (50, "MEDIUM"), (70, "HIGH")],
)
def test_cross_territory_thresholds(cross_sales, severity):
    result = calculate_cross_territory_concentration(
        "T1", [{"territory_id": "T1", "sales": 100 - cross_sales}, {"territory_id": "T2", "sales": cross_sales}]
    )
    assert result["severity"] == severity
    assert result["cross_territory_share_percent"] == cross_sales


@pytest.mark.parametrize("rows", [[], [{"territory_id": "T1", "sales": 0}]])
def test_cross_territory_unknown_without_positive_sales(rows):
    assert calculate_cross_territory_concentration("T1", rows)["severity"] == "UNKNOWN"


@pytest.mark.parametrize(
    ("top", "other", "severity"),
    [(34, 66, "NORMAL"), (35, 65, "LOW"), (50, 50, "MEDIUM"), (70, 30, "HIGH")],
)
def test_doctor_concentration_thresholds(top, other, severity):
    result = calculate_doctor_concentration(
        [{"doctor_id": "D1", "sales": top}, {"doctor_id": "D2", "sales": other}]
    )
    expected = max(top, other) / (top + other) * 100
    expected_severity = severity if top >= other else ("MEDIUM" if expected >= 50 else "NORMAL")
    assert result["top_doctor_share_percent"] == expected
    assert result["severity"] == expected_severity


@pytest.mark.parametrize(
    ("rx_change", "severity"),
    [(80, "NORMAL"), (75, "LOW"), (50, "MEDIUM"), (0, "HIGH")],
)
def test_sales_prescription_mismatch_thresholds(rx_change, severity):
    result = calculate_sales_prescription_mismatch(200, 100, 100 + rx_change, 100)
    assert result["mismatch_score"] == 100 - rx_change
    assert result["severity"] == severity


def test_sales_prescription_mismatch_unknown_without_baseline():
    result = calculate_sales_prescription_mismatch(10, 0, 10, 0)
    assert result["severity"] == "UNKNOWN"
    assert result["mismatch_score"] is None


def test_peer_comparison_is_context_only_and_uses_unique_peer_count():
    result = calculate_peer_comparison(
        {"P1": {"sales": 150, "rx": 10, "payout": 20}},
        [
            {"representative_id": "R2", "product_id": "P1", "sales": 100, "rx": 5, "payout": 10},
            {"representative_id": "R3", "product_id": "P1", "sales": 200, "rx": 15, "payout": 30},
        ],
        product_names={"P1": "Product One"},
        representative_names={"R1": "Current Rep", "R2": "Peer Two"},
        current_representative_id="R1",
    )
    assert result["comparison_available"] is True
    assert result["peer_group_size"] == 2
    assert result["severity"] == "NORMAL"
    assert result["anomaly_detected"] is False
    assert result["products"]["P1"]["peer_average"] == {"sales": 150.0, "rx": 10.0, "payout": 20.0}
    assert result["products"]["P1"]["representative_name"] == "Current Rep"


def test_peer_comparison_empty_and_percentage_zero_baseline():
    result = calculate_peer_comparison({}, [])
    assert result["comparison_available"] is False
    assert result["products"] == {}
    assert percentage_difference(25, 0) == 0


def valid_risk_report():
    return {
        "overall_risk_score": 999,
        "overall_severity": "MEDIUM",
        "overall_assessment": "Several deterministic checks need review.",
        "top_risk_drivers": ["Payout variance"],
        "specialist_summary": {"sales_rx": {}, "doctor_territory": {}, "payout": {}, "peer_analysis": {}},
        "recommended_actions": ["Validate source records"],
        "human_review_required": True,
    }


def test_risk_validator_forces_deterministic_score():
    result = validate_risk_synthesis(valid_risk_report())
    assert result["overall_risk_score"] == 50
    assert result["_validation"]["passed"] is True


def test_risk_validator_removes_peer_contamination_and_flags_language():
    report = valid_risk_report()
    report["top_risk_drivers"] = ["Above peer average", "Payout mismatch"]
    report["recommended_actions"] = ["Review peer anomaly", "Validate payout"]
    report["overall_assessment"] = "Fraud occurred."
    result = validate_risk_synthesis(report)
    assert result["top_risk_drivers"] == ["Payout mismatch"]
    assert result["recommended_actions"] == ["Validate payout"]
    assert result["_validation"]["passed"] is False
    assert any("Forbidden risk language" in error for error in result["_validation"]["errors"])


def test_risk_validator_repairs_invalid_shapes():
    report = valid_risk_report()
    report.update(overall_severity="CRITICAL", top_risk_drivers="bad", recommended_actions={}, specialist_summary=[])
    result = validate_risk_synthesis(report)
    assert result["overall_severity"] == "UNKNOWN"
    assert result["overall_risk_score"] == 0
    assert result["top_risk_drivers"] == []
    assert result["recommended_actions"] == []
    assert result["specialist_summary"] == {}


def test_summary_validator_accepts_safe_report_and_removes_unsupported_action():
    report = {
        "executive_summary": "A payout discrepancy requires validation.",
        "key_findings": [],
        "investigation_priorities": [],
        "recommended_next_actions": ["Check source payout", "Investigate doctors in the territory"],
        "human_review_required": True,
    }
    result = validate_investigation_summary(report)
    assert result["recommended_next_actions"] == ["Check source payout"]
    assert result["_validation"]["passed"] is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [("2026-07-31", date(2026, 7, 31)), ("31/07/2026", date(2026, 7, 31)), ("2026-07", date(2026, 7, 1)), ("bad", None)],
)
def test_date_parser(value, expected):
    assert parse_date_value(value) == expected


@pytest.mark.parametrize(("value", "expected"), [("12", 12), (12.0, 12), (True, None), ("1.5", None), ("bad", None)])
def test_integer_parser(value, expected):
    assert parse_integer_value(value) == expected


@pytest.mark.parametrize(("value", "expected"), [("12.50", Decimal("12.50")), (0, Decimal("0")), (True, None), ("bad", None)])
def test_decimal_parser(value, expected):
    assert parse_decimal_value(value) == expected


def test_document_validation_collects_multiple_errors_by_invalid_row():
    result = validate_records(
        "sales",
        [
            {"sale_id": "S1", "sale_date": "bad", "quantity": 0, "sales_amount": -1, "status": "Mystery"},
            {"sale_id": "S2", "sale_date": "2026-07-01", "quantity": 2, "sales_amount": 10, "status": "Valid"},
        ],
        ["sale_id", "product_id"],
        "sales.csv",
    )
    assert result["valid"] is False
    assert result["invalid_record_count"] == 2
    assert result["valid_record_count"] == 0
    assert {error["code"] for error in result["errors"]} >= {
        "required", "invalid_date", "must_be_positive", "negative_value", "invalid_status"
    }
    assert all(error["file_name"] == "sales.csv" for error in result["errors"])


def test_incentive_tier_validation_rejects_invalid_and_overlapping_ranges():
    result = validate_records(
        "incentive_program_tiers",
        [
            {"incentive_program_id": "IP1", "minimum_achievement": 0, "maximum_achievement": 100, "multiplier": 1},
            {"incentive_program_id": "IP1", "minimum_achievement": 90, "maximum_achievement": 110, "multiplier": 1.2},
            {"incentive_program_id": "IP1", "minimum_achievement": 120, "maximum_achievement": 110, "multiplier": 1.3},
        ],
        ["incentive_program_id", "minimum_achievement", "multiplier"],
    )
    assert {error["code"] for error in result["errors"]} == {"overlapping_tier", "invalid_tier_range"}


def test_duplicate_normalization_and_record_cleaning():
    table = Table(
        "records", MetaData(),
        Column("id", Integer, primary_key=True),
        Column("name", String(20)),
        Column("amount", Numeric(10, 2)),
        Column("day", Date),
        Column("created", DateTime),
    )
    assert normalize_duplicate_value(table.c.id, "7") == 7
    assert normalize_duplicate_value(table.c.amount, "7.5") == 7.5
    assert normalize_column_value(table.c.day, "2026-07-01") == date(2026, 7, 1)
    cleaned = clean_record_for_table(
        table,
        {"id": 7, "name": "  Alice  ", "amount": "1,250.50", "day": "2026-07-01", "created": "2026-07-01T12:30:00", "ignored": 1},
    )
    assert cleaned == {
        "id": 7,
        "name": "Alice",
        "amount": Decimal("1250.50"),
        "day": date(2026, 7, 1),
        "created": datetime(2026, 7, 1, 12, 30),
    }
    assert str(build_key_filter(table, {"id": 7}, ["id"])) == "records.id = :id_1"


def test_display_labels_and_investigation_text_are_idempotent():
    assert product_label("Product One", "P1") == "Product One (P1)"
    assert product_label("Product One (P1)", "p1") == "Product One (P1)"
    assert product_label("", "ALL") == "All Products"
    assert representative_label("Alice", "R1") == "Alice (R1)"
    state = {
        "representative_id": "R1",
        "representative_name": "Alice",
        "findings": [{"product_id": "P1", "product_name": "Product One"}],
    }
    assert investigation_text("R1 reviewed P1 and Product One (P1).", state) == (
        "Alice (R1) reviewed Product One (P1) and Product One (P1)."
    )
