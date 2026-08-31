"""Collections (workspaces) for organizing documents into folders.

Multi-tenant: every collection carries a ``user_id`` field and every query
filters by it.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from loguru import logger
from filelock import FileLock

from src import config


class CollectionStore:
    """Tracks named collections, each holding a list of doc_ids, scoped to a user."""

    def __init__(self, filename: str = "collections.json"):
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
            logger.error(f"Corrupt collection store at {self.path}: {e}")
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

    def create(self, user_id: str, name: str) -> str:
        """Create a new collection and return its id."""
        with self._lock:
            collection_id = str(uuid.uuid4())
            data = self._read()
            data[collection_id] = {
                "collection_id": collection_id,
                "user_id": user_id,
                "name": name,
                "doc_ids": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._write(data)
        return collection_id

    def list_all(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """List collections. If user_id is provided, scoped to that user only."""
        with self._lock:
            data = self._read()
            if user_id is not None:
                return sorted(
                    [c for c in data.values() if c.get("user_id") == user_id],
                    key=lambda c: c["created_at"],
                )
            return sorted(
                (dict(c) for c in data.values()),
                key=lambda c: c["created_at"],
            )

    def get(self, collection_id: str, user_id: str | None = None) -> Optional[dict[str, Any]]:
        """Return a collection. If user_id provided, only if it belongs to that user."""
        with self._lock:
            data = self._read()
            collection = data.get(collection_id)
            if collection is None:
                return None
            if user_id is not None and collection.get("user_id") != user_id:
                return None
            return collection

    def get_default_id(self, user_id: str) -> str:
        """Return the id of the user's 'General' collection, creating it if needed."""
        for c in self.list_all(user_id=user_id):
            if c["name"] == "General":
                return c["collection_id"]
        return self.create(user_id, "General")

    def add_document(self, collection_id: str, doc_id: str, user_id: str | None = None) -> bool:
        with self._lock:
            data = self._read()
            if collection_id not in data:
                return False
            if user_id is not None and data[collection_id].get("user_id") != user_id:
                return False
            if doc_id not in data[collection_id]["doc_ids"]:
                data[collection_id]["doc_ids"].append(doc_id)
                self._write(data)
        return True

    def remove_document(self, collection_id: str, doc_id: str, user_id: str | None = None) -> bool:
        with self._lock:
            data = self._read()
            if collection_id not in data:
                return False
            if user_id is not None and data[collection_id].get("user_id") != user_id:
                return False
            if doc_id in data[collection_id]["doc_ids"]:
                data[collection_id]["doc_ids"].remove(doc_id)
                self._write(data)
        return True

    def rename(self, collection_id: str, new_name: str, user_id: str | None = None) -> bool:
        with self._lock:
            data = self._read()
            if collection_id not in data:
                return False
            if user_id is not None and data[collection_id].get("user_id") != user_id:
                return False
            data[collection_id]["name"] = new_name
            self._write(data)
        return True

    def delete(self, collection_id: str, user_id: str | None = None) -> bool:
        with self._lock:
            data = self._read()
            if collection_id in data:
                if user_id is not None and data[collection_id].get("user_id") != user_id:
                    return False
                del data[collection_id]
                self._write(data)
                return True
        return False