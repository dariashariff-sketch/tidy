"""Fast rule-based checks that run before any text reaches the model."""

import re

from . import config

CRISIS_MESSAGE = (
    "It sounds like you might be going through something really heavy. "
    "Tidy is a to-do helper, not a crisis service, so it's going to pause here. "
    "You deserve support from a real person right now."
)

CRISIS_RESOURCES = [
    {"name": "988 Suicide & Crisis Lifeline", "detail": "Call or text 988 (US), 24/7"},
    {"name": "Crisis Text Line", "detail": "Text HOME to 741741"},
    {"name": "Yale Mental Health & Counseling", "detail": "203-432-0290, available 24/7"},
    {"name": "Emergency", "detail": "Call 911 if you are in immediate danger"},
]

_CRISIS_PATTERNS = [
    r"\bkill(ing)? myself\b",
    r"\bsuicid",
    r"\bend(ing)? (my|it all|my own) li(fe|ves)\b",
    r"\bend it all\b",
    r"\bself[- ]?harm",
    r"\bhurt(ing)? myself\b",
    r"\bcut(ting)? myself\b",
    r"\bwant(ed)? to die\b",
    r"\bdon'?t want to (live|be alive|exist)\b",
    r"\bno reason to live\b",
    r"\bbetter off dead\b",
]

_INJECTION_PATTERNS = [
    r"ignore (all |any |the )?(previous|prior|above|earlier|your)? ?(instructions|rules|prompts?)",
    r"disregard (all |any |the )?(previous|prior|above|your)? ?(instructions|rules)",
    r"(reveal|show|print|repeat|leak).{0,30}(system prompt|instructions|prompt)",
    r"\bsystem prompt\b",
    r"\byou are now\b",
    r"\bdeveloper mode\b",
    r"\bjailbreak",
    r"</?\s*(task|system|assistant)\s*>",
]

_crisis_re = [re.compile(p, re.IGNORECASE) for p in _CRISIS_PATTERNS]
_injection_re = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]


def clean(text: str) -> str:
    """Strip control characters and squash whitespace."""
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def screen(text: str) -> dict:
    """Return {"status": "ok" | "crisis" | "injection" | "invalid", "message": ...}."""
    if not text:
        return {"status": "invalid", "message": "Tell Tidy what you're putting off first."}
    if len(text) > config.MAX_TASK_CHARS:
        return {"status": "invalid",
                "message": f"Keep it under {config.MAX_TASK_CHARS} characters, just the one task."}
    if any(r.search(text) for r in _crisis_re):
        return {"status": "crisis", "message": CRISIS_MESSAGE, "resources": CRISIS_RESOURCES}
    if any(r.search(text) for r in _injection_re):
        return {"status": "injection",
                "message": "That looked like instructions for the AI rather than a task, so Tidy blocked it. "
                           "Try describing something you're putting off."}
    return {"status": "ok"}
