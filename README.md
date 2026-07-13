# RAG Document Assistant

A FastAPI backend for uploading documents, indexing them into a local RAG knowledge base, and asking grounded questions over the uploaded content.

This README focuses on the backend. The React frontend exists in `frontend/`, but is intentionally not covered here.

## What It Does

- Upload and process `.pdf`, `.txt`, `.docx`, and `.md` files.
- Split documents into chunks and store embeddings in a local Chroma database.
- Retrieve relevant chunks with hybrid search: dense vector search plus BM25 keyword search.
- Generate answers with either Google Gemini or OpenAI.
- Return answer context, source filenames, page numbers when available, retrieval trace, and confidence scoring.
- Support JWT-based registration, login, and protected API routes.
- Track documents, collections, conversation history, summaries, versions, exports, and analytics locally.
- Provide extra document intelligence features such as summaries, suggested questions, study notes, document comparison, cross-document analysis, table extraction, and scanned-PDF OCR fallback when available.

## Tech Stack

- Backend: FastAPI, Pydantic, Uvicorn
- RAG: LangChain, Chroma, BM25
- LLM providers: Google Gemini or OpenAI
- Embeddings:
  - Gemini provider: `models/gemini-embedding-001`
  - OpenAI provider: `text-embedding-3-small`
- Storage:
  - Chroma vector database under `data/chroma_db/`
  - JSON stores for documents, collections, history, and versions
  - SQLite user database at `data/users.db`
- Auth: JWT bearer tokens with bcrypt password hashing

## Project Structure

```text
rag-document-assistant-main/
|-- src/
|   |-- main.py                 # FastAPI app and API routes
|   |-- config.py               # Environment and path configuration
|   |-- rag_pipeline.py         # Main orchestration layer
|   |-- document_processor.py   # File loading, chunking, OCR fallback
|   |-- retriever.py            # Chroma + BM25 hybrid retrieval
|   |-- llm.py                  # Gemini/OpenAI chat model wrapper
|   |-- doc_store.py            # Document metadata and full-text store
|   |-- collections.py          # Document collection/workspace store
|   |-- history.py              # Conversation history store
|   |-- summarizer.py           # Document summaries
|   |-- comparator.py           # Two-document comparison
|   |-- cross_document.py       # Multi-document analysis
|   |-- study_notes.py          # Study notes, flashcards, MCQs
|   |-- suggested_questions.py  # Follow-up question generation
|   |-- confidence_scorer.py    # Answer confidence scoring
|   |-- table_extractor.py      # PDF table extraction
|   |-- ocr_processor.py        # OCR support for scanned PDFs
|   |-- exporter.py             # Markdown/PDF export helpers
|   |-- versioning.py           # Document version tracking
|   `-- auth/
|       |-- routes.py           # Register, login, me
|       |-- models.py           # Auth request/response models
|       |-- security.py         # Password hashing and JWT helpers
|       |-- dependencies.py     # Current-user dependencies
|       `-- database.py         # SQLite user storage
|-- data/                       # Runtime data, generated locally
|-- requirements.txt
|-- API_DOCS.md
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
GEMINI_MODEL=gemini-1.5-pro
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
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
CHROMA_PERSIST_DIR=./data/chroma_db
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
```

Important: set `JWT_SECRET_KEY` before using this outside local development. The code has a fallback value, but that fallback is not safe for production.

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

### Upload a document

```bash
curl -X POST "http://localhost:8000/api/upload" \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@paper.pdf"
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
- `GET /api/auth/me`

Documents:

- `POST /api/upload`
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
- `PATCH /api/collections/{collection_id}`
- `DELETE /api/collections/{collection_id}`

Conversations:

- `GET /api/conversations`
- `DELETE /api/conversations/{entry_id}`
- `POST /api/conversations/clear`

Versioning and export:

- `GET /api/documents/{doc_id}/versions`
- `GET /api/documents/{doc_id}/versions/compare`
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
- `data/bm25_index.pkl`: BM25 sparse retrieval index
- Additional JSON files may be created for collections, history, and versioning

These files are local development state. Do not commit real user documents, API keys, user databases, or generated private data.

## How the Backend Works

1. A user registers or logs in and receives a JWT.
2. The user uploads a supported document.
3. The document is saved under `data/documents/`.
4. The backend loads the file, runs OCR fallback for scanned PDFs when available, and splits text into overlapping chunks.
5. Chunks are embedded and stored in Chroma.
6. The same chunks are also added to a BM25 index.
7. Metadata, full text, version information, and collection membership are stored locally.
8. During a query, the retriever combines dense vector results and sparse BM25 results with Reciprocal Rank Fusion.
9. The selected context is sent to the configured LLM.
10. The response includes the answer, supporting context, confidence information, and retrieval trace.

## Notes and Limitations

- File uploads are limited to 50 MB.
- Supported file extensions are `.pdf`, `.txt`, `.docx`, and `.md`.
- Table extraction is available for PDFs when the required parser dependency is available.
- OCR fallback depends on the OCR dependencies and local system support configured in `src/ocr_processor.py`.
- Authentication protects most application routes, but document and collection records are currently stored globally rather than isolated per user.
- CORS is configured with `allow_origins=["*"]`, which is convenient for development but should be restricted before production deployment.

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

Large or slow uploads:

- Reduce `CHUNK_SIZE`.
- Increase `CHUNK_OVERLAP` only when you need more context continuity.
- Process very large documents one at a time.

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
curl http://localhost:8000/api/health
```

For route-level details, use FastAPI's Swagger UI at `/docs`.
