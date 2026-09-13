import src.llm as llm_module


class FakeResponse:
    content = "fallback answer"


class FakeLLM:
    def __init__(self, model_name):
        self.model_name = model_name

    def invoke(self, prompt):
        if self.model_name == "bad-primary":
            raise RuntimeError("model unavailable")
        return FakeResponse()

    def stream(self, prompt):
        if self.model_name == "bad-primary":
            raise RuntimeError("model unavailable")
        yield FakeResponse()


class CapturingLLM:
    def __init__(self):
        self.prompts = []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return FakeResponse()

    def stream(self, prompt):
        self.prompts.append(prompt)
        yield FakeResponse()


def test_invoke_uses_configured_fallback(monkeypatch):
    monkeypatch.setattr(llm_module, "LLM_FALLBACK_MODEL", "good-fallback")
    monkeypatch.setattr(llm_module, "_GEMINI_FALLBACK_MODELS", ())

    manager = llm_module.LLMManager.__new__(llm_module.LLMManager)
    manager.provider = "gemini"
    manager.temperature = 0
    manager.max_retries = 1
    manager.request_timeout = 1
    manager.model_name = "bad-primary"
    manager.llm = FakeLLM("bad-primary")
    manager.fallback_model_name = None
    manager._fallback_llm = None
    manager._fallback_llms = []
    manager._build_llm = lambda model_name: FakeLLM(model_name)
    manager._configure_default_fallbacks()

    assert manager._invoke("question") == "fallback answer"


def test_stream_uses_configured_fallback(monkeypatch):
    monkeypatch.setattr(llm_module, "LLM_FALLBACK_MODEL", "good-fallback")
    monkeypatch.setattr(llm_module, "_GEMINI_FALLBACK_MODELS", ())

    manager = llm_module.LLMManager.__new__(llm_module.LLMManager)
    manager.provider = "gemini"
    manager.temperature = 0
    manager.max_retries = 1
    manager.request_timeout = 1
    manager.model_name = "bad-primary"
    manager.llm = FakeLLM("bad-primary")
    manager.fallback_model_name = None
    manager._fallback_llm = None
    manager._fallback_llms = []
    manager._build_llm = lambda model_name: FakeLLM(model_name)
    manager._configure_default_fallbacks()

    assert "".join(manager.stream_answer("context", "question")) == "fallback answer"


def test_normal_answer_prompt_requires_multi_chunk_synthesis():
    manager = llm_module.LLMManager.__new__(llm_module.LLMManager)
    manager.model_name = "capturing"
    manager.llm = CapturingLLM()
    manager._fallback_llms = []
    manager.max_retries = 1

    assert manager.generate_answer("chunk one\nchunk two", "multi-part question") == "fallback answer"

    prompt = manager.llm.prompts[0]
    assert "one evidence set, not as a single best-match excerpt" in prompt
    assert "Combine complementary facts across chunks" in prompt
    assert "only when it is supported by the retrieved context" in prompt


def test_stream_answer_prompt_requires_multi_chunk_synthesis():
    manager = llm_module.LLMManager.__new__(llm_module.LLMManager)
    manager.model_name = "capturing"
    manager.llm = CapturingLLM()
    manager._fallback_llms = []

    assert "".join(manager.stream_answer("chunk one\nchunk two", "multi-part question")) == "fallback answer"

    prompt = manager.llm.prompts[0]
    assert "one evidence set, not as a single best-match excerpt" in prompt
    assert "Combine complementary facts across chunks" in prompt
    assert "only when it is supported by the retrieved context" in prompt


def test_memory_answer_prompt_preserves_history_and_shared_guidance():
    manager = llm_module.LLMManager.__new__(llm_module.LLMManager)
    manager.model_name = "capturing"
    manager.llm = CapturingLLM()
    manager._fallback_llms = []
    manager.max_retries = 1

    answer = manager.generate_answer(
        "chunk one\nchunk two",
        "follow-up question",
        history="User: earlier question\nAssistant: earlier answer",
    )

    assert answer == "fallback answer"
    prompt = manager.llm.prompts[0]
    assert "User: earlier question" in prompt
    assert "one evidence set, not as a single best-match excerpt" in prompt
    assert "Output clean, well-formatted Markdown" in prompt
    assert "Do not repeat or rephrase the user's question" in prompt
