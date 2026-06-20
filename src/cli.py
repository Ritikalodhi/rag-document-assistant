
"""Command-line interface for RAG Document Assistant."""
 
import sys
from pathlib import Path
 
from loguru import logger
from src.rag_pipeline import RAGPipeline
 
 
def print_banner():
    print("""
    ╔════════════════════════════════════════════╗
    ║   RAG Document Assistant - CLI Interface   ║
    ║         Personal Document Q&A System       ║
    ╚════════════════════════════════════════════╝
    """)
 
 
def print_menu():
    print("""
    Commands:
    1. upload   - Upload a document
    2. query    - Ask a question
    3. stats    - Show collection statistics
    4. help     - Show this menu
    5. exit     - Exit the program
    """)
 
 
def upload_document(rag: RAGPipeline):
    file_path_str = input("Enter the path to your document: ").strip()
    if not file_path_str:
        print("❌ No file path provided.")
        return
 
    file_path = Path(file_path_str)
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return
 
    print(f"\n📤 Uploading {file_path.name}…")
    result = rag.add_document(str(file_path))
 
    if result["success"]:
        print(f"✅ Success! Processed {result['chunks']} chunks.")
    else:
        print(f"❌ Error: {result['error']}")
 
 
def query_documents(rag: RAGPipeline):
    question = input("\nWhat would you like to know? ").strip()
    if not question:
        print("❌ No question provided.")
        return
 
    k_input = input("Number of sources to retrieve (default: 4): ").strip()
    k = int(k_input) if k_input.isdigit() and int(k_input) > 0 else 4
 
    print("\n🔍 Searching…")
    result = rag.query(question, k=k)
 
    if result["success"]:
        print(f"\n💡 Answer:\n{result['answer']}")
        print(f"\n📚 Sources ({len(result['context'])})")
        for i, ctx in enumerate(result["context"], 1):
            print(f"\n   Source {i}: {ctx['source']}")
            snippet = ctx["content"][:200]
            print(f"   {snippet}{'…' if len(ctx['content']) > 200 else ''}")
    else:
        print(f"❌ {result['answer']}")
 
 
def show_stats(rag: RAGPipeline):
    # BUG FIX: original accessed stats keys with no error handling — if
    # get_stats() raised (e.g. Chroma not initialised), the CLI crashed.
    try:
        stats = rag.get_stats()
        print(f"""
    📊 Collection Statistics:
    - Collection Name : {stats['collection_name']}
    - Documents       : {stats['document_count']}
    - Storage         : {stats['persist_dir']}
        """)
    except Exception as e:
        print(f"❌ Could not retrieve stats: {e}")
 
 
def main():
    print_banner()
 
    print("🚀 Initialising RAG Pipeline…")
    try:
        rag = RAGPipeline()
    except Exception as e:
        # Surface config/API-key errors immediately instead of a bare traceback.
        print(f"❌ Failed to initialise pipeline: {e}")
        sys.exit(1)
    print("✅ Ready!\n")
 
    print_menu()
 
    while True:
        try:
            command = input("\n> Enter command (or 'help' for menu): ").strip().lower()
        except EOFError:
            # Handles non-interactive / piped input gracefully.
            break
 
        if command in {"1", "upload"}:
            upload_document(rag)
        elif command in {"2", "query"}:
            query_documents(rag)
        elif command in {"3", "stats"}:
            show_stats(rag)
        elif command in {"4", "help"}:
            print_menu()
        elif command in {"5", "exit", "quit", "q"}:
            print("\n👋 Goodbye!")
            sys.exit(0)
        else:
            print("❌ Unknown command. Type 'help' for available commands.")
 
 
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted. Goodbye!")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)

# """Command-line interface for RAG Document Assistant"""

# import sys
# from pathlib import Path
# from src.rag_pipeline import RAGPipeline
# from loguru import logger


# def print_banner():
#     """Print welcome banner"""
#     print("""
#     ╔════════════════════════════════════════════╗
#     ║   RAG Document Assistant - CLI Interface   ║
#     ║         Personal Document Q&A System       ║
#     ╚════════════════════════════════════════════╝
#     """)


# def print_menu():
#     """Print menu options"""
#     print("""
#     Commands:
#     1. upload   - Upload a document
#     2. query    - Ask a question
#     3. stats    - Show collection statistics
#     4. help     - Show this menu
#     5. exit     - Exit the program
#     """)


# def upload_document(rag: RAGPipeline):
#     """Upload a document"""
#     file_path = input("Enter the path to your document: ").strip()
    
#     if not file_path:
#         print("❌ No file path provided")
#         return
    
#     file_path = Path(file_path)
#     if not file_path.exists():
#         print(f"❌ File not found: {file_path}")
#         return
    
#     print(f"\n📤 Uploading {file_path.name}...")
#     result = rag.add_document(str(file_path))
    
#     if result["success"]:
#         print(f"✅ Success! Processed {result['chunks']} chunks")
#     else:
#         print(f"❌ Error: {result['error']}")


# def query_documents(rag: RAGPipeline):
#     """Query documents"""
#     question = input("\nWhat would you like to know? ").strip()
    
#     if not question:
#         print("❌ No question provided")
#         return
    
#     k = input("Number of sources to retrieve (default: 4): ").strip()
#     k = int(k) if k.isdigit() else 4
    
#     print(f"\n🔍 Searching...")
#     result = rag.query(question, k=k)
    
#     if result["success"]:
#         print(f"\n💡 Answer:")
#         print(f"{result['answer']}")
#         print(f"\n📚 Sources ({len(result['context'])})")
#         for i, ctx in enumerate(result['context'], 1):
#             print(f"\n   Source {i}: {ctx['source']}")
#             print(f"   {ctx['content'][:200]}...")
#     else:
#         print(f"❌ Error: {result['answer']}")


# def show_stats(rag: RAGPipeline):
#     """Show collection statistics"""
#     stats = rag.get_stats()
#     print(f"""
#     📊 Collection Statistics:
#     - Collection Name: {stats['collection_name']}
#     - Documents: {stats['document_count']}
#     - Storage: {stats['persist_dir']}
#     """)


# def main():
#     """Main CLI loop"""
#     print_banner()
    
#     print("🚀 Initializing RAG Pipeline...")
#     rag = RAGPipeline()
#     print("✅ Ready!\n")
    
#     print_menu()
    
#     while True:
#         command = input("\n> Enter command (or 'help' for menu): ").strip().lower()
        
#         if command in ["1", "upload"]:
#             upload_document(rag)
        
#         elif command in ["2", "query"]:
#             query_documents(rag)
        
#         elif command in ["3", "stats"]:
#             show_stats(rag)
        
#         elif command in ["4", "help"]:
#             print_menu()
        
#         elif command in ["5", "exit"]:
#             print("\n👋 Goodbye!")
#             sys.exit(0)
        
#         else:
#             print("❌ Unknown command. Type 'help' for available commands.")


# if __name__ == "__main__":
#     try:
#         main()
#     except KeyboardInterrupt:
#         print("\n\n👋 Interrupted. Goodbye!")
#         sys.exit(0)
#     except Exception as e:
#         logger.error(f"Fatal error: {e}")
#         print(f"\n❌ Fatal error: {e}")
#         sys.exit(1)
