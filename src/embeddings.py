
"""Embedding generation and management"""
 
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from src.config import GEMINI_API_KEY
from loguru import logger
 
# The correct model name for the current google-genai SDK.
_EMBEDDING_MODEL = "models/gemini-embedding-001"
 
 
class EmbeddingManager:
    """Manages embeddings for documents via Google Gemini."""
 
    def __init__(self):
        """Initialize embedding manager."""
        self.model_name = _EMBEDDING_MODEL
        self.embeddings = GoogleGenerativeAIEmbeddings(
            google_api_key=GEMINI_API_KEY,
            model=_EMBEDDING_MODEL,
        )
        logger.info(f"Initialized EmbeddingManager with model: {self.model_name}")
 
    def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text string."""
        try:
            return self.embeddings.embed_query(text)
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise
 
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        try:
            return self.embeddings.embed_documents(texts)
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            raise
 
    def get_embedding_dimension(self) -> int:
        """Return the vector dimension size."""
        return len(self.embed_text("test"))

# """Embedding generation and management"""

# from langchain_google_genai import GoogleGenerativeAIEmbeddings
# from src.config import GEMINI_API_KEY
# from loguru import logger


# class EmbeddingManager:
#     """Manages embeddings for documents"""

#     def __init__(self, model: str = "text-embedding-3-small"):
#         """Initialize embedding manager
        
#         Args:
#             model: OpenAI embedding model to use
#         """
#         self.model_name = model
#         self.embeddings = GoogleGenerativeAIEmbeddings(
#         google_api_key=GEMINI_API_KEY,
#         model="models/embedding-004"
#     )
#         logger.info(f"Initialized embeddings with model: {model}")

#     def embed_text(self, text: str) -> list[float]:
#         """Generate embedding for a single text
        
#         Args:
#             text: Text to embed
            
#         Returns:
#             Embedding vector
#         """
#         try:
#             embedding = self.embeddings.embed_query(text)
#             return embedding
#         except Exception as e:
#             logger.error(f"Error generating embedding: {e}")
#             raise

#     def embed_texts(self, texts: list[str]) -> list[list[float]]:
#         """Generate embeddings for multiple texts
        
#         Args:
#             texts: List of texts to embed
            
#         Returns:
#             List of embedding vectors
#         """
#         try:
#             embeddings = self.embeddings.embed_documents(texts)
#             return embeddings
#         except Exception as e:
#             logger.error(f"Error generating embeddings for batch: {e}")
#             raise

#     def get_embedding_dimension(self) -> int:
#         """Get the dimension of embeddings
        
#         Returns:
#             Dimension size
#         """
#         test_embedding = self.embed_text("test")
#         return len(test_embedding)
