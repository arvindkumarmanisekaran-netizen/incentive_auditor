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

    territories = generate_territories(num_territories)

    representatives = generate_representatives(
        num_representatives,
        territories,
    )

    products = generate_products(num_products)

    doctors = generate_doctors(
        num_doctors,
        territories,
    )

    assignments = generate_assignments(
        representatives,
        doctors,
    )

    sales, prescriptions, anomalies = generate_prescriptions(
        representatives=representatives,
        products=products,
        doctors=doctors,
        assignments=assignments,
        months=months,
        anomaly_rate=anomaly_rate,
    )

    targets = generate_targets(
        representatives,
        products,
        months,
    )

    incentive_programs = generate_incentive_programs(products)

    incentive_tiers = generate_incentive_tiers(incentive_programs)

    payouts = generate_payouts(
        sales=sales,
        anomalies=anomalies,
        incentive_programs=incentive_programs,
        incentive_tiers=incentive_tiers,
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
        "incentive_programs": incentive_programs,
        "incentive_tiers": incentive_tiers,
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

    countries = [
        "India",
    ]

    territories = []

    for i in range(1, count + 1):

        territories.append(
            {
                "territory_id": f"T{i:03d}",
                "territory_name": (f"{fake.city()} Zone {i}"),
                "region": random.choice(regions),
                "country": random.choice(countries),
                "status": "Active",
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

        territory = random.choice(territories)

        representatives.append(
            {
                "representative_id": (f"FR{i:04d}"),
                "first_name": first_name,
                "last_name": last_name,
                "territory_id": (territory["territory_id"]),
                "joining_date": (
                    fake.date_between(
                        start_date="-5y",
                        end_date="today",
                    ).isoformat()
                ),
                "status": "Active",
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
                "product_name": (f"{fake.word().title()}Care {i}"),
                "product_category": (random.choice(categories)),
                "unit_price": round(
                    random.uniform(
                        100,
                        2500,
                    ),
                    2,
                ),
                "status": "ACTIVE",
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
        territory = random.choice(territories)

        doctors.append(
            {
                "doctor_id": f"D{i:06d}",
                "doctor_name": (f"Dr {fake.name()}"),
                "territory_id": (territory["territory_id"]),
                "speciality": (random.choice(specialties)),
                "status": "ACTIVE",
            }
        )

    return doctors


def generate_assignments(
    representatives: list[dict],
    doctors: list[dict],
) -> list[dict]:

    assignments = []

    assignment_id = 1

    for doctor in doctors:

        representative = random.choice(representatives)

        assignments.append(
            {
                "assignment_id": f"A{assignment_id:06d}",
                "representative_id": representative["representative_id"],
                "doctor_id": doctor["doctor_id"],
                "effective_from": "2026-01-01",
                "effective_to": None,
                "status": random.choice(
                    [
                        "Active",
                        "Inactive",
                    ]
                ),
            }
        )

        assignment_id += 1

    return assignments


def generate_prescriptions(
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
            assignment["representative_id"],
            [],
        ).append(assignment["doctor_id"])

    sales: list[dict] = []
    prescriptions: list[dict] = []
    anomalies: list[dict] = []

    sale_id = 1
    prescription_id = 1

    for rep in representatives:

        rep_id = rep["representative_id"]

        assigned_doctors = assigned_doctors_by_rep.get(
            rep_id,
            [],
        )

        if not assigned_doctors:
            continue

        selected_products = random.sample(
            products,
            k=min(
                random.randint(
                    3,
                    7,
                ),
                len(products),
            ),
        )

        for product in selected_products:

            historical_sales_base = random.uniform(
                40000,
                160000,
            )

            historical_rx_base = random.uniform(
                40,
                250,
            )

            for month in months:

                anomaly_types: list[str] = []

                is_anomaly = random.random() < anomaly_rate

                sales_multiplier = random.uniform(
                    0.90,
                    1.12,
                )

                rx_multiplier = random.uniform(
                    0.90,
                    1.12,
                )

                if is_anomaly:

                    anomaly_types = random.sample(
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

                    if "sales_spike" in anomaly_types:
                        sales_multiplier *= random.uniform(
                            1.5,
                            2.3,
                        )

                    if "rx_drop" in anomaly_types:
                        rx_multiplier *= random.uniform(
                            0.15,
                            0.5,
                        )

                monthly_sales = historical_sales_base * sales_multiplier

                monthly_rx = historical_rx_base * rx_multiplier

                doctor_count = min(
                    random.randint(
                        2,
                        6,
                    ),
                    len(assigned_doctors),
                )

                chosen_doctors = random.sample(
                    assigned_doctors,
                    k=doctor_count,
                )

                if "doctor_concentration" in anomaly_types:
                    chosen_doctors = [random.choice(chosen_doctors)]

                sales_per_doctor = monthly_sales / len(chosen_doctors)

                rx_per_doctor = monthly_rx / len(chosen_doctors)

                for doctor_id in chosen_doctors:

                    selling_territory_id = rep["territory_id"]

                    if "cross_territory" in anomaly_types and random.random() < 0.65:  # noqa: E501

                        other_territories = [
                            doctor["territory_id"]
                            for doctor in doctors
                            if doctor["territory_id"] != rep["territory_id"]
                        ]

                        if other_territories:

                            selling_territory_id = random.choice(other_territories)  # noqa: E501

                    unit_price = float(product["unit_price"])

                    quantity = max(
                        1,
                        round(sales_per_doctor / unit_price),
                    )

                    # ---------------------------------
                    # SALES
                    # ---------------------------------

                    sales.append(
                        {
                            "sale_id": sale_id,
                            "representative_id": rep_id,
                            "doctor_id": doctor_id,
                            "product_id": (product["product_id"]),
                            "sale_date": (f"{month}-" f"{random.randint(1, 27):02d}"),  # noqa: E501
                            "sales_amount": round(
                                sales_per_doctor,
                                2,
                            ),
                            "quantity": quantity,
                            "selling_territory_id": (selling_territory_id),
                            "status": random.choice(
                                [
                                    "Valid",
                                    "Cancelled",
                                    "Returned",
                                    "Adjusted",
                                ]
                            ),
                        }
                    )

                    # ---------------------------------
                    # PRESCRIPTIONS
                    #
                    # Matches document_registry.json:
                    #
                    # required:
                    # prescription_id
                    # prescription_date
                    # doctor_id
                    # product_id
                    # quantity
                    #
                    # optional:
                    # status
                    # ---------------------------------

                    prescriptions.append(
                        {
                            "prescription_id": f"RX{prescription_id:06d}",
                            "prescription_date": (
                                f"{month}-" f"{random.randint(1, 27):02d}"
                            ),  # noqa: E501
                            "doctor_id": doctor_id,
                            "product_id": (product["product_id"]),
                            "quantity": max(
                                1,
                                round(rx_per_doctor),
                            ),
                            "status": random.choice(
                                [
                                    "Valid",
                                    "Cancelled",
                                    "Reversed",
                                ]
                            ),
                        }
                    )

                    sale_id += 1
                    prescription_id += 1

                if anomaly_types:

                    anomalies.append(
                        {
                            "representative_id": rep_id,
                            "product_id": (product["product_id"]),
                            "month": month,
                            "anomaly_types": (anomaly_types),
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

    targets: list[dict] = []

    target_id = 1

    statuses = [
        "Active",
        "Inactive",
    ]

    for rep in representatives:

        selected_products = random.sample(
            products,
            k=min(
                4,
                len(products),
            ),
        )

        for month in months:

            for product in selected_products:

                targets.append(
                    {
                        "target_id": f"TARGET_{target_id:06d}",
                        "representative_id": (rep["representative_id"]),
                        "product_id": (product["product_id"]),
                        "target_month": (f"{month}-01"),
                        "target_amount": round(
                            random.uniform(
                                50000,
                                250000,
                            ),
                            2,
                        ),
                        "status": random.choice(statuses),
                    }
                )

                target_id += 1

    return targets


def generate_incentive_programs(
    products: list[dict],
) -> list[dict]:

    programs = []

    program_types = [
        "Monthly Incentive Program",
        "Quarterly Sales Program",
        "Product Growth Scheme",
        "Achievement Bonus Program",
    ]

    period_types = [
        "Monthly",
        "Quarterly",
    ]

    statuses = [
        "Active",
        "Inactive",
    ]

    for product in products:

        product_id = product["product_id"]

        programs.append(
            {
                "program_id": (f"PROGRAM_{product_id}"),
                "program_name": (f"{product_id} " f"{random.choice(program_types)}"),  # noqa: E501
                "period_type": (random.choice(period_types)),
                "effective_from": ("2026-01-01"),
                "effective_to": None,
                "minimum_sales_achievement": round(
                    random.choice(
                        [
                            50,
                            70,
                            80,
                        ]
                    ),
                    2,
                ),
                "maximum_payout_multiplier": round(
                    random.choice(
                        [
                            1.5,
                            2.0,
                            2.5,
                        ]
                    ),
                    2,
                ),
                "status": (random.choice(statuses)),
            }
        )

    return programs


def generate_incentive_tiers(
    programs: list[dict],
) -> list[dict]:

    tiers = []

    tier_id = 1

    tier_definitions = [
        {
            "minimum": 0,
            "maximum": 50,
            "multiplier": 0.5,
        },
        {
            "minimum": 50,
            "maximum": 75,
            "multiplier": 1.0,
        },
        {
            "minimum": 75,
            "maximum": 100,
            "multiplier": 1.25,
        },
        {
            "minimum": 100,
            "maximum": None,
            "multiplier": 1.5,
        },
    ]

    for program in programs:

        for tier in tier_definitions:

            tiers.append(
                {
                    "tier_id": (f"TIER_{tier_id:06d}"),
                    "program_id": (program["program_id"]),
                    "minimum_achievement": (tier["minimum"]),
                    "maximum_achievement": (tier["maximum"]),
                    "payout_multiplier": (tier["multiplier"]),
                }
            )

            tier_id += 1

    return tiers


def generate_payouts(
    sales: list[dict],
    anomalies: list[dict],
    incentive_programs: list[dict],
    incentive_tiers: list[dict],
) -> list[dict]:

    # -----------------------------------------
    # Program lookup
    # PROGRAM_P001 -> P001
    # -----------------------------------------

    program_by_product = {
        program["program_id"].replace(
            "PROGRAM_",
            "",
        ): program
        for program in incentive_programs
    }

    # -----------------------------------------
    # Tier lookup
    # -----------------------------------------

    tiers_by_program: dict[
        str,
        list[dict],
    ] = {}

    for tier in incentive_tiers:

        tiers_by_program.setdefault(
            tier["program_id"],
            [],
        ).append(tier)

    # -----------------------------------------
    # Anomaly lookup
    # -----------------------------------------

    anomaly_lookup = {
        (
            anomaly["representative_id"],
            anomaly["product_id"],
            anomaly["month"],
        ): anomaly["anomaly_types"]
        for anomaly in anomalies
    }

    # -----------------------------------------
    # Aggregate sales
    # -----------------------------------------

    sales_totals: dict[
        tuple[str, str, str],
        float,
    ] = {}

    for sale in sales:

        month = sale["sale_date"][:7]

        key = (
            sale["representative_id"],
            sale["product_id"],
            month,
        )

        sales_totals[key] = sales_totals.get(
            key,
            0,
        ) + float(sale["sales_amount"])

    payouts = []

    payout_id = 1

    # -----------------------------------------
    # Generate payout rows
    # -----------------------------------------

    for (
        rep_id,
        product_id,
        month,
    ), actual_sales in sales_totals.items():

        program = program_by_product.get(product_id)

        if not program:
            continue

        program_id = program["program_id"]

        sales_target = random.uniform(
            100000,
            300000,
        )

        sales_achievement = actual_sales / sales_target * 100

        # -------------------------------------
        # Find matching achievement tier
        # -------------------------------------

        achievement_multiplier = 0.0

        for tier in tiers_by_program.get(
            program_id,
            [],
        ):

            minimum = float(tier["minimum_achievement"])

            maximum = tier.get("maximum_achievement")

            if sales_achievement >= minimum and (
                maximum is None or sales_achievement <= float(maximum)
            ):

                achievement_multiplier = float(tier["payout_multiplier"])

                break

        # -------------------------------------
        # Calculate payout
        # -------------------------------------

        base_incentive = actual_sales * 0.05

        calculated_payout = base_incentive * achievement_multiplier

        expected_payout = calculated_payout

        actual_payout = expected_payout

        # -------------------------------------
        # Inject anomaly
        # -------------------------------------

        anomaly_types = anomaly_lookup.get(
            (
                rep_id,
                product_id,
                month,
            ),
            [],
        )

        if "payout_discrepancy" in anomaly_types:

            actual_payout += random.uniform(
                1000,
                10000,
            )

        maximum_multiplier = float(
            program.get(
                "maximum_payout_multiplier",
                2.0,
            )
        )

        maximum_payout = base_incentive * maximum_multiplier

        payouts.append(
            {
                "payout_id": (f"PAYOUT_{payout_id:06d}"),
                "representative_id": rep_id,
                "product_id": product_id,
                "program_id": program_id,
                "payout_month": f"{month}-01",
                "sales_target": round(
                    sales_target,
                    2,
                ),
                "actual_sales": round(
                    actual_sales,
                    2,
                ),
                "sales_achievement": round(
                    sales_achievement,
                    2,
                ),
                "base_incentive": round(
                    base_incentive,
                    2,
                ),
                "achievement_multiplier": round(
                    achievement_multiplier,
                    2,
                ),
                "calculated_payout": round(
                    calculated_payout,
                    2,
                ),
                "maximum_payout": round(
                    maximum_payout,
                    2,
                ),
                "expected_payout": round(
                    expected_payout,
                    2,
                ),
                "actual_payout": round(
                    actual_payout,
                    2,
                ),
                "payout_difference": round(
                    actual_payout - expected_payout,
                    2,
                ),
                "status": random.choice(
                    [
                        "Pending",
                        "Paid",
                        "Adjusted",
                    ]
                ),
            }
        )

        payout_id += 1

    return payouts
