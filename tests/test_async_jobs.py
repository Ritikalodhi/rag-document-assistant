from src.async_jobs import AsyncJobStore


def test_async_job_store_tracks_status_and_result():
    store = AsyncJobStore(redis_client=None)
    job_id = store.create_job(user_id="user1", filename="sample.pdf", collection_id="collection-1")

    job = store.get_job(job_id)
    assert job["status"] == "queued"
    assert job["filename"] == "sample.pdf"
    assert job["user_id"] == "user1"

    store.update_job(job_id, status="processing", progress=25)
    updated = store.get_job(job_id)
    assert updated["status"] == "processing"
    assert updated["progress"] == 25

    store.complete_job(job_id, result={"doc_id": "doc-1", "chunks": 4})
    completed = store.get_job(job_id)
    assert completed["status"] == "completed"
    assert completed["result"]["doc_id"] == "doc-1"
    assert completed["result"]["chunks"] == 4


def test_async_job_store_lists_only_queued_jobs():
    store = AsyncJobStore(redis_client=None)
    queued_job = store.create_job(user_id="user1", filename="queued.pdf")
    processing_job = store.create_job(user_id="user1", filename="processing.pdf")
    store.update_job(processing_job, status="processing")

    queued = store.list_queued_jobs()
    assert queued_job in queued
    assert processing_job not in queued