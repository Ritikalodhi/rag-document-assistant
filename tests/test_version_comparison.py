"""Regression tests for the /versions/compare endpoint (audit finding #1).

The endpoint previously ignored v1/v2 and compared the document against
itself; it must now use DocumentVersionStore.compare_versions() with proper
ownership and status codes.
"""

import pytest
from fastapi.testclient import TestClient

from src.doc_store import DocumentStore
from src.rag_pipeline import RAGPipeline
from src.versioning import DocumentVersionStore


def make_pipeline() -> RAGPipeline:
    """Build a pipeline shell with the real stores (no LLM/retriever needed)."""
    pipe = RAGPipeline.__new__(RAGPipeline)
    pipe.doc_store = DocumentStore()
    pipe.version_store = DocumentVersionStore()
    return pipe


def seed_document(pipe: RAGPipeline, user_id: str = "user_a", filename: str = "report.pdf") -> str:
    """Register a document with two genuinely different versions."""
    doc_id = pipe.doc_store.add(
        user_id=user_id, filename=filename, file_path=f"/tmp/{filename}",
        full_text="version two text", chunk_count=2,
    )
    # Register v1 and v2 with different content.
    pipe.version_store.check_and_register(user_id, filename, "short content v1", doc_id=doc_id)
    pipe.version_store.check_and_register(
        user_id, filename, "much longer content for version two of the document", doc_id=doc_id
    )
    return doc_id


# ── Pipeline level ───────────────────────────────────────────────────────────


def test_compare_different_versions_succeeds():
    pipe = make_pipeline()
    doc_id = seed_document(pipe)

    result = pipe.compare_document_versions("user_a", doc_id, v1=1, v2=2)

    assert result["success"] is True
    assert result["content_changed"] is True
    assert result["version_a"]["version"] == 1
    assert result["version_b"]["version"] == 2
    assert result["char_count_diff"] == len(
        "much longer content for version two of the document"
    ) - len("short content v1")
    assert result["doc_id"] == doc_id


def test_compare_is_directional_v2_vs_v1():
    pipe = make_pipeline()
    doc_id = seed_document(pipe)

    fwd = pipe.compare_document_versions("user_a", doc_id, v1=1, v2=2)
    bwd = pipe.compare_document_versions("user_a", doc_id, v1=2, v2=1)

    assert fwd["char_count_diff"] == -bwd["char_count_diff"]
    assert fwd["content_changed"] is True
    assert bwd["content_changed"] is True


def test_same_version_rejected():
    pipe = make_pipeline()
    doc_id = seed_document(pipe)

    result = pipe.compare_document_versions("user_a", doc_id, v1=2, v2=2)

    assert result["success"] is False
    assert result["error_type"] == "invalid"


def test_non_positive_versions_rejected():
    pipe = make_pipeline()
    doc_id = seed_document(pipe)

    for bad in [(0, 1), (1, 0), (-1, 2), (1, -3)]:
        result = pipe.compare_document_versions("user_a", doc_id, v1=bad[0], v2=bad[1])
        assert result["success"] is False, f"v1={bad[0]}, v2={bad[1]} must be rejected"
        assert result["error_type"] == "invalid"


def test_nonexistent_version_returns_not_found():
    pipe = make_pipeline()
    doc_id = seed_document(pipe)

    result = pipe.compare_document_versions("user_a", doc_id, v1=1, v2=99)

    assert result["success"] is False
    assert result["error_type"] == "not_found"


def test_nonexistent_document_returns_not_found():
    pipe = make_pipeline()

    result = pipe.compare_document_versions("user_a", "does-not-exist", v1=1, v2=2)

    assert result["success"] is False
    assert result["error_type"] == "not_found"


def test_cross_user_document_is_not_found():
    """User B must not be able to compare (or discover) user A's document."""
    pipe = make_pipeline()
    doc_id = seed_document(pipe, user_id="user_a")

    result = pipe.compare_document_versions("user_b", doc_id, v1=1, v2=2)

    assert result["success"] is False
    assert result["error_type"] == "not_found"


# ── Endpoint level (real auth, real router wiring) ──────────────────────────


@pytest.fixture()
def client(monkeypatch):
    from src import main as main_module

    pipe = make_pipeline()
    monkeypatch.setattr(main_module, "rag", pipe)
    return TestClient(main_module.app), pipe


def _register(client: TestClient) -> str:
    resp = client.post(
        "/api/auth/register",
        json={"email": "verifier@example.com", "username": "verifier", "password": "Password123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth_get(client: TestClient, token: str, url: str):
    return client.get(url, headers={"Authorization": f"Bearer {token}"})


def test_endpoint_unauthenticated_rejected(client, monkeypatch):
    http, _ = client
    resp = http.get("/api/documents/some-doc/versions/compare?v1=1&v2=2")
    assert resp.status_code == 401


def test_endpoint_compare_success_and_status_codes(client):
    http, pipe = client
    token = _register(http)
    user_id = http.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]
    doc_id = seed_document(pipe, user_id=user_id)

    # v1 vs v2 with genuinely different content → 200
    resp = _auth_get(http, token, f"/api/documents/{doc_id}/versions/compare?v1=1&v2=2")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["content_changed"] is True
    assert body["version_a"]["version"] == 1
    assert body["version_b"]["version"] == 2

    # same version → 400
    resp = _auth_get(http, token, f"/api/documents/{doc_id}/versions/compare?v1=2&v2=2")
    assert resp.status_code == 400

    # non-positive version → 400
    resp = _auth_get(http, token, f"/api/documents/{doc_id}/versions/compare?v1=0&v2=2")
    assert resp.status_code == 400

    # nonexistent version → 404
    resp = _auth_get(http, token, f"/api/documents/{doc_id}/versions/compare?v1=1&v2=42")
    assert resp.status_code == 404

    # nonexistent document → 404
    resp = _auth_get(http, token, "/api/documents/nope/versions/compare?v1=1&v2=2")
    assert resp.status_code == 404

