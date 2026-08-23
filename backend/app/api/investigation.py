import json

from fastapi import (
    APIRouter,
    Depends,
)

from fastapi.responses import StreamingResponse

from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

from ..services.investigation_service import (
    investigate,
)

from ..graph.workflow import (
    investigation_graph,
)

router = APIRouter(
    prefix="/api/investigation",
    tags=["Investigation"],
)


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
# AI INVESTIGATION - EXISTING NON-STREAMING VERSION
# ==================================================


@router.get("/ai-summary")
async def ai_investigation_summary(
    representative_id: str,
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):

    investigation_data = await investigate(
        db=db,
        representative_id=representative_id,
        start_date=start_date,
        end_date=end_date,
    )

    if not investigation_data:
        return {"error": "Investigation failed"}

    graph_input = {
        "representative_id": investigation_data.get("representative_id"),
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

    graph_result = await investigation_graph.ainvoke(graph_input)

    return {
        "representative_id": investigation_data.get("representative_id"),
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
        "overall_risk_score": graph_result.get(
            "overall_risk_score",
            investigation_data.get(
                "overall_risk_score",
                0,
            ),
        ),
        "overall_severity": graph_result.get(
            "overall_severity",
            investigation_data.get(
                "overall_severity",
                "NORMAL",
            ),
        ),
        "investigation_plan": graph_result.get(
            "investigation_plan",
            {},
        ),
        "sales_rx_analysis": graph_result.get(
            "sales_rx_analysis",
            {},
        ),
        "doctor_territory_analysis": graph_result.get(
            "doctor_territory_analysis",
            {},
        ),
        "payout_analysis": graph_result.get(
            "payout_analysis",
            {},
        ),
        "final_report": graph_result.get(
            "final_report",
            {},
        ),
        "investigation_summary": graph_result.get(
            "investigation_summary",
            {},
        ),
    }


# ==================================================
# AI INVESTIGATION - LIVE STREAMING VERSION
# ==================================================


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

    graph_input = {
        "representative_id": investigation_data.get("representative_id"),
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
