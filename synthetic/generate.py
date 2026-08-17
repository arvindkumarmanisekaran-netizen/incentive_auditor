from pathlib import Path
import shutil

from generators.canonical import (
    generate_canonical_data,
)

from generators.structured_exports import (
    export_structured_data,
)

OUTPUT_DIR = (
    Path(__file__).resolve().parent
    / "output"
)


def main():

    print(
        "Generating canonical data..."
    )

    if OUTPUT_DIR.exists():
        shutil.rmtree(
            OUTPUT_DIR
        )

    data = generate_canonical_data(
        num_territories=20,
        num_representatives=100,
        num_products=30,
        num_doctors=1000,
        anomaly_rate=0.08,
    )

    print()
    print(
        "Canonical data generated:"
    )

    for key, records in data.items():

        print(
            f"  {key:22}"
            f"{len(records):,}"
        )

    print()
    print(
        "Exporting mixed formats..."
    )

    export_structured_data(
        data,
        OUTPUT_DIR,
    )

    print()
    print(
        "Finished."
    )

    print(
        f"Output: {OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()
