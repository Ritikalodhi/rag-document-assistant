"""Simple background worker for async document ingestion jobs."""

import asyncio
import os
from pathlib import Path

from loguru import logger

from src.async_jobs import AsyncJobStore
from src.rag_pipeline import RAGPipeline
from src.config import DOCUMENT_DIR


class BackgroundWorker:
    """Processes queued ingestion jobs in a background loop."""

    def __init__(self, rag: RAGPipeline, job_store: AsyncJobStore):
        self.rag = rag
        self.job_store = job_store
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while self._running:
            await self._process_next_job()
            await asyncio.sleep(1)

    async def _process_next_job(self) -> None:
        jobs = self.job_store.list_queued_jobs()
        if not jobs:
            return

        job_id = jobs[0]
        job = self.job_store.get_job(job_id)
        if not job:
            return

        file_path = DOCUMENT_DIR / job["filename"]
        if not file_path.exists():
            self.job_store.fail_job(job_id, "Input file not found")
            return

        try:
            self.job_store.update_job(job_id, status="processing", progress=25)
            result = self.rag.add_document(str(file_path), collection_id=job.get("collection_id"))
            if result.get("success"):
                self.job_store.complete_job(job_id, result=result)
            else:
                self.job_store.fail_job(job_id, result.get("error", "processing failed"))
        except Exception as exc:
            logger.exception("Background worker failed")
            self.job_store.fail_job(job_id, str(exc))
        finally:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
