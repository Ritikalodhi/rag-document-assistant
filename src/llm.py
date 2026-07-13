"""LLM integration and response generation — supports OpenAI and Gemini."""

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


class LLMManager:
    """Manages LLM interactions for OpenAI and Gemini providers."""

    def __init__(self, model: str | None = None, temperature: float = 0.7):
        self.temperature = temperature
        self.provider = LLM_PROVIDER

        if self.provider == "openai":
            from langchain_openai import ChatOpenAI
            self.model_name = model or OPENAI_MODEL
            self.llm = ChatOpenAI(
                api_key=OPENAI_API_KEY,
                model=self.model_name,
                temperature=temperature,
            )

        elif self.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            self.model_name = model or GEMINI_MODEL
            self.llm = ChatGoogleGenerativeAI(
                google_api_key=GEMINI_API_KEY,
                model=self.model_name,
                temperature=temperature,
                max_output_tokens=4096,
            )

        else:
            raise ValueError(f"Invalid LLM provider: {self.provider}")

        logger.info(
            f"Initialized {self.provider.upper()} LLM: {self.model_name} "
            f"(temperature={temperature})"
        )

    def _invoke(self, prompt: str) -> str:
        response = self.llm.invoke(prompt)
        content = response.content
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        return content.strip()

    def stream_answer(self, context: str, question: str):
        """Stream answer tokens as a generator — used by /api/query/stream."""
        prompt = _QA_TEMPLATE.format(context=context, question=question)
        try:
            for chunk in self.llm.stream(prompt):
                content = chunk.content
                if isinstance(content, list):
                    content = "".join(
                        p.get("text", "") if isinstance(p, dict) else str(p)
                        for p in content
                    )
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"[ERROR] {e}"

    def generate_answer(self, context: str, question: str) -> str:
        """Generate an answer grounded in the retrieved context."""
        try:
            prompt = _QA_TEMPLATE.format(context=context, question=question)
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
# """LLM integration and response generation — supports OpenAI and Gemini."""

# from langchain_core.prompts import PromptTemplate
# from src.config import (
#     OPENAI_API_KEY, OPENAI_MODEL,
#     GEMINI_API_KEY, GEMINI_MODEL,
#     LLM_PROVIDER,
# )
# from loguru import logger

# _QA_TEMPLATE = PromptTemplate(
#     input_variables=["context", "question"],
#     template="""Based on the following context, answer the question.

# Context:
# {context}

# Question: {question}

# Answer: Provide a clear, concise answer based only on the provided context. \
# If the answer cannot be found in the context, say \
# "I don't have enough information to answer this question." """,
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


# class LLMManager:
#     """Manages LLM interactions for OpenAI and Gemini providers."""

#     def __init__(self, model: str | None = None, temperature: float = 0.7):
#         self.temperature = temperature
#         self.provider = LLM_PROVIDER

#         if self.provider == "openai":
#             from langchain_openai import ChatOpenAI
#             self.model_name = model or OPENAI_MODEL
#             self.llm = ChatOpenAI(
#                 api_key=OPENAI_API_KEY,
#                 model=self.model_name,
#                 temperature=temperature,
#             )

#         elif self.provider == "gemini":
#             from langchain_google_genai import ChatGoogleGenerativeAI
#             self.model_name = model or GEMINI_MODEL
#             self.llm = ChatGoogleGenerativeAI(
#                 google_api_key=GEMINI_API_KEY,
#                 model=self.model_name,
#                 temperature=temperature,
#                 max_output_tokens=4096,
#             )

#         else:
#             raise ValueError(f"Invalid LLM provider: {self.provider}")

#         logger.info(
#             f"Initialized {self.provider.upper()} LLM: {self.model_name} "
#             f"(temperature={temperature})"
#         )

#     def _invoke(self, prompt: str) -> str:
#         response = self.llm.invoke(prompt)
#         content = response.content
#         if isinstance(content, list):
#             content = " ".join(
#                 part.get("text", "") if isinstance(part, dict) else str(part)
#                 for part in content
#             )
#         return content.strip()

#     def generate_answer(self, context: str, question: str) -> str:
#         """Generate an answer grounded in the retrieved context."""
#         try:
#             prompt = _QA_TEMPLATE.format(context=context, question=question)
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


