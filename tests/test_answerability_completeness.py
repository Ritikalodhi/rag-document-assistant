"""Regression tests for requested-value answerability."""

from src.confidence_scorer import AnswerConfidenceScorer


class _NoLLM:
    def _invoke(self, prompt):  # pragma: no cover - explicitly disabled below
        raise AssertionError("LLM judge should be disabled for deterministic cases")


def _context():
    return [{
        "content": (
            "The optimizer was Adam. Training used an inverse square root "
            "learning-rate schedule with 4,000 warmup steps. The batch size "
            "was 32 and dropout was 0.1. The final BLEU score was 28.4."
        ),
        "retrieval_relevance": 90.0,
    }]


def _score(question, answer):
    return AnswerConfidenceScorer(_NoLLM()).score(
        question, answer, _context(), run_llm_judge=False
    )


def test_case_a_related_schedule_does_not_answer_learning_rate():
    result = _score(
        "What optimizer learning rate was used during Transformer training?",
        "The model used an inverse square root learning-rate schedule with 4,000 warmup steps.",
    )
    assert result["answer_completeness"] < 100.0
    assert result["composite_score"] < 85.0


def test_case_b_schedule_is_complete_and_grounded():
    result = _score(
        "What learning-rate schedule was used?",
        "An inverse square root learning-rate schedule with 4,000 warmup steps.",
    )
    assert result["answer_completeness"] >= 95.0
    assert result["grounding_score"] >= 80.0


def test_case_c_warmup_steps_are_complete_and_grounded():
    result = _score("What warmup steps were used?", "4,000 warmup steps.")
    assert result["answer_completeness"] >= 95.0
    assert result["grounding_score"] >= 80.0


def test_case_d_bleu_score_is_complete_and_grounded():
    result = _score("What BLEU score was reported?", "BLEU was 28.4.")
    assert result["answer_completeness"] >= 95.0
    assert result["grounding_score"] >= 80.0


def test_case_e_missing_one_hyperparameter_reduces_completeness():
    result = _score(
        "What optimizer, learning rate, batch size, dropout, and warmup steps were used?",
        "The optimizer was Adam, the batch size was 32, dropout was 0.1, and 4,000 warmup steps were used.",
    )
    assert result["answer_completeness"] < 100.0


def test_case_e_actual_generated_multi_attribute_answer_rejects_related_schedule():
    result = _score(
        "What optimizer, learning rate, batch size, dropout, and warmup steps were used?",
        "Optimizer: Adam with beta1=0.9 and beta2=0.98.\n"
        "Learning Rate: inverse square root learning rate schedule.\n"
        "Batch Size: 4,096 tokens.\n"
        "Dropout: 0.1.\n"
        "Warmup Steps: 4,000.",
    )
    assert result["answer_completeness"] < 100.0
    assert result["answer_completeness"] == 80.0


def test_case_e_auto_path_uses_per_attribute_coverage_for_generated_answer():
    result = AnswerConfidenceScorer(_NoLLM()).score(
        "What optimizer, learning rate, batch size, dropout, and warmup steps were used?",
        "Optimizer: Adam. Learning Rate: inverse square root learning rate schedule. "
        "Batch Size: 4,096 tokens. Dropout: 0.1. Warmup Steps: 4,000.",
        _context(),
    )
    assert result["answer_completeness"] == 80.0
    assert result["completeness_reason"] == "heuristic (requested-part coverage)"


def test_case_f_optimizer_is_complete():
    result = _score("What optimizer was used?", "Adam optimizer.")
    assert result["answer_completeness"] >= 95.0


def test_case_g_dropout_value_is_complete():
    result = _score("What dropout value was used?", "Dropout was 0.1.")
    assert result["answer_completeness"] >= 95.0
    assert result["grounding_score"] >= 80.0


def test_case_h_explicit_missing_value_gets_partial_completeness_and_grounding():
    result = _score(
        "What learning rate was used?",
        "The paper does not explicitly provide the exact learning-rate value. "
        "It only specifies an inverse square root learning-rate schedule with 4,000 warmup steps.",
    )
    assert result["answer_completeness"] < 100.0
    assert 50.0 <= result["answer_completeness"] < 90.0
    assert result["grounding_score"] >= 70.0
    assert result["composite_score"] < 70.0


# ── Specific Acceptance Tests ──────────────────────────────────────────────

def test_single_missing_exact_value_cannot_be_high_confidence():
    """1. Single missing exact value: confidence must not be High (< 70)."""
    result = _score(
        "What optimizer learning rate was used during Transformer training?",
        "The model used the Adam optimizer. The exact numeric learning-rate value is not explicitly provided. "
        "The paper specifies an inverse square root learning-rate schedule with 4,000 warmup steps.",
    )
    assert result["composite_score"] < 70.0
    assert result["grade"] in ("C", "D", "F")


def test_multi_attribute_with_one_missing_exact_value_cannot_be_high():
    """2. Multi-attribute answer with one missing exact value: scores answered
    attributes normally (80%), but composite confidence is capped below High (< 70)."""
    result = _score(
        "What optimizer, learning rate, batch size, dropout, and warmup steps were used?",
        "**Optimizer:** Adam optimizer\n\n"
        "**Learning Rate:** The exact numeric learning-rate value is not explicitly provided. "
        "The paper specifies an inverse square root learning-rate schedule with 4,000 warmup steps.\n\n"
        "**Batch Size:** 32\n\n"
        "**Dropout:** 0.1\n\n"
        "**Warmup Steps:** 4,000",
    )
    assert result["answer_completeness"] == 80.0
    assert result["composite_score"] < 70.0
    assert result["grade"] in ("C", "D")


def test_fully_answered_multi_attribute_question_scores_high():
    """3. Fully answered multi-attribute question: achieves High confidence (>= 70)."""
    result = _score(
        "What optimizer, batch size, dropout, and warmup steps were used?",
        "**Optimizer:** Adam optimizer\n\n"
        "**Batch Size:** 32\n\n"
        "**Dropout:** 0.1\n\n"
        "**Warmup Steps:** 4,000",
    )
    assert result["answer_completeness"] >= 95.0
    assert result["composite_score"] >= 70.0
    assert result["grade"] in ("A", "B")


def test_related_schedule_substituted_for_value_cannot_be_high():
    """4. Related schedule/formula incorrectly substituted for value: confidence < 70."""
    result = _score(
        "What learning rate was used during training?",
        "An inverse square root learning-rate schedule with 4,000 warmup steps was used.",
    )
    assert result["composite_score"] < 70.0


def test_explicit_absence_statement_cannot_be_high():
    """5. Explicit absence statement: honest refusal cannot score High (< 70)."""
    result = _score(
        "What is the model latency in production?",
        "The exact latency in production is not explicitly provided in the document.",
    )
    assert result["composite_score"] < 70.0


def test_minor_incompleteness_does_not_force_low_confidence():
    """6. Unrelated/minor incompleteness on broad questions does not force result below 70."""
    broad_context = [{
        "content": (
            "The system uses a Transformer architecture for machine translation. "
            "It consists of an encoder with 6 layers and a decoder with 6 layers. "
            "Self-attention allows the model to capture global dependencies."
        ),
        "retrieval_relevance": 95.0,
    }]
    # Broad conceptual question with good overall coverage
    result = AnswerConfidenceScorer(_NoLLM()).score(
        "Explain the main translation concept and describe how the encoder and decoder work.",
        "The model is a Transformer for machine translation with a 6-layer encoder and a 6-layer decoder using self-attention.",
        broad_context,
        run_llm_judge=False,
    )
    assert result["composite_score"] >= 70.0
    assert result["grade"] in ("A", "B")


def test_llm_manager_audit_and_normalize_answer_generic():
    """7. Deterministic auditing transforms schedule substitution to explicit absence."""
    from src.llm import LLMManager
    q1 = "What optimizer, learning rate, batch size, dropout, and warmup steps were used?"
    raw_a1 = (
        "**Optimizer:** Adam optimizer\n\n"
        "**Learning Rate:** Inverse square root learning rate schedule\n\n"
        "**Batch Size:** 4,096 tokens\n\n"
        "**Dropout:** 0.1\n\n"
        "**Warmup Steps:** 4,000"
    )
    ctx = "We trained with Adam optimizer. We used warmup_steps = 4000."
    norm1 = LLMManager.audit_and_normalize_answer(q1, raw_a1, ctx)
    assert "The exact numeric learning-rate value is not explicitly provided" in norm1
    assert "inverse square root learning-rate schedule" in norm1
    assert "**Optimizer:** Adam optimizer" in norm1

    q2 = "What optimizer learning rate was used during Transformer training?"
    raw_a2 = (
        "**Optimizer:** Adam optimizer\n\n"
        "**Learning Rate:** Inverse square root learning rate schedule"
    )
    norm2 = LLMManager.audit_and_normalize_answer(q2, raw_a2, ctx)
    assert "The exact numeric learning-rate value is not explicitly provided" in norm2

