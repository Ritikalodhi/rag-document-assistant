"""Cross-encoder re-ranker for second-pass scoring after hybrid retrieval.

Wraps a HuggingFace cross-encoder so it can be swapped via config.
Gracefully falls back to identity (no-op) when sentence-transformers is
not installed, so the rest of the pipeline continues to work.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

from src.config import RERANKER_MODEL, RERANKER_ENABLED, RERANKER_CANDIDATES


# ── Exceptions ────────────────────────────────────────────────────────────────


class RerankerNotAvailableError(RuntimeError):
    """Raised when the reranker is explicitly requested but dependencies are
    missing.  The pipeline should catch this and continue without re-ranking."""


# ── Result type ───────────────────────────────────────────────────────────────


@dataclass
class RerankerResult:
    """Wraps a single re-ranked document."""

    document: Any          # LangChain Document
    original_score: float  # score from the first-stage retriever (0-100)
    rerank_score: float    # cross-encoder score (0-1)
    combined_score: float  # weighted combination used for final ordering

    @property
    def confidence_percent(self) -> float:
        return round(self.combined_score * 100, 1)


# ── Main class ────────────────────────────────────────────────────────────────


class CrossEncoderReranker:
    """Cross-encoder re-ranker.

    Usage::

        reranker = CrossEncoderReranker()
        results = reranker.rerank(query, candidates)   # list of RerankerResult

    When *sentence-transformers* is not installed, ``rerank()`` becomes a
    pass-through that returns the candidates in their original order with
    ``rerank_score`` copied from the normalised ``original_score``.
    """

    def __init__(self, model_name: str = RERANKER_MODEL) -> None:
        self.model_name = model_name
        self._model = None  # lazy-loaded
        self._available = False
        self._try_load()

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def available(self) -> bool:
        """``True`` if the cross-encoder model is loaded and usable."""
        return self._available

    def rerank(
        self,
        query: str,
        candidates: list[tuple[Any, float]],
        top_k: int | None = None,
    ) -> list[RerankerResult]:
        """Re-rank candidates by cross-encoder query-document relevance.

        Args:
            query: User query text.
            candidates: List of ``(Document, score)`` from the first-stage
                        retriever (score is 0-100 confidence percent).
            top_k: Number of results to return.  ``None`` means all.

        Returns:
            List of ``RerankerResult`` sorted by descending relevance.
        """
        if not candidates:
            return []

        docs = [doc for doc, _ in candidates]
        original_scores = [score for _, score in candidates]

        if self._available:
            rerank_scores = self._score_batch(query, docs)
        else:
            # Fallback: normalise original scores to 0-1 range
            max_os = max(original_scores) if original_scores else 1.0
            rerank_scores = [s / max_os for s in original_scores]

        # Build results
        results = [
            RerankerResult(
                document=doc,
                original_score=orig,
                rerank_score=rerank,
                combined_score=self._combine(orig, rerank),
            )
            for doc, orig, rerank in zip(docs, original_scores, rerank_scores)
        ]

        # Sort by combined score descending
        results.sort(key=lambda r: r.combined_score, reverse=True)

        if top_k is not None:
            results = results[:top_k]

        return results

    # ── Internals ─────────────────────────────────────────────────────────────

    def _try_load(self) -> None:
        """Lazy-load the cross-encoder model."""
        if not RERANKER_ENABLED:
            logger.info("Cross-encoder reranker disabled via config")
            self._available = False
            return

        try:
            from sentence_transformers import CrossEncoder  # type: ignore
            self._model = CrossEncoder(self.model_name, num_labels=1)
            self._available = True
            logger.info(
                f"Loaded cross-encoder reranker: {self.model_name}"
            )
        except ImportError:
            logger.warning(
                "sentence-transformers not installed – reranker disabled. "
                "Install: pip install sentence-transformers"
            )
            self._available = False
        except Exception as exc:
            logger.warning(f"Failed to load reranker model '{self.model_name}': {exc}")
            self._available = False

    def _score_batch(self, query: str, docs: list[Any]) -> list[float]:
        """Score all candidate (query, doc) pairs in one batch call.

        Returns a list of scores, one per candidate, in the same order.
        """
        pairs = [[query, doc.page_content] for doc in docs]
        raw_scores: list[float] = self._model.predict(pairs, show_progress_bar=False).tolist()  # type: ignore[union-attr]

        # raw_scores are logits; sigmoid to get 0-1 relevance
        scores = [1.0 / (1.0 + math.exp(-s)) for s in raw_scores]
        return scores

    @staticmethod
    def _combine(retrieval_score: float, rerank_score: float) -> float:
        """Weighted combination: favour the reranker but keep retrieval signal.

        Formula: 0.3 * (retrieval / 100) + 0.7 * rerank_score

        This biases toward the cross-encoder while preventing a candidate with
        a near-zero retrieval score from jumping to the top purely on noise.
        """
        return 0.3 * (retrieval_score / 100.0) + 0.7 * rerank_score
