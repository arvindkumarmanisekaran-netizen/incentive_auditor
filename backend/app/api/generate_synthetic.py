from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter
from fastapi.responses import (
    FileResponse,
    StreamingResponse,
)

from ..services.synthetic_data_service import (
    generate_synthetic_dataset,
)

from ..services.synthetic_progress import (
    synthetic_progress,
)

router = APIRouter(
    prefix="/api/generate-synthetic",
    tags=["Generate-Synthetic"],
)


# ============================================================
# ACTIVE JOBS
# ============================================================

jobs = {}


# ============================================================
# START GENERATION
# ============================================================


@router.post("/start")
async def start_generation():

    job_id = str(uuid.uuid4())

    synthetic_progress.create_job(job_id)

    async def run_generation():

        loop = asyncio.get_running_loop()

        def progress_callback(message: str):

            asyncio.run_coroutine_threadsafe(
                synthetic_progress.publish(
                    job_id,
                    message,
                ),
                loop,
            )

        try:

            file_path = await asyncio.to_thread(
                generate_synthetic_dataset,
                progress_callback,
            )

            if not file_path.exists():

                raise RuntimeError("Synthetic zip file was not created")

            jobs[job_id] = file_path

            await synthetic_progress.publish(
                job_id,
                "Synthetic dataset ready",
            )

        except Exception as error:

            await synthetic_progress.publish(
                job_id,
                f"Generation failed: {error}",
            )

        finally:

            await synthetic_progress.complete(job_id)

    asyncio.create_task(run_generation())

    return {"job_id": job_id}


# ============================================================
# STREAM PROGRESS
# ============================================================


@router.get("/stream/{job_id}")
async def stream_generation(
    job_id: str,
):

    async def event_generator():

        async for event in synthetic_progress.listen(job_id):

            yield ("data: " + json.dumps(event) + "\n\n")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# ============================================================
# DOWNLOAD
# ============================================================


@router.get("/status/{job_id}")
async def generation_status(
    job_id: str,
):

    file_path = jobs.get(job_id)

    return {
        "ready": file_path is not None,
    }


@router.get("/download/{job_id}")
async def download_generation(
    job_id: str,
):

    file_path = jobs.get(job_id)

    if not file_path:
        return {
            "ready": False,
            "message": "Synthetic dataset is still being generated",
        }

    return FileResponse(
        path=file_path,
        filename="synthetic_dataset.zip",
        media_type="application/zip",
    )
