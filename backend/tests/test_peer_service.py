from datetime import date

import pytest

from backend.app.services.peer_service import PeerService
from backend.app.utils.peer_metrics import calculate_peer_comparison


class _Mappings:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _Mappings(self._rows)


class _RecordingSession:
    def __init__(self, rows):
        self.rows = rows
        self.statement = ""
        self.parameters = {}

    async def execute(self, statement, parameters):
        self.statement = str(statement)
        self.parameters = parameters
        return _Result(self.rows)


@pytest.mark.asyncio
async def test_product_peer_metrics_aggregate_sources_before_joining():
    session = _RecordingSession(
        [{
            "representative_id": "R2",
            "product_id": "P1",
            "sales": 125,
            "units": 5,
            "rx": 3,
            "payout": 20,
        }]
    )
    service = PeerService(session)

    rows = await service.get_product_peer_metrics(
        [
            {"representative_id": "R2", "product_id": "P1"},
            {"representative_id": "R2", "product_id": "P1"},
        ],
        date(2026, 1, 1),
        date(2026, 7, 31),
    )

    assert rows[0]["sales"] == 125
    assert session.statement.count("sales_agg AS") == 1
    assert session.statement.count("rx_agg AS") == 1
    assert session.statement.count("payout_agg AS") == 1
    assert "EXISTS (" in session.statement
    assert "representative_doctor_assignments" in session.statement
    assert "p.doctor_id = s.doctor_id" not in session.statement
    assert "ip.product_id = s.product_id" not in session.statement
    assert session.parameters["representative_id_0"] == "R2"
    assert session.parameters["product_id_0"] == "P1"
    assert "representative_id_1" not in session.parameters


@pytest.mark.asyncio
async def test_territory_peer_metrics_keep_all_requested_peer_product_pairs():
    session = _RecordingSession([])
    service = PeerService(session)

    await service.get_peer_metrics(
        ["R3", "R2", "R2"],
        ["P2", "P1", "P1"],
        date(2026, 1, 1),
        date(2026, 7, 31),
    )

    assert "CROSS JOIN products" in session.statement
    assert session.parameters["peer_ids"] == ["R2", "R3"]
    assert session.parameters["product_ids"] == ["P1", "P2"]
    assert "s.selling_territory_id" not in session.statement


def test_peer_average_includes_qualifying_zero_sales_peer():
    result = calculate_peer_comparison(
        {"P1": {"sales": 75, "rx": 4, "payout": 10}},
        [
            {"representative_id": "R2", "product_id": "P1", "sales": 100, "rx": 2, "payout": 20},
            {"representative_id": "R3", "product_id": "P1", "sales": 0, "rx": 0, "payout": 0},
        ],
    )

    assert result["products"]["P1"]["peer_group_size"] == 2
    assert result["products"]["P1"]["peer_average"]["sales"] == 50
