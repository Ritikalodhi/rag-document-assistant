"""Document loading and processing utilities."""

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


class DocumentProcessor:
    """Handles document loading and chunking for the RAG pipeline."""

    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        logger.info(f"DocumentProcessor ready (chunk_size={chunk_size}, overlap={chunk_overlap})")

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
                        logger.info(f"Scanned PDF detected — running OCR on {path.name!r}")
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
        """Split documents into overlapping chunks."""
        try:
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error splitting documents: {e}")
            raise

    def process_file(self, file_path: str) -> list[Document]:
        """Load and chunk a file in one call."""
        documents = self.load_document(file_path)
        return self.split_documents(documents)
# """Document loading and processing utilities."""
 
# from pathlib import Path
 
# from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_core.documents import Document
# from loguru import logger
 
# from src.config import CHUNK_SIZE, CHUNK_OVERLAP
 
# # File extension → loader class mapping.
# # Markdown is treated as plain text; add new types here without touching any method.
# _LOADERS: dict[str, type] = {
#     ".pdf":  PyPDFLoader,
#     ".txt":  TextLoader,
#     ".docx": Docx2txtLoader,
#     ".md":   TextLoader,
# }
 
# SUPPORTED_EXTENSIONS = set(_LOADERS.keys())
 
 
# class DocumentProcessor:
#     """Handles document loading and chunking for the RAG pipeline."""
 
#     def __init__(
#         self,
#         chunk_size: int = CHUNK_SIZE,
#         chunk_overlap: int = CHUNK_OVERLAP,
#     ):
#         self.chunk_size = chunk_size
#         self.chunk_overlap = chunk_overlap
#         self.text_splitter = RecursiveCharacterTextSplitter(
#             chunk_size=chunk_size,
#             chunk_overlap=chunk_overlap,
#             separators=["\n\n", "\n", " ", ""],
#         )
#         logger.info(
#             f"DocumentProcessor ready "
#             f"(chunk_size={chunk_size}, overlap={chunk_overlap})"
#         )
 
#     # ── Loading ───────────────────────────────────────────────────────────────
 
#     def load_document(self, file_path: str) -> list[Document]:
#         """Load any supported document type and return a list of Documents.
 
#         Raises:
#             ValueError: if the file extension is not supported.
#             Exception:  propagates loader errors with a logged message.
#         """
#         path = Path(file_path)
#         ext = path.suffix.lower()
 
#         if ext not in _LOADERS:
#             raise ValueError(
#                 f"Unsupported file type '{ext}'. "
#                 f"Supported: {sorted(SUPPORTED_EXTENSIONS)}"
#             )
 
#         loader_cls = _LOADERS[ext]
 
#         # TextLoader needs an explicit encoding; other loaders don't accept it.
#         try:
#             if loader_cls is TextLoader:
#                 loader = loader_cls(file_path, encoding="utf-8")
#             else:
#                 loader = loader_cls(file_path)
 
#             documents = loader.load()
#             logger.info(f"Loaded {path.name!r} ({len(documents)} page(s) / section(s))")
#             return documents
 
#         except Exception as e:
#             logger.error(f"Error loading {path.name!r}: {e}")
#             raise
 
#     # ── Chunking ──────────────────────────────────────────────────────────────
 
#     def split_documents(self, documents: list[Document]) -> list[Document]:
#         """Split documents into overlapping chunks for embedding.
 
#         Args:
#             documents: Output of load_document().
 
#         Returns:
#             Flat list of chunked Document objects.
#         """
#         try:
#             chunks = self.text_splitter.split_documents(documents)
#             logger.info(f"Split into {len(chunks)} chunks")
#             return chunks
#         except Exception as e:
#             logger.error(f"Error splitting documents: {e}")
#             raise
 
#     # ── Combined pipeline ─────────────────────────────────────────────────────
 
#     def process_file(self, file_path: str) -> list[Document]:
#         """Load and chunk a file in one call.
 
#         This is the method called by RAGPipeline.add_document().
#         """
#         documents = self.load_document(file_path)
#         return self.split_documents(documents)

