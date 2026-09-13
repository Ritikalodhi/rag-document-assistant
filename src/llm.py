"""LLM integration and response generation — supports OpenAI and Gemini.

Features:
- Retry logic for transient failures
- Configurable request timeout
- Fallback model support
"""

import asyncio
import time
from langchain_core.prompts import PromptTemplate
from src.config import (
    OPENAI_API_KEY, OPENAI_MODEL,
    GEMINI_API_KEY, GEMINI_MODEL,
    LLM_PROVIDER, LLM_FALLBACK_MODEL,
)
from loguru import logger

_QA_TEMPLATE = PromptTemplate(
    input_variables=["context", "question"],
    template="""You are an AI research paper assistant.

Answer ONLY using the retrieved context below.

Guidelines:
- Read ALL retrieved chunks before answering.
- Treat the retrieved context as one evidence set, not as a single best-match excerpt.
- Before drafting, identify the claims needed for each part of the question and gather supporting details from every relevant chunk. Combine complementary facts across chunks into one answer.
- Do not stop after finding an answer in one chunk when other retrieved chunks may add requested details, qualifiers, metrics, or later subsections.
- Include a claim only when it is supported by the retrieved context; if relevant chunks disagree, report the disagreement rather than choosing or inventing a value.
- If the question has multiple parts (e.g., methodology + results), answer each part separately with its own heading.
- Never say information is unavailable unless you have checked all retrieved context.
- Preserve exact terminology from the paper (BLEU Score, METEOR Score, Top-1 Accuracy, F1 Score, etc.).
- If the user asks for "accuracy" but the paper reports different metrics, say: "The paper does not report classification accuracy. Instead it reports:" then list them.
- Distinguish clearly between: Methodology / Model Architecture / Training Strategy / Implementation Details / Experimental Results. Do not mix them.
- Include EVERY numerical metric in the retrieved context — do not omit values.
- For benchmark comparisons, separately report: overall evaluation metrics, then baseline comparisons.
- Structure answers with headings and bullet points.
- If part of the question cannot be answered from context, state exactly what is missing rather than saying "no information exists."
- Do not hallucinate. If a value is not in the context, say: "The retrieved context does not provide this information."
- Implementation details (software stack, libraries, language, deployment) belong under Implementation, NOT Methodology.
- When looking for results, prioritize chunks whose headings contain: Results, Evaluation, Performance, Experiments, Benchmarks, Metrics.
- Do not compress or summarize away numerical values — report every number explicitly.
- When explaining a section (e.g., Methodology), cover EVERY subsection under that heading — do not stop after the first one.
- For Methodology sections, always include: Overview, Data Collection/Preprocessing, Model Design/Architecture, Training Strategy, and Deployment if present.
- If a subsection contains architecture details or hyperparameters (layers, heads, optimizer, dropout, learning rate, steps), include all of them.
- When explaining a process, workflow, architecture pipeline, or sequence of steps, present each step separately on its own line or as a bullet/numbered item. Leave one blank line between separate paragraph-style steps, and preserve the original order from the retrieved document.
- Clearly distinguish information explicitly stated in the retrieved document from inference. If an inference is necessary, label it "Inference:" and ensure it is directly supported by the retrieved context. Do not make unsupported inferences or present them as explicitly stated.
- Prefer completeness over brevity — do not omit later subsections because the answer is already long.
- Preserve the paper's original section hierarchy when structuring answers.
- Never compress or skip subsections to shorten the response.
- If a heading appears in the context but the content under it is thin, say what IS present rather than calling the section unavailable.
- Do NOT label "Software Stack" or "Implementation" content as Methodology — keep them under their correct section.
- If the context contains BOTH a projected/expected metric range (e.g. from a "Performance Benchmarks" or "Expected Performance" table) AND an actual/measured/reported result for the same metric (e.g. from an "Overall Result Summary" or "Results" table), always give the actual/measured value as the primary answer, stated first and clearly labeled "Actual result:". Mention the projected/expected range afterward, clearly labeled "Expected range:", only as secondary context.

OUTPUT FORMATTING RULES (strictly required — formatting only, never changes facts):
- Output clean, well-formatted Markdown. Never output raw JSON, Python/code blocks, or internal retrieval/debug information.
- Always leave ONE BLANK LINE between a heading/label and the text or list that follows it. Never place text on the line immediately after a heading.
- Never write one huge unbroken paragraph. Split multi-fact answers across separate lines with blank lines between them.
- Simple factual question → a bold "**Answer**" heading, a blank line, then one short direct sentence.
- Question asking for multiple attributes/facts → one bold label per fact on its own line ("**Model:**", "**Encoder Layers:**"), each followed by a blank line before the next label. Preserve relationships between fields exactly (e.g. dataset sizes stay attached to the correct split).
- Lists (e.g. enhancements, tools, steps) → a bold section heading, blank line, then a numbered or bulleted list, one item per line.
- Comparison of multiple entities/columns → a proper Markdown table with a header row.
- Long/multi-part questions → a bold heading (## or **) per major part, a blank line between every section, and the facts under the correct heading.
- Keep values EXACTLY as they appear in the context: same numbers, names, units, and relationships. Do not invent, estimate, round, or restate values.
- Do not repeat or rephrase the user's question in the answer.
- Do NOT include source lists, citation markers like "Sources:123456", page numbers, chunk references, confidence scores, or explanations of how the answer was found — the answer content only.
- If the context does not contain the answer, state clearly and briefly that the information is not available in the provided document. Never guess.
- Keep answers concise unless the user explicitly asks for a detailed explanation.

Context:
{context}

Question: {question}

Answer:""",
)

_MEMORY_QA_TEMPLATE = PromptTemplate(
    input_variables=["history", "context", "question"],
    template="""You are an AI research paper assistant in an ongoing conversation.

Answer ONLY using the retrieved context below. Use conversation history only to resolve pronouns or references (e.g., "it", "this model").

Guidelines:
- Read ALL retrieved chunks before answering.
- Treat the retrieved context as one evidence set, not as a single best-match excerpt.
- Before drafting, identify the claims needed for each part of the question and gather supporting details from every relevant chunk. Combine complementary facts across chunks into one answer.
- Do not stop after finding an answer in one chunk when other retrieved chunks may add requested details, qualifiers, metrics, or later subsections.
- Include a claim only when it is supported by the retrieved context; if relevant chunks disagree, report the disagreement rather than choosing or inventing a value.
- If the question has multiple parts, answer each part separately with its own heading.
- Never say information is unavailable unless you have checked all retrieved context.
- Preserve exact terminology from the paper, including metric names, values, units, and relationships.
- If the user asks for "accuracy" but the paper reports different metrics, say: "The paper does not report classification accuracy. Instead it reports:" then list them.
- Include EVERY numerical metric — do not omit values.
- For benchmark comparisons, separately report: overall evaluation metrics, then baseline comparisons.
- Distinguish: Methodology / Architecture / Training / Implementation / Results.
- Structure answers with headings and bullet points.
- If part of the question cannot be answered from context, state exactly what is missing rather than saying "no information exists."
- Do not hallucinate. If a value is not in the context, say: "The retrieved context does not provide this information."
- Implementation details (software stack, libraries, language, deployment) belong under Implementation, NOT Methodology.
- When looking for results, prioritize chunks whose headings contain: Results, Evaluation, Performance, Experiments, Benchmarks, Metrics.
- Do not compress or summarize away numerical values — report every number explicitly.
- Structure with headings and bullet points.
- When explaining a section (e.g., Methodology), cover EVERY subsection under that heading — do not stop after the first one.
- For Methodology sections, always include: Overview, Data Collection/Preprocessing, Model Design/Architecture, Training Strategy, and Deployment if present.
- If a subsection contains architecture details or hyperparameters (layers, heads, optimizer, dropout, learning rate, steps), include all of them.
- When explaining a process, workflow, architecture pipeline, or sequence of steps, present each step separately on its own line or as a bullet/numbered item. Leave one blank line between separate paragraph-style steps, and preserve the original order from the retrieved document.
- Clearly distinguish information explicitly stated in the retrieved document from inference. If an inference is necessary, label it "Inference:" and ensure it is directly supported by the retrieved context. Do not make unsupported inferences or present them as explicitly stated.
- Prefer completeness over brevity — do not omit later subsections because the answer is already long.
- Preserve the paper's original section hierarchy when structuring answers.
- Never compress or skip subsections to shorten the response.
- If a heading appears in the context but the content under it is thin, say what IS present rather than calling the section unavailable.
- Do NOT label "Software Stack" or "Implementation" content as Methodology — keep them under their correct section.
- If the context contains BOTH a projected/expected metric range AND an actual/measured/reported result for the same metric, always give the actual/measured value as the primary answer, labeled "Actual result:", then the projected range labeled "Expected range:" as secondary context.

OUTPUT FORMATTING RULES (strictly required — formatting only, never changes facts):
- Output clean, well-formatted Markdown. Never output raw JSON, Python/code blocks, or internal retrieval/debug information.
- Always leave ONE BLANK LINE between a heading/label and the text or list that follows it. Never place text on the line immediately after a heading.
- Never write one huge unbroken paragraph. Split multi-fact answers across separate lines with blank lines between them.
- Simple factual question → a bold "**Answer**" heading, a blank line, then one short direct sentence.
- Question asking for multiple attributes/facts → one bold label per fact on its own line ("**Model:**", "**Encoder Layers:**"), each followed by a blank line before the next label. Preserve relationships between fields exactly.
- Lists → a bold section heading, blank line, then a numbered or bulleted list, one item per line.
- Comparison of multiple entities/columns → a proper Markdown table with a header row.
- Long/multi-part questions → a bold heading per major part, a blank line between every section, and the facts under the correct heading.
- Keep values EXACTLY as they appear in the context: same numbers, names, units, and relationships. Do not invent, estimate, round, or restate values.
- Do not repeat or rephrase the user's question in the answer.
- Do NOT include source lists, citation markers, page numbers, chunk references, confidence scores, or explanations of how the answer was found.
- If the context does not contain the answer, state clearly and briefly that the information is not available in the provided document. Never guess.
- Keep answers concise unless the user explicitly asks for a detailed explanation.

Conversation History:
{history}

Retrieved Context:
{context}

Question: {question}

Answer:""",
)

_SUMMARIZE_TEMPLATE = PromptTemplate(
    input_variables=["text"],
    template="""You are an expert research paper summarizer.
Your task is to generate a concise, accurate, and well-structured summary using ONLY the retrieved context provided below.

Instructions:
- Do NOT use outside knowledge or make assumptions.
- If a detail is not present in the retrieved context, do not invent it.
- Keep the summary between 150 and 200 words.
- Write in clear, professional language.

Your summary should include:
1. The problem or motivation behind the work.
2. The proposed solution or methodology.
3. Important implementation details (if available).
4. Key results, including numerical metrics such as accuracy, F1-score, FPS, etc.
5. Limitations or error analysis.
6. Future work.
7. The overall conclusion.

Return only the summary as a single paragraph.

Context:
{text}

Summary:""",
)

# Retry configuration
_MAX_RETRIES = 3
_RETRY_DELAY = 1.0  # seconds
_REQUEST_TIMEOUT = 60.0  # seconds
_GEMINI_FALLBACK_MODELS = (
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
)


class LLMManager:
    """Manages LLM interactions for OpenAI and Gemini providers.

    Features:
    - Retry logic with exponential backoff for transient failures
    - Configurable request timeout
    - Fallback model support when primary model fails
    """

    def __init__(self, model: str | None = None, temperature: float = 0.7,
                 max_retries: int = _MAX_RETRIES, request_timeout: float = _REQUEST_TIMEOUT):
        self.temperature = temperature
        self.provider = LLM_PROVIDER
        self.max_retries = max_retries
        self.request_timeout = request_timeout
        self.fallback_model_name: str | None = None
        self._fallback_llm = None
        self._fallback_llms: list[tuple[str, object]] = []

        self.model_name = model or (OPENAI_MODEL if self.provider == "openai" else GEMINI_MODEL)
        self.llm = self._build_llm(self.model_name)
        self._configure_default_fallbacks()
        logger.info(
            f"Initialized {self.provider.upper()} LLM: {self.model_name} "
            f"(temperature={temperature}, timeout={request_timeout}s, "
            f"max_retries={max_retries})"
        )

    def _build_llm(self, model_name: str):
        """Build a langchain LLM instance for the given model name."""
        if self.provider == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                api_key=OPENAI_API_KEY,
                model=model_name,
                temperature=self.temperature,
                timeout=self.request_timeout,
                max_retries=self.max_retries,
            )
        elif self.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            kwargs = {
                "google_api_key": GEMINI_API_KEY,
                "model": model_name,
                "max_output_tokens": 16384,
                # Bound every attempt and disable SDK-internal retry/backoff:
                # on 429 RESOURCE_EXHAUSTED the SDK otherwise stalls each
                # invoke() for ~35s before surfacing the error, so the retry +
                # fallback chain in _invoke_with_retry/_invoke only kicks in
                # after minutes. Fail fast here instead; retry/backoff and
                # fallback-model selection remain owned by this class.
                "timeout": self.request_timeout,
                "max_retries": 0,
            }
            if not model_name.startswith("gemini-3") and model_name != "gemini-flash-latest":
                kwargs["temperature"] = self.temperature
            return ChatGoogleGenerativeAI(
                **kwargs,
            )
        raise ValueError(f"Invalid LLM provider: {self.provider}")

    def _configure_default_fallbacks(self) -> None:
        """Configure built-in fallbacks for common model retirement/access errors."""
        candidates: list[str] = []
        if LLM_FALLBACK_MODEL:
            candidates.append(LLM_FALLBACK_MODEL)
        if self.provider == "gemini":
            candidates.extend(_GEMINI_FALLBACK_MODELS)

        for candidate in candidates:
            if candidate and candidate != self.model_name:
                self._add_fallback_model(candidate)

    def _add_fallback_model(self, model_name: str) -> None:
        if any(existing == model_name for existing, _ in self._fallback_llms):
            return
        try:
            fallback_llm = self._build_llm(model_name)
            self._fallback_llms.append((model_name, fallback_llm))
            if self._fallback_llm is None:
                self.fallback_model_name = model_name
                self._fallback_llm = fallback_llm
            logger.info(f"Fallback LLM configured: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize fallback model '{model_name}': {e}")

    def set_fallback_model(self, model_name: str) -> None:
        """Configure a fallback model to use when the primary model fails."""
        self._add_fallback_model(model_name)

    def _invoke_with_retry(self, llm, prompt: str, is_stream: bool = False) -> str | None:
        """Invoke the LLM with retry logic.

        Returns None if all retries fail.
        """
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                if is_stream:
                    # For streaming, just invoke directly
                    response = llm.invoke(prompt)
                else:
                    response = llm.invoke(prompt)
                content = response.content
                if isinstance(content, list):
                    content = " ".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in content
                    )
                return content.strip()
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    delay = _RETRY_DELAY * (2 ** (attempt - 1))
                    logger.warning(
                        f"LLM call failed (attempt {attempt}/{self.max_retries}), "
                        f"retrying in {delay:.1f}s: {e}"
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"LLM call failed after {self.max_retries} attempts: {e}")
        return None

    def _invoke(self, prompt: str) -> str:
        """Invoke the LLM with retry and optional fallback."""
        result = self._invoke_with_retry(self.llm, prompt)
        if result is not None:
            return result

        for fallback_name, fallback_llm in self._fallback_llms:
            logger.info(f"Falling back to model: {fallback_name}")
            result = self._invoke_with_retry(fallback_llm, prompt)
            if result is not None:
                return result

        raise RuntimeError(f"LLM invocation failed after all retries and fallbacks")

    def _prompt_for(self, kind: str = "qa", **kwargs) -> str:
        """Select and format the appropriate prompt template."""
        if kind == "qa" or not kwargs.get("history"):
            template = _QA_TEMPLATE
        elif kind in ("qa_memory",):
            template = _MEMORY_QA_TEMPLATE
        else:
            template = _QA_TEMPLATE
        return template.format(**kwargs)

    def stream_answer(self, context: str, question: str, history: str = ""):
        """Stream answer tokens as a generator — used by /api/query/stream.

        Args:
            context: Retrieved document chunks joined by separators.
            question: The user's question.
            history: Recent conversation history as formatted text (optional).

        Uses fallback model on failure; only retries from scratch if nothing
        was yielded yet (avoids duplicating content mid-stream).
        """
        prompt = self._prompt_for(
            kind="qa_memory" if history else "qa",
            history=history,
            context=context,
            question=question,
        )

        llms_to_try = [(self.model_name, self.llm)] + self._fallback_llms

        for model_name, llm in llms_to_try:
            yielded_any = False
            try:
                for chunk in llm.stream(prompt):
                    content = chunk.content
                    if isinstance(content, list):
                        content = "".join(
                            p.get("text", "") if isinstance(p, dict) else str(p)
                            for p in content
                        )
                    if content:
                        yielded_any = True
                        yield content
                return  # Success — exit generator
            except Exception as e:
                logger.warning(f"Streaming failed on {model_name}: {e}")
                if yielded_any:
                    # Can't cleanly retry mid-stream without duplicating content already sent.
                    yield "\n\n[Response interrupted by an error. Please retry your question.]"
                    return
                # nothing sent yet — safe to fall through and try the next model
                continue

        yield (
            "I could not generate a response because every configured LLM model failed. "
            "Check that GEMINI_MODEL and LLM_FALLBACK_MODEL in .env are available for "
            "your API key, then restart the backend."
        )

    def generate_answer(self, context: str, question: str, history: str = "") -> str:
        """Generate an answer grounded in the retrieved context.

        Args:
            context: Retrieved document chunks joined by separators.
            question: The user's question.
            history: Recent conversation history as formatted text (optional).

        When ``history`` is non-empty the memory-aware prompt is used so the
        model can reference earlier exchanges.
        """
        try:
            prompt = self._prompt_for(
                kind="qa_memory" if history else "qa",
                history=history,
                context=context,
                question=question,
            )
            answer = self._invoke(prompt)
            logger.info(f"Generated answer for: {question[:50]}...")
            return answer
        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            raise

    def summarize(self, text: str) -> str:
        """Return a structured research summary."""
        try:
            prompt = _SUMMARIZE_TEMPLATE.format(text=text)
            return self._invoke(prompt)
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            raise

# """LLM integration and response generation — supports OpenAI and Gemini.

# Features:
# - Retry logic for transient failures
# - Configurable request timeout
# - Fallback model support
# """

# import asyncio
# import time
# from langchain_core.prompts import PromptTemplate
# from src.config import (
#     OPENAI_API_KEY, OPENAI_MODEL,
#     GEMINI_API_KEY, GEMINI_MODEL,
#     LLM_PROVIDER, LLM_FALLBACK_MODEL,
# )
# from loguru import logger

# _QA_TEMPLATE = PromptTemplate(
#     input_variables=["context", "question"],
#     template="""You are an AI research paper assistant.

# Answer ONLY using the retrieved context below.

# Guidelines:
# - Read ALL retrieved chunks before answering.
# - If the question has multiple parts (e.g., methodology + results), answer each part separately with its own heading.
# - Never say information is unavailable unless you have checked all retrieved context.
# - Preserve exact terminology from the paper (BLEU Score, METEOR Score, Top-1 Accuracy, F1 Score, etc.).
# - If the user asks for "accuracy" but the paper reports different metrics, say: "The paper does not report classification accuracy. Instead it reports:" then list them.
# - Distinguish clearly between: Methodology / Model Architecture / Training Strategy / Implementation Details / Experimental Results. Do not mix them.
# - Include EVERY numerical metric in the retrieved context — do not omit values.
# - For benchmark comparisons, separately report: overall evaluation metrics, then baseline comparisons.
# - Structure answers with headings and bullet points.
# - If part of the question cannot be answered from context, state exactly what is missing rather than saying "no information exists."
# - Do not hallucinate. If a value is not in the context, say: "The retrieved context does not provide this information."
# - Implementation details (software stack, libraries, language, deployment) belong under Implementation, NOT Methodology.
# - When looking for results, prioritize chunks whose headings contain: Results, Evaluation, Performance, Experiments, Benchmarks, Metrics.
# - Do not compress or summarize away numerical values — report every number explicitly.
# - When explaining a section (e.g., Methodology), cover EVERY subsection under that heading — do not stop after the first one.
# - For Methodology sections, always include: Overview, Data Collection/Preprocessing, Model Design/Architecture, Training Strategy, and Deployment if present.
# - If a subsection contains architecture details or hyperparameters (layers, heads, optimizer, dropout, learning rate, steps), include all of them.
# - Prefer completeness over brevity — do not omit later subsections because the answer is already long.
# - Preserve the paper's original section hierarchy when structuring answers.
# - Never compress or skip subsections to shorten the response.
# - If a heading appears in the context but the content under it is thin, say what IS present rather than calling the section unavailable.
# - Do NOT label "Software Stack" or "Implementation" content as Methodology — keep them under their correct section.

# Context:
# {context}

# Question: {question}

# Answer:""",
# )

# _MEMORY_QA_TEMPLATE = PromptTemplate(
#     input_variables=["history", "context", "question"],
#     template="""You are an AI research paper assistant in an ongoing conversation.

# Answer ONLY using the retrieved context below. Use conversation history only to resolve pronouns or references (e.g., "it", "this model").

# Guidelines:
# - Read ALL retrieved chunks before answering.
# - If the question has multiple parts, answer each with its own heading.
# - Preserve exact metric names and values from the paper.
# - Include EVERY numerical metric — do not omit values.
# - Distinguish: Methodology / Architecture / Training / Implementation / Results.
# - Do not hallucinate. Missing information → say so explicitly.
# - Structure with headings and bullet points.
# - When explaining a section (e.g., Methodology), cover EVERY subsection under that heading — do not stop after the first one.
# - For Methodology sections, always include: Overview, Data Collection/Preprocessing, Model Design/Architecture, Training Strategy, and Deployment if present.
# - If a subsection contains architecture details or hyperparameters (layers, heads, optimizer, dropout, learning rate, steps), include all of them.
# - Prefer completeness over brevity — do not omit later subsections because the answer is already long.
# - Preserve the paper's original section hierarchy when structuring answers.
# - Never compress or skip subsections to shorten the response.
# - If a heading appears in the context but the content under it is thin, say what IS present rather than calling the section unavailable.
# - Do NOT label "Software Stack" or "Implementation" content as Methodology — keep them under their correct section.

# Conversation History:
# {history}

# Retrieved Context:
# {context}

# Question: {question}

# Answer:""",
# )

# _SUMMARIZE_TEMPLATE = PromptTemplate(
#     input_variables=["text"],
#     template="""You are an expert research paper summarizer.
# Your task is to generate a concise, accurate, and well-structured summary using ONLY the retrieved context provided below.

# Instructions:
# - Do NOT use outside knowledge or make assumptions.
# - If a detail is not present in the retrieved context, do not invent it.
# - Keep the summary between 150 and 200 words.
# - Write in clear, professional language.

# Your summary should include:
# 1. The problem or motivation behind the work.
# 2. The proposed solution or methodology.
# 3. Important implementation details (if available).
# 4. Key results, including numerical metrics such as accuracy, F1-score, FPS, etc.
# 5. Limitations or error analysis.
# 6. Future work.
# 7. The overall conclusion.

# Return only the summary as a single paragraph.

# Context:
# {text}

# Summary:""",
# )

# # Retry configuration
# _MAX_RETRIES = 3
# _RETRY_DELAY = 1.0  # seconds
# _REQUEST_TIMEOUT = 60.0  # seconds
# _GEMINI_FALLBACK_MODELS = (
#     "gemini-3.5-flash",
#     "gemini-3.5-flash-lite",
#     "gemini-3.1-flash-lite",
#     "gemini-flash-latest",
# )


# class LLMManager:
#     """Manages LLM interactions for OpenAI and Gemini providers.

#     Features:
#     - Retry logic with exponential backoff for transient failures
#     - Configurable request timeout
#     - Fallback model support when primary model fails
#     """

#     def __init__(self, model: str | None = None, temperature: float = 0.7,
#                  max_retries: int = _MAX_RETRIES, request_timeout: float = _REQUEST_TIMEOUT):
#         self.temperature = temperature
#         self.provider = LLM_PROVIDER
#         self.max_retries = max_retries
#         self.request_timeout = request_timeout
#         self.fallback_model_name: str | None = None
#         self._fallback_llm = None
#         self._fallback_llms: list[tuple[str, object]] = []

#         self.model_name = model or (OPENAI_MODEL if self.provider == "openai" else GEMINI_MODEL)
#         self.llm = self._build_llm(self.model_name)
#         self._configure_default_fallbacks()
#         logger.info(
#             f"Initialized {self.provider.upper()} LLM: {self.model_name} "
#             f"(temperature={temperature}, timeout={request_timeout}s, "
#             f"max_retries={max_retries})"
#         )

#     def _build_llm(self, model_name: str):
#         """Build a langchain LLM instance for the given model name."""
#         if self.provider == "openai":
#             from langchain_openai import ChatOpenAI
#             return ChatOpenAI(
#                 api_key=OPENAI_API_KEY,
#                 model=model_name,
#                 temperature=self.temperature,
#                 timeout=self.request_timeout,
#                 max_retries=self.max_retries,
#             )
#         elif self.provider == "gemini":
#             from langchain_google_genai import ChatGoogleGenerativeAI
#             kwargs = {
#                 "google_api_key": GEMINI_API_KEY,
#                 "model": model_name,
#                 "max_output_tokens": 16384,
#             }
#             if not model_name.startswith("gemini-3") and model_name != "gemini-flash-latest":
#                 kwargs["temperature"] = self.temperature
#             return ChatGoogleGenerativeAI(
#                 **kwargs,
#             )
#         raise ValueError(f"Invalid LLM provider: {self.provider}")

#     def _configure_default_fallbacks(self) -> None:
#         """Configure built-in fallbacks for common model retirement/access errors."""
#         candidates: list[str] = []
#         if LLM_FALLBACK_MODEL:
#             candidates.append(LLM_FALLBACK_MODEL)
#         if self.provider == "gemini":
#             candidates.extend(_GEMINI_FALLBACK_MODELS)

#         for candidate in candidates:
#             if candidate and candidate != self.model_name:
#                 self._add_fallback_model(candidate)

#     def _add_fallback_model(self, model_name: str) -> None:
#         if any(existing == model_name for existing, _ in self._fallback_llms):
#             return
#         try:
#             fallback_llm = self._build_llm(model_name)
#             self._fallback_llms.append((model_name, fallback_llm))
#             if self._fallback_llm is None:
#                 self.fallback_model_name = model_name
#                 self._fallback_llm = fallback_llm
#             logger.info(f"Fallback LLM configured: {model_name}")
#         except Exception as e:
#             logger.warning(f"Failed to initialize fallback model '{model_name}': {e}")

#     def set_fallback_model(self, model_name: str) -> None:
#         """Configure a fallback model to use when the primary model fails."""
#         self._add_fallback_model(model_name)

#     def _invoke_with_retry(self, llm, prompt: str, is_stream: bool = False) -> str | None:
#         """Invoke the LLM with retry logic.

#         Returns None if all retries fail.
#         """
#         last_error = None
#         for attempt in range(1, self.max_retries + 1):
#             try:
#                 if is_stream:
#                     # For streaming, just invoke directly
#                     response = llm.invoke(prompt)
#                 else:
#                     response = llm.invoke(prompt)
#                 content = response.content
#                 if isinstance(content, list):
#                     content = " ".join(
#                         part.get("text", "") if isinstance(part, dict) else str(part)
#                         for part in content
#                     )
#                 return content.strip()
#             except Exception as e:
#                 last_error = e
#                 if attempt < self.max_retries:
#                     delay = _RETRY_DELAY * (2 ** (attempt - 1))
#                     logger.warning(
#                         f"LLM call failed (attempt {attempt}/{self.max_retries}), "
#                         f"retrying in {delay:.1f}s: {e}"
#                     )
#                     time.sleep(delay)
#                 else:
#                     logger.error(f"LLM call failed after {self.max_retries} attempts: {e}")
#         return None

#     def _invoke(self, prompt: str) -> str:
#         """Invoke the LLM with retry and optional fallback."""
#         result = self._invoke_with_retry(self.llm, prompt)
#         if result is not None:
#             return result

#         for fallback_name, fallback_llm in self._fallback_llms:
#             logger.info(f"Falling back to model: {fallback_name}")
#             result = self._invoke_with_retry(fallback_llm, prompt)
#             if result is not None:
#                 return result

#         raise RuntimeError(f"LLM invocation failed after all retries and fallbacks")

#     def _prompt_for(self, kind: str = "qa", **kwargs) -> str:
#         """Select and format the appropriate prompt template."""
#         if kind == "qa" or not kwargs.get("history"):
#             template = _QA_TEMPLATE
#         elif kind in ("qa_memory",):
#             template = _MEMORY_QA_TEMPLATE
#         else:
#             template = _QA_TEMPLATE
#         return template.format(**kwargs)

#     def stream_answer(self, context: str, question: str, history: str = ""):
#         """Stream answer tokens as a generator — used by /api/query/stream.

#         Args:
#             context: Retrieved document chunks joined by separators.
#             question: The user's question.
#             history: Recent conversation history as formatted text (optional).

#         Uses fallback model on failure; only retries from scratch if nothing
#         was yielded yet (avoids duplicating content mid-stream).
#         """
#         prompt = self._prompt_for(
#             kind="qa_memory" if history else "qa",
#             history=history,
#             context=context,
#             question=question,
#         )

#         llms_to_try = [(self.model_name, self.llm)] + self._fallback_llms

#         for model_name, llm in llms_to_try:
#             yielded_any = False
#             try:
#                 for chunk in llm.stream(prompt):
#                     content = chunk.content
#                     if isinstance(content, list):
#                         content = "".join(
#                             p.get("text", "") if isinstance(p, dict) else str(p)
#                             for p in content
#                         )
#                     if content:
#                         yielded_any = True
#                         yield content
#                 return  # Success — exit generator
#             except Exception as e:
#                 logger.warning(f"Streaming failed on {model_name}: {e}")
#                 if yielded_any:
#                     # Can't cleanly retry mid-stream without duplicating content already sent.
#                     yield "\n\n[Response interrupted by an error. Please retry your question.]"
#                     return
#                 # nothing sent yet — safe to fall through and try the next model
#                 continue

#         yield (
#             "I could not generate a response because every configured LLM model failed. "
#             "Check that GEMINI_MODEL and LLM_FALLBACK_MODEL in .env are available for "
#             "your API key, then restart the backend."
#         )

#     def generate_answer(self, context: str, question: str, history: str = "") -> str:
#         """Generate an answer grounded in the retrieved context.

#         Args:
#             context: Retrieved document chunks joined by separators.
#             question: The user's question.
#             history: Recent conversation history as formatted text (optional).

#         When ``history`` is non-empty the memory-aware prompt is used so the
#         model can reference earlier exchanges.
#         """
#         try:
#             prompt = self._prompt_for(
#                 kind="qa_memory" if history else "qa",
#                 history=history,
#                 context=context,
#                 question=question,
#             )
#             answer = self._invoke(prompt)
#             logger.info(f"Generated answer for: {question[:50]}...")
#             return answer
#         except Exception as e:
#             logger.error(f"Error generating answer: {e}")
#             raise

#     def summarize(self, text: str) -> str:
#         """Return a structured research summary."""
#         try:
#             prompt = _SUMMARIZE_TEMPLATE.format(text=text)
#             return self._invoke(prompt)
#         except Exception as e:
#             logger.error(f"Error summarizing text: {e}")
#             raise
