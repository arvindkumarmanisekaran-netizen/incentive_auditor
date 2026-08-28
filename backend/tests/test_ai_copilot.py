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


REPRESENTATIVE_DETAIL_UTTERANCES = [
    "Fetch me Anika details",
    "Fetch Anika details",
    "Get me Anika details",
    "Get Anika's details",
    "Find Anika details",
    "Show me Anika details",
    "Give me Anika details",
    "Can you fetch Anika details?",
    "Please get Anika details",
    "Fetch details for Anika",
    "Fetch details of Anika",
    "Get representative details for Anika",
    "Show representative information for Anika",
    "Give me the rep profile for Anika",
    "Look up Anika details",
    "Lookup Anika information",
    "Retrieve Anika profile",
    "Display Anika record",
    "Tell me about Anika representative details",
    "Information about Anika",
    "Profile of Anika",
    "Details for Anika",
    "Anika details",
    "Anika representative information",
    "Fetch me Anika rep details",
]


@pytest.mark.parametrize("utterance", REPRESENTATIVE_DETAIL_UTTERANCES)
@pytest.mark.asyncio
async def test_representative_detail_phrasings_route_to_filtered_query(monkeypatch, utterance):
    db = FakeDatabase([])

    async def agent_must_not_run(**_):
        pytest.fail("Representative detail phrasing must bypass investigation classification")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(chat.ChatRequest(message=utterance), db)

    assert response["action"] == "DATA_RESULT"
    assert response["data"]["table"] == "representatives"
    assert db.calls[0][1]["record_name"] == "%Anika%"


GENERIC_REPRESENTATIVE_QUERIES = [
    ("Show representatives", None),
    ("Show all representatives", None),
    ("List representatives", None),
    ("List all reps", None),
    ("Fetch representatives", None),
    ("Fetch all reps", None),
    ("Get representatives", None),
    ("Find representatives", None),
    ("Show active representatives", "Active"),
    ("List active reps", "Active"),
    ("Fetch active representatives", "Active"),
    ("Find active reps", "Active"),
    ("Show inactive representatives", "Inactive"),
    ("List inactive reps", "Inactive"),
    ("Fetch inactive representatives", "Inactive"),
]


@pytest.mark.parametrize(("utterance", "expected_status"), GENERIC_REPRESENTATIVE_QUERIES)
@pytest.mark.asyncio
async def test_generic_representative_queries_never_invent_a_person(monkeypatch, utterance, expected_status):
    db = FakeDatabase([])

    async def agent_must_not_run(**_):
        pytest.fail("Explicit representative table query must bypass the LLM")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(chat.ChatRequest(message=utterance), db)

    assert response["action"] == "DATA_RESULT"
    assert "record_name" not in db.calls[0][1]
    assert db.calls[0][1].get("status") == expected_status


TABLE_ALIAS_CASES = [
    ("representative", "representatives"),
    ("reps", "representatives"),
    ("doctor", "doctors"),
    ("doctors", "doctors"),
    ("product", "products"),
    ("products", "products"),
    ("territory", "territories"),
    ("territories", "territories"),
    ("assignment", "representative_doctor_assignments"),
    ("sales", "sales"),
    ("prescriptions", "prescriptions"),
    ("payouts", "incentive_payouts"),
]


@pytest.mark.parametrize(("alias", "table"), TABLE_ALIAS_CASES)
def test_governed_table_aliases_are_resolved(alias, table):
    assert chat.requested_table(f"Show {alias}", {}) == table


DETERMINISTIC_COMMAND_CASES = [
    ("Run root cause analysis", "ROOT_CAUSE_ANALYSIS"),
    ("Drill down into the causes", "ROOT_CAUSE_ANALYSIS"),
    ("Investigate further", "ROOT_CAUSE_ANALYSIS"),
    ("Focus the highest-severity chart", "CHART_INSIGHT"),
    ("Explain chart", "CHART_INSIGHT"),
    ("Which bar is highest?", "CHART_INSIGHT"),
    ("Run reviewer checks", "REVIEW_ASSISTANCE"),
    ("Check for missing evidence", "REVIEW_ASSISTANCE"),
    ("Review the investigation evidence", "REVIEW_ASSISTANCE"),
    ("Compare with peers", "PEER_COMPARISON"),
    ("Peer comparison", "PEER_COMPARISON"),
    ("Give me a summary of the findings", "FINDINGS_SUMMARY"),
    ("Summarize the findings", "FINDINGS_SUMMARY"),
    ("Print investigation summary", "PRINT_SUMMARY"),
    ("Export summary", "PRINT_SUMMARY"),
]


@pytest.mark.parametrize(("utterance", "expected_action"), DETERMINISTIC_COMMAND_CASES)
@pytest.mark.asyncio
async def test_context_commands_bypass_llm_and_keep_investigation(monkeypatch, utterance, expected_action):
    async def agent_must_not_run(**_):
        pytest.fail("Governed context command must not be reclassified by the LLM")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(
        chat.ChatRequest(message=utterance, context=investigation_context()), FakeDatabase()
    )

    assert response["action"] == expected_action


FOCUSED_FINDING_CASES = [
    "Explain this finding",
    "Explain current finding",
    "Why was P022 flagged?",
    "Explain P022",
    "Explain sales prescription mismatch",
    "Tell me about this finding",
    "What evidence supports this finding?",
    "Why was this finding created?",
    "Explain the P022 finding",
    "Finding details for P022",
]


@pytest.mark.parametrize("utterance", FOCUSED_FINDING_CASES)
def test_finding_selection_remains_on_focused_p022(utterance):
    response = chat.explain_finding(investigation_context(), utterance)

    assert response["action"] == "FINDING_EXPLANATION"
    assert response["finding"]["product_id"] == "P022"
    assert response["finding"]["type"] == "sales_prescription_mismatch"


PEER_TABLE_UTTERANCES = [
    "Show me a table of the peers",
    "Show peer table",
    "List peers in a table",
    "Table of peer comparisons",
    "Show the peer comparison table",
    "List peer results",
    "Show peers",
    "Peer table please",
]


@pytest.mark.parametrize("utterance", PEER_TABLE_UTTERANCES)
@pytest.mark.asyncio
async def test_peer_table_phrasings_return_table_display(monkeypatch, utterance):
    async def agent_must_not_run(**_):
        pytest.fail("Peer table phrasing must not restart an investigation")

    monkeypatch.setattr(chat, "investigation_chat_agent", agent_must_not_run)
    response = await chat.investigation_chat(
        chat.ChatRequest(message=utterance, context=investigation_context()), FakeDatabase()
    )

    assert response["action"] == "PEER_COMPARISON"
    assert response["display"] == "table"


REPRESENTATIVE_FILTER_CASES = [
    ("I want Anika", "Anika"),
    ("Only Anika", "Anika"),
    ("Just Anika", "Anika"),
    ("Get Anika Tailor details", "Anika Tailor"),
    ("Fetch FR0027 representative details", "FR0027"),
    ("Details for Anika Tailor", "Anika Tailor"),
    ("Show active representatives", None),
    ("Fetch all reps", None),
]


@pytest.mark.parametrize(("utterance", "expected_filter"), REPRESENTATIVE_FILTER_CASES)
def test_representative_name_and_id_extraction(utterance, expected_filter):
    assert chat.representative_filter(utterance, {}) == expected_filter
