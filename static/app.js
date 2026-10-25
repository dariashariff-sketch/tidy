// Tidy UI: to-do list, HUD, modals, and wiring to the voxel world.
import { createWorld } from "./world.js";
import * as sound from "./sound.js";

const $ = (id) => document.getElementById(id);
let state = null;
let catalog = null;
let busy = false;

const THINKING = [
  "The Tidier is reading your to-do...",
  "Deciding what kind of mess this is...",
  "Naming your new pile...",
];

const SIZE_LABEL = { 1: "small", 2: "medium", 3: "large" };


const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: "The server sent back something unexpected." }));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { data });
  return data;
}

const world = createWorld($("world"), {
  onMessClick: (info) => { highlightQuest(info.questId, true); openTips(info.questId); },
  onMessHover: showTooltip,
  onShopClick: () => { completeHint("shop"); sound.puff(); world.openDrawer(openShop); },
  onDecorMoved: async (name, x, z, y, rot) => {
    try { state = await api(`/api/decor/${name}/move`, { method: "POST", body: { x, z, y, rot } }); } catch (err) { toast(err.message, true); }
  },
  leftInset: () => (window.innerWidth >= 900 ? 392 : 0),
});

/* ---------------- rendering ---------------- */

// Days until a due date (negative = overdue), using the player's local calendar.
function daysUntil(due) {
  if (!due) return null;
  const [y, m, d] = due.split("-").map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

function dueLabel(due) {
  const days = daysUntil(due);
  if (days === null) return "";
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  const [y, m, d] = due.split("-").map(Number);
  const when = new Date(y, m - 1, d);
  return days < 7 ? `Due ${when.toLocaleDateString(undefined, { weekday: "short" })}`
                  : `Due ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// More dust the closer the deadline.
function dustLevel(due) {
  const days = daysUntil(due);
  if (days === null || days > 5) return 0;
  if (days <= 0) return 1;
  return days === 1 ? 0.7 : days === 2 ? 0.5 : 0.25;
}

// One pile per to-do. Its size comes from how big the Tidier thinks the task is.
function messItems() {
  const focus = currentFocus();
  const crowd = Math.max(0.7, Math.min(1, 1.1 - state.quests.length * 0.016));   // many piles -> smaller piles
  // A pile only appears once the Designer has built its object (or decided to use a ready-made one),
  // so nothing half-finished ever shows up on the floor.
  return state.quests.filter((q) => "model" in q).map((q) => ({
    crowd,
    key: q.id, questId: q.id, slot: q.slot, mess: q.mess, size: q.size, label: q.task, dust: dustLevel(q.due),
    model: q.model || null,
    text: [focus && focus.id === q.id ? `Start here: ${focus.reason}` : `${SIZE_LABEL[q.size]} task · click for tips`,
           dueLabel(q.due)].filter(Boolean).join(" · "),
  }));
}

/* ---------------- the Designer's objects ---------------- */

const designing = new Set();

// Every pile without a designed object yet asks the Designer once; the room swaps it in when ready.
function requestDesigns() {
  for (const q of state.quests) {
    if ("model" in q || designing.has(q.id)) continue;
    designing.add(q.id);
    api(`/api/quests/${q.id}/design`, { method: "POST" })
      .then((res) => {
        const fresh = res.quests.find((x) => x.id === q.id);
        const mine = state.quests.find((x) => x.id === q.id);
        if (fresh && mine) mine.model = fresh.model;
        world.syncMesses(messItems(), catalog.slots, true);
        renderQuests();
      })
      .catch(() => {})
      .finally(() => designing.delete(q.id));
  }
}

/* ---------------- the Prioritizer's pick ---------------- */

const focusKeyOf = () => state.quests.map((q) => q.id).sort().join(",");
const currentFocus = () => (state.focus && state.focus.key === focusKeyOf() ? state.focus : null);
let focusRequest = null;

// Ask the Prioritizer again only when the set of piles has changed.
async function refreshFocus() {
  const key = focusKeyOf();
  if (currentFocus() || focusRequest === key) { world.setFocus(currentFocus() ? currentFocus().id : null); return; }
  focusRequest = key;
  try {
    const res = await api("/api/focus", { method: "POST" });
    state = { ...state, focus: res.focus };
  } catch { /* the room works fine without a pick */ }
  focusRequest = null;
  const f = currentFocus();
  world.setFocus(f ? f.id : null);
  renderQuests();
  world.syncMesses(messItems(), catalog.slots, false);
}

function renderHud() {
  $("level").textContent = state.level;
  $("xp-fill").style.width = `${(100 * state.into_level) / state.level_size}%`;
  $("xp-text").textContent = state.next_unlock
    ? `${state.xp} XP · Next: ${state.next_unlock.label} at ${state.next_unlock.xp}`
    : `${state.xp} XP · Room complete!`;
  $("tidy-fill").style.width = `${state.tidiness}%`;
  $("tidy-text").textContent = `${state.tidiness}%`;
  $("coins").textContent = state.coins;
  $("demo-banner").hidden = state.provider !== "demo";
}

const openTipIds = new Set();
const loadingTips = new Set();

function renderQuests() {
  const box = $("quests");
  $("empty-hint").hidden = state.quests.length > 0;
  const many = state.quests.length > 1;
  box.innerHTML = state.quests.map((q, n) => {
    const tips = openTipIds.has(q.id) && q.tips
      ? `<ul class="tips">${q.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
      : loadingTips.has(q.id) ? `<div class="tips-loading">The Coach is thinking of tips...</div>` : "";
    return `
      <div class="quest" id="quest-${q.id}" data-id="${q.id}" draggable="${many}">
        <div class="quest-head">
          ${many ? `<span class="grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span>` : ""}
          <div class="quest-name"><span class="quest-num">${n + 1}.</span> ${escapeHtml(q.task)}${currentFocus() && currentFocus().id === q.id
            ? ` <span class="start-here" title="${escapeHtml(currentFocus().reason)}">Start here</span>` : ""}</div>
          <button class="drop" data-drop="${q.id}" title="Remove this pile">&times;</button>
        </div>
        <div class="quest-task">${q.due ? `<span class="due ${daysUntil(q.due) <= 0 ? "urgent" : ""}">${dueLabel(q.due)}</span> ` : ""}${SIZE_LABEL[q.size]} task · +${catalog.xp_by_size[q.size]} XP${q.model && q.model.object ? ` · ${escapeHtml(q.model.object.toLowerCase())}` : !("model" in q) ? " · designing its item…" : ""}</div>
        <div class="quest-actions">
          <button class="btn done-btn" data-done="${q.id}">Done</button>
          <button class="btn tips-btn" data-tips="${q.id}">${openTipIds.has(q.id) ? "Hide tips" : "See tips"}</button>
        </div>
        ${tips}
      </div>`;
  }).join("");
}

async function openTips(questId) {
  const q = state.quests.find((x) => x.id === questId);
  if (!q) return;
  openTipIds.add(questId);
  if (!q.tips) {
    loadingTips.add(questId);
    renderQuests();
    try {
      const res = await api(`/api/quests/${questId}/tips`, { method: "POST" });
      const fresh = state.quests.find((x) => x.id === questId);
      if (fresh) fresh.tips = res.tips;
    } catch (err) {
      openTipIds.delete(questId);
      toast(err.message, true);
    }
    loadingTips.delete(questId);
  }
  renderQuests();
}

function render({ animate = true } = {}) {
  renderHud();
  renderQuests();
  world.syncMesses(messItems(), catalog.slots, animate);
  world.syncDecor(state.placed, animate);
  world.setPet(state.pet);
  setTimeout(refreshFocus, 700);                          // after new piles have landed
  setTimeout(requestDesigns, 600);
  if (!$("stats").hidden) renderStats();
  if (!$("storage").hidden) renderStorage();
  if (!$("shop").hidden) renderShop();
  renderSquishy();
}

function renderStats() {
  const s = state.stats;
  const run = state.last_run;
  const fmt = (n) => (n ?? 0).toLocaleString();
  const money = (n) => `$${(n ?? 0).toFixed(5)}`;
  let html = `
    <h3>Your progress</h3>
    <div class="stat-grid">
      <div class="stat"><b>${s.tasks_done}</b><span>tasks done</span></div>
      <div class="stat"><b>${s.removed}</b><span>tasks removed</span></div>
      <div class="stat"><b>${s.completion_rate ?? "–"}${s.completion_rate == null ? "" : "%"}</b><span>finished, not removed</span></div>
      <div class="stat"><b>${s.avg_finish ?? "–"}</b><span>avg time from adding to done</span></div>
      <div class="stat"><b>${s.active_days}</b><span>days you used Tidy</span></div>
      <div class="stat"><b>${state.decor.length}/${state.decor_total}</b><span>decorations</span></div>
    </div>
    <h3>Did Tidy help with the task?</h3>
    <div class="stat-grid">
      <div class="stat"><b>${s.answers.yes}</b><span>yes</span></div>
      <div class="stat"><b>${s.answers.maybe}</b><span>a bit</span></div>
      <div class="stat"><b>${s.answers.no}</b><span>no</span></div>
      <div class="stat stat-wide"><b>${s.helped ?? "–"}${s.helped == null ? "" : "%"}</b><span>of answers said Tidy helped (yes or a bit)</span></div>
      <div class="stat"><b>${state.provider}</b><span>model provider</span></div>
    </div>`;
  if (run) {
    html += `
      <h3>Last run: “${escapeHtml(run.name)}”</h3>
      <ul class="trace">${run.trace.map((t) => `<li><b>${escapeHtml(t.agent)}</b>: ${escapeHtml(t.result)}
        ${t.reason ? ` (${escapeHtml(t.reason)})` : ""}</li>`).join("")}</ul>`;
    if (run.usage.length) {
      html += `
        <table>
          <tr><th>Agent</th><th>Input</th><th>Cached</th><th>Output</th><th>ms</th><th>Cost</th></tr>
          ${run.usage.map((u) => `<tr><td>${u.agent}</td><td>${fmt(u.input_tokens)}</td><td>${fmt(u.cached_tokens)}</td>
            <td>${fmt(u.output_tokens)}</td><td>${fmt(u.latency_ms)}</td><td>${money(u.cost_usd)}</td></tr>`).join("")}
          <tr><th>Total</th><th>${fmt(run.totals.input_tokens)}</th><th>${fmt(run.totals.cached_tokens)}</th>
            <th>${fmt(run.totals.output_tokens)}</th><th></th><th>${money(run.totals.cost_usd)}</th></tr>
        </table>`;
    } else {
      html += `<p class="muted">No model calls in demo mode.</p>`;
    }
  }
  html += `<p class="muted" id="usage-line"></p><a class="reset-link" href="/api/export.csv" download>Download trial data (CSV)</a><br>
    <button class="reset-link" id="reset-btn">Reset room and progress</button>`;
  $("stats-body").innerHTML = html;
  api("/api/usage").then((u) => {
    const line = $("usage-line");
    if (line) line.textContent = `Tokens used today: ${fmt(u.tokens_today)} of ${fmt(u.daily_budget)} daily budget.`;
  }).catch(() => {});
}

/* ---------------- interactions ---------------- */

function highlightQuest(questId, scroll) {
  document.querySelectorAll(".quest.highlight").forEach((el) => el.classList.remove("highlight"));
  const el = $(`quest-${questId}`);
  if (!el) return;
  el.classList.add("highlight");
  if (scroll) el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => el.classList.remove("highlight"), 2500);
}

function showTooltip(info, x, y) {
  const tip = $("tooltip");
  if (!info) { tip.hidden = true; return; }
  tip.innerHTML = `<div class="tt-title">${escapeHtml(info.label)}</div>${escapeHtml(info.text)}`;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.hidden = false;
}

let toastTimer;
function toast(message, warn = false) {
  const t = $("toast");
  t.textContent = message;
  t.className = "toast" + (warn ? " warn" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}

function openModal(html, extraClass = "") {
  $("modal").className = `modal panel ${extraClass}`;
  $("modal").innerHTML = html;
  $("modal-back").hidden = false;
}
function closeModal() { $("modal-back").hidden = true; }

function showCrisis(info) {
  openModal(`
    <h2>Let's pause for a moment</h2>
    <p>${escapeHtml(info.message)}</p>
    <ul class="resources">${(info.resources || []).map((r) => `<li><b>${escapeHtml(r.name)}</b>${escapeHtml(r.detail)}</li>`).join("")}</ul>
    <button class="btn btn-gold" data-close-modal>Close</button>`, "crisis");
}

let thinkingTimer;
function setBusy(on) {
  busy = on;
  $("submit-btn").disabled = on;
  $("thinking").hidden = !on;
  clearInterval(thinkingTimer);
  if (on) {
    let i = 0;
    $("thinking-title").textContent = THINKING[0];
    thinkingTimer = setInterval(() => { i = Math.min(i + 1, THINKING.length - 1); $("thinking-title").textContent = THINKING[i]; }, 1800);
  }
}

function showFormError(message) {
  const box = $("form-error");
  const input = $("task");
  box.textContent = message;
  box.hidden = !message;
  input.classList.remove("invalid");
  if (message) {
    void input.offsetWidth; // restart the shake animation
    input.classList.add("invalid");
    input.focus();
  }
}

$("task").addEventListener("input", () => showFormError(""));


$("task").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("task-form").requestSubmit(); }
});

$("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const task = $("task").value.trim();
  if (!task) { showFormError("Type the thing you're avoiding in the box above first."); return; }
  showFormError("");
  setBusy(true);
  try {
    state = await api("/api/quests", { method: "POST", body: { task } });
    $("task").value = "";
    render();
    toast("The Designer is building your item…");
    completeHint("task");
    setTimeout(() => showHint("done"), 900);
  } catch (err) {
    const blocked = err.data && err.data.blocked;
    if (blocked && blocked.status === "crisis") showCrisis(blocked);
    else showFormError(err.message);
  } finally {
    setBusy(false);
  }
});

$("quests").addEventListener("click", async (e) => {
  const doneBtn = e.target.closest("[data-done]");
  const drop = e.target.closest("[data-drop]");
  const tipsBtn = e.target.closest("[data-tips]");
  if (tipsBtn) {
    const id = tipsBtn.dataset.tips;
    if (openTipIds.has(id)) { openTipIds.delete(id); renderQuests(); } else openTips(id);
    return;
  }
  if (doneBtn) {
    completeHint("done");
    doneBtn.disabled = true;
    const questId = doneBtn.dataset.done;
    try {
      const res = await api(`/api/quests/${questId}/done`, { method: "POST" });
      const leveledUp = res.level > state.level;
      const ev = res.event;
      world.clearMess(questId);
      sound.poof();
      setTimeout(world.celebrate, 500);
      if (ev.unlocked.length || leveledUp) setTimeout(sound.chime, 450);
      state = res;
      setTimeout(() => render(), 450);
      toast(`+${ev.xp} XP · Cleared “${ev.name}”`);
      if (leveledUp) setTimeout(() => toast(`LEVEL UP! You're level ${res.level}.`), 1600);
      // Let the pet finish celebrating, then it asks its question. Unlocks still get a popup.
      setTimeout(() => askPet(questId), 4800);
      if (ev.unlocked.length) setTimeout(() => showDone(ev), 5400);
      setTimeout(() => showHint("shop"), 9000);
    } catch (err) {
      doneBtn.disabled = false;
      toast(err.message, true);
    }
  } else if (drop) {
    const q = state.quests.find((x) => x.id === drop.dataset.drop);
    if (q && confirm(`Remove "${q.task}"? It disappears without any XP.`)) {
      state = await api(`/api/quests/${q.id}`, { method: "DELETE" });
      render();
    }
  }
});

/* ---------------- drag to reorder ---------------- */

let dragging = null;

$("quests").addEventListener("dragstart", (e) => {
  const card = e.target.closest(".quest");
  if (!card) return;
  dragging = card;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", card.dataset.id);
});

$("quests").addEventListener("dragover", (e) => {
  if (!dragging) return;
  e.preventDefault();
  // Drop before the first card whose middle is below the pointer.
  const others = [...$("quests").querySelectorAll(".quest:not(.dragging)")];
  const after = others.find((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
  if (after) $("quests").insertBefore(dragging, after);
  else $("quests").appendChild(dragging);
});

$("quests").addEventListener("dragend", async () => {
  if (!dragging) return;
  dragging.classList.remove("dragging");
  dragging = null;
  const ids = [...$("quests").querySelectorAll(".quest")].map((el) => el.dataset.id);
  if (ids.join() === state.quests.map((q) => q.id).join()) return;
  try {
    state = await api("/api/quests/order", { method: "POST", body: { ids } });
  } catch (err) {
    toast(err.message, true);
    renderQuests();
  }
});

function showDone(ev) {
  const unlocks = ev.unlocked.map((d) => `
    <p><b>Unlocked: ${escapeHtml(catalog.decor[d])}</b></p>
    <div class="unlock-choice">
      <button class="btn btn-gold" data-place="${d}" data-close-modal>Place in my room</button>
      <button class="btn" data-stash="${d}" data-close-modal>Keep in storage</button>
    </div>`).join("");
  openModal(`
    <div class="chest">${pixelArt("chest", 64)}</div>
    <h2>Pile cleared!</h2>
    <p>“${escapeHtml(ev.name)}” is done. You did the thing you were putting off.</p>
    <p><b>+${ev.xp} XP · +${ev.coins} coins</b></p>
    ${unlocks || `<button class="btn btn-gold" data-close-modal>Back to my room</button>`}`);
}

/* ---------------- storage chest ---------------- */

function renderStorage() {
  const owned = new Set(state.decor);
  $("storage-body").innerHTML = catalog.unlocks.map(([name, xp]) => {
    const label = escapeHtml(catalog.decor[name]);
    if (!owned.has(name)) {
      return `<div class="store-item locked"><span class="store-name">${label}<span class="store-status">Unlocks at ${xp} XP</span></span></div>`;
    }
    const placed = name in state.placed;
    const status = placed ? (state.wall_draggable.includes(name) ? "In your room · drag along the walls"
      : state.draggable.includes(name) ? "In your room · drag to move, click to turn" : "In your room") : "In storage";
    return `<div class="store-item"><span class="store-name">${label}<span class="store-status">${status}</span></span>
      ${placed ? `<button class="btn" data-stash="${name}">Store</button>` : `<button class="btn btn-gold" data-place="${name}">Place</button>`}</div>`;
  }).join("");
}

$("storage-btn").addEventListener("click", () => {
  $("storage").hidden = !$("storage").hidden;
  $("stats").hidden = true;
  $("shop").hidden = true;
  world.closeDrawer();
  if (!$("storage").hidden) renderStorage();
  if (!$("shop").hidden) renderShop();
  renderSquishy();
});

document.addEventListener("click", async (e) => {
  const placeBtn = e.target.closest("[data-place]");
  const stashBtn = e.target.closest("[data-stash]");
  if (!placeBtn && !stashBtn) return;
  const name = (placeBtn || stashBtn).dataset[placeBtn ? "place" : "stash"];
  try {
    state = await api(`/api/decor/${name}/${placeBtn ? "place" : "store"}`, { method: "POST" });
    render();
    toast(placeBtn ? `${catalog.decor[name]} is in your room.` : `${catalog.decor[name]} went into storage.`);
  } catch (err) {
    toast(err.message, true);
  }
});

/* ---------------- pixel art (same style as the cat face rug) ---------------- */

const PIXEL_ART = {
  cat: { map: [
    "..G......G..", ".GGG....GGG.", ".GPGG..GGPG.", ".GGGGGGGGGG.", "GGGGGGGGGGGG", "GGEGGGGGGEGG",
    "GGEGGGGGGEGG", "WGGGGNNGGGGW", "GWWGGMMGGWWG", "GGGGGGGGGGGG", ".GGGGGGGGGG.", "..GGGGGGGG.."],
    colors: { G: "#e4ddd2", P: "#f4b6c2", E: "#2b2b2b", N: "#e8879c", M: "#5a4a42", W: "#9a928a" } },
  dog: { map: [
    "............", ".DD......DD.", "DDDFFFFFFDDD", "DDFFFFFFFFDD", "DDFFFFFFFFDD", "DFFEFFFFEFFD",
    ".FFFFFFFFFF.", ".FFFMMMMFFF.", "..FMMNNMMF..", "..FMGMMGMF..", "...MMMMMM...", "....GGGG...."],
    colors: { F: "#c98a4b", D: "#8f5528", E: "#3a2214", M: "#4b3d36", G: "#8a7b70", N: "#141414" } },
  fish: { map: [
    "............", "............", "....LLL.....", "...OOOOO..TT", "..OOOOOOOTTT", ".OEOOOOOOTT.",
    ".OOOOOOOOTT.", "..OOOOOOOTTT", "...OOOOO..TT", "....LL......", "............", "............"],
    colors: { O: "#f28c28", L: "#ffb05c", T: "#e06b10", E: "#1b1b1b" } },
  peanut: { map: [
    "....PPPP....", "...PPPPPP...", "..PPEPPEPP..", "..PBPPPPBP..", "...PPMMPP...", "....PPPP....",
    "...PPPPPP...", "..PPDPPDPP..", "..PPPPPPPP..", "..PPDPPPDP..", "...PPPPPP...", "....PPPP...."],
    colors: { P: "#e3b778", D: "#c9985a", E: "#2b2b2b", B: "#f4a3a3", M: "#5a4a42" } },
  strawberry: { map: [
    "....LLLL....", "...LLLLLL...", "..RRRLLRRR..", ".RRRRRRRRRR.", ".RSRERRERSR.", ".RRBRRRRBRR.",
    ".RRRRMMRRRR.", "..RSRRRRSR..", "..RRRRSRRR..", "...RRRRRR...", "....RSRR....", ".....RR....."],
    colors: { R: "#f06a7a", S: "#fff2c2", L: "#6cc070", E: "#2b2b2b", B: "#ffb3c1", M: "#5a2a2a" } },
  butter: { map: [                                           // a cute stick of butter standing up; navy stripes nod to the label
    ".TTTTTTTT.", ".YYYYYYYYD", ".YYEYYEYYD", ".YBYMMYBYD", ".YYYYYYYYD", ".YYNYYYYYD", ".YYNYYNYYD",
    ".YYNYYNYYD", ".YYNYYNYYD", ".YYNYYNYYD", ".YYNYYYYYD", ".YYYYYYYYD", "..SSSSSSSS"],
    colors: { T: "#fbf3a0", Y: "#efe36a", D: "#dccf4f", S: "#cfc24a", E: "#3a2a1a", B: "#ffb3a7", M: "#8a5a2b", N: "#1f3550" } },
  tofu: { map: [                                             // the original butter design as a soft white block of tofu
    "............", "............", "............", "...LLLLLLL..", "..LLLLLLLLS.", "..YYYYYYYYS.",
    "..YEYYYYEYS.", "..YBYMMYBYS.", "..YYYYYYYYS.", "..YYYYYYYY..", "............", "............"],
    colors: { L: "#fffdf6", Y: "#f6f1e3", S: "#e4dcc8", E: "#3a2a1a", B: "#ffb3a7", M: "#8a5a2b" } },
  bao: { map: [
    "............", "....CCCC....", "...WWCCWW...", "..WWWCCWWW..", ".WWWWWWWWWW.", ".WWEWWWWEWW.",
    ".WBWWWWWWBW.", ".WWWWMMWWWW.", ".WWWWWWWWWW.", "..CWWWWWWC..", "...CCCCCC...", "............"],
    colors: { W: "#fbf6ee", C: "#e6dccb", E: "#2b2b2b", B: "#f7c1c8", M: "#5a4a42" } },
  cat_squishy: { map: [
    "............", ".G........G.", ".GG......GG.", ".GPGGGGGGPG.", ".GGGGGGGGGG.", "GGGEGGGGEGGG",
    "GGBGGGGGGBGG", "GGGGGNNGGGGG", "GGGGMGGMGGGG", ".GGGGGGGGGG.", "..GGGGGGGG..", "............"],
    colors: { G: "#cfc8e0", P: "#f4b6c2", E: "#2b2b2b", B: "#f7a8b8", N: "#e8879c", M: "#5a4a42" } },
  chest: { map: [
    "............", ".KKKKKKKKKK.", ".KLLLLLLLLK.", ".KLLLLLLLLK.", ".KKKKSSKKKK.", ".KWWWSSWWWK.",
    ".KWWWSSWWWK.", ".KWDWWWWDWK.", ".KWDWWWWDWK.", ".KWWWWWWWWK.", ".KKKKKKKKKK.", "............"],
    colors: { K: "#3b2412", L: "#a0703f", W: "#8b5a2b", D: "#6e4520", S: "#d9d9d9" } },
};

function pixelArt(name, size = 48) {
  const art = PIXEL_ART[name];
  const rects = art.map.flatMap((row, y) => [...row].map((ch, x) =>
    ch === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${art.colors[ch]}"/>`)).join("");
  const w = art.map[0].length, h = art.map.length;
  return `<svg class="pixel-art" viewBox="0 0 ${w} ${h}" width="${size * w / h}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/* ---------------- the pet's question (user trial) ---------------- */

const PET_HELLO = { dog: "Woof!", cat: "Mrrp!", fish: "Blub!" };
let bubbleTimer;
let bubbleQuest = null;

function placeBubble() {
  const pos = world.petScreenPos();
  if (!pos) return false;
  $("pet-bubble").style.left = `${pos.x}px`;
  $("pet-bubble").style.top = `${pos.y}px`;
  return true;
}

let bubbleFollow;

function askPet(questId) {
  if (!state.pet) return;
  bubbleQuest = questId;
  world.holdPet(true);                                     // the cat hops back on the bed to ask
  $("pet-bubble-text").textContent = `${PET_HELLO[state.pet]} Did Tidy help with the task?`;
  const bubble = $("pet-bubble");
  bubble.classList.remove("fading");
  if (!placeBubble()) return;
  bubble.hidden = false;
  clearInterval(bubbleFollow);
  bubbleFollow = setInterval(placeBubble, 100);           // stay above the pet even if the view moves
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, 12000);           // optional: it fades away on its own
}

function hideBubble() {
  clearInterval(bubbleFollow);
  world.holdPet(false);                                    // back to sitting by the "Start here" pile
  const bubble = $("pet-bubble");
  bubble.classList.add("fading");
  setTimeout(() => { bubble.hidden = true; bubble.classList.remove("fading"); }, 400);
}

$("pet-bubble").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-answer]");
  if (!btn || !bubbleQuest) return;
  const quest = bubbleQuest;
  bubbleQuest = null;
  clearTimeout(bubbleTimer);
  $("pet-bubble-text").textContent = "Thanks! I'm proud of you.";
  $("pet-bubble").querySelector(".pet-bubble-answers").hidden = true;
  setTimeout(() => { hideBubble(); setTimeout(() => ($("pet-bubble").querySelector(".pet-bubble-answers").hidden = false), 500); }, 1400);
  try { state = await api(`/api/history/${quest}/answer`, { method: "POST", body: { answer: btn.dataset.answer } }); } catch {}
});
window.addEventListener("resize", () => { if (!$("pet-bubble").hidden) placeBubble(); });

/* ---------------- first-time hints ---------------- */

const HINTS = {
  task: { text: "Type something you're putting off, then press Add to my room.", target: () => $("task"), side: "right" },
  done: { text: "Do the task in real life, then click Done to clear the pile.", target: () => document.querySelector(".done-btn"), side: "right" },
  shop: { text: "Click the nightstand to spend your coins in the shop.", target: () => world.shopScreenPos(), side: "up" },
};
const seenHints = new Set(JSON.parse(localStorage.getItem("tidy-hints") || "[]"));
let currentHint = null;

function showHint(name) {
  if (seenHints.has(name) || currentHint || !$("modal-back").hidden) return;
  const h = HINTS[name];
  const target = h.target();
  if (!target) return;
  const el = $("hint");
  $("hint-text").textContent = h.text;
  el.hidden = false;
  if (h.side === "right") {
    const r = target.getBoundingClientRect();
    el.className = "hint point-left";
    el.style.left = `${r.right + 14}px`;
    el.style.top = `${r.top + r.height / 2 - el.offsetHeight / 2}px`;
  } else {
    el.className = "hint point-down";
    el.style.left = `${target.x - el.offsetWidth / 2}px`;
    el.style.top = `${target.y - el.offsetHeight - 14}px`;
  }
  currentHint = name;
}

// Mark a hint as seen (by clicking "Got it" or by simply doing the thing it describes).
function completeHint(name) {
  seenHints.add(name);
  localStorage.setItem("tidy-hints", JSON.stringify([...seenHints]));
  if (currentHint === name) { $("hint").hidden = true; currentHint = null; }
}

$("hint-ok").addEventListener("click", () => { if (currentHint) completeHint(currentHint); });

/* ---------------- nightstand shop ---------------- */

function openShop() {
  $("shop").hidden = false;
  $("storage").hidden = true;
  $("stats").hidden = true;
  renderShop();
}

function renderShop() {
  const byPrice = Object.entries(catalog.toys).sort((a, b) => a[1][1] - b[1][1]);
  $("shop-body").innerHTML = byPrice.map(([toy, [label, price]]) => {
    const owned = state.toys.includes(toy);
    const out = state.active_toy === toy;
    const button = !owned
      ? `<button class="btn btn-gold" data-buy="${toy}" ${state.coins < price ? "disabled" : ""}>Buy</button>`
      : out ? `<button class="btn" data-select="">Put away</button>`
      : `<button class="btn" data-select="${toy}">Take out</button>`;
    const status = !owned ? `<span class="shop-price"><span class="coin"></span>${price}</span>`
      : out ? "Out on your screen" : "Yours";
    return `<div class="store-item shop-item">${pixelArt(toy, 40)}
      <span class="store-name">${escapeHtml(label)}<span class="store-status">${status}</span></span>${button}</div>`;
  }).join("") + `<p class="muted">You have ${state.coins} coins.</p>`;
}

document.addEventListener("click", async (e) => {
  const buy = e.target.closest("[data-buy]");
  const pickToy = e.target.closest("[data-select]");
  if (!buy && !pickToy) return;
  try {
    if (buy) {
      state = await api(`/api/shop/${buy.dataset.buy}/buy`, { method: "POST" });
      sound.chime();
      toast(`You bought the ${catalog.toys[buy.dataset.buy][0].toLowerCase()}! Give it a squish.`);
    } else {
      state = await api("/api/toys/select", { method: "POST", body: { toy: pickToy.dataset.select || null } });
    }
    render();
  } catch (err) {
    toast(err.message, true);
  }
});

/* ---------------- the squishy ---------------- */

let shownToy = null;

function renderSquishy() {
  const toy = state.active_toy;
  $("squishy-stage").hidden = !toy;
  if (!toy) { shownToy = null; return; }
  if (toy !== shownToy) {
    $("squishy").innerHTML = pixelArt(toy, 150);
    $("squishy-name").textContent = catalog.toys[toy][0];
    shownToy = toy;
  }
}

$("squishy").addEventListener("pointerdown", () => {
  $("squishy").classList.remove("release");
  $("squishy").classList.add("pressed");
  sound.squishPress();
});
function releaseSquishy() {
  const el = $("squishy");
  if (!el.classList.contains("pressed")) return;
  el.classList.remove("pressed");
  void el.offsetWidth;                      // restart the slow-rise animation
  el.classList.add("release");
  sound.squishRelease();
}
$("squishy").addEventListener("pointerup", releaseSquishy);
$("squishy").addEventListener("pointerleave", releaseSquishy);

/* ---------------- pet chooser ---------------- */

function showPetChooser() {
  openModal(`
    <h2>Pick your roommate</h2>
    <p>They'll keep you company and celebrate every task you finish.</p>
    <div class="pet-grid">
      <button class="pet-card" data-pet="dog">${pixelArt("dog")}<b>Dog</b></button>
      <button class="pet-card" data-pet="cat">${pixelArt("cat", 40)}<b>Cat</b></button>
      <button class="pet-card" data-pet="fish">${pixelArt("fish")}<b>Fish</b></button>
    </div>`, "locked");
}

$("modal").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-pet]");
  if (!card) return;
  try {
    state = await api("/api/pet", { method: "POST", body: { pet: card.dataset.pet } });
    closeModal();
    render();
    toast(`Say hi to your new ${catalog.pets[state.pet].toLowerCase()}!`);
    setTimeout(() => showHint("task"), 900);
  } catch (err) {
    toast(err.message, true);
  }
});

$("modal-back").addEventListener("click", (e) => {
  if ($("modal").classList.contains("locked")) return;     // the pet chooser needs an answer
  if (e.target.matches("[data-close-modal]") || e.target === $("modal-back")) closeModal();
});

$("stats-btn").addEventListener("click", () => {
  $("stats").hidden = !$("stats").hidden;
  $("storage").hidden = true;
  $("shop").hidden = true;
  world.closeDrawer();
  if (!$("stats").hidden) renderStats();
});
document.addEventListener("click", async (e) => {
  if (e.target.matches("[data-close]")) {
    $(e.target.dataset.close).hidden = true;
    if (e.target.dataset.close === "shop") world.closeDrawer();
  }
  if (e.target.id === "reset-btn" && confirm("Reset your room, quests and progress? This can't be undone.")) {
    state = await api("/api/reset", { method: "POST" });
    location.reload();
  }
});

/* ---------------- day / night ---------------- */

const MOON_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
  '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>';

function setNight(on, instant = false) {
  document.body.classList.toggle("night", on);
  world.setNight(on, instant);
  const btn = $("night-btn");
  btn.innerHTML = on ? `${SUN_ICON}<span>Day</span>` : `${MOON_ICON}<span>Night</span>`;
  btn.setAttribute("aria-pressed", String(on));
  btn.title = on ? "Switch to daytime" : "Switch to nighttime";
  localStorage.setItem("tidy-night", on ? "1" : "0");
}

$("night-btn").addEventListener("click", () => setNight(!document.body.classList.contains("night")));
setNight(localStorage.getItem("tidy-night") === "1", true);

/* ---------------- sound effects ---------------- */

const SPEAKER_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';

function setEffects(on) {
  sound.setEffects(on);
  const btn = $("sound-btn");
  btn.innerHTML = `${on ? SPEAKER_ON : SPEAKER_OFF}<span>${on ? "Sound on" : "Sound off"}</span>`;
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.toggle("is-off", !on);
  localStorage.setItem("tidy-sound", on ? "1" : "0");
}

$("sound-btn").addEventListener("click", () => setEffects(!sound.effectsEnabled()));
setEffects(localStorage.getItem("tidy-sound") !== "0");

/* ---------------- music ---------------- */

const NOTE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5V5.2l11-2.2v12.3a3 3 0 1 1-2-2.8V7.4l-7 1.4v8.7a3 3 0 1 1-2-2.8z"/></svg>';

// If Tidy is open in more than one tab, they share one music setting and only one tab plays.
const musicChannel = "BroadcastChannel" in window ? new BroadcastChannel("tidy-music") : null;

function showMusicButton(on) {
  const btn = $("music-btn");
  btn.innerHTML = `${NOTE_ICON}<span>${on ? "Music on" : "Music off"}</span>`;
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.toggle("is-off", !on);
}

function setMusic(on, { tellOthers = true } = {}) {
  if (on) sound.startMusic(); else sound.stopMusic();
  showMusicButton(on);
  localStorage.setItem("tidy-music", on ? "1" : "0");
  if (tellOthers && musicChannel) musicChannel.postMessage(on ? "on" : "off");
}

if (musicChannel) {
  musicChannel.onmessage = (e) => {
    sound.stopMusic();                         // another tab took over (or turned it off)
    showMusicButton(e.data === "on");
  };
}

$("music-btn").addEventListener("click", () => setMusic($("music-btn").getAttribute("aria-pressed") !== "true"));
// Browsers only allow sound after the user interacts, so show the saved choice now and
// actually start the music on the first click anywhere.
const musicWanted = localStorage.getItem("tidy-music") === "1";
showMusicButton(musicWanted);
if (musicWanted) {
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#music-btn")) setMusic(true);
  }, { once: true });
}

/* ---------------- start ---------------- */

(async function start() {
  try {
    [catalog, state] = await Promise.all([api("/api/catalog"), api("/api/state")]);
    world.setDecorInfo(state.draggable, catalog.decor, state.wall_draggable);
    render({ animate: false });
    if (!state.pet) showPetChooser();
    else setTimeout(() => showHint("task"), 1200);
    api("/api/visit", { method: "POST" }).catch(() => {});
  } catch (err) {
    toast("Couldn't reach the Tidy server. Is `python app.py` still running?", true);
  }
})();
