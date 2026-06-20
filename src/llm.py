
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
            )
 
        else:
            raise ValueError(f"Invalid LLM provider: {self.provider}")
 
        logger.info(
            f"Initialized {self.provider.upper()} LLM: {self.model_name} "
            f"(temperature={temperature})"
        )
 
    def _invoke(self, prompt: str) -> str:
        """Call the LLM and return the text content."""
        response = self.llm.invoke(prompt)
        return response.content.strip()
 
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


# """LLM integration and response generation - supports both OpenAI and Gemini"""

# try:
#     from langchain_core.prompts import PromptTemplate
# except ImportError:
#     try:
#         from langchain.prompts import PromptTemplate
#     except ImportError:
#         # Fallback for very old versions
#         class PromptTemplate:
#             def __init__(self, input_variables, template):
#                 self.input_variables = input_variables
#                 self.template = template
#             def format(self, **kwargs):
#                 return self.template.format(**kwargs)

# from src.config import (
#     OPENAI_API_KEY, OPENAI_MODEL, 
#     GEMINI_API_KEY, GEMINI_MODEL,
#     LLM_PROVIDER
# )
# from loguru import logger


# class LLMManager:
#     """Manages LLM interactions - supports OpenAI and Gemini"""

#     def __init__(self, model: str = None, temperature: float = 0.7):
#         """Initialize LLM manager
        
#         Args:
#             model: LLM model to use (uses config default if None)
#             temperature: Temperature for response generation (0-1)
#         """
#         self.temperature = temperature
#         self.provider = LLM_PROVIDER
        
#         if self.provider == "openai":
#             try:
#                 from langchain_openai import ChatOpenAI
#             except ImportError:
#                 from langchain_community.chat_models import ChatOpenAI
#             self.model_name = model or OPENAI_MODEL
#             self.llm = ChatOpenAI(
#                 api_key=OPENAI_API_KEY,
#                 model=self.model_name,
#                 temperature=temperature
#             )
#             logger.info(f"Initialized OpenAI LLM: {self.model_name} (temperature={temperature})")
        
#         elif self.provider == "gemini":
#             from langchain_google_genai import ChatGoogleGenerativeAI
#             self.model_name = model or GEMINI_MODEL
#             self.llm = ChatGoogleGenerativeAI(
#                 api_key=GEMINI_API_KEY,
#                 model=self.model_name,
#                 temperature=temperature
#             )
#             logger.info(f"Initialized Gemini LLM: {self.model_name} (temperature={temperature})")
        
#         else:
#             raise ValueError(f"Invalid LLM provider: {self.provider}")

#     def generate_answer(self, context: str, question: str) -> str:
#         """Generate answer based on context and question
        
#         Args:
#             context: Retrieved context from documents
#             question: User's question
            
#         Returns:
#             Generated answer
#         """
#         prompt_template = PromptTemplate(
#             input_variables=["context", "question"],
#             template="""Based on the following context, answer the question.

# Context:
# {context}

# Question: {question}

# Answer: Provide a clear, concise answer based only on the provided context. If the answer is not in the context, say 'I don't have enough information to answer this question.'"""
#         )
        
#         try:
#             prompt = prompt_template.format(context=context, question=question)
#             # Try new API first, fallback to old API
#             try:
#                 response = self.llm.invoke(prompt)
#                 response = response.content if hasattr(response, 'content') else str(response)
#             except (AttributeError, TypeError):
#                 # Fallback for older langchain versions
#                 response = self.llm.predict(text=prompt)
            
#             logger.info(f"Generated answer for question: {question[:50]}...")
#             return response.strip()
#         except Exception as e:
#             logger.error(f"Error generating answer: {e}")
#             raise

#     def summarize(self, text: str, max_length: int = 150) -> str:
#         """Summarize text
        
#         Args:
#             text: Text to summarize
#             max_length: Maximum length of summary
            
#         Returns:
#             Summary
#         """
#         prompt_template = PromptTemplate(
#             input_variables=["text", "max_length"],
#             template="""Summarize the following text in approximately {max_length} words:

# {text}

# Summary:"""
#         )
        
#         try:
#             prompt = prompt_template.format(text=text, max_length=max_length)
#             # Try new API first, fallback to old API
#             try:
#                 response = self.llm.invoke(prompt)
#                 response = response.content if hasattr(response, 'content') else str(response)
#             except (AttributeError, TypeError):
#                 # Fallback for older langchain versions
#                 response = self.llm.predict(text=prompt)
            
#             return response.strip()
#         except Exception as e:
#             logger.error(f"Error summarizing text: {e}")
#             raise
