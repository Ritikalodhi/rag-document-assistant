"""Per-document metadata store (filenames, full text, summaries) backed by JSON.

Separate from ConversationManager (which stores Q&A history) and from Chroma
(which stores embedded chunks, not full documents or summaries).
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from loguru import logger

from src.config import DATA_DIR


class DocumentStore:
    """Tracks one record per uploaded document: id, filename, full text, summary."""

    def __init__(self, filename: str = "documents.json"):
        self.path = DATA_DIR / filename
        if not self.path.exists():
            self._write({})

    def _read(self) -> dict[str, dict[str, Any]]:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Corrupt document store at {self.path}: {e}")
            raise

    def _write(self, data: dict[str, dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            tmp.replace(self.path)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise

    def add(self, filename: str, file_path: str, full_text: str, chunk_count: int) -> str:
        """Register a newly uploaded document and return its doc_id."""
        doc_id = str(uuid.uuid4())
        data = self._read()
        data[doc_id] = {
            "doc_id": doc_id,
            "filename": filename,
            "file_path": file_path,
            "full_text": full_text,
            "chunk_count": chunk_count,
            "summary": None,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        self._write(data)
        return doc_id

    def get(self, doc_id: str) -> Optional[dict[str, Any]]:
        return self._read().get(doc_id)

    def get_by_filename(self, filename: str) -> Optional[dict[str, Any]]:
        """Find the most recently uploaded document matching a filename."""
        matches = [d for d in self._read().values() if d["filename"] == filename]
        if not matches:
            return None
        return max(matches, key=lambda d: d["uploaded_at"])

    def set_summary(self, doc_id: str, summary: dict) -> None:
        data = self._read()
        if doc_id in data:
            data[doc_id]["summary"] = summary
            self._write(data)

    def list_summaries(self) -> list[dict[str, Any]]:
        """List all documents WITHOUT full_text (keeps the response light)."""
        data = self._read()
        return [
            {k: v for k, v in doc.items() if k != "full_text"}
            for doc in sorted(data.values(), key=lambda d: d["uploaded_at"], reverse=True)
        ]

    def delete(self, doc_id: str) -> bool:
        data = self._read()
        if doc_id in data:
            del data[doc_id]
            self._write(data)
            return True
        return False