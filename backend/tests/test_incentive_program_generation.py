import unittest

from backend.app.synthetic.generators.incentive_programs import (
    generate_incentive_program_tiers,
    generate_incentive_programs,
)


class IncentiveProgramGenerationTests(unittest.TestCase):
    def setUp(self):
        self.products = [
            {"product_id": f"P{index:03d}", "product_name": f"Product {index}"}
            for index in range(1, 11)
        ]
        self.months = [f"2026-{month:02d}" for month in range(1, 9)]

    def test_programs_have_varied_date_windows_and_product_sets(self):
        programs = generate_incentive_programs(self.products, self.months)
        self.assertEqual(
            [(item["start_date"], item["end_date"]) for item in programs],
            [
                ("2026-01-01", "2026-02-28"),
                ("2026-02-01", "2026-04-30"),
                ("2026-04-01", "2026-08-31"),
            ],
        )
        self.assertEqual(len({item["products"] for item in programs}), len(programs))
        self.assertEqual([item["percentage"] for item in programs], [125.0, 150.0, 175.0])

    def test_each_program_has_complete_non_overlapping_varied_tiers(self):
        programs = generate_incentive_programs(self.products, self.months)
        tiers = generate_incentive_program_tiers(programs)
        self.assertEqual(len(tiers), len(programs) * 5)

        schedules = []
        for program in programs:
            program_tiers = [
                tier
                for tier in tiers
                if tier["incentive_program_id"] == program["incentive_program_id"]
            ]
            self.assertEqual(program_tiers[0]["minimum_achievement"], 0)
            self.assertIsNone(program_tiers[-1]["maximum_achievement"])
            for current, following in zip(program_tiers, program_tiers[1:]):
                self.assertEqual(
                    current["maximum_achievement"],
                    following["minimum_achievement"],
                )
            schedules.append(
                tuple(
                    (
                        tier["minimum_achievement"],
                        tier["maximum_achievement"],
                        tier["multiplier"],
                    )
                    for tier in program_tiers
                )
            )

        self.assertEqual(len(set(schedules)), len(programs))


if __name__ == "__main__":
    unittest.main()
