"""FastAPI application for RAG Document Assistant."""

import os
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

from src.rag_pipeline import RAGPipeline
from src.config import DOCUMENT_DIR, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE, LOG_LEVEL, LLM_PROVIDER, ALLOWED_ORIGINS
from src.auth import auth_router, get_current_user_id
from src.async_jobs import AsyncJobStore
from src.background_worker import BackgroundWorker
from src.input_sanitizer import is_injection_attempt, sanitize_question

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None

rag: RAGPipeline | None = None
worker: BackgroundWorker | None = None


def _setup_logging() -> None:
    """Configure structured logging with loguru."""
    logger.remove()
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )
    logger.add(sys.stderr, format=log_format, level=LOG_LEVEL, colorize=True)
    logger.add(
        "logs/rag_{time:YYYY-MM-DD}.log",
        format="{time} | {level} | {name}:{function}:{line} | {message}",
        level="DEBUG",
        rotation="50 MB",
        retention="30 days",
    )


def _validate_environment() -> None:
    """Validate required environment variables at startup."""
    required_vars = []
    if LLM_PROVIDER == "openai":
        required_vars.append("OPENAI_API_KEY")
    elif LLM_PROVIDER == "gemini":
        required_vars.append("GEMINI_API_KEY")

    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        logger.warning(f"Missing required environment variables: {', '.join(missing)}")

    if not os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET_KEY") == "CHANGE_ME_IN_ENV":
        logger.warning("JWT_SECRET_KEY is using default value. Set it in production!")

    logger.info("Environment validation complete")


def _build_job_store() -> AsyncJobStore:
    if redis is None:
        logger.warning("redis package not installed; using in-memory job tracking")
        return AsyncJobStore()

    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        client = redis.from_url(redis_url, decode_responses=True)
        client.ping()
        logger.info("Redis job store enabled")
        return AsyncJobStore(redis_client=client)
    except Exception as exc:
        logger.warning(f"Redis unavailable, using in-memory fallback: {exc}")
        return AsyncJobStore()


job_store = _build_job_store()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag, worker
    _setup_logging()
    _validate_environment()
    logger.info("Starting RAG Document Assistant…")
    rag = RAGPipeline()
    worker = BackgroundWorker(rag=rag, job_store=job_store)
    await worker.start()
    logger.info("RAG pipeline ready")
    yield
    if worker is not None:
        await worker.stop()
    logger.info("Shutting down")


APP_VERSION = "0.5.0"
app = FastAPI(title="RAG Document Assistant", description="Personal Document Q&A System", version=APP_VERSION, lifespan=lifespan)

# CORS: use explicit origins from config, not wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)


# ── Models ────────────────────────────────────────────────────────────────────

class FilterCriteria(BaseModel):
    document_id: str | None = None
    filename: str | None = None
    collection: str | None = None
    tags: list[str] | None = None
    user: str | None = None

class QueryRequest(BaseModel):
    question: str
    k: int = 4
    filter: FilterCriteria | None = None

class ContextItem(BaseModel):
    content: str
    source: str
    confidence_percent: float
    page: int | None = None

class QueryResponse(BaseModel):
    question: str
    answer: str
    context: list[ContextItem]
    retrieval_trace: dict | None = None
    confidence_score: dict | None = None
    grounded: bool = False
    success: bool

class UploadResponse(BaseModel):
    filename: str
    success: bool
    message: str
    chunks: int = 0
    doc_id: str | None = None
    collection_id: str | None = None

class AsyncUploadResponse(BaseModel):
    job_id: str
    status: str
    message: str

class AsyncJobStatusResponse(BaseModel):
    job_id: str
    status: str
    stage: str = "queued"
    progress: int = 0
    filename: str
    collection_id: str | None = None
    result: dict | None = None
    error: str | None = None

class StatsResponse(BaseModel):
    collection_name: str
    document_count: int
    persist_dir: str
    bm25_docs: int = 0

class SummaryResponse(BaseModel):
    success: bool
    filename: str | None = None
    summary: dict | None = None
    cached: bool | None = None
    error: str | None = None

class CompareRequest(BaseModel):
    document_a: str
    document_b: str

class CompareResponse(BaseModel):
    success: bool
    document_a: str | None = None
    document_b: str | None = None
    comparison: dict | None = None
    error: str | None = None

class SuggestedQuestionsResponse(BaseModel):
    success: bool
    filename: str | None = None
    questions: list[str] | None = None
    error: str | None = None

class CreateCollectionRequest(BaseModel):
    name: str

class RenameCollectionRequest(BaseModel):
    name: str

class CrossDocRequest(BaseModel):
    doc_ids: list[str] | None = None


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "RAG Document Assistant is running", "version": APP_VERSION}

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "rag_initialized": rag is not None}


# ── Documents ─────────────────────────────────────────────────────────────────

@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(file: UploadFile = File(...), collection_id: str | None = None, user_id: str = Depends(get_current_user_id)):
    # Path traversal protection: strip any directory components
    safe_name = Path(file.filename).name
    if not safe_name or safe_name != file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_ext = Path(safe_name).suffix.lower()
    if file_ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{file_ext}'.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit.")

    # Use UUID prefix to avoid filename collisions between users/uploads
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = DOCUMENT_DIR / unique_name
    succeeded = False
    try:
        file_path.write_bytes(contents)
        result = rag.add_document(user_id=user_id, file_path=str(file_path), collection_id=collection_id)
        if result["success"]:
            succeeded = True
            return UploadResponse(filename=safe_name, success=True, message="Uploaded successfully",
                chunks=result["chunks"], doc_id=result.get("doc_id"), collection_id=result.get("collection_id"))
        raise HTTPException(status_code=500, detail=f"Processing error: {result['error']}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if not succeeded and file_path.exists():
            file_path.unlink(missing_ok=True)

@app.post("/api/upload/async", response_model=AsyncUploadResponse, status_code=202, tags=["Documents"])
async def upload_document_async(file: UploadFile = File(...), collection_id: str | None = None, user_id: str = Depends(get_current_user_id)):
    # Path traversal protection
    safe_name = Path(file.filename).name
    if not safe_name or safe_name != file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_ext = Path(safe_name).suffix.lower()
    if file_ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{file_ext}'.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit.")

    # Use UUID prefix to avoid filename collisions
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = DOCUMENT_DIR / unique_name
    try:
        file_path.write_bytes(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    job_id = job_store.create_job(user_id=user_id, filename=unique_name, collection_id=collection_id)

    return AsyncUploadResponse(job_id=job_id, status="queued", message="Upload accepted and is being processed.")

@app.get("/api/upload/async/{job_id}", response_model=AsyncJobStatusResponse, tags=["Documents"])
async def get_async_job_status(job_id: str, user_id: str = Depends(get_current_user_id)):
    job = job_store.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    # Ownership check: don't reveal existence of other users' jobs
    if job.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return AsyncJobStatusResponse(**job)

@app.get("/api/documents", tags=["Documents"])
async def list_documents(user_id: str = Depends(get_current_user_id)):
    try:
        return {"documents": rag.list_documents(user_id=user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}", tags=["Documents"])
async def get_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        doc = rag.get_document(user_id=user_id, doc_id=doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{doc_id}", tags=["Documents"])
async def delete_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.delete_document(user_id=user_id, doc_id=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/{doc_id}/summarize", response_model=SummaryResponse, tags=["Documents"])
async def summarize_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.summarize_document(user_id=user_id, doc_id=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return SummaryResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}/suggested-questions", response_model=SuggestedQuestionsResponse, tags=["Documents"])
async def suggested_questions(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.suggest_questions(user_id=user_id, doc_id=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return SuggestedQuestionsResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}/study-notes", tags=["Documents"])
async def study_notes(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.generate_study_notes(user_id=user_id, doc_id=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}/tables", tags=["Documents"])
async def get_tables(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.get_document_tables(user_id=user_id, doc_id=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/compare", response_model=CompareResponse, tags=["Documents"])
async def compare_documents(request: CompareRequest, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.compare_documents(user_id=user_id, identifier_a=request.document_a, identifier_b=request.document_b)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return CompareResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents/cross-analysis", tags=["Documents"])
async def cross_document_analysis(request: CrossDocRequest, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.cross_document_analysis(user_id=user_id, doc_ids=request.doc_ids)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Export ────────────────────────────────────────────────────────────────────

@app.get("/api/documents/{doc_id}/export/summary", tags=["Export"])
async def export_summary(doc_id: str, format: str = "markdown", user_id: str = Depends(get_current_user_id)):
    from fastapi.responses import Response
    try:
        result = rag.export_summary(user_id=user_id, doc_id=doc_id, as_pdf=(format == "pdf"))
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        if format == "pdf":
            return Response(content=result["pdf"], media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=summary_{doc_id}.pdf"})
        return Response(content=result["markdown"], media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=summary_{doc_id}.md"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/history", tags=["Export"])
async def export_history(format: str = "markdown", limit: int = 100, user_id: str = Depends(get_current_user_id)):
    from fastapi.responses import Response
    try:
        result = rag.export_history(user_id=user_id, limit=limit, as_pdf=(format == "pdf"))
        if format == "pdf":
            return Response(content=result["pdf"], media_type="application/pdf",
                headers={"Content-Disposition": "attachment; filename=history.pdf"})
        return Response(content=result["markdown"], media_type="text/markdown",
            headers={"Content-Disposition": "attachment; filename=history.md"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Versioning ────────────────────────────────────────────────────────────────

@app.get("/api/documents/{doc_id}/versions", tags=["Versioning"])
async def get_versions(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        doc = rag.get_document(user_id=user_id, doc_id=doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        versions = rag.version_store.get_versions(user_id, doc["filename"])
        return {"doc_id": doc_id, "filename": doc["filename"], "versions": versions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}/versions/compare", tags=["Versioning"])
async def compare_versions(doc_id: str, v1: int = 1, v2: int = 2, user_id: str = Depends(get_current_user_id)):
    try:
        doc = rag.get_document(user_id=user_id, doc_id=doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        result = rag.diff_document_versions(user_id=user_id, doc_id_a=doc_id, doc_id_b=doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Query ─────────────────────────────────────────────────────────────────────

@app.get("/api/query/stream", tags=["Query"])
async def stream_query(question: str, k: int = 4, user_id: str = Depends(get_current_user_id)):
    from fastapi.responses import StreamingResponse
    def generate():
        yield from rag.stream_query(user_id=user_id, question=question, k=k)
    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/api/query", response_model=QueryResponse, tags=["Query"])
async def query_documents(request: QueryRequest, user_id: str = Depends(get_current_user_id)):
    try:
        filter_kwargs = request.filter.model_dump(exclude_none=True) if request.filter else None
        result = rag.query(user_id=user_id, question=request.question, k=request.k, filter_kwargs=filter_kwargs)
        return QueryResponse(**result)
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/api/analytics", tags=["System"])
async def get_analytics(user_id: str = Depends(get_current_user_id)):
    try:
        return rag.get_analytics(user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats", response_model=StatsResponse, tags=["System"])
async def get_statistics():
    try:
        return StatsResponse(**rag.get_stats())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Collections ───────────────────────────────────────────────────────────────

@app.post("/api/collections", tags=["Collections"])
async def create_collection(request: CreateCollectionRequest, user_id: str = Depends(get_current_user_id)):
    try:
        return rag.create_collection(user_id=user_id, name=request.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections", tags=["Collections"])
async def list_collections(user_id: str = Depends(get_current_user_id)):
    try:
        return {"collections": rag.list_collections(user_id=user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections/{collection_id}", tags=["Collections"])
async def get_collection(collection_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.get_collection(user_id=user_id, collection_id=collection_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/collections/{collection_id}", tags=["Collections"])
async def rename_collection(collection_id: str, request: RenameCollectionRequest, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.rename_collection(user_id=user_id, collection_id=collection_id, new_name=request.name)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/collections/{collection_id}", tags=["Collections"])
async def delete_collection(collection_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.delete_collection(user_id=user_id, collection_id=collection_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Conversations ─────────────────────────────────────────────────────────────

@app.get("/api/conversations", tags=["Conversations"])
async def get_conversations(limit: int = Query(default=100, ge=1, le=1000), user_id: str = Depends(get_current_user_id)):
    try:
        history = rag.history.get_history(user_id=user_id, limit=limit)
        return {"conversations": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/conversations/{entry_id}", tags=["Conversations"])
async def delete_conversation(entry_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        ok = rag.history.delete_entry(entry_id, user_id=user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/conversations/clear", tags=["Conversations"])
async def clear_conversations(user_id: str = Depends(get_current_user_id)):
    try:
        rag.history.clear_history(user_id=user_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)