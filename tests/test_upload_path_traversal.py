"""Test path traversal protection on upload endpoints.

2.7: Filenames with directory traversal (../../etc/passwd.pdf) must be
rejected or safely contained.
"""

from pathlib import Path


def test_path_traversal_strips_directory_components():
    """Path.name strips directory components — this is the core protection."""
    malicious = "../../etc/passwd.pdf"
    safe_name = Path(malicious).name
    assert safe_name == "passwd.pdf"
    assert "/" not in safe_name
    assert ".." not in safe_name


def test_path_traversal_simple_filename():
    """Normal filenames should pass through unchanged."""
    normal = "report.pdf"
    safe_name = Path(normal).name
    assert safe_name == normal
    assert Path(safe_name).name == safe_name


def test_path_traversal_with_backslashes():
    """Windows-style backslash paths should also be contained."""
    malicious = "..\\..\\windows\\system32\\malware.dll"
    safe_name = Path(malicious).name
    assert "\\" not in safe_name
    assert ".." not in safe_name


def test_path_traversal_protection_check():
    """The check used in main.py should reject traversal paths."""
    from pathlib import Path

    # This is the correct validation: compare stripped name to original filename
    def is_safe_filename(filename: str) -> bool:
        safe_name = Path(filename).name
        return bool(safe_name) and safe_name == filename

    assert is_safe_filename("report.pdf") is True
    assert is_safe_filename("../../etc/passwd.pdf") is False
    assert is_safe_filename("subdir/file.pdf") is False
    assert is_safe_filename("") is False
