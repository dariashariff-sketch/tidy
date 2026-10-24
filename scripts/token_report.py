"""Summarize data/usage_log.jsonl into the numbers the Tokenomics section needs.

Usage:  python scripts/token_report.py [--quests-per-user 20]
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tidy import config  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quests-per-user", type=int, default=20,
                        help="assumed quests a typical user creates per month")
    args = parser.parse_args()

    if not config.USAGE_LOG.exists():
        print("No usage log yet. Create a few quests in the app first.")
        return

    runs = defaultdict(lambda: defaultdict(int))
    by_agent = defaultdict(lambda: defaultdict(int))
    for line in config.USAGE_LOG.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        if row.get("event") or row.get("agent") == "warmup":   # startup warm-up isn't a player run
            continue
        for key in ("input_tokens", "cached_tokens", "output_tokens", "reasoning_tokens", "latency_ms"):
            runs[row["run_id"]][key] += row.get(key, 0)
            by_agent[row["agent"]][key] += row.get(key, 0)
        runs[row["run_id"]]["cost"] += row["cost_usd"]
        runs[row["run_id"]]["calls"] += 1
        by_agent[row["agent"]]["calls"] += 1

    # A run is one to-do turned into a pile: one call to the Tidier agent.
    full = [r for r in runs.values() if r["calls"] >= 1]
    if not full:
        print("No complete runs yet.")
        return
    n = len(full)
    avg = {k: sum(r[k] for r in full) / n for k in ("input_tokens", "cached_tokens", "output_tokens",
                                                     "reasoning_tokens", "cost", "latency_ms")}

    print(f"\nComplete runs measured: {n}")
    print(f"Model: gpt-6-luna, reasoning effort: {config.REASONING_EFFORT}")
    print(f"Prices used ($/1M): input {config.PRICE_INPUT_PER_M}, cached {config.PRICE_CACHED_INPUT_PER_M}, "
          f"output {config.PRICE_OUTPUT_PER_M}\n")
    print("Per run (one to-do turned into a pile):")
    print(f"  input tokens     {avg['input_tokens']:,.0f}")
    print(f"  cached input     {avg['cached_tokens']:,.0f}")
    print(f"  output tokens    {avg['output_tokens']:,.0f}  (of which hidden reasoning {avg['reasoning_tokens']:,.0f})")
    print(f"  model time       {avg['latency_ms'] / 1000:,.1f} s summed across agents")
    print(f"  cost             ${avg['cost']:.4f}\n")

    print("By agent (average per call):")
    for agent, d in by_agent.items():
        c = d["calls"]
        print(f"  {agent:<11} in {d['input_tokens'] / c:6.0f}   out {d['output_tokens'] / c:6.0f}   calls {c}")

    per_user = avg["cost"] * args.quests_per_user
    print(f"\nAssuming {args.quests_per_user} quests per user per month:")
    print(f"  cost per user per month   ${per_user:.3f}")
    print(f"  100 users                 ${per_user * 100:,.2f} / month")
    print(f"  10,000 users              ${per_user * 10_000:,.2f} / month\n")


if __name__ == "__main__":
    main()
