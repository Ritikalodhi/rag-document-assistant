# RAG Document Assistant - API Documentation

## Base URL

```
http://localhost:8000
```

## Authentication

Currently no authentication required. In production, add JWT or API keys.

## Endpoints

### 1. Health Check

**GET** `/`

Basic health check

**Response:**
```json
{
  "status": "ok",
  "message": "RAG Document Assistant is running",
  "version": "0.1.0"
}
```

---

### 2. Upload Document

**POST** `/api/upload`

Upload a document to the RAG system

**Supported formats:** PDF, TXT, DOCX, Markdown

**Request:**
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@path/to/document.pdf"
```

**Response:**
```json
{
  "filename": "document.pdf",
  "success": true,
  "message": "Document uploaded and processed successfully",
  "chunks": 42
}
```

**Error Response (400):**
```json
{
  "detail": "Unsupported file type: .xyz. Supported types: ['.pdf', '.txt', '.docx', '.md']"
}
```

**Error Response (413):**
```json
{
  "detail": "File size exceeds maximum allowed size: 50MB"
}
```

---

### 3. Query Documents

**POST** `/api/query`

Query the RAG system to answer questions based on uploaded documents

**Request:**
```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the main topic?",
    "k": 4
  }'
```

**Request Body:**
```json
{
  "question": "Your question here",
  "k": 4
}
```

**Response:**
```json
{
  "question": "What is the main topic?",
  "answer": "The main topic discussed in the documents is...",
  "context": [
    {
      "content": "Page content excerpt...",
      "source": "document.pdf"
    },
    {
      "content": "Another relevant excerpt...",
      "source": "document.pdf"
    }
  ],
  "success": true
}
```

---

### 4. Get Statistics

**GET** `/api/stats`

Get information about the current collection

**Request:**
```bash
curl http://localhost:8000/api/stats
```

**Response:**
```json
{
  "collection_name": "documents",
  "document_count": 5,
  "persist_dir": "./data/chroma_db"
}
```

---

### 5. Health Status

**GET** `/api/health`

Detailed health check

**Response:**
```json
{
  "status": "healthy",
  "rag_initialized": true
}
```

---

## Interactive API Documentation

Once the server is running, visit:

```
http://localhost:8000/docs
```

This provides an interactive Swagger UI where you can test all endpoints.

---

## Error Handling

### Common Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad request (e.g., unsupported file type) |
| 413 | Payload too large |
| 500 | Server error |

### Error Response Format

```json
{
  "detail": "Description of the error"
}
```

---

## Rate Limiting

Currently no rate limiting. Add in production if needed.

---

## Example Workflow

### 1. Upload a document
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@research.pdf"
```

### 2. Wait for processing

### 3. Query the document
```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the key findings?"}'
```

### 4. Get stats
```bash
curl http://localhost:8000/api/stats
```

---

## Configuration by Provider

### Using Google Gemini
```bash
# .env file
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-1.5-pro
OPENAI_API_KEY=sk-...  # Still needed for embeddings
```

### Using OpenAI
```bash
# .env file
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

---

## Development

For detailed API documentation with request/response examples, use the Swagger UI at `/docs` when the server is running.
