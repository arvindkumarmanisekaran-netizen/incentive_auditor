
from __future__ import annotations

import csv
import json
import random
import xml.etree.ElementTree as ET

from pathlib import Path
from typing import Any

from openpyxl import Workbook


SEED = 42
random.seed(SEED)


def ensure_folder(
    base_dir: Path,
    relative_path: str,
) -> Path:
    folder = base_dir / relative_path

    folder.mkdir(
        parents=True,
        exist_ok=True,
    )

    return folder


def write_csv(
    records: list[dict[str, Any]],
    output_path: Path,
) -> None:
    if not records:
        return

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    fieldnames = list(
        records[0].keys()
    )

    with open(
        output_path,
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(records)


def write_json(
    records: list[dict[str, Any]],
    output_path: Path,
) -> None:
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        output_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            records,
            file,
            indent=2,
            ensure_ascii=False,
        )


def write_xlsx(
    records: list[dict[str, Any]],
    output_path: Path,
    sheet_name: str,
) -> None:
    if not records:
        return

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    workbook = Workbook()

    sheet = workbook.active
    sheet.title = sheet_name

    headers = list(
        records[0].keys()
    )

    sheet.append(headers)

    for record in records:
        sheet.append(
            [
                record.get(header)
                for header in headers
            ]
        )

    workbook.save(
        output_path
    )


def write_xml(
    records: list[dict[str, Any]],
    output_path: Path,
    root_name: str,
    item_name: str,
) -> None:
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    root = ET.Element(
        root_name
    )

    for record in records:
        item = ET.SubElement(
            root,
            item_name,
        )

        for key, value in record.items():
            child = ET.SubElement(
                item,
                key,
            )

            child.text = (
                ""
                if value is None
                else str(value)
            )

    tree = ET.ElementTree(root)

    tree.write(
        output_path,
        encoding="utf-8",
        xml_declaration=True,
    )


def partition_by_month(
    records: list[dict[str, Any]],
    date_field: str,
) -> dict[str, list[dict[str, Any]]]:
    partitions: dict[
        str,
        list[dict[str, Any]],
    ] = {}

    for record in records:
        value = str(
            record[date_field]
        )

        month = value[:7]

        partitions.setdefault(
            month,
            [],
        ).append(record)

    return partitions


def split_records(
    records: list[dict[str, Any]],
    chunks: int,
) -> list[list[dict[str, Any]]]:
    if not records:
        return []

    chunks = max(
        1,
        min(
            chunks,
            len(records),
        ),
    )

    chunk_size = max(
        1,
        len(records) // chunks,
    )

    result = []

    start = 0

    while start < len(records):
        result.append(
            records[
                start:
                start + chunk_size
            ]
        )

        start += chunk_size

    return result


def export_master_data(
    data: dict,
    base_dir: Path,
) -> None:

    territories = data[
        "territories"
    ]

    representatives = data[
        "representatives"
    ]

    products = data[
        "products"
    ]

    doctors = data[
        "doctors"
    ]

    assignments = data[
        "assignments"
    ]

    # ======================================================
    # TERRITORIES
    # Same data, multiple formats
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "master/territories",
    )

    write_json(
        territories,
        folder / "territories.json",
    )

    write_csv(
        territories,
        folder / "territories.csv",
    )

    write_xlsx(
        territories,
        folder / "territories.xlsx",
        "Territories",
    )

    write_xml(
        territories,
        folder / "territories.xml",
        "territories",
        "territory",
    )

    # ======================================================
    # REPRESENTATIVES
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "master/representatives",
    )

    write_csv(
        representatives,
        folder / "representatives.csv",
    )

    write_json(
        representatives,
        folder / "representatives.json",
    )

    write_xlsx(
        representatives,
        folder / "representatives.xlsx",
        "Representatives",
    )

    write_xml(
        representatives,
        folder / "representatives.xml",
        "representatives",
        "representative",
    )

    # ======================================================
    # PRODUCTS
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "master/products",
    )

    write_xlsx(
        products,
        folder / "products.xlsx",
        "Products",
    )

    write_csv(
        products,
        folder / "products.csv",
    )

    write_json(
        products,
        folder / "products.json",
    )

    write_xml(
        products,
        folder / "products.xml",
        "products",
        "product",
    )

    # ======================================================
    # DOCTORS
    # Split into multiple files intentionally
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "master/doctors",
    )

    doctor_chunks = split_records(
        doctors,
        chunks=4,
    )

    formats = [
        "csv",
        "json",
        "xlsx",
        "xml",
    ]

    for index, chunk in enumerate(
        doctor_chunks,
        start=1,
    ):
        fmt = formats[
            (index - 1)
            % len(formats)
        ]

        if fmt == "csv":
            write_csv(
                chunk,
                folder
                / f"doctor_master_part_{index}.csv",
            )

        elif fmt == "json":
            write_json(
                chunk,
                folder
                / f"doctor_master_part_{index}.json",
            )

        elif fmt == "xlsx":
            write_xlsx(
                chunk,
                folder
                / f"doctor_master_part_{index}.xlsx",
                "Doctors",
            )

        elif fmt == "xml":
            write_xml(
                chunk,
                folder
                / f"doctor_master_part_{index}.xml",
                "doctors",
                "doctor",
            )

    # Also write complete copies in other formats

    write_csv(
        doctors,
        folder / "all_doctors.csv",
    )

    write_json(
        doctors,
        folder / "all_doctors.json",
    )

    # ======================================================
    # ASSIGNMENTS
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "master/doctor_assignments",
    )

    write_xml(
        assignments,
        folder
        / "doctor_assignments.xml",
        "representative_doctor_assignments",
        "assignment",
    )

    write_csv(
        assignments,
        folder
        / "doctor_assignments.csv",
    )

    write_xlsx(
        assignments,
        folder
        / "doctor_assignments.xlsx",
        "Assignments",
    )

    write_json(
        assignments,
        folder
        / "doctor_assignments.json",
    )


def export_sales(
    data: dict,
    base_dir: Path,
) -> None:

    sales = data["sales"]

    monthly = partition_by_month(
        sales,
        "sale_date",
    )

    folder = ensure_folder(
        base_dir,
        "transactions/sales",
    )

    formats = [
        "csv",
        "xlsx",
        "json",
        "xml",
    ]

    for index, (
        month,
        records,
    ) in enumerate(
        sorted(
            monthly.items()
        )
    ):

        fmt = formats[
            index
            % len(formats)
        ]

        if fmt == "csv":
            write_csv(
                records,
                folder
                / f"sales_{month}.csv",
            )

        elif fmt == "xlsx":
            write_xlsx(
                records,
                folder
                / f"sales_{month}.xlsx",
                "Sales",
            )

        elif fmt == "json":
            write_json(
                records,
                folder
                / f"sales_{month}.json",
            )

        elif fmt == "xml":
            write_xml(
                records,
                folder
                / f"sales_{month}.xml",
                "sales",
                "sale",
            )

    # Duplicate representations for parser testing

    write_csv(
        sales,
        folder
        / "all_sales.csv",
    )

    write_json(
        sales,
        folder
        / "all_sales.json",
    )


def export_prescriptions(
    data: dict,
    base_dir: Path,
) -> None:

    prescriptions = data[
        "prescriptions"
    ]

    monthly = partition_by_month(
        prescriptions,
        "prescription_date",
    )

    folder = ensure_folder(
        base_dir,
        "transactions/prescriptions",
    )

    formats = [
        "json",
        "csv",
        "xlsx",
        "xml",
    ]

    for index, (
        month,
        records,
    ) in enumerate(
        sorted(
            monthly.items()
        )
    ):

        fmt = formats[
            index
            % len(formats)
        ]

        if fmt == "json":
            write_json(
                records,
                folder
                / f"prescriptions_{month}.json",
            )

        elif fmt == "csv":
            write_csv(
                records,
                folder
                / f"prescriptions_{month}.csv",
            )

        elif fmt == "xlsx":
            write_xlsx(
                records,
                folder
                / f"prescriptions_{month}.xlsx",
                "Prescriptions",
            )

        elif fmt == "xml":
            write_xml(
                records,
                folder
                / f"prescriptions_{month}.xml",
                "prescriptions",
                "prescription",
            )

    write_json(
        prescriptions,
        folder
        / "all_prescriptions.json",
    )

    write_csv(
        prescriptions,
        folder
        / "all_prescriptions.csv",
    )


def export_incentives(
    data: dict,
    base_dir: Path,
) -> None:

    targets = data[
        "targets"
    ]

    payouts = data[
        "payouts"
    ]

    rules = data[
        "incentive_rules"
    ]

    # ======================================================
    # TARGETS
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "incentives/targets",
    )

    write_xlsx(
        targets,
        folder / "targets.xlsx",
        "Targets",
    )

    write_csv(
        targets,
        folder / "targets.csv",
    )

    write_json(
        targets,
        folder / "targets.json",
    )

    write_xml(
        targets,
        folder / "targets.xml",
        "targets",
        "target",
    )

    # ======================================================
    # PAYOUTS
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "incentives/payouts",
    )

    write_xlsx(
        payouts,
        folder / "payouts.xlsx",
        "Payouts",
    )

    write_csv(
        payouts,
        folder / "payouts.csv",
    )

    write_json(
        payouts,
        folder / "payouts.json",
    )

    write_xml(
        payouts,
        folder / "payouts.xml",
        "payouts",
        "payout",
    )

    # ======================================================
    # RULES
    # ======================================================

    folder = ensure_folder(
        base_dir,
        "incentives/rules",
    )

    write_json(
        rules,
        folder / "incentive_rules.json",
    )

    write_csv(
        rules,
        folder / "incentive_rules.csv",
    )

    write_xlsx(
        rules,
        folder / "incentive_rules.xlsx",
        "Rules",
    )

    write_xml(
        rules,
        folder / "incentive_rules.xml",
        "incentive_rules",
        "rule",
    )


def export_ground_truth(
    data: dict,
    base_dir: Path,
) -> None:

    folder = ensure_folder(
        base_dir,
        "ground_truth",
    )

    anomalies = data[
        "anomalies"
    ]

    write_json(
        anomalies,
        folder
        / "injected_anomalies.json",
    )

    manifest = {
        "territories":
            len(
                data["territories"]
            ),

        "representatives":
            len(
                data[
                    "representatives"
                ]
            ),

        "products":
            len(
                data["products"]
            ),

        "doctors":
            len(
                data["doctors"]
            ),

        "assignments":
            len(
                data["assignments"]
            ),

        "sales":
            len(
                data["sales"]
            ),

        "prescriptions":
            len(
                data[
                    "prescriptions"
                ]
            ),

        "targets":
            len(
                data["targets"]
            ),

        "payouts":
            len(
                data["payouts"]
            ),

        "incentive_rules":
            len(
                data[
                    "incentive_rules"
                ]
            ),

        "anomalies":
            len(
                data["anomalies"]
            ),
    }

    with open(
        folder
        / "dataset_manifest.json",
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            manifest,
            file,
            indent=2,
        )


def export_structured_data(
    data: dict,
    output_dir: str | Path,
) -> None:

    base_dir = Path(
        output_dir
    )

    base_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "Exporting master data..."
    )

    export_master_data(
        data,
        base_dir,
    )

    print(
        "Exporting sales..."
    )

    export_sales(
        data,
        base_dir,
    )

    print(
        "Exporting prescriptions..."
    )

    export_prescriptions(
        data,
        base_dir,
    )

    print(
        "Exporting incentive data..."
    )

    export_incentives(
        data,
        base_dir,
    )

    print(
        "Writing ground truth..."
    )

    export_ground_truth(
        data,
        base_dir,
    )

    print(
        "Structured exports complete."
    )
