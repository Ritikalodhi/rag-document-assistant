"""Cross-Document Intelligence — finds concepts shared across multiple documents."""

import json
import re
from langchain_core.prompts import PromptTemplate
from loguru import logger

_EXTRACT_TEMPLATE = PromptTemplate(
    input_variables=["filename", "text"],
    template="""Extract the 15 most important concepts from this document.
Respond with ONLY a JSON array of short concept strings (no markdown, no preamble).
Example: ["machine learning", "neural networks", "gradient descent"]

Document ({filename}):
{text}

JSON array:""",
)

_CROSS_TEMPLATE = PromptTemplate(
    input_variables=["docs_concepts"],
    template="""Given these documents and their key concepts, identify concepts that \
appear (or are closely related) across multiple documents.

{docs_concepts}

Respond with ONLY a JSON array (no markdown, no preamble) in this shape:
[
  {{
    "concept": "concept name",
    "found_in": ["filename1", "filename2", ...],
    "relevance": "one sentence explaining the connection"
  }}
]

Only include concepts found in 2 or more documents. JSON:""",
)


class CrossDocumentIntelligence:
    """Finds concepts and themes shared across multiple uploaded documents."""

    def __init__(self, llm_manager):
        self.llm_manager = llm_manager

    def _extract_concepts(self, filename: str, text: str, max_chars: int = 6000) -> list[str]:
        prompt = _EXTRACT_TEMPLATE.format(filename=filename, text=text[:max_chars])
        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            concepts = json.loads(cleaned)
            return [str(c) for c in concepts] if isinstance(concepts, list) else []
        except Exception as e:
            logger.error(f"Concept extraction failed for {filename}: {e}")
            return []

    def find_cross_concepts(self, documents: list[dict]) -> dict:
        """Find shared concepts across documents.

        Args:
            documents: list of {"filename": str, "full_text": str}

        Returns:
            {"shared_concepts": [...], "document_count": n}
        """
        if len(documents) < 2:
            return {
                "success": False,
                "error": "Need at least 2 documents for cross-document analysis.",
            }

        # Step 1: extract concepts per document
        doc_concepts = {}
        for doc in documents:
            concepts = self._extract_concepts(doc["filename"], doc["full_text"])
            doc_concepts[doc["filename"]] = concepts
            logger.info(f"Extracted {len(concepts)} concepts from {doc['filename']}")

        # Step 2: ask LLM to find cross-document concepts
        docs_summary = "\n\n".join(
            f"Document: {fname}\nConcepts: {', '.join(concepts)}"
            for fname, concepts in doc_concepts.items()
        )
        prompt = _CROSS_TEMPLATE.format(docs_concepts=docs_summary)

        try:
            raw = self.llm_manager._invoke(prompt)
            cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
            shared = json.loads(cleaned)
            if not isinstance(shared, list):
                shared = []
            # Sort by number of documents the concept appears in
            shared.sort(key=lambda x: len(x.get("found_in", [])), reverse=True)
            return {
                "success": True,
                "document_count": len(documents),
                "shared_concepts": shared,
                "per_document_concepts": doc_concepts,
            }
        except json.JSONDecodeError as e:
            logger.error(f"Cross-document JSON parse failed: {e}")
            raise ValueError(f"Failed to parse cross-document analysis: {e}")
        except Exception as e:
            logger.error(f"Error in cross-document analysis: {e}")
            raise