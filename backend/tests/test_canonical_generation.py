from datetime import date

import pytest

from backend.app.synthetic.generators.canonical import generate_canonical_data


@pytest.fixture(scope="module")
def generated():
    return generate_canonical_data(
        num_territories=5,
        num_representatives=12,
        num_products=8,
        num_doctors=40,
        months=["2026-01", "2026-02", "2026-04", "2026-07"],
    )


def test_generator_returns_every_persisted_dataset(generated):
    assert set(generated) == {
        "territories", "representatives", "products", "incentive_programs",
        "incentive_program_tiers", "doctors", "assignments", "sales",
        "prescriptions", "payouts",
    }
    assert all(generated[name] for name in generated)


@pytest.mark.parametrize(
    ("dataset", "id_field"),
    [
        ("territories", "territory_id"),
        ("representatives", "representative_id"),
        ("products", "product_id"),
        ("doctors", "doctor_id"),
        ("assignments", "assignment_id"),
        ("sales", "sale_id"),
        ("prescriptions", "prescription_id"),
        ("payouts", "payout_id"),
    ],
)
def test_primary_keys_are_present_and_unique(generated, dataset, id_field):
    identifiers = [row[id_field] for row in generated[dataset]]
    assert all(identifiers)
    assert len(identifiers) == len(set(identifiers))


def test_master_data_foreign_keys_are_valid(generated):
    territory_ids = {row["territory_id"] for row in generated["territories"]}
    representative_ids = {row["representative_id"] for row in generated["representatives"]}
    doctor_ids = {row["doctor_id"] for row in generated["doctors"]}

    assert all(row["territory_id"] in territory_ids for row in generated["representatives"])
    assert all(row["territory_id"] in territory_ids for row in generated["doctors"])
    assert all(row["representative_id"] in representative_ids for row in generated["assignments"])
    assert all(row["doctor_id"] in doctor_ids for row in generated["assignments"])


def test_transaction_foreign_keys_and_dates_are_valid(generated):
    doctor_ids = {row["doctor_id"] for row in generated["doctors"]}
    product_ids = {row["product_id"] for row in generated["products"]}
    territory_ids = {row["territory_id"] for row in generated["territories"]}

    for sale in generated["sales"]:
        assert sale["doctor_id"] in doctor_ids
        assert sale["product_id"] in product_ids
        assert sale["selling_territory_id"] in territory_ids
        date.fromisoformat(sale["sale_date"])
        assert sale["quantity"] > 0 and sale["sales_amount"] > 0

    for prescription in generated["prescriptions"]:
        assert prescription["doctor_id"] in doctor_ids
        assert prescription["product_id"] in product_ids
        date.fromisoformat(prescription["prescription_date"])
        assert prescription["quantity"] > 0


def test_sales_and_prescriptions_are_generated_as_evidence_pairs(generated):
    sales = generated["sales"]
    prescriptions = generated["prescriptions"]
    assert len(sales) == len(prescriptions)
    assert {
        (row["doctor_id"], row["product_id"], row["sale_date"][:7]) for row in sales
    } == {
        (row["doctor_id"], row["product_id"], row["prescription_date"][:7])
        for row in prescriptions
    }


def test_sales_do_not_store_representative_id(generated):
    assert all("representative_id" not in row for row in generated["sales"])


def test_every_program_has_five_contiguous_tiers(generated):
    tiers = generated["incentive_program_tiers"]
    for program in generated["incentive_programs"]:
        schedule = [row for row in tiers if row["incentive_program_id"] == program["incentive_program_id"]]
        assert len(schedule) == 5
        assert schedule[0]["minimum_achievement"] == 0
        assert schedule[-1]["maximum_achievement"] is None
        assert all(left["maximum_achievement"] == right["minimum_achievement"] for left, right in zip(schedule, schedule[1:]))


def test_payout_calculation_fields_are_internally_consistent(generated):
    for payout in generated["payouts"]:
        assert payout["base_incentive"] == pytest.approx(payout["actual_sales"] * 0.05, abs=0.02)
        assert payout["expected_payout"] == pytest.approx(
            min(payout["calculated_payout"], payout["maximum_payout"]), abs=0.02
        )
        assert payout["payout_difference"] == pytest.approx(
            payout["actual_payout"] - payout["expected_payout"], abs=0.02
        )


def test_payout_references_are_valid(generated):
    representative_ids = {row["representative_id"] for row in generated["representatives"]}
    product_ids = {row["product_id"] for row in generated["products"]}
    program_ids = {row["incentive_program_id"] for row in generated["incentive_programs"]}

    for payout in generated["payouts"]:
        assert payout["representative_id"] in representative_ids
        assert payout["product_id"] in product_ids
        if payout.get("program_id"):
            assert payout["program_id"] in program_ids
