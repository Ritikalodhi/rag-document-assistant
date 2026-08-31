"""Test multi-tenant isolation: user A's data must be invisible to user B.

These tests use the real DocumentStore, CollectionStore, ConversationManager,
and DocumentVersionStore with filelock, but mock the retriever and LLM to
avoid needing a real embedding model or LLM API key.
"""

from src.doc_store import DocumentStore
from src.doc_collections import CollectionStore
from src.history import ConversationManager
from src.versioning import DocumentVersionStore


def test_doc_store_isolation():
    """User A's documents must not be visible to user B."""
    store = DocumentStore()

    # User A adds a document
    doc_a_id = store.add(user_id="user_a", filename="a.pdf", file_path="/tmp/a.pdf",
                         full_text="User A content", chunk_count=5)

    # User B adds a document
    doc_b_id = store.add(user_id="user_b", filename="b.pdf", file_path="/tmp/b.pdf",
                         full_text="User B content", chunk_count=3)

    # User A can see their own doc
    assert store.get(doc_a_id, user_id="user_a") is not None
    # User A cannot see User B's doc
    assert store.get(doc_b_id, user_id="user_a") is None
    # User B cannot see User A's doc
    assert store.get(doc_a_id, user_id="user_b") is None
    # Without user_id filter, both are visible
    assert store.get(doc_a_id) is not None
    assert store.get(doc_b_id) is not None

    # list_summaries scoped to user
    assert len(store.list_summaries(user_id="user_a")) == 1
    assert len(store.list_summaries(user_id="user_b")) == 1
    assert len(store.list_summaries()) == 2

    # delete scoped to user
    assert store.delete(doc_a_id, user_id="user_b") is False  # can't delete other's doc
    assert store.get(doc_a_id, user_id="user_a") is not None  # still exists
    assert store.delete(doc_a_id, user_id="user_a") is True   # owner can delete
    assert store.get(doc_a_id, user_id="user_a") is None


def test_collection_isolation():
    """User A's collections must not be visible to user B."""
    store = CollectionStore()

    # User A creates a collection
    coll_a_id = store.create(user_id="user_a", name="A's Collection")
    # User B creates a collection
    coll_b_id = store.create(user_id="user_b", name="B's Collection")

    # Each user sees their own collection (plus the system "General")
    a_colls = store.list_all(user_id="user_a")
    b_colls = store.list_all(user_id="user_b")
    assert any(c["collection_id"] == coll_a_id for c in a_colls)
    assert not any(c["collection_id"] == coll_b_id for c in a_colls)
    assert any(c["collection_id"] == coll_b_id for c in b_colls)
    assert not any(c["collection_id"] == coll_a_id for c in b_colls)

    # get scoped to user
    assert store.get(coll_a_id, user_id="user_a") is not None
    assert store.get(coll_a_id, user_id="user_b") is None

    # rename scoped to user
    assert store.rename(coll_a_id, "New Name", user_id="user_b") is False
    assert store.rename(coll_a_id, "New Name", user_id="user_a") is True

    # delete scoped to user
    assert store.delete(coll_a_id, user_id="user_b") is False
    assert store.delete(coll_a_id, user_id="user_a") is True


def test_history_isolation():
    """User A's conversation history must not be visible to user B."""
    store = ConversationManager()

    store.add_entry(user_id="user_a", question="Q1", answer="A1", context=[])
    store.add_entry(user_id="user_b", question="Q2", answer="A2", context=[])

    a_history = store.get_history(user_id="user_a")
    b_history = store.get_history(user_id="user_b")

    assert len(a_history) == 1
    assert a_history[0]["question"] == "Q1"
    assert len(b_history) == 1
    assert b_history[0]["question"] == "Q2"

    # delete_entry scoped to user
    assert store.delete_entry(a_history[0]["id"], user_id="user_b") is False
    assert store.delete_entry(a_history[0]["id"], user_id="user_a") is True

    # clear_history scoped to user
    store.add_entry(user_id="user_a", question="Q3", answer="A3", context=[])
    store.add_entry(user_id="user_b", question="Q4", answer="A4", context=[])
    store.clear_history(user_id="user_a")
    assert len(store.get_history(user_id="user_a")) == 0
    # User B should still have both their entries (Q2 and Q4)
    assert len(store.get_history(user_id="user_b")) == 2
    assert store.get_history(user_id="user_b")[0]["question"] == "Q4"
    assert store.get_history(user_id="user_b")[1]["question"] == "Q2"


def test_versioning_isolation():
    """User A's document versions must not be visible to user B."""
    store = DocumentVersionStore()

    store.check_and_register(user_id="user_a", filename="doc.pdf", full_text="Version 1", doc_id="doc1")
    store.check_and_register(user_id="user_b", filename="doc.pdf", full_text="Version 1", doc_id="doc2")

    a_versions = store.get_versions("user_a", "doc.pdf")
    b_versions = store.get_versions("user_b", "doc.pdf")

    assert len(a_versions) == 1
    assert len(b_versions) == 1
    assert a_versions[0]["doc_id"] == "doc1"
    assert b_versions[0]["doc_id"] == "doc2"