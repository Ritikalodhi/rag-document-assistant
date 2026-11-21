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
4. SPECIFICITY: For attribute or parameter value questions, mentioning the
   attribute or providing only a schedule, formula, strategy, or method does
   NOT count as supplying the requested value. If the exact value is not
   explicitly provided, the answer must explicitly state that it is absent.
5. EXHAUSTIVENESS: If the question asks for several attributes or parameters,
   reduce the score for each requested attribute that is missing or lacks a
   direct value.

Scoring guide:
- 90-100: every requested part is directly answered with exact values.
- 60-89: most parts answered, but at least one requested value is missing, vague, or only described as a schedule/strategy.
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
        run_llm_judge: bool | None = None,
    ) -> dict:
        """Return a confidence score dict.

        Args:
            question: The user's question.
    3. SUPPORT: The answer must avoid claims that go beyond what a reasonable
        reading would assert as given; speculative or invented details reduce the
        score.
    4. SPECIFICITY: For attribute/value questions, mentioning the attribute is
        not enough. The requested value must be supplied, or the answer must
        explicitly say it is absent. Related attributes do not count as values.
    5. EXHAUSTIVENESS: If the question asks for several or all attributes,
        reduce the score for each requested attribute that is missing.
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
        # run_llm_judge=None (the default, and what every existing caller
        # passes since none set this param) means "auto-detect": use the
        # LLM judge only for broad/multi-part questions, where the
        # heuristic's lack of exhaustiveness-checking is most likely to
        # under- or over-count completeness. Simple factual questions keep
        # using the fast, deterministic heuristic unchanged. An explicit
        # True/False still overrides auto-detection if ever passed.
        if run_llm_judge is None:
            # Direct attribute lists have a deterministic per-attribute
            # coverage check. Do not let a single LLM judge score the whole
            # list as complete when one requested value is only related.
            run_llm_judge = (
                self._is_complex_question(question)
                and not self._is_multi_attribute_value_question(question)
            )

        if run_llm_judge and answer and not answer.startswith("Error"):
            completeness, reason = self._llm_completeness(question, answer)
        else:
            completeness = self._heuristic_completeness(question, answer)
            reason = "heuristic (requested-part coverage)"

        # 3. Grounding — how well the answer's factual content is supported
        #    by the retrieved context (lexical support + strict numeric
        #    checking). Internal name: grounding_score; legacy API field
        #    "source_coverage" is preserved in the returned dict.
        grounding_score = self._grounding_score(answer, context_list, question)

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

        # 5. Targeted material-incompleteness gate:
        # If an exact requested attribute/value is unavailable or missing:
        # score the answered attributes normally, give partial completeness,
        # but apply a material-incompleteness penalty/cap so the result cannot
        # display High confidence (>= 70) when a requested value is missing.
        # If incompleteness is minor and does not involve a central requested value
        # (material_omission is False), do not force the result below 70.
        material_omission, omission_ratio = self._detect_material_attribute_omission(question, answer)
        if material_omission:
            max_allowed = round(min(68.0, 68.0 * (1.0 - 0.20 * omission_ratio)), 1)
            composite = min(composite, max_allowed)

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
        r"|does\s+not\s+(?:explicitly\s+)?(?:mention|provide|state|specify|report|contain)"
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
    _ENUMERATION_RE = re.compile(
        r"\b(?:what\s+are|which\s+are|list|name|identify)\b.*\b"
        r"(?:components?|features?|elements?|modules?|stages?|steps?|parts?|"
        r"items?|aspects?)\b",
        re.IGNORECASE,
    )
    _ENUMERATION_GENERIC_TOKENS = frozenset(
        "what are which the a an in of mentioned described document "
        "key main major important primary listed following".split()
    )

    # Mirrors the broad_signals tuple used in rag_pipeline.py's _retrieve()
    # for retrieval routing. Duplicated here (not imported) because
    # rag_pipeline.py already imports this module, so a reverse import
    # would create a circular dependency. Used only to decide whether a
    # question is complex enough to warrant an LLM completeness judge
    # instead of the token-overlap heuristic.
    _BROAD_SIGNALS = (
        "explain", "describe", "walk through", "compare", "summarize",
        "summarise", "overview", "all the", "everything about",
    )
    _ATTRIBUTE_BOUNDARY_RE = re.compile(
        r"\b(?:was|were|is|are|does|did|has|have|had|used|reported|"
        r"achieved|provided|specified|set|chosen)\b",
        re.IGNORECASE,
    )
    _RELATED_ATTRIBUTE_RE = re.compile(
        r"\b(?:schedul\w*|strategy\w*|method\w*|approach\w*|policy\w*|procedure\w*|"
        r"configuration|setup|regimen|scheme|algorithm)\b",
        re.IGNORECASE,
    )

    @classmethod
    def _is_complex_question(cls, question: str) -> bool:
        """True when a question is broad or asks for multiple distinct facts.

        Used to decide whether completeness scoring should use the LLM
        judge (more accurate for complex/multi-part questions, at the cost
        of an extra LLM call) instead of the deterministic heuristic
        (fast, accurate enough for simple single-fact questions).
        """
        q = (question or "").strip().lower()
        if not q:
            return False
        is_broad = any(sig in q for sig in cls._BROAD_SIGNALS) or len(q.split()) > 18
        parts = cls._requested_parts(question)
        is_multipart = len(parts) > 1
        return is_broad or is_multipart or cls._is_specific_attribute_question(question)

    @classmethod
    def _requested_attribute_tokens(cls, part: str) -> list[str]:
        """Extract the attribute phrase before the question's answer verb."""
        text = (part or "").strip().lower().replace("-", " ")
        text = re.sub(r"^and\s+", "", text)
        text = re.sub(
            r"^(?:what|which|how\s+(?:many|much|long|old))\s+",
            "",
            text,
        )
        text = re.sub(r"^(?:was|were|is|are)\s+", "", text)
        text = re.split(
            r"\b(?:of|in|on|for|from|during)\b|"
            + cls._ATTRIBUTE_BOUNDARY_RE.pattern,
            text,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
        return [
            token for token in re.findall(r"[a-z]{2,}", text)
            if token not in cls._STOPWORDS
        ]

    @classmethod
    def _is_specific_attribute_question(cls, question: str) -> bool:
        """Route multi-token attribute/value requests to the LLM judge."""
        parts = cls._requested_parts(question)
        if len(parts) != 1:
            return False
        return cls._is_attribute_value_part(parts[0]) and len(
            cls._requested_attribute_tokens(parts[0])
        ) >= 2

    @classmethod
    def _is_multi_attribute_value_question(cls, question: str) -> bool:
        """Identify direct lists whose parts each require their own value.

        In a question such as "What optimizer, learning rate, and dropout
        were used?", only the first parsed segment retains "what". Bare
        following segments are inherited value requests, not broad prose.
        """
        parts = cls._requested_parts(question)
        if len(parts) < 2 or not cls._is_attribute_value_part(parts[0]):
            return False
        return any(
            not re.match(r"^(?:what|which|how|explain|describe|compare)\b", part, re.I)
            for part in parts[1:]
        )

    @staticmethod
    def _is_attribute_value_part(part: str) -> bool:
        """True for direct value requests, including inherited noun phrases.

        ``_requested_parts`` keeps the question word on only the first
        segment of questions such as "What optimizer, learning rate, and
        dropout were used?". The remaining segments are still value
        requests, even though they are bare noun phrases.
        """
        text = (part or "").strip()
        if re.match(r"^(?:what|which|how)\b", text, re.I):
            return True
        if re.match(r"^(?:explain|describe|compare|summarize|summarise|overview)\b", text, re.I):
            return False
        tokens = AnswerConfidenceScorer._requested_attribute_tokens(text)
        return bool(
            re.search(r"\b(?:was|were|is|are|does|did|used|reported|specified|achieved|trained|set)\b", text, re.I)
            or len(tokens) >= 1
        )

    @classmethod
    def _is_part_explicitly_unprovided(cls, part: str, answer: str) -> bool:
        """Check if an explicit refusal/absence statement applies to this part."""
        norm_ans = (answer or "").lower()
        if not norm_ans:
            return False
        tokens = cls._requested_attribute_tokens(part)
        if not tokens:
            tokens = cls._content_tokens(part)
        if len(norm_ans.split()) < 35 and cls._REFUSAL_RE.search(norm_ans):
            return True
        for m in cls._REFUSAL_RE.finditer(norm_ans):
            start = max(0, m.start() - 60)
            end = min(len(norm_ans), m.end() + 60)
            window = norm_ans[start:end]
            if any(t in window for t in tokens):
                return True
        return False

    @classmethod
    def _detect_material_attribute_omission(
        cls, question: str, answer: str
    ) -> tuple[bool, float]:
        """Detect if an exact requested attribute/value is unavailable or missing.

        Returns (is_material_omission, omission_ratio).
        """
        parts = cls._requested_parts(question)
        if not parts:
            return False, 0.0

        # Collect parts that request specific attribute values
        attr_parts = []
        for p in parts:
            if cls._is_attribute_value_part(p):
                attr_parts.append(p)

        if not attr_parts and cls._is_specific_attribute_question(question):
            attr_parts = [parts[0]]

        numeric_intent = re.compile(
            r"\b(?:how\s+(?:many|much|long|old)|what\s+(?:year|date|version|percentage)|which\s+version)\b",
            re.IGNORECASE,
        )

        missing_count = 0
        for p in attr_parts:
            has_val = cls._has_direct_attribute_value(p, answer) or (
                bool(numeric_intent.search(p)) and bool(re.search(r"\b\d+\b", answer))
            )
            is_unprovided = cls._is_part_explicitly_unprovided(p, answer)
            if not has_val or is_unprovided:
                missing_count += 1

        if missing_count > 0:
            return True, round(missing_count / len(attr_parts), 2)
        return False, 0.0

    @classmethod
    def _has_direct_attribute_value(cls, part: str, answer: str) -> bool:
        """Check whether a multi-token attribute has a directly linked value."""
        normalized_answer = (answer or "").lower().replace("-", " ")
        attribute_tokens = cls._requested_attribute_tokens(part)
        if len(attribute_tokens) < 2:
            return True

        candidates = []
        for size in range(len(attribute_tokens), 0, -1):
            for start in range(len(attribute_tokens) - size + 1):
                candidate = attribute_tokens[start:start + size]
                phrase = r"\s+".join(map(re.escape, candidate))
                candidates.extend(
                    (len(candidate), match)
                    for match in re.finditer(rf"\b{phrase}\b", normalized_answer)
                )
        if not candidates:
            return False

        number = r"(?:\d+(?:[.,]\d+)*|\d+(?:\.\d+)?%)"
        longest = max(size for size, _ in candidates)
        longest_matches = [match for size, match in candidates if size == longest]
        has_related_only_match = False
        for match in longest_matches:
            after = normalized_answer[match.end(): match.end() + 45]
            before = normalized_answer[max(0, match.start() - 45): match.start()]
            direct_number = (
                re.match(rf"(?:is|was|of|:|=)?\s*{number}\b", after)
                or re.search(rf"{number}\s+(?:[a-z]+\s+){{0,2}}$", before)
            )
            if direct_number:
                return True
            if cls._RELATED_ATTRIBUTE_RE.search(after):
                has_related_only_match = True

        if has_related_only_match:
            return False

        # Named values such as a schedule or strategy are valid when the
        # complete requested attribute phrase is present and is not followed
        # by a different related attribute.
        return True

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

        if cls._is_enumeration_question(question):
            return cls._enumeration_completeness(question, answer)

        parts = cls._requested_parts(question)
        if not parts:
            return 50.0

        is_refusal = bool(cls._REFUSAL_RE.search(answer))
        is_blanket_refusal = is_refusal and (
            len(parts) <= 1
            or (len(answer.split()) < 35 and not any(cls._has_direct_attribute_value(p, answer) for p in parts))
        )
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
            if is_blanket_refusal:
                # Absence statements receive partial credit below, but must
                # never be counted as if the requested value was supplied.
                continue
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
                and not is_blanket_refusal
            ):
                threshold_ok = True
            if threshold_ok:
                if (
                    cls._is_attribute_value_part(part)
                    and not cls._has_direct_attribute_value(part, answer)
                ):
                    continue
                addressed += 1
            elif numeric_intent.search(part) and answer_has_number:
                addressed += 1
            elif is_blanket_refusal and cls._REFUSAL_RE.search(part):
                addressed += 1

        coverage = addressed / len(parts)

        # A refusal that acknowledges the parts is acceptable but not a
        # full answer; a genuine multi-part answer scores by coverage.
        if is_blanket_refusal:
            return round(60.0 + 40.0 * coverage, 1)

        # Small deduction when the answer addresses parts only weakly is
        # already captured by coverage. No length/bullet/number rewards.
        return round(coverage * 100.0, 1)

    @classmethod
    def _is_enumeration_question(cls, question: str) -> bool:
        """Identify generic questions asking for a list of related items."""
        return bool(cls._ENUMERATION_RE.search((question or "").strip()))

    @classmethod
    def _enumeration_completeness(cls, question: str, answer: str) -> float:
        """Score list questions using category support and answer item coverage."""
        question_tokens = cls._content_tokens(question)
        category_tokens = question_tokens - cls._ENUMERATION_GENERIC_TOKENS
        answer_tokens = cls._content_tokens(answer)
        if not category_tokens or not answer_tokens:
            return 0.0

        answer_stems = {cls._stem(token) for token in answer_tokens}
        category_supported = sum(
            1
            for token in category_tokens
            if cls._tokens_match(token, answer_tokens, answer_stems)
        )
        category_coverage = category_supported / len(category_tokens)
        item_count = len(re.findall(r"(?m)^\s*(?:[-*+] |\d+[.)] |#{1,6}\s+)", answer))
        if item_count == 0:
            item_count = 1

        # Enumeration completeness rewards evidence of multiple listed items,
        # but remains below full certainty because the heuristic cannot know
        # the document's exact exhaustive item count.
        item_coverage = min(item_count / 6.0, 1.0)
        score = 30.0 * category_coverage + 65.0 * item_coverage
        return round(min(score, 95.0), 1)

    def _llm_completeness(self, question: str, answer: str) -> tuple[float, str]:
        """Ask the LLM to judge completeness. Falls back to the deterministic
        heuristic (never a hardcoded optimistic guess) if the LLM call fails,
        times out, returns malformed JSON, omits the score field, or returns
        a score outside the valid 0-100 range. This ensures an LLM failure
        can never artificially inflate the confidence score.
        """
        try:
            prompt = _COMPLETENESS_TEMPLATE.format(question=question, answer=answer)
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned)
            if "score" not in data:
                raise ValueError("LLM response missing required 'score' field")
            score = float(data["score"])
            if not (0.0 <= score <= 100.0):
                raise ValueError(f"LLM score out of valid range: {score}")
            reason = data.get("reason", "llm_judge")
            return score, reason
        except Exception as e:
            logger.warning(
                f"LLM completeness scoring failed ({e}); "
                "falling back to heuristic completeness"
            )
            fallback_score = self._heuristic_completeness(question, answer)
            return fallback_score, "heuristic_fallback (llm judge failed)"

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

    @staticmethod
    def _canon_number(n: str) -> str:
        """Canonicalize equivalent decimal spellings for grounding checks."""
        pct = n.endswith("%")
        core = n.rstrip("%")
        if re.fullmatch(r"\d+\.\d+", core):
            core = core.rstrip("0").rstrip(".")
        return core + ("%" if pct else "")

    @classmethod
    def _grounding_score(
        cls,
        answer: str,
        context_list: list[dict],
        question: str = "",
    ) -> float:
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
        ans_numbers = {cls._canon_number(n) for n in cls._extract_numbers(answer)}
        ctx_numbers = {
            cls._canon_number(n)
            for n in cls._extract_numbers(context_text)
            | cls._extract_numbers(question)
        }
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