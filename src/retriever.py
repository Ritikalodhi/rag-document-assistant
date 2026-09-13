"""Hybrid retrieval: dense (Chroma) + sparse (BM25) with Reciprocal Rank Fusion.

Multi-tenant: every chunk's metadata includes ``user_id`` and every query
filters by it.
"""

import json
import pickle
from pathlib import Path

from langchain_chroma import Chroma
from rank_bm25 import BM25Okapi
from src import config
from src.config import (
    LLM_PROVIDER,
    CHROMA_PERSIST_DIR, RERANKER_CANDIDATES,
)
from src.embeddings import EmbeddingManager
from src.reranker import CrossEncoderReranker
from loguru import logger


class VectorRetriever:
    """Dense + sparse hybrid retrieval with RRF fusion."""

    def __init__(self, collection_name: str = "documents", persist_dir: str = CHROMA_PERSIST_DIR):
        self.collection_name = collection_name
        self.persist_dir = persist_dir
        self._bm25_path = Path(config.DATA_DIR) / "bm25_index.pkl"
        self.embeddings = EmbeddingManager()
        self.last_retrieval_mode = "hybrid"
        logger.info(f"Initialized embeddings for provider: {LLM_PROVIDER}")

        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=persist_dir,
        )

        self._bm25: BM25Okapi | None = None
        self._bm25_docs: list[dict] = []
        self._load_bm25()

        self._reranker = CrossEncoderReranker()
        logger.info(
            f"Initialized VectorRetriever (collection={collection_name}, "
            f"reranker={'available' if self._reranker.available else 'unavailable'})"
        )

    # ── BM25 persistence ──────────────────────────────────────────────────────

    def _load_bm25(self) -> None:
        if self._bm25_path.exists():
            try:
                with open(self._bm25_path, "rb") as f:
                    data = pickle.load(f)
                self._bm25 = data["bm25"]
                self._bm25_docs = data["docs"]
                logger.info(f"Loaded BM25 index ({len(self._bm25_docs)} docs)")
            except Exception as e:
                logger.warning(f"Could not load BM25 index: {e}")

    def _save_bm25(self) -> None:
        with open(self._bm25_path, "wb") as f:
            pickle.dump({"bm25": self._bm25, "docs": self._bm25_docs}, f)

    def _rebuild_bm25(self) -> None:
        if not self._bm25_docs:
            self._bm25 = None
            return
        corpus = [d["tokens"] for d in self._bm25_docs]
        self._bm25 = BM25Okapi(corpus)

    # ── Indexing ──────────────────────────────────────────────────────────────

    def add_documents(self, documents: list) -> None:
        """Embed and store in Chroma; also add to BM25 index.

        Adds ``user_id`` to each chunk's metadata before indexing.

        On failure, rolls back any partial changes (Chroma entries and
        BM25 updates) so the system remains consistent.
        """
        bm25_snapshot = {
            "bm25": pickle.dumps(self._bm25) if self._bm25 else None,
            "bm25_docs": list(self._bm25_docs),
        }
        chroma_ids: list[str] | None = None
        try:
            chroma_ids = self.vectorstore.add_documents(documents)
            logger.info(f"Added {len(chroma_ids)} chunks to Chroma")

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
            logger.error(f"Error adding documents, rolling back: {e}")
            if chroma_ids:
                try:
                    self.vectorstore.delete(ids=chroma_ids)
                    logger.info(f"Rolled back {len(chroma_ids)} Chroma entries")
                except Exception as rollback_err:
                    logger.error(f"Chroma rollback failed: {rollback_err}")
            self._bm25_docs = bm25_snapshot["bm25_docs"]
            if bm25_snapshot["bm25"] is not None:
                self._bm25 = pickle.loads(bm25_snapshot["bm25"])
            else:
                self._bm25 = None
            self._save_bm25()
            logger.info("Rolled back BM25 state")
            raise

    @staticmethod
    def _combine_filter(*conditions: dict | None) -> dict | None:
        """Combine multiple metadata conditions into a Chroma-compatible filter."""
        conditions = [c for c in conditions if c]
        if not conditions:
            return None
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}

    def delete_by_source(self, source_path: str, user_id: str | None = None) -> None:
        """Delete chunks from Chroma and BM25 matching the source path."""
        try:
            where_filter = self._combine_filter(
                {"source": source_path},
                {"user_id": user_id} if user_id is not None else None,
            )
            existing = self.vectorstore.get(where=where_filter)
            ids = existing.get("ids", [])
            if ids:
                self.vectorstore.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} chunks from Chroma for: {source_path}")

            before = len(self._bm25_docs)
            self._bm25_docs = [
                d for d in self._bm25_docs
                if not (
                    d["metadata"].get("source") == source_path
                    and (user_id is None or d["metadata"].get("user_id") == user_id)
                )
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

    def retrieve(self, query: str, k: int = 4, filter: dict | None = None) -> list:
        return [doc for doc, _ in self.retrieve_with_scores(query, k, filter=filter)]

    def retrieve_reranked(self, query: str, k: int = 4, filter: dict | None = None) -> list[tuple]:
        """Hybrid retrieval + optional cross-encoder re-ranking."""
        candidate_count = max(k, RERANKER_CANDIDATES)
        candidates = self.retrieve_with_scores(query, k=candidate_count, filter=filter)

        if not candidates:
            return []

        if not self._reranker.available:
            return candidates[:k]

        reranked = self._reranker.rerank(query, candidates, top_k=k)
        return [(r.document, r.confidence_percent) for r in reranked]

    def retrieve_tables(
        self,
        query: str,
        k: int = 3,
        filter: dict | None = None,
    ) -> list[tuple]:
        """Retrieve only atomic PDF table chunks."""
        table_filter = self._combine_filter(
            filter,
            {"content_type": "table"},
        )

        table_query = (
            f"{query}\n"
            "TABLE COLUMNS ROW "
            "Paper Title Ref Year Category Algorithm Dataset Results Drawbacks "
            "Metric Value Version Purpose "
            "Braj Input Reference Hindi Model Output BLEU Similarity "
            "Training Set Validation Set Test Set"
        )

        candidates = self.retrieve_with_scores(
            table_query,
            k=max(k, 8),
            filter=table_filter,
        )
        if not candidates:
            return []

        if not self._reranker.available:
            return candidates[:k]

        reranked = self._reranker.rerank(query, candidates, top_k=k)
        return [(r.document, r.confidence_percent) for r in reranked]

    def retrieve_with_scores(self, query: str, k: int = 4, filter: dict | None = None) -> list[tuple]:
        """Hybrid RRF retrieval. Returns (Document, confidence_percent) pairs."""
        dense_results = self._dense_retrieve(query, k=k * 3, filter=filter)
        sparse_results = self._sparse_retrieve(query, k=k * 3, filter=filter) if self._bm25 else []

        fused, mode = self._compose_results(dense_results, sparse_results, k=k)
        self.last_retrieval_mode = mode

        # Dense confidence from cosine distance
        dense_conf = {}
        for doc, dist in dense_results:
            conf = round(max(0.0, min(1.0, 1 - dist / 2)) * 100, 1)
            dense_conf[doc.page_content[:200]] = conf

        # BM25 confidence normalized to 0-100 against the max score in this
        # result set — replaces the old flat 50.0/60.0 constants.
        bm25_conf = {}
        if sparse_results:
            max_bm25_score = max(score for _, score in sparse_results) or 1.0
            for doc, score in sparse_results:
                conf = round(min(1.0, max(0.0, score / max_bm25_score)) * 100, 1)
                bm25_conf[doc.page_content[:200]] = conf

        final = []
        for doc, _ in fused:
            key = doc.page_content[:200]
            if key in dense_conf:
                confidence = dense_conf[key]
            elif key in bm25_conf:
                confidence = bm25_conf[key]
            else:
                confidence = 60.0 if mode == "bm25_fallback" else 50.0
            final.append((doc, confidence))

        logger.info(f"{mode.title()} retrieval: {len(final)} results for: {query[:50]}...")
        return final

    @staticmethod
    def _compose_results(dense_results: list[tuple], sparse_results: list[tuple], k: int = 4) -> tuple[list[tuple], str]:
        """Combine dense and sparse results with a clear fallback mode."""
        if not dense_results and sparse_results:
            return sparse_results, "bm25_fallback"
        if dense_results and not sparse_results:
            return dense_results, "dense_only"
        if not dense_results and not sparse_results:
            return [], "empty"
        return VectorRetriever._rrf(dense_results, sparse_results), "hybrid"

    @staticmethod
    def _rrf(dense: list[tuple], sparse: list[tuple], k: int = 60) -> list[tuple]:
        """Reciprocal Rank Fusion."""
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

    def _dense_retrieve(self, query: str, k: int, filter: dict | None = None) -> list[tuple]:
        try:
            kwargs = {"query": query, "k": k}
            if filter is not None:
                kwargs["filter"] = filter
            return self.vectorstore.similarity_search_with_score(**kwargs)
        except Exception as e:
            logger.error(f"Dense retrieval error: {e}")
            return []

    def _sparse_retrieve(self, query: str, k: int, filter: dict | None = None) -> list[tuple]:
        """BM25 retrieval — returns (pseudo-Document, bm25_score) pairs."""
        try:
            from langchain_core.documents import Document

            if filter is not None:
                docs_pool = self._filter_bm25_docs(self._bm25_docs, filter)
                if not docs_pool:
                    return []
                bm25 = BM25Okapi([d["tokens"] for d in docs_pool])
            else:
                if self._bm25 is None:
                    return []
                docs_pool = self._bm25_docs
                bm25 = self._bm25

            tokens = query.lower().split()
            scores = bm25.get_scores(tokens)
            top_idx = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
            results = []
            for idx in top_idx:
                if scores[idx] > 0:
                    d = docs_pool[idx]
                    doc = Document(page_content=d["content"], metadata=d["metadata"])
                    results.append((doc, scores[idx]))
            return results
        except Exception as e:
            logger.error(f"BM25 retrieval error: {e}")
            return []

    @staticmethod
    def _filter_bm25_docs(docs: list[dict], filter: dict) -> list[dict]:
        """Apply a simple metadata filter to a list of BM25 doc dicts."""
        def check_condition(meta: dict, condition: dict) -> bool:
            if "$and" in condition:
                return all(check_condition(meta, c) for c in condition["$and"])

            for key, val_cond in condition.items():
                meta_val = meta.get(key)
                if isinstance(val_cond, dict) and "$in" in val_cond:
                    if meta_val not in val_cond["$in"]:
                        return False
                elif isinstance(val_cond, list):
                    if meta_val not in val_cond:
                        return False
                else:
                    if meta_val != val_cond:
                        return False
            return True

        result = []
        for d in docs:
            if check_condition(d.get("metadata", {}), filter):
                result.append(d)
        return result

    def get_user_chunk_counts(self, user_id: str) -> dict:
        """Count indexed chunks belonging to one user (Chroma + BM25)."""
        chroma_count = 0
        try:
            result = self.vectorstore.get(where={"user_id": user_id}, include=[])
            chroma_count = len(result.get("ids", []))
        except Exception as e:
            logger.error(f"Error counting user chunks in Chroma: {e}")

        bm25_count = sum(
            1 for d in self._bm25_docs
            if d.get("metadata", {}).get("user_id") == user_id
        )
        return {"chroma_chunks": chroma_count, "bm25_chunks": bm25_count}

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
        