"""Hybrid retrieval: dense (Chroma) + sparse (BM25) with Reciprocal Rank Fusion."""

import json
import pickle
from pathlib import Path

from langchain_chroma import Chroma
from rank_bm25 import BM25Okapi
from src.config import (
    LLM_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY,
    CHROMA_PERSIST_DIR, DATA_DIR,
)
from loguru import logger


def _build_embeddings():
    if LLM_PROVIDER == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(api_key=OPENAI_API_KEY, model="text-embedding-3-small")
    elif LLM_PROVIDER == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001", google_api_key=GEMINI_API_KEY)
    raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")


class VectorRetriever:
    """Dense + sparse hybrid retrieval with RRF fusion."""

    _BM25_PATH = Path(DATA_DIR) / "bm25_index.pkl"

    def __init__(self, collection_name: str = "documents", persist_dir: str = CHROMA_PERSIST_DIR):
        self.collection_name = collection_name
        self.persist_dir = persist_dir
        self.embeddings = _build_embeddings()
        logger.info(f"Initialized embeddings for provider: {LLM_PROVIDER}")

        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=persist_dir,
        )

        # BM25 index: list of (tokenized_chunk, original_text, metadata)
        self._bm25: BM25Okapi | None = None
        self._bm25_docs: list[dict] = []   # [{content, metadata}]
        self._load_bm25()
        logger.info(f"Initialized VectorRetriever (collection={collection_name})")

    # ── BM25 persistence ──────────────────────────────────────────────────────

    def _load_bm25(self) -> None:
        if self._BM25_PATH.exists():
            try:
                with open(self._BM25_PATH, "rb") as f:
                    data = pickle.load(f)
                self._bm25 = data["bm25"]
                self._bm25_docs = data["docs"]
                logger.info(f"Loaded BM25 index ({len(self._bm25_docs)} docs)")
            except Exception as e:
                logger.warning(f"Could not load BM25 index: {e}")

    def _save_bm25(self) -> None:
        with open(self._BM25_PATH, "wb") as f:
            pickle.dump({"bm25": self._bm25, "docs": self._bm25_docs}, f)

    def _rebuild_bm25(self) -> None:
        if not self._bm25_docs:
            self._bm25 = None
            return
        corpus = [d["tokens"] for d in self._bm25_docs]
        self._bm25 = BM25Okapi(corpus)

    # ── Indexing ──────────────────────────────────────────────────────────────

    def add_documents(self, documents: list) -> None:
        """Embed and store in Chroma; also add to BM25 index."""
        try:
            ids = self.vectorstore.add_documents(documents)
            logger.info(f"Added {len(ids)} chunks to Chroma")

            # Add to BM25
            for doc in documents:
                tokens = doc.page_content.lower().split()
                self._bm25_docs.append({
                    "tokens": tokens,
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                })
            self._rebuild_bm25()
            self._save_bm25()
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            raise

    def delete_by_source(self, source_path: str) -> None:
        """Delete chunks from Chroma and BM25 matching the source path."""
        try:
            existing = self.vectorstore.get(where={"source": source_path})
            ids = existing.get("ids", [])
            if ids:
                self.vectorstore.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} chunks from Chroma for: {source_path}")

            # Remove from BM25
            before = len(self._bm25_docs)
            self._bm25_docs = [
                d for d in self._bm25_docs
                if d["metadata"].get("source") != source_path
            ]
            removed = before - len(self._bm25_docs)
            if removed:
                self._rebuild_bm25()
                self._save_bm25()
                logger.info(f"Removed {removed} chunks from BM25 for: {source_path}")
        except Exception as e:
            logger.error(f"Error deleting chunks for {source_path}: {e}")
            raise

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(self, query: str, k: int = 4) -> list:
        return [doc for doc, _ in self.retrieve_with_scores(query, k)]

    def retrieve_with_scores(self, query: str, k: int = 4) -> list[tuple]:
        """Hybrid RRF retrieval. Returns (Document, confidence_percent) pairs."""
        dense_results = self._dense_retrieve(query, k=k * 3)
        sparse_results = self._sparse_retrieve(query, k=k * 3) if self._bm25 else []

        # Build confidence map from dense cosine distances BEFORE fusion
        dense_conf = {}
        for doc, dist in dense_results:
            # Chroma with langchain-chroma returns cosine distance (0=identical)
            conf = round(max(0.0, min(1.0, 1 - dist / 2)) * 100, 1)
            # Use first 200 chars as key to handle whitespace differences
            dense_conf[doc.page_content[:200]] = conf

        fused = self._rrf(dense_results, sparse_results)

        final = []
        for doc, _ in fused[:k]:
            confidence = dense_conf.get(doc.page_content[:200], 50.0)
            final.append((doc, confidence))

        logger.info(f"Hybrid retrieval: {len(final)} results for: {query[:50]}...")
        return final

    def _dense_retrieve(self, query: str, k: int) -> list[tuple]:
        try:
            return self.vectorstore.similarity_search_with_score(query, k=k)
        except Exception as e:
            logger.error(f"Dense retrieval error: {e}")
            return []

    def _sparse_retrieve(self, query: str, k: int) -> list[tuple]:
        """BM25 retrieval — returns (pseudo-Document, bm25_score) pairs."""
        try:
            from langchain_core.documents import Document
            tokens = query.lower().split()
            scores = self._bm25.get_scores(tokens)
            top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
            results = []
            for idx in top_idx:
                if scores[idx] > 0:
                    d = self._bm25_docs[idx]
                    doc = Document(page_content=d["content"], metadata=d["metadata"])
                    results.append((doc, scores[idx]))
            return results
        except Exception as e:
            logger.error(f"BM25 retrieval error: {e}")
            return []

    def _rrf(self, dense: list[tuple], sparse: list[tuple], k: int = 60) -> list[tuple]:
        """Reciprocal Rank Fusion.
        Score = Σ 1/(k + rank_i) across all lists.
        Higher is better.
        """
        scores: dict[str, float] = {}
        docs: dict[str, object] = {}

        for rank, (doc, _) in enumerate(dense):
            key = doc.page_content
            scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)
            docs[key] = doc

        for rank, (doc, _) in enumerate(sparse):
            key = doc.page_content
            scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)
            docs[key] = doc

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [(docs[key], score) for key, score in ranked]

    def get_collection_info(self) -> dict:
        try:
            count = self.vectorstore._collection.count()
            return {
                "collection_name": self.collection_name,
                "document_count": count,
                "persist_dir": self.persist_dir,
                "bm25_docs": len(self._bm25_docs),
            }
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            raise
        
# """Document retrieval from vector database"""

# from langchain_chroma import Chroma
# from src.config import (
#     LLM_PROVIDER,
#     OPENAI_API_KEY,
#     GEMINI_API_KEY,
#     CHROMA_PERSIST_DIR,
# )
# from loguru import logger


# def _build_embeddings():
#     """Return the correct embedding model based on LLM_PROVIDER."""
#     if LLM_PROVIDER == "openai":
#         from langchain_openai import OpenAIEmbeddings
#         return OpenAIEmbeddings(
#             api_key=OPENAI_API_KEY,
#             model="text-embedding-3-small",
#         )
#     elif LLM_PROVIDER == "gemini":
#         from langchain_google_genai import GoogleGenerativeAIEmbeddings
#         return GoogleGenerativeAIEmbeddings(
#             model="models/gemini-embedding-001",
#             google_api_key=GEMINI_API_KEY,
#         )
#     else:
#         raise ValueError(f"Unsupported LLM_PROVIDER for embeddings: {LLM_PROVIDER}")


# class VectorRetriever:
#     """Manages the Chroma vector store and similarity-based retrieval."""

#     def __init__(
#         self,
#         collection_name: str = "documents",
#         persist_dir: str = CHROMA_PERSIST_DIR,
#     ):
#         self.collection_name = collection_name
#         self.persist_dir = persist_dir
#         self.embeddings = _build_embeddings()
#         logger.info(f"Initialized embeddings for provider: {LLM_PROVIDER}")

#         self.vectorstore = Chroma(
#             collection_name=collection_name,
#             embedding_function=self.embeddings,
#             persist_directory=persist_dir,
#         )
#         logger.info(f"Initialized VectorRetriever (collection={collection_name})")

#     def add_documents(self, documents: list) -> None:
#         """Embed and store documents."""
#         try:
#             ids = self.vectorstore.add_documents(documents)
#             logger.info(f"Added {len(ids)} chunks to vector store")
#         except Exception as e:
#             logger.error(f"Error adding documents: {e}")
#             raise

#     def retrieve(self, query: str, k: int = 4) -> list:
#         """Return the k most similar documents for a query."""
#         try:
#             results = self.vectorstore.similarity_search(query, k=k)
#             logger.info(f"Retrieved {len(results)} docs for: {query[:50]}...")
#             return results
#         except Exception as e:
#             logger.error(f"Error retrieving documents: {e}")
#             raise

#     def retrieve_with_scores(self, query: str, k: int = 4) -> list[tuple]:
#         """Return (Document, distance) pairs."""
#         try:
#             results = self.vectorstore.similarity_search_with_score(query, k=k)
#             logger.info(f"Retrieved {len(results)} docs with scores")
#             return results
#         except Exception as e:
#             logger.error(f"Error retrieving documents with scores: {e}")
#             raise

#     def delete_by_source(self, source_path: str) -> None:
#         """Delete all chunks whose metadata['source'] matches the given path.

#         NEW: used by Feature — document deletion. Chroma's langchain wrapper
#         doesn't support metadata-filtered delete directly, so we fetch
#         matching IDs first, then delete by ID.
#         """
#         try:
#             existing = self.vectorstore.get(where={"source": source_path})
#             ids = existing.get("ids", [])
#             if ids:
#                 self.vectorstore.delete(ids=ids)
#                 logger.info(f"Deleted {len(ids)} chunks for source: {source_path}")
#             else:
#                 logger.warning(f"No chunks found for source: {source_path}")
#         except Exception as e:
#             logger.error(f"Error deleting chunks for {source_path}: {e}")
#             raise

#     def get_collection_info(self) -> dict:
#         """Return basic stats about the current Chroma collection."""
#         try:
#             count = self.vectorstore._collection.count()
#             return {
#                 "collection_name": self.collection_name,
#                 "document_count": count,
#                 "persist_dir": self.persist_dir,
#             }
#         except Exception as e:
#             logger.error(f"Error getting collection info: {e}")
#             raise
