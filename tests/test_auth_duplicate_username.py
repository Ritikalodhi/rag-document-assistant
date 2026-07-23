"""Test that duplicate username/email returns 400, not 500.

Uses a fresh DB path per test via conftest.py's isolate_data_dir.
"""
import pytest
from src.auth import database as auth_db


def test_create_user_duplicate_username_raises_value_error():
    """Creating a user with a duplicate username should raise ValueError."""
    auth_db.create_user(
        user_id="test-id-1",
        email="test@example.com",
        username="testuser",
        hashed_password="hashed_pw",
        created_at="2024-01-01T00:00:00Z",
    )
    # Duplicate username
    with pytest.raises(ValueError, match="Username already taken"):
        auth_db.create_user(
            user_id="test-id-2",
            email="other@example.com",
            username="testuser",
            hashed_password="hashed_pw",
            created_at="2024-01-01T00:00:00Z",
        )


def test_create_user_duplicate_email_raises_value_error():
    """Creating a user with a duplicate email should raise ValueError."""
    auth_db.create_user(
        user_id="test-id-3",
        email="dup@example.com",
        username="user1",
        hashed_password="hashed_pw",
        created_at="2024-01-01T00:00:00Z",
    )
    # Duplicate email
    with pytest.raises(ValueError, match="Email already registered"):
        auth_db.create_user(
            user_id="test-id-4",
            email="dup@example.com",
            username="user2",
            hashed_password="hashed_pw",
            created_at="2024-01-01T00:00:00Z",
        )


def test_get_user_by_username_exists():
    """get_user_by_username should find an existing user."""
    auth_db.create_user(
        user_id="test-id-5",
        email="find@example.com",
        username="findme",
        hashed_password="hashed_pw",
        created_at="2024-01-01T00:00:00Z",
    )
    user = auth_db.get_user_by_username("findme")
    assert user is not None
    assert user["username"] == "findme"


def test_get_user_by_username_not_found():
    """get_user_by_username should return None for non-existent user."""
    user = auth_db.get_user_by_username("nonexistent")
    assert user is None