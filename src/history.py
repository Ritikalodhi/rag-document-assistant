"""Conversation history manager backed by a JSON file.

Multi-tenant: every entry carries a ``user_id`` field and every query
filters by it.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any
from loguru import logger
from filelock import FileLock

from src import config


class ConversationManager:
    """Persist Q&A history to a JSON file, scoped by user_id."""

    def __init__(self, filename: str = "conversations.json"):
        self.path = config.DATA_DIR / filename
        self._lock = FileLock(str(self.path) + ".lock")
        if not self.path.exists():
            self._write([])

    def _read(self) -> list[dict[str, Any]]:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Corrupt conversation history at {self.path}: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to read conversation history: {e}")
            raise

    def _write(self, data: list[dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            tmp.replace(self.path)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise

    def add_entry(self, user_id: str, question: str, answer: str, context: list[dict[str, Any]]) -> dict[str, Any]:
        with self._lock:
            entry: dict[str, Any] = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "question": question,
                "answer": answer,
                "context": context,
            }
            data = self._read()
            data.insert(0, entry)
            self._write(data)
        return entry

    def get_history(self, user_id: str | None = None, limit: int | None = None) -> list[dict[str, Any]]:
        """Get conversation history. If user_id provided, scoped to that user."""
        with self._lock:
            data = self._read()
            if user_id is not None:
                data = [e for e in data if e.get("user_id") == user_id]
            return data if limit is None else data[:limit]

    def delete_entry(self, entry_id: str, user_id: str | None = None) -> bool:
        """Delete a single conversation entry by id.

        If user_id is provided, only deletes if the entry belongs to that user.
        """
        with self._lock:
            data = self._read()
            filtered = [
                e for e in data
                if not (e.get("id") == entry_id and (user_id is None or e.get("user_id") == user_id))
            ]
            if len(filtered) == len(data):
                return False
            self._write(filtered)
        return True

    def clear_history(self, user_id: str | None = None) -> None:
        """Clear history. If user_id provided, only clears that user's entries."""
        with self._lock:
            if user_id is None:
                self._write([])
                return
            data = self._read()
            data = [e for e in data if e.get("user_id") != user_id]
            self._write(data)
