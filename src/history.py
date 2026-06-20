
"""Conversation history manager backed by a JSON file."""
 
import json
import uuid
from datetime import datetime, timezone
from typing import Any
from loguru import logger
 
from src.config import DATA_DIR
 
 
class ConversationManager:
    """Persist Q&A history to a JSON file."""
 
    def __init__(self, filename: str = "conversations.json"):
        self.path = DATA_DIR / filename
        if not self.path.exists():
            self._write([])
 
    # ── Internal I/O ─────────────────────────────────────────────────────────
 
    def _read(self) -> list[dict[str, Any]]:
        """Read history from disk.
 
        BUG FIX: original silently returned [] for *any* exception, including
        corrupt JSON — causing silent data loss on the next write.
        Now we only swallow FileNotFoundError; all other errors are logged and
        re-raised so callers know something is wrong.
        """
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
        """Write history to disk atomically (write-then-rename)."""
        tmp = self.path.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            tmp.replace(self.path)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise
 
    # ── Public API ────────────────────────────────────────────────────────────
 
    def add_entry(
        self,
        question: str,
        answer: str,
        context: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Prepend a new Q&A entry and persist it.
 
        BUG FIX: original used int(datetime.utcnow().timestamp() * 1000) as an
        ID, which collides if two requests land within 1 ms. Now uses uuid4.
 
        BUG FIX: datetime.utcnow() is deprecated in Python 3.12+.
        Now uses datetime.now(timezone.utc).
        """
        entry: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "question": question,
            "answer": answer,
            "context": context,
        }
        data = self._read()
        data.insert(0, entry)
        self._write(data)
        return entry
 
    def get_history(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Return recent history entries, newest first."""
        data = self._read()
        return data if limit is None else data[:limit]
 
    def clear_history(self) -> None:
        """Erase all stored history."""
        self._write([])

# """Simple conversation history manager backed by a JSON file"""

# from datetime import datetime
# import json
# from typing import List
# from src.config import DATA_DIR


# class ConversationManager:
#     """Manage conversation history persisted to a JSON file."""

#     def __init__(self, filename: str = "conversations.json"):
#         self.path = DATA_DIR / filename
#         # Ensure file exists
#         if not self.path.exists():
#             self._write([])

#     def _read(self) -> List[dict]:
#         try:
#             with open(self.path, "r", encoding="utf-8") as f:
#                 return json.load(f)
#         except Exception:
#             return []

#     def _write(self, data: List[dict]) -> None:
#         with open(self.path, "w", encoding="utf-8") as f:
#             json.dump(data, f, ensure_ascii=False, indent=2)

#     def add_entry(self, question: str, answer: str, context: List[dict]) -> dict:
#         entry = {
#             "id": int(datetime.utcnow().timestamp() * 1000),
#             "timestamp": datetime.utcnow().isoformat() + "Z",
#             "question": question,
#             "answer": answer,
#             "context": context,
#         }
#         data = self._read()
#         data.insert(0, entry)
#         self._write(data)
#         return entry

#     def get_history(self, limit: int | None = None) -> List[dict]:
#         data = self._read()
#         if limit is None:
#             return data
#         return data[:limit]

#     def clear_history(self) -> None:
#         self._write([])
