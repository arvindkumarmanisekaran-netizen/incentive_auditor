from __future__ import annotations

import asyncio
from collections import defaultdict


class SyntheticProgressManager:
    """
    Job based progress manager.

    Each synthetic generation request
    gets its own asyncio queue.

    Flow:

    generator thread
          |
          |
          v
    publish(job_id,message)
          |
          |
          v
    SSE stream
          |
          |
          v
    React toast
    """

    def __init__(self):

        self.queues: dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)

        self.completed_jobs: set[str] = set()

    # ============================================================
    # CREATE JOB
    # ============================================================

    def create_job(
        self,
        job_id: str,
    ):

        self.queues[job_id] = asyncio.Queue()

    # ============================================================
    # PUBLISH MESSAGE
    # ============================================================

    async def publish(
        self,
        job_id: str,
        message: str,
    ):

        queue = self.queues.get(job_id)

        if queue:

            await queue.put(
                {
                    "message": message,
                }
            )

    # ============================================================
    # LISTEN SSE
    # ============================================================

    async def listen(
        self,
        job_id: str,
    ):

        queue = self.queues.get(job_id)

        if not queue:
            return

        while True:

            event = await queue.get()

            if event["message"] == "__COMPLETE__":

                break

            yield event

    # ============================================================
    # COMPLETE JOB
    # ============================================================

    async def complete(
        self,
        job_id: str,
    ):

        queue = self.queues.get(job_id)

        if queue:

            await queue.put({"message": "__COMPLETE__"})

    # ============================================================
    # REMOVE JOB
    # ============================================================

    def remove_job(
        self,
        job_id: str,
    ):

        if job_id in self.queues:

            del self.queues[job_id]


synthetic_progress = SyntheticProgressManager()
