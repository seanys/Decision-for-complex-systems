// Adaptive routing of connected vehicles: why rerouting must be joint, and how the network responds to incidents.
(function () {
  const D = window.MRG_ROUTING;
  const { el, lineChart } = window.Plot;
  const t = (window.I18N && window.I18N.t) || ((s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]));
  const NET = D.network;
  const NL = NET.length.length;
  const NF = D.meta.n_frames;
  const INK = "#1f2328", MUTED = "#5b6370", BLUE = "#4C72B0", SOFT = "#f6f7f9";
  const TRAFFIC = { free: "#55A868", slow: "#E0A526", jam: "#DD6B4D", stop: "#9E2A2B", empty: "#d3d9e1" };
  const colors = { fixed: "#DD8452", adaptive: "#4C72B0" };
  const names = { fixed: t("Fixed routes"), adaptive: t("Joint adaptive routing") };
  const EVENT = { breakdown: { speed: 0.7, color: "#E0A526", name: t("Vehicle breakdown") }, capdrop: { speed: 0.3, color: "#C44E52", name: t("Sudden capacity drop") } };
  const policies = { fixed: D.fixed, adaptive: D.adaptive };
  const START = Math.round(NF / 4);   // every scenario opens a quarter of the way in
  let k = START;
  let playing = false;
  let speed = 4;

  const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const timeOf = (frame) => policies.fixed.frames[frame].t;

  document.getElementById("episode-note").textContent = t(
    "{minutes} minutes of departures from two origins to two destinations, with vehicle breakdowns and sudden capacity drops on the riskier roads. Both networks see exactly the same vehicles and incidents.",
    { minutes: Math.round(D.meta.spawn_t / 60) });

  // ---------- Problem: three ways to respond to an incident ----------
  (function drawProblem() {
    const svg = el("svg", { viewBox: "0 0 1100 290", role: "img", "aria-label": t("Problem setting"), style: "max-width:1100px;margin:0 auto" }, document.getElementById("problem-diagram"));
    const text = (x, y, s, opts) => {
      const o = Object.assign({ size: 14, color: INK, anchor: "middle", weight: "normal" }, opts);
      el("text", { x, y, "text-anchor": o.anchor, "font-size": o.size, "font-weight": o.weight, style: `fill:${o.color}` }, svg).textContent = s;
    };
    const panels = [
      { title: t("Keep the planned route"), sub: t("Everyone queues behind the incident"), main: "stop", detour: "empty", mainCars: 11, detourCars: 0 },
      { title: t("React to traffic information only"), sub: t("Everyone takes the same detour, which jams in turn"), main: "free", detour: "stop", mainCars: 2, detourCars: 16 },
      { title: t("Joint adaptive routing"), sub: t("Vehicles anticipate each other and split across both roads"), main: "slow", detour: "free", mainCars: 7, detourCars: 7, ai: true },
    ];
    panels.forEach((p, i) => {
      const x0 = 10 + i * 365, w = 345;
      el("rect", { x: x0, y: 8, width: w, height: 228, rx: 12, fill: p.ai ? "#e8eef7" : SOFT }, svg);
      const ox = x0 + 34, dx = x0 + w - 34, y = 168, mid = (ox + dx) / 2;
      const detour = `M${ox},${y} C${ox + 40},${y - 120} ${dx - 40},${y - 120} ${dx},${y}`;
      const road = (d, c) => {
        el("path", { d, fill: "none", stroke: "#fff", "stroke-width": 16, "stroke-linecap": "round" }, svg);
        el("path", { d, fill: "none", stroke: TRAFFIC[c], "stroke-width": 9, "stroke-linecap": "round" }, svg);
      };
      road(detour, p.detour);
      road(`M${ox},${y} L${dx},${y}`, p.main);
      // vehicles: on a blocked main road they pile up before the incident
      const blocked = p.main === "stop";
      const mainEnd = blocked ? mid - 22 : dx - 20;
      for (let j = 0; j < p.mainCars; j++) {
        const x = blocked ? mainEnd - j * 11 : ox + 22 + (j + 0.5) * ((mainEnd - ox - 22) / p.mainCars);
        if (!blocked && Math.abs(x - mid) < 14) continue;
        el("circle", { cx: x, cy: y, r: 3.6, fill: INK }, svg);
      }
      const path = el("path", { d: detour, fill: "none" }, svg);
      const L = path.getTotalLength();
      for (let j = 0; j < p.detourCars; j++) {
        const pt = path.getPointAtLength(L * (0.1 + 0.8 * (j + 0.5) / p.detourCars));
        el("circle", { cx: pt.x, cy: pt.y, r: 3.6, fill: INK }, svg);
      }
      el("circle", { cx: mid, cy: y, r: 11, fill: "#C44E52", stroke: "#fff", "stroke-width": 2 }, svg);
      text(mid, y + 5, "!", { size: 14, color: "#fff", weight: "bold" });
      for (const [x, label] of [[ox, t("Origin")], [dx, t("Destination")]]) {
        el("circle", { cx: x, cy: y, r: 10, fill: INK }, svg);
        text(x, y + 30, label, { size: 12, color: MUTED });
      }
      if (p.ai) {
        el("rect", { x: mid - 14, y: 24, width: 28, height: 20, rx: 5, fill: BLUE }, svg);
        text(mid, 38, "AI", { size: 12, color: "#fff", weight: "bold" });
        for (const r of [8, 14]) {
          el("path", { d: `M${mid + 18},${34 - r} a${r},${r} 0 0 1 0,${2 * r}`, fill: "none", stroke: BLUE, "stroke-width": 1.6 }, svg);
          el("path", { d: `M${mid - 18},${34 - r} a${r},${r} 0 0 0 0,${2 * r}`, fill: "none", stroke: BLUE, "stroke-width": 1.6 }, svg);
        }
      }
      text(x0 + w / 2, 260, p.title, { weight: "bold", color: p.ai ? BLUE : INK });
      text(x0 + w / 2, 280, p.sub, { color: MUTED, size: 13 });
    });
  })();

  // ---------- Live maps ----------
  const W = 600, H = 430;
  const nx = (n) => 52 + NET.nodes[n][0] * 124;
  const ny = (n) => 40 + NET.nodes[n][1] * 116;
  const ORIGINS = [1, 4], DESTS = [2, 3];
  const isOD = (n) => ORIGINS.includes(+n) || DESTS.includes(+n);
  const geom = {};
  for (const [id, [a, b]] of Object.entries(NET.links)) {
    const x1 = nx(a), y1 = ny(a), x2 = nx(b), y2 = ny(b);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const ra = isOD(a) ? 14 : 7, rb = isOD(b) ? 14 : 7;
    geom[id] = { sx: x1 + ux * ra, sy: y1 + uy * ra, ex: x2 - ux * rb, ey: y2 - uy * rb, px: -uy, py: ux };
  }
  const along = (id, f, off) => {
    const g = geom[id];
    return [g.sx + (g.ex - g.sx) * f + g.px * off, g.sy + (g.ey - g.sy) * f + g.py * off];
  };

  function buildMap(key) {
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("Road network") }, document.getElementById("map-" + key));
    const casing = el("g", {}, svg), roads = el("g", {}, svg), queues = el("g", {}, svg), dots = el("g", {}, svg), marks = el("g", {}, svg), nodes = el("g", {}, svg);
    const m = { road: {}, queue: {}, pool: [], marks, markPool: {}, dots, wait: {} };
    for (const id of Object.keys(NET.links)) {
      const g = geom[id];
      el("line", { x1: g.sx, y1: g.sy, x2: g.ex, y2: g.ey, stroke: "#e9ecf0", "stroke-width": 17, "stroke-linecap": "round" }, casing);
      m.road[id] = el("line", { x1: g.sx, y1: g.sy, x2: g.ex, y2: g.ey, stroke: TRAFFIC.empty, "stroke-width": 9, "stroke-linecap": "round" }, roads);
      m.queue[id] = el("line", { x1: g.ex, y1: g.ey, x2: g.ex, y2: g.ey, stroke: TRAFFIC.stop, "stroke-width": 9, "stroke-linecap": "round", opacity: 0 }, queues);
    }
    for (const n of Object.keys(NET.nodes)) {
      const od = isOD(n);
      el("circle", { cx: nx(n), cy: ny(n), r: od ? 12 : 5, fill: od ? INK : "#fff", stroke: od ? INK : "#aab2bd", "stroke-width": 1.6 }, nodes);
    }
    const label = (n, s, dx, dy, anchor) => { el("text", { x: nx(n) + dx, y: ny(n) + dy, "text-anchor": anchor, "font-size": 12, style: `fill:${MUTED}` }, nodes).textContent = s; };
    label(1, t("Origin"), -20, 4, "end");
    label(4, t("Origin"), 0, -22, "middle");
    label(2, t("Destination"), 0, 30, "middle");
    label(3, t("Destination"), 0, 30, "middle");
    m.wait[1] = el("text", { x: nx(1) - 20, y: ny(1) + 20, "text-anchor": "end", "font-size": 13, "font-weight": "bold", style: "fill:#9E2A2B" }, nodes);
    m.wait[4] = el("text", { x: nx(4), y: ny(4) - 40, "text-anchor": "middle", "font-size": 13, "font-weight": "bold", style: "fill:#9E2A2B" }, nodes);
    return m;
  }
  const maps = { fixed: buildMap("fixed"), adaptive: buildMap("adaptive") };

  const liveEvents = (time) => D.events.filter(([, s, e]) => time >= s && time < e);

  function trafficColor(count, storage, slow) {
    if (count === 0) return TRAFFIC.empty;
    const s = Math.max(0.15, 1 - count / storage) * slow;      // speed relative to the limit
    return s > 0.75 ? TRAFFIC.free : s > 0.5 ? TRAFFIC.slow : s > 0.25 ? TRAFFIC.jam : TRAFFIC.stop;
  }

  function drawMap(key, frame) {
    const m = maps[key];
    const f = policies[key].frames[frame];
    const events = liveEvents(f.t);
    const slow = new Array(NL).fill(1);
    for (const [l, , , kind] of events) slow[l - 1] = Math.min(slow[l - 1], EVENT[kind].speed);
    for (let i = 0; i < NL; i++) {
      const id = String(i + 1), g = geom[id], st = D.meta.storage[i];
      m.road[id].setAttribute("stroke", trafficColor(f.c[i], st, slow[i]));
      const qf = Math.min(1, f.q[i] / st);
      m.queue[id].setAttribute("opacity", qf > 0.03 ? 1 : 0);
      m.queue[id].setAttribute("x2", g.ex - (g.ex - g.sx) * qf);
      m.queue[id].setAttribute("y2", g.ey - (g.ey - g.sy) * qf);
    }
    const v = f.v;
    while (m.pool.length < v.length) m.pool.push(el("circle", { r: 2, fill: INK, opacity: 0.8 }, m.dots));
    const seen = {};
    for (let j = 0; j < m.pool.length; j++) {
      const c = m.pool[j];
      if (j >= v.length) { c.setAttribute("visibility", "hidden"); continue; }
      const rest = Math.floor(v[j] / 4), link = Math.floor(rest / 1000), pos = (rest % 1000) / 999;
      seen[link] = (seen[link] || 0) + 1;
      const [x, y] = along(link, pos, seen[link] % 2 ? 2.2 : -2.2);
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("visibility", "visible");
    }
    m.wait[1].textContent = f.w[0] >= 3 ? t("{n} waiting", { n: f.w[0] }) : "";
    m.wait[4].textContent = f.w[1] >= 3 ? t("{n} waiting", { n: f.w[1] }) : "";
    // one incident badge per link; a capacity drop outranks a breakdown
    const live = new Map();
    for (const [l, , , kind] of events) if (!live.has(l) || kind === "capdrop") live.set(l, kind);
    for (const [l, kind] of live) {
      const id = `${l}-${kind}`;
      if (m.markPool[id]) continue;
      const g = geom[l];
      const x = (g.sx + g.ex) / 2 - g.px * 15, y = (g.sy + g.ey) / 2 - g.py * 15;
      const grp = el("g", { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, m.marks);
      el("circle", { r: 8.5, fill: EVENT[kind].color, stroke: "#fff", "stroke-width": 2 }, grp);
      el("text", { y: 4.5, "text-anchor": "middle", "font-size": 12, "font-weight": "bold", style: "fill:#fff" }, grp).textContent = "!";
      el("title", {}, grp).textContent = EVENT[kind].name;
      m.markPool[id] = grp;
    }
    for (const [id, grp] of Object.entries(m.markPool)) {
      const [l, kind] = id.split("-");
      if (live.get(+l) !== kind) { grp.remove(); delete m.markPool[id]; }
    }
  }

  const swatch = (color, label) => `<span><i style="background:${color};height:8px;width:18px;border-radius:4px"></i>${label}</span>`;
  const badge = (color, label) => `<span><i style="background:${color};height:12px;width:12px;border-radius:50%"></i>${label}</span>`;
  document.getElementById("map-legend").innerHTML =
    swatch(TRAFFIC.free, t("Free flow")) + swatch(TRAFFIC.slow, t("Slow")) + swatch(TRAFFIC.jam, t("Congested")) + swatch(TRAFFIC.stop, t("Standstill")) +
    badge(EVENT.breakdown.color, EVENT.breakdown.name) + badge(EVENT.capdrop.color, EVENT.capdrop.name) +
    `<span><i style="background:${INK};height:5px;width:5px;border-radius:50%"></i>${t("Vehicle")}</span>`;

  // ---------- KPIs ----------
  function drawKpis(key, frame) {
    const p = policies[key], kp = p.kpi[frame], f = p.frames[frame];
    const waiting = f.w[0] + f.w[1];
    let delta = `<em class="delta">&nbsp;</em>`;
    const ref = policies.fixed.kpi[frame];
    if (key === "adaptive" && ref.mtt > 0 && kp.mtt > 0) {
      const change = 100 * (1 - kp.mtt / ref.mtt);
      delta = `<em class="delta${change < 0 ? " worse" : ""}">${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)} % ${t("vs fixed routes")}</em>`;
    }
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>${t("Vehicles on the road")}</span><strong>${kp.n - waiting}</strong></div>` +
      `<div class="kpi"><span>${t("Waiting at the origins")}</span><strong>${waiting}</strong></div>` +
      `<div class="kpi"><span>${t("Mean travel time so far")}</span><strong>${kp.mtt > 0 ? Math.round(kp.mtt) + " s" : "–"}</strong>${delta}</div>`;
  }

  document.getElementById("outcome").textContent = t(
    "Watch the diagonal road leaving the left origin from minute 20, where breakdowns follow one another and a capacity drop adds to them at minute 30. With fixed routes it fills up and vehicles queue at the origin. With joint adaptive routing, part of the vehicles take the road to the east instead while the others stay, so neither road jams.");

  // ---------- Vehicles in the network ----------
  const minutes = policies.fixed.frames.map((f) => f.t / 60);
  const nTop = Math.ceil(Math.max(...policies.fixed.kpi.map((x) => x.n), ...policies.adaptive.kpi.map((x) => x.n)) / 100) * 100;
  const networkChart = lineChart(document.getElementById("chart-network"), {
    height: 250, xDomain: [0, minutes[minutes.length - 1]], yDomain: [0, nTop], xLabel: t("Time (min)"), yLabel: t("Vehicles"),
    series: [
      { x: minutes, y: policies.fixed.kpi.map((x) => x.n), color: colors.fixed, label: names.fixed },
      { x: minutes, y: policies.adaptive.kpi.map((x) => x.n), color: colors.adaptive, label: names.adaptive },
    ],
  });

  // ---------- Playback ----------
  const slider = document.getElementById("time");
  const playButton = document.getElementById("play");
  const END = NF - 1;
  slider.max = END;

  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = `${fmtClock(timeOf(k))} / ${fmtClock(timeOf(END))}`;
    for (const key of Object.keys(policies)) { drawMap(key, k); drawKpis(key, k); }
    networkChart.setReveal(k);
  }

  let last = null, carry = 0;
  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      carry += ((now - last) / 1000) * 2.5 * speed;     // 1x = 10 simulated seconds per second
      const advance = Math.floor(carry);
      carry -= advance;
      if (advance > 0) { k = Math.min(END, k + advance); drawFrame(); }
      if (k >= END) { setPlaying(false); return; }
    }
    last = now;
    requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value;
    playButton.textContent = playing ? t("Pause") : k >= END ? t("Replay") : k !== START ? t("Resume") : t("Start");
    if (playing) {
      if (k >= END) k = START;
      last = null;
      requestAnimationFrame(tick);
    }
  }
  playButton.addEventListener("click", () => setPlaying(!playing));
  document.getElementById("restart").addEventListener("click", () => { k = START; drawFrame(); setPlaying(true); });
  slider.addEventListener("input", () => { k = +slider.value; drawFrame(); if (!playing) setPlaying(false); });
  document.querySelectorAll(".speed button").forEach((b) => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll(".speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  drawFrame();
})();
