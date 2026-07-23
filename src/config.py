"""Configuration management for RAG Document Assistant."""
 
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
 
load_dotenv()

logger = logging.getLogger(__name__)
 
# ── Project paths ─────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR     = PROJECT_ROOT / "data"
DOCUMENT_DIR = DATA_DIR / "documents"
CHROMA_DB_DIR = DATA_DIR / "chroma_db"
 
DOCUMENT_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)
 
# ── LLM provider ──────────────────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower().strip()
 
# ── OpenAI ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo").strip()
 
# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-1.5-pro").strip()
 
# ── Validate keys at startup — fail fast with a clear message ─────────────────
if LLM_PROVIDER == "openai":
    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to your .env file."
        )
elif LLM_PROVIDER == "gemini":
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not set. Add it to your .env file."
        )
else:
    raise ValueError(
        f"Invalid LLM_PROVIDER: '{LLM_PROVIDER}'. Must be 'openai' or 'gemini'."
    )
 
# ── Chunking ──────────────────────────────────────────────────────────────────
CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
CHUNK_STRATEGY = os.getenv("CHUNK_STRATEGY", "recursive").lower().strip()
 
# ── Vector DB ─────────────────────────────────────────────────────────────────
_chroma_env = os.getenv("CHROMA_PERSIST_DIR", "").strip()
CHROMA_PERSIST_DIR = str(
    Path(_chroma_env).resolve() if _chroma_env else CHROMA_DB_DIR
)
 
# ── API server ────────────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
 
# ── Cross-encoder Re-ranker ───────────────────────────────────────────────────
RERANKER_ENABLED = os.getenv("RERANKER_ENABLED", "true").lower() in ("1", "true", "yes")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2").strip()
RERANKER_CANDIDATES = int(os.getenv("RERANKER_CANDIDATES", "30"))

# ── Conversation Memory ───────────────────────────────────────────────────────
MEMORY_WINDOW = int(os.getenv("MEMORY_WINDOW", "10"))        # last N exchanges to inject
MEMORY_MAX_CHARS = int(os.getenv("MEMORY_MAX_CHARS", "2000"))  # truncate history string at this length

# ── LLM Reliability ──────────────────────────────────────────────────────────
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_REQUEST_TIMEOUT = int(os.getenv("LLM_REQUEST_TIMEOUT", "60"))
LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL", "").strip() or None

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
 
# ── File handling ─────────────────────────────────────────────────────────────
SUPPORTED_FILE_TYPES = {
    ".pdf":  "application/pdf",
    ".txt":  "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".md":   "text/markdown",
}
 
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# ── Environment ───────────────────────────────────────────────────────────────
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower().strip()

# ── JWT Secret ────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "CHANGE_ME_IN_ENV")
if SECRET_KEY == "CHANGE_ME_IN_ENV":
    if ENVIRONMENT == "production":
        raise RuntimeError("JWT_SECRET_KEY must be set in production")
    logger.warning("Using default JWT_SECRET_KEY — do not use in production")

# ── CORS ──────────────────────────────────────────────────────────────────────
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]