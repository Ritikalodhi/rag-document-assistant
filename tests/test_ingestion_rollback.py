from langchain_core.documents import Document

from src.doc_collections import CollectionStore
from src.doc_store import DocumentStore
from src.rag_pipeline import RAGPipeline
from src.versioning import DocumentVersionStore


class StubProcessor:
    def __init__(self, docs):
        self.docs = docs

    def load_document(self, file_path):
        return self.docs

    def split_documents(self, documents):
        return documents


class TrackingRetriever:
    def __init__(self):
        self.docs = []
        self.delete_calls = []

    def add_documents(self, docs):
        self.docs.extend(docs)

    def delete_by_source(self, source_path, user_id=None):
        self.delete_calls.append((source_path, user_id))
        self.docs = [
            d for d in self.docs
            if not (
                d.metadata.get("source") == source_path
                and (user_id is None or d.metadata.get("user_id") == user_id)
            )
        ]

    def counts(self, user_id):
        count = sum(1 for d in self.docs if d.metadata.get("user_id") == user_id)
        return {"chroma": count, "bm25": count}


def make_pipeline(file_path, fail_at=None):
    doc = Document(page_content="hello indexed chunk", metadata={"source": str(file_path)})
    pipe = RAGPipeline.__new__(RAGPipeline)
    pipe.doc_processor = StubProcessor([doc])
    pipe.retriever = TrackingRetriever()
    pipe.doc_store = DocumentStore()
    pipe.collection_store = CollectionStore()
    pipe.version_store = DocumentVersionStore()

    if fail_at == "doc_store":
        def failing_add(**kwargs):
            raise RuntimeError("doc_store failed")
        pipe.doc_store.add = failing_add

    if fail_at == "version":
        def failing_register(*args, **kwargs):
            raise RuntimeError("version failed")
        pipe.version_store.check_and_register = failing_register

    if fail_at == "collection":
        def failing_collection(*args, **kwargs):
            raise RuntimeError("collection failed")
        pipe.collection_store.add_document = failing_collection

    return pipe


def assert_clean(pipe, user_id, file_path):
    counts = pipe.retriever.counts(user_id)
    assert counts == {"chroma": 0, "bm25": 0}
    assert pipe.doc_store.list_summaries(user_id=user_id) == []
    assert pipe.version_store.get_versions(user_id, file_path.name) == []
    for collection in pipe.collection_store.list_all(user_id=user_id):
        assert collection["doc_ids"] == []


def test_rollback_after_retriever_indexing_failure(tmp_path):
    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello indexed chunk", encoding="utf-8")
    pipe = make_pipeline(file_path)

    original_add = pipe.retriever.add_documents
    def failing_add(docs):
        original_add(docs)
        raise RuntimeError("post-index failure")
    pipe.retriever.add_documents = failing_add

    result = pipe.add_document("user_a", str(file_path))

    assert result["success"] is False
    assert_clean(pipe, "user_a", file_path)


def test_rollback_after_doc_store_creation(tmp_path):
    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello indexed chunk", encoding="utf-8")
    pipe = make_pipeline(file_path, fail_at="doc_store")

    result = pipe.add_document("user_a", str(file_path))

    assert result["success"] is False
    assert_clean(pipe, "user_a", file_path)


def test_rollback_after_version_registration(tmp_path):
    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello indexed chunk", encoding="utf-8")
    pipe = make_pipeline(file_path)

    original_register = pipe.version_store.check_and_register
    def register_then_fail(*args, **kwargs):
        original_register(*args, **kwargs)
        raise RuntimeError("version follow-up failed")
    pipe.version_store.check_and_register = register_then_fail

    result = pipe.add_document("user_a", str(file_path))

    assert result["success"] is False
    assert_clean(pipe, "user_a", file_path)


def test_rollback_after_collection_assignment(tmp_path):
    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello indexed chunk", encoding="utf-8")
    pipe = make_pipeline(file_path)

    original_add = pipe.collection_store.add_document
    def add_then_fail(*args, **kwargs):
        original_add(*args, **kwargs)
        raise RuntimeError("collection follow-up failed")
    pipe.collection_store.add_document = add_then_fail

    result = pipe.add_document("user_a", str(file_path))

    assert result["success"] is False
    assert_clean(pipe, "user_a", file_path)


def test_retry_after_partial_ingestion_has_exactly_one_chunk_set(tmp_path):
    file_path = tmp_path / "doc.txt"
    file_path.write_text("hello indexed chunk", encoding="utf-8")
    pipe = make_pipeline(file_path)

    original_register = pipe.version_store.check_and_register
    attempts = {"count": 0}
    def fail_first_register(*args, **kwargs):
        attempts["count"] += 1
        result = original_register(*args, **kwargs)
        if attempts["count"] == 1:
            raise RuntimeError("transient version failure")
        return result
    pipe.version_store.check_and_register = fail_first_register

    first = pipe.add_document("user_a", str(file_path))
    second = pipe.add_document("user_a", str(file_path))

    assert first["success"] is False
    assert second["success"] is True
    assert pipe.retriever.counts("user_a") == {"chroma": 1, "bm25": 1}
    assert len(pipe.doc_store.list_summaries(user_id="user_a")) == 1
    assert len(pipe.version_store.get_versions("user_a", file_path.name)) == 1
