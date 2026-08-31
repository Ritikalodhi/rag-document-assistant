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
                try:
                    raw_tables = page.extract_tables() or []
                except Exception as pe:
                    logger.warning(f"Failed to extract tables from page {page_num} in {file_path}: {pe}")
                    continue

                for t_idx, table in enumerate(raw_tables):
                    if not table or len(table) < 2:
                        continue
                    try:
                        headers = [str(c or "").strip() for c in table[0]]
                        rows = [[str(c or "").strip() for c in row] for row in table[1:]]
                        md = "| " + " | ".join(headers) + " |\n"
                        md += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                        for row in rows:
                            md += "| " + " | ".join(row) + " |\n"

                        table_id = f"table_p{page_num}_{t_idx+1}"
                        caption = f"Table {t_idx + 1} (Page {page_num})"

                        tables.append({
                            "id": table_id,
                            "caption": caption,
                            "page": page_num,
                            "table_index": t_idx,
                            "headers": headers,
                            "rows": rows,
                            "markdown": md
                        })
                    except Exception as te:
                        logger.warning(f"Error parsing table {t_idx} on page {page_num}: {te}")
                        continue

        logger.info(f"Extracted {len(tables)} tables from {file_path}")
        return tables
    except Exception as e:
        logger.error(f"Table extraction failed for {file_path}: {e}")
        raise