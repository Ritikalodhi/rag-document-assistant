"""Minimal async job store with Redis-ready persistence and in-memory fallback."""

import json
import uuid
from typing import Any


class AsyncJobStore:
    """Store upload processing jobs and expose simple status updates."""

    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        self._memory: dict[str, dict[str, Any]] = {}

    def create_job(self, filename: str, collection_id: str | None = None) -> str:
        job_id = str(uuid.uuid4())
        job = {
            "job_id": job_id,
            "filename": filename,
            "collection_id": collection_id,
            "status": "queued",
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

    def complete_job(self, job_id: str, result: dict[str, Any]) -> None:
        self.update_job(job_id, status="completed", progress=100, result=result)

    def fail_job(self, job_id: str, error: str) -> None:
        self.update_job(job_id, status="failed", error=error)

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
