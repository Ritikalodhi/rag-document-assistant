"""OCR processor for scanned or image-based PDFs using Tesseract."""

from pathlib import Path
from loguru import logger

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logger.warning("pytesseract/Pillow not installed — OCR disabled.")

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    logger.warning("pdf2image not installed — PDF OCR disabled.")


def is_scanned_pdf(text: str, threshold: int = 100) -> bool:
    """Return True if extracted text is too short to be a real text PDF.
    Scanned PDFs yield little or no text from normal loaders.
    """
    return len(text.strip()) < threshold


def ocr_pdf(file_path: str) -> str:
    """Run Tesseract OCR on each page of a PDF and return combined text.

    Requires: tesseract, pdf2image (poppler).
    Falls back gracefully if dependencies are missing.
    """
    if not OCR_AVAILABLE:
        raise RuntimeError("pytesseract not installed. Run: pip install pytesseract Pillow")
    if not PDF2IMAGE_AVAILABLE:
        raise RuntimeError("pdf2image not installed. Run: pip install pdf2image")

    try:
        pages = convert_from_path(file_path, dpi=300)
        texts = []
        for i, page in enumerate(pages):
            text = pytesseract.image_to_string(page, lang="eng")
            texts.append(f"[Page {i+1}]\n{text}")
            logger.debug(f"OCR page {i+1}: {len(text)} chars")
        result = "\n\n".join(texts)
        logger.info(f"OCR completed: {len(pages)} pages, {len(result)} chars from {file_path}")
        return result
    except Exception as e:
        logger.error(f"OCR failed for {file_path}: {e}")
        raise


def ocr_image(file_path: str) -> str:
    """Run Tesseract OCR on a single image file."""
    if not OCR_AVAILABLE:
        raise RuntimeError("pytesseract not installed. Run: pip install pytesseract Pillow")
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img, lang="eng")
        logger.info(f"OCR image: {len(text)} chars from {file_path}")
        return text
    except Exception as e:
        logger.error(f"OCR image failed for {file_path}: {e}")
        raise