from typing import Any

FORBIDDEN_SUMMARY_LANGUAGE = {
    "fraud",
    "misconduct",
    "wrongdoing",
    "criminal",
    "manipulation",
    "fabrication",
}


FORBIDDEN_RECOMMENDATIONS = {
    "monitor doctor concentration",
    "investigate doctors",
    "investigate physician",
    "review physician behavior",
    "review representative conduct",
}


REQUIRED_FIELDS = {
    "executive_summary",
    "key_findings",
    "investigation_priorities",
    "recommended_next_actions",
    "human_review_required",
}


def validate_investigation_summary(
    report: dict[str, Any],
) -> dict[str, Any]:

    errors = []

    missing = REQUIRED_FIELDS - report.keys()

    if missing:
        errors.append(f"Missing fields: {list(missing)}")

    def scan(value):

        if isinstance(value, str):

            text = value.lower()

            for term in FORBIDDEN_SUMMARY_LANGUAGE:

                if term in text:
                    errors.append(f"Forbidden language: {term}")

        elif isinstance(value, list):

            for item in value:
                scan(item)

        elif isinstance(value, dict):

            for item in value.values():
                scan(item)

    scan(report)

    actions = report.get(
        "recommended_next_actions",
        [],
    )

    cleaned_actions = []

    for action in actions:

        lower = action.lower()

        blocked = False

        for term in FORBIDDEN_RECOMMENDATIONS:

            if term in lower:

                errors.append(f"Unsupported recommendation removed: {action}")

                blocked = True
                break

        if not blocked:
            cleaned_actions.append(action)

    report["recommended_next_actions"] = cleaned_actions

    report["_validation"] = {
        "passed": len(errors) == 0,
        "errors": errors,
    }

    return report
