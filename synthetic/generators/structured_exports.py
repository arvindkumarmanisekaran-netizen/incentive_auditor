from __future__ import annotations

import csv
import json

from pathlib import Path
from typing import Any

from docx import Document
from openpyxl import Workbook

# ======================================================
# Folder helper
# ======================================================


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


# ======================================================
# File writers
# ======================================================
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

    fieldnames = list(records[0].keys())

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

        for record in records:

            writer.writerow({key: record.get(key) for key in fieldnames})


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
    sheet.title = sheet_name[:31]

    headers = list(records[0].keys())

    sheet.append(headers)

    for record in records:

        sheet.append([excel_value(record.get(header)) for header in headers])

    workbook.save(output_path)


def write_docx(
    records: list[dict[str, Any]],
    output_path: Path,
) -> None:

    if not records:
        return

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    document = Document()

    headers = list(records[0].keys())

    table = document.add_table(
        rows=1,
        cols=len(headers),
    )

    for index, header in enumerate(headers):

        table.rows[0].cells[index].text = str(header)

    for record in records:

        row = table.add_row()

        for index, header in enumerate(headers):

            row.cells[index].text = str(
                record.get(
                    header,
                    "",
                )
            )

    document.save(output_path)


# ======================================================
# Format exporters
# ======================================================


def export_csv(
    table: str,
    records: list[dict[str, Any]],
    output_dir: Path,
):

    folder = ensure_folder(
        output_dir,
        table,
    )

    write_csv(
        records,
        folder / f"{table}.csv",
    )


def export_json(
    table: str,
    records: list[dict[str, Any]],
    output_dir: Path,
):

    folder = ensure_folder(
        output_dir,
        table,
    )

    write_json(
        records,
        folder / f"{table}.json",
    )


def excel_value(value):

    if isinstance(value, list):
        return ",".join(str(item) for item in value)

    if isinstance(value, dict):
        return ",".join(f"{key}:{val}" for key, val in value.items())

    return value


def export_xlsx(
    table: str,
    records: list[dict[str, Any]],
    output_dir: Path,
):

    folder = ensure_folder(
        output_dir,
        table,
    )

    write_xlsx(
        records,
        folder / f"{table}.xlsx",
        table.title(),
    )


def export_docx(
    table: str,
    records: list[dict[str, Any]],
    output_dir: Path,
):

    folder = ensure_folder(
        output_dir,
        table,
    )

    write_docx(
        records,
        folder / f"{table}.docx",
    )


# ======================================================
# Main exporter
# ======================================================


def export_structured_data(
    documents: dict[str, list[dict[str, Any]]],
    output_dir: Path,
):

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for document_name, records in documents.items():

        table, extension = document_name.rsplit(
            ".",
            1,
        )

        extension = extension.lower()

        if extension == "csv":

            export_csv(
                table,
                records,
                output_dir,
            )

        elif extension == "xlsx":

            export_xlsx(
                table,
                records,
                output_dir,
            )

        elif extension == "json":

            export_json(
                table,
                records,
                output_dir,
            )

        elif extension == "docx":

            export_docx(
                table,
                records,
                output_dir,
            )

        else:

            print(f"Skipping unsupported format: {extension}")
