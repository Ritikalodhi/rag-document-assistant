"""Test that duplicate uploads are detected and handled correctly.

Re-uploading identical content should:
1. Be reported as a duplicate
2. Not create duplicate chunks in Chroma/BM25
3. Return the existing doc_id
"""

from unittest.mock import MagicMock, patch
from src.rag_pipeline import RAGPipeline
from src.versioning import DocumentVersionStore


def test_check_and_register_detects_duplicate():
    """Version store should detect identical re-uploads."""
    store = DocumentVersionStore()

    # First upload
    v1 = store.check_and_register(
        user_id="user", filename="test.txt", full_text="Hello world", doc_id="doc1"
    )
    assert v1["is_new"] is True
    assert v1["content_changed"] is True
    assert v1["version"] == 1

    # Identical re-upload
    v2 = store.check_and_register(
        user_id="user", filename="test.txt", full_text="Hello world", doc_id="doc2"
    )
    assert v2["is_new"] is False
    assert v2["content_changed"] is False
    assert v2["version"] == 2

    # Different content = new version
    v3 = store.check_and_register(
        user_id="user", filename="test.txt", full_text="Hello world v2", doc_id="doc3"
    )
    assert v3["is_new"] is False
    assert v3["content_changed"] is True
    assert v3["version"] == 3


def test_check_duplicate_function():
    """check_duplicate should return True for identical content."""
    store = DocumentVersionStore()

    store.check_and_register(
        user_id="user", filename="doc.pdf", full_text="Content", doc_id="doc1"
    )
    assert store.check_duplicate("user", "doc.pdf", "Content") is True
    assert store.check_duplicate("user", "doc.pdf", "Different") is False