"""Regression tests for user analytics (audit findings #9 and #25).

get_analytics() must count real query messages (not conversations), read
message-level timestamps and per-message context, and scope chunk counts to
the authenticated user.
"""

import json
from datetime import datetime, timedelta, timezone

from src.doc_collections import CollectionStore
from src.doc_store import DocumentStore
from src.history import ConversationManager
from src.rag_pipeline import RAGPipeline


class StubRetriever:
    """Deterministic per-user chunk counts for get_analytics tests."""

    def __init__(self, per_user=None):
        self.per_user = per_user or {}

    def get_user_chunk_counts(self, user_id: str) -> dict:
        return self.per_user.get(user_id, {"chroma_chunks": 0, "bm25_chunks": 0})


class StubLLMManager:
    provider = "gemini"
    model_name = "test-model"


def make_pipeline(per_user=None) -> RAGPipeline:
    pipe = RAGPipeline.__new__(RAGPipeline)
    pipe.history = ConversationManager()
    pipe.doc_store = DocumentStore()
    pipe.collection_store = CollectionStore()
    pipe.retriever = StubRetriever(per_user)
    pipe.llm_manager = StubLLMManager()
    return pipe


def seed_user_a_history(store: ConversationManager, user_id: str = "user_a") -> None:
    """Two conversations, four queries, multiple documents, one context-less query."""
    conv1 = store.add_entry(
        user_id, "Question one a?", "Answer one a.", context=[{"source": "/files/doc1.pdf"}]
    )
    store.add_entry(
        user_id, "Question one b?", "Answer one b.",
        context=[{"source": "/files/doc1.pdf"}], conversation_id=conv1["id"],
    )
    conv2 = store.add_entry(
        user_id, "Question two a?", "Answer two a.", context=[{"source": "/files/doc2.pdf"}]
    )
    store.add_entry(
        user_id, "Question two b?", "Answer two b.", context=[], conversation_id=conv2["id"],
    )


def test_total_queries_counts_real_messages_not_conversations():
    pipe = make_pipeline()
    seed_user_a_history(pipe.history)  # 2 conversations, 4 user queries

    analytics = pipe.get_analytics("user_a")

    assert analytics["total_queries"] == 4


def test_most_queried_document_uses_message_context():
    pipe = make_pipeline()
    seed_user_a_history(pipe.history)  # doc1.pdf x2, doc2.pdf x1, one without context

    analytics = pipe.get_analytics("user_a")

    assert analytics["most_queried_document"] == "doc1.pdf"


def test_messages_without_context_do_not_create_a_most_queried_document():
    pipe = make_pipeline()
    pipe.history.add_entry("user_c", "Only question?", "Only answer.", context=[])

    analytics = pipe.get_analytics("user_c")

    assert analytics["total_queries"] == 1
    assert analytics["most_queried_document"] is None


def test_queries_today_uses_message_timestamp():
    pipe = make_pipeline()
    conv1 = pipe.history.add_entry(
        "user_a", "Old question?", "Old answer.", context=[{"source": "/files/old.pdf"}]
    )
    seed_user_a_history(pipe.history)  # 4 more queries, all "now"

    # Backdate the very first user message by 3 days (schema-realistic edit).
    data = json.loads(pipe.history.path.read_text(encoding="utf-8"))
    old_ms = int((datetime.now(timezone.utc) - timedelta(days=3)).timestamp() * 1000)
    for conv in data:
        if conv["id"] == conv1["id"]:
            conv["messages"][0]["timestamp"] = old_ms
    pipe.history.path.write_text(json.dumps(data), encoding="utf-8")

    analytics = pipe.get_analytics("user_a")

    assert analytics["total_queries"] == 5
    assert analytics["queries_today"] == 4  # only the backdated one drops out


def test_multiple_users_are_isolated():
    pipe = make_pipeline()
    seed_user_a_history(pipe.history, user_id="user_a")
    pipe.history.add_entry("user_b", "User B question?", "User B answer.", context=[])

    a = pipe.get_analytics("user_a")
    b = pipe.get_analytics("user_b")

    assert a["total_queries"] == 4
    assert b["total_queries"] == 1
    assert a["most_queried_document"] == "doc1.pdf"
    assert b["most_queried_document"] is None


def test_chunk_counts_are_user_scoped():
    per_user = {
        "user_a": {"chroma_chunks": 2, "bm25_chunks": 2},
        "user_b": {"chroma_chunks": 7, "bm25_chunks": 7},
    }
    pipe_a = make_pipeline(per_user)
    pipe_b = make_pipeline(per_user)
    seed_user_a_history(pipe_a.history)
    pipe_b.history.add_entry("user_b", "Q?", "A.", context=[])

    a = pipe_a.get_analytics("user_a")
    b = pipe_b.get_analytics("user_b")

    assert a["total_chunks"] == 2
    assert a["bm25_indexed_chunks"] == 2
    assert b["total_chunks"] == 7
    assert b["bm25_indexed_chunks"] == 7
    # User A must not see user B's chunk counts.
    assert a["total_chunks"] != b["total_chunks"]


def test_legacy_conversation_counts_as_one_query():
    pipe = make_pipeline()
    legacy = {
        "id": "legacy-1",
        "user_id": "user_a",
        "question": "Old?",
        "answer": "Answer.",
        "context": [{"source": "/files/legacy.pdf"}],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    pipe.history.get_history = lambda user_id=None, limit=None: [legacy]

    analytics = pipe.get_analytics("user_a")

    assert analytics["total_queries"] == 1
    assert analytics["queries_today"] == 1
    assert analytics["most_queried_document"] == "legacy.pdf"


def test_documents_summarized_field_name_matches_frontend():
    """Frontend (analytics.service.ts) consumes 'documents_summarized' — the
    backend key must match exactly (audit finding #25)."""
    pipe = make_pipeline()
    doc_id = pipe.doc_store.add(
        user_id="user_a", filename="summarized.pdf", file_path="/x.pdf",
        full_text="text", chunk_count=1,
    )
    pipe.doc_store.set_summary(doc_id, {"executive_summary": "s"})
    pipe.doc_store.add(
        user_id="user_a", filename="plain.pdf", file_path="/y.pdf",
        full_text="text", chunk_count=1,
    )

    analytics = pipe.get_analytics("user_a")

    assert "documents_summarized" in analytics
    assert "summarized_documents" not in analytics
    assert analytics["documents_summarized"] == 1


def test_chunk_counts_against_real_index(real_retriever):
    """The retriever's per-user counting works on real Chroma + BM25 metadata."""
    from langchain_core.documents import Document

    real_retriever.add_documents([
        Document(page_content="alpha chunk one", metadata={"user_id": "user_a", "source": "/x/a.pdf"}),
        Document(page_content="alpha chunk two", metadata={"user_id": "user_a", "source": "/x/a.pdf"}),
        Document(page_content="beta chunk one", metadata={"user_id": "user_b", "source": "/x/b.pdf"}),
        Document(page_content="beta chunk two", metadata={"user_id": "user_b", "source": "/x/b.pdf"}),
        Document(page_content="beta chunk three", metadata={"user_id": "user_b", "source": "/x/b.pdf"}),
    ])

    counts_a = real_retriever.get_user_chunk_counts("user_a")
    counts_b = real_retriever.get_user_chunk_counts("user_b")

    assert counts_a == {"chroma_chunks": 2, "bm25_chunks": 2}
    assert counts_b == {"chroma_chunks": 3, "bm25_chunks": 3}
