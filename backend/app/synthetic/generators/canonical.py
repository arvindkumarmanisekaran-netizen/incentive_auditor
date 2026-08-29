from __future__ import annotations

from datetime import date
import random

from faker import Faker
import secrets

fake = Faker("en_IN")

# =====================================================
# MAIN GENERATOR
# =====================================================


def generate_canonical_data(
    num_territories: int = 20,
    num_representatives: int = 100,
    num_products: int = 30,
    num_doctors: int = 1000,
    months: list[str] | None = None,
) -> dict:

    seed = secrets.randbits(64)

    random.seed(seed)
    fake.seed_instance(seed)

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
        num_territories,
    )

    representatives = generate_representatives(
        num_representatives,
        territories,
    )

    products = generate_products(
        num_products,
    )

    incentive_programs = generate_incentive_programs(
        products=products,
        months=months,
    )

    doctors = generate_doctors(
        num_doctors,
        territories,
    )

    assignments = generate_assignments(
        representatives,
        doctors,
    )

    sales, prescriptions = generate_sales_and_prescriptions(
        representatives=representatives,
        products=products,
        doctors=doctors,
        assignments=assignments,
        months=months,
    )

    payouts = generate_payouts(
        sales=sales,
        assignments=assignments,
        incentive_programs=incentive_programs,
    )

    return {
        "territories": territories,
        "representatives": representatives,
        "products": products,
        "incentive_programs": incentive_programs,
        "doctors": doctors,
        "assignments": assignments,
        "sales": sales,
        "prescriptions": prescriptions,
        "payouts": payouts,
    }


def generate_incentive_programs(
    products: list[dict],
    months: list[str],
) -> list[dict]:
    """Generate dated product groups with a maximum-payout percentage."""
    if not products or not months:
        return []

    covered_products = products[: max(1, int(len(products) * 0.70))]
    group_size = max(1, (len(covered_products) + 2) // 3)
    percentages = (125.0, 150.0, 175.0)
    programs = []

    for index, start in enumerate(range(0, len(covered_products), group_size), start=1):
        group = covered_products[start : start + group_size]
        programs.append(
            {
                "incentive_program_id": f"IP{index:03d}",
                "start_date": f"{min(months)}-01",
                "end_date": f"{max(months)}-28",
                "products": ",".join(product["product_id"] for product in group),
                "percentage": percentages[(index - 1) % len(percentages)],
            }
        )

    return programs


# =====================================================
# TERRITORIES
# =====================================================


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

    territories: list[dict] = []

    for i in range(1, count + 1):

        territories.append(
            {
                "territory_id": f"T{i:03d}",
                "territory_name": f"{fake.city()} Zone {i}",
                "region": random.choice(regions),
                "country": "India",
                "status": "Active",
            }
        )

    return territories


# =====================================================
# REPRESENTATIVES
# =====================================================


def generate_representatives(
    count: int,
    territories: list[dict],
) -> list[dict]:

    representatives: list[dict] = []

    for i in range(1, count + 1):

        territory = random.choice(
            territories,
        )

        representatives.append(
            {
                "representative_id": f"FR{i:04d}",
                "first_name": fake.first_name(),
                "last_name": fake.last_name(),
                "territory_id": territory["territory_id"],
                "joining_date": fake.date_between(
                    start_date="-5y",
                    end_date=date(2025, 12, 31),
                ).isoformat(),
                "status": "Active",
            }
        )

    return representatives


# =====================================================
# PRODUCTS
# =====================================================


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
        "Pain Management",
        "Antibiotic",
    ]

    products: list[dict] = []

    for i in range(1, count + 1):

        products.append(
            {
                "product_id": f"P{i:03d}",
                "product_name": f"{fake.word().title()}Care {i}",
                "product_category": random.choice(
                    categories,
                ),
                "status": "Active",
            }
        )

    return products


# =====================================================
# DOCTORS
# =====================================================


def generate_doctors(
    count: int,
    territories: list[dict],
) -> list[dict]:

    specializations = [
        "Cardiology",
        "General Medicine",
        "Diabetology",
        "Neurology",
        "Dermatology",
        "Pulmonology",
        "Gastroenterology",
        "Orthopedics",
    ]

    doctors: list[dict] = []

    for i in range(1, count + 1):

        territory = random.choice(
            territories,
        )

        doctors.append(
            {
                "doctor_id": f"D{i:06d}",
                "doctor_name": f"Dr {fake.name()}",
                "specialization": random.choice(
                    specializations,
                ),
                "territory_id": territory["territory_id"],
                "status": "Active",
            }
        )

    return doctors


# =====================================================
# REPRESENTATIVE / DOCTOR ASSIGNMENTS
# =====================================================


def generate_assignments(
    representatives: list[dict],
    doctors: list[dict],
) -> list[dict]:

    assignments: list[dict] = []

    reps_by_territory: dict[str, list[dict]] = {}

    for rep in representatives:

        reps_by_territory.setdefault(
            rep["territory_id"],
            [],
        ).append(rep)

    assignment_id = 1

    for doctor in doctors:

        territory_id = doctor["territory_id"]

        territory_reps = reps_by_territory.get(
            territory_id,
            [],
        )

        # Prefer a representative from the doctor's
        # own territory.
        if territory_reps:
            representative = random.choice(
                territory_reps,
            )
        else:
            representative = random.choice(
                representatives,
            )

        assignments.append(
            {
                "assignment_id": f"A{assignment_id:06d}",
                "representative_id": representative["representative_id"],
                "doctor_id": doctor["doctor_id"],
                "effective_from": "2026-01-01",
                "effective_to": None,
                "status": "Active",
            }
        )

        assignment_id += 1

    return assignments


# =====================================================
# SALES + PRESCRIPTIONS
# =====================================================


def generate_sales_and_prescriptions(
    representatives: list[dict],
    products: list[dict],
    doctors: list[dict],
    assignments: list[dict],
    months: list[str],
) -> tuple[
    list[dict],
    list[dict],
]:

    assigned_doctors_by_rep: dict[
        str,
        list[str],
    ] = {}

    for assignment in assignments:

        if assignment["status"] != "Active":
            continue

        assigned_doctors_by_rep.setdefault(
            assignment["representative_id"],
            [],
        ).append(
            assignment["doctor_id"],
        )

    doctor_by_id = {doctor["doctor_id"]: doctor for doctor in doctors}

    sales: list[dict] = []
    prescriptions: list[dict] = []

    sale_id = 1
    prescription_id = 1

    # Product prices are used internally only.
    # They are NOT written to the products table.
    product_prices = {
        product["product_id"]: round(
            random.uniform(
                100,
                2500,
            ),
            2,
        )
        for product in products
    }

    for rep in representatives:

        rep_id = rep["representative_id"]

        assigned_doctors = assigned_doctors_by_rep.get(
            rep_id,
            [],
        )

        if not assigned_doctors:
            continue

        product_count = min(
            random.randint(
                3,
                7,
            ),
            len(products),
        )

        selected_products = random.sample(
            products,
            k=product_count,
        )

        for product in selected_products:

            product_id = product["product_id"]

            unit_price = product_prices[product_id]

            # Each representative/product gets
            # a relatively stable historical baseline.
            historical_sales_base = random.uniform(
                40000,
                160000,
            )

            historical_rx_base = random.uniform(
                40,
                250,
            )

            for month_index, month in enumerate(
                months,
            ):

                # Normal month-to-month movement.
                sales_multiplier = random.uniform(
                    0.90,
                    1.12,
                )

                rx_multiplier = random.uniform(
                    0.90,
                    1.12,
                )

                # -------------------------------------------------
                # Generate naturally varied data.
                #
                # There is NO separate anomaly dataset anymore.
                # These variations exist only as characteristics
                # of the sales/prescription records.
                # -------------------------------------------------

                pattern_roll = random.random()

                cross_territory = False
                doctor_concentration = False

                if pattern_roll < 0.03:

                    # Occasionally produce a large sales month.
                    sales_multiplier *= random.uniform(
                        1.5,
                        2.2,
                    )

                elif pattern_roll < 0.05:

                    # Sales/Rx divergence.
                    sales_multiplier *= random.uniform(
                        1.25,
                        1.70,
                    )

                    rx_multiplier *= random.uniform(
                        0.30,
                        0.60,
                    )

                elif pattern_roll < 0.07:

                    doctor_concentration = True

                elif pattern_roll < 0.09:

                    cross_territory = True

                # Add slight gradual growth/decline variation.
                trend = 1 + (
                    month_index
                    * random.uniform(
                        -0.015,
                        0.025,
                    )
                )

                monthly_sales = historical_sales_base * sales_multiplier * trend

                monthly_rx = historical_rx_base * rx_multiplier * trend

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

                if doctor_concentration and chosen_doctors:
                    chosen_doctors = [
                        random.choice(
                            chosen_doctors,
                        )
                    ]

                if not chosen_doctors:
                    continue

                sales_per_doctor = monthly_sales / len(chosen_doctors)

                rx_per_doctor = monthly_rx / len(chosen_doctors)

                for doctor_id in chosen_doctors:

                    doctor = doctor_by_id.get(
                        doctor_id,
                    )

                    if doctor is None:
                        continue

                    selling_territory_id = rep["territory_id"]

                    if cross_territory and random.random() < 0.65:

                        other_territories = list(
                            {
                                item["territory_id"]
                                for item in doctors
                                if item["territory_id"] != rep["territory_id"]
                            }
                        )

                        if other_territories:
                            selling_territory_id = random.choice(
                                other_territories,
                            )

                    quantity = max(
                        1,
                        round(sales_per_doctor / unit_price),
                    )

                    # =============================================
                    # SALES
                    #
                    # IMPORTANT:
                    # Sales has NO representative_id column.
                    # Representative attribution comes through
                    # representative_doctor_assignments.
                    # =============================================

                    sales.append(
                        {
                            "sale_id": f"S{sale_id:07d}",
                            "sale_date": (f"{month}-" f"{random.randint(1, 27):02d}"),
                            "doctor_id": doctor_id,
                            "product_id": product_id,
                            "selling_territory_id": (selling_territory_id),
                            "quantity": quantity,
                            "sales_amount": round(
                                sales_per_doctor,
                                2,
                            ),
                            "status": choose_sales_status(),
                        }
                    )

                    # =============================================
                    # PRESCRIPTIONS
                    # =============================================

                    prescriptions.append(
                        {
                            "prescription_id": (f"RX{prescription_id:07d}"),
                            "prescription_date": (f"{month}-" f"{random.randint(1, 27):02d}"),
                            "doctor_id": doctor_id,
                            "product_id": product_id,
                            "quantity": max(
                                1,
                                round(
                                    rx_per_doctor,
                                ),
                            ),
                            "status": (choose_prescription_status()),
                        }
                    )

                    sale_id += 1
                    prescription_id += 1

    return (
        sales,
        prescriptions,
    )


# =====================================================
# SALES STATUS
# =====================================================


def choose_sales_status() -> str:

    roll = random.random()

    if roll < 0.94:
        return "Valid"

    if roll < 0.965:
        return "Adjusted"

    if roll < 0.985:
        return "Returned"

    return "Cancelled"


# =====================================================
# PRESCRIPTION STATUS
# =====================================================


def choose_prescription_status() -> str:

    roll = random.random()

    if roll < 0.96:
        return "Valid"

    if roll < 0.985:
        return "Reversed"

    return "Cancelled"


# =====================================================
# PAYOUTS
# =====================================================


def generate_payouts(
    sales: list[dict],
    assignments: list[dict],
    incentive_programs: list[dict] | None = None,
) -> list[dict]:

    # -------------------------------------------------
    # Resolve representative through doctor assignment.
    #
    # Sales itself intentionally has no representative_id.
    # -------------------------------------------------

    representative_by_doctor: dict[
        str,
        str,
    ] = {}

    for assignment in assignments:

        if assignment["status"] != "Active":
            continue

        representative_by_doctor[assignment["doctor_id"]] = assignment["representative_id"]

    # -------------------------------------------------
    # Aggregate valid sales by:
    #
    # representative
    # product
    # month
    # -------------------------------------------------

    sales_totals: dict[
        tuple[str, str, str],
        float,
    ] = {}

    for sale in sales:

        if sale["status"] not in {
            "Valid",
            "Adjusted",
        }:
            continue

        representative_id = representative_by_doctor.get(sale["doctor_id"])

        if representative_id is None:
            continue

        month = sale["sale_date"][:7]

        key = (
            representative_id,
            sale["product_id"],
            month,
        )

        sales_totals[key] = sales_totals.get(
            key,
            0.0,
        ) + float(sale["sales_amount"])

    payouts: list[dict] = []

    payout_id = 1

    for (
        representative_id,
        product_id,
        month,
    ), actual_sales in sales_totals.items():

        # Target generated around actual historical range.
        sales_target = random.uniform(
            60000,
            180000,
        )

        if sales_target <= 0:
            sales_achievement = 0.0
        else:
            sales_achievement = actual_sales / sales_target * 100

        # -------------------------------------------------
        # Achievement multiplier
        # -------------------------------------------------

        if sales_achievement < 50:
            achievement_multiplier = 0.50

        elif sales_achievement < 75:
            achievement_multiplier = 0.75

        elif sales_achievement < 100:
            achievement_multiplier = 1.00

        elif sales_achievement < 125:
            achievement_multiplier = 1.25

        else:
            achievement_multiplier = 1.50

        # -------------------------------------------------
        # Payout calculation
        # -------------------------------------------------

        base_incentive = actual_sales * 0.05

        calculated_payout = base_incentive * achievement_multiplier

        payout_date = f"{month}-01"
        active_program = next(
            (
                program
                for program in (incentive_programs or [])
                if program["start_date"] <= payout_date <= program["end_date"]
                and product_id
                in {
                    item.strip()
                    for item in str(program.get("products") or "").split(",")
                    if item.strip()
                }
            ),
            None,
        )
        cap_percentage = float(active_program["percentage"]) if active_program else 150.0
        maximum_payout = base_incentive * (cap_percentage / 100.0)

        expected_payout = min(
            calculated_payout,
            maximum_payout,
        )

        # Normally payout matches expected payout.
        actual_payout = expected_payout

        # Occasionally create payout variation directly
        # in the business data.
        #
        # There is NO anomaly table or anomaly object.
        payout_roll = random.random()

        if payout_roll < 0.025:

            actual_payout += random.uniform(
                1000,
                8000,
            )

        elif payout_roll < 0.04:

            actual_payout = max(
                0,
                actual_payout
                - random.uniform(
                    500,
                    5000,
                ),
            )

        payout_difference = actual_payout - expected_payout

        payouts.append(
            {
                "payout_id": (f"PAYOUT_{payout_id:07d}"),
                "representative_id": (representative_id),
                "product_id": product_id,
                "payout_month": (f"{month}-01"),
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
                    payout_difference,
                    2,
                ),
                "status": choose_payout_status(),
            }
        )

        payout_id += 1

    return payouts


# =====================================================
# PAYOUT STATUS
# =====================================================


def choose_payout_status() -> str:

    roll = random.random()

    if roll < 0.75:
        return "Paid"

    if roll < 0.90:
        return "Pending"

    return "Adjusted"
