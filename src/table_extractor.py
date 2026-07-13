"""Table extraction from PDF documents using pdfplumber."""

from loguru import logger

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    logger.warning("pdfplumber not installed. Run: pip install pdfplumber")


def extract_tables(file_path: str) -> list[dict]:
    """Extract all tables from a PDF. Returns list of table dicts with markdown."""
    if not PDFPLUMBER_AVAILABLE:
        raise RuntimeError("pdfplumber not installed. Run: pip install pdfplumber")

    tables = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                for t_idx, table in enumerate(page.extract_tables() or []):
                    if not table or len(table) < 2:
                        continue
                    headers = [str(c or "").strip() for c in table[0]]
                    rows = [[str(c or "").strip() for c in row] for row in table[1:]]
                    md = "| " + " | ".join(headers) + " |\n"
                    md += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                    for row in rows:
                        md += "| " + " | ".join(row) + " |\n"
                    tables.append({"page": page_num, "table_index": t_idx,
                                   "headers": headers, "rows": rows, "markdown": md})
        logger.info(f"Extracted {len(tables)} tables from {file_path}")
        return tables
    except Exception as e:
        logger.error(f"Table extraction failed: {e}")
        raise