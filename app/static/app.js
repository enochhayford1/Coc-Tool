"use strict";

const state = { clan: null, demo: false };

function $(sel) { return document.querySelector(sel); }
function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (html) node.innerHTML = html;
  return node;
}

function status(msg, isError = false) {
  const s = $("#status");
  s.textContent = msg;
  s.style.color = isError ? "var(--red)" : "var(--muted)";
}

async function api(path, opts = {}) {
  const url = new URL(path, window.location.origin);
  if (state.clan) url.searchParams.set("clan", state.clan);
  const resp = await fetch(url, opts);
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body.detail || `Request failed (${resp.status})`);
  }
  return body;
}

function roleClass(role) {
  return { leader: "gold", coLeader: "blue", admin: "green" }[role] || "";
}
function roleLabel(role) {
  return { leader: "Leader", coLeader: "Co-leader", admin: "Elder", member: "Member" }[role] || role;
}
function verdictClass(v) {
  return { strong: "green", consider: "amber", weak: "red" }[v] || "";
}
function deltaCell(d) {
  if (d === null || d === undefined) return '<span class="delta-zero">—</span>';
  if (d > 0) return `<span class="delta-up">+${d}</span>`;
  if (d < 0) return `<span class="delta-down">${d}</span>`;
  return '<span class="delta-zero">0</span>';
}

// --- Overview --------------------------------------------------------------

async function loadOverview() {
  try {
    const data = await api("/api/overview");
    state.demo = data.demo_mode;
    const c = data.clan, s = data.stats;
    const cards = [
      ["Clan", c.name || "—", c.tag || ""],
      ["Level", c.level ?? "—", `${s.member_count} members`],
      ["Points", (c.points ?? 0).toLocaleString(), `streak ${c.war_win_streak ?? 0}`],
      ["War wins", c.war_wins ?? "—", ""],
      ["Avg donations", s.avg_donations.toLocaleString(), `${s.total_donations.toLocaleString()} total`],
      ["Flagged", s.flagged_count, "need attention"],
      ["Promote", s.promotion_candidates, "candidates"],
    ];
    $("#overviewCards").replaceChildren(...cards.map(([label, value, sub]) =>
      el("div", { class: "card" },
        `<div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div>`)
    ));
    const reqs = [];
    if (c.required_townhall) reqs.push(`TH${c.required_townhall}+`);
    if (c.required_trophies) reqs.push(`${c.required_trophies}+ trophies`);
    $("#overviewMeta").innerHTML = `
      ${c.description ? `<p>${c.description}</p>` : ""}
      ${reqs.length ? `<p class="hint">Clan requirements: ${reqs.join(", ")}</p>` : ""}`;
    status(state.demo ? "Demo data loaded." : `Loaded ${c.name}.`);
  } catch (e) {
    $("#overviewCards").innerHTML = `<div class="error">${e.message}</div>`;
    status(e.message, true);
  }
}

// --- Members ---------------------------------------------------------------

async function loadMembers() {
  const target = $("#membersTable");
  target.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const rows = await api("/api/members");
    if (!rows.length) { target.innerHTML = '<div class="empty">No members.</div>'; return; }
    const table = el("table");
    table.innerHTML = `<thead><tr>
      <th>#</th><th>Name</th><th>Role</th><th>TH</th><th>Trophies</th>
      <th>Donated</th><th>Received</th><th>Ratio</th><th>Contribution</th>
      <th>Δ Don.</th><th>Notes</th></tr></thead>`;
    const tbody = el("tbody");
    rows.forEach((m, i) => {
      const notes = [];
      if (m.promotion_candidate) notes.push('<span class="pill gold">Promote</span>');
      m.flags.forEach((f) => notes.push(`<span class="pill amber" title="${f}">⚠</span>`));
      const tr = el("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><strong>${m.name}</strong><br><span class="hint">${m.tag}</span></td>
        <td><span class="pill ${roleClass(m.role)}">${roleLabel(m.role)}</span></td>
        <td>${m.town_hall}</td>
        <td>${m.trophies.toLocaleString()}</td>
        <td>${m.donations.toLocaleString()}</td>
        <td>${m.donations_received.toLocaleString()}</td>
        <td>${m.donation_ratio}</td>
        <td><div class="bar" title="${m.contribution_score}/100"><span style="width:${m.contribution_score}%"></span></div></td>
        <td>${deltaCell(m.donations_delta)}</td>
        <td>${notes.join(" ") || ""}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    target.replaceChildren(table);
  } catch (e) {
    target.innerHTML = `<div class="error">${e.message}</div>`;
  }
}

async function saveSnapshot() {
  try {
    const r = await api("/api/snapshot", { method: "POST" });
    status(`Snapshot saved (${r.member_count} members). Deltas will show on next refresh.`);
    loadMembers();
  } catch (e) { status(e.message, true); }
}

// --- War -------------------------------------------------------------------

async function loadWar() {
  const summary = $("#warSummary"), tableWrap = $("#warTable");
  summary.innerHTML = '<div class="empty">Loading…</div>';
  tableWrap.innerHTML = "";
  try {
    const data = await api("/api/war");
    if (!data.in_war) {
      summary.innerHTML = '<div class="empty">Not currently in a war (or the war log is private).</div>';
      return;
    }
    const w = data.war;
    summary.innerHTML = `
      <div class="versus">
        <div class="side"><div class="name">${w.clan_name}</div>
          <div class="score">${w.clan_stars}★</div>
          <div class="hint">${w.clan_destruction}%</div></div>
        <div class="vs">vs</div>
        <div class="side"><div class="name">${w.opponent_name}</div>
          <div class="score">${w.opponent_stars}★</div>
          <div class="hint">${w.opponent_destruction}%</div></div>
      </div>
      <p class="hint">State: <strong>${w.state}</strong> · ${w.team_size}v${w.team_size} ·
        Attacks used ${w.attacks_used}/${w.attacks_available} ·
        ${w.members_with_missed_attacks.length} member(s) with missed attacks</p>`;

    const table = el("table");
    table.innerHTML = `<thead><tr><th>Pos</th><th>Name</th><th>TH</th>
      <th>Attacks</th><th>Stars</th><th>Status</th></tr></thead>`;
    const tbody = el("tbody");
    w.members.forEach((m) => {
      const ok = m.missed_attacks === 0;
      const tr = el("tr");
      tr.innerHTML = `
        <td>${m.map_position}</td>
        <td><strong>${m.name}</strong></td>
        <td>${m.town_hall}</td>
        <td>${m.attacks_used}/${m.attacks_available}</td>
        <td>${m.stars}★</td>
        <td>${ok ? '<span class="pill green">Done</span>'
                 : `<span class="pill red">${m.missed_attacks} missed</span>`}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.replaceChildren(table);
  } catch (e) {
    summary.innerHTML = `<div class="error">${e.message}</div>`;
  }
}

// --- Recruitment -----------------------------------------------------------

async function screenRecruit() {
  const tag = $("#recruitTag").value.trim();
  if (!tag) { status("Enter a player tag.", true); return; }
  const target = $("#recruitResult");
  target.innerHTML = '<div class="empty">Screening…</div>';
  try {
    const r = await api(`/api/recruit/${encodeURIComponent(tag)}`);
    const color = { strong: "var(--green)", consider: "var(--amber)", weak: "var(--red)" }[r.verdict];
    target.innerHTML = `
      <div class="report">
        <div class="score-ring" style="border:6px solid ${color}; color:${color}">${r.score}</div>
        <div>
          <h3 style="margin:0">${r.name} <span class="hint">${r.tag}</span>
            <span class="pill ${verdictClass(r.verdict)}">${r.verdict.toUpperCase()}</span></h3>
          <p class="hint" style="margin:4px 0">
            TH${r.town_hall} · ${r.trophies.toLocaleString()} trophies (best ${r.best_trophies.toLocaleString()}) ·
            ${r.war_stars.toLocaleString()} war stars · ratio ${r.donation_ratio}
            ${r.current_clan ? ` · currently in ${r.current_clan}` : " · no clan"}</p>
          ${r.passed.length ? `<strong class="pass">Meets:</strong>
            <ul>${r.passed.map((p) => `<li class="pass">${p}</li>`).join("")}</ul>` : ""}
          ${r.concerns.length ? `<strong class="concern">Concerns:</strong>
            <ul>${r.concerns.map((c) => `<li class="concern">${c}</li>`).join("")}</ul>` : ""}
        </div>
      </div>`;
    status(`Screened ${r.name}.`);
  } catch (e) {
    target.innerHTML = `<div class="error">${e.message}</div>`;
    status(e.message, true);
  }
}

// --- Wiring ----------------------------------------------------------------

function activate(tabName) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach((p) =>
    p.classList.toggle("active", p.id === tabName));
  if (tabName === "members") loadMembers();
  if (tabName === "war") loadWar();
}

function init() {
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => activate(t.dataset.tab)));
  $("#loadBtn").addEventListener("click", () => {
    state.clan = $("#clanTag").value.trim() || null;
    loadOverview();
    if ($("#members").classList.contains("active")) loadMembers();
    if ($("#war").classList.contains("active")) loadWar();
  });
  $("#snapshotBtn").addEventListener("click", saveSnapshot);
  $("#screenBtn").addEventListener("click", screenRecruit);
  $("#recruitTag").addEventListener("keydown", (e) => { if (e.key === "Enter") screenRecruit(); });

  // Demo helper: clickable sample prospect tags.
  api("/api/health").then((h) => {
    if (h.demo_mode) {
      const tags = ["#GOOD", "#OKAY", "#WEAK"];
      const wrap = $("#demoTags");
      wrap.innerHTML = "Try: ";
      tags.forEach((t) => {
        const c = el("code", {}, t);
        c.addEventListener("click", () => { $("#recruitTag").value = t; screenRecruit(); });
        wrap.appendChild(c);
        wrap.appendChild(document.createTextNode(" "));
      });
    }
  }).catch(() => {});

  loadOverview();
}

document.addEventListener("DOMContentLoaded", init);
