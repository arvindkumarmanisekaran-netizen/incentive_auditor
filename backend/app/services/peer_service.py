from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession


class PeerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_territory_peers(self, representative_id: str):
        query = text("""
            SELECT DISTINCT r2.representative_id
            FROM representatives r1
            JOIN representatives r2 ON r2.territory_id = r1.territory_id
            WHERE r1.representative_id = :representative_id
              AND r2.representative_id != :representative_id
            ORDER BY r2.representative_id
        """)
        result = await self.db.execute(query, {"representative_id": representative_id})
        return [row.representative_id for row in result]

    async def find_product_peers(
        self,
        representative_id: str,
        product_ids: list[str],
    ):
        if not product_ids:
            return []

        query = text("""
            SELECT DISTINCT s.product_id, a.representative_id
            FROM sales s
            JOIN representative_doctor_assignments a
              ON a.doctor_id = s.doctor_id
             AND (a.effective_from IS NULL OR a.effective_from <= s.sale_date)
             AND (a.effective_to IS NULL OR a.effective_to >= s.sale_date)
             AND LOWER(COALESCE(a.status, '')) = 'active'
            WHERE s.product_id IN :product_ids
              AND a.representative_id != :representative_id
            ORDER BY s.product_id, a.representative_id
        """).bindparams(bindparam("product_ids", expanding=True))
        result = await self.db.execute(
            query,
            {"representative_id": representative_id, "product_ids": product_ids},
        )
        return [dict(row) for row in result.mappings().all()]

    async def _aggregate_peer_metrics(
        self,
        candidate_pairs_sql: str,
        parameters: dict[str, Any],
        *,
        expanding_parameters: tuple[str, ...] = (),
    ) -> list[dict[str, Any]]:
        """Aggregate metrics independently before combining peer results."""
        query = text(f"""
            WITH candidate_pairs AS (
                {candidate_pairs_sql}
            ),
            sales_agg AS (
                SELECT
                    cp.representative_id,
                    cp.product_id,
                    COALESCE(SUM(s.sales_amount), 0) AS sales,
                    COALESCE(SUM(s.quantity), 0) AS units
                FROM candidate_pairs cp
                LEFT JOIN sales s
                  ON s.product_id = cp.product_id
                 AND s.sale_date BETWEEN :start_date AND :end_date
                 AND EXISTS (
                    SELECT 1
                    FROM representative_doctor_assignments a
                    WHERE a.representative_id = cp.representative_id
                      AND a.doctor_id = s.doctor_id
                      AND (a.effective_from IS NULL OR a.effective_from <= s.sale_date)
                      AND (a.effective_to IS NULL OR a.effective_to >= s.sale_date)
                      AND LOWER(COALESCE(a.status, '')) = 'active'
                 )
                GROUP BY cp.representative_id, cp.product_id
            ),
            rx_agg AS (
                SELECT
                    cp.representative_id,
                    cp.product_id,
                    COUNT(DISTINCT p.prescription_id) AS rx
                FROM candidate_pairs cp
                LEFT JOIN prescriptions p
                  ON p.product_id = cp.product_id
                 AND p.prescription_date BETWEEN :start_date AND :end_date
                 AND EXISTS (
                    SELECT 1
                    FROM representative_doctor_assignments a
                    WHERE a.representative_id = cp.representative_id
                      AND a.doctor_id = p.doctor_id
                      AND (a.effective_from IS NULL OR a.effective_from <= p.prescription_date)
                      AND (a.effective_to IS NULL OR a.effective_to >= p.prescription_date)
                      AND LOWER(COALESCE(a.status, '')) = 'active'
                 )
                GROUP BY cp.representative_id, cp.product_id
            ),
            payout_agg AS (
                SELECT
                    cp.representative_id,
                    cp.product_id,
                    COALESCE(SUM(ip.actual_payout), 0) AS payout
                FROM candidate_pairs cp
                LEFT JOIN incentive_payouts ip
                  ON ip.representative_id = cp.representative_id
                 AND ip.product_id = cp.product_id
                 AND ip.payout_month BETWEEN :start_date AND :end_date
                GROUP BY cp.representative_id, cp.product_id
            )
            SELECT
                cp.representative_id,
                cp.product_id,
                COALESCE(sa.sales, 0) AS sales,
                COALESCE(sa.units, 0) AS units,
                COALESCE(ra.rx, 0) AS rx,
                COALESCE(pa.payout, 0) AS payout
            FROM candidate_pairs cp
            LEFT JOIN sales_agg sa
              ON sa.representative_id = cp.representative_id
             AND sa.product_id = cp.product_id
            LEFT JOIN rx_agg ra
              ON ra.representative_id = cp.representative_id
             AND ra.product_id = cp.product_id
            LEFT JOIN payout_agg pa
              ON pa.representative_id = cp.representative_id
             AND pa.product_id = cp.product_id
            ORDER BY cp.product_id, cp.representative_id
        """)
        if expanding_parameters:
            query = query.bindparams(
                *(bindparam(name, expanding=True) for name in expanding_parameters)
            )
        result = await self.db.execute(query, parameters)
        return [dict(row) for row in result.mappings().all()]

    async def get_product_peer_metrics(
        self,
        product_peer_pairs: list[dict],
        start_date,
        end_date,
    ):
        unique_pairs = sorted(
            {
                (str(item["representative_id"]), str(item["product_id"]))
                for item in product_peer_pairs
                if item.get("representative_id") and item.get("product_id")
            }
        )
        if not unique_pairs:
            return []

        pair_selects: list[str] = []
        parameters: dict[str, Any] = {"start_date": start_date, "end_date": end_date}
        for index, (representative_id, product_id) in enumerate(unique_pairs):
            pair_selects.append(
                f"SELECT :representative_id_{index} AS representative_id, "
                f":product_id_{index} AS product_id"
            )
            parameters[f"representative_id_{index}"] = representative_id
            parameters[f"product_id_{index}"] = product_id

        return await self._aggregate_peer_metrics(
            " UNION ALL ".join(pair_selects),
            parameters,
        )

    async def get_peer_metrics(
        self,
        peer_ids: list[str],
        product_ids: list[str],
        start_date,
        end_date,
    ):
        unique_peer_ids = sorted({str(peer_id) for peer_id in peer_ids if peer_id})
        unique_product_ids = sorted({str(product_id) for product_id in product_ids if product_id})
        if not unique_peer_ids or not unique_product_ids:
            return []

        return await self._aggregate_peer_metrics(
            """
                SELECT r.representative_id, p.product_id
                FROM representatives r
                CROSS JOIN products p
                WHERE r.representative_id IN :peer_ids
                  AND p.product_id IN :product_ids
            """,
            {
                "peer_ids": unique_peer_ids,
                "product_ids": unique_product_ids,
                "start_date": start_date,
                "end_date": end_date,
            },
            expanding_parameters=("peer_ids", "product_ids"),
        )
