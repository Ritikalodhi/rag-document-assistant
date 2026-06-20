
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

# """Document loading and processing utilities"""

# from pathlib import Path
# from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
# try:
#     from langchain_text_splitters import RecursiveCharacterTextSplitter
# except ImportError:
#     from langchain.text_splitter import RecursiveCharacterTextSplitter
# try:
#     from langchain_core.documents import Document
# except ImportError:
#     from langchain.schema import Document
# from src.config import CHUNK_SIZE, CHUNK_OVERLAP
# from loguru import logger
# import os


# class DocumentProcessor:
#     """Handles document loading and chunking"""

#     def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
#         """Initialize document processor
        
#         Args:
#             chunk_size: Size of text chunks
#             chunk_overlap: Overlap between chunks
#         """
#         self.chunk_size = chunk_size
#         self.chunk_overlap = chunk_overlap
#         self.text_splitter = RecursiveCharacterTextSplitter(
#             chunk_size=chunk_size,
#             chunk_overlap=chunk_overlap,
#             separators=["\n\n", "\n", " ", ""]
#         )
#         logger.info(f"Initialized DocumentProcessor (chunk_size={chunk_size}, overlap={chunk_overlap})")

#     def load_pdf(self, file_path: str) -> list[Document]:
#         """Load PDF document
        
#         Args:
#             file_path: Path to PDF file
            
#         Returns:
#             List of documents
#         """
#         try:
#             loader = PyPDFLoader(file_path)
#             documents = loader.load()
#             logger.info(f"Loaded PDF: {file_path} ({len(documents)} pages)")
#             return documents
#         except Exception as e:
#             logger.error(f"Error loading PDF {file_path}: {e}")
#             raise

#     def load_txt(self, file_path: str) -> list[Document]:
#         """Load text document
        
#         Args:
#             file_path: Path to text file
            
#         Returns:
#             List of documents
#         """
#         try:
#             loader = TextLoader(file_path, encoding='utf-8')
#             documents = loader.load()
#             logger.info(f"Loaded text file: {file_path}")
#             return documents
#         except Exception as e:
#             logger.error(f"Error loading text file {file_path}: {e}")
#             raise

#     def load_docx(self, file_path: str) -> list[Document]:
#         """Load DOCX document
        
#         Args:
#             file_path: Path to DOCX file
            
#         Returns:
#             List of documents
#         """
#         try:
#             loader = Docx2txtLoader(file_path)
#             documents = loader.load()
#             logger.info(f"Loaded DOCX: {file_path}")
#             return documents
#         except Exception as e:
#             logger.error(f"Error loading DOCX {file_path}: {e}")
#             raise

#     def load_document(self, file_path: str) -> list[Document]:
#         """Load document based on file type
        
#         Args:
#             file_path: Path to document file
            
#         Returns:
#             List of documents
#         """
#         file_ext = Path(file_path).suffix.lower()

#         if file_ext == ".pdf":
#             return self.load_pdf(file_path)
#         elif file_ext == ".txt":
#             return self.load_txt(file_path)
#         elif file_ext == ".docx":
#             return self.load_docx(file_path)
#         elif file_ext == ".md":
#             # Treat markdown as plain text for now
#             return self.load_txt(file_path)
#         else:
#             raise ValueError(f"Unsupported file type: {file_ext}")

#     def split_documents(self, documents: list[Document]) -> list[Document]:
#         """Split documents into chunks
        
#         Args:
#             documents: List of documents to split
            
#         Returns:
#             List of chunked documents
#         """
#         try:
#             chunks = self.text_splitter.split_documents(documents)
#             logger.info(f"Split documents into {len(chunks)} chunks")
#             return chunks
#         except Exception as e:
#             logger.error(f"Error splitting documents: {e}")
#             raise

#     def process_file(self, file_path: str) -> list[Document]:
#         """Complete pipeline: load and chunk document
        
#         Args:
#             file_path: Path to document file
            
#         Returns:
#             List of chunked documents
#         """
#         documents = self.load_document(file_path)
#         chunks = self.split_documents(documents)
#         return chunks
