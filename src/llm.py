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
    LLM_PROVIDER,
)
from loguru import logger

_QA_TEMPLATE = PromptTemplate(
    input_variables=["context", "question"],
    template="""Based on the following context, answer the question.

Context:
{context}

Question: {question}

Answer: Provide a clear, concise answer based only on the provided context. \
If the answer cannot be found in the context, say \
"I don't have enough information to answer this question." """,
)

_MEMORY_QA_TEMPLATE = PromptTemplate(
    input_variables=["history", "context", "question"],
    template="""You are having a conversation with the user. Use the conversation history and the retrieved context to answer the new question.

Conversation History:
{history}

Retrieved Context:
{context}

Question: {question}

Answer: Use the conversation history for context (e.g., pronouns like "it" or "they" refer to things mentioned earlier). \
Base your answer primarily on the retrieved context. If the answer cannot be found in the context, \
say "I don't have enough information to answer this question." """,
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

        self.model_name = model or (OPENAI_MODEL if self.provider == "openai" else GEMINI_MODEL)
        self.llm = self._build_llm(self.model_name)
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
            return ChatGoogleGenerativeAI(
                google_api_key=GEMINI_API_KEY,
                model=model_name,
                temperature=self.temperature,
                max_output_tokens=4096,
            )
        raise ValueError(f"Invalid LLM provider: {self.provider}")

    def set_fallback_model(self, model_name: str) -> None:
        """Configure a fallback model to use when the primary model fails."""
        self.fallback_model_name = model_name
        try:
            self._fallback_llm = self._build_llm(model_name)
            logger.info(f"Fallback LLM configured: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize fallback model '{model_name}': {e}")
            self._fallback_llm = None

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

        # Try fallback model if configured
        if self._fallback_llm is not None:
            logger.info(f"Falling back to model: {self.fallback_model_name}")
            result = self._invoke_with_retry(self._fallback_llm, prompt)
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
            history=history or "No prior conversation.",
            context=context,
            question=question,
        )

        llms_to_try = [self.llm] + ([self._fallback_llm] if self._fallback_llm else [])

        for llm in llms_to_try:
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
                logger.warning(f"Streaming failed on {getattr(llm, 'model_name', llm)}: {e}")
                if yielded_any:
                    # Can't cleanly retry mid-stream without duplicating content already sent.
                    yield "\n\n[Response interrupted by an error. Please retry your question.]"
                    return
                # nothing sent yet — safe to fall through and try the next model
                continue

        yield "[ERROR] All models failed to generate a response."

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
                history=history or "No prior conversation.",
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