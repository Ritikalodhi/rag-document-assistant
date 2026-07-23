"""Document loading and processing utilities.

Supports multiple chunking strategies:
- recursive (default): RecursiveCharacterTextSplitter
- semantic: Sentence-aware splitting based on topic shifts
- sentence: Sentence-by-sentence with fixed-size grouping
"""

from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from loguru import logger

from src.config import CHUNK_SIZE, CHUNK_OVERLAP

_LOADERS: dict[str, type] = {
    ".pdf":  PyPDFLoader,
    ".txt":  TextLoader,
    ".docx": Docx2txtLoader,
    ".md":   TextLoader,
}

SUPPORTED_EXTENSIONS = set(_LOADERS.keys())

# Supported chunking strategies
CHUNKING_STRATEGIES = ("recursive", "semantic", "sentence")


class DocumentProcessor:
    """Handles document loading and chunking for the RAG pipeline.

    Args:
        chunk_size: Target chunk size in characters.
        chunk_overlap: Overlap between chunks in characters.
        strategy: Chunking strategy --- ``"recursive"`` (default),
                  ``"semantic"``, or ``"sentence"``.
    """

    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP,
                 strategy: str = "recursive"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = strategy.lower().strip()
        if self.strategy not in CHUNKING_STRATEGIES:
            logger.warning(f"Unknown chunking strategy '{strategy}', falling back to 'recursive'")
            self.strategy = "recursive"
        self.text_splitter = self._build_splitter()
        logger.info(f"DocumentProcessor ready (chunk_size={chunk_size}, overlap={chunk_overlap}, strategy={self.strategy})")

    def _build_splitter(self):
        """Build the text splitter based on the configured strategy."""
        if self.strategy == "recursive":
            return RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                separators=["\n\n", "\n", " ", ""],
            )
        if self.strategy == "sentence":
            try:
                from langchain_text_splitters import SentenceTransformersTokenTextSplitter
                return SentenceTransformersTokenTextSplitter(
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap,
                )
            except ImportError:
                logger.warning("sentence-transformers not installed, falling back to recursive")
        if self.strategy == "semantic":
            try:
                from langchain_experimental.text_splitter import SemanticChunker
                from src.embeddings import EmbeddingManager
                embeddings = EmbeddingManager()
                return SemanticChunker(
                    embeddings=embeddings,
                    breakpoint_threshold_type="percentile",
                    breakpoint_threshold_amount=70,
                )
            except ImportError:
                logger.warning("langchain-experimental not installed, falling back to recursive")
            except Exception as exc:
                logger.warning(f"Semantic chunker init failed ({exc}), falling back to recursive")
        # Fallback
        return RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )

    def load_document(self, file_path: str) -> list[Document]:
        """Load any supported document. Auto-applies OCR for scanned PDFs."""
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext not in _LOADERS:
            raise ValueError(f"Unsupported file type '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}")

        loader_cls = _LOADERS[ext]
        try:
            loader = loader_cls(file_path, encoding="utf-8") if loader_cls is TextLoader else loader_cls(file_path)
            documents = loader.load()
            logger.info(f"Loaded {path.name!r} ({len(documents)} page(s))")

            # OCR fallback for scanned PDFs
            if ext == ".pdf":
                combined_text = " ".join(d.page_content for d in documents)
                from src.ocr_processor import is_scanned_pdf, ocr_pdf, OCR_AVAILABLE
                if is_scanned_pdf(combined_text):
                    if OCR_AVAILABLE:
                        logger.info(f"Scanned PDF detected --- running OCR on {path.name!r}")
                        ocr_text = ocr_pdf(file_path)
                        # Return as single Document with OCR text
                        documents = [Document(
                            page_content=ocr_text,
                            metadata={"source": file_path, "ocr": True}
                        )]
                        logger.info(f"OCR complete: {len(ocr_text)} chars")
                    else:
                        logger.warning(f"Scanned PDF detected but OCR unavailable: {path.name!r}")

            return documents

        except Exception as e:
            logger.error(f"Error loading {path.name!r}: {e}")
            raise

    def split_documents(self, documents: list[Document]) -> list[Document]:
        """Split documents into chunks using the configured strategy."""
        try:
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"{self.strategy.title()} split into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error splitting documents: {e}")
            raise

    def process_file(self, file_path: str) -> list[Document]:
        """Load and chunk a file in one call."""
        documents = self.load_document(file_path)
        return self.split_documents(documents)

