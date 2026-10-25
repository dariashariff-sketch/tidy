# Tidy

**A cozy voxel room where the to-do list you're avoiding becomes a room you can tidy up, with four AI agents that help you start and a calm, reward-based design built for stressed, procrastinating people.**

Tidy is a to-do list for stressed, procrastinating people that feels like a calm little game. Type
something you're putting off and an AI turns it into an object in your Cube World-style room: "do a back
flip" becomes a gym mat, "water the plants" a watering can. Your pet (a dog, cat or goldfish you pick on
your first visit) walks over to the task you should start with. Stuck? Click **See tips** for a few kind,
practical tips. Do the task however you like, click **Done**, and the item bursts into cubes while your pet
celebrates. Clearing tasks earns XP and coins: XP unlocks decorations for your room, and coins buy
squishy stress toys from the nightstand shop that you can squish on screen.

---

## Run it (about 5 minutes)

You need **Python 3.10 or newer** and an internet connection. Only two small Python packages are needed.

### 1. Get the code

```bash
git clone https://github.com/dariashariff-sketch/tidy.git
cd tidy
```

### 2. Install

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**Mac / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Add your API key

Tidy looks for a `.env` file **in the `tidy` folder first, then in the folder above it**. If you already
have a `.env` one level up with `PORTKEY_API_KEY`, skip this step. Otherwise:

```bash
cp .env.example .env      # Windows: copy .env.example .env
```

and put your key in it:

```
PORTKEY_API_KEY=your-key-here
```

Tidy only reads `PORTKEY_API_KEY` (the course model, `gpt-6-luna`) or, if that's missing,
`OPENAI_API_KEY`. With no key at all it runs in **demo mode** with ready-made items and tips, so you can
still click around.

### 4. Start it

```bash
python app.py
```

Your browser opens **http://127.0.0.1:5050**. If it doesn't, open that link yourself. Press `Ctrl+C` in the
terminal to stop. Your progress is saved in `data/state.json`.

---

## How to use it

1. **Pick your pet:** a dog, a cat or a goldfish.
2. **Add a to-do:** type it the way you'd say it, like *"Essay due Tuesday"*, and click **Add to my room**.
   The AI decides whether it's small, medium or large (25 / 50 / 100 XP), notices any deadline, and builds
   an object for it. The object drops into an empty spot in the room a few seconds later.
3. **Start here:** with two or more to-dos, your pet walks over to the one to start with, a soft glow
   appears under it, and the list marks it **Start here**. Hover over it to see why.
4. **Deadlines:** to-dos with a deadline show a tag like *Due Tue* (red when due today or overdue), and their
   object gathers dust as the day gets close.
5. **Tips:** click **See tips** (or click the object) for 3–4 tips from the Coach.
6. **Done:** do the task for real, then click **Done**. Your pet celebrates, then asks *"Did Tidy help with
   the task?"* (optional, it fades away on its own).
7. **Decorate:** XP unlocks rugs, a painting, a bookshelf and more. Open the **Storage** chest to place or put
   away decorations. Drag floor pieces to move them and click to turn them; drag the painting and banner along
   the walls.
8. **Shop:** click the **nightstand** to slide out its drawer and buy squishies with coins (10 per task).
   Press and hold the squishy on screen to squish it.
9. The buttons in the bottom right toggle **Sound**, **Music** and **Night** mode, and open **Stats & tokens**
   (progress, the user-trial results, a CSV download, and the tokens and cost of the last AI run).
   Drag to rotate the room and scroll to zoom.

---

## The four AI agents

```
 your to-do ─► Rule screen ─► Tidier ─────────► Code checks ─► the to-do is saved
               (free, instant)  safety label,     catalog item,
               crisis words,    pile type, size,  size 1-3,
               injection,       deadline          real date
               length limit          │
                                     ├─► Designer ─► Code checks ─► the object drops into the room
                                     │   builds a voxel  max 24 boxes, clamped
                                     │   object (≤20 boxes) coordinates, real colors
                                     │
 whenever the list changes ──────────┴─► Prioritizer ─► Code checks ─► pet walks to "Start here"
                                         picks where to   id must be one
                                         start, and why   of your to-dos

 "See tips" (on demand) ───────────────► Coach ─► Code checks ─► 3-4 tips (saved, asked only once)
```

| Agent | When it runs | Job |
|---|---|---|
| **Tidier** | Every new to-do | Safety check (ok / crisis / injection / not a task), picks a ready-made pile type, sizes the task, reads any deadline from plain language ("due Tuesday" → a date). |
| **Designer** | Once per to-do | Designs a small voxel object that represents the task (a gym mat for "do a back flip"). If its design is unusable, the Tidier's ready-made pile is used. |
| **Prioritizer** | Only when the list changes, with 2+ to-dos | Picks the to-do to start with: urgent deadlines first, otherwise a quick win. |
| **Coach** | Only when you click **See tips** | Writes 3–4 tips: a first move, a way to make it lighter, and one kind tip for the stress. |

All agents use **gpt-6-luna** through Portkey with `reasoning_effort="low"`, called directly over HTTPS
(no SDK, which used to add ~16 s to startup). Tidy started as a pipeline that broke each task into small
steps; early testing found that confusing, so it became one task = one object, with help on demand.

## Safety defenses

- **Crisis detection:** keyword rules plus the Tidier's own check. Tidy stops and shows the 988 Suicide &
  Crisis Lifeline, Crisis Text Line, and Yale Mental Health & Counseling instead of adding a to-do.
- **Prompt injection:** a rule screen, the Tidier's injection label, user text wrapped in `<task>` tags with
  instructions to treat it as data, Azure's provider-side content filter, and strict code checks on every
  reply (catalog items only, clamped numbers, valid ids, length caps).
- **Agent errors:** every agent reply is checked in code with a safe fallback, so a bad answer can never break
  the room. Each agent makes one call per job, so there are no loops to run away.
- **Runaway spending:** max 30 to-dos, a full-room check before any tokens are spent, 20 model calls per
  minute, a 300,000-token daily budget, a per-reply token cap, a 300-character input limit, and the
  Prioritizer and Coach only run when needed (their results are saved).
- **Data:** everything stays on your computer in `data/`. No accounts, no analytics.

```bash
python scripts/safety_eval.py      # 11 risky and normal inputs -> data/safety_eval.json
```

## Measuring tokens and cost

Every model call is logged to `data/usage_log.jsonl` (input, cached, output and reasoning tokens, latency,
cost).

```bash
python scripts/measure_agents.py   # all four agents on 8 tasks + monthly cost -> data/agent_costs.json
python scripts/token_report.py     # averages from your own usage log
python scripts/compare_effort.py   # low vs medium reasoning effort for the Tidier
python -m unittest discover tests  # offline tests, no key needed
```

Prices are set in `tidy/config.py`.

## User trial data

After each finished task, your pet asks *"Did Tidy help with the task?"* (Yes / A bit / No). **Stats &
tokens** shows tasks done vs removed, average time from adding to done, days used, and the answers.
**Download trial data (CSV)** exports it (also at http://127.0.0.1:5050/api/export.csv).

## Project layout

```
app.py              Flask server and API routes
tidy/agents.py      the four agents (Tidier, Designer, Prioritizer, Coach), prompts and code checks
tidy/llm.py         model calls (straight to Portkey's HTTP API), token logging, budget and rate limits
tidy/safety.py      rule-based crisis / injection / input checks
tidy/catalog.py     piles, decorations, unlocks, shop items, floor spots, XP
tidy/store.py       saves your room to data/state.json
static/             the game: index.html, style.css, app.js (UI), world.js (Three.js voxel world),
                    sound.js (sound effects and music made with the Web Audio API)
scripts/            safety evaluation, agent cost measurement, token report, effort comparison
tests/              offline unit tests
```

No dataset is needed. `data/` (your save and logs) is ignored by git.

---

*Tidy is a productivity tool, not therapy or a crisis service. If you're struggling, call or text 988 (US).*
