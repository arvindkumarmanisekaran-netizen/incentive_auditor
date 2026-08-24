from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession


class PeerService:

    def __init__(
        self,
        db: AsyncSession,
    ):
        self.db = db

    # ======================================================
    # TERRITORY PEERS
    # Same territory representatives
    # ======================================================

    async def find_territory_peers(
        self,
        representative_id: str,
    ):

        query = text("""
            SELECT DISTINCT

                r2.representative_id

            FROM representatives r1

            JOIN representatives r2

                ON r2.territory_id = r1.territory_id

            WHERE

                r1.representative_id = :representative_id

            AND

                r2.representative_id != :representative_id

            ORDER BY

                r2.representative_id
            """)

        result = await self.db.execute(
            query,
            {
                "representative_id": representative_id,
            },
        )

        return [row.representative_id for row in result]

    # ======================================================
    # PRODUCT PEERS
    # Same product handled by other representatives
    # ======================================================

    async def find_product_peers(
        self,
        representative_id: str,
        product_ids: list[str],
    ):

        if not product_ids:
            return []

        query = text("""
            SELECT DISTINCT

                s.product_id,

                r2.representative_id


            FROM representatives r1


            JOIN sales s

                ON s.selling_territory_id =
                   r1.territory_id


            JOIN sales s2

                ON s2.product_id =
                   s.product_id


            JOIN representatives r2

                ON r2.territory_id =
                   s2.selling_territory_id


            WHERE

                r1.representative_id =
                :representative_id


            AND

                s.product_id IN :product_ids


            AND

                r2.representative_id !=
                :representative_id


            ORDER BY

                s.product_id,

                r2.representative_id
            """).bindparams(
            bindparam(
                "product_ids",
                expanding=True,
            )
        )

        result = await self.db.execute(
            query,
            {
                "representative_id": representative_id,
                "product_ids": product_ids,
            },
        )

        return [dict(row) for row in result.mappings().all()]

    # ======================================================
    # PRODUCT PEER METRICS
    # Representative level aggregation
    # ======================================================

    async def get_product_peer_metrics(
        self,
        product_peer_pairs: list[dict],
        start_date,
        end_date,
    ):

        if not product_peer_pairs:
            return []

        peer_ids = list(
            {
                item["representative_id"]
                for item in product_peer_pairs
                if item.get("representative_id")
            }
        )

        product_ids = list(
            {item["product_id"] for item in product_peer_pairs if item.get("product_id")}
        )

        if not peer_ids or not product_ids:
            return []

        query = text("""
            SELECT

                r.representative_id,

                s.product_id,


                COALESCE(
                    SUM(s.sales_amount),
                    0
                ) AS sales,


                COALESCE(
                    SUM(s.quantity),
                    0
                ) AS units,


                COUNT(
                    DISTINCT p.prescription_id
                ) AS rx,


                COALESCE(
                    SUM(ip.actual_payout),
                    0
                ) AS payout


            FROM representatives r


            JOIN sales s

                ON s.selling_territory_id =
                   r.territory_id


            LEFT JOIN prescriptions p

                ON p.doctor_id =
                   s.doctor_id

                AND p.product_id =
                    s.product_id

                AND p.prescription_date BETWEEN
                    :start_date
                    AND
                    :end_date


            LEFT JOIN incentive_payouts ip

                ON ip.representative_id =
                   r.representative_id

                AND ip.product_id =
                    s.product_id

                AND ip.payout_month BETWEEN
                    :start_date
                    AND
                    :end_date


            WHERE

                r.representative_id IN :peer_ids


            AND

                s.product_id IN :product_ids


            AND

                s.sale_date BETWEEN
                    :start_date
                    AND
                    :end_date


            GROUP BY

                r.representative_id,

                s.product_id


            ORDER BY

                s.product_id,

                r.representative_id
            """).bindparams(
            bindparam(
                "peer_ids",
                expanding=True,
            ),
            bindparam(
                "product_ids",
                expanding=True,
            ),
        )

        result = await self.db.execute(
            query,
            {
                "peer_ids": peer_ids,
                "product_ids": product_ids,
                "start_date": start_date,
                "end_date": end_date,
            },
        )

        return [dict(row) for row in result.mappings().all()]

    # ======================================================
    # GENERIC PEER METRICS
    # Territory/product fallback
    # ======================================================

    async def get_peer_metrics(
        self,
        peer_ids: list[str],
        product_ids: list[str],
        start_date,
        end_date,
    ):

        if not peer_ids or not product_ids:
            return []

        query = text("""
            SELECT

                r.representative_id,

                s.product_id,


                COALESCE(
                    SUM(s.sales_amount),
                    0
                ) AS sales,


                COALESCE(
                    SUM(s.quantity),
                    0
                ) AS units,


                COUNT(
                    DISTINCT p.prescription_id
                ) AS rx,


                COALESCE(
                    SUM(ip.actual_payout),
                    0
                ) AS payout


            FROM representatives r


            JOIN sales s

                ON s.selling_territory_id =
                   r.territory_id


            LEFT JOIN prescriptions p

                ON p.doctor_id =
                   s.doctor_id

                AND p.product_id =
                    s.product_id

                AND p.prescription_date BETWEEN
                    :start_date
                    AND
                    :end_date


            LEFT JOIN incentive_payouts ip

                ON ip.representative_id =
                   r.representative_id

                AND ip.product_id =
                    s.product_id

                AND ip.payout_month BETWEEN
                    :start_date
                    AND
                    :end_date


            WHERE

                r.representative_id IN :peer_ids


            AND

                s.product_id IN :product_ids


            AND

                s.sale_date BETWEEN
                    :start_date
                    AND
                    :end_date


            GROUP BY

                r.representative_id,

                s.product_id


            ORDER BY

                r.representative_id,

                s.product_id
            """).bindparams(
            bindparam(
                "peer_ids",
                expanding=True,
            ),
            bindparam(
                "product_ids",
                expanding=True,
            ),
        )

        result = await self.db.execute(
            query,
            {
                "peer_ids": peer_ids,
                "product_ids": product_ids,
                "start_date": start_date,
                "end_date": end_date,
            },
        )

        return [dict(row) for row in result.mappings().all()]
