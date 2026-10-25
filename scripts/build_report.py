"""Build report.html: one self-contained file with every number pulled from data/ and screenshots embedded.

Usage:  python scripts/build_report.py [screenshots folder] [output file]
"""

import base64
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "screenshots"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT.parent / "report.html"
DATA = ROOT / "data"

costs = json.loads((DATA / "agent_costs.json").read_text(encoding="utf-8"))
safety = json.loads((DATA / "safety_eval.json").read_text(encoding="utf-8"))
effort = json.loads((DATA / "effort_comparison.json").read_text(encoding="utf-8"))
state = json.loads((DATA / "state.json").read_text(encoding="utf-8"))

REPO = "https://github.com/dariashariff-sketch/tidy"


def img(name: str, caption: str, width: str = "100%") -> str:
    path = SHOTS / name
    data = base64.b64encode(path.read_bytes()).decode()
    return (f'<figure><img src="data:image/png;base64,{data}" style="width:{width}" alt="{html.escape(caption)}">'
            f"<figcaption>{caption}</figcaption></figure>")


def money(x: float, digits: int = 4) -> str:
    return f"${x:,.{digits}f}"


pa = costs["per_agent"]
agent_rows = "".join(
    f"<tr><td>{name.title()}</td><td>{a['calls']}</td><td>{a['avg_input']:,}</td><td>{a['avg_cached']:,}</td>"
    f"<td>{a['avg_output']:,}</td><td>{a['avg_seconds']}s</td><td>{money(a['avg_cost_usd'], 5)}</td></tr>"
    for name, a in [("tidier", pa["tidier"]), ("designer", pa["designer"]), ("prioritizer", pa["prioritizer"]),
                    ("coach", pa["coach"])])

safety_rows = "".join(
    f"<tr><td>{html.escape(r['input'][:72] + ('…' if len(r['input']) > 72 else '') or '(empty)')}</td>"
    f"<td>{r['expected']}</td><td>{r['got']}</td><td>{html.escape(r['caught_by'])}</td>"
    f"<td>{'✓' if r['correct'] else '✗'}</td></tr>" for r in safety)
safety_pass = sum(r["correct"] for r in safety)

eff = {e["effort"]: e for e in effort}
hist = state["history"]
answers = [h.get("without_tidy") for h in hist if h.get("without_tidy")]
helped = sum(a in ("yes", "maybe") for a in answers)
prices = costs["prices_per_million"]

AGENT_DIAGRAM = """
<svg viewBox="0 0 760 330" class="diagram" role="img" aria-label="Diagram of Tidy's four agents">
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
    <path d="M0,0 L10,5 L0,10 z" fill="#555"/></marker></defs>
  <style>.b{fill:#f4f4f4;stroke:#222;stroke-width:1.5;rx:10}.ag{fill:#e9f4f4;stroke:#2f7f81;stroke-width:2}
  .t{font:600 13px Inter,Arial,sans-serif;fill:#111}.s{font:11px Inter,Arial,sans-serif;fill:#555}
  .l{stroke:#555;stroke-width:1.5;fill:none;marker-end:url(#a)}</style>
  <rect class="b" x="10" y="20" width="120" height="54" rx="10"/><text class="t" x="70" y="44" text-anchor="middle">Your to-do</text>
  <text class="s" x="70" y="61" text-anchor="middle">"Essay due Tuesday"</text>
  <rect class="b" x="165" y="20" width="120" height="54" rx="10"/><text class="t" x="225" y="44" text-anchor="middle">Rule screen</text>
  <text class="s" x="225" y="61" text-anchor="middle">free, instant</text>
  <rect class="ag" x="320" y="10" width="150" height="74" rx="10"/><text class="t" x="395" y="34" text-anchor="middle">Tidier</text>
  <text class="s" x="395" y="51" text-anchor="middle">safety label · size</text><text class="s" x="395" y="66" text-anchor="middle">deadline · pile type</text>
  <rect class="ag" x="320" y="120" width="150" height="66" rx="10"/><text class="t" x="395" y="144" text-anchor="middle">Designer</text>
  <text class="s" x="395" y="162" text-anchor="middle">builds a voxel object</text><text class="s" x="395" y="176" text-anchor="middle">("essay papers and pencil")</text>
  <rect class="ag" x="320" y="222" width="150" height="66" rx="10"/><text class="t" x="395" y="246" text-anchor="middle">Prioritizer</text>
  <text class="s" x="395" y="263" text-anchor="middle">runs when the list changes</text><text class="s" x="395" y="277" text-anchor="middle">picks where to start</text>
  <rect class="ag" x="560" y="222" width="150" height="66" rx="10"/><text class="t" x="635" y="246" text-anchor="middle">Coach</text>
  <text class="s" x="635" y="263" text-anchor="middle">only on "See tips"</text><text class="s" x="635" y="277" text-anchor="middle">3–4 tips, saved</text>
  <rect class="b" x="560" y="10" width="170" height="74" rx="10"/><text class="t" x="645" y="34" text-anchor="middle">Code checks</text>
  <text class="s" x="645" y="51" text-anchor="middle">catalog items · clamped boxes</text><text class="s" x="645" y="66" text-anchor="middle">real dates · valid ids</text>
  <rect class="b" x="560" y="120" width="170" height="66" rx="10"/><text class="t" x="645" y="146" text-anchor="middle">Your room</text>
  <text class="s" x="645" y="163" text-anchor="middle">object drops in · pet walks</text><text class="s" x="645" y="177" text-anchor="middle">to "Start here"</text>
  <path class="l" d="M130 47 H162"/><path class="l" d="M285 47 H317"/><path class="l" d="M470 47 H557"/>
  <path class="l" d="M395 84 V117"/><path class="l" d="M470 153 H557"/><path class="l" d="M395 186 V219"/>
  <path class="l" d="M470 255 H557"/><path class="l" d="M645 84 V117"/>
  <text class="s" x="20" y="315">Rule screen and code checks are plain code (no tokens). The four teal boxes are gpt-6-luna calls via Portkey.</text>
</svg>"""

body = f"""
<header class="title">
  <div class="kicker">MGT 409 · AI Foundations for Managers · Final project</div>
  <h1>Tidy</h1>
  <p class="sub">A cozy voxel room where the to-do list you're avoiding becomes a room you can tidy up, with four AI agents
  that help you start and a calm, reward-based design built for stressed, procrastinating people.</p>
  <table class="links">
    <tr><td>Author</td><td>Daria Shariff</td></tr>
    <tr><td>Repository</td><td><a href="{REPO}">{REPO}</a></td></tr>
    <tr><td>App</td><td>Runs locally: clone the repo, <code>pip install -r requirements.txt</code>, <code>python app.py</code>,
    open <code>http://127.0.0.1:5050</code> (setup in the README, about 5 minutes)</td></tr>
    <tr><td>One sentence</td><td>Tidy turns an overwhelming to-do list into a little room you tidy one object at a time, so
    starting feels small, finishing feels rewarding, and progress stays visible.</td></tr>
  </table>
</header>

{img("01_room_day.png", "Figure 1. Tidy today: each to-do (left) is an object in the room, built by the Designer agent. The stats problem set is due tonight, so the Prioritizer marked it <b>Start here</b> and the cat walked over to it. Deadlines show as tags; a butter squishy bought in the shop waits in the corner.")}

<h2>1. Motivation</h2>
<p><b>The problem.</b> Procrastination is close to universal among students. Steel's meta-analysis estimates that
80–95% of college students procrastinate, about 75% consider themselves procrastinators, and nearly half do it
consistently and problematically [1]. It is not limited to school: Gallup's 2024 global workplace survey found that roughly
four in ten employees felt a lot of stress during the previous day [2]. This is also a personal problem for me, and I keep
hearing the same thing from classmates and friends as well: everyone is overwhelmed.</p>
<p><b>My own experience.</b> For me, I seem to always find myself stressed out of my mind with a million things on my to-do
list, and no will or motivation to do any of them, leading to an inevitable cycle of procrastination. The longer the list gets,
the worse I feel looking at it, and the worse I feel, the less I do. Keeping a normal to-do list hasn't helped me much: it just
stands as a growing wall of unchecked boxes and a constant reminder of everything I haven't done.</p>
<p><b>How people handle it now, and what it costs.</b> Most people use plain list apps (Todoist, Apple Reminders, Microsoft
To Do) or paper. Research suggests why these often fail for procrastinators: procrastination is less a time-management problem
than an emotion-regulation one. We put tasks off to escape the bad feeling they cause right now [3]. A list does nothing about
that feeling. The costs are real: last-minute work, missed deadlines, lower grades and performance, and the background stress of
unfinished tasks. Psychology research shows unfinished goals keep intruding on our thoughts until we make a concrete plan for
them [4], and people who describe their homes as cluttered show daily stress-hormone patterns linked to chronic stress [5].
A messy to-do list and a messy room weigh on us in similar ways.</p>
<p><b>From a bad feeling to a good one.</b> If procrastination is the avoidance of a bad feeling, then the question becomes:
what if the to-do list gave you a good feeling instead? That is the idea behind Tidy. Instead of a wall of unchecked boxes,
your tasks become a cozy room that you get to tidy up, and every finished task brings a small, visible reward: the clutter
disappears, the room gets cleaner, you earn XP and coins, and your pet celebrates. For the same reason, Tidy has a
<b>Done</b> tab. A normal list only shows what is left, so the more you finish, the less evidence you have of it. The Done tab
keeps everything you have finished in view ("3 things done today. That counts."), because seeing your progress, not just your
remaining work, is one of the strongest everyday motivators (the progress principle) [6].</p>

<h2>2. What is new</h2>
<table>
  <tr><th>Existing option</th><th>What it does</th><th>What it misses for a stressed procrastinator</th></tr>
  <tr><td>Todoist, Reminders, To Do</td><td>Clean lists, due dates</td><td>No help with the feeling of avoidance; finished items vanish, unfinished ones pile up</td></tr>
  <tr><td>Habitica</td><td>Turns tasks into an RPG with health and damage</td><td>Punishes missed tasks; busy and competitive rather than calming</td></tr>
  <tr><td>Finch</td><td>Self-care goals grow a virtual pet</td><td>Built for self-care habits, not your real to-do list</td></tr>
  <tr><td>Forest</td><td>Grows a tree while you focus</td><td>A timer, not a task manager; no help choosing where to start</td></tr>
</table>
<p><b>What Tidy does differently.</b> Tidy makes your to-do list a <i>place</i>. Every task becomes a physical object in a cozy
voxel room that an AI designs just for that task ("do a back flip" becomes a gym mat, "water the plants" a watering can).
Doing the task clears the object, and the room literally gets tidier. Instead of punishing you, Tidy is built to calm you: soft
colors, a sleeping pet, gentle music, no streaks to break. And instead of just storing tasks, its agents actively help with the two
hardest moments of procrastination: <b>deciding where to start</b> (your pet walks to the task you should begin with) and
<b>getting started</b> (task-specific tips on demand).</p>
<p><b>Why it matters.</b> Because procrastination is driven by how a task <i>feels</i>, changing the feeling around the list
(smaller, friendlier, rewarding, visible progress) targets the actual cause rather than adding another reminder.</p>

<h3>How each feature maps to the psychology</h3>
<table>
  <tr><th>Feature</th><th>Psychology behind it</th></tr>
  <tr><td>Writing a task down turns it into a concrete object in the room</td><td>Making a specific plan for an unfinished goal reduces the intrusive thoughts it causes [4]; "putting it somewhere" frees the mind.</td></tr>
  <tr><td>Tidying the room as you finish tasks; XP, coins, unlockable decorations</td><td>Small, visible wins are the strongest everyday motivator at work (the progress principle) [6]. Game rewards make starting feel lighter, though their effect depends on context [7].</td></tr>
  <tr><td><b>Done</b> tab ("3 things done today. That counts.")</td><td>A done list keeps evidence of progress in view instead of only what's left, rebuilding a sense of progress and self-efficacy [6].</td></tr>
  <tr><td>"Start here" from the Prioritizer, usually a quick win</td><td>Decision paralysis feeds avoidance; a small first success builds momentum [6].</td></tr>
  <tr><td>Coach tips: a tiny first move, a way to lighten the task, a kind note about the stress</td><td>Procrastination is mood repair [3]; lowering the emotional cost of starting is the lever.</td></tr>
  <tr><td>Calm generated background music, soft sounds, night mode</td><td>Music interventions reduce both physiological and psychological stress [8].</td></tr>
  <tr><td>A pet that celebrates and asks "Did Tidy help?"</td><td>Companionship and warmth instead of guilt; the question doubles as built-in user-trial data.</td></tr>
  <tr><td>Squishy stress toys bought with coins, with slow-rise motion and a soft foam sound</td><td>A tactile, sensory break for stressful moments. (Evidence for fidget toys is limited; this is a comfort feature, not a treatment claim.)</td></tr>
  <tr><td>Deadlines gather dust on objects as the day approaches</td><td>Makes urgency visible without alarms or nagging.</td></tr>
</table>

<h2>3. The agents</h2>
{AGENT_DIAGRAM}
<table>
  <tr><th>Agent</th><th>Role</th><th>Tools / inputs</th><th>When it runs</th></tr>
  <tr><td><b>Tidier</b></td><td>Safety check (ok / crisis / injection / not a task), picks a ready-made pile type, sizes the task (small/medium/large → 25/50/100 XP), reads deadlines from plain language ("due Tuesday" → 2026-10-27)</td><td>Task text (in <code>&lt;task&gt;</code> tags), today's date, the item catalog</td><td>Every new to-do</td></tr>
  <tr><td><b>Designer</b></td><td>Designs a small voxel object (4–20 boxes with coordinates and colors) that represents the task</td><td>Task text; output rendered by the 3D engine</td><td>Once per to-do</td></tr>
  <tr><td><b>Prioritizer</b></td><td>Chooses which to-do to start with and gives a short warm reason; the pet walks there</td><td>All open to-dos: size, age, due date</td><td>Only when the list changes and has 2+ items</td></tr>
  <tr><td><b>Coach</b></td><td>Writes 3–4 practical, kind tips for the task</td><td>Task text</td><td>Only when the user clicks "See tips"; result saved</td></tr>
</table>
<p><b>How they're organized.</b> It's a hub-and-spoke design around the to-do list rather than a long chain. The Tidier gates
everything: nothing reaches the other agents until it passes the rule screen and the Tidier's safety label. The Designer and
Prioritizer then work independently in the background, and the Coach is purely on demand. Every agent's reply passes through
code checks with a safe fallback, so no single bad answer can break the app.</p>
<p><b>Models and why.</b> All four use <b>gpt-6-luna</b> through Portkey, the model the course key allows, with
<code>reasoning_effort="low"</code>. I measured the tradeoff on the Tidier: on 8 tasks with an obvious right answer, low and
medium effort both picked the expected item 100% of the time, but medium cost about
{(eff['medium']['avg_cost_usd'] / eff['low']['avg_cost_usd'] - 1) * 100:.0f}% more per call
({money(eff['medium']['avg_cost_usd'], 5)} vs {money(eff['low']['avg_cost_usd'], 5)}). So low effort gives the same quality for less.</p>
<p><b>How the design evolved.</b> Tidy started as a four-agent pipeline (Gatekeeper → Breaker → Critic → Decorator) that broke every
task into 3–6 small steps, a CBT technique. In my own testing it felt like too much, and one task spawned six piles of junk. I
simplified to one task = one object, then added help back where it was wanted: the Prioritizer for "where do I start?" and the
Coach for "how do I start?" That made each to-do about 6× faster (8.5 s → 1.4 s) and, before the Designer was added, about 5× cheaper (0.66¢ → 0.12¢).</p>

<h3>One traced real run</h3>
<p>From a real session with the live agents:</p>
<ol>
  <li><b>Input:</b> "Essay due Tuesday". The rule screen passes it (no crisis words, no injection patterns, under 300 characters).</li>
  <li><b>Tidier</b> → <code>{{"label": "ok", "mess": "crumpled_papers", "size": 3, "due": "2026-10-27"}}</code>. Code checks
  confirm the catalog item and a real date within a year. The list shows <i>Due Tue · large task · +100 XP</i>.</li>
  <li><b>Designer</b> → object "essay papers and pencil" (a stack of paper boxes and a pencil). Code checks clamp every box inside
  the item's space; the object drops into the emptiest floor spot.</li>
  <li><b>Prioritizer</b> (list: essay, laundry, call mom, stats problem set due tonight, water plants) → picks the stats problem set:
  <i>"Due tonight, so let's get it submitted."</i> The cat walks over and a glow appears under it (Figure 1).</li>
  <li><b>Coach</b> (user clicks "See tips" on the essay) → four tips, starting with <i>"Open a blank document and write a rough
  title or one messy sentence. That's enough to begin."</i> (Figure 2).</li>
</ol>
<div class="two">
{img("02_tips.png", "Figure 2. The Coach's tips for the essay, opened from the list.")}
{img("yours_3_cookies_night.png", "Figure 3. Night mode during my own use: a deadline-tagged task marked Start here, decorations I unlocked, and a bao squishy.")}
</div>
<div class="two">
{img("yours_1_tips_unpacking.png", "Figure 4. An earlier build: Coach tips for “Unpacking a box” (the size picker shown here was later removed so the AI decides).")}
{img("yours_2_ai_homework.png", "Figure 5. An earlier build: tips for “Do my AI homework”, with the single-book object on the floor.")}
</div>

<h2>4. Tokenomics</h2>
<p>Every model call is logged with input, cached-input, output and reasoning tokens, latency and cost
(<code>data/usage_log.jsonl</code>). The table below comes from <code>scripts/measure_agents.py</code>, which runs all four agents
on the same 8 realistic tasks (laundry, an essay, groceries, a midterm, and so on).</p>
<table>
  <tr><th>Agent</th><th>Calls</th><th>Avg input tokens</th><th>Avg cached</th><th>Avg output</th><th>Avg time</th><th>Avg cost</th></tr>
  {agent_rows}
</table>
<p class="note">Prices assumed: {money(prices['input'], 2)} per million input tokens, {money(prices['cached_input'], 3)} cached,
{money(prices['output'], 2)} output (set in <code>tidy/config.py</code>). Replace with the actual gpt-6-luna rate from the Portkey
dashboard; token counts are measured, dollar figures scale linearly with the price.</p>
<table>
  <tr><th>Measure</th><th>Value</th></tr>
  <tr><td>Cost per to-do (Tidier + Designer + Prioritizer, plus the Coach on {costs['assumptions']['coach_share']:.0%} of tasks)</td><td>{money(costs['cost_per_task_usd'], 4)}</td></tr>
  <tr><td>Cost per user per month ({costs['assumptions']['tasks_per_user_per_month']} to-dos)</td><td>{money(costs['cost_per_user_per_month_usd'], 3)}</td></tr>
  <tr><td>100 users / month</td><td>{money(costs['cost_100_users_usd'], 2)}</td></tr>
  <tr><td>10,000 users / month</td><td>{money(costs['cost_10000_users_usd'], 2)}</td></tr>
  <tr><td>Organization-wide: a 700-student program</td><td>{money(costs['cost_per_user_per_month_usd'] * 700, 2)} / month</td></tr>
</table>
<p><b>Where the cost goes.</b> The Designer is about 60% of each to-do's cost because it writes a whole 3D object (~400 output tokens).
That is a deliberate tradeoff: custom objects were the single biggest improvement to how personal and motivating the room feels.</p>
<p><b>Cost-reduction steps I took (all measured):</b></p>
<ul>
  <li><b>Fixed a double call.</b> The original pipeline accidentally called the step-breaking agent twice per task; fixing it cut cost
  per task from about 1.2¢ to 0.66¢.</li>
  <li><b>Collapsed four agents into one Tidier call.</b> Cost per task fell from 0.66¢ to about 0.12¢ (~430 input / ~70 output tokens),
  and time from about 8.5 s to about 1.4 s.</li>
  <li><b>Run agents only when needed.</b> The Prioritizer runs only when the set of to-dos changes; the Coach only when tips are
  requested, and its tips are saved so asking again is free.</li>
  <li><b>A free rule screen before any tokens.</b> Obvious crisis messages, injections, empty or overlong inputs are stopped by
  code at zero cost; a full room is rejected before calling the model.</li>
  <li><b>Low reasoning effort</b> (same accuracy, ~10% cheaper than medium) and short output caps per agent.</li>
  <li><b>Dropped the SDK.</b> Importing the Portkey SDK took 16.5 s on Windows, so the first task after startup took ~20 s. Calling
  the HTTP API directly made the first task take about 2 s, and cut the install to two small packages.</li>
</ul>
<p><b>Next optimization.</b> Cached input is 0 because each agent's prompt is under the ~1,024-token minimum the provider caches.
Sharing one long system preamble across agents would make it cacheable at a 90% discount on those tokens.</p>

<h2>5. Safety</h2>
<table>
  <tr><th>Risk</th><th>Defense built</th></tr>
  <tr><td>A user in crisis types something alarming</td><td>Keyword rules plus the Tidier's own crisis label. Tidy stops, adds nothing, and shows the 988 Suicide &amp; Crisis Lifeline, Crisis Text Line, Yale Mental Health &amp; Counseling and 911 (Figure 6).</td></tr>
  <tr><td>Prompt injection hidden in a task</td><td>Rule screen; task text wrapped in <code>&lt;task&gt;</code> tags and treated as data in every prompt; the Tidier's injection label; Azure's provider-side content filter (it blocked one jailbreak on its own in testing); strict code checks on every output (catalog items only, clamped numbers, valid ids, length caps) (Figure 7).</td></tr>
  <tr><td>Agent errors or loops</td><td>One call per agent job (no loops); every reply checked in code with a safe fallback (ready-made pile, default tips, smallest task first).</td></tr>
  <tr><td>Runaway spending</td><td>Max 30 to-dos; full-room check before any tokens; 20 calls/minute; 300,000-token daily budget; per-reply token caps; 300-character inputs; Prioritizer and Coach only when needed.</td></tr>
  <tr><td>Data leaks</td><td>Everything is stored locally in <code>data/</code>; no accounts or analytics; the API key stays on the server (never sent to the browser) and <code>.env</code> is git-ignored.</td></tr>
</table>
<p><b>Defenses shown working.</b> <code>scripts/safety_eval.py</code> runs 11 risky and normal inputs through the real pipeline:
<b>{safety_pass} of {len(safety)}</b> were handled as expected. The indirect crisis message, with no obvious keyword, was caught by
the Tidier, and the normal tasks all passed.</p>
<table class="small">
  <tr><th>Input</th><th>Expected</th><th>Got</th><th>Caught by</th><th></th></tr>
  {safety_rows}
</table>
<div class="two">
{img("06_crisis.png", "Figure 6. Crisis defense: the indirect message is caught and Tidy shows real support resources instead of adding a task.")}
{img("07_injection_blocked.png", "Figure 7. Prompt-injection defense: a task carrying hidden instructions to the AI is blocked with a plain explanation.")}
</div>

<h2>6. Impact</h2>
<p><b>Built-in measurement.</b> After every finished task the pet asks "Did Tidy help with the task?" (Yes / A bit / No), and the
stats panel tracks tasks finished vs removed, time from adding to done, and days used, exportable as CSV (Figure 8).</p>
<p><b>Pilot results (my own use while building, one user).</b> {len(hist)} real tasks completed and {state.get('removed', 0)} removed
({100 if hist else 0}% finished rather than abandoned). Of the {len(answers)} times I answered the pet's question,
{helped} said Tidy helped ({round(100 * helped / len(answers)) if answers else 0}%). I also bought {len(state.get('toys', []))}
squishies and squished them {state.get('squishes', 0)} times during stressful moments.</p>
<div class="trial"><b>Classmate trial (to complete):</b> 3–5 classmates use Tidy for real tasks for a day. Report tasks finished vs
removed, average time from adding to done, and the share answering Yes/A bit, from each person's CSV. Placeholder:
<i>[n] participants · [x] tasks finished · [y]% finished vs removed · [z]% said Tidy helped.</i></div>
<p><b>What it's worth.</b> Even modest gains matter at scale. If Tidy helps a student finish two more avoided tasks a week, across a
700-student program that's about 1,400 tasks a week, for roughly {money(costs['cost_per_user_per_month_usd'] * 700, 0)} a month in
AI costs. Reach is easy too: it runs in any browser, and costs about {money(costs['cost_per_user_per_month_usd'], 2)} per user per month.</p>
<div class="two">
{img("04_stats_tokens.png", "Figure 8. Stats & tokens: progress, the user-trial answers, and the agents' decisions and token costs for the last run.")}
{img("03_done_tab.png", "Figure 9. The Done tab keeps finished tasks visible: “3 things done today.”")}
</div>

<h2>7. Limits and next steps</h2>
<ul>
  <li><b>Evidence is early.</b> The pilot is one user (me). The classmate trial and a longer study (do people procrastinate less over
  weeks?) are the next step.</li>
  <li><b>Prices are assumed</b> until confirmed in Portkey; token counts are measured.</li>
  <li><b>Local and single-user.</b> No accounts or sync across devices; the layout is designed for laptops, not phones.</li>
  <li><b>AI objects vary.</b> The Designer occasionally builds an odd object; the ready-made pile is the fallback.</li>
  <li><b>Not therapy.</b> Crisis detection is a safety net, not a guarantee, and Tidy says so. Fidget-toy benefits are not well established.</li>
  <li><b>Next:</b> prompt caching across agents, a mobile layout, calendar integration for deadlines, gentle reminders at chosen times,
  and a multi-week trial measuring stress before and after.</li>
</ul>
{img("05_room_night.png", "Figure 10. Night mode: blinds down, lamp on, stars and a moon, calm music optional.", "88%")}

<h2>References</h2>
<ol class="refs">
  <li>Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure. <i>Psychological Bulletin, 133</i>(1), 65–94.</li>
  <li>Gallup (2024). <i>State of the Global Workplace: 2024 Report.</i></li>
  <li>Sirois, F., &amp; Pychyl, T. (2013). Procrastination and the priority of short-term mood regulation. <i>Social and Personality Psychology Compass, 7</i>(2), 115–127.</li>
  <li>Masicampo, E. J., &amp; Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. <i>Journal of Personality and Social Psychology, 101</i>(4), 667–683.</li>
  <li>Saxbe, D. E., &amp; Repetti, R. (2010). No place like home: Home tours correlate with daily patterns of mood and cortisol. <i>Personality and Social Psychology Bulletin, 36</i>(1), 71–81.</li>
  <li>Amabile, T. M., &amp; Kramer, S. J. (2011). The power of small wins. <i>Harvard Business Review, 89</i>(5); and <i>The Progress Principle</i>. Harvard Business Review Press.</li>
  <li>Hamari, J., Koivisto, J., &amp; Sarsa, H. (2014). Does gamification work? A literature review of empirical studies on gamification. <i>Proceedings of the 47th Hawaii International Conference on System Sciences.</i></li>
  <li>de Witte, M., Spruit, A., van Hooren, S., Moonen, X., &amp; Stams, G.-J. (2020). Effects of music interventions on stress-related outcomes: A systematic review and two meta-analyses. <i>Health Psychology Review, 14</i>(2), 294–324.</li>
</ol>
<p class="small muted">AI tools were used to help build the app and draft this report; I reviewed every statement and number.</p>
"""

CSS = """
@page { size: letter; margin: 0.7in; }
body { font-family: Inter, -apple-system, Segoe UI, Arial, sans-serif; color: #141414; line-height: 1.55; font-size: 11pt;
  max-width: 820px; margin: 0 auto; padding: 32px 20px 60px; }
h1 { font-size: 40pt; margin: 4px 0; letter-spacing: -1px; }
h2 { font-size: 17pt; margin: 28px 0 8px; padding-top: 10px; border-top: 2px solid #141414; break-after: avoid; }
h3 { font-size: 12.5pt; margin: 18px 0 6px; break-after: avoid; }
.kicker { font-size: 10pt; text-transform: uppercase; letter-spacing: 1.2px; color: #666; }
.sub { font-size: 13pt; color: #333; margin-top: 4px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 9.6pt; break-inside: avoid; }
th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #ddd; }
th { background: #f2f2f2; font-weight: 600; }
table.links td:first-child { width: 120px; color: #666; }
table.small { font-size: 8.8pt; }
figure { margin: 12px 0; break-inside: avoid; text-align: center; }
figure img { border-radius: 8px; border: 1px solid #ddd; }
figcaption { font-size: 9pt; color: #555; margin-top: 4px; text-align: left; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; break-inside: avoid; }
.diagram { width: 100%; height: auto; margin: 8px 0; }
.note { font-size: 9.2pt; color: #555; background: #f7f7f7; border-left: 3px solid #999; padding: 6px 10px; }
.trial { background: #fff8e1; border: 1px solid #f0d38a; border-radius: 8px; padding: 10px 12px; font-size: 10pt; }
code { background: #f2f2f2; padding: 1px 4px; border-radius: 4px; font-size: 9.5pt; }
.refs { font-size: 9.4pt; }
.small { font-size: 9pt; } .muted { color: #666; }
a { color: #1f5fa8; }
"""

OUT.write_text(f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tidy: Final Project Report</title><style>{CSS}</style></head><body>{body}</body></html>""", encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
