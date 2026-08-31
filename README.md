# RAG Document Assistant

A FastAPI backend for uploading documents, indexing them into a local RAG knowledge base, and asking grounded questions over the uploaded content.

This README focuses on the backend. The React frontend exists in `frontend/`.

## What It Does

- Upload and process `.pdf`, `.txt`, `.docx`, and `.md` files with a 50 MB limit.
- Split documents into chunks using one of three configurable strategies: `recursive`, `semantic`, or `sentence`.
- Auto-detect scanned PDFs and run OCR fallback with Tesseract when available.
- Store embeddings in a local Chroma vector database with a persistent on-disk embedding cache (SHA-256 keyed, 50k entry cap).
- Retrieve relevant chunks with hybrid search: dense vector search plus BM25 keyword search, fused with Reciprocal Rank Fusion (RRF).
- Optionally re-rank candidates with a cross-encoder re-ranker (MS-MARCO MiniLM) for second-pass relevance scoring.
- Generate answers with either Google Gemini or OpenAI, with retry, timeout, and fallback-model support.
- Support token streaming answers via Server-Sent Events (SSE).
- Return answer context, source filenames, page numbers when available, retrieval trace, and multi-dimensional confidence scoring.
- Enforce strict grounding — refuses to answer when retrieval confidence is below a configurable threshold.
- Protect against prompt injection: detects/redacts prompt leakage, jailbreak attempts, instruction injection, separator injection, and unicode-based attacks.
- Fully multi-tenant: every document, conversation, collection, version, and async job is scoped by `user_id`; no cross-tenant data leakage.
- Process large uploads asynchronously with a background worker — stage tracking (`queued → parsing → chunking → embedding → indexing → completed/failed`), progress percentages, Redis-backed job store (with in-memory fallback), and retry logic (3 retries).
- Track documents, collections (workspaces), conversation history, summaries, versions, exports, and analytics locally.
- Provide extra document intelligence features: structured summaries, suggested questions, study notes (flashcards/viva Qs/MCQs), two-document comparison, cross-document analysis, and PDF table extraction.
- Generate markdown or Unicode-safe PDF exports for summaries, study notes, and chat history.

## Tech Stack

- Backend: FastAPI, Pydantic, Uvicorn
- RAG: LangChain, Chroma, BM25 (rank_bm25)
- LLM providers: Google Gemini or OpenAI
- Cross-encoder re-ranker: sentence-transformers
- Embeddings:
  - Gemini provider: `models/gemini-embedding-001`
  - OpenAI provider: `text-embedding-3-small`
- Storage:
  - Chroma vector database under `data/chroma_db/`
  - JSON stores for documents, collections, history, versions, and BM25 index
  - SQLite user database at `data/users.db`
- Auth: JWT bearer tokens (HS256, 7-day expiry) with bcrypt password hashing
- Async job store: Redis (optional, falls back to in-memory)
- Logging: loguru — colorized console + rotating file logs (50 MB, 30-day retention)
- Deployment: Docker + docker-compose

## Project Structure

```text
rag-document-assistant-main/
|-- src/
|   |-- main.py                 # FastAPI app and API routes
|   |-- config.py               # Environment and path configuration
|   |-- rag_pipeline.py         # Main orchestration layer
|   |-- document_processor.py   # File loading, chunking, OCR fallback
|   |-- retriever.py            # Chroma + BM25 hybrid RRF retrieval
|   |-- reranker.py             # Cross-encoder re-ranker
|   |-- embeddings.py           # Embedding manager with persistent cache
|   |-- llm.py                  # Gemini/OpenAI wrapper (retry, fallback, streaming)
|   |-- doc_store.py            # Document metadata and full-text store
|   |-- collections.py          # Document collection/workspace store
|   |-- history.py              # Conversation history store
|   |-- versioning.py           # Document version tracking and diffing
|   |-- summarizer.py           # Document summaries
|   |-- comparator.py           # Two-document comparison
|   |-- cross_document.py       # Multi-document analysis
|   |-- study_notes.py          # Study notes, flashcards, viva Qs, MCQs
|   |-- suggested_questions.py  # Follow-up question generation
|   |-- confidence_scorer.py    # Multi-dimensional answer confidence scoring
|   |-- input_sanitizer.py      # Prompt injection detection and redaction
|   |-- table_extractor.py      # PDF table extraction
|   |-- ocr_processor.py        # OCR support for scanned PDFs
|   |-- exporter.py             # Markdown/PDF export helpers
|   |-- async_jobs.py           # Async job store (Redis or in-memory)
|   |-- background_worker.py    # Background ingestion worker with retries
|   `-- auth/
|       |-- routes.py           # Register, login, me
|       |-- models.py           # Auth request/response models
|       |-- security.py         # Password hashing and JWT helpers
|       |-- dependencies.py     # Current-user dependencies
|       `-- database.py         # SQLite user storage
|-- tests/                      # pytest suite (9 test files)
|-- data/                       # Runtime data, generated locally
|-- requirements.txt
|-- API_DOCS.md
|-- Dockerfile
|-- docker-compose.yml
`-- README.md
```

## Setup

### 1. Create and activate a virtual environment

```bash
python -m venv venv
```

On Windows PowerShell:

```bash
.\venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the project root.

For Gemini:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
JWT_SECRET_KEY=replace_with_a_long_random_secret
```

For OpenAI:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
JWT_SECRET_KEY=replace_with_a_long_random_secret
```

Optional settings:

```env
# Chunking
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
CHUNK_STRATEGY=recursive        # recursive | semantic | sentence

# Vector DB & reranker
CHROMA_PERSIST_DIR=./data/chroma_db
RERANKER_ENABLED=true
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANKER_CANDIDATES=30

# Conversation memory
MEMORY_WINDOW=10                # last N exchanges injected as context
MEMORY_MAX_CHARS=2000           # truncate history string at this length

# LLM reliability
LLM_MAX_RETRIES=3
LLM_REQUEST_TIMEOUT=60
LLM_FALLBACK_MODEL=gemini-3.1-flash-lite  # optional fallback model name

# Grounding
RELEVANCE_THRESHOLD=70.0        # minimum chunk confidence to answer
STRICT_GROUNDING=true           # refuse answers below threshold

# Server
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=development

# Redis (async job store; falls back to in-memory if unavailable)
REDIS_URL=redis://localhost:6379/0

# CORS — comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

Important: set `JWT_SECRET_KEY` before using this outside local development. The code has a fallback value, but that fallback is not safe for production — `config.py` will refuse to start with the default key when `ENVIRONMENT=production`.

## Run the Backend

```bash
python -m uvicorn src.main:app --reload
```

The API will be available at:

```text
http://localhost:8000
```

Interactive API docs:

```text
http://localhost:8000/docs
```

## Run with Docker

```bash
docker-compose up --build
```

This builds the backend image and starts the API on the configured port.

## Authentication Flow

Most backend routes require a bearer token.

### Register

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"username\":\"demo_user\",\"password\":\"password123\"}"
```

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"password\":\"password123\"}"
```

The response includes an `access_token`. Use it on protected routes:

```text
Authorization: Bearer <access_token>
```

## Basic API Workflow

### Upload a document (synchronous)

```bash
curl -X POST "http://localhost:8000/api/upload" \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@paper.pdf"
```

### Upload a document (asynchronous)

```bash
curl -X POST "http://localhost:8000/api/upload/async" \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@paper.pdf"
```

Returns a `job_id` with HTTP 202 immediately. Poll for status:

```bash
curl "http://localhost:8000/api/upload/async/<job_id>" \
  -H "Authorization: Bearer <access_token>"
```

### Ask a question

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"What is the main contribution of this document?\",\"k\":4}"
```

### Stream an answer

```bash
curl -N "http://localhost:8000/api/query/stream?question=Summarize%20the%20paper&k=4" \
  -H "Authorization: Bearer <access_token>"
```

## Main Endpoint Groups

Health:

- `GET /`
- `GET /api/health`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/token` (OAuth2 password flow for Swagger)
- `GET /api/auth/me`

Documents:

- `POST /api/upload`
- `POST /api/upload/async` → `202` + `job_id`
- `GET /api/upload/async/{job_id}`
- `GET /api/documents`
- `GET /api/documents/{doc_id}`
- `DELETE /api/documents/{doc_id}`
- `POST /api/documents/{doc_id}/summarize`
- `GET /api/documents/{doc_id}/suggested-questions`
- `GET /api/documents/{doc_id}/study-notes`
- `GET /api/documents/{doc_id}/tables`
- `POST /api/documents/compare`
- `POST /api/documents/cross-analysis`

Query:

- `POST /api/query`
- `GET /api/query/stream`

Collections:

- `POST /api/collections`
- `GET /api/collections`
- `GET /api/collections/{collection_id}`
- `PATCH /api/collections/{collection_id}` (rename)
- `DELETE /api/collections/{collection_id}`

Conversations:

- `GET /api/conversations`
- `DELETE /api/conversations/{entry_id}`
- `PATCH /api/conversations/{entry_id}/title` (rename)
- `POST /api/conversations/clear`

Versioning and export:

- `GET /api/documents/{doc_id}/versions`
- `GET /api/documents/{doc_id}/versions/compare?v1=1&v2=2`
- `GET /api/documents/{doc_id}/export/summary?format=markdown`
- `GET /api/documents/{doc_id}/export/summary?format=pdf`
- `GET /api/export/history?format=markdown`
- `GET /api/export/history?format=pdf`

System:

- `GET /api/stats`
- `GET /api/analytics`

## Runtime Data

The backend creates local runtime files in `data/`.

Common files and folders:

- `data/documents/`: uploaded source files
- `data/chroma_db/`: Chroma vector database
- `data/users.db`: SQLite user database
- `data/documents.json`: document metadata and cached summaries
- `data/conversations.json`: conversation history
- `data/collections.json`: collection/workspace records
- `data/doc_versions.json`: document version history
- `data/bm25_index.pkl`: BM25 sparse retrieval index
- `data/embedding_cache.json`: persistent embedding cache (50k entry cap)
- `logs/`: rotating structured log files (50 MB rotation, 30-day retention)

These files are local development state. Do not commit real user documents, API keys, user databases, or generated private data.

## How the Backend Works

1. A user registers or logs in and receives a JWT.
2. The user uploads a supported document (sync or async).
3. For async uploads, the background worker picks up the job and processes it off the event loop (via `asyncio.to_thread`), tracking each stage with progress percentages.
4. The document is saved under `data/documents/`.
5. The backend loads the file, runs OCR fallback for scanned PDFs when available, and splits text into overlapping chunks using the configured strategy.
6. Chunks are embedded and stored in Chroma; embeddings are cached on disk to avoid re-computation.
7. The same chunks are also added to a BM25 index.
8. Metadata, full text, version information, and collection membership are stored locally.
9. During a query, the retriever combines dense vector results and sparse BM25 results with Reciprocal Rank Fusion.
10. If enabled, a cross-encoder re-ranker re-scores the candidate pool and returns the top `k`.
11. Queries are sanitized against prompt injection, optionally rewritten for better retrieval, and filtered by detected document section (abstract, conclusion, etc.).
12. If the best retrieval confidence is below `RELEVANCE_THRESHOLD` and `STRICT_GROUNDING` is on, the system refuses to answer (hallucination prevention).
13. Otherwise, the selected context is sent to the configured LLM, optionally with recent conversation memory for multi-turn follow-ups.
14. The response includes the answer, supporting context, confidence score (retrieval + completeness + source coverage), grounding status, and full retrieval trace.
15. Every Q&A exchange is persisted to conversation history, scoped by `user_id`.

## Security Features

- JWT bearer auth on all protected routes.
- bcrypt password hashing.
- Multi-tenant isolation: all reads/writes are scoped by `user_id` — including document store, collections, history, versions, and async jobs. Ownership checks prevent leaking existence of other users' data.
- Prompt injection protection (`src/input_sanitizer.py`): detects and redacts prompt leakage, jailbreak attempts, instruction injection, separator injection, and unicode-based attacks (bidi overrides, zero-width chars).
- Path traversal protection on uploads (filename sanitized with `Path(file.filename).name`).
- File type whitelist and 50 MB size limit.
- UUID-prefixed stored filenames to prevent collisions.
- CORS restricted to explicit `ALLOWED_ORIGINS` (no wildcard).
- JWT secret validated at startup — refuses to boot in production with the default key.
- Atomic file writes (tmp + replace) and `filelock`-based cross-process locking for all JSON stores.
- Rollback on failed document ingestion (Chroma, BM25, doc_store, collections stay consistent).

## RAG Quality Features

- **Hybrid retrieval with RRF** — dense (Chroma cosine) + sparse (BM25), with automatic fallback modes (`hybrid`, `dense_only`, `bm25_fallback`, `empty`).
- **Cross-encoder re-ranking** — optional second-pass scoring; graceful no-op when dependencies are missing.
- **Query rewriting** — vague/casual questions are rewritten into keyword-rich retrieval queries via LLM.
- **Section-aware retrieval** — detects queries targeting abstract/introduction/conclusion/methodology/references/results/discussion.
- **Content deduplication** — deterministic SHA-256 content hashing removes duplicate chunks before answer generation.
- **Strict grounding** — configurable relevance threshold refuses low-confidence answers.
- **Multi-dimensional confidence scoring** — `retrieval_confidence`, `answer_completeness`, `source_coverage`, `composite_score`, and an A–F grade.
- **Retrieval trace** — every answer includes the rewritten query, chunk scores, duplicates removed, and retrieval mode for full auditability.
- **Metadata question interception** — questions like "what's the filename?" are answered directly without an LLM call.

## Testing

Run the test suite:

```bash
python -m pytest tests/ -v
```

Covered scenarios:

- Async job store (create/update/stage/fail)
- Background worker retry logic (3 retries then permanent failure)
- Duplicate upload detection
- Input sanitizer (prompt injection patterns)
- Multi-tenant isolation (data scoped per user)
- RAG pipeline grounding (low-confidence refusal)
- Retriever fallback modes (dense-only, BM25 fallback, empty)
- Auth duplicate username/email rejection
- Upload path traversal protection

## Troubleshooting

Startup fails with an API key error:

- Check `LLM_PROVIDER`.
- If `LLM_PROVIDER=gemini`, set `GEMINI_API_KEY`.
- If `LLM_PROVIDER=openai`, set `OPENAI_API_KEY`.

Protected route returns `401`:

- Register or log in first.
- Send `Authorization: Bearer <access_token>`.
- Make sure `JWT_SECRET_KEY` has not changed since the token was issued.

Queries return no relevant documents:

- Upload at least one document first.
- Check `GET /api/stats`.
- Try increasing `k` in the query request.
- Rephrase the question to use terms present in the document.

Queries refuse to answer (low confidence):

- Lower `RELEVANCE_THRESHOLD` or set `STRICT_GROUNDING=false` (not recommended for production).
- Upload more relevant documents.
- Reduce `CHUNK_SIZE` for more granular retrieval.

Large or slow uploads:

- Use the async upload endpoint (`/api/upload/async`).
- Reduce `CHUNK_SIZE`.
- Process very large documents one at a time.

OCR/table extraction not working:

- Install optional dependencies: `pytesseract`, `Pillow`, `pdf2image` (requires Tesseract and Poppler), and `pdfplumber`.

Async uploads stuck in `queued`:

- Check that the Redis URL is reachable (if `REDIS_URL` is set).
- Without Redis, jobs use the in-memory store and are lost on restart.

## Development

Run the backend in reload mode:

```bash
python -m uvicorn src.main:app --reload
```

Useful checks:

```bash
python -m compileall src
```

```bash
python -m pytest tests/ -v
```

```bash
curl http://localhost:8000/api/health
```

For route-level details, use FastAPI's Swagger UI at `/docs`.
