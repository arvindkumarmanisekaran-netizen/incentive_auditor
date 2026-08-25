from pathlib import Path
import json
import shutil
import zipfile

from ..synthetic.generators.canonical import generate_canonical_data
from ..synthetic.generators.alias_variator import generate_alias_documents
from ..synthetic.generators.structured_exports import export_structured_data


def generate_synthetic_dataset():

    base_dir = Path(__file__).resolve().parent

    output_dir = base_dir / "generated_synthetic"

    if output_dir.exists():
        shutil.rmtree(output_dir)

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    data = generate_canonical_data(
        num_territories=50,
        num_representatives=30,
        num_products=30,
        num_doctors=300,
    )

    alias_path = base_dir.parent / "config" / "column_aliases.json"

    with open(
        alias_path,
        "r",
        encoding="utf-8",
    ) as file:
        aliases = json.load(file)

    documents = generate_alias_documents(
        data,
        aliases,
    )

    export_structured_data(
        documents,
        output_dir,
    )

    zip_path = base_dir / "synthetic_dataset.zip"

    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(
        zip_path,
        "w",
    ) as archive:

        for file in output_dir.iterdir():

            archive.write(
                file,
                arcname=file.name,
            )

    return zip_path
