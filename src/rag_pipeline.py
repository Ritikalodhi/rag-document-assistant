"""Main RAG pipeline orchestration."""

from pathlib import Path
from src.document_processor import DocumentProcessor
from src.retriever import VectorRetriever
from src.llm import LLMManager
from src.history import ConversationManager
from src.summarizer import DocumentSummarizer
from src.comparator import DocumentComparator
from src.suggested_questions import QuestionSuggester
from src.study_notes import StudyNotesGenerator
from src.cross_document import CrossDocumentIntelligence
from src.confidence_scorer import AnswerConfidenceScorer
from src.input_sanitizer import sanitize_question
from src.doc_store import DocumentStore
from src.collections import CollectionStore
from src.table_extractor import extract_tables, PDFPLUMBER_AVAILABLE
from src.exporter import export_markdown, export_pdf
from src.versioning import DocumentVersionStore
from src.config import (
    DOCUMENT_DIR, MEMORY_WINDOW, MEMORY_MAX_CHARS,
    CHUNK_STRATEGY, RERANKER_ENABLED,
    LLM_MAX_RETRIES, LLM_REQUEST_TIMEOUT, LLM_FALLBACK_MODEL,
)
import os
from loguru import logger


class RAGPipeline:
    """Orchestrates document ingestion, retrieval, and answer generation.

    Multi-tenant: every public method accepts a ``user_id`` parameter that
    scopes all reads/writes to that user.
    """

    def __init__(self, model: str | None = None, temperature: float = 0.7):
        self.doc_processor = DocumentProcessor(strategy=CHUNK_STRATEGY)
        self.retriever = VectorRetriever()
        self.llm_manager = LLMManager(
            model=model,
            temperature=temperature,
            max_retries=LLM_MAX_RETRIES,
            request_timeout=LLM_REQUEST_TIMEOUT,
        )
        if LLM_FALLBACK_MODEL:
            self.llm_manager.set_fallback_model(LLM_FALLBACK_MODEL)
        self.history = ConversationManager()
        self.summarizer = DocumentSummarizer(self.llm_manager)
        self.comparator = DocumentComparator(self.llm_manager)
        self.question_suggester = QuestionSuggester(self.llm_manager)
        self.study_notes_generator = StudyNotesGenerator(self.llm_manager)
        self.cross_doc_intelligence = CrossDocumentIntelligence(self.llm_manager)
        self.confidence_scorer = AnswerConfidenceScorer(self.llm_manager)
        self.doc_store = DocumentStore()
        self.collection_store = CollectionStore()
        self.version_store = DocumentVersionStore()
        self.relevance_threshold = float(os.getenv("RELEVANCE_THRESHOLD", "70.0"))
        self.strict_grounding = os.getenv("STRICT_GROUNDING", "true").lower() in ("1", "true", "yes")
        self.use_reranker = RERANKER_ENABLED
        self.memory_window = MEMORY_WINDOW
        logger.info("RAG Pipeline ready")

    def add_document(self, user_id: str, file_path: str, collection_id: str | None = None) -> dict:
        """Load, chunk, and index a document.

        Also stores the document's full text in doc_store, assigns it to
        a collection, registers a version, and extracts tables from PDFs.

        On failure, rolls back any partial state (Chroma, BM25, doc_store,
        collection membership) so the system remains consistent.
        """
        doc_id: str | None = None
        target_collection: str | None = None
        try:
            documents = self.doc_processor.load_document(file_path)
            full_text = "\n\n".join(d.page_content for d in documents)
            filename = Path(file_path).name

            chunks = self.doc_processor.split_documents(documents)

            # Tag each chunk with user_id for tenant-scoped retrieval
            for doc in chunks:
                doc.metadata["user_id"] = user_id

            # Pre-check BEFORE indexing — read-only, does NOT write a version
            # entry. (Previously this called check_and_register, which wrote
            # a version row on every check, double-registering every upload.)
            is_duplicate = self.version_store.check_duplicate(user_id, filename, full_text)

            if is_duplicate:
                # Find the existing doc_id from a prior version
                existing_doc = self.doc_store.get_by_filename(filename, user_id=user_id)
                if existing_doc:
                    logger.info(f"Ignoring duplicate upload of {filename}, returning existing doc_id")
                    return {
                        "success": True,
                        "file": filename,
                        "chunks": len(chunks),
                        "doc_id": existing_doc["doc_id"],
                        "collection_id": collection_id or existing_doc.get("collection_id"),
                        "tables_found": 0,
                        "tables": [],
                        "duplicate": True,
                    }

            self.retriever.add_documents(chunks)

            doc_id = self.doc_store.add(
                user_id=user_id,
                filename=filename,
                file_path=str(file_path),
                full_text=full_text,
                chunk_count=len(chunks),
            )

            # Register exactly once, now that we have the real doc_id
            self.version_store.check_and_register(
                user_id=user_id, filename=filename, full_text=full_text, doc_id=doc_id
            )

            target_collection = collection_id or self.collection_store.get_default_id(user_id=user_id)
            self.collection_store.add_document(target_collection, doc_id, user_id=user_id)

            tables = []
            if Path(file_path).suffix.lower() == ".pdf" and PDFPLUMBER_AVAILABLE:
                try:
                    tables = extract_tables(file_path)
                except Exception as te:
                    logger.warning(f"Table extraction failed: {te}")

            logger.info(f"Indexed {len(chunks)} chunks from {file_path}")
            return {
                "success": True,
                "file": filename,
                "chunks": len(chunks),
                "doc_id": doc_id,
                "collection_id": target_collection,
                "tables_found": len(tables),
                "tables": tables,
                "duplicate": False,
            }
        except Exception as e:
            logger.error(f"Error adding document, cleaning up: {e}")
            # Rollback metadata changes
            if doc_id:
                try:
                    self.doc_store.delete(doc_id, user_id=user_id)
                except Exception as rb_err:
                    logger.error(f"Rollback: doc_store delete failed: {rb_err}")
                try:
                    if target_collection:
                        self.collection_store.remove_document(target_collection, doc_id, user_id=user_id)
                except Exception as rb_err:
                    logger.error(f"Rollback: collection removal failed: {rb_err}")
            return {"success": False, "error": str(e)}

    # Sections we can detect and filter to directly
    _SECTION_KEYWORDS = {
        "abstract": "abstract",
        "introduction": "introduction",
        "conclusion": "conclusion",
        "methodology": "methodology",
        "references": "references",
        "results": "results",
        "discussion": "discussion",
    }

    def _detect_section(self, question: str) -> str | None:
        """Return a section name if the query targets a specific document section."""
        q = question.lower()
        for keyword, section in self._SECTION_KEYWORDS.items():
            if keyword in q:
                return section
        return None

    def _rewrite_query(self, question: str) -> str:
        """Lightweight query rewriting for more retrieval-focused searches."""
        cleaned = question.strip()
        if not cleaned:
            return cleaned
        lowered = cleaned.lower()
        if lowered.startswith(("what is", "what are", "who is", "who are", "where is", "where are")):
            return f"Find the relevant passage about: {cleaned}"
        if lowered.startswith(("explain", "summarize", "describe")):
            return f"Explain the relevant details of: {cleaned}"
        return f"Find information about: {cleaned}"

    def _get_retrieval_mode_display(self) -> str:
        mode = getattr(self.retriever, "last_retrieval_mode", "hybrid")
        return {
            "hybrid": "hybrid (dense + bm25)",
            "bm25_fallback": "bm25_fallback",
            "dense_only": "dense_only",
            "empty": "empty",
        }.get(mode, mode)

    # ── Multi-turn memory ────────────────────────────────────────────────────

    def _build_conversation_context(self, user_id: str) -> str:
        """Build a formatted string of recent Q&A exchanges.

        Reads the last ``self.memory_window`` entries from the conversation
        history and formats them as::

            User: <question>
            Assistant: <answer>

        Truncates the whole string to ``MEMORY_MAX_CHARS`` to stay within
        token limits. Returns an empty string when there is no history.
        """
        entries = self.history.get_history(user_id=user_id, limit=self.memory_window)
        if not entries:
            return ""

        lines = []
        for entry in reversed(entries):
            q = entry.get("question", "").strip()
            a = entry.get("answer", "").strip()
            if q and a and not a.startswith("Error"):
                lines.append(f"User: {q}")
                lines.append(f"Assistant: {a}")

        formatted = "\n".join(lines)
        if len(formatted) > MEMORY_MAX_CHARS:
            formatted = "..." + formatted[-(MEMORY_MAX_CHARS - 3):]
        return formatted

    def _retrieve(self, rewritten_query: str, k: int, filter: dict | None = None):
        """Pick reranked or standard retrieval based on the ``use_reranker`` flag."""
        if self.use_reranker:
            return self.retriever.retrieve_reranked(rewritten_query, k=k, filter=filter)
        return self.retriever.retrieve_with_scores(rewritten_query, k=k, filter=filter)

    @staticmethod
    def _stable_content_hash(text: str) -> str:
        """Return a deterministic hash for deduplication across Python processes."""
        import hashlib
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

    def _dedup_and_filter(
        self, scored_docs: list, section: str | None, k: int
    ) -> tuple[list, list]:
        """Deduplicate by deterministic content hash, optionally filter by section, cap at k."""
        if section:
            filtered = [(d, s) for d, s in scored_docs if section in d.page_content.lower()]
            scored_docs = filtered if filtered else scored_docs

        seen, unique_scored = set(), []
        for doc, score in scored_docs:
            h = self._stable_content_hash(doc.page_content.strip())
            if h not in seen:
                seen.add(h)
                unique_scored.append((doc, score))
            if len(unique_scored) == k:
                break
        return scored_docs, unique_scored

    def _build_context_entries(self, unique_scored: list) -> list[dict]:
        """Convert (Document, score) pairs into the standard context entry dict."""
        context_list = []
        for doc, confidence in unique_scored:
            raw_source = doc.metadata.get("source", "Unknown")
            clean_source = Path(raw_source).name if raw_source != "Unknown" else raw_source
            page = doc.metadata.get("page", None)
            entry = {
                "content": doc.page_content,
                "source": clean_source,
                "confidence_percent": confidence,
            }
            if page is not None:
                entry["page"] = page + 1
            context_list.append(entry)
        return context_list

    # ── Streaming query ──────────────────────────────────────────────────────

    def stream_query(self, user_id: str, question: str, k: int = 4):
        """Stream answer tokens. Yields SSE-formatted strings.

        Format: data: <token>\n\n
        Final:  data: [DONE]\n\n
        """
        import json as _json

        sanitized = sanitize_question(question)
        question = sanitized.clean
        rewritten_query = self._rewrite_query(question)
        section = self._detect_section(question)
        conversation_history = self._build_conversation_context(user_id)
        scored_docs = self._retrieve(rewritten_query, k=k * 2)
        _, unique_scored = self._dedup_and_filter(scored_docs, section, k)

        if not unique_scored:
            yield "data: " + _json.dumps({"type": "error", "content": "No relevant documents found."}) + "\n\n"
            return

        best_confidence = max((c for _, c in unique_scored), default=0.0)
        if self.strict_grounding and best_confidence < self.relevance_threshold:
            refusal = "I don't have enough relevant information in the retrieved context to answer this question confidently."
            context_list = self._build_context_entries(unique_scored)
            confidence_score = self.confidence_scorer.score(
                question=question, answer=refusal, context_list=context_list,
            )
            yield "data: " + _json.dumps({
                "type": "error", "content": refusal,
                "confidence_score": confidence_score,
                "retrieval_mode": "hybrid (dense + bm25)",
                "rewritten_query": rewritten_query,
            }) + "\n\n"
            yield "data: " + _json.dumps({"type": "done"}) + "\n\n"
            return

        context_list = self._build_context_entries(unique_scored)
        yield "data: " + _json.dumps({"type": "context", "context": context_list}) + "\n\n"

        context_str = "\n---\n".join(
            f"Source: {d.metadata.get('source','Unknown')}\n{d.page_content}"
            for d, _ in unique_scored
        )

        full_answer = []
        for token in self.llm_manager.stream_answer(
            context=context_str, question=question, history=conversation_history,
        ):
            full_answer.append(token)
            yield "data: " + _json.dumps({"type": "token", "content": token}) + "\n\n"

        answer = "".join(full_answer)
        try:
            self.history.add_entry(user_id=user_id, question=question, answer=answer, context=context_list)
        except Exception:
            logger.exception("Failed to persist streamed conversation")

        yield "data: " + _json.dumps({"type": "done"}) + "\n\n"

    def _build_metadata_filter(self, filter_kwargs: dict | None = None, user_id: str | None = None) -> dict | None:
        """Convert high-level filter criteria to a Chroma-compatible filter dict.

        Wraps multiple conditions in $and, since Chroma's `where` requires
        exactly one top-level operator when more than one condition applies.
        """
        conditions = []
        if user_id:
            conditions.append({"user_id": user_id})
        if filter_kwargs:
            if filter_kwargs.get("filename"):
                conditions.append({"source": {"$in": [
                    str(DOCUMENT_DIR / f) for f in (
                        filter_kwargs["filename"] if isinstance(filter_kwargs["filename"], list)
                        else [filter_kwargs["filename"]]
                    )
                ]}})
            if filter_kwargs.get("doc_ids"):
                conditions.append({"doc_id": {"$in": (
                    filter_kwargs["doc_ids"] if isinstance(filter_kwargs["doc_ids"], list)
                    else [filter_kwargs["doc_ids"]]
                )}})
        if not conditions:
            return None
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}

    # ── Synchronous query ────────────────────────────────────────────────────

    def query(self, user_id: str, question: str, k: int = 4, filter_kwargs: dict | None = None) -> dict:
        """Answer a question from the indexed documents.

        Includes optional re-ranking, multi-turn conversation memory,
        section-aware retrieval, deduplication, confidence scoring,
        threshold-based hallucination prevention, and prompt injection protection.

        Args:
            user_id: The requesting user (scopes retrieval).
            question: User question.
            k: Number of results to return.
            filter_kwargs: Optional filter dict with keys like ``filename``, ``doc_ids``.
        """
        try:
            sanitized = sanitize_question(question)
            question = sanitized.clean
            rewritten_query = self._rewrite_query(question)
            section = self._detect_section(question)
            conversation_history = self._build_conversation_context(user_id)
            metadata_filter = self._build_metadata_filter(filter_kwargs, user_id=user_id)

            _retrieve = (
                self.retriever.retrieve_reranked
                if self.use_reranker
                else self.retriever.retrieve_with_scores
            )

            if section:
                scored_docs = _retrieve(rewritten_query, k=k * 2, filter=metadata_filter)
                filtered = [
                    (doc, score) for doc, score in scored_docs
                    if section in doc.page_content.lower()
                ]
                scored_docs = filtered if filtered else scored_docs
            else:
                scored_docs = _retrieve(rewritten_query, k=k * 2, filter=metadata_filter)

            if not scored_docs:
                return {
                    "question": question,
                    "answer": "No relevant documents found in the knowledge base.",
                    "context": [],
                    "retrieval_trace": {},
                    "confidence_score": {"composite_score": 0.0, "grade": "F"},
                    "grounded": False,
                    "success": False,
                }

            scored_docs, unique_scored = self._dedup_and_filter(scored_docs, section, k)
            best_confidence = max((s for _, s in unique_scored), default=0.0)

            if self.strict_grounding and best_confidence < self.relevance_threshold:
                refusal = "I don't have enough relevant information in the retrieved context to answer this question confidently."
                context_list = self._build_context_entries(unique_scored)
                confidence_score = self.confidence_scorer.score(
                    question=question, answer=refusal, context_list=context_list,
                )
                retrieval_trace = {
                    "query": question,
                    "rewritten_query": rewritten_query,
                    "chunks_retrieved": len(unique_scored),
                    "chunks_before_dedup": len(scored_docs),
                    "duplicates_removed": len(scored_docs) - len(unique_scored),
                    "best_score": best_confidence,
                    "threshold": self.relevance_threshold,
                    "scores": [c["confidence_percent"] for c in context_list],
                    "retrieval_mode": self._get_retrieval_mode_display(),
                }
                return {
                    "question": question,
                    "answer": refusal,
                    "context": context_list,
                    "retrieval_trace": retrieval_trace,
                    "confidence_score": confidence_score,
                    "grounded": False,
                    "success": False,
                }

            docs = [doc for doc, _ in unique_scored]
            context_str = "\n---\n".join(
                f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
                for doc in docs
            )
            answer = self.llm_manager.generate_answer(
                context=context_str, question=question, history=conversation_history,
            )
            context_list = self._build_context_entries(unique_scored)

            retrieval_trace = {
                "query": question,
                "rewritten_query": rewritten_query,
                "chunks_retrieved": len(unique_scored),
                "chunks_before_dedup": len(scored_docs),
                "duplicates_removed": len(scored_docs) - len(unique_scored),
                "scores": [c["confidence_percent"] for c in context_list],
                "retrieval_mode": self._get_retrieval_mode_display(),
            }

            confidence_score = self.confidence_scorer.score(
                question=question, answer=answer, context_list=context_list,
            )

            # Persist to conversation history
            try:
                self.history.add_entry(user_id=user_id, question=question, answer=answer, context=context_list)
            except Exception:
                logger.exception("Failed to persist conversation")

            return {
                "question": question,
                "answer": answer,
                "context": context_list,
                "retrieval_trace": retrieval_trace,
                "confidence_score": confidence_score,
                "grounded": True,
                "success": True,
            }

        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            return {
                "question": question,
                "answer": f"Error processing query: {e}",
                "context": [],
                "retrieval_trace": {},
                "confidence_score": {"composite_score": 0.0, "grade": "F"},
                "grounded": False,
                "success": False,
            }

    def summarize_document(self, user_id: str, doc_id: str) -> dict:
        """Generate (or return cached) structured summary for a document."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}

        if doc.get("summary"):
            return {"success": True, "filename": doc["filename"], "summary": doc["summary"], "cached": True}

        try:
            summary = self.summarizer.summarize_document(doc["full_text"])
            self.doc_store.set_summary(doc_id, summary)
            return {"success": True, "filename": doc["filename"], "summary": summary, "cached": False}
        except Exception as e:
            logger.error(f"Error summarizing document {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def _resolve_document(self, identifier: str, user_id: str) -> dict | None:
        """Look up a document by doc_id first, falling back to filename (scoped by user)."""
        doc = self.doc_store.get(identifier, user_id=user_id)
        if doc is not None:
            return doc
        return self.doc_store.get_by_filename(identifier, user_id=user_id)

    def compare_documents(self, user_id: str, identifier_a: str, identifier_b: str) -> dict:
        """Compare two documents (accepts doc_id or filename for each)."""
        doc_a = self._resolve_document(identifier_a, user_id)
        doc_b = self._resolve_document(identifier_b, user_id)

        if doc_a is None:
            return {"success": False, "error": f"Document '{identifier_a}' not found."}
        if doc_b is None:
            return {"success": False, "error": f"Document '{identifier_b}' not found."}

        try:
            comparison = self.comparator.compare(
                name_a=doc_a["filename"], text_a=doc_a["full_text"],
                name_b=doc_b["filename"], text_b=doc_b["full_text"],
            )
            return {
                "success": True,
                "document_a": doc_a["filename"],
                "document_b": doc_b["filename"],
                "comparison": comparison,
            }
        except Exception as e:
            logger.error(f"Error comparing documents: {e}")
            return {"success": False, "error": str(e)}

    def suggest_questions(self, user_id: str, doc_id: str) -> dict:
        """Generate suggested follow-up questions for a document."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}

        try:
            questions = self.question_suggester.suggest(doc["full_text"])
            return {"success": True, "filename": doc["filename"], "questions": questions}
        except Exception as e:
            logger.error(f"Error suggesting questions for {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    # ── Collections (workspaces) ─────────────────────────────────────────────

    def create_collection(self, user_id: str, name: str) -> dict:
        collection_id = self.collection_store.create(user_id, name)
        return {"success": True, "collection_id": collection_id, "name": name}

    def list_collections(self, user_id: str) -> list[dict]:
        return self.collection_store.list_all(user_id=user_id)

    def get_collection(self, user_id: str, collection_id: str) -> dict | None:
        """Return a collection with its documents' metadata resolved."""
        collection = self.collection_store.get(collection_id, user_id=user_id)
        if collection is None:
            return None
        docs = [
            self.doc_store.get(doc_id, user_id=user_id) for doc_id in collection["doc_ids"]
            if self.doc_store.get(doc_id, user_id=user_id) is not None
        ]
        light_docs = [{k: v for k, v in d.items() if k != "full_text"} for d in docs]
        return {**collection, "documents": light_docs}

    def rename_collection(self, user_id: str, collection_id: str, new_name: str) -> dict:
        ok = self.collection_store.rename(collection_id, new_name, user_id=user_id)
        if not ok:
            return {"success": False, "error": f"Collection '{collection_id}' not found."}
        return {"success": True, "collection_id": collection_id, "name": new_name}

    def delete_collection(self, user_id: str, collection_id: str) -> dict:
        ok = self.collection_store.delete(collection_id, user_id=user_id)
        if not ok:
            return {"success": False, "error": f"Collection '{collection_id}' not found."}
        return {"success": True}

    def get_document_versions(self, user_id: str, filename: str) -> list[dict]:
        """Return all versions for a given filename."""
        return self.version_store.get_versions(user_id, filename)

    def diff_document_versions(self, user_id: str, doc_id_a: str, doc_id_b: str) -> dict:
        doc_a = self.doc_store.get(doc_id_a, user_id=user_id)
        doc_b = self.doc_store.get(doc_id_b, user_id=user_id)
        if not doc_a or not doc_b:
            return {"success": False, "error": "One or both documents not found."}
        a_versions = self.version_store.get_versions(user_id, doc_a["filename"])
        b_versions = self.version_store.get_versions(user_id, doc_b["filename"])
        return {
            "success": True,
            "doc_a": doc_a["filename"],
            "doc_b": doc_b["filename"],
            "doc_a_versions": a_versions,
            "doc_b_versions": b_versions,
            "char_diff": len(doc_b["full_text"]) - len(doc_a["full_text"]),
        }

    def get_document_tables(self, user_id: str, doc_id: str) -> dict:
        """Extract tables from a document's source PDF."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if not doc:
            return {"success": False, "error": "Document not found."}
        if not doc["file_path"].endswith(".pdf"):
            return {"success": False, "error": "Table extraction only supported for PDFs."}
        try:
            tables = extract_tables(doc["file_path"])
            return {"success": True, "filename": doc["filename"], "tables": tables, "count": len(tables)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_summary(self, user_id: str, doc_id: str, as_pdf: bool = False) -> dict:
        """Export summary as markdown or PDF."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if not doc or not doc.get("summary"):
            return {"success": False, "error": "Summary not found. Generate it first."}
        data = {"filename": doc["filename"], "summary": doc["summary"]}
        if as_pdf:
            return {"success": True, "filename": doc["filename"], "pdf": export_pdf("summary", data)}
        return {"success": True, "filename": doc["filename"], "markdown": export_markdown("summary", data)}

    def export_study_notes(self, user_id: str, doc_id: str, notes: dict, as_pdf: bool = False) -> dict:
        """Export study notes as markdown or PDF."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if not doc:
            return {"success": False, "error": "Document not found."}
        data = {"filename": doc["filename"], **notes}
        if as_pdf:
            return {"success": True, "filename": doc["filename"], "pdf": export_pdf("study_notes", data)}
        return {"success": True, "filename": doc["filename"], "markdown": export_markdown("study_notes", data)}

    def export_history(self, user_id: str, limit: int = 100, as_pdf: bool = False) -> dict:
        """Export conversation history as markdown or PDF."""
        conversations = self.history.get_history(user_id=user_id, limit=limit)
        data = {"conversations": conversations}
        if as_pdf:
            return {"success": True, "pdf": export_pdf("history", data), "count": len(conversations)}
        return {"success": True, "markdown": export_markdown("history", data), "count": len(conversations)}

    def get_document(self, user_id: str, doc_id: str) -> dict | None:
        """Return one document's metadata (no full_text) or None if not found."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if doc is None:
            return None
        return {k: v for k, v in doc.items() if k != "full_text"}

    def list_documents(self, user_id: str) -> list[dict]:
        """Return metadata for all tracked documents (no full_text, keeps it light)."""
        return self.doc_store.list_summaries(user_id=user_id)

    def delete_document(self, user_id: str, doc_id: str) -> dict:
        """Delete a document: removes its chunks from Chroma, its file from
        disk, and its record from doc_store/collections."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}

        try:
            self.retriever.delete_by_source(doc["file_path"], user_id=user_id)
            file_path = Path(doc["file_path"])
            if file_path.exists():
                file_path.unlink()

            for c in self.collection_store.list_all(user_id=user_id):
                self.collection_store.remove_document(c["collection_id"], doc_id, user_id=user_id)

            self.doc_store.delete(doc_id, user_id=user_id)
            logger.info(f"Deleted document: {doc['filename']}")
            return {"success": True, "filename": doc["filename"]}
        except Exception as e:
            logger.error(f"Error deleting document {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def get_stats(self) -> dict:
        """Return collection statistics from the vector store."""
        return self.retriever.get_collection_info()

    def generate_study_notes(self, user_id: str, doc_id: str) -> dict:
        """Generate study notes (summary, flashcards, viva Qs, MCQs) for a document."""
        doc = self.doc_store.get(doc_id, user_id=user_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}
        try:
            notes = self.study_notes_generator.generate(doc["full_text"])
            return {"success": True, "filename": doc["filename"], **notes}
        except Exception as e:
            logger.error(f"Study notes error for {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def cross_document_analysis(self, user_id: str, doc_ids: list[str] | None = None) -> dict:
        """Find shared concepts across multiple documents.

        If doc_ids is None, uses ALL documents for this user.
        """
        all_docs = self.doc_store.list_summaries(user_id=user_id)
        if doc_ids:
            selected = [self.doc_store.get(d, user_id=user_id) for d in doc_ids if self.doc_store.get(d, user_id=user_id)]
        else:
            selected = [self.doc_store.get(d["doc_id"], user_id=user_id) for d in all_docs]

        if len(selected) < 2:
            return {"success": False, "error": "Need at least 2 documents for cross-document analysis."}

        docs_input = [{"filename": d["filename"], "full_text": d["full_text"]} for d in selected]
        try:
            return self.cross_doc_intelligence.find_cross_concepts(docs_input)
        except Exception as e:
            logger.error(f"Cross-document error: {e}")
            return {"success": False, "error": str(e)}

    def get_analytics(self, user_id: str) -> dict:
        """Return an analytics dashboard payload.

        Aggregates data from doc_store, collection_store, history, and the
        vector store — no extra dependencies needed.
        """
        from datetime import datetime, timezone

        chroma = self.retriever.get_collection_info()
        docs = self.doc_store.list_summaries(user_id=user_id)
        conversations = self.history.get_history(user_id=user_id)
        collections = self.collection_store.list_all(user_id=user_id)

        source_counts: dict[str, int] = {}
        for conv in conversations:
            for ctx in conv.get("context", []):
                src = ctx.get("source", "Unknown")
                source_counts[src] = source_counts.get(src, 0) + 1

        most_queried = max(source_counts, key=source_counts.get) if source_counts else None
        if most_queried:
            from pathlib import Path as _Path
            most_queried = _Path(most_queried).name

        today = datetime.now(timezone.utc).date().isoformat()
        queries_today = sum(
            1 for c in conversations
            if c.get("timestamp", "").startswith(today)
        )
        summarized = sum(1 for d in docs if d.get("summary") is not None)

        return {
            "total_documents": len(docs),
            "total_chunks": chroma["document_count"],
            "bm25_indexed_chunks": chroma.get("bm25_docs", 0),
            "retrieval_mode": "hybrid (dense + BM25)",
            "total_queries": len(conversations),
            "queries_today": queries_today,
            "total_collections": len(collections),
            "summarized_documents": summarized,
            "most_queried_document": most_queried,
            "llm_provider": self.llm_manager.provider,
            "llm_model": self.llm_manager.model_name,
        }
    
