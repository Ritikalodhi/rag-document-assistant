"""Document loading and processing utilities.

Supports multiple chunking strategies:
- recursive (default): RecursiveCharacterTextSplitter
- semantic: Sentence-aware splitting based on topic shifts
- sentence: Sentence-by-sentence with fixed-size grouping

Phase 1-3 improvements:
- pdfplumber-based layout-aware PDF extraction (fixes two-column corruption)
- Generic section/subsection heading detection (Roman numerals, A./B./C., 1./2., 1.1)
- Section metadata preserved on every chunk (section_title, subsection_title, section_path)
- MIN_CHUNK_SIZE merging so tiny/useless chunks don't become standalone documents
"""

from __future__ import annotations

import re
from pathlib import Path

from langchain_community.document_loaders import TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from loguru import logger

from src.config import CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_SIZE

# pdfplumber is preferred for PDFs (layout-aware). PyPDFLoader is no longer used
# because it corrupts two-column academic papers by interleaving columns.
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    pdfplumber = None
    PDFPLUMBER_AVAILABLE = False
    logger.warning("pdfplumber not installed — PDF extraction will be limited")

_LOADERS: dict[str, type] = {
    ".txt":  TextLoader,
    ".docx": Docx2txtLoader,
    ".md":   TextLoader,
}

SUPPORTED_EXTENSIONS = set(_LOADERS.keys()) | {".pdf"}

# Supported chunking strategies
CHUNKING_STRATEGIES = ("recursive", "semantic", "sentence")

# ── Generic heading detection (NOT hard-coded to any one paper) ───────────────

# Main section headings: "I.", "II.", "IV.", "1.", "2." (Roman numerals or
# Arabic numbers). Single letters (A., B., C.) are treated as subsections.
_MAIN_HEADING_RE = re.compile(
    r"^\s*(?P<num>[IVXLCDM]+|\d+)(?P<sep>\.)\s+(?P<title>.{2,120})$"
)
# Multi-level subsection headings: "1.1", "1.2.3", "IV.A", "C.1"
_SUB_HEADING_RE = re.compile(
    r"^\s*(?P<num>[IVXLCDM]+|[A-Z]|\d+)(?:\.(?P<sub>[IVXLCDM]+|[A-Z]|\d+)){1,2}\s+(?P<title>.{2,120})$"
)
# Single-letter subsection: "A. Overview"
_LETTER_HEADING_RE = re.compile(
    r"^\s*(?P<num>[A-Z])(?P<sep>\.)\s+(?P<title>.{2,120})$"
)


# Two-column PDFs can glue a subsection heading onto a body line from the
# adjacent column at the same vertical position, e.g.:
#   "C. Model Design and Configuration the model to use."
# The trailing sentence fragment makes the title end with '.', which the
# list-item guard below would reject — losing the section boundary. This
# regex splits the real heading phrase off the glued-on sentence fragment.
_TITLE_GLUE_RE = re.compile(
    r"^(?P<head>.{8,}?)(?P<tail>\s+(?:the|The|a|an|A|An|it|It|its|Its|this|This|that|That|when|When)\s.+)\s*\.?\s*$"
)


def _split_glued_heading_title(title: str) -> str | None:
    """Recover the real heading from a heading+body line glued by a
    two-column PDF layout. Returns the trimmed heading phrase, or None.

    Guards against falsely accepting numbered list items:
    - the recovered head must be 2-8 words
    - it must not contain a colon (list items like "6. Sequence. Truncation: ..." do)
    - it must not contain two consecutive lowercase words (sentence fragments
      like "It makes sure" do; real headings only have single connector words
      like "and", "of", "for")
    """
    if not title.endswith("."):
        return None
    m = _TITLE_GLUE_RE.match(title)
    if not m:
        return None
    head = m.group("head").strip()
    words = head.split()
    if not (2 <= len(words) <= 8):
        return None
    if ":" in head:
        return None
    lower_runs = re.findall(r"(?:^|\s)([a-z]+(?:\s+[a-z]+)+)(?=\s|$)", head)
    if lower_runs:
        return None
    return head


def _is_heading(line: str) -> tuple[str, str] | None:
    """Return (heading_type, normalized_title) if line looks like a heading.

    heading_type is ``"main"`` or ``"sub"``.
    """
    line = line.strip()
    if not line or len(line) > 150:
        return None

    # REJECT: lines that are clearly numbered list items
    # Real headings don't end with common sentence patterns
    # e.g. "6. Sequence. Truncation: It makes sure..." — too long, has colon mid-sentence

    m = _SUB_HEADING_RE.match(line)
    if m:
        title = m.group("title").strip()
        if title.endswith(".") and not title.endswith("..."):
            repaired = _split_glued_heading_title(title)
            if repaired:
                title = repaired
            else:
                return None
        # Reject if title is too long (list items) — real headings are short
        if len(title) > 60:
            return None
        return ("sub", title)

    m = _LETTER_HEADING_RE.match(line)
    if m:
        title = m.group("title").strip()
        if title.endswith(".") and not title.endswith("..."):
            repaired = _split_glued_heading_title(title)
            if repaired:
                title = repaired
            else:
                return None
        if len(title) > 60:
            return None
        return ("sub", title)

    m = _MAIN_HEADING_RE.match(line)
    if m:
        title = m.group("title").strip()
        if title.endswith(".") and not title.endswith("..."):
            repaired = _split_glued_heading_title(title)
            if repaired:
                title = repaired
            else:
                return None
        # CRITICAL: reject numbered list items
        # Real section headings are short — "Methodology", "System Architecture"
        # List items are long — "Sequence. Truncation: It makes sure the text..."
        if len(title) > 60:
            return None
        # Reject if title contains a colon after first word (list item pattern)
        words = title.split()
        if len(words) > 2 and ':' in title:
            return None
        return ("main", title)

    return None


def _format_table_rows(rows: list[list[str]]) -> str:
    """Convert raw PDF table rows into retrieval-friendly header:value text.

    Instead of gluing cells together with bare "|" separators (which loses
    the header-to-value relationship and is hard for BM25/embeddings to
    match against a natural-language question), each row is rendered as
    ``ROW: Header1: value1 | Header2: value2 ...`` so the column meaning
    travels with every cell.
    """
    if not rows:
        return ""

    headers = [re.sub(r"\s+", " ", str(cell or "")).strip() for cell in rows[0]]
    lines = ["TABLE COLUMNS: " + " | ".join(headers)]

    for row in rows[1:]:
        values = [re.sub(r"\s+", " ", str(cell or "")).strip() for cell in row]
        pairs = []
        for idx, value in enumerate(values):
            if not value:
                continue
            header = headers[idx] if idx < len(headers) and headers[idx] else f"Column {idx + 1}"
            pairs.append(f"{header}: {value}")
        if pairs:
            lines.append("ROW: " + " | ".join(pairs))

    return "\n".join(lines)


def _clean_page_text(text: str) -> str:
    """Collapse residual multiple spaces without destroying deliberate newlines.

    pdfplumber often inserts multiple spaces between words in two-column
    layouts. We collapse runs of spaces to a single space, but preserve
    newlines so paragraph boundaries are kept.
    """
    # Normalize weird unicode spaces
    text = text.replace("\u00a0", " ").replace("\u2009", " ").replace("\u202f", " ")
    # Collapse 2+ spaces to one (inside a line)
    lines = []
    for line in text.split("\n"):
        # The join of a two-column page can leave 2+ spaces mid-line.
        # Collapse them to a single space. This is safe for normal text.
        line = re.sub(r"[ \t]{2,}", " ", line)
        lines.append(line)
    return "\n".join(lines)


def _extract_pdf_with_pdfplumber(file_path: str) -> list[dict]:
    """Extract text from a PDF using pdfplumber (layout-aware).

    Handles two-column academic papers by using per-character x-tolerance
    so words are read in reading order rather than interleaving columns.

    Returns a list of {page, text} dicts.
    """
    pages = []
    with pdfplumber.open(file_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            table_bboxes = [t.bbox for t in page.find_tables()]

            # Extract tables as their own clean text block so rows/values
            # never get glued into adjacent paragraph sentences.
            table_texts = []
            for t in page.find_tables():
                rows = t.extract() or []
                table_texts.append(_format_table_rows(rows))

            def _in_any_bbox(word, bboxes):
                x0, top, x1, bottom = word["x0"], word["top"], word["x1"], word["bottom"]
                for (bx0, btop, bx1, bbottom) in bboxes:
                    if x0 >= bx0 and x1 <= bx1 and top >= btop and bottom <= bbottom:
                        return True
                return False

            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            prose_words = [w for w in words if not _in_any_bbox(w, table_bboxes)]
            # Preserve natural top-to-bottom, left-to-right reading order.
            prose_words.sort(key=lambda w: (round(w["top"], 1), w["x0"]))

            lines_by_top = []
            current_line = []
            current_top = None
            for w in prose_words:
                if current_top is None or abs(w["top"] - current_top) <= 3:
                    current_line.append(w["text"])
                    current_top = w["top"] if current_top is None else current_top
                else:
                    lines_by_top.append((current_top, " ".join(current_line)))
                    current_line = [w["text"]]
                    current_top = w["top"]
            if current_line:
                lines_by_top.append((current_top, " ".join(current_line)))

            # Build (top, text_block) entries for both prose lines and tables,
            # then merge by vertical position so tables land where they
            # actually appear on the page — not appended at the end, which
            # was causing them to inherit the wrong section heading.
            entries = [(top, line) for top, line in lines_by_top]
            for t, tt in zip(page.find_tables(), table_texts):
                table_top = t.bbox[1]
                entries.append((table_top, f"[TABLE on page {i+1}]\n{tt}"))
            entries.sort(key=lambda e: e[0])

            full_text = _clean_page_text("\n".join(e[1] for e in entries))

            pages.append({"page": i, "text": full_text})
        logger.info(f"pdfplumber extracted {total} pages from {Path(file_path).name!r}")
    return pages


def _extract_pdf_scanned_ocr(file_path: str) -> list[dict]:
    """Fallback OCR path for scanned PDFs (no extractable text)."""
    from src.ocr_processor import ocr_pdf, OCR_AVAILABLE
    if not OCR_AVAILABLE:
        logger.warning("Scanned PDF detected but OCR unavailable")
        return []
    logger.info("Running OCR on scanned PDF")
    ocr_text = ocr_pdf(file_path)
    return [{"page": 0, "text": ocr_text}]


class DocumentProcessor:
    """Handles document loading and chunking for the RAG pipeline.

    Args:
        chunk_size: Target chunk size in characters.
        chunk_overlap: Overlap between chunks in characters.
        strategy: Chunking strategy --- ``"recursive"`` (default),
                  ``"semantic"``, or ``"sentence"``.
    """

    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP,
                 strategy: str = "recursive"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = strategy.lower().strip()
        if self.strategy not in CHUNKING_STRATEGIES:
            logger.warning(f"Unknown chunking strategy '{strategy}', falling back to 'recursive'")
            self.strategy = "recursive"
        self.text_splitter = self._build_splitter()
        logger.info(f"DocumentProcessor ready (chunk_size={chunk_size}, overlap={chunk_overlap}, strategy={self.strategy})")

    def _build_splitter(self):
        """Build the text splitter based on the configured strategy."""
        if self.strategy == "recursive":
            return RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                separators=["\n\n", "\n", " ", ""],
                keep_separator=True,  # keeps headings attached to content
            )
        if self.strategy == "sentence":
            try:
                from langchain_text_splitters import SentenceTransformersTokenTextSplitter
                return SentenceTransformersTokenTextSplitter(
                    chunk_size=self.chunk_size,
                    chunk_overlap=self.chunk_overlap,
                )
            except ImportError:
                logger.warning("sentence-transformers not installed, falling back to recursive")
        if self.strategy == "semantic":
            try:
                from langchain_experimental.text_splitter import SemanticChunker
                from src.embeddings import EmbeddingManager
                embeddings = EmbeddingManager()
                return SemanticChunker(
                    embeddings=embeddings,
                    breakpoint_threshold_type="percentile",
                    breakpoint_threshold_amount=70,
                )
            except ImportError:
                logger.warning("langchain-experimental not installed, falling back to recursive")
            except Exception as exc:
                logger.warning(f"Semantic chunker init failed ({exc}), falling back to recursive")
        # Fallback
        return RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
            keep_separator=True,  # keeps headings attached to content
        )

    def load_document(self, file_path: str) -> list[Document]:
        """Load any supported document. Auto-applies OCR for scanned PDFs."""
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}")

        try:
            if ext == ".pdf":
                return self._load_pdf(path)
            loader_cls = _LOADERS[ext]
            loader = loader_cls(file_path, encoding="utf-8") if loader_cls is TextLoader else loader_cls(file_path)
            documents = loader.load()
            logger.info(f"Loaded {path.name!r} ({len(documents)} page(s))")
            return documents
        except Exception as e:
            logger.error(f"Error loading {path.name!r}: {e}")
            raise

    def _load_pdf(self, path: Path) -> list[Document]:
        """Layout-aware PDF loading with OCR fallback."""
        if PDFPLUMBER_AVAILABLE:
            try:
                pages = _extract_pdf_with_pdfplumber(str(path))
                # Log extraction stats (Phase 1 requirement)
                self._log_extraction_stats(path, pages)
                combined_text = "\n".join(p["text"] for p in pages)

                # OCR fallback for scanned PDFs (little/no text)
                from src.ocr_processor import is_scanned_pdf
                if is_scanned_pdf(combined_text):
                    logger.info(f"Scanned PDF detected — running OCR on {path.name!r}")
                    ocr_pages = _extract_pdf_scanned_ocr(str(path))
                    if ocr_pages:
                        return [Document(
                            page_content="\n".join(p["text"] for p in ocr_pages),
                            metadata={"source": str(path), "ocr": True, "page": 0},
                        )]
                    logger.warning(f"OCR produced no text for {path.name!r}")

                # Build page-numbered Documents (0-indexed internally)
                docs = []
                for p in pages:
                    if p["text"].strip():
                        docs.append(Document(
                            page_content=p["text"],
                            metadata={"source": str(path), "page": p["page"]},
                        ))
                if not docs:
                    logger.warning(f"No extractable text in {path.name!r}")
                return docs
            except Exception as e:
                logger.error(f"pdfplumber extraction failed for {path.name!r}: {e}")
                # Fall back to PyPDFLoader only if pdfplumber totally fails
                return self._fallback_pdf_load(path)
        # pdfplumber unavailable — fall back to PyPDFLoader
        return self._fallback_pdf_load(path)

    @staticmethod
    def _fallback_pdf_load(path: Path) -> list[Document]:
        """Fallback: use PyPDFLoader when pdfplumber is unavailable."""
        from langchain_community.document_loaders import PyPDFLoader
        loader = PyPDFLoader(str(path))
        documents = loader.load()
        # Attach page numbers if missing
        for i, doc in enumerate(documents):
            if "page" not in doc.metadata:
                doc.metadata["page"] = i
            doc.metadata.setdefault("source", str(path))
        logger.info(f"Loaded {path.name!r} via fallback loader ({len(documents)} page(s))")
        return documents

    @staticmethod
    def _log_extraction_stats(path: Path, pages: list[dict]) -> None:
        """Log filename, page count, chars per page, first 500 chars of selected pages."""
        filename = path.name
        logger.info(f"── PDF extraction stats for {filename!r} ──")
        logger.info(f"  pages: {len(pages)}")
        for p in pages:
            logger.info(f"  page {p['page']}: {len(p['text'])} chars")
        # First 500 chars of pages 1, 5, 10 (0-indexed: 0, 4, 9)
        for page_idx in (0, 4, 9):
            if page_idx < len(pages):
                sample = pages[page_idx]["text"][:500]
                logger.info(f"  page {page_idx + 1} first 500 chars:\n{sample}")
        logger.info(f"── end extraction stats for {filename!r} ──")

    def _section_aware_split(self, documents: list[Document]) -> list[Document]:
        """Split page documents into section-aware prose chunks and atomic table chunks.

        Tables extracted by pdfplumber are marked as ``[TABLE on page N]``.
        They are deliberately kept as ONE chunk so rows from a comparison table
        cannot be separated into independent vector documents.
        """
        units: list[dict] = []
        current_section = {"num": None, "title": None}
        current_sub = {"num": None, "title": None}

        for doc in documents:
            page = doc.metadata.get("page", 0)
            lines = doc.page_content.split("\n")
            buffer: list[str] = []

            for line in lines:
                heading = _is_heading(line)
                if heading:
                    if buffer:
                        units.append({
                            "section": dict(current_section),
                            "subsection": dict(current_sub),
                            "page": page,
                            "text": "\n".join(buffer).strip(),
                        })
                        buffer = []

                    htype, title = heading
                    if htype == "main":
                        current_section = {
                            "num": self._heading_num(line),
                            "title": title,
                        }
                        current_sub = {"num": None, "title": None}
                    else:
                        current_sub = {
                            "num": self._heading_num(line),
                            "title": title,
                        }
                    buffer.append(line)
                else:
                    buffer.append(line)

            if buffer:
                units.append({
                    "section": dict(current_section),
                    "subsection": dict(current_sub),
                    "page": page,
                    "text": "\n".join(buffer).strip(),
                })

        chunks: list[Document] = []

        for unit in units:
            text = unit["text"]
            if not text.strip():
                continue

            section = unit["section"]
            sub = unit["subsection"]
            section_title = section.get("title")
            section_num = section.get("num")
            sub_title = sub.get("title")
            sub_num = sub.get("num")

            path_parts = []
            if section_num:
                path_parts.append(section_num)
            if section_title:
                path_parts.append(section_title)
            if sub_num:
                path_parts.append(sub_num)
            if sub_title:
                path_parts.append(sub_title)
            section_path = " > ".join(str(p) for p in path_parts)

            meta_base = {
                "source": documents[0].metadata.get("source", "Unknown"),
                "page": unit.get("page", 0),
                "section_number": section_num,
                "section_title": section_title,
                "subsection_number": sub_num,
                "subsection_title": sub_title,
                "section_path": section_path,
            }

            # -------------------------------------------------------------
            # Preserve every extracted PDF table as one atomic chunk.
            # -------------------------------------------------------------
            table_re = re.compile(
                r"(?ms)^\[TABLE on page (?P<table_page>\d+)\]\s*\n(?P<table>.*?)(?=^\[TABLE on page \d+\]\s*$|\Z)"
            )

            matches = list(table_re.finditer(text))
            if not matches:
                for c in self.text_splitter.split_text(text):
                    if c.strip():
                        chunks.append(Document(
                            page_content=c,
                            metadata={**meta_base, "content_type": "text"},
                        ))
                continue

            # Keep prose before/between/after tables as normal chunks.
            cursor = 0
            table_counter = 0
            for match in matches:
                prose = text[cursor:match.start()].strip()
                if prose:
                    for c in self.text_splitter.split_text(prose):
                        if c.strip():
                            chunks.append(Document(
                                page_content=c,
                                metadata={**meta_base, "content_type": "text"},
                            ))

                table_counter += 1
                table_page = int(match.group("table_page"))
                table_body = match.group("table").strip()
                if table_body:
                    # Add searchable semantic context while retaining the exact
                    # extracted rows/values.
                    table_text = (
                        "[TABLE]\n"
                        f"Page: {table_page}\n"
                        f"Section: {section_title or ''}\n"
                        f"Subsection: {sub_title or ''}\n"
                        "This is a complete extracted PDF table. Preserve all rows, "
                        "columns, model names, metrics, and numeric ranges.\n\n"
                        + table_body
                    )
                    chunks.append(Document(
                        page_content=table_text,
                        metadata={
                            **meta_base,
                            "page": table_page - 1,
                            "content_type": "table",
                            "table_id": f"page_{table_page}_table_{table_counter}",
                            "table_page": table_page,
                        },
                    ))

                cursor = match.end()

            trailing = text[cursor:].strip()
            if trailing:
                for c in self.text_splitter.split_text(trailing):
                    if c.strip():
                        chunks.append(Document(
                            page_content=c,
                            metadata={**meta_base, "content_type": "text"},
                        ))

        chunks = self._merge_tiny_chunks(chunks)
        logger.info(
            "Section-aware split produced %d chunks (%d table chunks)",
            len(chunks),
            sum(1 for c in chunks if c.metadata.get("content_type") == "table"),
        )
        return chunks

    @staticmethod
    def _heading_num(line: str) -> str | None:
        """Extract the leading number/token from a heading line."""
        m = re.match(r"^\s*([IVXLCDM]+|[A-Z]|\d+(?:\.\d+)*)", line)
        return m.group(1) if m else None

    def _merge_tiny_chunks(self, chunks: list[Document]) -> list[Document]:
        """Merge tiny chunks below MIN_CHUNK_SIZE into an adjacent chunk.

        Phase 3 fix: a chunk that begins with a section/subsection heading is
        NEVER merged into the previous chunk, because that would lose its
        section metadata and attach it to the wrong section. Only non-heading
        tiny chunks (e.g. "↓", "Step 2: Unicode Normalization") are merged.

        This avoids tiny standalone retrieval documents while preserving the
        section hierarchy.
        """
        if MIN_CHUNK_SIZE <= 0:
            return chunks

        merged: list[Document] = []
        for chunk in chunks:
            text = chunk.page_content.strip()
            # Table chunks must stay atomic no matter how small they are —
            # merging them into prose loses their content_type="table" tag,
            # which breaks dedicated table retrieval (retrieve_tables()).
            is_table_chunk = chunk.metadata.get("content_type") == "table"

            # A chunk that starts with a heading is a section/subsection
            # boundary — never merge it into the previous section.
            first_line = text.split("\n", 1)[0].strip()
            starts_with_heading = _is_heading(first_line) is not None

            if (
                len(text) < MIN_CHUNK_SIZE
                and merged
                and not starts_with_heading
                and not is_table_chunk
                and merged[-1].metadata.get("content_type") != "table"
            ):
                # Merge into previous chunk (unless it would blow past 1.5x)
                prev = merged[-1]
                if len(prev.page_content) + len(text) <= int(self.chunk_size * 1.5):
                    prev_meta = dict(prev.metadata)
                    prev.page_content = prev.page_content.rstrip() + "\n" + text
                    merged[-1] = Document(page_content=prev.page_content, metadata=prev_meta)
                    continue
            merged.append(chunk)
        removed = len(chunks) - len(merged)
        if removed:
            logger.info(f"Merged {removed} tiny chunks (below {MIN_CHUNK_SIZE} chars)")
        return merged

    def split_documents(self, documents: list[Document]) -> list[Document]:
        """Split documents into chunks using the configured strategy.

        For PDFs (which have page metadata), uses section-aware splitting.
        For other documents, uses the configured splitter.
        """
        try:
            # Section-aware splitting for PDFs and any docs with page metadata
            if documents and any("page" in d.metadata for d in documents):
                chunks = self._section_aware_split(documents)
            else:
                chunks = self.text_splitter.split_documents(documents)
            logger.info(f"{self.strategy.title()} split into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error splitting documents: {e}")
            raise

    def process_file(self, file_path: str) -> list[Document]:
        """Load and chunk a file in one call."""
        documents = self.load_document(file_path)
        return self.split_documents(documents)

# """Document loading and processing utilities.

# Supports multiple chunking strategies:
# - recursive (default): RecursiveCharacterTextSplitter
# - semantic: Sentence-aware splitting based on topic shifts
# - sentence: Sentence-by-sentence with fixed-size grouping

# Phase 1-3 improvements:
# - pdfplumber-based layout-aware PDF extraction (fixes two-column corruption)
# - Generic section/subsection heading detection (Roman numerals, A./B./C., 1./2., 1.1)
# - Section metadata preserved on every chunk (section_title, subsection_title, section_path)
# - MIN_CHUNK_SIZE merging so tiny/useless chunks don't become standalone documents
# """

# from __future__ import annotations

# import re
# from pathlib import Path

# from langchain_community.document_loaders import TextLoader, Docx2txtLoader
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_core.documents import Document
# from loguru import logger

# from src.config import CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_SIZE

# # pdfplumber is preferred for PDFs (layout-aware). PyPDFLoader is no longer used
# # because it corrupts two-column academic papers by interleaving columns.
# try:
#     import pdfplumber
#     PDFPLUMBER_AVAILABLE = True
# except ImportError:  # pragma: no cover - optional dependency
#     pdfplumber = None
#     PDFPLUMBER_AVAILABLE = False
#     logger.warning("pdfplumber not installed — PDF extraction will be limited")

# _LOADERS: dict[str, type] = {
#     ".txt":  TextLoader,
#     ".docx": Docx2txtLoader,
#     ".md":   TextLoader,
# }

# SUPPORTED_EXTENSIONS = set(_LOADERS.keys()) | {".pdf"}

# # Supported chunking strategies
# CHUNKING_STRATEGIES = ("recursive", "semantic", "sentence")

# # ── Generic heading detection (NOT hard-coded to any one paper) ───────────────

# # Main section headings: "I.", "II.", "IV.", "1.", "2." (Roman numerals or
# # Arabic numbers). Single letters (A., B., C.) are treated as subsections.
# _MAIN_HEADING_RE = re.compile(
#     r"^\s*(?P<num>[IVXLCDM]+|\d+)(?P<sep>\.)\s+(?P<title>.{2,120})$"
# )
# # Multi-level subsection headings: "1.1", "1.2.3", "IV.A", "C.1"
# _SUB_HEADING_RE = re.compile(
#     r"^\s*(?P<num>[IVXLCDM]+|[A-Z]|\d+)(?:\.(?P<sub>[IVXLCDM]+|[A-Z]|\d+)){1,2}\s+(?P<title>.{2,120})$"
# )
# # Single-letter subsection: "A. Overview"
# _LETTER_HEADING_RE = re.compile(
#     r"^\s*(?P<num>[A-Z])(?P<sep>\.)\s+(?P<title>.{2,120})$"
# )


# def _is_heading(line: str) -> tuple[str, str] | None:
#     """Return (heading_type, normalized_title) if line looks like a heading.

#     heading_type is ``"main"`` or ``"sub"``.
#     """
#     line = line.strip()
#     if not line or len(line) > 150:
#         return None

#     # REJECT: lines that are clearly numbered list items
#     # Real headings don't end with common sentence patterns
#     # e.g. "6. Sequence. Truncation: It makes sure..." — too long, has colon mid-sentence

#     m = _SUB_HEADING_RE.match(line)
#     if m:
#         title = m.group("title").strip()
#         if title.endswith(".") and not title.endswith("..."):
#             return None
#         # Reject if title is too long (list items) — real headings are short
#         if len(title) > 60:
#             return None
#         return ("sub", title)

#     m = _LETTER_HEADING_RE.match(line)
#     if m:
#         title = m.group("title").strip()
#         if title.endswith(".") and not title.endswith("..."):
#             return None
#         if len(title) > 60:
#             return None
#         return ("sub", title)

#     m = _MAIN_HEADING_RE.match(line)
#     if m:
#         title = m.group("title").strip()
#         if title.endswith(".") and not title.endswith("..."):
#             return None
#         # CRITICAL: reject numbered list items
#         # Real section headings are short — "Methodology", "System Architecture"
#         # List items are long — "Sequence. Truncation: It makes sure the text..."
#         if len(title) > 60:
#             return None
#         # Reject if title contains a colon after first word (list item pattern)
#         words = title.split()
#         if len(words) > 2 and ':' in title:
#             return None
#         return ("main", title)

#     return None


# def _clean_page_text(text: str) -> str:
#     """Collapse residual multiple spaces without destroying deliberate newlines.

#     pdfplumber often inserts multiple spaces between words in two-column
#     layouts. We collapse runs of spaces to a single space, but preserve
#     newlines so paragraph boundaries are kept.
#     """
#     # Normalize weird unicode spaces
#     text = text.replace("\u00a0", " ").replace("\u2009", " ").replace("\u202f", " ")
#     # Collapse 2+ spaces to one (inside a line)
#     lines = []
#     for line in text.split("\n"):
#         # The join of a two-column page can leave 2+ spaces mid-line.
#         # Collapse them to a single space. This is safe for normal text.
#         line = re.sub(r"[ \t]{2,}", " ", line)
#         lines.append(line)
#     return "\n".join(lines)


# def _extract_pdf_with_pdfplumber(file_path: str) -> list[dict]:
#     """Extract text from a PDF using pdfplumber (layout-aware).

#     Handles two-column academic papers by using per-character x-tolerance
#     so words are read in reading order rather than interleaving columns.

#     Returns a list of {page, text} dicts.
#     """
#     pages = []
#     with pdfplumber.open(file_path) as pdf:
#         total = len(pdf.pages)
#         for i, page in enumerate(pdf.pages):
#             table_bboxes = [t.bbox for t in page.find_tables()]

#             # Extract tables as their own clean text block so rows/values
#             # never get glued into adjacent paragraph sentences.
#             table_texts = []
#             for t in page.find_tables():
#                 rows = t.extract() or []
#                 table_texts.append(
#                     "\n".join(
#                         " | ".join(cell or "" for cell in row) for row in rows if row
#                     )
#                 )

#             def _in_any_bbox(word, bboxes):
#                 x0, top, x1, bottom = word["x0"], word["top"], word["x1"], word["bottom"]
#                 for (bx0, btop, bx1, bbottom) in bboxes:
#                     if x0 >= bx0 and x1 <= bx1 and top >= btop and bottom <= bbottom:
#                         return True
#                 return False

#             words = page.extract_words(x_tolerance=3, y_tolerance=3)
#             prose_words = [w for w in words if not _in_any_bbox(w, table_bboxes)]
#             # Preserve natural top-to-bottom, left-to-right reading order.
#             prose_words.sort(key=lambda w: (round(w["top"], 1), w["x0"]))

#             lines_by_top = []
#             current_line = []
#             current_top = None
#             for w in prose_words:
#                 if current_top is None or abs(w["top"] - current_top) <= 3:
#                     current_line.append(w["text"])
#                     current_top = w["top"] if current_top is None else current_top
#                 else:
#                     lines_by_top.append((current_top, " ".join(current_line)))
#                     current_line = [w["text"]]
#                     current_top = w["top"]
#             if current_line:
#                 lines_by_top.append((current_top, " ".join(current_line)))

#             # Build (top, text_block) entries for both prose lines and tables,
#             # then merge by vertical position so tables land where they
#             # actually appear on the page — not appended at the end, which
#             # was causing them to inherit the wrong section heading.
#             entries = [(top, line) for top, line in lines_by_top]
#             for t, tt in zip(page.find_tables(), table_texts):
#                 table_top = t.bbox[1]
#                 entries.append((table_top, f"[TABLE on page {i+1}]\n{tt}"))
#             entries.sort(key=lambda e: e[0])

#             full_text = _clean_page_text("\n".join(e[1] for e in entries))

#             pages.append({"page": i, "text": full_text})
#         logger.info(f"pdfplumber extracted {total} pages from {Path(file_path).name!r}")
#     return pages


# def _extract_pdf_scanned_ocr(file_path: str) -> list[dict]:
#     """Fallback OCR path for scanned PDFs (no extractable text)."""
#     from src.ocr_processor import ocr_pdf, OCR_AVAILABLE
#     if not OCR_AVAILABLE:
#         logger.warning("Scanned PDF detected but OCR unavailable")
#         return []
#     logger.info("Running OCR on scanned PDF")
#     ocr_text = ocr_pdf(file_path)
#     return [{"page": 0, "text": ocr_text}]


# class DocumentProcessor:
#     """Handles document loading and chunking for the RAG pipeline.

#     Args:
#         chunk_size: Target chunk size in characters.
#         chunk_overlap: Overlap between chunks in characters.
#         strategy: Chunking strategy --- ``"recursive"`` (default),
#                   ``"semantic"``, or ``"sentence"``.
#     """

#     def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP,
#                  strategy: str = "recursive"):
#         self.chunk_size = chunk_size
#         self.chunk_overlap = chunk_overlap
#         self.strategy = strategy.lower().strip()
#         if self.strategy not in CHUNKING_STRATEGIES:
#             logger.warning(f"Unknown chunking strategy '{strategy}', falling back to 'recursive'")
#             self.strategy = "recursive"
#         self.text_splitter = self._build_splitter()
#         logger.info(f"DocumentProcessor ready (chunk_size={chunk_size}, overlap={chunk_overlap}, strategy={self.strategy})")

#     def _build_splitter(self):
#         """Build the text splitter based on the configured strategy."""
#         if self.strategy == "recursive":
#             return RecursiveCharacterTextSplitter(
#                 chunk_size=self.chunk_size,
#                 chunk_overlap=self.chunk_overlap,
#                 separators=["\n\n", "\n", " ", ""],
#                 keep_separator=True,  # keeps headings attached to content
#             )
#         if self.strategy == "sentence":
#             try:
#                 from langchain_text_splitters import SentenceTransformersTokenTextSplitter
#                 return SentenceTransformersTokenTextSplitter(
#                     chunk_size=self.chunk_size,
#                     chunk_overlap=self.chunk_overlap,
#                 )
#             except ImportError:
#                 logger.warning("sentence-transformers not installed, falling back to recursive")
#         if self.strategy == "semantic":
#             try:
#                 from langchain_experimental.text_splitter import SemanticChunker
#                 from src.embeddings import EmbeddingManager
#                 embeddings = EmbeddingManager()
#                 return SemanticChunker(
#                     embeddings=embeddings,
#                     breakpoint_threshold_type="percentile",
#                     breakpoint_threshold_amount=70,
#                 )
#             except ImportError:
#                 logger.warning("langchain-experimental not installed, falling back to recursive")
#             except Exception as exc:
#                 logger.warning(f"Semantic chunker init failed ({exc}), falling back to recursive")
#         # Fallback
#         return RecursiveCharacterTextSplitter(
#             chunk_size=self.chunk_size,
#             chunk_overlap=self.chunk_overlap,
#             separators=["\n\n", "\n", " ", ""],
#             keep_separator=True,  # keeps headings attached to content
#         )

#     def load_document(self, file_path: str) -> list[Document]:
#         """Load any supported document. Auto-applies OCR for scanned PDFs."""
#         path = Path(file_path)
#         ext = path.suffix.lower()

#         if ext not in SUPPORTED_EXTENSIONS:
#             raise ValueError(f"Unsupported file type '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}")

#         try:
#             if ext == ".pdf":
#                 return self._load_pdf(path)
#             loader_cls = _LOADERS[ext]
#             loader = loader_cls(file_path, encoding="utf-8") if loader_cls is TextLoader else loader_cls(file_path)
#             documents = loader.load()
#             logger.info(f"Loaded {path.name!r} ({len(documents)} page(s))")
#             return documents
#         except Exception as e:
#             logger.error(f"Error loading {path.name!r}: {e}")
#             raise

#     def _load_pdf(self, path: Path) -> list[Document]:
#         """Layout-aware PDF loading with OCR fallback."""
#         if PDFPLUMBER_AVAILABLE:
#             try:
#                 pages = _extract_pdf_with_pdfplumber(str(path))
#                 # Log extraction stats (Phase 1 requirement)
#                 self._log_extraction_stats(path, pages)
#                 combined_text = "\n".join(p["text"] for p in pages)

#                 # OCR fallback for scanned PDFs (little/no text)
#                 from src.ocr_processor import is_scanned_pdf
#                 if is_scanned_pdf(combined_text):
#                     logger.info(f"Scanned PDF detected — running OCR on {path.name!r}")
#                     ocr_pages = _extract_pdf_scanned_ocr(str(path))
#                     if ocr_pages:
#                         return [Document(
#                             page_content="\n".join(p["text"] for p in ocr_pages),
#                             metadata={"source": str(path), "ocr": True, "page": 0},
#                         )]
#                     logger.warning(f"OCR produced no text for {path.name!r}")

#                 # Build page-numbered Documents (0-indexed internally)
#                 docs = []
#                 for p in pages:
#                     if p["text"].strip():
#                         docs.append(Document(
#                             page_content=p["text"],
#                             metadata={"source": str(path), "page": p["page"]},
#                         ))
#                 if not docs:
#                     logger.warning(f"No extractable text in {path.name!r}")
#                 return docs
#             except Exception as e:
#                 logger.error(f"pdfplumber extraction failed for {path.name!r}: {e}")
#                 # Fall back to PyPDFLoader only if pdfplumber totally fails
#                 return self._fallback_pdf_load(path)
#         # pdfplumber unavailable — fall back to PyPDFLoader
#         return self._fallback_pdf_load(path)

#     @staticmethod
#     def _fallback_pdf_load(path: Path) -> list[Document]:
#         """Fallback: use PyPDFLoader when pdfplumber is unavailable."""
#         from langchain_community.document_loaders import PyPDFLoader
#         loader = PyPDFLoader(str(path))
#         documents = loader.load()
#         # Attach page numbers if missing
#         for i, doc in enumerate(documents):
#             if "page" not in doc.metadata:
#                 doc.metadata["page"] = i
#             doc.metadata.setdefault("source", str(path))
#         logger.info(f"Loaded {path.name!r} via fallback loader ({len(documents)} page(s))")
#         return documents

#     @staticmethod
#     def _log_extraction_stats(path: Path, pages: list[dict]) -> None:
#         """Log filename, page count, chars per page, first 500 chars of selected pages."""
#         filename = path.name
#         logger.info(f"── PDF extraction stats for {filename!r} ──")
#         logger.info(f"  pages: {len(pages)}")
#         for p in pages:
#             logger.info(f"  page {p['page']}: {len(p['text'])} chars")
#         # First 500 chars of pages 1, 5, 10 (0-indexed: 0, 4, 9)
#         for page_idx in (0, 4, 9):
#             if page_idx < len(pages):
#                 sample = pages[page_idx]["text"][:500]
#                 logger.info(f"  page {page_idx + 1} first 500 chars:\n{sample}")
#         logger.info(f"── end extraction stats for {filename!r} ──")

#     def _section_aware_split(self, documents: list[Document]) -> list[Document]:
#         """Split page documents into section-aware prose chunks and atomic table chunks.

#         Tables extracted by pdfplumber are marked as ``[TABLE on page N]``.
#         They are deliberately kept as ONE chunk so rows from a comparison table
#         cannot be separated into independent vector documents.
#         """
#         units: list[dict] = []
#         current_section = {"num": None, "title": None}
#         current_sub = {"num": None, "title": None}

#         for doc in documents:
#             page = doc.metadata.get("page", 0)
#             lines = doc.page_content.split("\n")
#             buffer: list[str] = []

#             for line in lines:
#                 heading = _is_heading(line)
#                 if heading:
#                     if buffer:
#                         units.append({
#                             "section": dict(current_section),
#                             "subsection": dict(current_sub),
#                             "page": page,
#                             "text": "\n".join(buffer).strip(),
#                         })
#                         buffer = []

#                     htype, title = heading
#                     if htype == "main":
#                         current_section = {
#                             "num": self._heading_num(line),
#                             "title": title,
#                         }
#                         current_sub = {"num": None, "title": None}
#                     else:
#                         current_sub = {
#                             "num": self._heading_num(line),
#                             "title": title,
#                         }
#                     buffer.append(line)
#                 else:
#                     buffer.append(line)

#             if buffer:
#                 units.append({
#                     "section": dict(current_section),
#                     "subsection": dict(current_sub),
#                     "page": page,
#                     "text": "\n".join(buffer).strip(),
#                 })

#         chunks: list[Document] = []

#         for unit in units:
#             text = unit["text"]
#             if not text.strip():
#                 continue

#             section = unit["section"]
#             sub = unit["subsection"]
#             section_title = section.get("title")
#             section_num = section.get("num")
#             sub_title = sub.get("title")
#             sub_num = sub.get("num")

#             path_parts = []
#             if section_num:
#                 path_parts.append(section_num)
#             if section_title:
#                 path_parts.append(section_title)
#             if sub_num:
#                 path_parts.append(sub_num)
#             if sub_title:
#                 path_parts.append(sub_title)
#             section_path = " > ".join(str(p) for p in path_parts)

#             meta_base = {
#                 "source": documents[0].metadata.get("source", "Unknown"),
#                 "page": unit.get("page", 0),
#                 "section_number": section_num,
#                 "section_title": section_title,
#                 "subsection_number": sub_num,
#                 "subsection_title": sub_title,
#                 "section_path": section_path,
#             }

#             # -------------------------------------------------------------
#             # Preserve every extracted PDF table as one atomic chunk.
#             # -------------------------------------------------------------
#             table_re = re.compile(
#                 r"(?ms)^\[TABLE on page (?P<table_page>\d+)\]\s*\n(?P<table>.*?)(?=^\[TABLE on page \d+\]\s*$|\Z)"
#             )

#             matches = list(table_re.finditer(text))
#             if not matches:
#                 for c in self.text_splitter.split_text(text):
#                     if c.strip():
#                         chunks.append(Document(
#                             page_content=c,
#                             metadata={**meta_base, "content_type": "text"},
#                         ))
#                 continue

#             # Keep prose before/between/after tables as normal chunks.
#             cursor = 0
#             table_counter = 0
#             for match in matches:
#                 prose = text[cursor:match.start()].strip()
#                 if prose:
#                     for c in self.text_splitter.split_text(prose):
#                         if c.strip():
#                             chunks.append(Document(
#                                 page_content=c,
#                                 metadata={**meta_base, "content_type": "text"},
#                             ))

#                 table_counter += 1
#                 table_page = int(match.group("table_page"))
#                 table_body = match.group("table").strip()
#                 if table_body:
#                     # Add searchable semantic context while retaining the exact
#                     # extracted rows/values.
#                     table_text = (
#                         "[TABLE]\n"
#                         f"Page: {table_page}\n"
#                         f"Section: {section_title or ''}\n"
#                         f"Subsection: {sub_title or ''}\n"
#                         "This is a complete extracted PDF table. Preserve all rows, "
#                         "columns, model names, metrics, and numeric ranges.\n\n"
#                         + table_body
#                     )
#                     chunks.append(Document(
#                         page_content=table_text,
#                         metadata={
#                             **meta_base,
#                             "page": table_page - 1,
#                             "content_type": "table",
#                             "table_id": f"page_{table_page}_table_{table_counter}",
#                             "table_page": table_page,
#                         },
#                     ))

#                 cursor = match.end()

#             trailing = text[cursor:].strip()
#             if trailing:
#                 for c in self.text_splitter.split_text(trailing):
#                     if c.strip():
#                         chunks.append(Document(
#                             page_content=c,
#                             metadata={**meta_base, "content_type": "text"},
#                         ))

#         chunks = self._merge_tiny_chunks(chunks)
#         logger.info(
#             "Section-aware split produced %d chunks (%d table chunks)",
#             len(chunks),
#             sum(1 for c in chunks if c.metadata.get("content_type") == "table"),
#         )
#         return chunks

#     @staticmethod
#     def _heading_num(line: str) -> str | None:
#         """Extract the leading number/token from a heading line."""
#         m = re.match(r"^\s*([IVXLCDM]+|[A-Z]|\d+(?:\.\d+)*)", line)
#         return m.group(1) if m else None

#     def _merge_tiny_chunks(self, chunks: list[Document]) -> list[Document]:
#         """Merge tiny chunks below MIN_CHUNK_SIZE into an adjacent chunk.

#         Phase 3 fix: a chunk that begins with a section/subsection heading is
#         NEVER merged into the previous chunk, because that would lose its
#         section metadata and attach it to the wrong section. Only non-heading
#         tiny chunks (e.g. "↓", "Step 2: Unicode Normalization") are merged.

#         This avoids tiny standalone retrieval documents while preserving the
#         section hierarchy.
#         """
#         if MIN_CHUNK_SIZE <= 0:
#             return chunks

#         merged: list[Document] = []
#         for chunk in chunks:
#             text = chunk.page_content.strip()
#             # A chunk that starts with a heading is a section/subsection
#             # boundary — never merge it into the previous section.
#             first_line = text.split("\n", 1)[0].strip()
#             starts_with_heading = _is_heading(first_line) is not None

#             if (
#                 len(text) < MIN_CHUNK_SIZE
#                 and merged
#                 and not starts_with_heading
#             ):
#                 # Merge into previous chunk (unless it would blow past 1.5x)
#                 prev = merged[-1]
#                 if len(prev.page_content) + len(text) <= int(self.chunk_size * 1.5):
#                     prev_meta = dict(prev.metadata)
#                     prev.page_content = prev.page_content.rstrip() + "\n" + text
#                     merged[-1] = Document(page_content=prev.page_content, metadata=prev_meta)
#                     continue
#             merged.append(chunk)
#         removed = len(chunks) - len(merged)
#         if removed:
#             logger.info(f"Merged {removed} tiny chunks (below {MIN_CHUNK_SIZE} chars)")
#         return merged

#     def split_documents(self, documents: list[Document]) -> list[Document]:
#         """Split documents into chunks using the configured strategy.

#         For PDFs (which have page metadata), uses section-aware splitting.
#         For other documents, uses the configured splitter.
#         """
#         try:
#             # Section-aware splitting for PDFs and any docs with page metadata
#             if documents and any("page" in d.metadata for d in documents):
#                 chunks = self._section_aware_split(documents)
#             else:
#                 chunks = self.text_splitter.split_documents(documents)
#             logger.info(f"{self.strategy.title()} split into {len(chunks)} chunks")
#             return chunks
#         except Exception as e:
#             logger.error(f"Error splitting documents: {e}")
#             raise

#     def process_file(self, file_path: str) -> list[Document]:
#         """Load and chunk a file in one call."""
#         documents = self.load_document(file_path)
#         return self.split_documents(documents)