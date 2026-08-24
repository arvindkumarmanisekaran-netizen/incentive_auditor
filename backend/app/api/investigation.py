import json

from fastapi import (
    APIRouter,
    Depends,
)

from fastapi.responses import StreamingResponse

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..db.session import get_db

from ..services.investigation_service import (
    investigate,
)

from ..graph.workflow import (
    investigation_graph,
)

from ..services.peer_service import PeerService

router = APIRouter(
    prefix="/api/investigation",
    tags=["Investigation"],
)


async def prepare_peer_analysis_input(
    db: AsyncSession,
    investigation_data: dict,
    representative_id: str,
    start_date: str,
    end_date: str,
):

    peer_service = PeerService(db)

    product_ids = investigation_data.get(
        "products_analyzed",
        [],
    )

    # =======================================
    # TERRITORY PEERS
    # same territory_id
    # =======================================

    territory_peers = await peer_service.find_territory_peers(
        representative_id,
    )

    territory_metrics = await peer_service.get_peer_metrics(
        territory_peers,
        product_ids,
        start_date,
        end_date,
    )

    # =======================================
    # PRODUCT PEERS
    # same products sold elsewhere
    # =======================================

    product_peer_pairs = await peer_service.find_product_peers(
        representative_id,
        product_ids,
    )

    product_metrics = await peer_service.get_product_peer_metrics(
        product_peer_pairs,
        start_date,
        end_date,
    )

    product_peer_ids = list({peer["representative_id"] for peer in product_peer_pairs})

    return {
        "territory_peer_analysis": {
            "peer_ids": territory_peers,
            "peer_group_size": len(territory_peers),
            "peer_metrics": territory_metrics,
        },
        "product_peer_analysis": {
            "peer_ids": product_peer_ids,
            "peer_products": product_peer_pairs,
            "peer_group_size": len(product_peer_ids),
            "peer_metrics": product_metrics,
        },
    }


# ==================================================
# BASIC INVESTIGATION
# ==================================================


@router.get("/summary")
async def investigation_summary(
    representative_id: str,
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):

    return await investigate(
        db=db,
        representative_id=representative_id,
        start_date=start_date,
        end_date=end_date,
    )


# ==================================================
# AI INVESTIGATION - LIVE STREAMING VERSION
# ==================================================


async def get_all_representatives(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
            SELECT *
            FROM representatives
            ORDER BY first_name, last_name
            """))

    return [dict(row) for row in result.mappings().all()]


@router.get("/ai-summary-stream")
async def ai_investigation_summary_stream(
    representative_id: str,
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):

    # --------------------------------------------------
    # Step 1:
    # Run deterministic analytics first
    # --------------------------------------------------

    investigation_data = await investigate(
        db=db,
        representative_id=representative_id,
        start_date=start_date,
        end_date=end_date,
    )

    if not investigation_data:

        async def failed_stream():
            payload = {
                "type": "investigation_error",
                "message": "Investigation failed",
            }

            yield ("event: error\n" f"data: {json.dumps(payload)}\n\n")

        return StreamingResponse(
            failed_stream(),
            media_type="text/event-stream",
        )

    # --------------------------------------------------
    # Step 2:
    # Prepare graph state
    # --------------------------------------------------

    peer_analysis_input = await prepare_peer_analysis_input(
        db=db,
        investigation_data=investigation_data,
        representative_id=representative_id,
        start_date=start_date,
        end_date=end_date,
    )

    representatives = await get_all_representatives(db)

    graph_input = {
        "representative_id": investigation_data.get("representative_id"),
        "representatives": representatives,
        "start_date": investigation_data.get("start_date"),
        "end_date": investigation_data.get("end_date"),
        "products_analyzed": investigation_data.get(
            "products_analyzed",
            [],
        ),
        "peer_analysis_input": peer_analysis_input,
        "findings": investigation_data.get(
            "findings",
            [],
        ),
        "overall_risk_score": investigation_data.get(
            "overall_risk_score",
            0,
        ),
        "overall_severity": investigation_data.get(
            "overall_severity",
            "NORMAL",
        ),
        "investigation_plan": {},
        "sales_rx_analysis": {},
        "doctor_territory_analysis": {},
        "payout_analysis": {},
        "final_report": {},
        "investigation_summary": {},
    }

    # --------------------------------------------------
    # Step 3:
    # Stream workflow events + final result
    # --------------------------------------------------

    async def event_generator():

        final_state = None

        try:

            # Tell frontend that deterministic analytics is done
            initial_event = {
                "type": "investigation_status",
                "status": "analytics_complete",
                "message": (
                    "Deterministic analytics completed. " "Starting AI investigation workflow."
                ),
            }

            yield ("event: workflow\n" f"data: {json.dumps(initial_event, default=str)}\n\n")

            async for stream_mode, data in investigation_graph.astream(
                graph_input,
                stream_mode=[
                    "custom",
                    "values",
                ],
            ):

                # ------------------------------------------
                # Custom commentary emitted by agents
                # ------------------------------------------

                if stream_mode == "custom":

                    yield ("event: workflow\n" f"data: {json.dumps(data, default=str)}\n\n")

                # ------------------------------------------
                # Latest full LangGraph state
                # ------------------------------------------

                elif stream_mode == "values":

                    final_state = data

            # --------------------------------------------------
            # Step 4:
            # Build final response
            # --------------------------------------------------

            if final_state is None:
                raise RuntimeError("Investigation graph completed without a final state.")

            final_result = {
                "representative_id": investigation_data.get("representative_id"),
                "representatives": representatives,
                "start_date": investigation_data.get("start_date"),
                "end_date": investigation_data.get("end_date"),
                "products_analyzed": investigation_data.get(
                    "products_analyzed",
                    [],
                ),
                "findings": investigation_data.get(
                    "findings",
                    [],
                ),
                # Use graph result where available
                "peer_analysis": final_state.get(
                    "peer_analysis",
                    {},
                ),
                "overall_risk_score": final_state.get(
                    "overall_risk_score",
                    investigation_data.get(
                        "overall_risk_score",
                        0,
                    ),
                ),
                "overall_severity": final_state.get(
                    "overall_severity",
                    investigation_data.get(
                        "overall_severity",
                        "NORMAL",
                    ),
                ),
                "investigation_plan": final_state.get(
                    "investigation_plan",
                    {},
                ),
                "sales_rx_analysis": final_state.get(
                    "sales_rx_analysis",
                    {},
                ),
                "doctor_territory_analysis": final_state.get(
                    "doctor_territory_analysis",
                    {},
                ),
                "payout_analysis": final_state.get(
                    "payout_analysis",
                    {},
                ),
                "final_report": final_state.get(
                    "final_report",
                    {},
                ),
                "investigation_summary": final_state.get(
                    "investigation_summary",
                    {},
                ),
            }

            payload = {
                "type": "investigation_result",
                "result": final_result,
            }

            yield ("event: result\n" f"data: {json.dumps(payload, default=str)}\n\n")

        except Exception as exc:

            error_payload = {
                "type": "investigation_error",
                "message": str(exc),
            }

            yield ("event: error\n" f"data: {json.dumps(error_payload, default=str)}\n\n")

    # --------------------------------------------------
    # Step 5:
    # SSE response
    # --------------------------------------------------

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
