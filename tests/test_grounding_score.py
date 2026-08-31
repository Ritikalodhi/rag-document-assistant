"""Unit tests for the evidence-grounding metric in AnswerConfidenceScorer.

The grounding score must:
- reward answers whose factual content is supported by the context,
  even when paraphrased,
- penalise unsupported numbers heavily,
- not penalise "information is not provided" answers,
- return 0.0 for empty context,
- use no LLM calls and no external knowledge.
"""

import pytest

from src.confidence_scorer import AnswerConfidenceScorer


class _NoLLM:
    def _invoke(self, prompt):  # pragma: no cover - should never be called
        raise AssertionError("grounding must not make LLM calls")


@pytest.fixture
def scorer():
    return AnswerConfidenceScorer(_NoLLM())


def _ctx(*texts):
    return [{"content": t, "retrieval_relevance": 80.0} for t in texts]


CONTEXT = (
    "The model uses a Transformer encoder with 6 layers and 8 attention heads. "
    "Training used the Braj-Hindi dataset with 50,000 sentence pairs. "
    "The final BLEU score was 28.4 and METEOR was 45.2 on the test set. "
    "The system was deployed in 2023 using version 2.1 of the serving stack."
)


# ── Required scenarios ────────────────────────────────────────────────────


def test_exact_answer_from_context(scorer):
    answer = "The encoder has 6 layers and 8 attention heads. The BLEU score was 28.4."
    g = scorer._grounding_score(answer, _ctx(CONTEXT))
    assert g >= 80.0


def test_paraphrased_answer_gets_good_grounding(scorer):
    # No copied phrase; same facts in different wording.
    answer = (
        "An encoder built from a Transformer architecture with six stacked layers "
        "and eight heads of attention was used."
    )
    g = scorer._grounding_score(answer, _ctx(CONTEXT))
    assert g >= 40.0


def test_unsupported_number_penalised(scorer):
    answer = "The model uses 6 layers and 8 attention heads with a BLEU score of 61.7."
    g = scorer._grounding_score(answer, _ctx(CONTEXT))
    g_supported = scorer._grounding_score(
        "The model uses 6 layers and 8 attention heads.", _ctx(CONTEXT)
    )
    assert g < g_supported - 15.0


def test_hallucinated_fact_penalised(scorer):
    answer = (
        "The model was trained with reinforcement learning from human feedback "
        "on the Zyzzyx corpus using 128 GPUs."
    )
    g = scorer._grounding_score(answer, _ctx(CONTEXT))
    assert g < 35.0


def test_not_provided_answer_not_penalised(scorer):
    answer = "The number of attention heads is not provided in the retrieved context."
    g = scorer._grounding_score(answer, _ctx(CONTEXT))
    assert g >= 70.0


def test_empty_context_returns_zero(scorer):
    assert scorer._grounding_score("Any answer at all.", []) == 0.0
    assert scorer._grounding_score("", _ctx(CONTEXT)) == 0.0


# ── Numeric strictness details ───────────────────────────────────────────


def test_number_formats_are_normalised(scorer):
    # 1,024 in the answer vs 1024 in the context must match.
    ctx = _ctx("The vocabulary contains 1024 tokens and precision was 97.5%.")
    assert scorer._grounding_score("Vocabulary size is 1,024 tokens.", ctx) >= 70.0
    assert scorer._grounding_score("Precision reached 97.5%.", ctx) >= 70.0


def test_version_and_date_numbers_checked(scorer):
    ctx = _ctx("Deployed in 2023 using version 2.1 of the serving stack.")
    assert scorer._grounding_score("It was deployed in 2023.", ctx) >= 70.0
    bad = scorer._grounding_score("It was deployed in 2019 using version 3.0.", ctx)
    assert bad < 70.0


def test_percentage_numbers_strict(scorer):
    ctx = _ctx("Accuracy improved to 91.3% after fine-tuning.")
    good = scorer._grounding_score("Accuracy improved to 91.3%.", ctx)
    bad = scorer._grounding_score("Accuracy improved to 93.7%.", ctx)
    assert good > bad + 15.0


def test_result_contains_both_field_names(scorer):
    result = scorer.score("q", "The encoder has 6 layers.", _ctx(CONTEXT))
    assert result["grounding_score"] == result["source_coverage"]
    assert "answer_confidence" in result
    assert "composite_score" in result
