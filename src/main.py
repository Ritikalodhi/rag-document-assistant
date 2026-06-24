"""FastAPI application for RAG Document Assistant."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

from src.rag_pipeline import RAGPipeline
from src.config import DOCUMENT_DIR, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE

rag: RAGPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    logger.info("Starting RAG Document Assistant…")
    rag = RAGPipeline()
    logger.info("RAG pipeline ready")
    yield
    logger.info("Shutting down")


app = FastAPI(title="RAG Document Assistant", description="Personal Document Q&A System", version="0.3.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ── Pydantic models ───────────────────────────────────────────────────────────

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


class SummaryResponse(BaseModel):
    success: bool
    filename: str | None = None
    summary: dict | None = None
    cached: bool | None = None
    error: str | None = None


class CompareRequest(BaseModel):
    document_a: str  # doc_id or filename
    document_b: str  # doc_id or filename


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


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "RAG Document Assistant is running", "version": "0.3.0"}


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "rag_initialized": rag is not None}


@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(file: UploadFile = File(...), collection_id: str | None = None):
    """Upload a document. Optionally pass collection_id to file it into a
    specific collection; otherwise it goes into the default 'General' one."""
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{file_ext}'. Supported: {sorted(SUPPORTED_FILE_TYPES)}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_FILE_SIZE // (1024 * 1024)} MB limit.")

    file_path = DOCUMENT_DIR / file.filename
    succeeded = False
    try:
        file_path.write_bytes(contents)
        result = rag.add_document(str(file_path), collection_id=collection_id)
        if result["success"]:
            succeeded = True
            logger.info(f"Uploaded and indexed: {file.filename}")
            return UploadResponse(
                filename=file.filename,
                success=True,
                message="Document uploaded and processed successfully",
                chunks=result["chunks"],
                doc_id=result.get("doc_id"),
                collection_id=result.get("collection_id"),
            )
        raise HTTPException(status_code=500, detail=f"Processing error: {result['error']}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if not succeeded and file_path.exists():
            file_path.unlink(missing_ok=True)


@app.post("/api/query", response_model=QueryResponse, tags=["Query"])
async def query_documents(request: QueryRequest):
    try:
        result = rag.query(request.question, k=request.k)
        return QueryResponse(**result)
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}/study-notes", tags=["Documents"])
async def study_notes(doc_id: str):
    """Generate study notes: summary, key concepts, flashcards, viva questions, MCQs."""
    try:
        result = rag.generate_study_notes(doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Study notes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CrossDocRequest(BaseModel):
    doc_ids: list[str] | None = None  # None = use all documents


@app.post("/api/documents/cross-analysis", tags=["Documents"])
async def cross_document_analysis(request: CrossDocRequest):
    """Find concepts and themes shared across multiple documents."""
    try:
        result = rag.cross_document_analysis(request.doc_ids)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cross-document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics", tags=["System"])
async def get_analytics():
    """Analytics dashboard — documents, chunks, queries, collections, LLM info."""
    try:
        return rag.get_analytics()
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats", response_model=StatsResponse, tags=["System"])
async def get_statistics():
    try:
        return StatsResponse(**rag.get_stats())
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents", tags=["Documents"])
async def list_documents():
    """List all uploaded documents with metadata (and cached summary if generated)."""
    try:
        return {"documents": rag.list_documents()}
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents/{doc_id}/summarize", response_model=SummaryResponse, tags=["Documents"])
async def summarize_document(doc_id: str):
    """Generate a structured summary (exec summary, topics, takeaways, entities)."""
    try:
        result = rag.summarize_document(doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return SummaryResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}/suggested-questions", response_model=SuggestedQuestionsResponse, tags=["Documents"])
async def suggested_questions(doc_id: str):
    """Generate 5 suggested follow-up questions for a document."""
    try:
        result = rag.suggest_questions(doc_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return SuggestedQuestionsResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Suggested questions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents/compare", response_model=CompareResponse, tags=["Documents"])
async def compare_documents(request: CompareRequest):
    """Compare two documents (pass doc_id or filename for each)."""
    try:
        result = rag.compare_documents(request.document_a, request.document_b)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return CompareResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compare error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/collections", tags=["Collections"])
async def create_collection(request: CreateCollectionRequest):
    """Create a new collection (workspace) to organize documents into."""
    try:
        return rag.create_collection(request.name)
    except Exception as e:
        logger.error(f"Error creating collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/collections", tags=["Collections"])
async def list_collections():
    """List all collections."""
    try:
        return {"collections": rag.list_collections()}
    except Exception as e:
        logger.error(f"Error listing collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/collections/{collection_id}", tags=["Collections"])
async def get_collection(collection_id: str):
    """Get a collection with its documents resolved."""
    try:
        result = rag.get_collection(collection_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/conversations", tags=["Conversations"])
async def get_conversations(limit: int = Query(default=100, ge=1, le=1000)):
    try:
        history = rag.history.get_history(limit)
        return {"conversations": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Error retrieving conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/conversations/clear", tags=["Conversations"])
async def clear_conversations():
    try:
        rag.history.clear_history()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error clearing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# """FastAPI application for RAG Document Assistant."""

# from contextlib import asynccontextmanager
# from pathlib import Path

# from fastapi import FastAPI, UploadFile, File, HTTPException, Query
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from loguru import logger

# from src.rag_pipeline import RAGPipeline
# from src.config import DOCUMENT_DIR, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE

# rag: RAGPipeline | None = None


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     global rag
#     logger.info("Starting RAG Document Assistant…")
#     rag = RAGPipeline()
#     logger.info("RAG pipeline ready")
#     yield
#     logger.info("Shutting down")


# app = FastAPI(title="RAG Document Assistant", description="Personal Document Q&A System", version="0.3.0", lifespan=lifespan)
# app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# # ── Pydantic models ───────────────────────────────────────────────────────────

# class QueryRequest(BaseModel):
#     question: str
#     k: int = 4


# class QueryResponse(BaseModel):
#     question: str
#     answer: str
#     context: list
#     success: bool


# class UploadResponse(BaseModel):
#     filename: str
#     success: bool
#     message: str
#     chunks: int = 0
#     doc_id: str | None = None
#     collection_id: str | None = None


# class StatsResponse(BaseModel):
#     collection_name: str
#     document_count: int
#     persist_dir: str


# class SummaryResponse(BaseModel):
#     success: bool
#     filename: str | None = None
#     summary: dict | None = None
#     cached: bool | None = None
#     error: str | None = None


# class CompareRequest(BaseModel):
#     document_a: str  # doc_id or filename
#     document_b: str  # doc_id or filename


# class CompareResponse(BaseModel):
#     success: bool
#     document_a: str | None = None
#     document_b: str | None = None
#     comparison: dict | None = None
#     error: str | None = None


# class SuggestedQuestionsResponse(BaseModel):
#     success: bool
#     filename: str | None = None
#     questions: list[str] | None = None
#     error: str | None = None


# class CreateCollectionRequest(BaseModel):
#     name: str


# # ── Routes ────────────────────────────────────────────────────────────────────

# @app.get("/", tags=["Health"])
# async def root():
#     return {"status": "ok", "message": "RAG Document Assistant is running", "version": "0.3.0"}


# @app.get("/api/health", tags=["Health"])
# async def health_check():
#     return {"status": "healthy", "rag_initialized": rag is not None}


# @app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
# async def upload_document(file: UploadFile = File(...), collection_id: str | None = None):
#     """Upload a document. Optionally pass collection_id to file it into a
#     specific collection; otherwise it goes into the default 'General' one."""
#     file_ext = Path(file.filename).suffix.lower()
#     if file_ext not in SUPPORTED_FILE_TYPES:
#         raise HTTPException(status_code=400, detail=f"Unsupported file type '{file_ext}'. Supported: {sorted(SUPPORTED_FILE_TYPES)}")

#     contents = await file.read()
#     if len(contents) > MAX_FILE_SIZE:
#         raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_FILE_SIZE // (1024 * 1024)} MB limit.")

#     file_path = DOCUMENT_DIR / file.filename
#     succeeded = False
#     try:
#         file_path.write_bytes(contents)
#         result = rag.add_document(str(file_path), collection_id=collection_id)
#         if result["success"]:
#             succeeded = True
#             logger.info(f"Uploaded and indexed: {file.filename}")
#             return UploadResponse(
#                 filename=file.filename,
#                 success=True,
#                 message="Document uploaded and processed successfully",
#                 chunks=result["chunks"],
#                 doc_id=result.get("doc_id"),
#                 collection_id=result.get("collection_id"),
#             )
#         raise HTTPException(status_code=500, detail=f"Processing error: {result['error']}")
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error uploading {file.filename}: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         if not succeeded and file_path.exists():
#             file_path.unlink(missing_ok=True)


# @app.post("/api/query", response_model=QueryResponse, tags=["Query"])
# async def query_documents(request: QueryRequest):
#     try:
#         result = rag.query(request.question, k=request.k)
#         return QueryResponse(**result)
#     except Exception as e:
#         logger.error(f"Query error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/analytics", tags=["System"])
# async def get_analytics():
#     """Analytics dashboard — documents, chunks, queries, collections, LLM info."""
#     try:
#         return rag.get_analytics()
#     except Exception as e:
#         logger.error(f"Analytics error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/stats", response_model=StatsResponse, tags=["System"])
# async def get_statistics():
#     try:
#         return StatsResponse(**rag.get_stats())
#     except Exception as e:
#         logger.error(f"Stats error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/documents", tags=["Documents"])
# async def list_documents():
#     """List all uploaded documents with metadata (and cached summary if generated)."""
#     try:
#         return {"documents": rag.list_documents()}
#     except Exception as e:
#         logger.error(f"Error listing documents: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/api/documents/{doc_id}/summarize", response_model=SummaryResponse, tags=["Documents"])
# async def summarize_document(doc_id: str):
#     """Generate a structured summary (exec summary, topics, takeaways, entities)."""
#     try:
#         result = rag.summarize_document(doc_id)
#         if not result["success"]:
#             raise HTTPException(status_code=404, detail=result["error"])
#         return SummaryResponse(**result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Summarize error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/documents/{doc_id}/suggested-questions", response_model=SuggestedQuestionsResponse, tags=["Documents"])
# async def suggested_questions(doc_id: str):
#     """Generate 5 suggested follow-up questions for a document."""
#     try:
#         result = rag.suggest_questions(doc_id)
#         if not result["success"]:
#             raise HTTPException(status_code=404, detail=result["error"])
#         return SuggestedQuestionsResponse(**result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Suggested questions error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/api/documents/compare", response_model=CompareResponse, tags=["Documents"])
# async def compare_documents(request: CompareRequest):
#     """Compare two documents (pass doc_id or filename for each)."""
#     try:
#         result = rag.compare_documents(request.document_a, request.document_b)
#         if not result["success"]:
#             raise HTTPException(status_code=404, detail=result["error"])
#         return CompareResponse(**result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Compare error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/api/collections", tags=["Collections"])
# async def create_collection(request: CreateCollectionRequest):
#     """Create a new collection (workspace) to organize documents into."""
#     try:
#         return rag.create_collection(request.name)
#     except Exception as e:
#         logger.error(f"Error creating collection: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/collections", tags=["Collections"])
# async def list_collections():
#     """List all collections."""
#     try:
#         return {"collections": rag.list_collections()}
#     except Exception as e:
#         logger.error(f"Error listing collections: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/collections/{collection_id}", tags=["Collections"])
# async def get_collection(collection_id: str):
#     """Get a collection with its documents resolved."""
#     try:
#         result = rag.get_collection(collection_id)
#         if result is None:
#             raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found.")
#         return result
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting collection: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/conversations", tags=["Conversations"])
# async def get_conversations(limit: int = Query(default=100, ge=1, le=1000)):
#     try:
#         history = rag.history.get_history(limit)
#         return {"conversations": history, "count": len(history)}
#     except Exception as e:
#         logger.error(f"Error retrieving conversations: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/api/conversations/clear", tags=["Conversations"])
# async def clear_conversations():
#     try:
#         rag.history.clear_history()
#         return {"success": True}
#     except Exception as e:
#         logger.error(f"Error clearing conversations: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)

