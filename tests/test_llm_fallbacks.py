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
