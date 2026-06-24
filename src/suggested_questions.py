"""AI-generated suggested questions for an uploaded document."""

import json
import re
from langchain_core.prompts import PromptTemplate
from loguru import logger

_SUGGEST_TEMPLATE = PromptTemplate(
    input_variables=["text"],
    template="""Based on the following document, suggest 5 useful questions a reader \
might want to ask. Respond with ONLY a JSON array of strings (no markdown fences, \
no preamble), e.g. ["question 1", "question 2", ...]

Document:
{text}

JSON array:""",
)


class QuestionSuggester:
    """Generates likely follow-up questions for a document."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def suggest(self, text: str, max_chars: int = 8000, count: int = 5) -> list[str]:
        """Return a list of suggested questions for the given document text."""
        prompt = _SUGGEST_TEMPLATE.format(text=text[:max_chars])

        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            questions = json.loads(cleaned)
            if isinstance(questions, list):
                return [str(q) for q in questions[:count]]
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Suggested questions JSON parse failed: {e}. Raw: {raw[:200]}")
            # Fallback: split raw text into lines as a best-effort recovery
            lines = [l.strip("- •\t ") for l in raw.splitlines() if l.strip()]
            return lines[:count]
        except Exception as e:
            logger.error(f"Error generating suggested questions: {e}")
            raise