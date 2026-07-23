"""Per-document metadata store (filenames, full text, summaries) backed by JSON.

Separate from ConversationManager (which stores Q&A history) and from Chroma
(which stores embedded chunks, not full documents or summaries).

Multi-tenant: every record carries a ``user_id`` field and every query
filters by it.

Concurrent-safe: uses ``filelock`` for cross-process locking around
read-modify-write sequences.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from loguru import logger
from filelock import FileLock

from src import config


class DocumentStore:
    """Tracks one record per uploaded document: id, user_id, filename, full text, summary."""

    def __init__(self, filename: str = "documents.json"):
        self.path = config.DATA_DIR / filename
        self._lock = FileLock(str(self.path) + ".lock")
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

    def add(self, user_id: str, filename: str, file_path: str, full_text: str, chunk_count: int) -> str:
        """Register a newly uploaded document and return its doc_id."""
        with self._lock:
            doc_id = str(uuid.uuid4())
            data = self._read()
            data[doc_id] = {
                "doc_id": doc_id,
                "user_id": user_id,
                "filename": filename,
                "file_path": file_path,
                "full_text": full_text,
                "chunk_count": chunk_count,
                "summary": None,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
            self._write(data)
        return doc_id

    def get(self, doc_id: str, user_id: str | None = None) -> Optional[dict[str, Any]]:
        """Return a document if it exists and (if user_id provided) belongs to that user."""
        with self._lock:
            data = self._read()
            doc = data.get(doc_id)
            if doc is None:
                return None
            if user_id is not None and doc.get("user_id") != user_id:
                return None  # Don't leak existence across tenants
            return doc

    def get_by_filename(self, filename: str, user_id: str | None = None) -> Optional[dict[str, Any]]:
        """Find the most recently uploaded document matching a filename and user."""
        with self._lock:
            matches = [
                d for d in self._read().values()
                if d["filename"] == filename and (user_id is None or d.get("user_id") == user_id)
            ]
            if not matches:
                return None
            return max(matches, key=lambda d: d["uploaded_at"])

    def set_summary(self, doc_id: str, summary: dict) -> None:
        with self._lock:
            data = self._read()
            if doc_id in data:
                data[doc_id]["summary"] = summary
                self._write(data)

    def list_summaries(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """List all documents for a user WITHOUT full_text (keeps the response light)."""
        with self._lock:
            data = self._read()
            all_docs = list(data.values())
            if user_id is not None:
                all_docs = [d for d in all_docs if d.get("user_id") == user_id]
            return [
                {k: v for k, v in doc.items() if k != "full_text"}
                for doc in sorted(all_docs, key=lambda d: d["uploaded_at"], reverse=True)
            ]

    def delete(self, doc_id: str, user_id: str | None = None) -> bool:
        """Delete a document. If user_id is provided, only deletes if it belongs to that user."""
        with self._lock:
            data = self._read()
            if doc_id in data:
                if user_id is not None and data[doc_id].get("user_id") != user_id:
                    return False  # Don't leak existence
                del data[doc_id]
                self._write(data)
                return True
            return False