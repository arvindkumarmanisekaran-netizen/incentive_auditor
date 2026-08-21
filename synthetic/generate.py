from pathlib import Path
import json
import shutil

from generators.canonical import (
    generate_canonical_data,
)

from generators.alias_variator import (
    generate_alias_documents,
)

from generators.structured_exports import (
    export_structured_data,
)

# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

OUTPUT_DIR = BASE_DIR / "output"

PROJECT_ROOT = BASE_DIR.parent

CUSTOM_ALIAS_PATH = PROJECT_ROOT / "backend" / "app" / "config" / "column_aliases.json"


# --------------------------------------------------
# Load aliases
# --------------------------------------------------

if not CUSTOM_ALIAS_PATH.exists():
    raise FileNotFoundError(f"Alias file not found: {CUSTOM_ALIAS_PATH}")


with open(
    CUSTOM_ALIAS_PATH,
    "r",
    encoding="utf-8",
) as file:
    CUSTOM_ALIASES = json.load(file)


# --------------------------------------------------
# Main generator
# --------------------------------------------------


def main() -> None:

    print("Generating canonical data...")

    # ----------------------------------------------
    # Clear previous generated output
    # ----------------------------------------------

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ----------------------------------------------
    # Generate canonical dataset
    #
    # Current tables:
    # territories
    # representatives
    # products
    # doctors
    # assignments
    # sales
    # prescriptions
    # payouts
    # ----------------------------------------------

    data = generate_canonical_data(
        num_territories=50,
        num_representatives=30,
        num_products=30,
        num_doctors=300,
    )

    print()
    print("Canonical data generated:")

    for key, records in data.items():
        print(f"  {key:25} {len(records):,}")

    # ----------------------------------------------
    # Apply column alias / schema variations
    # ----------------------------------------------

    print()
    print("Applying document variations...")

    upload_documents = generate_alias_documents(
        data,
        CUSTOM_ALIASES,
    )

    print()
    print("Alias documents generated:")

    for document_name, records in upload_documents.items():
        print(f"  {document_name:25} {len(records):,}")

    # ----------------------------------------------
    # Export documents
    # ----------------------------------------------

    print()
    print("Exporting mixed formats...")

    export_structured_data(
        upload_documents,
        OUTPUT_DIR,
    )

    print()
    print("Finished.")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
