<!-- 1. Stop your backend server first

Make sure nothing is running/writing to these files.

2. Delete the data files

From your project root:

powershell
cd C:\Users\Ritika\OneDrive\Desktop\rag-document-assistant-main\data

del documents.json
del doc_versions.json
del collections.json
del conversations.json
del embedding_cache.json
del bm25_index.pkl
rmdir /s /q chroma_db
rmdir /s /q documents

This removes:

chroma_db/ — the actual vector embeddings (this is the big one)
documents/ — your stored uploaded PDF files
documents.json / doc_versions.json — document metadata
collections.json — folder/workspace organization
conversations.json — chat history
embedding_cache.json — cached embeddings
bm25_index.pkl — keyword search index

3. Recreate empty folders (your app likely expects them to exist)
powershell
mkdir chroma_db
mkdir documents
4. Also clear browser-side state

In your browser dev tools (F12) → Application tab → Local Storage → clear entries for your app's origin. This removes the lastViewedDocId we just added, plus any cached frontend state.

5. Restart your backend
powershell
python your_main_file.py

(or however you normally start it)

6. Verify it's empty

Open the app — Documents page should show zero documents, Chat should have no history.

Want me to write this as a single .bat or Python script you can just double-click/run instead of typing each command? -->