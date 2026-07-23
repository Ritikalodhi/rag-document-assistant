"""Shared test fixtures and configuration."""

import pytest
from pathlib import Path


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    """Redirect DATA_DIR to a unique temp directory for every test.

    All stores now access ``config.DATA_DIR`` at runtime (via ``from src
    import config``), so monkeypatching ``config.DATA_DIR`` is sufficient.
    """
    from src import config
    monkeypatch.setattr(config, "DATA_DIR", tmp_path)

    # Also redirect the auth database
    from src.auth import database as auth_db
    test_db = tmp_path / "test_users.db"
    monkeypatch.setattr(auth_db, "DB_PATH", test_db)
    auth_db.init_user_db()

    return tmp_path