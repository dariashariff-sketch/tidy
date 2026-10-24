"""Measure tokens, cost and speed for all four agents on the same set of tasks.

Usage:  python scripts/measure_agents.py
Writes: data/agent_costs.json

What one to-do costs: the Tidier (always), the Designer (always, once), and the Prioritizer
(once each time the list changes). The Coach only runs when someone clicks "See tips", so the
monthly estimate assumes it's used on a share of tasks (COACH_SHARE below).
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tidy import agents, config  # noqa: E402

TASKS = [
    "Do my laundry",
    "Essay due Tuesday",
    "Call my mom",
    "Submit the stats problem set tonight",
    "Go grocery shopping",
    "Reply to the 40 unread emails in my inbox",
    "Water the plants",
    "Study for my finance midterm next Friday",
]
TASKS_PER_USER_PER_MONTH = 20
COACH_SHARE = 0.3          # assume "See tips" is clicked on 30% of tasks


def summarize(rows: list[dict]) -> dict:
    n = len(rows) or 1
    return {
        "calls": len(rows),
        "avg_input": round(sum(r["input_tokens"] for r in rows) / n),
        "avg_cached": round(sum(r["cached_tokens"] for r in rows) / n),
        "avg_output": round(sum(r["output_tokens"] for r in rows) / n),
        "avg_seconds": round(sum(r["latency_ms"] for r in rows) / n / 1000, 2),
        "avg_cost_usd": round(sum(r["cost_usd"] for r in rows) / n, 6),
    }


def main():
    config.MAX_CALLS_PER_MINUTE = 60  # batch script, not a user clicking
    usage = {"tidier": [], "designer": [], "coach": [], "prioritizer": []}
    open_quests = []
    for i, task in enumerate(TASKS):
        plan = agents.plan_quest(task)
        usage["tidier"] += plan["usage"]
        model, u = agents.design_item(task)
        if u:
            usage["designer"].append(u)
        tips, u = agents.coach_tips(task)
        if u:
            usage["coach"].append(u)
        open_quests.append({"id": f"q{i}", "task": task, "size": plan["size"], "due": plan.get("due"),
                            "created": time.strftime("%Y-%m-%dT%H:%M:%S")})
        if len(open_quests) >= 2:
            pick, u = agents.pick_first(open_quests)
            if u:
                usage["prioritizer"].append(u)
        print(f"  {task[:40]:<40} size {plan['size']} due {plan.get('due')}  "
              f"object: {(model or {}).get('object')}")

    per_agent = {name: summarize(rows) for name, rows in usage.items()}
    per_task = (per_agent["tidier"]["avg_cost_usd"] + per_agent["designer"]["avg_cost_usd"]
                + per_agent["prioritizer"]["avg_cost_usd"] + COACH_SHARE * per_agent["coach"]["avg_cost_usd"])
    per_user = per_task * TASKS_PER_USER_PER_MONTH
    result = {
        "model": "gpt-6-luna", "reasoning_effort": config.REASONING_EFFORT,
        "prices_per_million": {"input": config.PRICE_INPUT_PER_M, "cached_input": config.PRICE_CACHED_INPUT_PER_M,
                               "output": config.PRICE_OUTPUT_PER_M},
        "per_agent": per_agent,
        "assumptions": {"tasks_per_user_per_month": TASKS_PER_USER_PER_MONTH, "coach_share": COACH_SHARE},
        "cost_per_task_usd": round(per_task, 5),
        "cost_per_user_per_month_usd": round(per_user, 4),
        "cost_100_users_usd": round(per_user * 100, 2),
        "cost_10000_users_usd": round(per_user * 10_000, 2),
    }
    print()
    for name, a in per_agent.items():
        print(f"{name:<12} calls {a['calls']:>2}  in {a['avg_input']:>4}  out {a['avg_output']:>4}  "
              f"{a['avg_seconds']:>5}s  ${a['avg_cost_usd']:.5f}")
    print(f"\nPer to-do (Tidier + Designer + Prioritizer + {COACH_SHARE:.0%} Coach): ${per_task:.5f}")
    print(f"Per user per month ({TASKS_PER_USER_PER_MONTH} to-dos): ${per_user:.3f}")
    print(f"100 users: ${per_user * 100:,.2f}/month   10,000 users: ${per_user * 10_000:,.2f}/month")
    config.DATA_DIR.mkdir(exist_ok=True)
    (config.DATA_DIR / "agent_costs.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
