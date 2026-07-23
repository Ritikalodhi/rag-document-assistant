"""Test background worker retry logic and event-loop offloading.

2.1: Retries preserve the source file (don't delete in finally).
2.2: add_document is offloaded to a thread via asyncio.to_thread.
"""

import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path
import pytest

from src.background_worker import BackgroundWorker
from src.async_jobs import AsyncJobStore


@pytest.fixture
def worker(tmp_path):
    """Create a BackgroundWorker with a mock RAG pipeline and a real job store."""
    rag = MagicMock()
    job_store = AsyncJobStore()
    bw = BackgroundWorker(rag=rag, job_store=job_store)
    return bw, rag, job_store


@pytest.mark.asyncio
async def test_retry_does_not_delete_file(worker, tmp_path):
    """Background worker should NOT delete the source file on failed attempts,
    only after the job reaches a terminal state (completed/failed).
    """
    bw, rag, job_store = worker

    # Create a fake file
    file_path = tmp_path / "test.pdf"
    file_path.write_text("dummy content")

    # Create a job with the file path
    job_id = job_store.create_job(user_id="user", filename=file_path.name, collection_id=None)

    # Override the DOCUMENT_DIR so the worker finds the file
    bw.rag.add_document.side_effect = [
        Exception("Transient error 1"),  # 1st attempt fails
        Exception("Transient error 2"),  # 2nd attempt fails
        {"success": True, "doc_id": "doc123", "chunks": 5},  # 3rd succeeds
    ]

    # Patch DOCUMENT_DIR to tmp_path
    with patch("src.background_worker.DOCUMENT_DIR", tmp_path):
        # First attempt — fails, file should still exist
        await bw._process_next_job()
        assert file_path.exists(), "File should still exist after failed attempt"

        # Second attempt — fails, file should still exist
        await bw._process_next_job()
        assert file_path.exists(), "File should still exist after second failed attempt"

        # Third attempt — succeeds
        await bw._process_next_job()
        # File should now be gone (completed)
        assert not file_path.exists(), "File should be deleted after successful completion"


@pytest.mark.asyncio
async def test_add_document_offloaded_to_thread(worker, tmp_path):
    """The worker should call asyncio.to_thread to avoid blocking the event loop."""
    bw, rag, job_store = worker

    file_path = tmp_path / "test.pdf"
    file_path.write_text("dummy content")

    job_id = job_store.create_job(user_id="user", filename=file_path.name, collection_id=None)

    # Patch asyncio.to_thread to verify it's used
    original_to_thread = asyncio.to_thread

    call_kwargs = {}

    async def fake_to_thread(fn, *args, **kwargs):
        call_kwargs["fn"] = fn
        call_kwargs["args"] = args
        return fn(*args, **kwargs)

    with patch("asyncio.to_thread", fake_to_thread):
        with patch("src.background_worker.DOCUMENT_DIR", tmp_path):
            bw.rag.add_document.return_value = {"success": True, "doc_id": "doc123", "chunks": 5}
            await bw._process_next_job()

    assert "fn" in call_kwargs, "asyncio.to_thread should have been called"
    assert call_kwargs["fn"] == bw.rag.add_document, "Should have offloaded add_document"


@pytest.mark.asyncio
async def test_file_deleted_on_failure_terminal(worker, tmp_path):
    """When a job permanently fails, the file should be deleted."""
    bw, rag, job_store = worker

    file_path = tmp_path / "test.pdf"
    file_path.write_text("dummy content")

    job_id = job_store.create_job(user_id="user", filename=file_path.name, collection_id=None)

    # Fail every time
    bw.rag.add_document.side_effect = Exception("Always fails")
    # Set retries to MAX_RETRIES (3) so the next attempt will be the
    # (MAX_RETRIES + 1)-th, triggering permanent failure.
    bw._retries[job_id] = 3

    with patch("src.background_worker.DOCUMENT_DIR", tmp_path):
        # This will exceed MAX_RETRIES → permanent failure
        await bw._process_next_job()

    # After permanent failure, file should be deleted
    job = job_store.get_job(job_id)
    assert job["status"] == "failed"
    assert not file_path.exists(), "File should be deleted after permanent failure"
