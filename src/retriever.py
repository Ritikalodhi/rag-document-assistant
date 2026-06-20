
"""Document retrieval from vector database"""
 
from langchain_community.vectorstores import Chroma
from src.config import (
    LLM_PROVIDER,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    CHROMA_PERSIST_DIR,
)
from loguru import logger
 
 
def _build_embeddings():
    """Return the correct embedding model based on LLM_PROVIDER."""
    if LLM_PROVIDER == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            api_key=OPENAI_API_KEY,
            model="text-embedding-3-small",
        )
    elif LLM_PROVIDER == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=GEMINI_API_KEY,
        )
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER for embeddings: {LLM_PROVIDER}")
 
 
class VectorRetriever:
    """Manages the Chroma vector store and similarity-based retrieval."""
 
    def __init__(
        self,
        collection_name: str = "documents",
        persist_dir: str = CHROMA_PERSIST_DIR,
    ):
        self.collection_name = collection_name
        self.persist_dir = persist_dir
        self.embeddings = _build_embeddings()
        logger.info(f"Initialized embeddings for provider: {LLM_PROVIDER}")
 
        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=persist_dir,
        )
        logger.info(f"Initialized VectorRetriever (collection={collection_name})")
 
    def add_documents(self, documents: list) -> None:
        """Embed and store documents.
 
        ChromaDB >=0.4 persists automatically when persist_directory is set —
        calling .persist() raises AttributeError and must not be used.
        """
        try:
            ids = self.vectorstore.add_documents(documents)
            logger.info(f"Added {len(ids)} chunks to vector store")
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            raise
 
    def retrieve(self, query: str, k: int = 4) -> list:
        """Return the k most similar documents for a query."""
        try:
            results = self.vectorstore.similarity_search(query, k=k)
            logger.info(f"Retrieved {len(results)} docs for: {query[:50]}...")
            return results
        except Exception as e:
            logger.error(f"Error retrieving documents: {e}")
            raise
 
    def retrieve_with_scores(self, query: str, k: int = 4) -> list[tuple]:
        """Return documents with cosine similarity scores."""
        try:
            results = self.vectorstore.similarity_search_with_score(query, k=k)
            logger.info(f"Retrieved {len(results)} docs with scores")
            return results
        except Exception as e:
            logger.error(f"Error retrieving documents with scores: {e}")
            raise
 
    def get_collection_info(self) -> dict:
        """Return basic stats about the current Chroma collection."""
        try:
            count = self.vectorstore._collection.count()
            return {
                "collection_name": self.collection_name,
                "document_count": count,
                "persist_dir": self.persist_dir,
            }
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            raise

