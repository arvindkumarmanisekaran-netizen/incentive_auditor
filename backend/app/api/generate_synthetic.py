from fastapi.responses import FileResponse
from fastapi import (
    APIRouter,
)
from ..services.synthetic_data_service import (
    generate_synthetic_dataset,
)

router = APIRouter(
    prefix="/api/generate-synthetic",
    tags=["Generate-Synthetic"],
)


@router.post("")
async def generate_synthetic():

    zip_file = generate_synthetic_dataset()

    return FileResponse(
        path=zip_file,
        filename="synthetic_dataset.zip",
        media_type="application/zip",
    )
