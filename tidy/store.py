"""Saves the player's room, quests and progress to a local JSON file."""

import json
import threading
import uuid
from datetime import datetime

from . import catalog, config

_lock = threading.Lock()


class GameError(Exception):
    """A friendly message for the player (room full, unknown quest, ...)."""


def _empty() -> dict:
    # decor = everything unlocked; placed = what's in the room (name -> [x, z], or None for its usual spot)
    return {"xp": 0, "coins": 0, "quests": [], "decor": [], "placed": {}, "pet": None,
            "toys": [], "active_toy": None, "squishes": 0, "history": [], "last_run": None,
            "removed": 0, "active_days": [], "focus": None}


def load() -> dict:
    if not config.STATE_FILE.exists():
        return _empty()
    try:
        state = json.loads(config.STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty()
    had_placed = "placed" in state
    state = {**_empty(), **state}
    state["decor"] = [d for d in state["decor"] if d in catalog.DECOR]
    if not had_placed:  # saves from before storage existed: everything unlocked was in the room
        state["placed"] = {d: None for d in state["decor"]}
    state["placed"] = {d: p for d, p in state["placed"].items() if d in state["decor"]}
    state["quests"] = [q for q in state["quests"] if "slot" in q and "size" in q]
    return state


def save(state: dict) -> None:
    config.DATA_DIR.mkdir(exist_ok=True)
    tmp = config.STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(config.STATE_FILE)


def _fmt_hours(hours: float) -> str:
    if hours < 1:
        return f"{max(1, round(hours * 60))} min"
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} days"


def public(state: dict) -> dict:
    """What the frontend needs, including computed level and stats."""
    durations = [h["hours_to_finish"] for h in state["history"] if h.get("hours_to_finish") is not None]
    answers = [h.get("without_tidy") for h in state["history"] if h.get("without_tidy")]
    done = len(state["history"])
    stats = {
        "tasks_done": done,
        "big_tasks_done": sum(h.get("size") == 3 for h in state["history"]),
        "avg_finish": _fmt_hours(sum(durations) / len(durations)) if durations else None,
        "removed": state["removed"],
        "completion_rate": round(100 * done / (done + state["removed"])) if done + state["removed"] else None,
        "active_days": len(state["active_days"]),
        "answers": {k: answers.count(k) for k in ("yes", "maybe", "no")},
        "helped": round(100 * (answers.count("yes") + answers.count("maybe")) / len(answers)) if answers else None,
    }
    mess_weight = sum(q["size"] for q in state["quests"])
    return {
        **state,
        **catalog.level_for(state["xp"]),
        "next_unlock": catalog.next_unlock(state["xp"]),
        "decor_total": len(catalog.DECOR),
        "draggable": sorted(catalog.DRAGGABLE | catalog.WALL_DRAGGABLE),
        "wall_draggable": sorted(catalog.WALL_DRAGGABLE),
        "stats": stats,
        # Each small/medium/large pile takes 4/8/12 points off; 25 medium-ish piles = a messy room.
        "tidiness": max(0, 100 - 4 * mess_weight),
        "provider": config.PROVIDER,
    }


def check_room_space() -> None:
    """Called before spending tokens, so a full room never costs money."""
    state = load()
    if len(state["quests"]) >= config.MAX_ACTIVE_QUESTS:
        raise GameError(f"You already have {config.MAX_ACTIVE_QUESTS} piles in your room. "
                        "Clear one before adding more. That's the point!")


def add_quest(plan: dict) -> dict:
    with _lock:
        state = load()
        used = {q.get("slot") for q in state["quests"]}
        free = [i for i in range(len(catalog.MESS_SLOTS)) if i not in used]
        if not free:
            raise GameError("Your room is too messy for a new pile. Clear one first!")
        free = [_emptiest_slot(state, free)]
        quest = {
            "id": uuid.uuid4().hex[:8],
            "run_id": plan["run_id"],
            "task": plan["task"],
            "name": plan["name"],
            "mess": plan["mess"],
            "size": plan["size"],
            "due": plan.get("due"),
            "slot": free[0],
            "created": datetime.now().isoformat(timespec="seconds"),
        }
        state["quests"].append(quest)
        state["last_run"] = {k: plan[k] for k in ("run_id", "trace", "usage", "totals", "name")}
        save(state)
        return public(state)


def _emptiest_slot(state: dict, free: list[int]) -> int:
    """Pick the open floor spot with the most room around it: away from furniture, rugs, the dog's
    spot and other piles (using wherever the player has moved things)."""
    things = []                                   # (x, z, radius) of everything already on the floor
    for name, pos in state["placed"].items():
        if name in catalog.FLOOR_FOOTPRINT:
            hx, hz, r = catalog.FLOOR_FOOTPRINT[name]
            things.append((pos[0], pos[1], r) if pos else (hx, hz, r))
    for q in state["quests"]:
        if q.get("slot") is not None and q["slot"] < len(catalog.MESS_SLOTS):
            x, z = catalog.MESS_SLOTS[q["slot"]]
            things.append((x, z, catalog.PILE_RADIUS))
    if state.get("pet") == "dog":
        things.append(catalog.DOG_SPOT)
    if not things:
        return free[0]

    def room_around(i: int) -> float:
        x, z = catalog.MESS_SLOTS[i]
        return min(((x - tx) ** 2 + (z - tz) ** 2) ** 0.5 - r for tx, tz, r in things)

    # Prefer the earlier (nicer) spots among those that are clearly empty, else the roomiest one.
    clear = [i for i in free if room_around(i) > catalog.PILE_RADIUS]
    return clear[0] if clear else max(free, key=room_around)


def _unlock(state: dict) -> list[str]:
    """Add any decorations the player's XP now earns. Returns the new ones."""
    new = [d for d in catalog.unlocked_by(state["xp"]) if d not in state["decor"]]
    state["decor"].extend(new)
    return new


def _find(state: dict, quest_id: str) -> dict:
    for q in state["quests"]:
        if q["id"] == quest_id:
            return q
    raise GameError("That pile doesn't exist anymore.")


def complete(quest_id: str) -> dict:
    """The player did the task: clear the pile and hand out XP by how big it was."""
    with _lock:
        state = load()
        quest = _find(state, quest_id)
        xp = catalog.XP_BY_SIZE[quest["size"]]
        state["xp"] += xp
        state["coins"] += catalog.COINS_PER_TASK
        unlocked = _unlock(state)
        state["history"].append({
            "id": quest["id"],
            "task": quest["task"],
            "name": quest["name"],
            "size": quest["size"],
            "hours_to_finish": round(
                (datetime.now() - datetime.fromisoformat(quest["created"])).total_seconds() / 3600, 2),
            "finished": datetime.now().isoformat(timespec="seconds"),
        })
        state["quests"] = [q for q in state["quests"] if q["id"] != quest_id]
        save(state)
        return {**public(state), "event": {"quest_id": quest_id, "name": quest["name"], "xp": xp,
                                           "coins": catalog.COINS_PER_TASK, "unlocked": unlocked}}


def reorder(ids: list[str]) -> dict:
    """Save the order the player dragged their to-dos into. Unknown ids are ignored."""
    with _lock:
        state = load()
        by_id = {q["id"]: q for q in state["quests"]}
        ordered = [by_id.pop(i) for i in ids if i in by_id]
        state["quests"] = ordered + list(by_id.values())
        save(state)
        return public(state)


def get_quest(quest_id: str) -> dict:
    return dict(_find(load(), quest_id))


def save_model(quest_id: str, model: dict | None) -> dict:
    """Save the Designer's object for a pile (False means "tried, use the ready-made pile")."""
    with _lock:
        state = load()
        for q in state["quests"]:
            if q["id"] == quest_id:
                q["model"] = model if model else False
                save(state)
                break
        return public(state)


def save_tips(quest_id: str, tips: list[str]) -> dict:
    with _lock:
        state = load()
        quest = _find(state, quest_id)
        quest["tips"] = tips
        save(state)
        return public(state)


def _owned(state: dict, name: str) -> None:
    if name not in state["decor"]:
        raise GameError("You haven't unlocked that yet.")


def place(name: str) -> dict:
    """Take an item out of storage and put it in its usual spot in the room."""
    with _lock:
        state = load()
        _owned(state, name)
        state["placed"].setdefault(name, None)
        save(state)
        return public(state)


def stash(name: str) -> dict:
    """Put an item from the room into storage."""
    with _lock:
        state = load()
        _owned(state, name)
        state["placed"].pop(name, None)
        save(state)
        return public(state)


def move(name: str, x: float, z: float, y: float | None = None, rot: float | None = None) -> dict:
    """Save where the player put an item: [x, z, rot] on the floor, [x, z, y, rot] on a wall."""
    with _lock:
        state = load()
        _owned(state, name)
        if name not in catalog.DRAGGABLE and name not in catalog.WALL_DRAGGABLE:
            raise GameError("That one stays where it is.")
        clamp = lambda v, lo=catalog.ROOM_MIN, hi=catalog.ROOM_MAX: round(max(lo, min(float(v), hi)), 2)
        if name in catalog.WALL_DRAGGABLE:
            state["placed"][name] = [clamp(x, -6, 6), clamp(z, -6, 6), clamp(y or 2, 0, 5), round(float(rot or 0), 3)]
        else:
            state["placed"][name] = [clamp(x), clamp(z), round(float(rot or 0), 3)]
        save(state)
        return public(state)


def buy_toy(toy: str) -> dict:
    """Spend coins on a squishy from the nightstand shop. It comes out right away."""
    with _lock:
        state = load()
        if toy not in catalog.TOYS:
            raise GameError("The shop doesn't sell that.")
        if toy in state["toys"]:
            raise GameError("You already have that one.")
        label, price = catalog.TOYS[toy]
        if state["coins"] < price:
            raise GameError(f"You need {price - state['coins']} more coins for the {label.lower()}.")
        state["coins"] -= price
        state["toys"].append(toy)
        state["active_toy"] = toy
        save(state)
        return public(state)


def select_toy(toy: str | None) -> dict:
    """Choose which owned squishy is out on screen (None puts it away)."""
    with _lock:
        state = load()
        if toy is not None and toy not in state["toys"]:
            raise GameError("Buy it in the shop first.")
        state["active_toy"] = toy
        save(state)
        return public(state)


def add_squishes(count: int) -> dict:
    """Keep a running total of squishes (sent in small batches by the page)."""
    with _lock:
        state = load()
        state["squishes"] += max(0, min(int(count), 500))
        save(state)
        return public(state)


def choose_pet(pet: str) -> dict:
    with _lock:
        state = load()
        if pet not in catalog.PETS:
            raise GameError("Pick a dog, a cat or a fish.")
        state["pet"] = pet
        save(state)
        return public(state)


def record_answer(quest_id: str, answer: str) -> dict:
    """Save the answer to the pet's question: did Tidy help with the task? (yes / maybe = "a bit" / no)"""
    if answer not in ("yes", "maybe", "no"):
        raise GameError("Answer yes, maybe or no.")
    with _lock:
        state = load()
        for h in state["history"]:
            if h.get("id") == quest_id:
                h["without_tidy"] = answer
                save(state)
                return public(state)
        raise GameError("That task isn't in your history.")


def focus_key(quests: list[dict]) -> str:
    """Which set of piles a Prioritizer pick was made for."""
    return ",".join(sorted(q["id"] for q in quests))


def save_focus(focus: dict | None, key: str) -> dict:
    with _lock:
        state = load()
        if focus_key(state["quests"]) != key:     # the list changed while the agent was thinking
            return public(state)
        state["focus"] = {**focus, "key": key} if focus else None
        save(state)
        return public(state)


def record_visit() -> dict:
    """Remember which days Tidy was opened (for the user trial)."""
    with _lock:
        state = load()
        today = datetime.now().date().isoformat()
        if today not in state["active_days"]:
            state["active_days"].append(today)
            save(state)
        return public(state)


def history_csv() -> str:
    import csv
    import io
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["task", "size", "added_to_done_hours", "finished", "did_tidy_help"])
    for h in load()["history"]:
        writer.writerow([h.get("task", ""), h.get("size", ""), h.get("hours_to_finish", ""),
                         h.get("finished", ""), {"maybe": "a bit"}.get(h.get("without_tidy"), h.get("without_tidy", ""))])
    return out.getvalue()


def drop_quest(quest_id: str) -> dict:
    with _lock:
        state = load()
        _find(state, quest_id)
        state["removed"] += 1
        state["quests"] = [q for q in state["quests"] if q["id"] != quest_id]
        save(state)
        return public(state)


def reset() -> dict:
    with _lock:
        state = _empty()
        save(state)
        return public(state)
