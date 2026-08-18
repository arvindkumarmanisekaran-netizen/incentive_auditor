from backend.app.services.document_processing.classifier import (
    classify_document,
)


columns = [
    "Sales Number",
    "Invoice Date",
    "Physician Code",
    "Drug Code",
    "Area Code",
    "Units Sold",
    "Net Value",
]


result = classify_document(
    columns
)

print(result)
