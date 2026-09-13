"""
Manual verification script for the paraphrase-tolerant grounding fix.

Run this from your project root (same folder as `src/`):

    python verify_grounding_fix.py

It does NOT need pytest, langchain, or any other heavy dependency —
it only imports AnswerConfidenceScorer and calls _grounding_score()
directly with a fake LLM manager (never invoked by this path).
"""

import sys
from pathlib import Path

# Make sure `src` is importable regardless of where this script is run from.
sys.path.insert(0, str(Path(__file__).parent))

from src.confidence_scorer import AnswerConfidenceScorer  # noqa: E402


class _NoOpLLMManager:
    """Stub — _grounding_score never calls the LLM, so this is unused."""
    pass


def run_case(title: str, answer: str, context_text: str):
    scorer = AnswerConfidenceScorer(_NoOpLLMManager())
    context_list = [{"content": context_text}]
    score = scorer._grounding_score(answer, context_list)
    print(f"\n{title}")
    print(f"  Document: {context_text!r}")
    print(f"  Answer:   {answer!r}")
    print(f"  Grounding score: {score}")
    return score


def main():
    print("=" * 70)
    print("GROUNDING SCORE — PARAPHRASE FIX VERIFICATION")
    print("=" * 70)

    # Case 1: your original bug report.
    # Before the fix, "architecture/uses" not matching "model/consists"
    # dropped this to ~50.0. After the fix, the synonym table should
    # recover most/all of that gap.
    run_case(
        "Case 1: architecture/uses vs model/consists (the reported bug)",
        answer="The architecture uses six layers in its encoder.",
        context_text="The model consists of six encoder layers.",
    )

    # Case 2: exact lexical match — should already have scored ~100
    # before the fix and must still score ~100 after (sanity check that
    # we haven't broken the easy case).
    run_case(
        "Case 2: exact match (sanity check — should stay ~100)",
        answer="The model consists of six encoder layers.",
        context_text="The model consists of six encoder layers.",
    )

    # Case 3: genuinely unsupported claim — should still score LOW.
    # This checks the fix didn't become too permissive and start
    # rewarding answers that aren't actually grounded.
    run_case(
        "Case 3: unsupported claim (sanity check — should stay LOW)",
        answer="The model consists of twelve decoder layers and uses reinforcement learning.",
        context_text="The model consists of six encoder layers.",
    )

    # Case 4: multi-chunk synthesis case — paraphrased summary spanning
    # two source sentences, mimicking the "complex questions correlate
    # with more free-form phrasing" pattern you flagged.
    run_case(
        "Case 4: multi-chunk paraphrase synthesis",
        answer="The system employs an encoder-decoder design featuring six layers on each side and eight attention heads per layer.",
        context_text=(
            "The model consists of six encoder layers and six decoder layers. "
            "Each layer uses eight attention heads."
        ),
    )

    print("\n" + "=" * 70)
    print("Interpretation:")
    print("  Case 1 should now score noticeably higher than the old ~50.0")
    print("  Case 2 should remain ~100 (unaffected)")
    print("  Case 3 should remain low (fix must not weaken hallucination detection)")
    print("  Case 4 should score meaningfully higher than before (multi-fact paraphrase)")
    print("=" * 70)


if __name__ == "__main__":
    main()
    