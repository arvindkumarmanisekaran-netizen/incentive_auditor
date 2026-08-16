from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..services.investigation_service import investigate
from ..graph.workflow import investigation_graph


router = APIRouter(
    prefix="/api/investigation",
    tags=["Investigation"],
)


@router.get("/summary")
def investigation_summary(
    representative_id: str,
    product_id: str,
    month: str = Query(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    db: Session = Depends(get_db),
):
    return investigate(
        db=db,
        representative_id=representative_id,
        product_id=product_id,
        month=month,
    )


@router.get("/ai-summary")
async def ai_investigation_summary(
    representative_id: str,
    product_id: str,
    month: str = Query(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------
    # Step 1: Run deterministic Python analytics
    # --------------------------------------------------

    investigation_data = investigate(
        db=db,
        representative_id=representative_id,
        product_id=product_id,
        month=month,
    )

    # --------------------------------------------------
    # Step 2: Prepare LangGraph state
    # --------------------------------------------------

    graph_input = {
        "representative_id":
            investigation_data["representative_id"],

        "product_id":
            investigation_data["product_id"],

        "month":
            investigation_data["month"],

        "findings":
            investigation_data["findings"],

        "overall_risk_score":
            investigation_data["overall_risk_score"],

        "overall_severity":
            investigation_data["overall_severity"],

        "sales_rx_analysis": {},

        "doctor_territory_analysis": {},

        "payout_analysis": {},

        "final_report": {},
    }

    # --------------------------------------------------
    # Step 3: Invoke LangGraph
    # --------------------------------------------------

    graph_result = await investigation_graph.ainvoke(
        graph_input
    )

    # --------------------------------------------------
    # Step 4: Return analytics + AI explanation
    # --------------------------------------------------

    return graph_result
