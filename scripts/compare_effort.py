"""Measure the cost/speed/quality tradeoff of gpt-6-luna's reasoning effort setting.

Usage:  python scripts/compare_effort.py
Writes: data/effort_comparison.json
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tidy import agents, config  # noqa: E402

# Each task with the pile a person would expect, to check the Tidier's choices.
TASKS = [
    ("Do my laundry", "laundry_pile"),
    ("Wash the dishes from this weekend", "dirty_dishes"),
    ("Write my essay for history class", "crumpled_papers"),
    ("Reply to the 40 unread emails in my inbox", "tangled_cables"),
    ("Take out the trash", "trash_bag"),
    ("Unpack the boxes from my move", "cardboard_box"),
    ("Return the library books", "book_stack"),
    ("Vacuum my apartment", "dust_bunny"),
]


def run(effort: str) -> dict:
    config.REASONING_EFFORT = effort
    rows = []
    for task, expected in TASKS:
        start = time.time()
        plan = agents.plan_quest(task)
        rows.append({
            "task": task,
            "seconds": round(time.time() - start, 2),
            "cost_usd": plan["totals"]["cost_usd"],
            "output_tokens": plan["totals"]["output_tokens"],
            "pile": plan["mess"],
            "name": plan["name"],
            "size": plan["size"],
            "matches_expected_pile": plan["mess"] == expected,
        })
        print(f"  [{effort}] {task[:38]:<38} {rows[-1]['seconds']:5.1f}s  ${rows[-1]['cost_usd']:.5f}  "
              f"{plan['mess']:<16} {'match' if rows[-1]['matches_expected_pile'] else 'differs'}  {plan['name']}")
    n = len(rows)
    return {
        "effort": effort,
        "avg_seconds": round(sum(r["seconds"] for r in rows) / n, 2),
        "avg_cost_usd": round(sum(r["cost_usd"] for r in rows) / n, 6),
        "avg_output_tokens": round(sum(r["output_tokens"] for r in rows) / n),
        "pile_match_rate": sum(r["matches_expected_pile"] for r in rows) / n,
        "runs": rows,
    }


def main():
    config.MAX_CALLS_PER_MINUTE = 60  # batch script, not a user clicking
    results = [run(e) for e in ("low", "medium")]
    print()
    for r in results:
        print(f"{r['effort']:<7} avg {r['avg_seconds']}s  ${r['avg_cost_usd']}  "
              f"{r['avg_output_tokens']} output tokens  expected pile {r['pile_match_rate']:.0%}")
    (config.DATA_DIR / "effort_comparison.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
