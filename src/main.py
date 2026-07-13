"""FastAPI application for RAG Document Assistant."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

from src.rag_pipeline import RAGPipeline
from src.config import DOCUMENT_DIR, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE
from src.auth import auth_router, get_current_user_id

rag: RAGPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    logger.info("Starting RAG Document Assistant…")
    rag = RAGPipeline()
    logger.info("RAG pipeline ready")
    yield
    logger.info("Shutting down")


app = FastAPI(title="RAG Document Assistant", description="Personal Document Q&A System", version="0.4.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)


# ── Models ────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    k: int = 4

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
    success: bool

class UploadResponse(BaseModel):
    filename: str
    success: bool
    message: str
    chunks: int = 0
    doc_id: str | None = None
    collection_id: str | None = None

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
    return {"status": "ok", "message": "RAG Document Assistant is running", "version": "0.4.0"}

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "rag_initialized": rag is not None}


# ── Documents ─────────────────────────────────────────────────────────────────

@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(file: UploadFile = File(...), collection_id: str | None = None, user_id: str = Depends(get_current_user_id)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{file_ext}'.")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit.")
    file_path = DOCUMENT_DIR / file.filename
    succeeded = False
    try:
        file_path.write_bytes(contents)
        result = rag.add_document(str(file_path), collection_id=collection_id)
        if result["success"]:
            succeeded = True
            return UploadResponse(filename=file.filename, success=True, message="Uploaded successfully",
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

@app.get("/api/documents", tags=["Documents"])
async def list_documents(user_id: str = Depends(get_current_user_id)):
    try:
        return {"documents": rag.list_documents()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}", tags=["Documents"])
async def get_document(doc_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        doc = rag.get_document(doc_id)
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
        result = rag.delete_document(doc_id)
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
        result = rag.summarize_document(doc_id)
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
        result = rag.suggest_questions(doc_id)
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
        result = rag.generate_study_notes(doc_id)
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
        result = rag.get_document_tables(doc_id)
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
        result = rag.compare_documents(request.document_a, request.document_b)
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
        result = rag.cross_document_analysis(request.doc_ids)
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
        result = rag.export_summary(doc_id, as_pdf=(format == "pdf"))
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
        result = rag.export_history(limit=limit, as_pdf=(format == "pdf"))
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
        doc = rag.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        versions = rag.version_store.get_versions("default", doc["filename"])
        return {"doc_id": doc_id, "filename": doc["filename"], "versions": versions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{doc_id}/versions/compare", tags=["Versioning"])
async def compare_versions(doc_id: str, v1: int = 1, v2: int = 2, user_id: str = Depends(get_current_user_id)):
    try:
        doc = rag.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        result = rag.version_store.compare_versions("default", doc["filename"], v1, v2)
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
        yield from rag.stream_query(question, k=k)
    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/api/query", response_model=QueryResponse, tags=["Query"])
async def query_documents(request: QueryRequest, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.query(request.question, k=request.k)
        return QueryResponse(**result)
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/api/analytics", tags=["System"])
async def get_analytics(user_id: str = Depends(get_current_user_id)):
    try:
        return rag.get_analytics()
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
        return rag.create_collection(request.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections", tags=["Collections"])
async def list_collections(user_id: str = Depends(get_current_user_id)):
    try:
        return {"collections": rag.list_collections()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections/{collection_id}", tags=["Collections"])
async def get_collection(collection_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        result = rag.get_collection(collection_id)
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
        result = rag.rename_collection(collection_id, request.name)
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
        result = rag.delete_collection(collection_id)
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
        history = rag.history.get_history(limit)
        return {"conversations": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/conversations/{entry_id}", tags=["Conversations"])
async def delete_conversation(entry_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        ok = rag.history.delete_entry(entry_id)
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
        rag.history.clear_history()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)