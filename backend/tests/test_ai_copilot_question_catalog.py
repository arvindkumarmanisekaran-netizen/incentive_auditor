import json
from pathlib import Path
import sys
from types import ModuleType

import pytest


test_session_module = ModuleType("app.db.session")
test_session_module.get_db = lambda: None
sys.modules.setdefault("app.db.session", test_session_module)

test_agent_module = ModuleType("app.agents.investigation_chat_agent")
test_agent_module.investigation_chat_agent = lambda **_: None
sys.modules.setdefault("app.agents.investigation_chat_agent", test_agent_module)

from app.api import chat


CATALOG_PATH = Path(__file__).resolve().parents[2] / "docs" / "ai-copilot-1000-question-catalog.json"
CATALOG = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
QUESTIONS = CATALOG["questions"]


class FakeRows:
    def __init__(self, records=None):
        self.records = records or []

    def mappings(self):
        return self

    def all(self):
        return self.records


class FakeDatabase:
    def __init__(self):
        self.calls = []

    async def execute(self, statement, parameters=None):
        self.calls.append((str(statement), parameters or {}))
        return FakeRows()


def context():
    finding = {
        "type": "sales_prescription_mismatch",
        "product_id": "P005",
        "product_name": "MolestiaeCare 5",
        "severity": "MEDIUM",
        "evidence": {"mismatch_score": 20.20, "sales_change_percent": -8.9, "prescription_change_percent": -3.6},
    }
    return chat.InvestigationContext(
        representative_id="FR0011",
        representative_name="Aahana Bassi",
        start_date="2026-07-01",
        end_date="2026-07-31",
        focused_finding=finding,
        result={"findings": [finding], "overall_risk_score": 45, "overall_severity": "MEDIUM"},
    )


TABLE_BY_CATEGORY = {
    "Representative profile and lookup": "representatives",
    "Doctor profile and lookup": "doctors",
    "Product profile and lookup": "products",
    "Territory profile and lookup": "territories",
    "Representative-doctor assignments": "assignments",
}


def expected_intent(category):
    return "DATABASE_QUERY" if category in TABLE_BY_CATEGORY else "ANALYTICAL_QUERY"


@pytest.mark.parametrize("case", QUESTIONS, ids=lambda case: case["id"])
@pytest.mark.asyncio
async def test_all_catalog_phrasings_reach_a_supported_safe_workflow(monkeypatch, case):
    intent = expected_intent(case["category"])

    async def configured_agent(**_):
        entities = {"table": TABLE_BY_CATEGORY[case["category"]]} if intent == "DATABASE_QUERY" else {"topic": case["category"]}
        return {"intent": intent, "entities": entities}

    monkeypatch.setattr(chat, "investigation_chat_agent", configured_agent)
    db = FakeDatabase()
    response = await chat.investigation_chat(
        chat.ChatRequest(message=case["question"], context=context()), db
    )

    assert response["action"] not in {"ANSWER", "ERROR", "NEED_QUERY_SCOPE"}
    assert response.get("message")
    assert not any(sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE", "DROP", "ALTER")) for sql, _ in db.calls)


def test_catalog_is_balanced_unique_and_complete():
    categories = {}
    for case in QUESTIONS:
        categories[case["category"]] = categories.get(case["category"], 0) + 1

    assert CATALOG["total"] == len(QUESTIONS) == 1000
    assert len({case["question"] for case in QUESTIONS}) == 1000
    assert len(categories) == CATALOG["categoryCount"] == 25
    assert set(categories.values()) == {40}


def test_catalog_uses_required_identity_display_conventions():
    joined = "\n".join(case["question"] for case in QUESTIONS)
    assert "MolestiaeCare 5 (P005)" in joined
    assert "Aahana Bassi (FR0011)" in joined
