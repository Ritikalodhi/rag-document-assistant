"""Structured document summarization (summary, key topics, takeaways, entities)."""

import json
import re
from langchain_core.prompts import PromptTemplate
from loguru import logger

_SUMMARY_TEMPLATE = PromptTemplate(
    input_variables=["text"],
    template="""Analyze the following document and respond with ONLY a JSON object \
(no markdown fences, no preamble) in this exact shape:

{{
  "executive_summary": "2-3 sentence overview",
  "key_topics": ["topic1", "topic2", ...],
  "key_takeaways": ["takeaway1", "takeaway2", ...],
  "important_entities": ["entity1 (type)", "entity2 (type)", ...]
}}

Document:
{text}

JSON:""",
)


class DocumentSummarizer:
    """Generates structured summaries using the configured LLM."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def summarize_document(self, text: str, max_chars: int = 12000) -> dict:
        """Return a structured summary dict for the given document text.

        Truncates very long documents to keep the prompt within token limits —
        good enough for an exec summary without needing map-reduce.
        """
        excerpt = text[:max_chars]
        prompt = _SUMMARY_TEMPLATE.format(text=excerpt)

        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned)
            return {
                "executive_summary": data.get("executive_summary", ""),
                "key_topics": data.get("key_topics", []),
                "key_takeaways": data.get("key_takeaways", []),
                "important_entities": data.get("important_entities", []),
            }
        except json.JSONDecodeError as e:
            logger.error(f"Summary JSON parse failed: {e}. Raw: {raw[:200]}")
            return {
                "executive_summary": raw.strip() if "raw" in dir() else "Summary unavailable.",
                "key_topics": [],
                "key_takeaways": [],
                "important_entities": [],
            }
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise