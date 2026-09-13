import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

from jose import jwt

from src.auth import security


def test_token_creation_and_validation():
    token = security.create_access_token({"sub": "user-1"})

    decoded = security.decode_access_token(token)

    assert decoded is not None
    assert decoded["sub"] == "user-1"


def test_expired_token_rejected():
    token = jwt.encode(
        {"sub": "user-1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        security.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )

    assert security.decode_access_token(token) is None


def test_invalid_token_rejected():
    assert security.decode_access_token("not-a-jwt") is None


def test_security_imports_configured_secret():
    from src import config

    assert security.SECRET_KEY == config.SECRET_KEY


def test_missing_production_secret_fails_fast():
    env = os.environ.copy()
    env["ENVIRONMENT"] = "production"
    env["JWT_SECRET_KEY"] = "change-me-in-production"
    env.setdefault("LLM_PROVIDER", "gemini")
    env.setdefault("GEMINI_API_KEY", "test-key")

    result = subprocess.run(
        [sys.executable, "-c", "import src.config"],
        cwd=os.getcwd(),
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "JWT_SECRET_KEY must be set in production" in (result.stderr + result.stdout)
