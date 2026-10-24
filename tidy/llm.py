"""One place that talks to the language model, logs every token and enforces the budget."""

import json
import re
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime

from . import config


class BudgetExceeded(Exception):
    """Raised when the daily token budget or the rate limit is hit."""


class LLMError(Exception):
    """Raised when the model can't be reached or returns garbage."""


class ContentFiltered(Exception):
    """The provider's own safety filter (Azure Prompt Shields) refused the input."""


_lock = threading.Lock()
_working_model = None
_recent_calls: list[float] = []

# We call the provider's HTTP API directly with Python's standard library. The official SDKs took
# about 16 seconds just to import on Windows, which made the first task after startup very slow.
PORTKEY_URL = "https://api.portkey.ai/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
TIMEOUT_SECONDS = 45


class _HTTPError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:500]}")
        self.status = status
        self.body = body


def _post(body: dict) -> dict:
    if config.PROVIDER == "portkey":
        url, auth = PORTKEY_URL, {"x-portkey-api-key": config.PORTKEY_API_KEY}
    else:
        url, auth = OPENAI_URL, {"Authorization": f"Bearer {config.OPENAI_API_KEY}"}
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json", "User-Agent": "tidy/1.0", **auth})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise _HTTPError(e.code, e.read().decode("utf-8", "replace")) from e


def _model_candidates() -> list[str]:
    if _working_model:
        return [_working_model]
    if config.PROVIDER == "portkey":
        return list(config.PORTKEY_MODEL_CANDIDATES)
    return [config.OPENAI_MODEL]


def tokens_used_today() -> int:
    if not config.USAGE_LOG.exists():
        return 0
    today = date.today().isoformat()
    total = 0
    with config.USAGE_LOG.open(encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("ts", "").startswith(today):
                total += row.get("input_tokens", 0) + row.get("output_tokens", 0)
    return total


def _check_limits() -> None:
    now = time.time()
    with _lock:
        _recent_calls[:] = [t for t in _recent_calls if now - t < 60]
        if len(_recent_calls) >= config.MAX_CALLS_PER_MINUTE:
            raise BudgetExceeded("Too many requests this minute. Take a breath and try again shortly.")
        _recent_calls.append(now)
    if tokens_used_today() >= config.DAILY_TOKEN_BUDGET:
        raise BudgetExceeded("Tidy hit its daily spending limit. It resets tomorrow.")


def cost_usd(input_tokens: int, cached_tokens: int, output_tokens: int) -> float:
    uncached = max(input_tokens - cached_tokens, 0)
    return (
        uncached * config.PRICE_INPUT_PER_M
        + cached_tokens * config.PRICE_CACHED_INPUT_PER_M
        + output_tokens * config.PRICE_OUTPUT_PER_M
    ) / 1_000_000


def _log(row: dict) -> None:
    config.DATA_DIR.mkdir(exist_ok=True)
    with _lock, config.USAGE_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def _create(model: str, messages: list[dict], max_tokens: int) -> dict:
    """Call the model, dropping any optional setting the provider says it doesn't support."""
    options = {
        "max_completion_tokens": max_tokens,
        "reasoning_effort": config.REASONING_EFFORT,
        "response_format": {"type": "json_object"},
    }
    for _ in range(len(options) + 1):
        try:
            return _post({"model": model, "messages": messages, **options})
        except _HTTPError as e:
            rejected = next((k for k in options if k in e.body), None) if e.status == 400 else None
            if rejected is None:
                raise
            if rejected == "max_completion_tokens":
                options["max_tokens"] = options.pop("max_completion_tokens")
            else:
                options.pop(rejected)
    raise LLMError("The model rejected every request format we tried.")


def parse_json(text: str) -> dict:
    """Pull the first JSON object out of a model reply."""
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    raise LLMError("The model's reply wasn't valid JSON.")


def chat_json(agent: str, system: str, user: str, run_id: str, max_tokens: int | None = None) -> tuple[dict, dict]:
    """Call the model as one agent. Returns (parsed JSON, usage record)."""
    global _working_model
    _check_limits()
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    max_tokens = min(max_tokens or config.MAX_OUTPUT_TOKENS, config.MAX_OUTPUT_TOKENS)

    last_error = None
    for model in _model_candidates():
        start = time.time()
        try:
            resp = _create(model, messages, max_tokens)
        except Exception as e:
            if "content_filter" in str(e) or "content management policy" in str(e):
                _log({"ts": datetime.now().isoformat(timespec="seconds"), "run_id": run_id, "agent": agent,
                      "model": model, "input_tokens": 0, "cached_tokens": 0, "output_tokens": 0,
                      "reasoning_tokens": 0, "latency_ms": int((time.time() - start) * 1000),
                      "cost_usd": 0, "event": "provider_content_filter"})
                raise ContentFiltered(str(e)) from e
            last_error = e
            continue
        _working_model = model
        usage = resp.get("usage") or {}
        input_tokens = usage.get("prompt_tokens") or 0
        output_tokens = usage.get("completion_tokens") or 0
        cached_tokens = (usage.get("prompt_tokens_details") or {}).get("cached_tokens") or 0
        reasoning_tokens = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens") or 0
        record = {
            "ts": datetime.now().isoformat(timespec="seconds"),
            "run_id": run_id,
            "agent": agent,
            "model": model,
            "input_tokens": input_tokens,
            "cached_tokens": cached_tokens,
            "output_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "latency_ms": int((time.time() - start) * 1000),
            "cost_usd": round(cost_usd(input_tokens, cached_tokens, output_tokens), 6),
        }
        _log(record)
        content = resp["choices"][0]["message"]["content"]
        return parse_json(content), record

    print(f"[tidy] model call failed ({agent}): {last_error}")
    raise LLMError("Tidy couldn't reach the AI model right now. Check your internet connection and API key, then try again.")

