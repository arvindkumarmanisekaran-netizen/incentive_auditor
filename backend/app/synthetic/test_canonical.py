from backend.app.synthetic.generators.canonical import generate_canonical_data


def generated_data():
    return generate_canonical_data(
        num_territories=10,
        num_representatives=25,
        num_products=10,
        num_doctors=250,
        months=["2026-01", "2026-02"],
    )


def test_canonical_generator_returns_every_workspace_dataset():
    data = generated_data()
    assert set(data) == {
        "territories", "representatives", "products", "incentive_programs",
        "incentive_program_tiers", "doctors", "assignments", "sales",
        "prescriptions", "payouts",
    }
    assert len(data["territories"]) == 10
    assert len(data["representatives"]) == 25
    assert len(data["products"]) == 10
    assert len(data["doctors"]) == 250
    assert len(data["assignments"]) == 250
    assert len(data["incentive_program_tiers"]) == len(data["incentive_programs"]) * 5


def test_canonical_generator_preserves_referential_integrity():
    data = generated_data()
    territory_ids = {row["territory_id"] for row in data["territories"]}
    representative_ids = {row["representative_id"] for row in data["representatives"]}
    doctor_ids = {row["doctor_id"] for row in data["doctors"]}
    product_ids = {row["product_id"] for row in data["products"]}
    program_ids = {row["incentive_program_id"] for row in data["incentive_programs"]}

    assert all(row["territory_id"] in territory_ids for row in data["representatives"])
    assert all(row["territory_id"] in territory_ids for row in data["doctors"])
    assert all(row["representative_id"] in representative_ids for row in data["assignments"])
    assert all(row["doctor_id"] in doctor_ids for row in data["assignments"])
    assert all(row["doctor_id"] in doctor_ids and row["product_id"] in product_ids for row in data["sales"])
    assert all(row["doctor_id"] in doctor_ids and row["product_id"] in product_ids for row in data["prescriptions"])
    assert all(row["representative_id"] in representative_ids and row["product_id"] in product_ids for row in data["payouts"])
    assert all(row["incentive_program_id"] in program_ids for row in data["incentive_program_tiers"])


def test_canonical_generator_uses_unique_keys_and_valid_payout_math():
    data = generated_data()
    primary_keys = {
        "territories": "territory_id", "representatives": "representative_id",
        "products": "product_id", "incentive_programs": "incentive_program_id",
        "incentive_program_tiers": "incentive_program_tier_id", "doctors": "doctor_id",
        "assignments": "assignment_id", "sales": "sale_id",
        "prescriptions": "prescription_id", "payouts": "payout_id",
    }
    for dataset, key in primary_keys.items():
        identifiers = [row[key] for row in data[dataset]]
        assert len(identifiers) == len(set(identifiers))

    assert len(data["sales"]) == len(data["prescriptions"])
    assert data["sales"] and data["payouts"]
    for payout in data["payouts"]:
        assert payout["expected_payout"] <= payout["maximum_payout"] + 0.01
        assert round(payout["actual_payout"] - payout["expected_payout"], 2) == payout["payout_difference"]
