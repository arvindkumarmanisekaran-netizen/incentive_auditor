from fastapi import (
    APIRouter,
    Depends,
)

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
# AI INVESTIGATION
# ==================================================


@router.get("/ai-summary")
async def ai_investigation_summary(
    representative_id: str,
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):

    # --------------------------------------------------
    # Step 1:
    # Run deterministic analytics
    # --------------------------------------------------

    investigation_data = await investigate(
        db=db,
        representative_id=representative_id,
        start_date=start_date,
        end_date=end_date,
    )

    if not investigation_data:

        return {"error": "Investigation failed"}

    # --------------------------------------------------
    # Step 2:
    # Prepare LangGraph input
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
        # NEW
        "investigation_plan": {},
        "sales_rx_analysis": {},
        "doctor_territory_analysis": {},
        "payout_analysis": {},
        "final_report": {},
    }

    # --------------------------------------------------
    # Step 3:
    # Execute LangGraph
    # --------------------------------------------------

    graph_result = await investigation_graph.ainvoke(graph_input)

    # --------------------------------------------------
    # Step 4:
    # Response
    # --------------------------------------------------

    print("FINAL GRAPH STATE")

    print(graph_result.get("investigation_plan"))

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
        "overall_risk_score": investigation_data.get(
            "overall_risk_score",
            0,
        ),
        "overall_severity": investigation_data.get(
            "overall_severity",
            "NORMAL",
        ),
        # NEW
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
    }
