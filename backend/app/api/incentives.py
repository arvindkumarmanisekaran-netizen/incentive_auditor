from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db

from ..services.incentive_service import (
    calculate_incentives,
)


router = APIRouter(

    prefix="/api/incentives",

    tags=[
        "Incentives"
    ],

)


@router.get("/calculate")
async def calculate_incentives_api(

    month: Annotated[
        str,

        Query(

            pattern=r"^\d{4}-(0[1-9]|1[0-2])$",

            examples=[
                "2026-07"
            ],

            description="Incentive month in YYYY-MM format",
        ),
    ],

    db: AsyncSession = Depends(get_db),

):

    return await calculate_incentives(

        db=db,

        month=month,

    )