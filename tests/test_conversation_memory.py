"""Regression tests for multi-turn conversation memory (audit finding #26).

Follow-up turns are stored in the conversation's ``messages`` list; the
conversation-context builder and the history exporter must read the real
message structure (not the frozen top-level ``question``/``answer`` fields).
"""

from src.exporter import export_markdown
from src.history import ConversationManager
from src.rag_pipeline import RAGPipeline


def make_pipeline(memory_window: int = 10) -> RAGPipeline:
    """Build a pipeline shell with a real ConversationManager (no LLM needed).

    ``_build_conversation_context`` only touches ``self.history``,
    ``self.memory_window`` and the module-level ``MEMORY_MAX_CHARS``.
    """
    pipe = RAGPipeline.__new__(RAGPipeline)
    pipe.history = ConversationManager()
    pipe.memory_window = memory_window
    return pipe


def seed_three_exchanges(store: ConversationManager, user_id: str = "user1") -> str:
    """Create one conversation with three exchanges; return its id."""
    conv = store.add_entry(
        user_id=user_id,
        question="What architecture does the model use?",
        answer="It uses a Transformer encoder-decoder.",
        context=[{"source": "paper.pdf", "confidence_percent": 90.0}],
    )
    conv_id = conv["id"]
    store.add_entry(
        user_id=user_id,
        question="How many encoder layers are there?",
        answer="There are 6.",
        context=[{"source": "paper.pdf", "confidence_percent": 88.0}],
        conversation_id=conv_id,
    )
    return conv_id


def test_followup_exchanges_are_read_from_messages():
    """The context for the 3rd question must contain BOTH prior exchanges."""
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)
    pipe.history.add_entry(
        user_id="user1",
        question="What about the attention heads?",
        answer="Each layer has 8 attention heads.",
        context=[],
        conversation_id=conv_id,
    )

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    # All prior exchanges are present (not just the first one).
    assert "What architecture does the model use?" in ctx
    assert "Transformer encoder-decoder" in ctx
    assert "How many encoder layers are there?" in ctx
    assert "There are 6." in ctx


def test_context_is_chronological():
    """Exchanges appear in chronological order (oldest first)."""
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    assert ctx.index("What architecture does the model use?") < ctx.index(
        "How many encoder layers are there?"
    )
    assert ctx.index("Transformer encoder-decoder") < ctx.index("There are 6.")


def test_context_does_not_leak_retrieved_document_context():
    """Document chunks stored on messages must not enter conversation memory."""
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    assert "paper.pdf" not in ctx
    assert "Source" not in ctx


def test_context_scoped_to_current_conversation():
    """Other conversations' messages must not leak into the context."""
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)
    pipe.history.add_entry(
        user_id="user1",
        question="Totally unrelated first question?",
        answer="Totally unrelated answer.",
        context=[],
    )

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    assert "Totally unrelated" not in ctx
    assert "What architecture does the model use?" in ctx


def test_context_scoped_to_owner_user():
    """Another user must not see (or even trigger) someone else's history."""
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history, user_id="user1")

    # User B asking with user A's conversation id gets nothing.
    assert pipe._build_conversation_context("user2", conversation_id=conv_id) == ""
    # And user A's context does not contain user B's questions.
    pipe.history.add_entry(
        user_id="user2", question="User B private question?", answer="User B private answer.", context=[]
    )
    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)
    assert "User B private" not in ctx


def test_no_conversation_id_yields_empty_context():
    """Without a conversation id there is no current conversation -> no history."""
    pipe = make_pipeline()
    seed_three_exchanges(pipe.history)
    assert pipe._build_conversation_context("user1") == ""


def test_memory_window_limits_exchanges():
    """Only the most recent N exchanges are injected (bounded context)."""
    pipe = make_pipeline(memory_window=2)
    conv_id = seed_three_exchanges(pipe.history)
    pipe.history.add_entry(
        user_id="user1",
        question="What about the attention heads?",
        answer="Each layer has 8 attention heads.",
        context=[],
        conversation_id=conv_id,
    )

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    # Window=2 keeps the last two exchanges only.
    assert "attention heads" in ctx
    assert "How many encoder layers are there?" in ctx
    assert "What architecture does the model use?" not in ctx


def test_roles_are_preserved():
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)

    ctx = pipe._build_conversation_context("user1", conversation_id=conv_id)

    assert "User: How many encoder layers are there?" in ctx
    assert "Assistant: There are 6." in ctx


def test_legacy_top_level_schema_still_works():
    """Conversations stored before the messages schema still yield one exchange."""
    legacy = {
        "id": "legacy",
        "user_id": "user1",
        "question": "Old question?",
        "answer": "Old answer.",
        "context": [],
    }
    exchanges = RAGPipeline._extract_exchanges(legacy)
    assert exchanges == [("Old question?", "Old answer.")]


def test_error_answers_are_not_injected_into_memory():
    conv = {
        "id": "c",
        "user_id": "user1",
        "messages": [
            {"id": "1", "role": "user", "content": "Q1?", "timestamp": 1},
            {"id": "2", "role": "assistant", "content": "Error: LLM unavailable", "timestamp": 1},
            {"id": "3", "role": "user", "content": "Q2?", "timestamp": 2},
            {"id": "4", "role": "assistant", "content": "Good answer.", "timestamp": 2},
        ],
    }
    exchanges = RAGPipeline._extract_exchanges(conv)
    assert exchanges == [("Q2?", "Good answer.")]


# ── Exporter ─────────────────────────────────────────────────────────────────


def test_export_history_uses_message_schema():
    pipe = make_pipeline()
    conv_id = seed_three_exchanges(pipe.history)
    pipe.history.add_entry(
        user_id="user1",
        question="What about the attention heads?",
        answer="Each layer has 8 attention heads.",
        context=[{"source": "paper.pdf", "confidence_percent": 91.0}],
        conversation_id=conv_id,
    )

    md = export_markdown("history", {"conversations": pipe.history.get_history(user_id="user1")})

    assert "What architecture does the model use?" in md
    assert "Transformer encoder-decoder" in md
    assert "How many encoder layers are there?" in md
    assert "There are 6." in md
    assert "What about the attention heads?" in md
    assert "Each layer has 8 attention heads." in md
    assert "Source: paper.pdf | Confidence: 91.0%" in md


def test_export_history_legacy_schema_fallback():
    legacy = [
        {
            "id": "legacy",
            "question": "Old question?",
            "answer": "Old answer.",
            "context": [{"source": "old.pdf", "confidence_percent": 70.0}],
        }
    ]
    md = export_markdown("history", {"conversations": legacy})
    assert "**Q:** Old question?" in md
    assert "**A:** Old answer." in md
    assert "Source: old.pdf | Confidence: 70.0%" in md
