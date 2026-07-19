from langchain_core.documents import Document

from src.rag_pipeline import RAGPipeline


class DummyRetriever:
    def __init__(self, results):
        self._results = results
        self.last_query = None

    def retrieve_with_scores(self, query, k=4):
        self.last_query = query
        return self._results


class DummyLLMManager:
    def generate_answer(self, context, question):
        return "fake answer"

    def stream_answer(self, context, question):
        yield "fake answer"


class DummyHistory:
    def add_entry(self, **kwargs):
        return None


class DummyConfidenceScorer:
    def score(self, question, answer, context_list):
        return {"composite_score": 75.0}


def make_pipeline(results):
    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = DummyRetriever(results)
    pipeline.llm_manager = DummyLLMManager()
    pipeline.history = DummyHistory()
    pipeline.confidence_scorer = DummyConfidenceScorer()
    pipeline._detect_section = lambda question: None
    pipeline.relevance_threshold = 70.0
    pipeline.strict_grounding = True
    return pipeline


def test_query_refuses_when_best_context_is_below_threshold():
    pipeline = make_pipeline([(Document(page_content="weak chunk", metadata={"source": "a.pdf"}), 40.0)])

    result = pipeline.query("What is the conclusion?")

    assert result["success"] is False
    assert result["grounded"] is False
    assert "enough relevant information" in result["answer"].lower()


def test_query_answers_when_context_is_above_threshold():
    pipeline = make_pipeline([(Document(page_content="strong chunk", metadata={"source": "a.pdf"}), 85.0)])

    result = pipeline.query("What is the conclusion?")

    assert result["success"] is True
    assert result["grounded"] is True
    assert result["answer"] == "fake answer"


def test_query_rewrites_questions_and_records_retrieval_metadata():
    retriever = DummyRetriever([(Document(page_content="strong chunk", metadata={"source": "a.pdf"}), 85.0)])
    pipeline = make_pipeline([(Document(page_content="strong chunk", metadata={"source": "a.pdf"}), 85.0)])
    pipeline.retriever = retriever

    result = pipeline.query("What is the conclusion?")

    assert retriever.last_query is not None
    assert "conclusion" in retriever.last_query.lower()
    assert "conclusion" in result["retrieval_trace"]["rewritten_query"].lower()
    assert result["retrieval_trace"]["retrieval_mode"] == "hybrid (dense + bm25)"
