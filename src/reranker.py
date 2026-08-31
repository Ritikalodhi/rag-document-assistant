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
    rerank_score: float    # sigmoid of cross-encoder logit (relative signal, NOT calibrated)
    combined_score: float  # combined relevance, used ONLY for ranking

    @property
    def first_stage_relevance(self) -> float:
        """Original first-stage retrieval relevance (0-100), preserved as-is."""
        return round(self.original_score, 1)

    @property
    def rerank_signal(self) -> float:
        """Raw cross-encoder sigmoid signal (0-1), preserved separately."""
        return round(self.rerank_score, 4)

    @property
    def retrieval_relevance(self) -> float:
        """How relevant this chunk is to the query (0-100) for display purposes.

        This is a RETRIEVAL RELEVANCE score, not factual answer confidence.
        It is the combined ranking score scaled to 0-100 — used for ordering,
        not as a calibrated probability.
        """
        return round(self.combined_score * 100, 1)

    @property
    def confidence_percent(self) -> float:
        """Backward-compatible alias for :attr:`retrieval_relevance`."""
        return self.retrieval_relevance


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
            # Cross-encoder unavailable: there is no second-stage signal at
            # all. Do NOT normalise relative candidate ranks into fake
            # absolute relevance — preserve the original retrieval scores
            # untouched so ordering and displayed relevance both reflect
            # the first-stage retriever only.
            rerank_scores = [1.0] * len(docs)

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
        """Combine first-stage retrieval relevance with cross-encoder relevance.

        The result is a RANKING score only — it is NOT a calibrated
        probability of correctness and must not be presented to users as
        "answer confidence".

        Design:
        - ``retrieval_score`` is the 0-100 relevance from the first-stage
          hybrid retriever (dense cosine-similarity based).
        - ``rerank_score`` is the sigmoid of the cross-encoder logit, i.e. a
          relative relevance signal in (0, 1). Sigmoids from MS-MARCO
          cross-encoders are NOT calibrated probabilities, so we only use
          this signal to re-order candidates, not to fabricate an absolute
          confidence figure.
        - The geometric mean is used instead of ``max(retrieval, blend)``:
          the cross-encoder must be able to LOWER a candidate that the
          first stage ranked highly but it judges irrelevant.
        """
        orig_norm = max(0.0, min(1.0, retrieval_score / 100.0))
        rerank = max(0.0, min(1.0, rerank_score))
        # Geometric mean punishes disagreement between the two signals in
        # both directions (either signal alone cannot prop the score up).
        return orig_norm * rerank

