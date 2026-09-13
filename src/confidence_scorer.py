"""Answer Confidence Scorer.

Produces TWO distinct kinds of scores:

1. Retrieval relevance — how relevant were the retrieved chunks?
   (avg of per-chunk retrieval_relevance scores). This says nothing
   about whether the ANSWER is factually correct.
2. Answer confidence — how well the generated answer is supported by
   the context and how completely it answers the question. This is
   composed of answer_completeness and grounding (source coverage).

composite_score / answer_confidence is the weighted blend, exposed with
an A-F grade. All legacy keys (retrieval_confidence, composite_score)
are preserved for backward compatibility.
"""

import re
import json
from langchain_core.prompts import PromptTemplate
from loguru import logger

_COMPLETENESS_TEMPLATE = PromptTemplate(
    input_variables=["question", "answer"],
    template="""You are judging how completely an answer addresses a question.

Evaluate the answer against these criteria:
1. PART COVERAGE: Identify every distinct piece of information the question
   requests (a question may ask for several things, e.g. "What model is used,
   how many encoder layers does it have, and how many attention heads?"
   requests three facts). Each requested part must be addressed.
2. DIRECTNESS: The answer must directly answer the question, not merely
   discuss related material. Answers that are longer are NOT better.
3. SUPPORT: The answer must avoid claims that go beyond what a reasonable
   reading would assert as given; speculative or invented details reduce
   the score.

Scoring guide:
- 90-100: every requested part is directly answered.
- 60-89: most parts answered, at least one missing or vague.
- 30-59: only some parts answered, or mostly indirect.
- 0-29: the question is essentially not answered.

Respond with ONLY a JSON object (no markdown, no extra keys):
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
            context_list: List of context dicts with retrieval_relevance
                          (or legacy confidence_percent) per chunk.
            run_llm_judge: If True, call the LLM to score completeness.
                           Adds ~1s latency. Default False for speed.
        """
        # 1. Retrieval relevance — average of per-chunk retrieval relevance.
        #    This is NOT answer confidence; it only measures how relevant
        #    the retrieved evidence was to the query.
        scores = [
            c.get("retrieval_relevance", c.get("confidence_percent", 0))
            for c in context_list
        ]
        if scores:
            top_scores = sorted(scores, reverse=True)[:2]
            retrieval_relevance = round(sum(top_scores) / len(top_scores), 1)
        else:
            retrieval_relevance = 0.0

        # 2. Answer completeness
        if run_llm_judge and answer and not answer.startswith("Error"):
            completeness, reason = self._llm_completeness(question, answer)
        else:
            completeness = self._heuristic_completeness(question, answer)
            reason = "heuristic (requested-part coverage)"

        # 3. Grounding — how well the answer's factual content is supported
        #    by the retrieved context (lexical support + strict numeric
        #    checking). Internal name: grounding_score; legacy API field
        #    "source_coverage" is preserved in the returned dict.
        grounding_score = self._grounding_score(answer, context_list)

        # 4. Composite quality score.
        #
        # This is a TRANSPARENT QUALITY SCORE, not a calibrated probability
        # of correctness. Frontends should label it as an answer-quality
        # indicator, never as "X% chance the answer is correct".
        #
        # Weights (35% retrieval relevance / 40% grounding / 25%
        # completeness) are used as recommended, with ONE deliberate
        # architectural adjustment: a multiplicative grounding gate.
        #
        # Rationale: grounding is the only component that directly detects
        # unsupported facts — the most damaging failure mode. A weighted
        # average alone lets strong retrieval relevance (35%) prop up a
        # hallucinated answer (e.g. retrieval 90 + grounding 5 +
        # completeness 60 -> ~52, grade D/E — still too generous).
        # The gate scales the weighted blend by (0.25 + 0.75 * grounding)
        # so weak evidence support sharply limits the final score while a
        # fully-grounded answer is untouched (gate = 1.0, no inflation).
        composite = round(
            (retrieval_relevance * 0.35
             + grounding_score * 0.40
             + completeness * 0.25)
            * (0.25 + 0.75 * grounding_score / 100.0),
            1,
        )

        return {
            # New, semantically-correct fields
            "retrieval_relevance": retrieval_relevance,
            "answer_confidence": composite,
            "answer_completeness": round(completeness, 1),
            "grounding_score": grounding_score,
            # Legacy fields preserved for backward compatibility
            "retrieval_confidence": retrieval_relevance,
            "source_coverage": grounding_score,
            "composite_score": composite,
            "completeness_reason": reason,
            "grade": self._grade(composite),
        }

    # ── Completeness heuristics ─────────────────────────────────────

    # Question words that introduce a distinct requested fact when they
    # appear in a compound question. Each occurrence beyond the first
    # signals an additional requested part.
    _PART_SPLIT_RE = re.compile(
        r"\b(?:and\s+)?(?:what|which|how|when|where|who|why|list|name|identify"
        r"|describe|explain|compare|summar(?:y|ise|ize))\b",
        re.IGNORECASE,
    )
    # Coordination words that join parallel noun-phrase requests inside a
    # single question word, e.g. "model, layers, and heads" -> 3 parts.
    _COORD_SPLIT_RE = re.compile(r"\b(?:and|also|plus)\b|[,;]", re.IGNORECASE)
    # Absence/refusal phrasing — a legitimate complete answer when the
    # requested information is genuinely absent from the source.
    _REFUSAL_RE = re.compile(
        r"not\s+(?:provided|mentioned|specified|stated|given|available|disclosed"
        r"|reported|present|contained)"
        r"|does\s+not\s+(?:mention|provide|state|specify|report|contain)"
        r"|no\s+(?:information|data|value|details?)\s+(?:is|are|was|were)\s+(?:provided|available)"
        r"|insufficient\s+(?:information|context|evidence)"
        r"|i\s+(?:don't|do not|cannot|can't)\s+(?:find|determine|answer)",
        re.IGNORECASE,
    )
    # Direct single-slot identity questions ("what is my name", "who is the
    # author", "what's the title") ask for a VALUE that REPLACES the
    # question's own noun in the answer — a correct answer does not repeat
    # words like "name"/"author"/"title". Lexical-overlap checking against
    # the question is the wrong test for these; a short part combined with
    # any substantive, non-refusal answer is enough.
    _IDENTITY_QUESTION_RE = re.compile(
        r"^(?:what|who|which)(?:'s|\s+is|\s+are)\b", re.IGNORECASE
    )

    @classmethod
    def _requested_parts(cls, question: str) -> list[str]:
        """Split a question into the distinct facts it requests.

        "What model is used, how many encoder layers does it have, and how
        many attention heads?" -> three parts (model, encoder layers,
        attention heads). Conservative: if parsing yields nothing, the
        question is treated as one part.
        """
        q = (question or "").strip()
        if not q:
            return []
        # Split on question words and coordinating punctuation, KEEPING the
        # question word attached to its segment (so "how many encoder layers"
        # stays intact for numeric-intent detection).
        matches = list(cls._PART_SPLIT_RE.finditer(q))
        segments: list[str] = []
        if not matches:
            segments = [q]
        else:
            # Text before the first question word (rare, keep if substantial).
            head = q[: matches[0].start()].strip(" ,.?!:;-")
            if len(head.split()) >= 2:
                segments.append(head)
            for i, m in enumerate(matches):
                end = matches[i + 1].start() if i + 1 < len(matches) else len(q)
                segments.append(q[m.start():end])
        parts: list[str] = []
        for seg in segments:
            seg = seg.strip(" ,.?!:;-")
            if not seg:
                continue
            # Within a segment, coordinated noun phrases are still distinct
            # requests (e.g. "model, layers, and heads").
            for sub in cls._COORD_SPLIT_RE.split(seg):
                sub = sub.strip(" ,.?!:;-")
                # Only keep sub-segments with real content words.
                if sub and len(sub.split()) >= 1 and re.search(r"[a-z0-9]", sub, re.I):
                    parts.append(sub.lower())
        # Cap to avoid pathological parsing on very long questions.
        return parts[:8] if parts else [q.lower()]

    @classmethod
    def _heuristic_completeness(cls, question: str, answer: str) -> float:
        """Conservative, non-verbosity-based completeness estimate (0-100).

        Detects the distinct facts the question requests and checks each
        is addressed in the answer. Addressed = the answer contains content
        tokens from that part (paraphrase-tolerant) OR explicitly states
        the information is not provided. Formatting (length, bullets,
        numbers) contributes nothing.
        """
        answer = answer or ""
        if not answer.strip():
            return 0.0

        parts = cls._requested_parts(question)
        if not parts:
            return 50.0

        is_refusal = bool(cls._REFUSAL_RE.search(answer))
        is_identity_question = bool(cls._IDENTITY_QUESTION_RE.match((question or "").strip()))
        ans_tokens = cls._content_tokens(answer)
        ans_lower = answer.lower()
        answer_has_number = bool(re.search(r"\d", answer))
        # Numeric-intent parts ("how many...", "how much...", "what year",
        # "which version") can be addressed by a bare numeric answer ("6").
        # Whether the number is CORRECT is grounding's job; completeness
        # only checks the part was answered.
        numeric_intent = re.compile(
            r"\b(?:how\s+(?:many|much|long|old)|what\s+(?:year|date|version|percentage)"
            r"|which\s+version)\b",
            re.IGNORECASE,
        )

        addressed = 0
        for part in parts:
            part_tokens = cls._content_tokens(part)
            if not part_tokens:
                addressed += 1
                continue
            # A part is addressed if a meaningful share of its content
            # words appear in the answer (paraphrase-tolerant).
            overlap = sum(1 for t in part_tokens if t in ans_tokens)
            threshold_ok = overlap / len(part_tokens) >= 0.5
            if not threshold_ok and len(part_tokens) <= 3 and overlap >= 1:
                # Short parts (e.g. "bleu score achieved") are addressed
                # by mentioning their key term.
                threshold_ok = True
            # Direct single-slot identity questions ("what is my name",
            # "who is the author") ask for a VALUE that replaces the
            # question's own noun — a correct answer ("Ritika Lodhi") has
            # zero lexical overlap with "name" by design, not because the
            # question went unanswered. Treat a short part (<=2 content
            # words) as addressed whenever the answer is substantive and
            # not a refusal, since there is nothing further to check
            # lexically for a single-slot identity question.
            if (
                not threshold_ok
                and is_identity_question
                and len(part_tokens) <= 2
                and ans_tokens
                and not is_refusal
            ):
                threshold_ok = True
            if threshold_ok:
                addressed += 1
            elif numeric_intent.search(part) and answer_has_number:
                addressed += 1
            elif is_refusal and cls._REFUSAL_RE.search(part):
                addressed += 1

        coverage = addressed / len(parts)

        # A refusal that acknowledges the parts is acceptable but not a
        # full answer; a genuine multi-part answer scores by coverage.
        if is_refusal:
            return round(60.0 + 40.0 * coverage, 1)

        # Small deduction when the answer addresses parts only weakly is
        # already captured by coverage. No length/bullet/number rewards.
        return round(coverage * 100.0, 1)

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
        """Backward-compatible alias for :meth:`_grounding_score`."""
        return self._grounding_score(answer, context_list)

    # ── Evidence grounding ────────────────────────────────────────────

    # Words that carry little factual content; excluded from token overlap.
    _STOPWORDS = frozenset(
        "a an the and or of to in on for with by from as at is are was were be been "
        "being this that these those it its their they we our you your he she his her "
        "which what who whom whose how when where why not no yes do does did done can "
        "could should would may might will shall must have has had also than then thus "
        "into about over under between across per each any all both more most other some "
        "such only own same so too very just there here using used use uses based given "
        "shows show shown table figure section following above below via while however"
        .split()
    )

    # Numbers appearing in these hedging/absence phrases are NOT factual
    # claims about the document (e.g. "not provided", "does not mention").
    _ABSENCE_PATTERNS = (
        r"not\s+(?:provided|mentioned|specified|stated|given|available|disclosed|reported|present)",
        r"(?:no|not\s+any)\s+(?:information|data|value|number|figure|details?|details)",
        r"does\s+not\s+(?:mention|provide|state|specify|report|contain|include)",
        r"do\s+not\s+(?:mention|provide|state|specify|report|contain|include)",
        r"did\s+not\s+(?:mention|provide|state|specify|report)",
        r"isn't|aren't|wasn't|weren't\s+(?:provided|mentioned|specified|stated)",
        r"not\s+(?:available|found)\s+in\s+the\s+(?:document|context|retrieved)",
        r"insufficient\s+(?:information|context|evidence)",
    )

    _NUMBER_RE = re.compile(
        r"\d+(?:[.,]\d+)+|\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\b|\bv?\d+(?:\.\d+)+\b"
    )

    @classmethod
    def _is_absence_statement(cls, answer: str) -> bool:
        """True when the answer primarily says the information is absent.

        Such answers should not be penalised merely because the source
        does not contain the asked-for information.
        """
        lowered = answer.lower()
        # Absence language must dominate the answer to qualify.
        if not any(re.search(p, lowered) for p in cls._ABSENCE_PATTERNS):
            return False
        # If it also asserts many concrete content words, it is not purely
        # an absence statement.
        content_words = cls._content_tokens(answer)
        return len(content_words) <= 40

    # ── Paraphrase-tolerant token matching ──────────────────────────
    # Small hardcoded stemmer + synonym table so that phrasing choices
    # ("uses" vs "consists", "architecture" vs "model") don't count as
    # unsupported content. Deliberately conservative — general nouns/
    # numbers are untouched, so numeric hallucination detection is
    # unaffected.
    _PARAPHRASE_SYNONYMS: dict[str, frozenset[str]] = {
        "consists": frozenset({"uses", "comprises", "contains", "includes", "employs", "features", "has"}),
        "uses": frozenset({"consists", "comprises", "employs", "utilizes", "utilises"}),
        "contains": frozenset({"consists", "includes", "comprises", "has"}),
        "comprises": frozenset({"consists", "contains", "includes"}),
        "architecture": frozenset({"model", "design", "structure"}),
        "model": frozenset({"architecture", "system"}),
        "employs": frozenset({"uses", "utilizes", "utilises", "features", "has"}),
        "features": frozenset({"has", "consists", "includes", "employs", "uses"}),
        "having": frozenset({"with", "featuring", "containing"}),
        "each": frozenset({"per", "every"}),
        "per": frozenset({"each", "every"}),
        "design": frozenset({"architecture", "structure", "model"}),
        "system": frozenset({"model", "architecture"}),
    }

    @staticmethod
    def _stem(word: str) -> str:
        """Minimal suffix stripping — enough to match uses/used/using etc."""
        for suf in ("ing", "edly", "ed", "es", "s", "ly"):
            if word.endswith(suf) and len(word) - len(suf) >= 3:
                return word[: -len(suf)]
        return word

    @classmethod
    def _tokens_match(cls, ans_token: str, ctx_tokens: set[str], ctx_stems: set[str]) -> bool:
        if ans_token in ctx_tokens:
            return True
        stem = cls._stem(ans_token)
        if stem in ctx_stems:
            return True
        synonyms = cls._PARAPHRASE_SYNONYMS.get(ans_token) or cls._PARAPHRASE_SYNONYMS.get(stem)
        if synonyms and (
            synonyms & ctx_tokens
            or {cls._stem(s) for s in synonyms} & ctx_stems
        ):
            return True
        return False

    @staticmethod
    def _content_tokens(text: str) -> set[str]:
        """Lowercased alphabetic content tokens, stopwords removed."""
        return {
            w for w in re.findall(r"[a-z]{2,}", text.lower())
            if w not in AnswerConfidenceScorer._STOPWORDS
        }

    @classmethod
    def _extract_numbers(cls, text: str) -> set[str]:
        """Extract normalised numeric tokens (values, percentages, dates, versions).

        Normalisation strips commas/spaces in grouped digits and trailing
        punctuation so "1,024" == "1024" and "97.5%" stays "97.5%".
        """
        numbers = set()
        for m in cls._NUMBER_RE.finditer(text):
            n = m.group(0).strip().rstrip(".,;:")
            n = n.replace(",", "").replace(" ", "")
            if n:
                numbers.add(n.lower())
        return numbers

    @classmethod
    def _grounding_score(cls, answer: str, context_list: list[dict]) -> float:
        """Estimate how well the answer's factual content is supported by the
        retrieved context (0-100).

        Lightweight, no LLM calls and no external knowledge. Two signals:

        1. Lexical support: content-word overlap between the answer and the
           combined context. Paraphrase survives this because only content
           words matter, not word order or exact phrases.
        2. Numeric strictness: every number in the answer (values,
           percentages, metric values, counts, dates, versions) must appear
           in the context. Each unsupported number subtracts heavily, since
           numeric hallucination is the most damaging failure mode.

        Answers that primarily state the information is not provided are
        not penalised for the source's lack of that information.
        """
        if not context_list:
            return 0.0
        answer = answer or ""
        if not answer.strip():
            return 0.0

        # Rule 7: "the value is not provided in the document" is a valid,
        # grounded response. Treat absence statements as fully grounded
        # with respect to sourcing (the claim is about absence, which the
        # model itself attests from the empty evidence).
        if cls._is_absence_statement(answer):
            return 75.0

        context_text = "\n".join(
            c.get("content", "") for c in context_list
        )
        context_lower = context_text.lower()

        ctx_tokens = cls._content_tokens(context_text)
        ans_tokens = cls._content_tokens(answer)

        if not ans_tokens:
            # Purely numeric answer; lexical support is vacuous, rely on
            # numeric check below.
            lexical = 1.0
        else:
            ctx_stems = {cls._stem(t) for t in ctx_tokens}
            covered = sum(
                1 for t in ans_tokens if cls._tokens_match(t, ctx_tokens, ctx_stems)
            )
            # Coverage weighted by how much of the answer is content words.
            lexical = covered / len(ans_tokens)

        # ── Numeric strictness ────────────────────────────────────────
        ans_numbers = cls._extract_numbers(answer)
        ctx_numbers = cls._extract_numbers(context_text)
        unsupported = ans_numbers - ctx_numbers

        if ans_numbers:
            numeric_ok = 1.0 - (len(unsupported) / len(ans_numbers))
        else:
            numeric_ok = 1.0

        # Unsupported numbers subtract substantially from grounding.
        # Base from lexical support, then penalise: each unsupported
        # number removes a large fixed share of the score.
        score = lexical * 100.0
        if unsupported:
            penalty = min(80.0, len(unsupported) * 25.0)
            score = max(0.0, score - penalty)

        # If numbers are fine but lexical overlap is weak, blend so that a
        # purely-paraphrased numeric answer isn't over-penalised and a
        # copied-but-numerically-wrong answer isn't over-rewarded.
        if ans_numbers:
            score = 0.5 * score + 50.0 * numeric_ok

        return round(max(0.0, min(100.0, score)), 1)

    def _grade(self, score: float) -> str:
        if score >= 85: return "A"
        if score >= 70: return "B"
        if score >= 55: return "C"
        if score >= 40: return "D"
        return "F"