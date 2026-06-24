"""Multi-document comparison (e.g. Resume vs Job Description)."""

import json
import re
from langchain_core.prompts import PromptTemplate
from loguru import logger

_COMPARE_TEMPLATE = PromptTemplate(
    input_variables=["name_a", "text_a", "name_b", "text_b"],
    template="""Compare the two documents below and respond with ONLY a JSON object \
(no markdown fences, no preamble) in this exact shape:

{{
  "matching_points": ["point1", "point2", ...],
  "missing_in_a": ["what B has that A lacks", ...],
  "missing_in_b": ["what A has that B lacks", ...],
  "recommendations": ["actionable suggestion1", "suggestion2", ...],
  "overall_match_percent": 0
}}

Document A ({name_a}):
{text_a}

Document B ({name_b}):
{text_b}

JSON:""",
)


class DocumentComparator:
    """Compares two documents for overlap, gaps, and recommendations."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def compare(
        self,
        name_a: str, text_a: str,
        name_b: str, text_b: str,
        max_chars: int = 8000,
    ) -> dict:
        """Return a structured comparison dict for two documents.

        Each document is truncated independently to stay within token limits.
        """
        prompt = _COMPARE_TEMPLATE.format(
            name_a=name_a, text_a=text_a[:max_chars],
            name_b=name_b, text_b=text_b[:max_chars],
        )

        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned)
            return {
                "matching_points": data.get("matching_points", []),
                "missing_in_a": data.get("missing_in_a", []),
                "missing_in_b": data.get("missing_in_b", []),
                "recommendations": data.get("recommendations", []),
                "overall_match_percent": data.get("overall_match_percent", 0),
            }
        except json.JSONDecodeError as e:
            logger.error(f"Comparison JSON parse failed: {e}. Raw: {raw[:200]}")
            return {
                "matching_points": [],
                "missing_in_a": [],
                "missing_in_b": [],
                "recommendations": [],
                "overall_match_percent": 0,
                "raw_response": raw,
            }
        except Exception as e:
            logger.error(f"Error comparing documents: {e}")
            raise