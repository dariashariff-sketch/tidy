"""Settings for Tidy: API keys, model choice, prices and safety limits."""

import os
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"
USAGE_LOG = DATA_DIR / "usage_log.jsonl"


def _load_env() -> Path | None:
    """Look for .env in the app folder first, then one folder up."""
    for folder in (APP_DIR, APP_DIR.parent):
        env_path = folder / ".env"
        if env_path.is_file():
            load_dotenv(env_path, override=False)
            return env_path
    return None


ENV_FILE = _load_env()

PORTKEY_API_KEY = os.getenv("PORTKEY_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

# The course key only allows gpt-6-luna (served through Azure OpenAI by Portkey).
PORTKEY_MODEL_CANDIDATES = ["gpt-6-luna"]
# gpt-6-luna is a reasoning model. "low" keeps it fast and cheap; see README for the tradeoff.
REASONING_EFFORT = os.getenv("TIDY_REASONING_EFFORT", "low")
OPENAI_MODEL = "gpt-4o-mini"  # only used with a personal OPENAI_API_KEY

if PORTKEY_API_KEY:
    PROVIDER = "portkey"
elif OPENAI_API_KEY:
    PROVIDER = "openai"
else:
    PROVIDER = "demo"  # no key found: canned answers so the UI still works

# Prices in US dollars per 1 million tokens, used for the cost estimates.
# TODO: confirm these against the Portkey dashboard before quoting them.
PRICE_INPUT_PER_M = 1.25
PRICE_CACHED_INPUT_PER_M = 0.125
PRICE_OUTPUT_PER_M = 10.00

# Safety limits
MAX_TASK_CHARS = 300          # longest task description we accept
MAX_ACTIVE_QUESTS = 30        # plenty for a long to-do list, still a cap on spending
MAX_CALLS_PER_MINUTE = 20     # stops a stuck client from spamming the API
DAILY_TOKEN_BUDGET = 300_000  # hard stop on spending per day
MAX_OUTPUT_TOKENS = 2000      # cap on any single agent reply (includes hidden reasoning)
