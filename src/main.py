
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
 
app = FastAPI(title="RAG Document Assistant", description="Personal Document Q&A System", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
 
class QueryRequest(BaseModel):
    question: str
    k: int = 4
 
class QueryResponse(BaseModel):
    question: str
    answer: str
    context: list
    success: bool
 
class UploadResponse(BaseModel):
    filename: str
    success: bool
    message: str
    chunks: int = 0
 
class StatsResponse(BaseModel):
    collection_name: str
    document_count: int
    persist_dir: str
 
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "RAG Document Assistant is running", "version": "0.1.0"}
 
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "rag_initialized": rag is not None}
 
@app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
async def upload_document(file: UploadFile = File(...)):
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
        result = rag.add_document(str(file_path))
        if result["success"]:
            succeeded = True
            logger.info(f"Uploaded and indexed: {file.filename}")
            return UploadResponse(filename=file.filename, success=True, message="Document uploaded and processed successfully", chunks=result["chunks"])
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
 
@app.get("/api/stats", response_model=StatsResponse, tags=["System"])
async def get_statistics():
    try:
        return StatsResponse(**rag.get_stats())
    except Exception as e:
        logger.error(f"Stats error: {e}")
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
 

# """FastAPI application for RAG Document Assistant"""

# from fastapi import FastAPI, UploadFile, File, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from pathlib import Path
# import os
# from src.rag_pipeline import RAGPipeline
# from src.config import DOCUMENT_DIR, SUPPORTED_FILE_TYPES, MAX_FILE_SIZE
# from loguru import logger

# # Initialize FastAPI app
# app = FastAPI(
#     title="RAG Document Assistant",
#     description="Personal Document Q&A System",
#     version="0.1.0"
# )

# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Initialize RAG pipeline
# rag = RAGPipeline()


# # Pydantic models
# class QueryRequest(BaseModel):
#     """Query request model"""
#     question: str
#     k: int = 4


# class QueryResponse(BaseModel):
#     """Query response model"""
#     question: str
#     answer: str
#     context: list
#     success: bool


# class UploadResponse(BaseModel):
#     """Upload response model"""
#     filename: str
#     success: bool
#     message: str
#     chunks: int = 0


# class StatsResponse(BaseModel):
#     """Statistics response model"""
#     collection_name: str
#     document_count: int
#     persist_dir: str


# # Routes
# @app.get("/", tags=["Health"])
# async def root():
#     """Health check endpoint"""
#     return {
#         "status": "ok",
#         "message": "RAG Document Assistant is running",
#         "version": "0.1.0"
#     }


# @app.post("/api/upload", response_model=UploadResponse, tags=["Documents"])
# async def upload_document(file: UploadFile = File(...)):
#     """Upload a document to the RAG system
    
#     Supported formats: PDF, TXT, DOCX, Markdown
#     """
#     try:
#         # Check file type
#         file_ext = Path(file.filename).suffix.lower()
#         if file_ext not in SUPPORTED_FILE_TYPES:
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"Unsupported file type: {file_ext}. Supported types: {list(SUPPORTED_FILE_TYPES.keys())}"
#             )
        
#         # Check file size
#         contents = await file.read()
#         if len(contents) > MAX_FILE_SIZE:
#             raise HTTPException(
#                 status_code=413,
#                 detail=f"File size exceeds maximum allowed size: {MAX_FILE_SIZE / (1024*1024):.0f}MB"
#             )
        
#         # Save file
#         file_path = DOCUMENT_DIR / file.filename
#         with open(file_path, "wb") as f:
#             f.write(contents)
        
#         # Add to RAG pipeline
#         result = rag.add_document(str(file_path))
        
#         if result["success"]:
#             logger.info(f"Successfully uploaded document: {file.filename}")
#             return UploadResponse(
#                 filename=file.filename,
#                 success=True,
#                 message="Document uploaded and processed successfully",
#                 chunks=result["chunks"]
#             )
#         else:
#             raise HTTPException(
#                 status_code=500,
#                 detail=f"Error processing document: {result['error']}"
#             )
    
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error uploading document: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error uploading document: {str(e)}"
#         )


# @app.post("/api/query", response_model=QueryResponse, tags=["Query"])
# async def query_documents(request: QueryRequest):
#     """Query the RAG system
    
#     Provide a question and receive an answer based on uploaded documents.
#     """
#     try:
#         result = rag.query(request.question, k=request.k)
#         return QueryResponse(**result)
#     except Exception as e:
#         logger.error(f"Error querying RAG system: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error processing query: {str(e)}"
#         )


# @app.get("/api/stats", response_model=StatsResponse, tags=["System"])
# async def get_statistics():
#     """Get RAG system statistics"""
#     try:
#         stats = rag.get_stats()
#         return StatsResponse(**stats)
#     except Exception as e:
#         logger.error(f"Error getting statistics: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error getting statistics: {str(e)}"
#         )


# @app.get("/api/conversations", tags=["Conversations"])
# async def get_conversations(limit: int = 100):
#     """Retrieve recent conversation history entries"""
#     try:
#         history = rag.history.get_history(limit)
#         return {"conversations": history, "count": len(history)}
#     except Exception as e:
#         logger.error(f"Error retrieving conversations: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error retrieving conversations: {str(e)}"
#         )


# @app.post("/api/conversations/clear", tags=["Conversations"])
# async def clear_conversations():
#     """Clear stored conversation history"""
#     try:
#         rag.history.clear_history()
#         return {"success": True}
#     except Exception as e:
#         logger.error(f"Error clearing conversations: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error clearing conversations: {str(e)}"
#         )


# @app.get("/api/health", tags=["Health"])
# async def health_check():
#     """Health check endpoint"""
#     return {
#         "status": "healthy",
#         "rag_initialized": rag is not None
#     }


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
