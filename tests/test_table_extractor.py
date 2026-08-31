"""Unit tests for table extraction functionality."""

import pytest
from unittest.mock import MagicMock, patch
from src.table_extractor import extract_tables, PDFPLUMBER_AVAILABLE
from src.rag_pipeline import RAGPipeline


def test_extract_tables_schema_with_mock():
    if not PDFPLUMBER_AVAILABLE:
        pytest.skip("pdfplumber not installed")

    mock_page = MagicMock()
    mock_page.extract_tables.return_value = [
        [
            ["Name", "Age", "Role"],
            ["Alice", "30", "Engineer"],
            ["Bob", "25", "Designer"],
        ]
    ]

    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page]

    with patch("pdfplumber.open", return_value=MagicMock(__enter__=MagicMock(return_value=mock_pdf))):
        tables = extract_tables("dummy.pdf")
        assert len(tables) == 1
        table = tables[0]
        assert "id" in table
        assert table["id"] == "table_p1_1"
        assert "caption" in table
        assert table["caption"] == "Table 1 (Page 1)"
        assert table["headers"] == ["Name", "Age", "Role"]
        assert table["rows"] == [["Alice", "30", "Engineer"], ["Bob", "25", "Designer"]]
        assert "markdown" in table
        assert "| Name | Age | Role |" in table["markdown"]


def test_get_document_tables_non_pdf(tmp_path):
    rag = RAGPipeline()
    user_id = "test_user_tables"
    
    doc_id = rag.doc_store.add(
        user_id=user_id,
        filename="test.txt",
        file_path=str(tmp_path / "test.txt"),
        full_text="Hello world",
        chunk_count=1,
    )

    res = rag.get_document_tables(user_id=user_id, doc_id=doc_id)
    assert res["success"] is False
    assert "only supported for PDFs" in res["error"]


def test_get_document_tables_missing_file(tmp_path):
    rag = RAGPipeline()
    user_id = "test_user_tables"

    doc_id = rag.doc_store.add(
        user_id=user_id,
        filename="test.pdf",
        file_path=str(tmp_path / "non_existent.pdf"),
        full_text="PDF content",
        chunk_count=1,
    )

    res = rag.get_document_tables(user_id=user_id, doc_id=doc_id)
    assert res["success"] is False
    assert "not found" in res["error"]
