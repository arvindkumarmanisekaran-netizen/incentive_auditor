import sys
from types import ModuleType

import pytest

test_session_module = ModuleType("app.db.session")
test_session_module.get_db = lambda: None
sys.modules["app.db.session"] = test_session_module

test_agent_module = ModuleType("app.agents.investigation_chat_agent")


async def unconfigured_agent(**_):
    raise AssertionError("Each dispatcher test must explicitly configure or bypass the intent agent")


test_agent_module.investigation_chat_agent = unconfigured_agent
sys.modules["app.agents.investigation_chat_agent"] = test_agent_module

from app.api import chat


class FakeRows:
    def __init__(self, records):
        self.records = records

    def mappings(self):
        return self

    def all(self):
        return self.records


class FakeDatabase:
    def __init__(self, records=None):
        self.records = records or []
        self.calls = []

    async def execute(self, statement, parameters=None):
        self.calls.append((str(statement), parameters or {}))
        return FakeRows(self.records)


def investigation_context():
    focused = {
        "type": "sales_prescription_mismatch",
        "product_id": "P022",
        "severity": "MEDIUM",
        "evidence": {"mismatch_score": 55.09, "current_sales": 35893.56},
    }
    return chat.InvestigationContext(
        representative_id="FR0027",
        representative_name="Anika Tailor",
        start_date="2026-07-01",
        end_date="2026-07-31",
        focused_finding=focused,
        result={
            "findings": [
                {"type": "sales_deviation", "product_id": "P013", "severity": "NORMAL", "evidence": {"deviation_percent": -0.58}},
                focused,
            ],
            "peer_analysis": {
                "product_peer_comparison": {
                    "products": {
                        "P022": {
                            "product_name": "InventoreCare 22 (P022)",
                            "peer_group_size": 9,
                            "difference_percentage": {"sales": -72.9, "rx": 1561.54, "payout": -94.58},
                            "severity": "NORMAL",
                        }
                    }
                }
            },
        },
    )


@pytest.mark.asyncio
async def test_fetch_named_representative_is_read_only_query(monkeypatch):
    db = FakeDatabase([{"representative_id": "FR0027", "first_name": "Anika", "last_name": "Tailor", "territory_id": "T049", "status": "Active"}])

    async def agent_must_not_run(**_):
        pytest.fail("A direct representative-details request must not enter investigation intent classification")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(chat.ChatRequest(message="Fetch me Anika rep details"), db)

    assert response["action"] == "DATA_RESULT"
    assert response["data"]["records"][0]["representative_id"] == "FR0027"
    assert db.calls[0][1]["record_name"] == "%Anika%"
    assert "first_name || ' ' || last_name" in db.calls[0][0]


@pytest.mark.asyncio
async def test_active_representatives_query_does_not_invent_name_filter(monkeypatch):
    db = FakeDatabase([])

    async def agent_must_not_run(**_):
        pytest.fail("A direct table query must not call the LLM")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(chat.ChatRequest(message="Show active representatives"), db)

    assert response["action"] == "DATA_RESULT"
    assert db.calls[0][1]["status"] == "Active"
    assert "record_name" not in db.calls[0][1]


@pytest.mark.asyncio
async def test_terse_name_followup_keeps_previous_query_table(monkeypatch):
    db = FakeDatabase([{"representative_id": "FR0027", "first_name": "Anika", "last_name": "Tailor", "territory_id": "T049", "status": "Active"}])

    async def database_intent(**_):
        return {"intent": "DATABASE_QUERY", "entities": {}}

    monkeypatch.setattr(chat, "investigation_chat_agent", database_intent)
    request = chat.ChatRequest(
        message="I want Anika",
        conversation=[
            {"role": "user", "content": "Show representative records"},
            {"role": "assistant", "content": "Found 20 representatives records."},
        ],
    )
    response = await chat.investigation_chat(request, db)

    assert response["action"] == "DATA_RESULT"
    assert db.calls[0][1]["record_name"] == "%Anika%"


@pytest.mark.asyncio
async def test_peer_table_followup_does_not_restart_investigation(monkeypatch):
    async def agent_must_not_run(**_):
        pytest.fail("Deterministic peer follow-up must not call the LLM")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(
        chat.ChatRequest(message="Show me a table of the peers", context=investigation_context()), FakeDatabase()
    )

    assert response["action"] == "PEER_COMPARISON"
    assert response["display"] == "table"
    assert response["peer_comparisons"][0]["product"] == "InventoreCare 22 (P022)"


@pytest.mark.asyncio
async def test_explain_this_finding_uses_focused_finding(monkeypatch):
    async def agent_must_not_run(**_):
        pytest.fail("Focused finding follow-up must not call the LLM")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(
        chat.ChatRequest(message="Explain this finding", context=investigation_context()), FakeDatabase()
    )

    assert response["action"] == "FINDING_EXPLANATION"
    assert response["finding"]["product_id"] == "P022"
    assert "Sales Prescription Mismatch" in response["message"]


@pytest.mark.asyncio
async def test_missing_date_returns_date_picker_action(monkeypatch):
    async def investigation_intent(**_):
        return {"intent": "INVESTIGATION_REQUEST", "entities": {"representative_name": "Anika"}}

    async def resolved(*_):
        return {"found": True, "representative_id": "FR0027", "representative_name": "Anika Tailor"}

    monkeypatch.setattr(chat, "investigation_chat_agent", investigation_intent)
    monkeypatch.setattr(chat, "resolve_representative", resolved)
    response = await chat.investigation_chat(chat.ChatRequest(message="Investigate Anika"), FakeDatabase())

    assert response["action"] == "NEED_DATE"
    assert response["representative_id"] == "FR0027"


@pytest.mark.asyncio
async def test_general_question_returns_bounded_answer(monkeypatch):
    async def general_intent(**_):
        return {"intent": "GENERAL_QUERY", "entities": {}, "message": "I am the investigation copilot."}

    monkeypatch.setattr(chat, "investigation_chat_agent", general_intent)
    response = await chat.investigation_chat(chat.ChatRequest(message="What is your name?"), FakeDatabase())

    assert response["action"] == "ANSWER"
    assert response["message"] == "I am the investigation copilot."
