from copy import deepcopy
import unittest

from backend.app.analytics.payout_reconciliation import (
    expected_multiplier,
    missing_payout_finding,
    reconcile_payout_record,
    temporal_payout_findings,
)


def valid_row(**overrides):
    row = {
        "payout_id": "PAYOUT_0000001",
        "product_id": "P005",
        "product_name": "MolestiaeCare 5",
        "payout_month": "2026-07-01",
        "sales_target": 100000,
        "actual_sales": 100000,
        "attributed_actual_sales": 100000,
        "excluded_status_sales": 0,
        "outside_assignment_sales": 0,
        "sales_achievement": 100,
        "base_incentive": 5000,
        "achievement_multiplier": 1.25,
        "calculated_payout": 6250,
        "maximum_payout": 7500,
        "expected_payout": 6250,
        "actual_payout": 6250,
        "payout_difference": 0,
        "duplicate_count": 1,
        "status": "Paid",
    }
    row.update(overrides)
    return row


class PayoutReconciliationTests(unittest.TestCase):
    def test_achievement_bands(self):
        self.assertEqual(str(expected_multiplier(49)), "0.50")
        self.assertEqual(str(expected_multiplier(50)), "0.75")
        self.assertEqual(str(expected_multiplier(100)), "1.25")
        self.assertEqual(str(expected_multiplier(125)), "1.50")

    def test_valid_record_has_no_failed_checks(self):
        finding = reconcile_payout_record(valid_row())
        self.assertEqual(finding["severity"], "NORMAL")
        self.assertEqual(finding["evidence"]["failed_checks"], [])
        self.assertEqual(finding["evidence"]["reconstructed_expected_payout"], 6250.0)

    def test_rebuild_detects_each_tampered_calculation_stage(self):
        row = valid_row(
            actual_sales=120000,
            sales_achievement=120,
            achievement_multiplier=1.5,
            base_incentive=6000,
            calculated_payout=9000,
            maximum_payout=9000,
            expected_payout=9000,
            actual_payout=9500,
            payout_difference=1,
            duplicate_count=2,
        )
        finding = reconcile_payout_record(row)
        subtypes = set(finding["evidence"]["discrepancy_subtypes"])
        self.assertTrue(
            {
                "sales_attribution_mismatch",
                "achievement_miscalculation",
                "multiplier_mismatch",
                "base_incentive_mismatch",
                "calculated_payout_mismatch",
                "maximum_cap_mismatch",
                "expected_payout_mismatch",
                "actual_payout_variance",
                "recorded_difference_mismatch",
                "payout_cap_exceeded",
                "duplicate_payout",
            }.issubset(subtypes)
        )
        self.assertEqual(finding["severity"], "HIGH")

    def test_zero_sales_and_target_with_payout_is_high(self):
        finding = reconcile_payout_record(
            valid_row(
                sales_target=0,
                actual_sales=0,
                attributed_actual_sales=0,
                sales_achievement=0,
                base_incentive=0,
                achievement_multiplier=0.5,
                calculated_payout=0,
                maximum_payout=0,
                expected_payout=0,
                actual_payout=2500,
                payout_difference=2500,
            )
        )
        subtypes = set(finding["evidence"]["discrepancy_subtypes"])
        self.assertIn("payout_without_eligible_sales", subtypes)
        self.assertIn("payout_with_zero_target", subtypes)
        self.assertEqual(finding["severity"], "HIGH")

    def test_status_and_negative_value_checks(self):
        finding = reconcile_payout_record(
            valid_row(status="Paid", actual_payout=-5, payout_difference=-6255)
        )
        subtypes = set(finding["evidence"]["discrepancy_subtypes"])
        self.assertIn("invalid_negative_value", subtypes)
        self.assertIn("invalid_payout_status", subtypes)

    def test_ineligible_and_outside_assignment_sales(self):
        finding = reconcile_payout_record(
            valid_row(
                actual_sales=101000,
                excluded_status_sales=1000,
                outside_assignment_sales=500,
            )
        )
        subtypes = set(finding["evidence"]["discrepancy_subtypes"])
        self.assertIn("ineligible_sales_included", subtypes)
        self.assertIn("sales_outside_assignment_period", subtypes)

    def test_missing_payout_is_not_included_in_chart_totals(self):
        finding = missing_payout_finding(
            {
                "product_id": "P005",
                "product_name": "MolestiaeCare 5",
                "payout_month": "2026-07-01",
                "attributed_actual_sales": 100000,
            }
        )
        self.assertEqual(finding["severity"], "HIGH")
        self.assertFalse(finding["evidence"]["include_in_payout_totals"])
        self.assertEqual(finding["evidence"]["discrepancy_subtypes"], ["missing_payout"])

    def test_temporal_patterns_are_detected_without_double_counting(self):
        july = valid_row(actual_payout=7190, expected_payout=6250)
        august = deepcopy(july)
        august.update(
            payout_id="PAYOUT_0000002",
            payout_month="2026-08-01",
            actual_payout=7195,
        )
        other_product = deepcopy(july)
        other_product.update(
            payout_id="PAYOUT_0000003",
            product_id="P010",
            product_name="CorruptiCare 10",
        )

        findings = temporal_payout_findings([july, august, other_product])
        subtypes = {
            finding["evidence"]["discrepancy_subtypes"][0] for finding in findings
        }
        self.assertIn("repeated_payout_variance", subtypes)
        self.assertIn("review_threshold_proximity", subtypes)
        self.assertIn("identical_cross_product_payout", subtypes)
        self.assertTrue(
            all(not finding["evidence"]["include_in_payout_totals"] for finding in findings)
        )


if __name__ == "__main__":
    unittest.main()
