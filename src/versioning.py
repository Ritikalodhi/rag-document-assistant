"""Document versioning — detects re-uploads, keeps versions, compares diffs."""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any
from loguru import logger
from filelock import FileLock
from src import config


class DocumentVersionStore:
    """Tracks multiple versions of the same document (by filename)."""

    def __init__(self, filename: str = "doc_versions.json"):
        self.path = config.DATA_DIR / filename
        self._lock = FileLock(str(self.path) + ".lock")
        if not self.path.exists():
            self._write({})

    def _read(self) -> dict:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def _write(self, data: dict) -> None:
        tmp = self.path.with_suffix(".tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            tmp.replace(self.path)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise

    def _content_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def check_duplicate(self, user_id: str, filename: str, full_text: str) -> bool:
        """Return True if the content hash matches the latest version."""
        versions = self.get_versions(user_id, filename)
        if not versions:
            return False
        return versions[-1]["content_hash"] == self._content_hash(full_text)

    def check_and_register(
        self, user_id: str, filename: str, full_text: str, doc_id: str
    ) -> dict[str, Any]:
        """Check if this document is a re-upload. Register the new version.

        Returns:
            {
                "is_new": bool,          # True = first upload
                "version": int,          # version number (1-based)
                "previous_version": dict | None,
                "content_changed": bool,
            }
        """
        with self._lock:
            data = self._read()
            key = f"{user_id}:{filename}"
            content_hash = self._content_hash(full_text)

            versions = data.get(key, [])
            is_new = len(versions) == 0
            content_changed = True

            if versions:
                last = versions[-1]
                content_changed = last["content_hash"] != content_hash

            version_entry = {
                "version": len(versions) + 1,
                "doc_id": doc_id,
                "content_hash": content_hash,
                "char_count": len(full_text),
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }
            versions.append(version_entry)
            data[key] = versions
            self._write(data)

        return {
            "is_new": is_new,
            "version": version_entry["version"],
            "previous_version": versions[-2] if len(versions) >= 2 else None,
            "content_changed": content_changed,
        }

    def get_versions(self, user_id: str, filename: str) -> list[dict]:
        with self._lock:
            data = self._read()
            return data.get(f"{user_id}:{filename}", [])

    def compare_versions(self, user_id: str, filename: str, v1: int, v2: int) -> dict:
        """Return a simple diff summary between two versions."""
        versions = self.get_versions(user_id, filename)
        ver1 = next((v for v in versions if v["version"] == v1), None)
        ver2 = next((v for v in versions if v["version"] == v2), None)

        if not ver1 or not ver2:
            return {"success": False, "error": "Version not found."}

        char_diff = ver2["char_count"] - ver1["char_count"]
        return {
            "success": True,
            "filename": filename,
            "version_a": ver1,
            "version_b": ver2,
            "char_count_diff": char_diff,
            "content_changed": ver1["content_hash"] != ver2["content_hash"],
            "summary": (
                f"Version {v2} has {abs(char_diff)} {'more' if char_diff > 0 else 'fewer'} characters than v{v1}."
                if char_diff != 0 else f"Versions {v1} and {v2} have identical content."
            ),
        }
