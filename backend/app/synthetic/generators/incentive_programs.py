from __future__ import annotations

from calendar import monthrange


def generate_incentive_programs(
    products: list[dict],
    months: list[str],
) -> list[dict]:
    """Generate changing, partly overlapping program windows and product groups."""
    if not products or not months:
        return []

    ordered_months = sorted(set(months))
    last_index = len(ordered_months) - 1
    if len(ordered_months) >= 4:
        window_indexes = [(0, 1), (1, 3), (3, last_index)]
    elif len(ordered_months) >= 2:
        window_indexes = [(0, 0), (1, last_index)]
    else:
        window_indexes = [(0, 0)]

    coverage_count = max(1, int(len(products) * 0.70))
    percentages = (125.0, 150.0, 175.0)
    programs = []
    rotation_step = max(1, len(products) // max(len(window_indexes), 1))

    for index, (start_index, end_index) in enumerate(window_indexes, start=1):
        start_month = ordered_months[start_index]
        end_month = ordered_months[end_index]
        end_year, end_month_number = (int(part) for part in end_month.split("-"))
        final_day = monthrange(end_year, end_month_number)[1]
        rotation = ((index - 1) * rotation_step) % len(products)
        rotated_products = products[rotation:] + products[:rotation]
        group = rotated_products[:coverage_count]
        programs.append(
            {
                "incentive_program_id": f"IP{index:03d}",
                "start_date": f"{start_month}-01",
                "end_date": f"{end_month}-{final_day:02d}",
                "products": ",".join(product["product_id"] for product in group),
                "percentage": percentages[(index - 1) % len(percentages)],
            }
        )

    return programs


def generate_incentive_program_tiers(
    incentive_programs: list[dict],
) -> list[dict]:
    """Give every generated program a distinct achievement schedule."""
    templates = (
        ((0, 60, 0.50), (60, 90, 0.80), (90, 110, 1.00), (110, 130, 1.25), (130, None, 1.50)),
        ((0, 40, 0.50), (40, 75, 1.00), (75, 100, 1.25), (100, 120, 1.50), (120, None, 2.00)),
        ((0, 50, 0.50), (50, 75, 0.75), (75, 100, 1.00), (100, 125, 1.25), (125, None, 1.50)),
    )
    tiers = []
    tier_number = 1
    for program_index, program in enumerate(incentive_programs):
        template = templates[program_index % len(templates)]
        for minimum, maximum, multiplier in template:
            tiers.append(
                {
                    "incentive_program_tier_id": f"IPT{tier_number:04d}",
                    "incentive_program_id": program["incentive_program_id"],
                    "minimum_achievement": minimum,
                    "maximum_achievement": maximum,
                    "multiplier": multiplier,
                }
            )
            tier_number += 1
    return tiers
