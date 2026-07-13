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
from src.doc_store import DocumentStore
from src.collections import CollectionStore
from src.table_extractor import extract_tables, PDFPLUMBER_AVAILABLE
from src.exporter import export_markdown, export_pdf
from src.versioning import DocumentVersionStore
from loguru import logger


class RAGPipeline:
    """Orchestrates document ingestion, retrieval, and answer generation."""

    def __init__(self, model: str | None = None, temperature: float = 0.7):
        self.doc_processor = DocumentProcessor()
        self.retriever = VectorRetriever()
        self.llm_manager = LLMManager(model=model, temperature=temperature)
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
        logger.info("RAG Pipeline ready")

    def add_document(self, file_path: str, collection_id: str | None = None) -> dict:
        """Load, chunk, and index a document.

        Also stores the document's full text in doc_store, assigns it to
        a collection, registers a version, and extracts tables from PDFs.
        """
        try:
            documents = self.doc_processor.load_document(file_path)
            full_text = "\n\n".join(d.page_content for d in documents)
            filename = Path(file_path).name

            # Versioning: check for duplicate content
            existing = self.version_store.check_duplicate(filename, full_text)
            if existing:
                logger.info(f"Duplicate content detected for {filename} (version {existing['version']})")
                return {
                    "success": True,
                    "file": filename,
                    "chunks": 0,
                    "doc_id": existing["doc_id"],
                    "duplicate": True,
                    "existing_version": existing["version"],
                    "message": f"Identical content already indexed as version {existing['version']}.",
                }

            chunks = self.doc_processor.split_documents(documents)
            self.retriever.add_documents(chunks)

            doc_id = self.doc_store.add(
                filename=filename,
                file_path=str(file_path),
                full_text=full_text,
                chunk_count=len(chunks),
            )

            # Register version
            self.version_store.add_version(filename, full_text, doc_id, user_id="system")

            target_collection = collection_id or self.collection_store.get_default_id()
            self.collection_store.add_document(target_collection, doc_id)

            # Extract tables from PDFs
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
            logger.error(f"Error adding document: {e}")
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

    def stream_query(self, question: str, k: int = 4):
        """Stream answer tokens. Yields SSE-formatted strings.

        Format: data: <token>\n\n
        Final:  data: [DONE]\n\n
        """
        import json as _json

        # Retrieve context (same as query())
        section = self._detect_section(question)
        scored_docs = self.retriever.retrieve_with_scores(question, k=k*2)
        if section:
            filtered = [(d,s) for d,s in scored_docs if section in d.page_content.lower()]
            scored_docs = filtered if filtered else scored_docs

        seen, unique_scored = set(), []
        for doc, score in scored_docs:
            h = hash(doc.page_content.strip())
            if h not in seen:
                seen.add(h)
                unique_scored.append((doc, score))
            if len(unique_scored) == k:
                break

        if not unique_scored:
            yield "data: " + _json.dumps({"type": "error", "content": "No relevant documents found."}) + "\n\n"
            return

        # Send context metadata first
        context_list = []
        for doc, confidence in unique_scored:
            raw = doc.metadata.get("source", "Unknown")
            from pathlib import Path as _Path
            page = doc.metadata.get("page", None)
            entry = {
                "content": doc.page_content,
                "source": _Path(raw).name if raw != "Unknown" else raw,
                "confidence_percent": confidence,
            }
            if page is not None:
                entry["page"] = page + 1
            context_list.append(entry)

        yield "data: " + _json.dumps({"type": "context", "context": context_list}) + "\n\n"

        # Build context string and stream answer
        context_str = "\n---\n".join(
            f"Source: {d.metadata.get('source','Unknown')}\n{d.page_content}"
            for d, _ in unique_scored
        )

        full_answer = []
        for token in self.llm_manager.stream_answer(context_str, question):
            full_answer.append(token)
            yield "data: " + _json.dumps({"type": "token", "content": token}) + "\n\n"

        # Save to history
        answer = "".join(full_answer)
        try:
            self.history.add_entry(question=question, answer=answer, context=context_list)
        except Exception:
            logger.exception("Failed to persist streamed conversation")

        yield "data: " + _json.dumps({"type": "done"}) + "\n\n"

    def query(self, question: str, k: int = 4) -> dict:
        """Answer a question from the indexed documents.

        Fixes applied:
        1. Section detection — bypasses vector search for section-specific queries.
        2. Deduplication — removes duplicate chunks before sending to LLM.
        3. Clean source — returns filename only, not full path.
        4. Page number — included when available in chunk metadata.
        5. Retrieval trace — shows query→chunks→scores→answer pipeline.
        """
        try:
            # Fix 1: section-aware retrieval — filter by section keyword if detected
            section = self._detect_section(question)
            if section:
                scored_docs = self.retriever.retrieve_with_scores(question, k=k * 2)
                # Keep only chunks whose content mentions the section heading
                filtered = [
                    (doc, score) for doc, score in scored_docs
                    if section in doc.page_content.lower()
                ]
                # Fall back to full results if no section-matching chunks found
                scored_docs = filtered if filtered else scored_docs
            else:
                scored_docs = self.retriever.retrieve_with_scores(question, k=k * 2)

            if not scored_docs:
                return {
                    "question": question,
                    "answer": "No relevant documents found in the knowledge base.",
                    "context": [],
                    "retrieval_trace": {},
                    "success": False,
                }

            # Fix 1: Deduplicate by content hash
            seen, unique_scored = set(), []
            for doc, score in scored_docs:
                content_hash = hash(doc.page_content.strip())
                if content_hash not in seen:
                    seen.add(content_hash)
                    unique_scored.append((doc, score))
                if len(unique_scored) == k:
                    break

            docs = [doc for doc, _ in unique_scored]
            context = "\n---\n".join(
                f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
                for doc in docs
            )
            answer = self.llm_manager.generate_answer(context, question)

            context_list = []
            for doc, confidence in unique_scored:
                # Fix 2: filename only, not full path
                raw_source = doc.metadata.get("source", "Unknown")
                clean_source = Path(raw_source).name if raw_source != "Unknown" else raw_source
                # Fix 3: page number from metadata (PyPDFLoader stores it as 'page')
                page = doc.metadata.get("page", None)
                # confidence is already 0-100 from the hybrid retriever
                entry = {
                    "content": doc.page_content,
                    "source": clean_source,
                    "confidence_percent": confidence,
                }
                if page is not None:
                    entry["page"] = page + 1  # convert 0-indexed to 1-indexed
                context_list.append(entry)

            # Fix 5: retrieval trace for transparency
            retrieval_trace = {
                "query": question,
                "chunks_retrieved": len(unique_scored),
                "chunks_before_dedup": len(scored_docs),
                "duplicates_removed": len(scored_docs) - len(unique_scored),
                "scores": [c["confidence_percent"] for c in context_list],
            }

            try:
                self.history.add_entry(question=question, answer=answer, context=context_list)
            except Exception:
                logger.exception("Failed to persist conversation entry")

            # Answer confidence scoring
            confidence_score = self.confidence_scorer.score(
                question=question,
                answer=answer,
                context_list=context_list,
            )

            return {
                "question": question,
                "answer": answer,
                "context": context_list,
                "retrieval_trace": retrieval_trace,
                "confidence_score": confidence_score,
                "success": True,
            }

        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            return {
                "question": question,
                "answer": f"Error processing query: {e}",
                "context": [],
                "retrieval_trace": {},
                "success": False,
            }

    def summarize_document(self, doc_id: str) -> dict:
        """Generate (or return cached) structured summary for a document."""
        doc = self.doc_store.get(doc_id)
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

    def _resolve_document(self, identifier: str) -> dict | None:
        """Look up a document by doc_id first, falling back to filename."""
        doc = self.doc_store.get(identifier)
        if doc is not None:
            return doc
        return self.doc_store.get_by_filename(identifier)

    def compare_documents(self, identifier_a: str, identifier_b: str) -> dict:
        """Compare two documents (accepts doc_id or filename for each)."""
        doc_a = self._resolve_document(identifier_a)
        doc_b = self._resolve_document(identifier_b)

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

    def suggest_questions(self, doc_id: str) -> dict:
        """Generate suggested follow-up questions for a document."""
        doc = self.doc_store.get(doc_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}

        try:
            questions = self.question_suggester.suggest(doc["full_text"])
            return {"success": True, "filename": doc["filename"], "questions": questions}
        except Exception as e:
            logger.error(f"Error suggesting questions for {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    # ── Collections (workspaces) ─────────────────────────────────────────────

    def create_collection(self, name: str) -> dict:
        collection_id = self.collection_store.create(name)
        return {"success": True, "collection_id": collection_id, "name": name}

    def list_collections(self) -> list[dict]:
        return self.collection_store.list_all()

    def get_collection(self, collection_id: str) -> dict | None:
        """Return a collection with its documents' metadata resolved."""
        collection = self.collection_store.get(collection_id)
        if collection is None:
            return None
        docs = [
            self.doc_store.get(doc_id) for doc_id in collection["doc_ids"]
            if self.doc_store.get(doc_id) is not None
        ]
        # Strip full_text to keep the response light, same as list_documents().
        light_docs = [{k: v for k, v in d.items() if k != "full_text"} for d in docs]
        return {**collection, "documents": light_docs}

    def rename_collection(self, collection_id: str, new_name: str) -> dict:
        ok = self.collection_store.rename(collection_id, new_name)
        if not ok:
            return {"success": False, "error": f"Collection '{collection_id}' not found."}
        return {"success": True, "collection_id": collection_id, "name": new_name}

    def delete_collection(self, collection_id: str) -> dict:
        ok = self.collection_store.delete(collection_id)
        if not ok:
            return {"success": False, "error": f"Collection '{collection_id}' not found."}
        return {"success": True}

    def get_document_versions(self, filename: str) -> list[dict]:
        """Return all versions for a given filename."""
        return self.version_store.get_versions(filename)

    def diff_document_versions(self, doc_id_a: str, doc_id_b: str) -> dict:
        """Diff two document versions by their doc_ids."""
        doc_a = self.doc_store.get(doc_id_a)
        doc_b = self.doc_store.get(doc_id_b)
        if not doc_a or not doc_b:
            return {"success": False, "error": "One or both documents not found."}
        diff = self.version_store.diff_versions(doc_a["full_text"], doc_b["full_text"])
        return {"success": True, "diff": diff, "doc_a": doc_a["filename"], "doc_b": doc_b["filename"]}

    def get_document_tables(self, doc_id: str) -> dict:
        """Extract tables from a document's source PDF."""
        doc = self.doc_store.get(doc_id)
        if not doc:
            return {"success": False, "error": "Document not found."}
        if not doc["file_path"].endswith(".pdf"):
            return {"success": False, "error": "Table extraction only supported for PDFs."}
        try:
            tables = extract_tables(doc["file_path"])
            return {"success": True, "filename": doc["filename"], "tables": tables, "count": len(tables)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_summary(self, doc_id: str, as_pdf: bool = False) -> dict:
        """Export summary as markdown or PDF."""
        doc = self.doc_store.get(doc_id)
        if not doc or not doc.get("summary"):
            return {"success": False, "error": "Summary not found. Generate it first."}
        data = {"filename": doc["filename"], "summary": doc["summary"]}
        if as_pdf:
            return {"success": True, "filename": doc["filename"], "pdf": export_pdf("summary", data)}
        return {"success": True, "filename": doc["filename"], "markdown": export_markdown("summary", data)}

    def export_study_notes(self, doc_id: str, notes: dict, as_pdf: bool = False) -> dict:
        """Export study notes as markdown or PDF."""
        doc = self.doc_store.get(doc_id)
        if not doc:
            return {"success": False, "error": "Document not found."}
        data = {"filename": doc["filename"], **notes}
        if as_pdf:
            return {"success": True, "filename": doc["filename"], "pdf": export_pdf("study_notes", data)}
        return {"success": True, "filename": doc["filename"], "markdown": export_markdown("study_notes", data)}

    def export_history(self, limit: int = 100, as_pdf: bool = False) -> dict:
        """Export conversation history as markdown or PDF."""
        conversations = self.history.get_history(limit=limit)
        data = {"conversations": conversations}
        if as_pdf:
            return {"success": True, "pdf": export_pdf("history", data), "count": len(conversations)}
        return {"success": True, "markdown": export_markdown("history", data), "count": len(conversations)}

    def get_document(self, doc_id: str) -> dict | None:
        """Return one document's metadata (no full_text) or None if not found."""
        doc = self.doc_store.get(doc_id)
        if doc is None:
            return None
        return {k: v for k, v in doc.items() if k != "full_text"}

    def list_documents(self) -> list[dict]:
        """Return metadata for all tracked documents (no full_text, keeps it light)."""
        return self.doc_store.list_summaries()

    def delete_document(self, doc_id: str) -> dict:
        """Delete a document: removes its chunks from Chroma, its file from
        disk, and its record from doc_store/collections."""
        doc = self.doc_store.get(doc_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}

        try:
            # Remove chunks from Chroma matching this file's path
            self.retriever.delete_by_source(doc["file_path"])

            # Remove the file from disk
            file_path = Path(doc["file_path"])
            if file_path.exists():
                file_path.unlink()

            # Remove from any collections
            for c in self.collection_store.list_all():
                self.collection_store.remove_document(c["collection_id"], doc_id)

            # Remove doc_store record
            self.doc_store.delete(doc_id)

            logger.info(f"Deleted document: {doc['filename']}")
            return {"success": True, "filename": doc["filename"]}
        except Exception as e:
            logger.error(f"Error deleting document {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def get_stats(self) -> dict:
        """Return collection statistics from the vector store."""
        return self.retriever.get_collection_info()

    def generate_study_notes(self, doc_id: str) -> dict:
        """Generate study notes (summary, flashcards, viva Qs, MCQs) for a document."""
        doc = self.doc_store.get(doc_id)
        if doc is None:
            return {"success": False, "error": f"Document '{doc_id}' not found."}
        try:
            notes = self.study_notes_generator.generate(doc["full_text"])
            return {"success": True, "filename": doc["filename"], **notes}
        except Exception as e:
            logger.error(f"Study notes error for {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def cross_document_analysis(self, doc_ids: list[str] | None = None) -> dict:
        """Find shared concepts across multiple documents.

        If doc_ids is None, uses ALL documents in the store.
        """
        all_docs = self.doc_store.list_summaries()
        if doc_ids:
            selected = [self.doc_store.get(d) for d in doc_ids if self.doc_store.get(d)]
        else:
            selected = [self.doc_store.get(d["doc_id"]) for d in all_docs]

        if len(selected) < 2:
            return {"success": False, "error": "Need at least 2 documents for cross-document analysis."}

        docs_input = [{"filename": d["filename"], "full_text": d["full_text"]} for d in selected]
        try:
            return self.cross_doc_intelligence.find_cross_concepts(docs_input)
        except Exception as e:
            logger.error(f"Cross-document error: {e}")
            return {"success": False, "error": str(e)}

    def get_analytics(self) -> dict:
        """Return an analytics dashboard payload.

        Aggregates data from doc_store, collection_store, history, and the
        vector store — no extra dependencies needed.
        """
        from datetime import datetime, timezone

        chroma = self.retriever.get_collection_info()
        docs = self.doc_store.list_summaries()
        conversations = self.history.get_history()
        collections = self.collection_store.list_all()

        # Queries per document (based on conversation context sources)
        source_counts: dict[str, int] = {}
        for conv in conversations:
            for ctx in conv.get("context", []):
                src = ctx.get("source", "Unknown")
                source_counts[src] = source_counts.get(src, 0) + 1

        most_queried = max(source_counts, key=source_counts.get) if source_counts else None
        # Shorten to filename only for display
        if most_queried:
            from pathlib import Path as _Path
            most_queried = _Path(most_queried).name

        # Queries today
        today = datetime.now(timezone.utc).date().isoformat()
        queries_today = sum(
            1 for c in conversations
            if c.get("timestamp", "").startswith(today)
        )

        # Summarized doc count
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
