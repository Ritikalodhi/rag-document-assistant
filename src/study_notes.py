"""Auto Study Notes Generator — summary, key concepts, flashcards, viva Qs, MCQs."""

import json
import re
from langchain_core.prompts import PromptTemplate
from loguru import logger

_NOTES_TEMPLATE = PromptTemplate(
    input_variables=["text"],
    template="""Analyze the following document and respond with ONLY a JSON object \
(no markdown fences, no preamble) in this exact shape:

{{
  "summary": "concise 3-4 sentence overview",
  "key_concepts": [
    {{"concept": "name", "explanation": "one sentence"}}
  ],
  "flashcards": [
    {{"front": "question or term", "back": "answer or definition"}}
  ],
  "viva_questions": [
    {{"question": "question text", "answer": "expected answer"}}
  ],
  "mcqs": [
    {{
      "question": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A"
    }}
  ]
}}

Generate: 10 key concepts, 10 flashcards, 20 viva questions, 15 MCQs.

Document:
{text}

JSON:""",
)


class StudyNotesGenerator:
    """Generates structured study notes from document text."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def generate(self, text: str, max_chars: int = 12000) -> dict:
        prompt = _NOTES_TEMPLATE.format(text=text[:max_chars])
        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            data = json.loads(cleaned)
            return {
                "summary": data.get("summary", ""),
                "key_concepts": data.get("key_concepts", []),
                "flashcards": data.get("flashcards", []),
                "viva_questions": data.get("viva_questions", []),
                "mcqs": data.get("mcqs", []),
                "counts": {
                    "key_concepts": len(data.get("key_concepts", [])),
                    "flashcards": len(data.get("flashcards", [])),
                    "viva_questions": len(data.get("viva_questions", [])),
                    "mcqs": len(data.get("mcqs", [])),
                },
            }
        except json.JSONDecodeError as e:
            logger.error(f"Study notes JSON parse failed: {e}")
            raise ValueError(f"Failed to parse study notes: {e}")
        except Exception as e:
            logger.error(f"Error generating study notes: {e}")
            raise