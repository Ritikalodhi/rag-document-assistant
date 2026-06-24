"""Collections (workspaces) for organizing documents into folders."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from loguru import logger

from src.config import DATA_DIR


class CollectionStore:
    """Tracks named collections, each holding a list of doc_ids."""

    def __init__(self, filename: str = "collections.json"):
        self.path = DATA_DIR / filename
        if not self.path.exists():
            self._seed_default()

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

    def _seed_default(self) -> None:
        """Create a default 'General' collection so uploads always have a home."""
        default_id = str(uuid.uuid4())
        data = {
            default_id: {
                "collection_id": default_id,
                "name": "General",
                "doc_ids": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        }
        self._write(data)

    def create(self, name: str) -> str:
        """Create a new collection and return its id."""
        collection_id = str(uuid.uuid4())
        data = self._read()
        data[collection_id] = {
            "collection_id": collection_id,
            "name": name,
            "doc_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._write(data)
        return collection_id

    def list_all(self) -> list[dict[str, Any]]:
        data = self._read()
        return sorted(data.values(), key=lambda c: c["created_at"])

    def get(self, collection_id: str) -> Optional[dict[str, Any]]:
        return self._read().get(collection_id)

    def get_default_id(self) -> str:
        """Return the id of the first ('General') collection."""
        collections = self.list_all()
        return collections[0]["collection_id"] if collections else self.create("General")

    def add_document(self, collection_id: str, doc_id: str) -> bool:
        data = self._read()
        if collection_id not in data:
            return False
        if doc_id not in data[collection_id]["doc_ids"]:
            data[collection_id]["doc_ids"].append(doc_id)
            self._write(data)
        return True

    def remove_document(self, collection_id: str, doc_id: str) -> bool:
        data = self._read()
        if collection_id not in data:
            return False
        if doc_id in data[collection_id]["doc_ids"]:
            data[collection_id]["doc_ids"].remove(doc_id)
            self._write(data)
        return True

    def delete(self, collection_id: str) -> bool:
        data = self._read()
        if collection_id in data:
            del data[collection_id]
            self._write(data)
            return True
        return False