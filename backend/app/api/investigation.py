from fastapi import (
    APIRouter,
    Depends,
    Query,
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
    tags=[
        "Investigation"
    ],
)


# ==================================================
# BASIC INVESTIGATION
# ==================================================

@router.get("/summary")
async def investigation_summary(

    representative_id: str,

    product_id: str,

    month: str = Query(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),

    db: AsyncSession = Depends(get_db),

):

    return await investigate(

        db=db,

        representative_id=representative_id,

        product_id=product_id,

        month=month,

    )


# ==================================================
# AI INVESTIGATION
# ==================================================

@router.get("/ai-summary")
async def ai_investigation_summary(

    representative_id: str,

    product_id: str,

    month: str = Query(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),

    db: AsyncSession = Depends(get_db),

):

    # --------------------------------------------------
    # Step 1:
    # Run deterministic analytics
    # --------------------------------------------------

    investigation_data = await investigate(

        db=db,

        representative_id=representative_id,

        product_id=product_id,

        month=month,

    )

    if not investigation_data:

        return {

            "error":
                "Investigation failed"

        }

    # --------------------------------------------------
    # Step 2:
    # Prepare LangGraph input
    # --------------------------------------------------

    graph_input = {

        "representative_id":
            investigation_data.get(
                "representative_id"
            ),


        "product_id":
            investigation_data.get(
                "product_id"
            ),


        "month":
            investigation_data.get(
                "month"
            ),


        "findings":
            investigation_data.get(
                "findings",
                []
            ),


        "overall_risk_score":
            investigation_data.get(
                "overall_risk_score",
                0
            ),


        "overall_severity":
            investigation_data.get(
                "overall_severity",
                "NORMAL"
            ),


        "sales_rx_analysis":
            {},


        "doctor_territory_analysis":
            {},


        "payout_analysis":
            {},


        "final_report":
            {},

    }

    # --------------------------------------------------
    # Step 3:
    # Execute LangGraph
    # --------------------------------------------------

    graph_result = await investigation_graph.ainvoke(
        graph_input
    )

    # --------------------------------------------------
    # Step 4:
    # Flatten response for frontend
    # --------------------------------------------------

    return {

        "representative_id":
            investigation_data["representative_id"],

        "product_id":
            investigation_data["product_id"],

        "month":
            investigation_data["month"],


        "findings":
            investigation_data.get(
                "findings",
                []
            ),


        "overall_risk_score":
            investigation_data.get(
                "overall_risk_score",
                0
            ),


        "overall_severity":
            investigation_data.get(
                "overall_severity",
                "NORMAL"
            ),


        "sales_rx_analysis":
            graph_result.get(
                "sales_rx_analysis",
                {}
            ),

        "doctor_territory_analysis":
            graph_result.get(
                "doctor_territory_analysis",
                {}
            ),

        "payout_analysis":
            graph_result.get(
                "payout_analysis",
                {}
            ),

        "final_report":
            graph_result.get(
                "final_report",
                {}
            ),
    }