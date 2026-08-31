#!/usr/bin/env python3
"""
Comprehensive RAG Diagnostic Tool
Traces the COMPLETE RAG pipeline stage-by-stage to identify exactly where
correct chunks disappear. Uses the existing DocumentStore API (list_summaries).
"""
import sys
import io
import os
from pathlib import Path
from collections import Counter
from dotenv import load_dotenv

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv()

from src.config import (
    CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_SIZE, TOP_K,
    CHUNK_STRATEGY, RERANKER_ENABLED, RERANKER_CANDIDATES,
    MEMORY_WINDOW, MEMORY_MAX_CHARS, DOCUMENT_DIR,
)
from src.retriever import VectorRetriever
from src.doc_store import DocumentStore
from src.rag_pipeline import RAGPipeline
from loguru import logger

# Silence loguru to keep output clean
logger.remove()


def print_section(title: str):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}")


def chunk_meta(doc) -> dict:
    m = doc.metadata or {}
    return {
        "page": m.get("page", "?"),
        "section_number": m.get("section_number"),
        "section_title": m.get("section_title"),
        "subsection_number": m.get("subsection_number"),
        "subsection_title": m.get("subsection_title"),
        "section_path": m.get("section_path"),
    }


def short_text(doc, n=150):
    return doc.page_content[:n].replace("\n", " ")


def diagnose_configuration():
    print_section("1. CONFIGURATION")
    config = {
        "Chunk Size": CHUNK_SIZE,
        "Chunk Overlap": CHUNK_OVERLAP,
        "Min Chunk Size": MIN_CHUNK_SIZE,
        "Chunking Strategy": CHUNK_STRATEGY,
        "TOP_K (final chunks to LLM)": TOP_K,
        "Reranker Enabled": RERANKER_ENABLED,
        "Reranker Candidates": RERANKER_CANDIDATES,
        "Memory Window (turns)": MEMORY_WINDOW,
        "Memory Max Chars": MEMORY_MAX_CHARS,
    }
    for key, value in config.items():
        print(f"  {key:<40} {value}")


def diagnose_document_stats():
    """Use the EXISTING DocumentStore API (list_summaries, NOT list_all)."""
    print_section("2. DOCUMENT STORE (via list_summaries)")
    try:
        doc_store = DocumentStore()
        docs = doc_store.list_summaries()
        print(f"  Total documents: {len(docs)}")
        for doc in docs:
            print(f"    - {doc['filename']}: {doc.get('chunk_count', 0)} chunks")
        if not docs:
            print("  WARNING: No documents! Upload documents first.")
    except Exception as e:
        print(f"  ERROR accessing document store: {e}")


def inspect_raw_metadata():
    """Inspect raw indexed metadata from Chroma to verify IV/V/VI labels."""
    print_section("3. RAW INDEXED METADATA VERIFICATION")
    retriever = VectorRetriever()
    collection = retriever.vectorstore._collection
    count = collection.count()
    print(f"  Total chunks in Chroma: {count}")

    result = collection.get(include=["metadatas", "documents"])
    metas = result["metadatas"]
    docs = result["documents"]

    # Section distribution summary
    section_counts = Counter()
    for m in metas:
        sn = m.get("section_number")
        st = m.get("section_title")
        key = f"{sn} | {st[:50]}" if sn else "None | (no section)"
        section_counts[key] += 1

    print("\n  Section distribution:")
    for key, cnt in sorted(section_counts.items()):
        print(f"    {cnt:>3} chunks : {key}")

    # IV/V/VI verification
    print("\n  VERIFICATION: IV.* / V.* / VI.*")
    iv = [i for i, m in enumerate(metas) if m.get("section_number") == "IV"]
    v = [i for i, m in enumerate(metas) if m.get("section_number") == "V"]
    vi = [i for i, m in enumerate(metas) if m.get("section_number") == "VI"]
    print(f"    IV.* chunks : {len(iv)}")
    print(f"    V.* chunks  : {len(v)}  <-- EXPECTED V.* sections (V. Algorithm Design)")
    print(f"    VI.* chunks : {len(vi)}")

    # Specific check: V.C Post-Processing must NOT be labeled IV.Methodology
    print("\n  CHECK A: Is 'C. Post-Processing Algorithm' (paper V.C) mislabeled as IV.Methodology?")
    for i, m in enumerate(metas):
        st = (m.get("subsection_title") or "").lower()
        if "post-processing" in st:
            print(f"    Chunk {i}:")
            print(f"      section_number   = {m.get('section_number')}")
            print(f"      section_title    = {m.get('section_title')}")
            print(f"      subsection_number= {m.get('subsection_number')}")
            print(f"      subsection_title = {m.get('subsection_title')}")
            print(f"      section_path     = {m.get('section_path')}")
            print(f"      text[:80]        = {docs[i][:80]!r}")
            is_iv = m.get("section_number") == "IV"
            print(f"      => {'MISLABELED as IV.Methodology' if is_iv else 'OK'}")

    # Specific check: Is V. Algorithm Design a detected main section?
    print("\n  CHECK B: Is 'V. Algorithm Design' a main section in metadata?")
    v_design = [i for i, m in enumerate(metas)
                if m.get("section_number") == "V" or
                (m.get("section_title") or "").lower() == "algorithm design"]
    if v_design:
        for i in v_design:
            print(f"    Found chunk {i}: {metas[i].get('section_path')}")
    else:
        print("    NO chunks labeled 'V. Algorithm Design'!")
        # Find text occurrences
        for i, doc in enumerate(docs):
            if "V. Algorithm Design" in doc:
                print(f"    Text contains 'V. Algorithm Design' in chunk {i}, "
                      f"but chunk is labeled section={metas[i].get('section_number')} | "
                      f"section_title={metas[i].get('section_title')} | "
                      f"section_path={metas[i].get('section_path')}")

    # Check X. Conclusion and VII. Implementation placement
    print("\n  CHECK C: X. Conclusion / VII. Implementation / I. Introduction placement")
    for i, m in enumerate(metas):
        st = (m.get("subsection_title") or "")
        sn = m.get("subsection_number")
        if st in ("Conclusion", "Software Stack") or sn in ("X", "VII"):
            print(f"    Chunk {i}: section={m.get('section_number')} | "
                  f"section_title={m.get('section_title')} | "
                  f"subsection={sn} | subsection_title={st}")
            print(f"      section_path = {m.get('section_path')}")
    return retriever


def trace_pipeline_query(pipeline: RAGPipeline, retriever: VectorRetriever, question: str, user_id: str):
    """Trace the COMPLETE pipeline for one query, reporting counts at every stage."""
    print(f"\n{'━'*80}")
    print(f"  QUERY: {question}")
    print(f"{'━'*80}")

    from src.input_sanitizer import sanitize_question

    # ── 1. Sanitize ──
    sanitized = sanitize_question(question)
    q = sanitized.clean
    print(f"\n[1] Sanitized question: {q!r}")

    # ── 2. Rewrite (LLM, may fall back) ──
    rewritten = pipeline._rewrite_query(q)
    print(f"[2] Rewritten query  : {rewritten!r}")

    # ── 3. Detect sections from the ORIGINAL question ──
    sections = pipeline._detect_sections(q)
    print(f"[3] Detected sections: {sections}")

    # ── 4. Build sub-queries exactly like _retrieve ──
    q_lower = rewritten.lower()
    detected = pipeline._detect_sections(rewritten)
    sub_queries: list[str] = []
    if detected:
        sub_queries.extend(pipeline._get_section_queries(detected))
    if not detected or len(sub_queries) < 4:
        llm_sub = pipeline._decompose_query(rewritten, sections=detected)
        if llm_sub and llm_sub != [rewritten]:
            sub_queries.extend(llm_sub)
    # Dedup preserving order
    seen_q = set()
    dedup_queries = []
    for sq in sub_queries:
        key = sq.lower()
        if key not in seen_q:
            seen_q.add(key)
            dedup_queries.append(sq)
    if not dedup_queries:
        dedup_queries = [rewritten]
    print(f"[4] Sub-queries ({len(dedup_queries)}):")
    for i, sq in enumerate(dedup_queries):
        print(f"      {i+1}. {sq!r}")

    # ── 5. Retrieve per sub-query, tracing each stage ──
    # pipeline.filter = None (no user filter, no doc filter for this diagnostic)
    metadata_filter = None

    dense_total = 0
    bm25_total = 0
    rrf_total = 0
    reranked_total = 0
    merged_total = 0
    per_query_k = max(12, RERANKER_CANDIDATES // len(dedup_queries))
    candidate_count = max(per_query_k, RERANKER_CANDIDATES)
    k_fetch = candidate_count * 3
    print(f"\n[5] Per-query retrieval (per_query_k={per_query_k}, candidate_count={candidate_count}, fetch k={k_fetch})")

    seen_hashes = set()
    merged = []
    for sq_idx, sq in enumerate(dedup_queries, 1):
        print(f"\n    --- Sub-query {sq_idx}: {sq!r} ---")

        # 5a. Dense
        dense = retriever._dense_retrieve(sq, k=k_fetch, filter=metadata_filter)
        dense_total += len(dense)
        print(f"      5a. Dense retrieval    : {len(dense)} results")

        # 5b. BM25
        sparse = retriever._sparse_retrieve(sq, k=k_fetch, filter=metadata_filter) if retriever._bm25 else []
        bm25_total += len(sparse)
        print(f"      5b. BM25 retrieval     : {len(sparse)} results")

        # 5c. RRF fusion
        fused, mode = retriever._compose_results(dense, sparse, k=candidate_count)
        rrf_total += len(fused)
        print(f"      5c. RRF fusion         : {len(fused)} results (mode={mode})")

        # Confidence map (mirrors retrieve_with_scores)
        dense_conf = {}
        for doc, dist in dense:
            conf = round(max(0.0, min(1.0, 1 - dist / 2)) * 100, 1)
            dense_conf[doc.page_content[:200]] = conf
        scored = []
        for doc, _ in fused:
            confidence = dense_conf.get(doc.page_content[:200], 60.0 if mode == "bm25_fallback" else 50.0)
            scored.append((doc, confidence))

        # 5d. Rerank (top_k=per_query_k, exactly like retrieve_reranked)
        if retriever._reranker.available:
            reranked = retriever._reranker.rerank(sq, scored, top_k=per_query_k)
            reranked_pairs = [(r.document, r.confidence_percent) for r in reranked]
            reranked_total += len(reranked_pairs)
            print(f"      5d. Reranked          : {len(reranked_pairs)} results (top_k={per_query_k})")
        else:
            reranked_pairs = scored[:per_query_k]
            reranked_total += len(reranked_pairs)
            print(f"      5d. Reranker unavailable, took top {len(reranked_pairs)}")

        # 5e. Merge with dedup (like _retrieve multi-query path)
        before_merge = len(merged)
        for doc, score in reranked_pairs:
            h = pipeline._stable_content_hash(doc.page_content.strip())
            if h not in seen_hashes:
                seen_hashes.add(h)
                merged.append((doc, score))
        added = len(merged) - before_merge
        merged_total = len(merged)
        print(f"      5e. After merge+dedup : +{added} new (total {len(merged)})")

    # Cap merge at RERANKER_CANDIDATES * 2 (matches _retrieve)
    merged = merged[:RERANKER_CANDIDATES * 2]
    print(f"\n    Merged pool after cap ({RERANKER_CANDIDATES * 2}): {len(merged)}")

    # ── 6. _dedup_and_filter (dedup + section filter + cap at k) ──
    # _dedup_and_filter is called with k=TOP_K in query(); stream_query uses k too.
    # The pipeline's query() calls _dedup_and_filter(scored_docs, sections, k) where k=15 default.
    k_final = TOP_K
    seen2, deduped = set(), []
    for doc, score in merged:
        h = pipeline._stable_content_hash(doc.page_content.strip())
        if h not in seen2:
            seen2.add(h)
            deduped.append((doc, score))
    print(f"\n[6] Deduplicated            : {len(deduped)}")

    filtered = deduped
    if sections:
        meta_filtered = [(d, s) for d, s in deduped if pipeline._section_matches(d, sections)]
        if meta_filtered:
            filtered = meta_filtered
        else:
            content_filtered = [
                (d, s) for d, s in deduped
                if any(section in d.page_content.lower() for section in sections)
            ]
            if content_filtered:
                filtered = content_filtered
    print(f"[7] Section-filtered       : {len(filtered)} (requested: {sections})")

    final = filtered[:k_final]
    print(f"[8] Final TOP_K ({k_final})            : {len(final)}")

    # ── 9. Summary table ──
    print(f"\n  STAGE-BY-STAGE COUNTS:")
    print(f"    Dense candidates (sum over sub-queries): {dense_total}")
    print(f"    BM25 candidates (sum over sub-queries) : {bm25_total}")
    print(f"    RRF fused (sum over sub-queries)       : {rrf_total}")
    print(f"    Reranked (sum over sub-queries)        : {reranked_total}")
    print(f"    Merged + content-dedup                 : {merged_total}")
    print(f"    After cap ({RERANKER_CANDIDATES * 2})                  : {len(merged)}")
    print(f"    After dedup                            : {len(deduped)}")
    print(f"    After section filter                   : {len(filtered)}")
    print(f"    Final TOP_K                            : {len(final)}")

    # ── 10. Print every final chunk ──
    print(f"\n  FINAL CHUNKS (sent to LLM):")
    for idx, (doc, score) in enumerate(final, 1):
        m = chunk_meta(doc)
        print(f"\n    [{idx}] score={score:.1f}%")
        print(f"         page             : {m['page']}")
        print(f"         section_number   : {m['section_number']}")
        print(f"         section_title    : {m['section_title']}")
        print(f"         subsection_number: {m['subsection_number']}")
        print(f"         subsection_title : {m['subsection_title']}")
        print(f"         section_path     : {m['section_path']}")
        print(f"         text[:150]       : {short_text(doc)}")

    return {
        "query": question,
        "sections": sections,
        "sub_queries": dedup_queries,
        "dense": dense_total,
        "bm25": bm25_total,
        "rrf": rrf_total,
        "reranked": reranked_total,
        "merged": merged_total,
        "capped": len(merged),
        "deduped": len(deduped),
        "section_filtered": len(filtered),
        "final_top_k": len(final),
    }


def main():
    print("\n" + "="*80)
    print("  RAG PIPELINE STAGE-BY-STAGE DIAGNOSTIC")
    print("="*80)

    diagnose_configuration()
    diagnose_document_stats()
    retriever = inspect_raw_metadata()

    # Find a user_id from DocumentStore for pipeline queries
    doc_store = DocumentStore()
    docs = doc_store.list_summaries()
    user_id = docs[0]["user_id"] if docs else "7a80e7a8-ade5-4658-9ab7-fa14014ddcd4"

    print(f"\n  Using user_id for pipeline queries: {user_id}")

    pipeline = RAGPipeline()

    QUERIES = [
        "Give me the methodology",
        "What is the training strategy?",
        "How is the system deployed?",
        "What are the evaluation metrics?",
        "What are the reported results?",
    ]

    all_results = []
    for q in QUERIES:
        res = trace_pipeline_query(pipeline, retriever, q, user_id)
        all_results.append(res)

    # ── Summary ──
    print_section("SUMMARY OF STAGE-BY-STAGE COUNTS")
    header = f"{'Query':<38} {'Sec':<4} {'SubQ':<5} {'Dense':<6} {'BM25':<6} {'RRF':<6} {'Rerank':<7} {'Merged':<7} {'Dedup':<6} {'SecFil':<7} {'Final':<6}"
    print(header)
    print("-" * len(header))
    for r in all_results:
        print(f"{r['query'][:38]:<38} {len(r['sections']):<4} {len(r['sub_queries']):<5} "
              f"{r['dense']:<6} {r['bm25']:<6} {r['rrf']:<6} {r['reranked']:<7} "
              f"{r['merged']:<7} {r['deduped']:<6} {r['section_filtered']:<7} {r['final_top_k']:<6}")

    print("\n  NOTE: These counts are summed across all sub-queries (before merge/dedup).")
    print("  The 'Final' column shows how many chunks actually reached the LLM.")


if __name__ == "__main__":
    main()