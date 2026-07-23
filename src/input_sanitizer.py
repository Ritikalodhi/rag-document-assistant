"""Input sanitization for prompt injection protection.

Detects and neutralises:
- Prompt leakage / system prompt extraction
- Jailbreak attempts (DAN, role-play overrides)
- Context override attacks (ignore all previous, etc.)
- Instruction injection (hidden commands in text)
- Separator injection attempts
- Unicode-based attacks

Lightweight — uses regex patterns, not an LLM classifier.
Minimal false positives — patterns require multiple matching tokens.
"""

from __future__ import annotations

import re
from typing import Final

# ── Attack pattern families ─────────────────────────────────────────────────

_LEAKAGE_PATTERNS: Final[list[re.Pattern]] = [
    re.compile(r"(?i)(?:ignore|forget|disregard|skip)\s+(?:all\s+)?(?:previous|above|prior|earlier)\s+(?:instructions?|context|prompts?)"),
    re.compile(r"(?i)print\s+(?:your|the)\s+(?:system\s+)?prompt"),
    re.compile(r"(?i)output\s+(?:your\s+)?(?:initial|system|original)\s+(?:prompt|instruction)"),
    re.compile(r"(?i)repeat\s+(?:everything\s+)?(?:above|previous|before)\s+(?:word\s+for\s+word|verbatim)"),
    re.compile(r"(?i)show\s+me\s+(?:the\s+)?(?:system\s+|initial\s+)?prompt"),
    re.compile(r"(?i)reveal\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)"),
    re.compile(r"(?i)what\s+(?:is|was|were)\s+(?:your|the)\s+(?:initial|first|system)\s+(?:prompt|message|instruction)"),
    re.compile(r"(?i)how\s+(?:are\s+)?you\s+(?:told|instructed|programmed)\s+to\s+(?:behave|respond|act)"),
    re.compile(r"(?i)(?:tell|give|show|provide|write)\s+(?:me\s+)?(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)\s+(?:above|below|here|now)"),
]

_JAILBREAK_PATTERNS: Final[list[re.Pattern]] = [
    re.compile(r"(?i)you\s+(?:are\s+)?(?:now\s+)?(?:DAN|FREE|STAN|Omni|opposite|cancel\s+(?:mode|filter))"),
    re.compile(r"(?i)act\s+as\s+(?:if\s+)?you\s+are\s+(?:an?\s+)?(?:unrestricted|unfiltered|uncensored|evil|harmful|malicious)"),
    re.compile(r"(?i)do\s+(?:not|n['’]t)\s+(?:follow|obey|adhere\s+to)\s+(?:your\s+)?(?:rules?|guidelines?|instructions?|policies?)"),
    re.compile(r"(?i)(?:override|bypass|crack|hack|break)\s+(?:your\s+)?(?:safety|security|restrictions?|limitations?|filter)"),
    re.compile(r"(?i)you\s+(?:have\s+)?no\s+(?:rules?|restrictions?|limits?|boundaries?|constraints?)"),
    re.compile(r"(?i)respond\s+(?:in\s+)?(?:a\s+)?(?:way\s+that\s+)?violates?\s+(?:your\s+)?(?:guidelines?|policies?)"),
    re.compile(r"(?i)you\s+(?:can\s+(?:now\s+)?|will\s+(?:now\s+)?)(?:ignore\s+(?:all\s+)?|bypass\s+|break\s+free\s+from)"),
    re.compile(r"(?i)pretend\s+(?:you\s+)?(?:are|were)\s+(?:an?\s+)?(?:unfiltered|uncensored|unrestricted|evil|harmful)"),
    re.compile(r"(?i)(?:new\s+)?(?:character\s+)?mode\s*:\s*(?:unfiltered|uncensored|unrestricted|evil|harmful)"),
]

_INSTRUCTION_INJECTION: Final[list[re.Pattern]] = [
    re.compile(r"(?i)(?:<<|\[\[)\s*(?:system|instruction|ignore|new\s+prompt)\s*(?:>>|\]\])"),
    re.compile(r"(?i)(?:(?:end|stop|reset)\s+of\s+(?:instruction|input|query|conversation))"),
    re.compile(r"(?i)now\s+(?:I\s+)?will\s+(?:give\s+you\s+(?:new\s+)?|tell\s+you\s+(?:the\s+)?)(?:instructions?|a\s+command)"),
    re.compile(r"(?i)you\s+must\s+(?:now\s+)?(?:forget|ignore|disregard)"),
    re.compile(r"(?i)(?:ignore|disregard|forget)\s+(?:the\s+)?(?:above|previous|prior)\s+(?:instructions?|prompt|text|content|message)"),
    re.compile(r"(?i)(?:your\s+)?(?:answer|response)\s+(?:should\s+|must\s+|will\s+)?(?:start\s+with|begin\s+with|include|contain)"),
]

_SEPARATOR_INJECTION: Final[list[re.Pattern]] = [
    re.compile(r"(?i)-{3,}(?:\s*end\s+of\s+(?:context|document|input|conversation))?"),
    re.compile(r"(?i)\+{3,}"),
    re.compile(r"(?i)`{3,}(?:\s*(?:system|user|assistant))?"),
]

_UNICODE_ATTACKS: Final[list[re.Pattern]] = [
    re.compile(r"[\u202E\u202D\u202C\u202B\u2066\u2067\u2068\u2069]"),  # Bidi overrides
    re.compile(r"[\u00AD\u200B\u200C\u200D\u2060\uFEFF]"),              # Zero-width chars
]


class SanitizerResult:
    """Result of sanitisation."""

    __slots__ = ("clean", "flagged", "reason")

    def __init__(self, clean: str, flagged: bool, reason: str = ""):
        self.clean = clean
        self.flagged = flagged
        self.reason = reason


def sanitize_question(text: str) -> SanitizerResult:
    """Sanitize a user question before it enters the prompt pipeline.

    * Strips control characters and unicode attacks
    * Caps length at 2000 characters
    * Checks for prompt-injection patterns
    * Recovers by removing the dangerous segments

    Returns a ``SanitizerResult`` with ``flagged=True`` if a pattern was
    matched, and ``clean`` containing a redacted version.
    """
    if not text:
        return SanitizerResult(clean="", flagged=False)

    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    clean = clean[:2000]

    flagged = False
    reasons: list[str] = []

    # Unicode attacks — strip silently
    for pattern in _UNICODE_ATTACKS:
        if pattern.search(clean):
            flagged = True
            reasons.append("unicode_attack")
            clean = pattern.sub("", clean)

    for pattern in _LEAKAGE_PATTERNS:
        if pattern.search(clean):
            flagged = True
            reasons.append("prompt_leakage")
            clean = pattern.sub("[REDACTED]", clean)

    for pattern in _JAILBREAK_PATTERNS:
        if pattern.search(clean):
            flagged = True
            reasons.append("jailbreak_attempt")
            clean = pattern.sub("[REDACTED]", clean)

    for pattern in _INSTRUCTION_INJECTION:
        if pattern.search(clean):
            flagged = True
            reasons.append("instruction_injection")
            clean = pattern.sub("[REDACTED]", clean)

    for pattern in _SEPARATOR_INJECTION:
        if pattern.search(clean):
            flagged = True
            reasons.append("separator_injection")
            clean = pattern.sub("[REDACTED]", clean)

    return SanitizerResult(
        clean=clean,
        flagged=flagged,
        reason="; ".join(sorted(set(reasons))) if reasons else "",
    )


def is_injection_attempt(text: str) -> bool:
    """Quick check — returns True if any injection pattern is detected.

    Useful for early rejection at the API layer without modifying the text.
    """
    if not text:
        return False
    t = text[:2000]
    for patterns in (_LEAKAGE_PATTERNS, _JAILBREAK_PATTERNS, _INSTRUCTION_INJECTION, _SEPARATOR_INJECTION):
        for pattern in patterns:
            if pattern.search(t):
                return True
    return False
