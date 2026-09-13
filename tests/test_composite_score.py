"""Unit tests for the composite quality score in AnswerConfidenceScorer.

The composite is a TRANSPARENT QUALITY SCORE (0-100), not a calibrated
probability of correctness. Weighted blend:
  retrieval_relevance * 0.35 + grounding * 0.40 + completeness * 0.25
with a multiplicative grounding gate (0.25 + 0.75 * grounding/100) so that
unsupported facts cannot be propped up by strong retrieval.

Scenarios covered:
- strong retrieval + grounded complete answer  -> high
- strong retrieval + hallucinated answer       -> low
- weak retrieval + plausible answer            -> moderate/low
- short correct answer                         -> high (no brevity penalty)
- incomplete answer                            -> reduced
- refusal (unsupported question)               -> moderate, not auto-high
"""

import pytest

from src.confidence_scorer import AnswerConfidenceScorer


class _NoLLM:
    def _invoke(self, prompt):  # pragma: no cover - should never be called
        raise AssertionError("must not make LLM calls")


@pytest.fixture
def scorer():
    return AnswerConfidenceScorer(_NoLLM())


def _ctx(*texts, relevance=85.0):
    return [{"content": t, "retrieval_relevance": relevance} for t in texts]


SUPPORTIVE_CONTEXT = (
    "The model uses a Transformer encoder with 6 layers and 8 attention heads. "
    "Training used the Braj-Hindi dataset with 50,000 sentence pairs. "
    "The final BLEU score was 28.4 on the test set."
)


def _score(scorer, question, answer, contexts):
    result = scorer.score(question, answer, contexts)
    return result


# ── Required scenarios ────────────────────────────────────────────────────


def test_strong_retrieval_grounded_complete_answer(scorer):
    q = "What model is used and how many encoder layers does it have?"
    answer = "The model is a Transformer with 6 encoder layers."
    result = _score(scorer, q, answer, _ctx(SUPPORTIVE_CONTEXT))
    assert result["composite_score"] >= 70.0
    assert result["grade"] in ("A", "B")


def test_strong_retrieval_hallucinated_answer_scores_low(scorer):
    q = "What model is used and how many encoder layers does it have?"
    hallucinated = (
        "The model is a BiLSTM with attention, trained with reinforcement "
        "learning on the Zyzzyx corpus using 128 GPUs for 900 epochs."
    )
    result = _score(scorer, q, hallucinated, _ctx(SUPPORTIVE_CONTEXT))
    assert result["composite_score"] <= 40.0
    assert result["grounding_score"] <= 40.0


def test_weak_retrieval_plausible_answer(scorer):
    q = "How many encoder layers does the model have?"
    answer = "The model has 6 encoder layers."
    result = _score(
        scorer, q, answer, _ctx(SUPPORTIVE_CONTEXT, relevance=25.0)
    )
    # Grounded and complete but retrieval was weak -> moderate, not high.
    assert result["composite_score"] <= 75.0
    assert result["retrieval_relevance"] == 25.0


def test_retrieval_relevance_averages_top_two_chunks(scorer):
    context = [
        {"content": "The answer is supported here.", "retrieval_relevance": 90.0},
        {"content": "Additional supporting evidence.", "retrieval_relevance": 85.0},
        {"content": "Unrelated filler context.", "retrieval_relevance": 20.0},
    ]

    result = _score(scorer, "What is the answer?", "The answer is supported here.", context)

    assert result["retrieval_relevance"] == 87.5


def test_short_correct_answer_scores_high(scorer):
    q = "How many encoder layers does the model have?"
    result = _score(scorer, q, "6", _ctx(SUPPORTIVE_CONTEXT))
    # Short is fine: grounding and completeness both hold.
    assert result["composite_score"] >= 65.0


def test_incomplete_answer_scores_lower_than_complete(scorer):
    q = (
        "What model is used, how many encoder layers does it have, "
        "and what BLEU score was achieved?"
    )
    complete = _score(
        scorer, q,
        "The model is a Transformer with 6 encoder layers; BLEU was 28.4.",
        _ctx(SUPPORTIVE_CONTEXT),
    )
    incomplete = _score(
        scorer, q,
        "The model is a Transformer with 6 encoder layers.",
        _ctx(SUPPORTIVE_CONTEXT),
    )
    assert incomplete["composite_score"] < complete["composite_score"]


def test_refusal_not_auto_high(scorer):
    q = "What is the model's production inference latency?"
    refusal = (
        "The inference latency is not provided in the retrieved context. "
        "The document does not mention latency."
    )
    result = _score(scorer, q, refusal, _ctx(SUPPORTIVE_CONTEXT))
    # The refusal is honest and grounded, but it does not ANSWER the
    # question, so it must not get a top score.
    assert result["composite_score"] < 85.0
    assert result["composite_score"] > 20.0  # not trash either


# ── Field compatibility ───────────────────────────────────────────────────


def test_all_required_fields_and_aliases(scorer):
    result = scorer.score("q", "answer text", _ctx(SUPPORTIVE_CONTEXT))
    for key in (
        "retrieval_relevance", "grounding_score", "answer_completeness",
        "composite_score", "grade", "answer_confidence",
        "retrieval_confidence", "source_coverage", "completeness_reason",
    ):
        assert key in result
    assert result["retrieval_confidence"] == result["retrieval_relevance"]
    assert result["source_coverage"] == result["grounding_score"]
    assert result["answer_confidence"] == result["composite_score"]


def test_composite_in_range_and_not_inflated(scorer):
    # Empty context: grounding and retrieval are 0; the grounding gate
    # suppresses the composite to a small fraction of completeness.
    result = scorer.score("q", "some answer", [])
    assert result["composite_score"] <= 25.0
    assert result["grounding_score"] == 0.0
    # Arbitrary inputs stay in 0-100.
    for ctx_rel in (0.0, 30.0, 60.0, 90.0):
        r = scorer.score(
            "What is X?", "X is 5 units.", _ctx("X is 5 units.", relevance=ctx_rel)
        )
        assert 0.0 <= r["composite_score"] <= 100.0


def test_strong_retrieval_cannot_rescue_unsupported_numbers(scorer):
    q = "What was the BLEU score?"
    wrong_number = "The BLEU score was 91.2 on the test set."
    result = _score(scorer, q, wrong_number, _ctx(SUPPORTIVE_CONTEXT))
    # Retrieval is strong (85) but the number is fabricated — the gate
    # must keep the composite low.
    assert result["composite_score"] <= 45.0
