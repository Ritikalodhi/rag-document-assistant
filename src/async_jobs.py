"""Async job store with detailed stage tracking, progress, and persistence.

Multi-tenant: jobs are scoped by user_id.
"""

import json
import uuid
from typing import Any
from loguru import logger

# Ordered stages for async document processing
JOB_STAGES = [
    "queued",
    "parsing",
    "chunking",
    "embedding",
    "indexing",
    "completed",
    "failed",
]

# Stage-to-progress mapping (percentage)
STAGE_PROGRESS = {
    "queued": 0,
    "parsing": 15,
    "chunking": 30,
    "embedding": 50,
    "indexing": 75,
    "completed": 100,
    "failed": 100,
}


class AsyncJobStore:
    """Store upload processing jobs and expose detailed status updates.

    Tracks progress stages: queued -> parsing -> chunking -> embedding -> indexing -> completed/failed.
    Jobs are scoped by user_id for multi-tenancy.
    """

    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        self._memory: dict[str, dict[str, Any]] = {}

    def create_job(self, user_id: str, filename: str, collection_id: str | None = None) -> str:
        job_id = str(uuid.uuid4())
        job = {
            "job_id": job_id,
            "user_id": user_id,
            "filename": filename,
            "collection_id": collection_id,
            "status": "queued",
            "stage": "queued",
            "progress": 0,
            "result": None,
            "error": None,
        }
        self._save(job_id, job)
        return job_id

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self._load(job_id)

    def list_queued_jobs(self) -> list[str]:
        if self.redis_client is not None:
            queued: list[str] = []
            for key in self.redis_client.keys():
                raw = self.redis_client.get(key)
                if not raw:
                    continue
                job = json.loads(raw)
                if job.get("status") == "queued":
                    queued.append(key)
            return queued
        return [job_id for job_id, job in self._memory.items() if job.get("status") == "queued"]

    def update_job(self, job_id: str, **updates: Any) -> None:
        job = self.get_job(job_id)
        if job is None:
            raise KeyError(f"Job {job_id} not found")
        job.update(updates)
        self._save(job_id, job)

    def set_stage(self, job_id: str, stage: str) -> None:
        """Set the current processing stage with automatic progress update."""
        if stage not in JOB_STAGES:
            logger.warning(f"Unknown job stage '{stage}' for job {job_id}")
            return
        progress = STAGE_PROGRESS.get(stage, 0)
        self.update_job(job_id, stage=stage, status=stage, progress=progress)

    def complete_job(self, job_id: str, result: dict[str, Any]) -> None:
        self.update_job(job_id, stage="completed", status="completed", progress=100, result=result)

    def fail_job(self, job_id: str, error: str) -> None:
        self.update_job(job_id, stage="failed", status="failed", progress=100, error=error)

    def _save(self, job_id: str, job: dict[str, Any]) -> None:
        if self.redis_client is not None:
            self.redis_client.set(job_id, json.dumps(job))
            return
        self._memory[job_id] = job

    def _load(self, job_id: str) -> dict[str, Any] | None:
        if self.redis_client is not None:
            raw = self.redis_client.get(job_id)
            if not raw:
                return None
            return json.loads(raw)
        return self._memory.get(job_id)