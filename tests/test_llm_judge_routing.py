"""
Tests for Approach A: LLM completeness judge auto-routing and safe
heuristic fallback on LLM failure.

Save this as tests/test_llm_judge_routing.py (a NEW file — does not modify
any existing test file).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.confidence_scorer import AnswerConfidenceScorer


class _StubLLMManager:
    """Minimal stand-in for the real LLM manager, used to control
    _invoke()'s behavior per test without touching real LLM calls."""

    def __init__(self, response=None, raise_exc=None):
        self._response = response
        self._raise_exc = raise_exc
        self.invoke_called = False
        self.last_prompt = None

    def _invoke(self, prompt: str) -> str:
        self.invoke_called = True
        self.last_prompt = prompt
        if self._raise_exc is not None:
            raise self._raise_exc
        return self._response


def _make_context(text: str) -> list[dict]:
    return [{"content": text}]


# ── Routing: simple vs complex questions ────────────────────────────────

def test_simple_question_uses_heuristic_not_llm():
    """A short, single-fact question should NEVER call the LLM judge."""
    stub = _StubLLMManager(response='{"score": 99, "reason": "should not be used"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="What is the filename of this document?",
        answer="The filename is report.pdf.",
        context_list=_make_context("The document is named report.pdf."),
    )

    assert stub.invoke_called is False, "LLM judge should not be called for a simple question"
    assert result["completeness_reason"] == "heuristic (requested-part coverage)"


def test_specific_attribute_question_routes_to_llm_judge():
    """Multi-token attribute/value requests need semantic directness checks."""
    stub = _StubLLMManager(response='{"score": 40, "reason": "value missing"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="What learning rate was used?",
        answer="The model used an inverse square root learning-rate schedule.",
        context_list=_make_context("The model used an inverse square root schedule."),
    )

    assert stub.invoke_called is True
    assert result["answer_completeness"] == 40.0


def test_broad_question_triggers_llm_judge():
    """A broad/explain-style question should route to the LLM judge."""
    stub = _StubLLMManager(response='{"score": 88, "reason": "well covered"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="Explain the main concept discussed in the document and describe its important components.",
        answer="The document describes a translation system with several components working together.",
        context_list=_make_context("The system has multiple components including a translation model."),
    )

    assert stub.invoke_called is True, "LLM judge should be called for a broad question"
    assert result["answer_completeness"] == 88.0
    assert result["completeness_reason"] == "well covered"


def test_multipart_question_triggers_llm_judge():
    """A question requesting multiple distinct facts should route to the LLM judge,
    even without an explicit 'broad' keyword like 'explain'."""
    stub = _StubLLMManager(response='{"score": 75, "reason": "two of three parts covered"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="What model is used, how many encoder layers does it have, and how many attention heads?",
        answer="The model is a Transformer with 6 encoder layers.",
        context_list=_make_context("The Transformer has 6 encoder layers and 8 attention heads."),
    )

    assert stub.invoke_called is True
    assert result["answer_completeness"] == 75.0


# ── LLM judge success path ───────────────────────────────────────────────

def test_llm_judge_success_uses_returned_score():
    """When the LLM judge succeeds with valid JSON, its score must be used verbatim."""
    stub = _StubLLMManager(response='{"score": 42.5, "reason": "missing key detail"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="Explain the training process and describe the optimizer and learning rate schedule.",
        answer="The model uses the Adam optimizer.",
        context_list=_make_context("Training uses Adam optimizer with an inverse square root schedule."),
    )

    assert result["answer_completeness"] == 42.5
    assert result["completeness_reason"] == "missing key detail"


# ── Fallback: LLM failure must NEVER produce the old hardcoded 70.0 ──────

def test_llm_judge_timeout_falls_back_to_heuristic_not_hardcoded_70():
    """On an exception (e.g. timeout), completeness must equal the
    deterministic heuristic score for the SAME question/answer -- never
    the old hardcoded 70.0 optimistic default."""
    stub = _StubLLMManager(raise_exc=TimeoutError("LLM request timed out"))
    scorer = AnswerConfidenceScorer(stub)

    question = "Explain the main concept and describe its components and how they work together."
    answer = "The system translates Braj to Hindi using a Transformer model."

    result = scorer.score(
        question=question,
        answer=answer,
        context_list=_make_context("The system uses a Transformer to translate Braj to Hindi."),
    )

    expected_heuristic = AnswerConfidenceScorer._heuristic_completeness(question, answer)

    assert stub.invoke_called is True, "LLM judge should have been attempted"
    assert result["answer_completeness"] == round(expected_heuristic, 1)
    assert result["answer_completeness"] != 70.0
    assert "heuristic_fallback" in result["completeness_reason"]


def test_malformed_llm_json_falls_back_to_heuristic():
    """Non-JSON or garbled LLM output must fall back to the heuristic,
    not to a hardcoded 70.0."""
    stub = _StubLLMManager(response="I think the answer is pretty good, score 85 maybe?")
    scorer = AnswerConfidenceScorer(stub)

    question = "Explain the main concept and describe its components and how they work together."
    answer = "The system translates Braj to Hindi using a Transformer model."

    result = scorer.score(
        question=question,
        answer=answer,
        context_list=_make_context("The system uses a Transformer to translate Braj to Hindi."),
    )

    expected_heuristic = AnswerConfidenceScorer._heuristic_completeness(question, answer)

    assert result["answer_completeness"] == round(expected_heuristic, 1)
    assert "heuristic_fallback" in result["completeness_reason"]


def test_llm_json_missing_score_field_falls_back_to_heuristic():
    """Valid JSON that omits the 'score' key must fall back to the
    heuristic -- must NOT silently default to 70.0."""
    stub = _StubLLMManager(response='{"reason": "looks fine but no score given"}')
    scorer = AnswerConfidenceScorer(stub)

    question = "Explain the main concept and describe its components and how they work together."
    answer = "The system translates Braj to Hindi using a Transformer model."

    result = scorer.score(
        question=question,
        answer=answer,
        context_list=_make_context("The system uses a Transformer to translate Braj to Hindi."),
    )

    expected_heuristic = AnswerConfidenceScorer._heuristic_completeness(question, answer)

    assert result["answer_completeness"] == round(expected_heuristic, 1)
    assert "heuristic_fallback" in result["completeness_reason"]


def test_llm_score_out_of_range_falls_back_to_heuristic():
    """An LLM score outside 0-100 (e.g. a hallucinated/garbled value) must
    be rejected and fall back to the heuristic rather than being used
    verbatim."""
    stub = _StubLLMManager(response='{"score": 150, "reason": "overconfident"}')
    scorer = AnswerConfidenceScorer(stub)

    question = "Explain the main concept and describe its components and how they work together."
    answer = "The system translates Braj to Hindi using a Transformer model."

    result = scorer.score(
        question=question,
        answer=answer,
        context_list=_make_context("The system uses a Transformer to translate Braj to Hindi."),
    )

    expected_heuristic = AnswerConfidenceScorer._heuristic_completeness(question, answer)

    assert result["answer_completeness"] == round(expected_heuristic, 1)
    assert "heuristic_fallback" in result["completeness_reason"]


# ── Explicit override still works (backward-compat safety valve) ────────

def test_explicit_run_llm_judge_false_skips_llm_even_for_broad_question():
    """Explicitly passing run_llm_judge=False must still be respected,
    even for an otherwise-complex question."""
    stub = _StubLLMManager(response='{"score": 99, "reason": "should not be used"}')
    scorer = AnswerConfidenceScorer(stub)

    result = scorer.score(
        question="Explain the main concept and describe its components and how they work together.",
        answer="The system translates Braj to Hindi.",
        context_list=_make_context("The system translates Braj to Hindi."),
        run_llm_judge=False,
    )

    assert stub.invoke_called is False
    assert result["completeness_reason"] == "heuristic (requested-part coverage)"