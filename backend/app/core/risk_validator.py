from typing import Any

ALLOWED_SEVERITIES = {
    "NORMAL",
    "LOW",
    "MEDIUM",
    "HIGH",
    "UNKNOWN",
}


SEVERITY_SCORES = {
    "NORMAL": 0,
    "LOW": 25,
    "MEDIUM": 50,
    "HIGH": 75,
    "UNKNOWN": 0,
}


FORBIDDEN_PEER_TERMS = {
    "peer anomaly",
    "peer risk",
    "peer deviation",
    "peer benchmark issue",
    "below peer average",
    "above peer average",
    "peer comparison indicates risk",
    "peer variance requires investigation",
    "low peer percentile",
    "high peer percentile",
    "vary relative to peer averages",
}

FORBIDDEN_RISK_LANGUAGE = {
    "fraud",
    "fraud occurred",
    "committed fraud",
    "misconduct",
    "wrongdoing",
    "fabrication",
    "fabricated",
    "false claim",
    "manipulation",
    "manipulated",
    "intentional abuse",
    "criminal",
}

REQUIRED_FIELDS = {
    "overall_risk_score",
    "overall_severity",
    "overall_assessment",
    "top_risk_drivers",
    "specialist_summary",
    "recommended_actions",
    "human_review_required",
}


REQUIRED_SPECIALIST_FIELDS = {
    "sales_rx",
    "doctor_territory",
    "payout",
    "peer_analysis",
}


def scan_peer_terms(
    value: Any,
    path: str = "",
) -> list[str]:

    errors = []

    if isinstance(value, str):

        lowered = value.lower()

        for term in FORBIDDEN_PEER_TERMS:

            if term in lowered:

                errors.append(f"Peer contamination at {path}: {term}")

    elif isinstance(value, list):

        for index, item in enumerate(value):

            errors.extend(
                scan_peer_terms(
                    item,
                    f"{path}[{index}]",
                )
            )

    elif isinstance(value, dict):

        for key, item in value.items():

            errors.extend(
                scan_peer_terms(
                    item,
                    f"{path}.{key}",
                )
            )

    return errors


def scan_forbidden_language(
    value: Any,
    path: str = "",
) -> list[str]:

    errors = []

    if isinstance(value, str):

        lowered = value.lower()

        for term in FORBIDDEN_RISK_LANGUAGE:

            if term in lowered:

                errors.append(f"Forbidden risk language at {path}: {term}")

    elif isinstance(value, list):

        for index, item in enumerate(value):

            errors.extend(
                scan_forbidden_language(
                    item,
                    f"{path}[{index}]",
                )
            )

    elif isinstance(value, dict):

        for key, item in value.items():

            errors.extend(
                scan_forbidden_language(
                    item,
                    f"{path}.{key}",
                )
            )

    return errors


def validate_risk_synthesis(
    report: dict[str, Any],
) -> dict[str, Any]:
    """
    Validate final risk synthesizer output.

    Protects against:
    - hallucinated risk drivers
    - peer benchmark contamination
    - invalid scoring
    - malformed specialist summaries
    """

    errors = []

    # -----------------------------------
    # Required top-level fields
    # -----------------------------------

    missing = REQUIRED_FIELDS - report.keys()

    if missing:
        errors.append(f"Missing fields: {list(missing)}")

    # -----------------------------------
    # Severity validation
    # -----------------------------------

    severity = report.get(
        "overall_severity",
        "UNKNOWN",
    )

    if severity not in ALLOWED_SEVERITIES:

        errors.append(f"Invalid severity: {severity}")

        severity = "UNKNOWN"

        report["overall_severity"] = severity

    # -----------------------------------
    # Force deterministic risk score
    # -----------------------------------

    expected_score = SEVERITY_SCORES.get(
        severity,
        0,
    )

    report["overall_risk_score"] = expected_score

    # -----------------------------------
    # Validate top risk drivers
    # -----------------------------------

    drivers = report.get(
        "top_risk_drivers",
        [],
    )

    if not isinstance(drivers, list):

        errors.append("top_risk_drivers must be a list")

        report["top_risk_drivers"] = []

    else:

        cleaned = []

        for item in drivers:

            if not isinstance(item, str):
                continue

            lowered = item.lower()

            if any(term in lowered for term in FORBIDDEN_PEER_TERMS):

                errors.append(f"Peer contamination removed: {item}")

                continue

            cleaned.append(item)

        report["top_risk_drivers"] = cleaned

    # -----------------------------------
    # Validate recommendations
    # -----------------------------------

    actions = report.get(
        "recommended_actions",
        [],
    )

    if not isinstance(actions, list):

        errors.append("recommended_actions must be a list")

        report["recommended_actions"] = []

    else:

        cleaned_actions = []

        for action in actions:

            if not isinstance(action, str):
                continue

            lowered = action.lower()

            if any(term in lowered for term in FORBIDDEN_PEER_TERMS):

                errors.append(f"Peer contamination removed from action: {action}")

                continue

            cleaned_actions.append(action)

        report["recommended_actions"] = cleaned_actions

    # -----------------------------------
    # Specialist summary validation
    # -----------------------------------

    summary = report.get(
        "specialist_summary",
        {},
    )

    if not isinstance(summary, dict):

        errors.append("specialist_summary must be object")

        report["specialist_summary"] = {}

    else:

        missing_summary = REQUIRED_SPECIALIST_FIELDS - summary.keys()

        if missing_summary:

            errors.append(f"Missing specialist sections: {missing_summary}")

    # -----------------------------------
    # Forbidden risk language validation
    # -----------------------------------

    language_errors = scan_forbidden_language(report)

    if language_errors:
        errors.extend(language_errors)

    # -----------------------------------
    # Scan peer terms
    # -----------------------------------

    peer_terms_errors = scan_peer_terms(report)

    if peer_terms_errors:
        errors.extend(peer_terms_errors)

    # -----------------------------------
    # Attach validation metadata
    # -----------------------------------

    report["_validation"] = {
        "passed": len(errors) == 0,
        "errors": errors,
    }

    return report
