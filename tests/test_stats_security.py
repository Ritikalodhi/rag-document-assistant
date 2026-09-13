from fastapi.testclient import TestClient


class StatsPipeline:
    def __init__(self):
        self.by_user = {
            "user_a": {"collection_name": "documents", "document_count": 2, "bm25_docs": 2},
            "user_b": {"collection_name": "documents", "document_count": 7, "bm25_docs": 7},
        }

    def get_stats(self, user_id):
        return self.by_user[user_id]


def register(client: TestClient, username: str, email: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "Password123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_stats_requires_auth(monkeypatch):
    from src import main as main_module

    monkeypatch.setattr(main_module, "rag", StatsPipeline())
    client = TestClient(main_module.app)

    response = client.get("/api/stats")

    assert response.status_code == 401


def test_stats_authenticated_safe_and_user_scoped(monkeypatch):
    from src import main as main_module

    pipeline = StatsPipeline()
    monkeypatch.setattr(main_module, "rag", pipeline)
    client = TestClient(main_module.app)
    token_a = register(client, "stats_a", "stats_a@example.com")
    token_b = register(client, "stats_b", "stats_b@example.com")

    user_a = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()["id"]
    user_b = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()["id"]
    pipeline.by_user[user_a] = pipeline.by_user.pop("user_a")
    pipeline.by_user[user_b] = pipeline.by_user.pop("user_b")

    response_a = client.get("/api/stats", headers={"Authorization": f"Bearer {token_a}"})
    response_b = client.get("/api/stats", headers={"Authorization": f"Bearer {token_b}"})

    assert response_a.status_code == 200, response_a.text
    assert response_b.status_code == 200, response_b.text
    body_a = response_a.json()
    body_b = response_b.json()
    assert "persist_dir" not in body_a
    assert "persist_dir" not in body_b
    assert body_a["document_count"] == 2
    assert body_a["bm25_docs"] == 2
    assert body_b["document_count"] == 7
    assert body_b["bm25_docs"] == 7
