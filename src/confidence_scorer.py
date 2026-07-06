"""Answer Confidence Scorer.

Scores every query response on three dimensions:
1. retrieval_confidence  — how relevant were the retrieved chunks? (avg of scores)
2. answer_completeness   — did the answer address the question? (LLM-as-judge)
3. composite_score       — weighted average of both

Citation coverage is tracked but not LLM-verified (too slow per-query);
it's based on whether the answer references source content.
"""

import re
import json
from langchain_core.prompts import PromptTemplate
from loguru import logger

_COMPLETENESS_TEMPLATE = PromptTemplate(
    input_variables=["question", "answer"],
    template="""Rate how completely the following answer addresses the question.
Respond with ONLY a JSON object (no markdown):
{{"score": 0-100, "reason": "one sentence"}}

Question: {question}
Answer: {answer}

JSON:""",
)


class AnswerConfidenceScorer:
    """Computes a multi-dimensional confidence score for RAG answers."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def score(
        self,
        question: str,
        answer: str,
        context_list: list[dict],
        run_llm_judge: bool = False,
    ) -> dict:
        """Return a confidence score dict.

        Args:
            question: The user's question.
            answer: The generated answer.
            context_list: List of context dicts with confidence_percent.
            run_llm_judge: If True, call the LLM to score completeness.
                           Adds ~1s latency. Default False for speed.
        """
        # 1. Retrieval confidence — average of chunk scores
        scores = [c.get("confidence_percent", 0) for c in context_list]
        retrieval_confidence = round(sum(scores) / len(scores), 1) if scores else 0.0

        # 2. Answer completeness
        if run_llm_judge and answer and not answer.startswith("Error"):
            completeness, reason = self._llm_completeness(question, answer)
        else:
            # Heuristic fallback: longer, structured answers score higher
            words = len(answer.split())
            completeness = min(95.0, 40.0 + words * 0.5)
            reason = "heuristic (word count)"

        # 3. Source coverage — does the answer mention any source content?
        source_coverage = self._source_coverage(answer, context_list)

        # 4. Composite (weighted)
        composite = round(
            retrieval_confidence * 0.5 +
            completeness * 0.35 +
            source_coverage * 0.15,
            1,
        )

        return {
            "retrieval_confidence": retrieval_confidence,
            "answer_completeness": round(completeness, 1),
            "source_coverage": source_coverage,
            "composite_score": composite,
            "completeness_reason": reason,
            "grade": self._grade(composite),
        }

    def _llm_completeness(self, question: str, answer: str) -> tuple[float, str]:
        try:
            prompt = _COMPLETENESS_TEMPLATE.format(question=question, answer=answer)
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned)
            return float(data.get("score", 70)), data.get("reason", "")
        except Exception as e:
            logger.warning(f"LLM completeness scoring failed: {e}")
            return 70.0, "fallback"

    def _source_coverage(self, answer: str, context_list: list[dict]) -> float:
        """Check how many context chunks have at least 5 words in the answer."""
        if not context_list:
            return 0.0
        answer_lower = answer.lower()
        covered = 0
        for ctx in context_list:
            words = ctx.get("content", "").lower().split()
            # Check if any 5-word sequence from chunk appears in answer
            for i in range(len(words) - 4):
                phrase = " ".join(words[i:i+5])
                if phrase in answer_lower:
                    covered += 1
                    break
        return round((covered / len(context_list)) * 100, 1)

    def _grade(self, score: float) -> str:
        if score >= 85: return "A"
        if score >= 70: return "B"
        if score >= 55: return "C"
        if score >= 40: return "D"
        return "F"