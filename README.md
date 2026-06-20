# RAG Document Assistant

A personal document Q&A system that lets you upload PDFs, documents, and ask intelligent questions about them.

**Now with support for both OpenAI and Google Gemini!**

## Features

- 📄 **Multi-format Support**: PDF, TXT, DOCX, Markdown
- 🔍 **Semantic Search**: Find relevant content using embeddings
- 🤖 **AI-Powered Answers**: GPT-4/3.5 or Gemini 1.5 Pro/Flash generates context-aware responses
- 💾 **Local Storage**: Chroma vector database (no expensive cloud setup)
- 🌐 **Web Interface**: FastAPI backend + React frontend
- 📊 **Conversation History**: Track your Q&A interactions
- 🎯 **Flexible LLM Provider**: Switch between OpenAI and Gemini

## Tech Stack

- **Backend**: FastAPI, LangChain, OpenAI & Google Generative AI
- **Vector DB**: Chroma (local, in-memory or persistent)
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM Options**: 
  - OpenAI: GPT-4 / GPT-3.5-turbo
  - Google Gemini: gemini-1.5-pro / gemini-1.5-flash
- **Frontend**: React (optional, can use CLI first)

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+ (for frontend)
- **Either** OpenAI API key **OR** Google Gemini API key

### 1. Clone & Setup Backend

```bash
git clone https://github.com/Ritikalodhi/rag-document-assistant.git
cd rag-document-assistant

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
```

### 2. Configure API Key

**Option A: Using Google Gemini (Recommended - Free tier available)**
```bash
# Edit .env file
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-1.5-pro  # or gemini-1.5-flash
LLM_PROVIDER=gemini
OPENAI_API_KEY=sk-...  # Still needed for embeddings
```

Get free Gemini API key: https://makersuite.google.com/app/apikey

**Option B: Using OpenAI**
```bash
# Edit .env file
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
LLM_PROVIDER=openai
```

### 3. Start Backend

```bash
python -m uvicorn src.main:app --reload
# API runs at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 4. Upload Documents & Ask Questions

**Via CLI:**
```bash
python src/cli.py
```

**Via API:**
```bash
# Upload
curl -X POST http://localhost:8000/api/upload \
  -F "file=@document.pdf"

# Query
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is...?"}'
```

### 5. Frontend (Optional)

```bash
cd frontend
npm install
npm start
# UI runs at http://localhost:3000
```

## Project Structure

```
rag-document-assistant/
├── src/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app
│   ├── cli.py                  # Command-line interface
│   ├── config.py               # Configuration (supports both providers)
│   ├── embeddings.py           # Embedding logic
│   ├── document_processor.py   # PDF/doc parsing
│   ├── retriever.py            # Vector search
│   ├── llm.py                  # LLM integration (OpenAI & Gemini)
│   └── rag_pipeline.py         # Main RAG logic
├── frontend/                   # React UI
├── data/
│   ├── documents/              # Uploaded documents
│   └── chroma_db/              # Vector store
├── requirements.txt
├── .env.example
└── README.md
```

## Configuration

Edit `.env`:

**For Gemini:**
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-pro
OPENAI_API_KEY=sk-...  # Required for embeddings
```

**For OpenAI:**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

**Common Settings:**
```env
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
API_PORT=8000
LOG_LEVEL=INFO
```

## Comparing Providers

| Feature | OpenAI | Google Gemini |
|---------|--------|---------------|
| Quality | Excellent | Very Good |
| Speed | Fast | Very Fast |
| Cost | Pay-as-you-go | Free tier available |
| Model | GPT-4, GPT-3.5 | Pro, Flash (faster) |
| API Key | Required | Free to generate |

**Recommendation**: Start with Gemini's free tier to test, then switch to your preferred provider.

## Common Issues

### Out of memory with large documents
- Reduce `CHUNK_SIZE` in `.env`
- Process documents in batches

### Slow embeddings
- Use `text-embedding-3-small` (default)
- Note: Embeddings use OpenAI regardless of LLM provider

### "API key not found" error
- Ensure you've set the correct environment variable
- Check `.env` file is in project root
- Run `source venv/bin/activate` before running

### No relevant results
- Check document upload was successful
- Verify embeddings are generated
- Try rephrasing your question
- Check stats: `curl http://localhost:8000/api/stats`

## Next Steps

1. ✅ Set up backend with your chosen provider
2. ✅ Upload your first document
3. ✅ Ask a test question
4. 🔲 Fine-tune prompts
5. 🔲 Add authentication
6. 🔲 Deploy to cloud (Vercel, Railway, Render, etc.)

## API Documentation

See `API_DOCS.md` for complete endpoint documentation.

Or visit the interactive docs:
```
http://localhost:8000/docs
```

## Contributing

Feel free to fork and submit PRs!

## License

MIT
