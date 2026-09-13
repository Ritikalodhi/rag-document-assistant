"""SQLite user store. Separate DB file: users.db (or reuse main db via DB_PATH)."""
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from src.config import DATA_DIR

DB_PATH = DATA_DIR / "users.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def init_user_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            )
        """)
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def get_user_by_email(email: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_username(username: str):
    """Return a user dict by username, or None if not found."""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None


def create_user(user_id: str, email: str, username: str, hashed_password: str, created_at: str):
    """Create a user. Raises ValueError if username or email already exists."""
    if get_user_by_username(username) is not None:
        raise ValueError("Username already taken")
    if get_user_by_email(email) is not None:
        raise ValueError("Email already registered")
    with get_conn() as conn:
        try:
            conn.execute(
                "INSERT INTO users (id, email, username, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, email, username, hashed_password, created_at),
            )
            conn.commit()
        except sqlite3.IntegrityError as e:
            conn.rollback()
            msg = str(e).lower()
            if "username" in msg:
                raise ValueError("Username already taken")
            if "email" in msg:
                raise ValueError("Email already registered")
            raise ValueError("User already exists")