"""Background worker for async document ingestion with stage tracking and retry."""

import asyncio
import os
from pathlib import Path

from loguru import logger

from src.async_jobs import AsyncJobStore
from src.rag_pipeline import RAGPipeline
from src.config import DOCUMENT_DIR

# Max retries for transient failures
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


class BackgroundWorker:
    """Processes queued ingestion jobs in a background loop with retry support."""

    def __init__(self, rag: RAGPipeline, job_store: AsyncJobStore):
        self.rag = rag
        self.job_store = job_store
        self._running = False
        self._task: asyncio.Task | None = None
        # Track retries per job
        self._retries: dict[str, int] = {}

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
            # Stage 1: Parse
            self.job_store.set_stage(job_id, "parsing")
            await asyncio.sleep(0)  # yield control

            # Stage 2: Chunking (handled inside add_document)
            self.job_store.set_stage(job_id, "chunking")
            await asyncio.sleep(0)

            # Stage 3: Embedding
            self.job_store.set_stage(job_id, "embedding")
            await asyncio.sleep(0)

            # Stage 4: Indexing
            self.job_store.set_stage(job_id, "indexing")

            # Offload the synchronous CPU/IO-heavy add_document to a thread
            # so we don't block the FastAPI event loop for all users.
            result = await asyncio.to_thread(
                self.rag.add_document,
                job.get("user_id", ""),
                str(file_path),
                collection_id=job.get("collection_id"),
            )

            if result.get("success"):
                self.job_store.complete_job(job_id, result=result)
                self._retries.pop(job_id, None)
            else:
                self._handle_failure(job_id, result.get("error", "processing failed"))
        except Exception as exc:
            logger.exception(f"Background worker failed for job {job_id}")
            self._handle_failure(job_id, str(exc))
        finally:
            # Only clean up the source file once the job is truly done —
            # a job re-queued for retry still needs it.
            job = self.job_store.get_job(job_id)
            if job and job.get("status") in ("completed", "failed") and file_path.exists():
                file_path.unlink(missing_ok=True)

    def _handle_failure(self, job_id: str, error: str) -> None:
        """Retry transient failures up to MAX_RETRIES, then permanently fail."""
        retry_count = self._retries.get(job_id, 0) + 1
        if retry_count <= MAX_RETRIES:
            self._retries[job_id] = retry_count
            logger.warning(f"Job {job_id} failed (attempt {retry_count}/{MAX_RETRIES}), will retry: {error}")
            # Reset to queued for retry
            self.job_store.update_job(job_id, status="queued", stage="queued", progress=0, error=None)
        else:
            logger.error(f"Job {job_id} failed after {MAX_RETRIES} attempts: {error}")
            self.job_store.fail_job(job_id, error)
            self._retries.pop(job_id, None)