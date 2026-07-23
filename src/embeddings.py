"""Embedding generation and management with persistent caching.

Provider-agnostic: works with any langchain-compatible embedding class.
"""

import hashlib
import json
from collections import OrderedDict
from pathlib import Path

from loguru import logger

from src import config
from src.config import LLM_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY

_MAX_CACHE_ENTRIES = 50_000


class EmbeddingManager:
    """Manages embeddings with persistent caching and provider abstraction.

    Wraps any langchain Embeddings object and adds SHA-256 content hashing
    with a JSON-backed cache on disk.

    Cache is capped at ``_MAX_CACHE_ENTRIES`` (default 50,000). When the
    limit is exceeded, the oldest entries are evicted first (insertion-order
    based LRU-ish eviction).

    Usage::

        mgr = EmbeddingManager()
        vector = mgr.embed_query("some text")
        vectors = mgr.embed_documents(["text1", "text2"])

    Cache stats are available via ``mgr.cache_stats``.
    """

    def __init__(self, underlying=None):
        """Initialize embedding manager.

        Args:
            underlying: A langchain ``Embeddings`` instance.  When ``None``
                        (default) one is built automatically based on the
                        configured ``LLM_PROVIDER``.
        """
        # Computed in __init__ (not at import/module-definition time) so
        # tests that patch config.DATA_DIR get an isolated cache file.
        self._cache_file = config.DATA_DIR / "embedding_cache.json"
        self._underlying = underlying or self._build_provider()
        self._cache: OrderedDict[str, list[float]] = OrderedDict(self._load_cache())
        self._cache_hits = 0
        self._cache_misses = 0
        logger.info(
            f"Initialized EmbeddingManager ({LLM_PROVIDER}) — "
            f"cache: {len(self._cache)} entries"
        )

    # ── Public API (compatible with langchain Embeddings) ──────────────────

    def embed_query(self, text: str) -> list[float]:
        """Generate embedding for a single string with cache lookup."""
        h = self._content_hash(text)
        cached = self._cache.get(h)
        if cached is not None:
            self._cache_hits += 1
            return cached
        self._cache_misses += 1
        try:
            embedding = self._underlying.embed_query(text)
            self._cache[h] = embedding
            self._enforce_cap()
            self._save_cache()
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts with cache lookup.

        Only texts not already in cache are sent to the provider.
        Uses O(1) index-based mapping for cache integration.
        """
        results: list[list[float]] = [None] * len(texts)  # pre-allocate
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, text in enumerate(texts):
            h = self._content_hash(text)
            cached = self._cache.get(h)
            if cached is not None:
                self._cache_hits += 1
                results[i] = cached
            else:
                self._cache_misses += 1
                uncached_texts.append(text)
                uncached_indices.append(i)

        if uncached_texts:
            try:
                new_embeddings = self._underlying.embed_documents(uncached_texts)
                for pos, (idx, text) in enumerate(zip(uncached_indices, uncached_texts)):
                    embedding = new_embeddings[pos]
                    h = self._content_hash(text)
                    self._cache[h] = embedding
                    results[idx] = embedding
                self._enforce_cap()
                self._save_cache()
            except Exception as e:
                logger.error(f"Error generating batch embeddings: {e}")
                raise

        return results

    def _enforce_cap(self) -> None:
        """Evict oldest entries if cache exceeds the max size."""
        while len(self._cache) > _MAX_CACHE_ENTRIES:
            self._cache.popitem(last=False)  # FIFO eviction

    # ── Cache management ──────────────────────────────────────────────────

    def clear_cache(self) -> None:
        """Clear the embedding cache."""
        self._cache.clear()
        self._save_cache()
        logger.info("Embedding cache cleared")

    @property
    def cache_stats(self) -> dict:
        """Return cache hit/miss statistics."""
        total = self._cache_hits + self._cache_misses
        return {
            "size": len(self._cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": round(self._cache_hits / total * 100, 1) if total > 0 else 0.0,
        }

    # ── Internals ─────────────────────────────────────────────────────────

    @staticmethod
    def _build_provider():
        """Build a langchain Embeddings instance for the configured provider."""
        if LLM_PROVIDER == "openai":
            from langchain_openai import OpenAIEmbeddings
            return OpenAIEmbeddings(
                api_key=OPENAI_API_KEY, model="text-embedding-3-small"
            )
        elif LLM_PROVIDER == "gemini":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            return GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001", google_api_key=GEMINI_API_KEY
            )
        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")

    @staticmethod
    def _content_hash(text: str) -> str:
        """Return a stable SHA-256 hash of the content."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _load_cache(self) -> dict[str, list[float]]:
        """Load persistent embedding cache from disk."""
        try:
            if self._cache_file.exists():
                with open(self._cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load embedding cache: {e}")
        return {}

    def _save_cache(self) -> None:
        """Persist cache to disk atomically."""
        tmp = self._cache_file.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False)
            tmp.replace(self._cache_file)
        except Exception as e:
            logger.warning(f"Failed to save embedding cache: {e}")