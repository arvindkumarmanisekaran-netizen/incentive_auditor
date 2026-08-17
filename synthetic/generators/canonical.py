
from __future__ import annotations

import random

from faker import Faker


SEED = 42

random.seed(SEED)

fake = Faker("en_IN")
Faker.seed(SEED)


def generate_canonical_data(
    num_territories: int = 20,
    num_representatives: int = 100,
    num_products: int = 30,
    num_doctors: int = 1000,
    months: list[str] | None = None,
    anomaly_rate: float = 0.08,
) -> dict:

    if months is None:
        months = [
            "2026-01",
            "2026-02",
            "2026-03",
            "2026-04",
            "2026-05",
            "2026-06",
            "2026-07",
        ]

    territories = generate_territories(
        num_territories
    )

    representatives = generate_representatives(
        num_representatives,
        territories,
    )

    products = generate_products(
        num_products
    )

    doctors = generate_doctors(
        num_doctors,
        territories,
    )

    assignments = generate_assignments(
        representatives,
        doctors,
    )

    sales, prescriptions, anomalies = (
        generate_sales_and_prescriptions(
            representatives=representatives,
            products=products,
            doctors=doctors,
            assignments=assignments,
            months=months,
            anomaly_rate=anomaly_rate,
        )
    )

    targets = generate_targets(
        representatives,
        products,
        months,
    )

    incentive_rules = generate_incentive_rules(
        products
    )

    payouts = generate_payouts(
        representatives=representatives,
        products=products,
        months=months,
        sales=sales,
        anomalies=anomalies,
        incentive_rules=incentive_rules,
    )

    return {
        "territories": territories,
        "representatives": representatives,
        "products": products,
        "doctors": doctors,
        "assignments": assignments,
        "sales": sales,
        "prescriptions": prescriptions,
        "targets": targets,
        "payouts": payouts,
        "incentive_rules": incentive_rules,
        "anomalies": anomalies,
    }


def generate_territories(
    count: int,
) -> list[dict]:

    regions = [
        "North",
        "South",
        "East",
        "West",
        "Central",
    ]

    territories = []

    for i in range(1, count + 1):
        territories.append(
            {
                "territory_id": f"T{i:03d}",
                "territory_name": (
                    f"{fake.city()} Zone {i}"
                ),
                "region_name": random.choice(
                    regions
                ),
                "active": True,
            }
        )

    return territories


def generate_representatives(
    count: int,
    territories: list[dict],
) -> list[dict]:

    representatives = []

    for i in range(1, count + 1):
        first_name = fake.first_name()
        last_name = fake.last_name()

        territory = random.choice(
            territories
        )

        representatives.append(
            {
                "representative_id": (
                    f"FR{i:04d}"
                ),
                "first_name": first_name,
                "last_name": last_name,
                "territory_id": (
                    territory["territory_id"]
                ),
                "email": (
                    f"{first_name}.{last_name}"
                    f"{i}@example.com"
                ).lower(),
                "active": True,
            }
        )

    return representatives


def generate_products(
    count: int,
) -> list[dict]:

    categories = [
        "Cardiology",
        "Diabetes",
        "Neurology",
        "Respiratory",
        "Gastroenterology",
        "Dermatology",
        "Pain",
        "Antibiotic",
    ]

    products = []

    for i in range(1, count + 1):
        products.append(
            {
                "product_id": f"P{i:03d}",
                "product_name": (
                    f"{fake.word().title()}Care {i}"
                ),
                "product_category": (
                    random.choice(
                        categories
                    )
                ),
                "unit_price": round(
                    random.uniform(
                        100,
                        2500,
                    ),
                    2,
                ),
                "active": True,
            }
        )

    return products


def generate_doctors(
    count: int,
    territories: list[dict],
) -> list[dict]:

    specialties = [
        "Cardiology",
        "General Medicine",
        "Diabetology",
        "Neurology",
        "Dermatology",
        "Pulmonology",
        "Gastroenterology",
        "Orthopedics",
    ]

    doctors = []

    for i in range(1, count + 1):
        territory = random.choice(
            territories
        )

        doctors.append(
            {
                "doctor_id": f"D{i:06d}",
                "doctor_name": (
                    f"Dr {fake.name()}"
                ),
                "territory_id": (
                    territory["territory_id"]
                ),
                "speciality": (
                    random.choice(
                        specialties
                    )
                ),
                "active": True,
            }
        )

    return doctors


def generate_assignments(
    representatives: list[dict],
    doctors: list[dict],
) -> list[dict]:

    reps_by_territory: dict[
        str,
        list[dict],
    ] = {}

    for rep in representatives:
        reps_by_territory.setdefault(
            rep["territory_id"],
            [],
        ).append(rep)

    assignments = []

    for doctor in doctors:
        possible_reps = (
            reps_by_territory.get(
                doctor["territory_id"],
                representatives,
            )
        )

        rep = random.choice(
            possible_reps
        )

        assignments.append(
            {
                "representative_id": (
                    rep[
                        "representative_id"
                    ]
                ),
                "doctor_id": (
                    doctor["doctor_id"]
                ),
                "effective_from": (
                    "2026-01-01"
                ),
                "effective_to": None,
            }
        )

    return assignments


def generate_sales_and_prescriptions(
    representatives: list[dict],
    products: list[dict],
    doctors: list[dict],
    assignments: list[dict],
    months: list[str],
    anomaly_rate: float,
) -> tuple[
    list[dict],
    list[dict],
    list[dict],
]:

    assigned_doctors_by_rep: dict[
        str,
        list[str],
    ] = {}

    for assignment in assignments:
        assigned_doctors_by_rep.setdefault(
            assignment[
                "representative_id"
            ],
            [],
        ).append(
            assignment["doctor_id"]
        )

    sales: list[dict] = []
    prescriptions: list[dict] = []
    anomalies: list[dict] = []

    sale_id = 1
    prescription_id = 1

    for rep in representatives:

        rep_id = rep[
            "representative_id"
        ]

        assigned_doctors = (
            assigned_doctors_by_rep.get(
                rep_id,
                [],
            )
        )

        if not assigned_doctors:
            continue

        selected_products = (
            random.sample(
                products,
                k=min(
                    random.randint(
                        3,
                        7,
                    ),
                    len(products),
                ),
            )
        )

        for product in selected_products:

            historical_sales_base = (
                random.uniform(
                    40000,
                    160000,
                )
            )

            historical_rx_base = (
                random.uniform(
                    40,
                    250,
                )
            )

            for month in months:

                anomaly_types: list[str] = []

                is_anomaly = (
                    random.random()
                    < anomaly_rate
                )

                sales_multiplier = (
                    random.uniform(
                        0.90,
                        1.12,
                    )
                )

                rx_multiplier = (
                    random.uniform(
                        0.90,
                        1.12,
                    )
                )

                if is_anomaly:

                    anomaly_types = (
                        random.sample(
                            [
                                "sales_spike",
                                "rx_drop",
                                "doctor_concentration",
                                "cross_territory",
                                "payout_discrepancy",
                            ],
                            k=random.randint(
                                1,
                                3,
                            ),
                        )
                    )

                    if (
                        "sales_spike"
                        in anomaly_types
                    ):
                        sales_multiplier *= (
                            random.uniform(
                                1.5,
                                2.3,
                            )
                        )

                    if (
                        "rx_drop"
                        in anomaly_types
                    ):
                        rx_multiplier *= (
                            random.uniform(
                                0.15,
                                0.5,
                            )
                        )

                monthly_sales = (
                    historical_sales_base
                    * sales_multiplier
                )

                monthly_rx = (
                    historical_rx_base
                    * rx_multiplier
                )

                doctor_count = min(
                    random.randint(
                        2,
                        6,
                    ),
                    len(
                        assigned_doctors
                    ),
                )

                chosen_doctors = (
                    random.sample(
                        assigned_doctors,
                        k=doctor_count,
                    )
                )

                if (
                    "doctor_concentration"
                    in anomaly_types
                ):
                    chosen_doctors = [
                        random.choice(
                            chosen_doctors
                        )
                    ]

                sales_per_doctor = (
                    monthly_sales
                    / len(chosen_doctors)
                )

                rx_per_doctor = (
                    monthly_rx
                    / len(chosen_doctors)
                )

                for doctor_id in (
                    chosen_doctors
                ):

                    selling_territory_id = (
                        rep["territory_id"]
                    )

                    if (
                        "cross_territory"
                        in anomaly_types
                        and random.random()
                        < 0.65
                    ):
                        other_territories = [
                            d["territory_id"]
                            for d in doctors
                            if d["territory_id"]
                            != rep[
                                "territory_id"
                            ]
                        ]

                        if other_territories:
                            selling_territory_id = (
                                random.choice(
                                    other_territories
                                )
                            )

                    unit_price = float(
                        product[
                            "unit_price"
                        ]
                    )

                    quantity = max(
                        1,
                        round(
                            sales_per_doctor
                            / unit_price
                        ),
                    )

                    sales.append(
                        {
                            "sale_id": sale_id,
                            "representative_id": (
                                rep_id
                            ),
                            "doctor_id": doctor_id,
                            "product_id": (
                                product[
                                    "product_id"
                                ]
                            ),
                            "sale_date": (
                                f"{month}-"
                                f"{random.randint(1, 27):02d}"
                            ),
                            "sales_amount": (
                                round(
                                    sales_per_doctor,
                                    2,
                                )
                            ),
                            "quantity": quantity,
                            "selling_territory_id": (
                                selling_territory_id
                            ),
                            "status": "Valid",
                        }
                    )

                    prescriptions.append(
                        {
                            "prescription_id": (
                                prescription_id
                            ),
                            "representative_id": (
                                rep_id
                            ),
                            "doctor_id": doctor_id,
                            "product_id": (
                                product[
                                    "product_id"
                                ]
                            ),
                            "prescription_date": (
                                f"{month}-"
                                f"{random.randint(1, 27):02d}"
                            ),
                            "quantity": round(
                                rx_per_doctor,
                                2,
                            ),
                            "status": "Valid",
                        }
                    )

                    sale_id += 1
                    prescription_id += 1

                if anomaly_types:
                    anomalies.append(
                        {
                            "representative_id": (
                                rep_id
                            ),
                            "product_id": (
                                product[
                                    "product_id"
                                ]
                            ),
                            "month": month,
                            "anomaly_types": (
                                anomaly_types
                            ),
                        }
                    )

    return (
        sales,
        prescriptions,
        anomalies,
    )


def generate_targets(
    representatives: list[dict],
    products: list[dict],
    months: list[str],
) -> list[dict]:

    targets = []

    target_id = 1

    for rep in representatives:

        selected_products = (
            random.sample(
                products,
                k=min(
                    4,
                    len(products),
                ),
            )
        )

        for month in months:

            for product in (
                selected_products
            ):

                targets.append(
                    {
                        "target_id": (
                            target_id
                        ),
                        "representative_id": (
                            rep[
                                "representative_id"
                            ]
                        ),
                        "product_id": (
                            product[
                                "product_id"
                            ]
                        ),
                        "target_month": (
                            f"{month}-01"
                        ),
                        "target_amount": (
                            round(
                                random.uniform(
                                    50000,
                                    250000,
                                ),
                                2,
                            )
                        ),
                    }
                )

                target_id += 1

    return targets


def generate_incentive_rules(
    products: list[dict],
) -> list[dict]:

    rules = []

    rule_id = 1

    for product in products:

        rules.append(
            {
                "incentive_rule_id": (
                    rule_id
                ),
                "product_id": (
                    product[
                        "product_id"
                    ]
                ),
                "rule_name": (
                    f"{product['product_id']} "
                    f"Standard Incentive"
                ),
                "effective_from": (
                    "2026-01-01"
                ),
                "effective_to": None,
                "threshold_amount": (
                    random.choice(
                        [
                            0,
                            50000,
                            100000,
                        ]
                    )
                ),
                "payout_percentage": (
                    random.choice(
                        [
                            3.0,
                            4.0,
                            5.0,
                            6.0,
                            7.5,
                        ]
                    )
                ),
                "active": True,
            }
        )

        rule_id += 1

    return rules


def generate_payouts(
    representatives: list[dict],
    products: list[dict],
    months: list[str],
    sales: list[dict],
    anomalies: list[dict],
    incentive_rules: list[dict],
) -> list[dict]:

    rule_by_product = {
        rule["product_id"]: rule
        for rule in incentive_rules
    }

    anomaly_lookup = {
        (
            anomaly[
                "representative_id"
            ],
            anomaly[
                "product_id"
            ],
            anomaly["month"],
        ):
        anomaly["anomaly_types"]
        for anomaly
        in anomalies
    }

    sales_totals: dict[
        tuple[str, str, str],
        float,
    ] = {}

    for sale in sales:

        month = sale[
            "sale_date"
        ][:7]

        key = (
            sale[
                "representative_id"
            ],
            sale[
                "product_id"
            ],
            month,
        )

        sales_totals[key] = (
            sales_totals.get(
                key,
                0,
            )
            +
            float(
                sale[
                    "sales_amount"
                ]
            )
        )

    payouts = []

    payout_id = 1

    for (
        rep_id,
        product_id,
        month,
    ), sales_amount in (
        sales_totals.items()
    ):

        rule = (
            rule_by_product[
                product_id
            ]
        )

        threshold = float(
            rule[
                "threshold_amount"
            ]
        )

        payout_percent = float(
            rule[
                "payout_percentage"
            ]
        )

        eligible_sales = max(
            sales_amount - threshold,
            0,
        )

        expected_payout = (
            eligible_sales
            * payout_percent
            / 100
        )

        actual_payout = (
            expected_payout
        )

        anomaly_types = (
            anomaly_lookup.get(
                (
                    rep_id,
                    product_id,
                    month,
                ),
                [],
            )
        )

        if (
            "payout_discrepancy"
            in anomaly_types
        ):
            actual_payout += (
                random.uniform(
                    1000,
                    10000,
                )
            )

        payouts.append(
            {
                "payout_id": (
                    payout_id
                ),
                "representative_id": (
                    rep_id
                ),
                "product_id": (
                    product_id
                ),
                "payout_month": (
                    f"{month}-01"
                ),
                "expected_payout": (
                    round(
                        expected_payout,
                        2,
                    )
                ),
                "actual_payout": (
                    round(
                        actual_payout,
                        2,
                    )
                ),
                "payout_difference": (
                    round(
                        actual_payout
                        -
                        expected_payout,
                        2,
                    )
                ),
                "status": (
                    "Processed"
                ),
            }
        )

        payout_id += 1

    return payouts
