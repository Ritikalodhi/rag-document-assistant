
"""Main RAG pipeline orchestration."""
 
from pathlib import Path
from src.document_processor import DocumentProcessor
from src.retriever import VectorRetriever
from src.llm import LLMManager
from src.history import ConversationManager
from loguru import logger
 
 
class RAGPipeline:
    """Orchestrates document ingestion, retrieval, and answer generation."""
 
    def __init__(self, model: str | None = None, temperature: float = 0.7):
        """Initialize the RAG pipeline.
 
        Args:
            model: Override the default LLM model from config (None = use config).
            temperature: Sampling temperature for the LLM (0–1).
        """
        # model=None lets LLMManager read OPENAI_MODEL / GEMINI_MODEL from config,
        # avoiding the old bug where "gpt-3.5-turbo" was hardcoded even for Gemini.
        self.doc_processor = DocumentProcessor()
        self.retriever = VectorRetriever()
        self.llm_manager = LLMManager(model=model, temperature=temperature)
        self.history = ConversationManager()
        logger.info("RAG Pipeline ready")
 
    def add_document(self, file_path: str) -> dict:
        """Load, chunk, and index a document.
 
        Returns:
            {"success": True, "file": name, "chunks": n}  on success
            {"success": False, "error": msg}              on failure
        """
        try:
            chunks = self.doc_processor.process_file(file_path)
            self.retriever.add_documents(chunks)
            logger.info(f"Indexed {len(chunks)} chunks from {file_path}")
            return {"success": True, "file": Path(file_path).name, "chunks": len(chunks)}
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            return {"success": False, "error": str(e)}
 
    def query(self, question: str, k: int = 4) -> dict:
        """Answer a question from the indexed documents.
 
        Returns:
            {"question", "answer", "context", "success"}
        """
        try:
            docs = self.retriever.retrieve(question, k=k)
 
            if not docs:
                return {
                    "question": question,
                    "answer": "No relevant documents found in the knowledge base.",
                    "context": [],
                    "success": False,
                }
 
            context = "\n---\n".join(
                f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
                for doc in docs
            )
            answer = self.llm_manager.generate_answer(context, question)
 
            context_list = [
                {"content": doc.page_content, "source": doc.metadata.get("source", "Unknown")}
                for doc in docs
            ]
 
            try:
                self.history.add_entry(question=question, answer=answer, context=context_list)
            except Exception:
                logger.exception("Failed to persist conversation entry")
 
            return {"question": question, "answer": answer, "context": context_list, "success": True}
 
        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            return {
                "question": question,
                "answer": f"Error processing query: {e}",
                "context": [],
                "success": False,
            }
 
    def get_stats(self) -> dict:
        """Return collection statistics from the vector store."""
        return self.retriever.get_collection_info()

# """Main RAG pipeline orchestration"""

# from pathlib import Path
# from src.document_processor import DocumentProcessor
# from src.retriever import VectorRetriever
# from src.llm import LLMManager
# from src.history import ConversationManager
# from loguru import logger


# class RAGPipeline:
#     """Main RAG pipeline"""

#     def __init__(self, model: str = "gpt-3.5-turbo", temperature: float = 0.7):
#         """Initialize RAG pipeline
        
#         Args:
#             model: LLM model to use
#             temperature: Temperature for response generation
#         """
#         self.doc_processor = DocumentProcessor()
#         self.retriever = VectorRetriever()
#         self.llm_manager = LLMManager(model=model, temperature=temperature)
#         self.history = ConversationManager()
#         logger.info("Initialized RAG Pipeline")

#     def add_document(self, file_path: str) -> dict:
#         """Add document to the pipeline
        
#         Args:
#             file_path: Path to document file
            
#         Returns:
#             Dictionary with processing results
#         """
#         try:
#             # Process document
#             chunks = self.doc_processor.process_file(file_path)
            
#             # Add to vector store
#             self.retriever.add_documents(chunks)
            
#             logger.info(f"Successfully added document: {file_path}")
#             return {
#                 "success": True,
#                 "file": Path(file_path).name,
#                 "chunks": len(chunks)
#             }
#         except Exception as e:
#             logger.error(f"Error adding document: {e}")
#             return {
#                 "success": False,
#                 "error": str(e)
#             }

#     def query(self, question: str, k: int = 4) -> dict:
#         """Query the RAG system
        
#         Args:
#             question: User's question
#             k: Number of documents to retrieve
            
#         Returns:
#             Dictionary with question, context, and answer
#         """
#         try:
#             # Retrieve relevant documents
#             retrieved_docs = self.retriever.retrieve(question, k=k)
            
#             if not retrieved_docs:
#                 return {
#                     "question": question,
#                     "answer": "No relevant documents found in the knowledge base.",
#                     "context": [],
#                     "success": False
#                 }
            
#             # Combine context from retrieved documents
#             context = "\n---\n".join(
#                 f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
#                 for doc in retrieved_docs
#             )
            
#             # Generate answer
#             answer = self.llm_manager.generate_answer(context, question)
            
#             logger.info(f"Generated answer for query: {question[:50]}...")
#             context_list = [
#                 {
#                     "content": doc.page_content,
#                     "source": doc.metadata.get('source', 'Unknown')
#                 }
#                 for doc in retrieved_docs
#             ]

#             # Persist conversation
#             try:
#                 self.history.add_entry(question=question, answer=answer, context=context_list)
#             except Exception:
#                 logger.exception("Failed to save conversation entry")

#             return {
#                 "question": question,
#                 "answer": answer,
#                 "context": context_list,
#                 "success": True
#             }
#         except Exception as e:
#             logger.error(f"Error querying RAG system: {e}")
#             return {
#                 "question": question,
#                 "answer": f"Error processing query: {str(e)}",
#                 "context": [],
#                 "success": False
#             }

#     def get_stats(self) -> dict:
#         """Get pipeline statistics
        
#         Returns:
#             Dictionary with pipeline statistics
#         """
#         return self.retriever.get_collection_info()
