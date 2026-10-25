"""Build slides.html: a 10-slide reveal.js deck with every screenshot embedded and numbers from data/.

Usage:  python scripts/build_slides.py [screenshots folder] [output file]
Keys:   arrow keys to move, F for full screen.
"""

import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "screenshots"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT.parent / "slides.html"
DATA = ROOT / "data"

costs = json.loads((DATA / "agent_costs.json").read_text(encoding="utf-8"))
safety = json.loads((DATA / "safety_eval.json").read_text(encoding="utf-8"))
state = json.loads((DATA / "state.json").read_text(encoding="utf-8"))
pa = costs["per_agent"]
hist = state["history"]
answers = [h.get("without_tidy") for h in hist if h.get("without_tidy")]
helped = sum(a in ("yes", "maybe") for a in answers)


def src(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((SHOTS / name).read_bytes()).decode()


def cents(x: float) -> str:
    return f"{x * 100:.2f}¢"


slides = f"""
<section class="title-slide">
  <div class="kicker">MGT 409 · Final project · Daria Shariff</div>
  <h1>Tidy</h1>
  <p class="lead">A cozy voxel room where the tasks you're avoiding become objects you can clear.</p>
  <img class="hero" src="{src('01_room_day.png')}">
  <p class="small">github.com/dariashariff-sketch/tidy</p>
</section>

<section>
  <h2>The problem</h2>
  <div class="cols">
    <div>
      <p class="quote">"I found myself stressed out of my mind with a million things on my to-do list, and no will or
      motivation to do any of them, leading to an inevitable cycle of procrastination."</p>
      <ul>
        <li><b>80–95%</b> of college students procrastinate <span class="cite">(Steel, 2007)</span></li>
        <li>About <b>4 in 10</b> workers felt a lot of stress yesterday <span class="cite">(Gallup, 2024)</span></li>
        <li>Procrastination is <b>avoiding a bad feeling</b>, not bad time management <span class="cite">(Sirois &amp; Pychyl, 2013)</span></li>
      </ul>
    </div>
    <div class="right">
      <div class="callout">A normal to-do list is a growing wall of unchecked boxes. It reminds you of what you haven't done, and that feeling is exactly what drives the avoidance.</div>
      <p class="sowhat"><span>←</span> So what if we give it a good feeling?</p>
    </div>
  </div>
</section>

<section>
  <h2>What's new</h2>
  <table>
    <tr><th></th><th>Lists<br><span>Todoist, Reminders</span></th><th>Habitica</th><th>Finch</th><th>Tidy</th></tr>
    <tr><td>Your real tasks</td><td>✓</td><td>✓</td><td>–</td><td>✓</td></tr>
    <tr><td>Calm, no punishment</td><td>–</td><td>✗ damage</td><td>✓</td><td>✓</td></tr>
    <tr><td>AI builds an object for each task</td><td>–</td><td>–</td><td>–</td><td>✓</td></tr>
    <tr><td>AI picks where to start</td><td>–</td><td>–</td><td>–</td><td>✓</td></tr>
    <tr><td>Progress you can see (room + Done list)</td><td>–</td><td>~</td><td>~</td><td>✓</td></tr>
  </table>
  <p class="lead small">Tidy makes the list a <b>place</b>: finishing a task literally tidies your room.</p>
</section>

<section>
  <h2>Built on the psychology of stress</h2>
  <div class="grid4">
    <div><b>Write it down</b><span>A concrete plan quiets unfinished-goal thoughts (Masicampo &amp; Baumeister, 2011)</span></div>
    <div><b>Small, visible wins</b><span>Tidying the room, XP and the Done list: the progress principle (Amabile &amp; Kramer, 2011)</span></div>
    <div><b>Start here</b><span>Your pet walks to a quick win, so you don't have to decide</span></div>
    <div><b>Kind tips</b><span>A tiny first move and a note about the stress, because procrastination is mood repair</span></div>
    <div><b>Calm by design</b><span>Soft music (music lowers stress: de Witte et al., 2020), night mode, a sleeping pet</span></div>
    <div><b>Stress toys</b><span>Coins buy squishies you can squish, with a slow rise and a soft foam sound</span></div>
    <div><b>Gentle urgency</b><span>Deadlines gather dust instead of setting off alarms</span></div>
    <div><b>Celebrate</b><span>Your pet gets the zoomies when you finish</span></div>
  </div>
</section>

<section>
  <h2>Four agents</h2>
  <div class="flow">
    <div class="node plain">Your to-do<span>"Essay due Tuesday"</span></div><div class="arrow">→</div>
    <div class="node plain">Rule screen<span>free, instant</span></div><div class="arrow">→</div>
    <div class="node">Tidier<span>safety · size · deadline</span></div>
  </div>
  <div class="agents">
    <div class="node">Designer<span>builds a voxel object<br>"essay papers and pencil"</span></div>
    <div class="node">Prioritizer<span>when the list changes<br>"Due tonight, let's get it submitted"</span></div>
    <div class="node">Coach<span>only on "See tips"<br>3–4 kind, practical tips</span></div>
  </div>
  <p class="small">All gpt-6-luna via Portkey, low reasoning effort (same accuracy as medium, ~10% cheaper). Every reply passes code checks with a safe fallback.</p>
</section>

<section>
  <h2>Demo</h2>
  <div class="cols">
    <figure><img src="{src('02_tips.png')}"><figcaption>Coach tips and a deadline-tagged list</figcaption></figure>
    <figure><img src="{src('yours_3_cookies_night.png')}"><figcaption>Night mode, Start here, a bao squishy</figcaption></figure>
  </div>
</section>

<section>
  <h2>What it costs</h2>
  <div class="cols">
    <table>
      <tr><th>Agent</th><th>In / out tokens</th><th>Cost</th></tr>
      <tr><td>Tidier</td><td>{pa['tidier']['avg_input']} / {pa['tidier']['avg_output']}</td><td>{cents(pa['tidier']['avg_cost_usd'])}</td></tr>
      <tr><td>Designer</td><td>{pa['designer']['avg_input']} / {pa['designer']['avg_output']}</td><td>{cents(pa['designer']['avg_cost_usd'])}</td></tr>
      <tr><td>Prioritizer</td><td>{pa['prioritizer']['avg_input']} / {pa['prioritizer']['avg_output']}</td><td>{cents(pa['prioritizer']['avg_cost_usd'])}</td></tr>
      <tr><td>Coach (30% of tasks)</td><td>{pa['coach']['avg_input']} / {pa['coach']['avg_output']}</td><td>{cents(pa['coach']['avg_cost_usd'])}</td></tr>
    </table>
    <div class="stats">
      <div><b>{cents(costs['cost_per_task_usd'])}</b><span>per to-do</span></div>
      <div><b>${costs['cost_per_user_per_month_usd']:.2f}</b><span>per user / month</span></div>
      <div><b>${costs['cost_100_users_usd']:,.0f}</b><span>100 users / month</span></div>
      <div><b>${costs['cost_10000_users_usd']:,.0f}</b><span>10,000 users / month</span></div>
    </div>
  </div>
  <p class="small">Cuts: fixed a double call (1.2¢ → 0.66¢) · four agents → one Tidier call (0.66¢ → 0.12¢, 8.5 s → 1.4 s) · Coach and Prioritizer only when needed · dropped the SDK (first task 20 s → 2 s). Prices assumed: $1.25 / $10 per M tokens.</p>
</section>

<section>
  <h2>Safety</h2>
  <div class="cols">
    <div>
      <ul>
        <li><b>Crisis:</b> rules + the Tidier's check → 988, Crisis Text Line, Yale counseling</li>
        <li><b>Prompt injection:</b> rule screen, tagged input, Tidier label, Azure filter, code checks</li>
        <li><b>Errors and loops:</b> one call per job, safe fallbacks</li>
        <li><b>Spending:</b> 30-task cap, rate limit, daily token budget</li>
        <li><b>Data:</b> stays on your computer, key never reaches the browser</li>
      </ul>
      <p class="big">{sum(r['correct'] for r in safety)} / {len(safety)} test inputs handled correctly</p>
    </div>
    <figure><img src="{src('06_crisis.png')}"><figcaption>An indirect crisis message, caught</figcaption></figure>
  </div>
</section>

<section>
  <h2>Impact</h2>
  <div class="cols">
    <div>
      <div class="stats">
        <div><b>{len(hist)}</b><span>tasks finished in my pilot</span></div>
        <div><b>{state.get('removed', 0)}</b><span>tasks abandoned</span></div>
        <div><b>{round(100 * helped / len(answers)) if answers else 0}%</b><span>"Did Tidy help?" yes or a bit</span></div>
        <div><b>${costs['cost_per_user_per_month_usd'] * 700:,.0f}</b><span>/ month for a 700-student program</span></div>
      </div>
      <p class="small">From my own trial of Tidy (1 user), read from data/state.json when the deck is built.</p>
    </div>
    <figure><img src="{src('03_done_tab.png')}"><figcaption>The Done tab keeps progress visible</figcaption></figure>
  </div>
</section>

<section>
  <h2>Next steps</h2>
  <ul class="next">
    <li>A multi-week trial: does stress go down and do people finish more?</li>
    <li>Prompt caching across agents (90% off repeated prompt tokens)</li>
    <li>Mobile layout and calendar sync for deadlines</li>
    <li>Gentle, opt-in reminders at times you choose</li>
  </ul>
  <p class="lead">Tidy: make starting feel small, finishing feel good, and progress impossible to miss.</p>
</section>
"""

CSS = """
.reveal { font-family: Inter, -apple-system, Segoe UI, Arial, sans-serif; color: #141414; }
.reveal .slides { text-align: left; }
.reveal h1, .reveal h2 { font-family: Inter, Arial, sans-serif; text-transform: none; letter-spacing: -0.5px; color: #141414; font-weight: 800; }
.reveal h1 { font-size: 2.6em; margin: 0.1em 0; }
.reveal h2 { font-size: 1.5em; margin-bottom: 0.5em; }
.reveal p, .reveal li { font-size: 0.62em; line-height: 1.45; }
.reveal ul { margin-left: 1em; }
.reveal .kicker { font-size: 0.42em; text-transform: uppercase; letter-spacing: 2px; color: #777; }
.reveal .lead { font-size: 0.75em; color: #333; }
.reveal .small { font-size: 0.42em; color: #666; }
.reveal .cite { color: #888; font-size: 0.85em; }
.reveal .title-slide { text-align: center; }
.reveal .hero { max-height: 52vh; width: auto; max-width: 70%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); margin: 0.3em auto; }
.reveal .quote { font-size: 0.68em; font-style: italic; border-left: 4px solid #141414; padding-left: 0.6em; }
.reveal .callout { background: #f4f4f4; border-radius: 14px; padding: 0.8em 1em; font-size: 0.6em; align-self: center; }
.reveal .right { display: flex; flex-direction: column; justify-content: space-between; align-self: stretch; }
.reveal .sowhat { font-size: 0.85em; font-weight: 800; margin: 0 0 0.35em; }
.reveal .sowhat span { margin-right: 0.3em; }
.reveal .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; align-items: start; }
.reveal figure { margin: 0; }
.reveal figure img { width: 100%; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.12); margin: 0; }
.reveal figcaption { font-size: 0.4em; color: #666; margin-top: 0.3em; }
.reveal table { font-size: 0.5em; border-collapse: collapse; width: 100%; }
.reveal th, .reveal td { border-bottom: 1px solid #ddd; padding: 0.35em 0.5em; text-align: left; }
.reveal th span { font-weight: 400; color: #777; font-size: 0.85em; }
.reveal .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5em; }
.reveal .grid4 div { background: #f4f4f4; border-radius: 12px; padding: 0.55em; font-size: 0.48em; }
.reveal .grid4 b { display: block; font-size: 1.15em; margin-bottom: 0.2em; }
.reveal .grid4 span { color: #444; }
.reveal .flow { display: flex; align-items: center; gap: 0.4em; justify-content: center; }
.reveal .arrow { font-size: 0.9em; color: #777; }
.reveal .node { background: #e9f4f4; border: 2px solid #2f7f81; border-radius: 14px; padding: 0.5em 0.8em; font-size: 0.6em; font-weight: 700; text-align: center; }
.reveal .node span { display: block; font-weight: 400; font-size: 0.78em; color: #444; margin-top: 0.2em; }
.reveal .node.plain { background: #f4f4f4; border-color: #141414; }
.reveal .agents { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6em; margin: 0.8em 0 0.5em; }
.reveal .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em; }
.reveal .stats div { background: #f4f4f4; border-radius: 12px; padding: 0.5em 0.6em; }
.reveal .stats b { display: block; font-size: 0.95em; line-height: 1.2; }
.reveal .stats span { display: block; font-size: 0.42em; line-height: 1.3; color: #555; }
.reveal .big { font-size: 0.8em; font-weight: 800; }
.reveal .next li { font-size: 0.7em; margin-bottom: 0.4em; }
"""

OUT.write_text(f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tidy: slides</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/white.css">
<style>{CSS}</style></head>
<body><div class="reveal"><div class="slides">{slides}</div></div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
<script>Reveal.initialize({{ hash: true, slideNumber: "c/t", width: 1280, height: 720, margin: 0.06, transition: "fade" }});</script>
</body></html>""", encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
