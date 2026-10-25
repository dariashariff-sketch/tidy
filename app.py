"""Tidy: turn the task you're avoiding into a room you clean one tiny step at a time.

Run with:  python app.py   then open http://127.0.0.1:5050
"""

import os
import threading
import webbrowser

from flask import Flask, Response, jsonify, request, send_from_directory

from tidy import agents, catalog, config, llm, store

app = Flask(__name__, static_folder="static", static_url_path="/static")
PORT = int(os.environ.get("TIDY_PORT", "5050"))   # change the port if 5050 is busy


def _error(message: str, status: int = 400, **extra):
    return jsonify({"error": message, **extra}), status


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/state")
def get_state():
    return jsonify(store.public(store.load()))


@app.get("/api/catalog")
def get_catalog():
    return jsonify({"messes": catalog.MESSES, "decor": catalog.DECOR, "slots": catalog.MESS_SLOTS,
                    "xp_by_size": catalog.XP_BY_SIZE, "unlocks": catalog.DECOR_UNLOCKS, "pets": catalog.PETS,
                    "toys": catalog.TOYS})


@app.post("/api/quests")
def create_quest():
    body = request.get_json(silent=True) or {}
    task = str(body.get("task", ""))
    try:
        store.check_room_space()
        plan = agents.plan_quest(task)
        return jsonify(store.add_quest(plan))
    except agents.Blocked as b:
        return _error(b.info.get("message", "Blocked"), 422, blocked=b.info)
    except store.GameError as e:
        return _error(str(e), 409)
    except llm.BudgetExceeded as e:
        return _error(str(e), 429)
    except llm.LLMError as e:
        return _error(str(e), 502)


@app.post("/api/quests/<quest_id>/done")
def done(quest_id):
    try:
        return jsonify(store.complete(quest_id))
    except store.GameError as e:
        return _error(str(e), 404)


@app.post("/api/quests/order")
def order():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids")
    if not isinstance(ids, list):
        return _error("Send the to-do ids in their new order.")
    return jsonify(store.reorder([str(i) for i in ids]))


@app.post("/api/quests/<quest_id>/design")
def design(quest_id):
    """The Designer builds a custom object for this pile, once."""
    try:
        quest = store.get_quest(quest_id)
    except store.GameError as e:
        return _error(str(e), 404)
    if "model" in quest:
        return jsonify(store.public(store.load()))
    try:
        model, _usage = agents.design_item(quest["task"])
    except llm.BudgetExceeded:
        model = None
    return jsonify(store.save_model(quest_id, model))


@app.post("/api/quests/<quest_id>/tips")
def tips(quest_id):
    """The Coach agent writes tips once per task; after that they come from the save file."""
    try:
        quest = store.get_quest(quest_id)
        if quest.get("tips"):
            return jsonify({"tips": quest["tips"], "cached": True})
        tips_list, usage = agents.coach_tips(quest["task"])
        store.save_tips(quest_id, tips_list)
        return jsonify({"tips": tips_list, "cached": False, "usage": usage})
    except store.GameError as e:
        return _error(str(e), 404)
    except llm.BudgetExceeded as e:
        return _error(str(e), 429)
    except llm.LLMError as e:
        return _error(str(e), 502)


@app.delete("/api/quests/<quest_id>")
def drop(quest_id):
    try:
        return jsonify(store.drop_quest(quest_id))
    except store.GameError as e:
        return _error(str(e), 404)


@app.post("/api/decor/<name>/place")
def decor_place(name):
    try:
        return jsonify(store.place(name))
    except store.GameError as e:
        return _error(str(e), 409)


@app.post("/api/decor/<name>/store")
def decor_store(name):
    try:
        return jsonify(store.stash(name))
    except store.GameError as e:
        return _error(str(e), 409)


@app.post("/api/decor/<name>/move")
def decor_move(name):
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(store.move(name, body.get("x", 0), body.get("z", 0), body.get("y"), body.get("rot")))
    except (TypeError, ValueError):
        return _error("Send x and z as numbers.")
    except store.GameError as e:
        return _error(str(e), 409)


@app.post("/api/shop/<toy>/buy")
def shop_buy(toy):
    try:
        return jsonify(store.buy_toy(toy))
    except store.GameError as e:
        return _error(str(e), 409)


@app.post("/api/toys/select")
def toy_select():
    body = request.get_json(silent=True) or {}
    toy = body.get("toy")
    try:
        return jsonify(store.select_toy(str(toy) if toy else None))
    except store.GameError as e:
        return _error(str(e), 409)


@app.post("/api/toys/squish")
def toy_squish():
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(store.add_squishes(int(body.get("count", 0))))
    except (TypeError, ValueError):
        return _error("Count must be a number.")


@app.post("/api/focus")
def focus():
    """Ask the Prioritizer which pile to start with, unless it already decided for this list."""
    state = store.load()
    quests = state["quests"]
    key = store.focus_key(quests)
    if state.get("focus") and state["focus"].get("key") == key:
        return jsonify(store.public(state))
    if not quests:
        return jsonify(store.save_focus(None, key))
    try:
        pick, _usage = agents.pick_first(quests)
    except llm.BudgetExceeded:
        smallest = min(quests, key=lambda q: q["size"])
        pick = {"id": smallest["id"], "reason": "Small and quick, a nice warm-up."}
    return jsonify(store.save_focus(pick, key))


@app.post("/api/history/<quest_id>/answer")
def answer(quest_id):
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(store.record_answer(quest_id, str(body.get("answer", ""))))
    except store.GameError as e:
        return _error(str(e), 404)


@app.post("/api/visit")
def visit():
    return jsonify(store.record_visit())


@app.get("/api/export.csv")
def export_csv():
    return Response(store.history_csv(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=tidy_trial_data.csv"})


@app.post("/api/pet")
def pet():
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(store.choose_pet(str(body.get("pet", ""))))
    except store.GameError as e:
        return _error(str(e))


@app.post("/api/reset")
def reset():
    return jsonify(store.reset())


@app.get("/api/usage")
def usage():
    return jsonify({
        "provider": config.PROVIDER,
        "tokens_today": llm.tokens_used_today(),
        "daily_budget": config.DAILY_TOKEN_BUDGET,
    })


if __name__ == "__main__":
    where = config.ENV_FILE or "no .env found (running in demo mode)"
    print(f"\n  Tidy is starting. Keys from: {where}")
    print(f"  Model provider: {config.PROVIDER}")
    print(f"  Open http://127.0.0.1:{PORT} in your browser. Press Ctrl+C to stop.\n")
    if not os.environ.get("TIDY_NO_BROWSER"):
        threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()
    app.run(host="127.0.0.1", port=PORT, debug=False)
