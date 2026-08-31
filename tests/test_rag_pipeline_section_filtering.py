from src.rag_pipeline import RAGPipeline


class DummyDoc:
    def __init__(self, page_content: str, metadata: dict | None = None):
        self.page_content = page_content
        self.metadata = metadata or {}


def test_section_matches_with_section_path_and_titles():
    doc_parent = DummyDoc(
        page_content="Parent methodology content",
        metadata={
            "section_title": "Methodology",
            "subsection_title": "Model Design and Configuration",
            "section_path": "IV > Methodology > C > Model Design",
        },
    )
    assert RAGPipeline._section_matches(doc_parent, ["methodology"])

    doc_path_only = DummyDoc(
        page_content="Some content",
        metadata={
            "section_title": "",
            "subsection_title": "",
            "section_path": "IV > Methodology > C > Model Design",
        },
    )
    assert RAGPipeline._section_matches(doc_path_only, ["methodology"])

    doc_unrelated = DummyDoc(
        page_content="Implementation considerations and details",
        metadata={
            "section_title": "Implementation Considerations",
            "subsection_title": "Runtime Optimizations",
            "section_path": "V > Implementation > Runtime Optimizations",
        },
    )
    assert not RAGPipeline._section_matches(doc_unrelated, ["methodology"])


def test_dedup_and_filter_applies_filter_after_full_dedup_pool():
    pipeline = RAGPipeline.__new__(RAGPipeline)

    # Construct 20+ candidate docs. First 15 are methodology-related.
    docs = []
    for i in range(20):
        section = "methodology" if i < 15 else "results"
        docs.append((
            DummyDoc(
                page_content=f"chunk {i} content",
                metadata={
                    "section_title": section.title(),
                    "section_path": f"I > {section.title()}" if i < 15 else "II > Results",
                },
            ),
            90.0 - i,
        ))

    scored_docs, unique_scored = pipeline._dedup_and_filter(docs, ["results"], k=15)

    # The filtered list should include the results chunk from position 20.
    assert any(doc.metadata.get("section_title") == "Results" for doc, _ in unique_scored)
    assert len(unique_scored) <= 15
    assert len(scored_docs) == len(docs)


def test_retrieve_skips_decompose_query_when_section_queries_are_sufficient():
    class DummyRetriever:
        def retrieve_with_scores(self, query, k=4, filter=None):
            return []

    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = DummyRetriever()
    pipeline.use_reranker = False
    pipeline._detect_sections = lambda question: ["methodology"]
    pipeline._get_section_queries = lambda sections: ["a", "b", "c", "d"]
    called = {"decompose": 0}
    def decompose(query, sections=None):
        called["decompose"] += 1
        return [query]
    pipeline._decompose_query = decompose

    pipeline._retrieve("Explain methodology", k=10, filter=None)
    assert called["decompose"] == 0


def test_suggested_questions_returns_list_not_json_string():
    class DummyLLM:
        def _invoke(self, prompt):
            return '["What is the methodology?", "What are the main results?"]'

    from src.suggested_questions import QuestionSuggester
    suggester = QuestionSuggester(DummyLLM())
    questions = suggester.suggest("Test document text")
    assert isinstance(questions, list)
    assert questions == ["What is the methodology?", "What are the main results?"]
