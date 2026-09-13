"""Shared test fixtures and configuration."""

import pytest
from pathlib import Path


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    """Redirect DATA_DIR to a unique temp directory for every test.

    All stores now access ``config.DATA_DIR`` at runtime (via ``from src
    import config``), so monkeypatching ``config.DATA_DIR`` is sufficient.
    """
    from src import config
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)

    # Also redirect the auth database
    from src.auth import database as auth_db
    test_db = tmp_path / "test_users.db"
    monkeypatch.setattr(auth_db, "DB_PATH", test_db)
    auth_db.init_user_db()

    return tmp_path


class _DeterministicEmbeddings:
    """Offline deterministic embeddings so tests can exercise real Chroma/BM25."""

    def embed_query(self, text: str) -> list[float]:
        v = [0.0] * 8
        for i, ch in enumerate(text.encode("utf-8")[:16]):
            v[i % 8] += (ch % 7) + 1.0
        return v

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(t) for t in texts]


@pytest.fixture
def real_retriever(monkeypatch, tmp_path):
    """A real VectorRetriever (real Chroma + BM25) with offline embeddings.

    The cross-encoder reranker is lazy-loaded, so constructing the retriever
    requires no network access; embeddings are deterministic and local.
    """
    from src.embeddings import EmbeddingManager
    import src.retriever as retriever_module

    monkeypatch.setattr(
        retriever_module,
        "EmbeddingManager",
        lambda: EmbeddingManager(underlying=_DeterministicEmbeddings()),
    )
    from src.retriever import VectorRetriever
    return VectorRetriever(persist_dir=str(tmp_path / "chroma"))