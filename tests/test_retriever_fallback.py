from src.retriever import VectorRetriever


class DummyDoc:
    def __init__(self, text: str):
        self.page_content = text
        self.metadata = {}


def test_empty_dense_falls_back_to_sparse():
    dense = []
    sparse = [(DummyDoc("Sparse doc"), 11.0)]

    fused, mode = VectorRetriever._compose_results(dense, sparse, k=4)

    assert mode == "bm25_fallback"
    assert [doc.page_content for doc, _ in fused] == ["Sparse doc"]


def test_dense_and_sparse_uses_hybrid_mode():
    dense = [(DummyDoc("Dense doc"), 0.9)]
    sparse = [(DummyDoc("Sparse doc"), 0.8)]

    fused, mode = VectorRetriever._compose_results(dense, sparse, k=4)

    assert mode == "hybrid"
    assert len(fused) == 2
