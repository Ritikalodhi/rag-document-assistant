"""Unit tests for CrossEncoderReranker scoring semantics.

Covers the refactor that:
- treats retrieval score and reranker score as separate signals,
- removes the max(orig, blended) floor so the cross-encoder can LOWER
  a poor retrieval match,
- preserves original retrieval scores when the cross-encoder is
  unavailable (no fake 100% from relative normalisation).
- combines the two signals using the true geometric mean
  (sqrt(orig_norm * rerank)), not a plain product.
"""

import pytest
from langchain_core.documents import Document

from src.reranker import CrossEncoderReranker, RerankerResult


@pytest.fixture
def reranker_unavailable(monkeypatch):
    """A reranker whose cross-encoder model never loads."""
    monkeypatch.setattr("src.reranker.RERANKER_ENABLED", False)
    r = CrossEncoderReranker()
    assert not r.available
    return r


def _cand(text: str, score: float):
    return (Document(page_content=text, metadata={}), score)


# ── _combine: the four signal combinations ────────────────────────────────


def test_combine_high_retrieval_high_reranker():
    out = CrossEncoderReranker._combine(90.0, 0.9)
    # Geometric mean of 0.9 and 0.9 -> 0.9; high agreement stays high.
    assert out == pytest.approx(0.9, abs=1e-6)


def test_combine_high_retrieval_low_reranker():
    out = CrossEncoderReranker._combine(90.0, 0.05)
    # The cross-encoder must be able to LOWER a poor match — no max() floor.
    # Geometric mean of 0.9 and 0.05 -> sqrt(0.045) ≈ 0.21213.
    assert out == pytest.approx(0.21213, abs=1e-4)
    assert out < 0.9  # still meaningfully lowered from the retrieval score alone


def test_combine_low_retrieval_high_reranker():
    out = CrossEncoderReranker._combine(10.0, 0.95)
    # Weak first-stage evidence caps the score even with a strong reranker.
    # Geometric mean of 0.1 and 0.95 -> sqrt(0.095) ≈ 0.30822.
    assert out == pytest.approx(0.30822, abs=1e-4)
    assert out < 0.5


def test_combine_low_retrieval_low_reranker():
    out = CrossEncoderReranker._combine(10.0, 0.05)
    # Geometric mean of 0.1 and 0.05 -> sqrt(0.005) ≈ 0.07071.
    assert out == pytest.approx(0.07071, abs=1e-4)
    assert out < 0.1


def test_combine_bounds():
    assert CrossEncoderReranker._combine(0.0, 1.0) == 0.0
    assert CrossEncoderReranker._combine(100.0, 1.0) == pytest.approx(1.0)
    # Never exceeds 1 or goes below 0
    for r in (0.0, 0.2, 0.5, 0.8, 1.0):
        for s in (0.0, 25.0, 50.0, 75.0, 100.0):
            v = CrossEncoderReranker._combine(s, r)
            assert 0.0 <= v <= 1.0


# ── RerankerResult preserves both signals separately ─────────────────────


def test_result_preserves_original_and_rerank_scores():
    res = RerankerResult(
        document=Document(page_content="x"),
        original_score=85.0,
        rerank_score=0.4,
        combined_score=CrossEncoderReranker._combine(85.0, 0.4),
    )
    assert res.first_stage_relevance == 85.0      # original retrieval score kept
    assert res.rerank_signal == pytest.approx(0.4, abs=1e-4)  # reranker signal kept
    # Combined score is for ranking only and is NOT artificially propped up
    assert res.combined_score <= 0.85


# ── rerank() behaviour ────────────────────────────────────────────────────


def test_rerank_unavailable_preserves_original_scores(reranker_unavailable):
    cands = [
        _cand("doc a", 72.0),
        _cand("doc b", 41.5),
        _cand("doc c", 8.0),
    ]
    results = reranker_unavailable.rerank("q", cands)
    # No fake 100%: each candidate keeps its absolute retrieval score.
    assert [r.first_stage_relevance for r in results] == [72.0, 41.5, 8.0]
    assert results[0].rerank_signal == pytest.approx(1.0)
    # Order unchanged (original ordering preserved).
    assert [r.document.page_content for r in results] == ["doc a", "doc b", "doc c"]


def test_rerank_unavailable_no_fake_100_percent(reranker_unavailable):
    # Even the best candidate must NOT be turned into 100%.
    results = reranker_unavailable.rerank("q", [_cand("only doc", 30.0)])
    assert results[0].first_stage_relevance == 30.0
    assert results[0].confidence_percent == pytest.approx(30.0)


def test_rerank_empty_candidates(reranker_unavailable):
    assert reranker_unavailable.rerank("q", []) == []


def test_rerank_cross_encoder_can_demote_top_candidate(monkeypatch):
    """With a model present, a strong cross-encoder veto must demote a
    high-retrieval candidate below a mid-retrieval, high-reranker one."""
    monkeypatch.setattr("src.reranker.RERANKER_ENABLED", True)
    r = CrossEncoderReranker()
    r._available = True
    # doc1: retrieval loves it, cross-encoder hates it.
    # doc2: retrieval is lukewarm, cross-encoder loves it.
    docs = [Document(page_content="doc1"), Document(page_content="doc2")]
    cands = [(docs[0], 95.0), (docs[1], 50.0)]
    fake_scores = iter([0.05, 0.95])
    monkeypatch.setattr(
        r, "_score_batch", lambda q, d: [next(fake_scores) for _ in d]
    )
    results = r.rerank("q", cands, top_k=2)
    assert results[0].document.page_content == "doc2"
    assert results[1].document.page_content == "doc1"


def test_rerank_top_k(reranker_unavailable):
    cands = [_cand(f"doc {i}", 10.0 * (i + 1)) for i in range(5)]
    results = reranker_unavailable.rerank("q", cands, top_k=3)
    assert len(results) == 3
    # With no cross-encoder, combined == original score, so best come first.
    assert [r.first_stage_relevance for r in results] == [50.0, 40.0, 30.0]