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
from src.doc_store import DocumentStore
from src.collections import CollectionStore
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
        # Tracks per-document metadata (full text, summary, doc_id) on disk.
        self.doc_store = DocumentStore()
        # Tracks named collections (workspaces) of doc_ids.
        self.collection_store = CollectionStore()
        logger.info("RAG Pipeline ready")

    def add_document(self, file_path: str, collection_id: str | None = None) -> dict:
        """Load, chunk, and index a document.

        Also stores the document's full text in doc_store, and assigns it to
        a collection (defaults to the 'General' collection if none given).
        """
        try:
            documents = self.doc_processor.load_document(file_path)
            full_text = "\n\n".join(d.page_content for d in documents)
            chunks = self.doc_processor.split_documents(documents)
            self.retriever.add_documents(chunks)

            doc_id = self.doc_store.add(
                filename=Path(file_path).name,
                file_path=str(file_path),
                full_text=full_text,
                chunk_count=len(chunks),
            )

            target_collection = collection_id or self.collection_store.get_default_id()
            self.collection_store.add_document(target_collection, doc_id)

            logger.info(f"Indexed {len(chunks)} chunks from {file_path}")
            return {
                "success": True,
                "file": Path(file_path).name,
                "chunks": len(chunks),
                "doc_id": doc_id,
                "collection_id": target_collection,
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
            for doc, distance in unique_scored:
                # Fix 2: filename only, not full path
                raw_source = doc.metadata.get("source", "Unknown")
                clean_source = Path(raw_source).name if raw_source != "Unknown" else raw_source
                # Fix 3: page number from metadata (PyPDFLoader stores it as 'page')
                page = doc.metadata.get("page", None)
                confidence = round(max(0.0, min(1.0, 1 - distance / 2)) * 100, 1)
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

            return {
                "question": question,
                "answer": answer,
                "context": context_list,
                "retrieval_trace": retrieval_trace,
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

    def list_documents(self) -> list[dict]:
        """Return metadata for all tracked documents (no full_text, keeps it light)."""
        return self.doc_store.list_summaries()

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
            "total_queries": len(conversations),
            "queries_today": queries_today,
            "total_collections": len(collections),
            "summarized_documents": summarized,
            "most_queried_document": most_queried,
            "llm_provider": self.llm_manager.provider,
            "llm_model": self.llm_manager.model_name,
        }

# """Main RAG pipeline orchestration."""

# from pathlib import Path
# from src.document_processor import DocumentProcessor
# from src.retriever import VectorRetriever
# from src.llm import LLMManager
# from src.history import ConversationManager
# from src.summarizer import DocumentSummarizer
# from src.comparator import DocumentComparator
# from src.suggested_questions import QuestionSuggester
# from src.doc_store import DocumentStore
# from src.collections import CollectionStore
# from loguru import logger


# class RAGPipeline:
#     """Orchestrates document ingestion, retrieval, and answer generation."""

#     def __init__(self, model: str | None = None, temperature: float = 0.7):
#         self.doc_processor = DocumentProcessor()
#         self.retriever = VectorRetriever()
#         self.llm_manager = LLMManager(model=model, temperature=temperature)
#         self.history = ConversationManager()
#         self.summarizer = DocumentSummarizer(self.llm_manager)
#         self.comparator = DocumentComparator(self.llm_manager)
#         self.question_suggester = QuestionSuggester(self.llm_manager)
#         # Tracks per-document metadata (full text, summary, doc_id) on disk.
#         self.doc_store = DocumentStore()
#         # Tracks named collections (workspaces) of doc_ids.
#         self.collection_store = CollectionStore()
#         logger.info("RAG Pipeline ready")

#     def add_document(self, file_path: str, collection_id: str | None = None) -> dict:
#         """Load, chunk, and index a document.

#         Also stores the document's full text in doc_store, and assigns it to
#         a collection (defaults to the 'General' collection if none given).
#         """
#         try:
#             documents = self.doc_processor.load_document(file_path)
#             full_text = "\n\n".join(d.page_content for d in documents)
#             chunks = self.doc_processor.split_documents(documents)
#             self.retriever.add_documents(chunks)

#             doc_id = self.doc_store.add(
#                 filename=Path(file_path).name,
#                 file_path=str(file_path),
#                 full_text=full_text,
#                 chunk_count=len(chunks),
#             )

#             target_collection = collection_id or self.collection_store.get_default_id()
#             self.collection_store.add_document(target_collection, doc_id)

#             logger.info(f"Indexed {len(chunks)} chunks from {file_path}")
#             return {
#                 "success": True,
#                 "file": Path(file_path).name,
#                 "chunks": len(chunks),
#                 "doc_id": doc_id,
#                 "collection_id": target_collection,
#             }
#         except Exception as e:
#             logger.error(f"Error adding document: {e}")
#             return {"success": False, "error": str(e)}

#     def query(self, question: str, k: int = 4) -> dict:
#         """Answer a question from the indexed documents.

#         NEW (Feature 5): each source now includes a 0-100% confidence score,
#         derived from Chroma's cosine distance (lower distance = higher score).
#         """
#         try:
#             scored_docs = self.retriever.retrieve_with_scores(question, k=k)

#             if not scored_docs:
#                 return {
#                     "question": question,
#                     "answer": "No relevant documents found in the knowledge base.",
#                     "context": [],
#                     "success": False,
#                 }

#             docs = [doc for doc, _ in scored_docs]
#             context = "\n---\n".join(
#                 f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
#                 for doc in docs
#             )
#             answer = self.llm_manager.generate_answer(context, question)

#             # Chroma cosine distance is typically in [0, 2]; clamp and invert
#             # to a friendlier 0-100% "confidence" score for display purposes.
#             context_list = [
#                 {
#                     "content": doc.page_content,
#                     "source": doc.metadata.get("source", "Unknown"),
#                     "confidence_percent": round(max(0.0, min(1.0, 1 - distance / 2)) * 100, 1),
#                 }
#                 for doc, distance in scored_docs
#             ]

#             try:
#                 self.history.add_entry(question=question, answer=answer, context=context_list)
#             except Exception:
#                 logger.exception("Failed to persist conversation entry")

#             return {"question": question, "answer": answer, "context": context_list, "success": True}

#         except Exception as e:
#             logger.error(f"Error querying RAG system: {e}")
#             return {
#                 "question": question,
#                 "answer": f"Error processing query: {e}",
#                 "context": [],
#                 "success": False,
#             }

#     def summarize_document(self, doc_id: str) -> dict:
#         """Generate (or return cached) structured summary for a document."""
#         doc = self.doc_store.get(doc_id)
#         if doc is None:
#             return {"success": False, "error": f"Document '{doc_id}' not found."}

#         if doc.get("summary"):
#             return {"success": True, "filename": doc["filename"], "summary": doc["summary"], "cached": True}

#         try:
#             summary = self.summarizer.summarize_document(doc["full_text"])
#             self.doc_store.set_summary(doc_id, summary)
#             return {"success": True, "filename": doc["filename"], "summary": summary, "cached": False}
#         except Exception as e:
#             logger.error(f"Error summarizing document {doc_id}: {e}")
#             return {"success": False, "error": str(e)}

#     def _resolve_document(self, identifier: str) -> dict | None:
#         """Look up a document by doc_id first, falling back to filename."""
#         doc = self.doc_store.get(identifier)
#         if doc is not None:
#             return doc
#         return self.doc_store.get_by_filename(identifier)

#     def compare_documents(self, identifier_a: str, identifier_b: str) -> dict:
#         """Compare two documents (accepts doc_id or filename for each)."""
#         doc_a = self._resolve_document(identifier_a)
#         doc_b = self._resolve_document(identifier_b)

#         if doc_a is None:
#             return {"success": False, "error": f"Document '{identifier_a}' not found."}
#         if doc_b is None:
#             return {"success": False, "error": f"Document '{identifier_b}' not found."}

#         try:
#             comparison = self.comparator.compare(
#                 name_a=doc_a["filename"], text_a=doc_a["full_text"],
#                 name_b=doc_b["filename"], text_b=doc_b["full_text"],
#             )
#             return {
#                 "success": True,
#                 "document_a": doc_a["filename"],
#                 "document_b": doc_b["filename"],
#                 "comparison": comparison,
#             }
#         except Exception as e:
#             logger.error(f"Error comparing documents: {e}")
#             return {"success": False, "error": str(e)}

#     def suggest_questions(self, doc_id: str) -> dict:
#         """Generate suggested follow-up questions for a document."""
#         doc = self.doc_store.get(doc_id)
#         if doc is None:
#             return {"success": False, "error": f"Document '{doc_id}' not found."}

#         try:
#             questions = self.question_suggester.suggest(doc["full_text"])
#             return {"success": True, "filename": doc["filename"], "questions": questions}
#         except Exception as e:
#             logger.error(f"Error suggesting questions for {doc_id}: {e}")
#             return {"success": False, "error": str(e)}

#     # ── Collections (workspaces) ─────────────────────────────────────────────

#     def create_collection(self, name: str) -> dict:
#         collection_id = self.collection_store.create(name)
#         return {"success": True, "collection_id": collection_id, "name": name}

#     def list_collections(self) -> list[dict]:
#         return self.collection_store.list_all()

#     def get_collection(self, collection_id: str) -> dict | None:
#         """Return a collection with its documents' metadata resolved."""
#         collection = self.collection_store.get(collection_id)
#         if collection is None:
#             return None
#         docs = [
#             self.doc_store.get(doc_id) for doc_id in collection["doc_ids"]
#             if self.doc_store.get(doc_id) is not None
#         ]
#         # Strip full_text to keep the response light, same as list_documents().
#         light_docs = [{k: v for k, v in d.items() if k != "full_text"} for d in docs]
#         return {**collection, "documents": light_docs}

#     def list_documents(self) -> list[dict]:
#         """Return metadata for all tracked documents (no full_text, keeps it light)."""
#         return self.doc_store.list_summaries()

#     def get_stats(self) -> dict:
#         """Return collection statistics from the vector store."""
#         return self.retriever.get_collection_info()

#     def get_analytics(self) -> dict:
#         """Return an analytics dashboard payload.

#         Aggregates data from doc_store, collection_store, history, and the
#         vector store — no extra dependencies needed.
#         """
#         from datetime import datetime, timezone

#         chroma = self.retriever.get_collection_info()
#         docs = self.doc_store.list_summaries()
#         conversations = self.history.get_history()
#         collections = self.collection_store.list_all()

#         # Queries per document (based on conversation context sources)
#         source_counts: dict[str, int] = {}
#         for conv in conversations:
#             for ctx in conv.get("context", []):
#                 src = ctx.get("source", "Unknown")
#                 source_counts[src] = source_counts.get(src, 0) + 1

#         most_queried = max(source_counts, key=source_counts.get) if source_counts else None
#         # Shorten to filename only for display
#         if most_queried:
#             from pathlib import Path as _Path
#             most_queried = _Path(most_queried).name

#         # Queries today
#         today = datetime.now(timezone.utc).date().isoformat()
#         queries_today = sum(
#             1 for c in conversations
#             if c.get("timestamp", "").startswith(today)
#         )

#         # Summarized doc count
#         summarized = sum(1 for d in docs if d.get("summary") is not None)

#         return {
#             "total_documents": len(docs),
#             "total_chunks": chroma["document_count"],
#             "total_queries": len(conversations),
#             "queries_today": queries_today,
#             "total_collections": len(collections),
#             "summarized_documents": summarized,
#             "most_queried_document": most_queried,
#             "llm_provider": self.llm_manager.provider,
#             "llm_model": self.llm_manager.model_name,
#         }
