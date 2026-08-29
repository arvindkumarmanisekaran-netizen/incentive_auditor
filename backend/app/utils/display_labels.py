from __future__ import annotations

import re
from typing import Any


def product_label(product_name: Any, product_id: Any) -> str:
    name = str(product_name or "").strip()
    identifier = str(product_id or "").strip()
    if not identifier or identifier.upper() == "ALL":
        return name or "All Products"
    if not name:
        return f"Product ({identifier})"
    if f"({identifier.lower()})" in name.lower():
        return name
    return f"{name} ({identifier})"


def representative_label(representative_name: Any, representative_id: Any) -> str:
    name = str(representative_name or "").strip()
    identifier = str(representative_id or "").strip()
    if not identifier:
        return name or "Representative"
    if not name:
        return f"Representative ({identifier})"
    if f"({identifier.lower()})" in name.lower():
        return name
    return f"{name} ({identifier})"


def investigation_text(value: Any, state: dict[str, Any]) -> str:
    text_value = str(value)
    findings = state.get("findings", []) or []

    for finding in findings:
        product_id = str(finding.get("product_id") or "").strip()
        if not product_id or product_id.upper() == "ALL":
            continue
        product_name = finding.get("product_name") or (finding.get("evidence") or {}).get(
            "product_name"
        )
        label = product_label(product_name, product_id)
        text_value = re.sub(
            rf"(?<!\()\b{re.escape(product_id)}\b",
            lambda _match: label,
            text_value,
            flags=re.IGNORECASE,
        )

    representative_id = str(state.get("representative_id") or "").strip()
    representative_name = state.get("representative_name")
    if not representative_name:
        representative = next(
            (
                item
                for item in state.get("representatives", []) or []
                if item.get("representative_id") == representative_id
            ),
            None,
        )
        if representative:
            representative_name = " ".join(
                part
                for part in (
                    str(representative.get("first_name") or "").strip(),
                    str(representative.get("last_name") or "").strip(),
                )
                if part
            )

    if representative_id:
        label = representative_label(representative_name, representative_id)
        text_value = re.sub(
            rf"(?<!\()\b{re.escape(representative_id)}\b",
            lambda _match: label,
            text_value,
            flags=re.IGNORECASE,
        )

    return text_value

