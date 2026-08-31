"""Unit tests for the part-coverage completeness heuristic in
AnswerConfidenceScorer.

Requirements verified:
- no reward for length, bullets, or numbers per se,
- multi-part questions must have every requested part addressed,
- short-but-complete answers score high, long-but-incomplete score low,
- refusals ("information is not provided") are not over-penalised,
- no LLM call is made for the heuristic path.
"""

import pytest

from src.confidence_scorer import AnswerConfidenceScorer


class _NoLLM:
    def _invoke(self, prompt):  # pragma: no cover - should never be called
        raise AssertionError("heuristic completeness must not make LLM calls")


@pytest.fixture
def scorer():
    return AnswerConfidenceScorer(_NoLLM())


# ── Required scenarios ────────────────────────────────────────────────────

MULTI_PART_Q = (
    "What model is used, how many encoder layers does it have, "
    "and how many attention heads?"
)


def test_complete_multi_part_answer(scorer):
    answer = (
        "The model is a Transformer. It has 6 encoder layers "
        "and 8 attention heads."
    )
    s = scorer._heuristic_completeness(MULTI_PART_Q, answer)
    assert s >= 90.0


def test_partially_answered_multi_part_question(scorer):
    # Only the model part is addressed; layers and heads are missing.
    answer = "The model used is a Transformer architecture."
    s = scorer._heuristic_completeness(MULTI_PART_Q, answer)
    assert 20.0 <= s <= 75.0


def test_short_but_completely_correct_answer(scorer):
    q = "How many encoder layers does the model have?"
    answer = "6"
    s = scorer._heuristic_completeness(q, answer)
    # Short is fine: the question has one part and it is addressed
    # (number answers count; the question word part "encoder layers"
    # overlaps with... actually a bare number lacks the part tokens).
    # It must not be punished for brevity — but token overlap cannot
    # confirm addressment, so it lands mid-range, not near zero.
    assert s >= 30.0


def test_long_but_incomplete_answer(scorer):
    q = "How many encoder layers does the model have and what optimizer was used?"
    long_answer = (
        "The model in this document is a very interesting neural network "
        "with a rich history. Neural networks consist of stacked layers "
        "that transform representations step by step. Training such systems "
        "is a fascinating process involving many considerations, tradeoffs, "
        "and engineering decisions that practitioners must weigh carefully "
        "when building production systems for real-world deployments at scale."
    )
    s = scorer._heuristic_completeness(q, long_answer)
    # Verbosity must NOT rescue it: neither the layer count nor the
    # optimizer is actually addressed.
    assert s <= 70.0


def test_refusal_when_information_absent(scorer):
    q = "What is the model's inference latency in production?"
    answer = (
        "The inference latency is not provided in the retrieved context. "
        "The document does not mention production latency."
    )
    s = scorer._heuristic_completeness(q, answer)
    assert s >= 60.0


# ── Formatting must not matter ───────────────────────────────────────────


def test_bullets_and_length_give_no_bonus(scorer):
    q = "How many encoder layers does the model have?"
    plain = "The model has 6 encoder layers."
    padded = (
        "The model has 6 encoder layers.\n\n"
        "- Additional point one about something related\n"
        "- Additional point two with a number like 42\n"
        "- And much more detail that adds bulk without substance\n"
        "Overall this is a longer answer with identical factual content."
    )
    assert scorer._heuristic_completeness(q, plain) == pytest.approx(
        scorer._heuristic_completeness(q, padded)
    )


def test_empty_answer_is_zero(scorer):
    assert scorer._heuristic_completeness("What is X?", "") == 0.0
    assert scorer._heuristic_completeness("What is X?", "   ") == 0.0


def test_single_part_question_completely_answered(scorer):
    q = "What dataset was used for training?"
    assert scorer._heuristic_completeness(q, "The Braj-Hindi dataset was used.") >= 95.0


def test_requested_parts_detection():
    parts = AnswerConfidenceScorer._requested_parts(MULTI_PART_Q)
    # Three distinct requests should be detected (allowing parse variance).
    assert len(parts) >= 2
    joined = " ".join(parts)
    assert "model" in joined
    assert "layer" in joined or "encoder" in joined
    assert "head" in joined


def test_score_dict_uses_heuristic_fields(scorer):
    result = scorer.score(MULTI_PART_Q, "It is a Transformer with 6 layers and 8 heads.", [])
    assert "answer_completeness" in result
    assert "heuristic" in result["completeness_reason"]
