
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
    input_variables=["text", "max_length"],
    template="""Summarize the following text in approximately {max_length} words:
 
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
 
    def summarize(self, text: str, max_length: int = 150) -> str:
        """Return a short summary of the provided text."""
        try:
            prompt = _SUMMARIZE_TEMPLATE.format(text=text, max_length=max_length)
            return self._invoke(prompt)
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            raise


