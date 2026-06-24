
"""Document loading and processing utilities."""
 
from pathlib import Path
 
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from loguru import logger
 
from src.config import CHUNK_SIZE, CHUNK_OVERLAP
 
# File extension → loader class mapping.
# Markdown is treated as plain text; add new types here without touching any method.
_LOADERS: dict[str, type] = {
    ".pdf":  PyPDFLoader,
    ".txt":  TextLoader,
    ".docx": Docx2txtLoader,
    ".md":   TextLoader,
}
 
SUPPORTED_EXTENSIONS = set(_LOADERS.keys())
 
 
class DocumentProcessor:
    """Handles document loading and chunking for the RAG pipeline."""
 
    def __init__(
        self,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        logger.info(
            f"DocumentProcessor ready "
            f"(chunk_size={chunk_size}, overlap={chunk_overlap})"
        )
 
    # ── Loading ───────────────────────────────────────────────────────────────
 
    def load_document(self, file_path: str) -> list[Document]:
        """Load any supported document type and return a list of Documents.
 
        Raises:
            ValueError: if the file extension is not supported.
            Exception:  propagates loader errors with a logged message.
        """
        path = Path(file_path)
        ext = path.suffix.lower()
 
        if ext not in _LOADERS:
            raise ValueError(
                f"Unsupported file type '{ext}'. "
                f"Supported: {sorted(SUPPORTED_EXTENSIONS)}"
            )
 
        loader_cls = _LOADERS[ext]
 
        # TextLoader needs an explicit encoding; other loaders don't accept it.
        try:
            if loader_cls is TextLoader:
                loader = loader_cls(file_path, encoding="utf-8")
            else:
                loader = loader_cls(file_path)
 
            documents = loader.load()
            logger.info(f"Loaded {path.name!r} ({len(documents)} page(s) / section(s))")
            return documents
 
        except Exception as e:
            logger.error(f"Error loading {path.name!r}: {e}")
            raise
 
    # ── Chunking ──────────────────────────────────────────────────────────────
 
    def split_documents(self, documents: list[Document]) -> list[Document]:
        """Split documents into overlapping chunks for embedding.
 
        Args:
            documents: Output of load_document().
 
        Returns:
            Flat list of chunked Document objects.
        """
        try:
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error splitting documents: {e}")
            raise
 
    # ── Combined pipeline ─────────────────────────────────────────────────────
 
    def process_file(self, file_path: str) -> list[Document]:
        """Load and chunk a file in one call.
 
        This is the method called by RAGPipeline.add_document().
        """
        documents = self.load_document(file_path)
        return self.split_documents(documents)

