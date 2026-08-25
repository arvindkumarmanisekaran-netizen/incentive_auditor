from __future__ import annotations

from pathlib import Path
import json
import shutil
import zipfile
from typing import Callable


from ..synthetic.generators.canonical import (
    generate_canonical_data,
)

from ..synthetic.generators.alias_variator import (
    generate_alias_documents,
)

from ..synthetic.generators.structured_exports import (
    export_structured_data,
)


def generate_synthetic_dataset(
    progress_callback: Callable[[str], None] | None = None,
):

    def emit(message: str):

        if progress_callback:

            progress_callback(message)

    # ============================================================
    # SETUP
    # ============================================================

    emit("Preparing synthetic dataset generation")

    base_dir = Path(__file__).resolve().parent

    output_dir = base_dir / "generated_synthetic"

    emit("Cleaning previous generated files")

    if output_dir.exists():

        shutil.rmtree(output_dir)

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ============================================================
    # CANONICAL DATA
    # ============================================================

    emit("Generating canonical synthetic data")

    data = generate_canonical_data(
        num_territories=50,
        num_representatives=30,
        num_products=30,
        num_doctors=300,
    )

    emit("Canonical dataset generated")

    emit(f"Generated {len(data)} core datasets")

    # ============================================================
    # DOCUMENT VARIATIONS
    # ============================================================

    alias_path = base_dir.parent / "config" / "column_aliases.json"

    emit("Loading schema variations")

    with open(
        alias_path,
        "r",
        encoding="utf-8",
    ) as file:

        aliases = json.load(file)

    emit("Creating document variations")

    documents = generate_alias_documents(
        data,
        aliases,
    )

    emit(f"Created {len(documents)} document variations")

    # ============================================================
    # EXPORT
    # ============================================================

    emit("Starting structured file export")

    export_structured_data(
        documents,
        output_dir,
        progress_callback,
    )

    # ============================================================
    # ZIP
    # ============================================================

    emit("Compressing dataset archive")

    zip_path = base_dir / "synthetic_dataset.zip"

    if zip_path.exists():

        zip_path.unlink()

    with zipfile.ZipFile(
        zip_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archive:

        files = list(output_dir.iterdir())

        total_files = len(files)

        for index, file in enumerate(files, start=1):

            archive.write(
                file,
                arcname=file.name,
            )

            emit(f"Adding {file.name} to archive ({index}/{total_files})")

    emit("Synthetic dataset archive created")

    return zip_path
