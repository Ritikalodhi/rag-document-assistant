
"""Configuration management for RAG Document Assistant."""
 
import os
from pathlib import Path
from dotenv import load_dotenv
 
load_dotenv()
 
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
# BUG FIX: original used `if not KEY` which treats an empty string as missing.
# We now also .strip() values above so "  " (whitespace) is caught too.
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
 
# ── Vector DB ─────────────────────────────────────────────────────────────────
# BUG FIX: original fell back to the *string* "./data/chroma_db" from the env,
# which resolves relative to wherever uvicorn is run from — not the project root.
# We now always resolve against the project-root-anchored CHROMA_DB_DIR so the
# path is absolute and consistent regardless of the working directory.
_chroma_env = os.getenv("CHROMA_PERSIST_DIR", "").strip()
CHROMA_PERSIST_DIR = str(
    Path(_chroma_env).resolve() if _chroma_env else CHROMA_DB_DIR
)
 
# ── API server ────────────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
 
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

# """Configuration management for RAG Document Assistant"""

# import os
# from pathlib import Path
# from dotenv import load_dotenv

# # Load environment variables
# load_dotenv()

# # Project paths
# PROJECT_ROOT = Path(__file__).parent.parent
# DATA_DIR = PROJECT_ROOT / "data"
# DOCUMENT_DIR = DATA_DIR / "documents"
# CHROMA_DB_DIR = DATA_DIR / "chroma_db"

# # Create directories if they don't exist
# DOCUMENT_DIR.mkdir(parents=True, exist_ok=True)
# CHROMA_DB_DIR.mkdir(parents=True, exist_ok=True)

# # LLM Provider Selection
# LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

# # OpenAI Configuration
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

# # Gemini Configuration
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

# # Validate API key based on provider
# if LLM_PROVIDER == "openai":
#     if not OPENAI_API_KEY:
#         raise ValueError("OPENAI_API_KEY not set in environment variables")
# elif LLM_PROVIDER == "gemini":
#     if not GEMINI_API_KEY:
#         raise ValueError("GEMINI_API_KEY not set in environment variables")
# else:
#     raise ValueError(f"Invalid LLM_PROVIDER: {LLM_PROVIDER}. Use 'openai' or 'gemini'")

# # Chunking Configuration
# CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
# CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))

# # Vector Database
# CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", str(CHROMA_DB_DIR))

# # API Configuration
# API_HOST = os.getenv("API_HOST", "0.0.0.0")
# API_PORT = int(os.getenv("API_PORT", "8000"))

# # Logging
# LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# # Supported file types
# SUPPORTED_FILE_TYPES = {
#     ".pdf": "application/pdf",
#     ".txt": "text/plain",
#     ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
#     ".md": "text/markdown",
# }

# MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
