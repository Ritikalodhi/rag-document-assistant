import os, shutil, json
from pathlib import Path

DATA = Path("data")

# Clear vector + BM25 index
shutil.rmtree(DATA / "chroma_db", ignore_errors=True)
for f in DATA.glob("bm25_index*"):
    f.unlink()

# Clear embedding cache
(DATA / "embedding_cache.json").unlink(missing_ok=True)

# Clear document records (use {} not [] — doc_store expects dict format)
(DATA / "documents.json").write_text("{}")
(DATA / "doc_versions.json").write_text("{}")

# Reset collections to empty dict format
(DATA / "collections.json").write_text("{}")

# Clear uploaded files
docs_dir = DATA / "documents"
if docs_dir.exists():
    shutil.rmtree(docs_dir)
docs_dir.mkdir()

print("Index reset complete. Re-upload your documents.")