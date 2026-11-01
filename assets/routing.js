// Adaptive routing of connected vehicles on the Nguyen-Dupuis network.
(function () {
  const D = window.MRG_ROUTING;
  const { el, lineChart } = window.Plot;
  const NET = D.network;
  const NL = NET.length.length;
  const FRAME = D.meta.frame;
  const NF = D.meta.n_frames;
  const colors = { fixed: "#DD8452", adaptive: "#4C72B0" };
  const odColors = ["#4C72B0", "#55A868", "#8172B3", "#C08A2E"];
  const kindColor = { breakdown: "#E0A526", capdrop: "#C44E52" };
  const kindName = { breakdown: "Vehicle breakdown", capdrop: "Sudden capacity drop" };
  const names = { fixed: "Fixed routes", adaptive: "Joint adaptive routing" };
  const odLabel = (k) => `OD ${k + 1} (${NET.ods[k][0]}→${NET.ods[k][1]})`;
  const policies = { fixed: D.fixed, adaptive: D.adaptive };
  const START = Math.round(NF / 4);   // every scenario opens a quarter of the way in
  let k = START;
  let playing = false;
  let speed = 4;

  const fmtClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const timeOf = (frame) => policies.fixed.frames[frame].t;

  document.getElementById("episode-note").textContent =
    `${Math.round(D.meta.spawn_t / 60)} minutes of departures on the Nguyen–Dupuis network: each of the four OD pairs sends a vehicle every ` +
    `${Math.round(1 / D.meta.lam)} seconds on average. High- and medium-risk links suffer random vehicle breakdowns and sudden capacity drops. ` +
    `Both networks see exactly the same vehicles and incidents.`;

  // ---------- Network geometry ----------
  const W = 600, H = 436, R = 13;
  const nx = (n) => 46 + NET.nodes[n][0] * 127;
  const ny = (n) => 34 + NET.nodes[n][1] * 122;
  const linkGeom = {};
  for (const [id, [a, b]] of Object.entries(NET.links)) {
    const x1 = nx(a), y1 = ny(a), x2 = nx(b), y2 = ny(b);
    const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    linkGeom[id] = { sx: x1 + ux * (R + 3), sy: y1 + uy * (R + 3), ex: x2 - ux * (R + 7), ey: y2 - uy * (R + 7), ux, uy, nxp: -uy, nyp: ux };
  }
  const pointOn = (id, f, lane) => {
    const g = linkGeom[id];
    return [g.sx + (g.ex - g.sx) * f + g.nxp * lane, g.sy + (g.ey - g.sy) * f + g.nyp * lane];
  };
  const isOD = (n) => [1, 4, 2, 3].includes(+n);

  function arrowMarker(svg, id, color) {
    const defs = el("defs", {}, svg);
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 Z", fill: color }, m);
  }

  function baseMap(container, idPrefix, opts = {}) {
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Nguyen–Dupuis network" }, container);
    arrowMarker(svg, idPrefix + "-arrow", "#9aa3b0");
    const roads = el("g", {}, svg), over = el("g", {}, svg), queues = el("g", {}, svg), dots = el("g", {}, svg), marks = el("g", {}, svg), nodes = el("g", {}, svg);
    const road = {}, occ = {}, queue = {}, label = {};
    for (const id of Object.keys(NET.links)) {
      const g = linkGeom[id];
      const risk = NET.high.includes(+id) ? "high" : NET.medium.includes(+id) ? "medium" : "low";
      road[id] = el("line", { x1: g.sx, y1: g.sy, x2: g.ex, y2: g.ey, stroke: "#dfe3e9", "stroke-width": 11, "stroke-linecap": "round" }, roads);
      if (opts.risk && risk !== "low") road[id].setAttribute("stroke", risk === "high" ? "#f3c9ca" : "#f6e2b8");
      occ[id] = el("line", { x1: g.sx, y1: g.sy, x2: g.ex, y2: g.ey, stroke: "transparent", "stroke-width": 11, "stroke-linecap": "round" }, over);
      queue[id] = el("line", { x1: g.ex, y1: g.ey, x2: g.ex, y2: g.ey, stroke: "#C44E52", "stroke-width": 11, "stroke-linecap": "round", opacity: 0 }, queues);
      el("line", { x1: g.sx, y1: g.sy, x2: g.ex + g.ux * 2, y2: g.ey + g.uy * 2, stroke: "#9aa3b0", "stroke-width": 1.2, "marker-end": `url(#${idPrefix}-arrow)` }, roads);
      const mx = (g.sx + g.ex) / 2 + g.nxp * 15, my = (g.sy + g.ey) / 2 + g.nyp * 15;
      label[id] = el("text", { x: mx, y: my + 4, "text-anchor": "middle", "font-size": 11, fill: "#8a93a0" }, nodes);
      label[id].textContent = id;
    }
    for (const n of Object.keys(NET.nodes)) {
      el("circle", { cx: nx(n), cy: ny(n), r: R, fill: isOD(n) ? "#d8dbe0" : "#fff", stroke: "#1f2328", "stroke-width": 1.4 }, nodes);
      el("text", { x: nx(n), y: ny(n) + 4.5, "text-anchor": "middle", "font-size": 12, "font-weight": "bold" }, nodes).textContent = n;
    }
    return { svg, road, occ, queue, dots, marks, nodes, label };
  }

  // ---------- Problem diagram ----------
  (function drawProblem() {
    const m = baseMap(document.getElementById("problem-diagram"), "pd", { risk: true });
    const tag = (n, text, dx, dy, anchor) => el("text", { x: nx(n) + dx, y: ny(n) + dy, "text-anchor": anchor, "font-size": 12, fill: "#5b6370" }, m.nodes).textContent = text;
    tag(1, "Origin", -20, 4, "end"); tag(4, "Origin", 0, -20, "middle");
    tag(2, "Destination", 0, 30, "middle"); tag(3, "Destination", 0, 30, "middle");
    document.getElementById("problem-legend").innerHTML =
      `<span><i style="background:#f3c9ca;height:8px"></i>High-risk links</span>` +
      `<span><i style="background:#f6e2b8;height:8px"></i>Medium-risk links</span>` +
      `<span><i style="background:#dfe3e9;height:8px"></i>Low-risk links</span>` +
      NET.ods.map((_, i) => `<span><i style="background:${odColors[i]};height:8px;width:8px;border-radius:50%"></i>${odLabel(i)}</span>`).join("");
  })();

  // ---------- Live maps ----------
  const maps = {};
  for (const key of Object.keys(policies)) {
    const m = baseMap(document.getElementById("map-" + key), "mp-" + key);
    m.pool = [];
    m.markPool = {};
    m.waitText = {
      1: el("text", { x: nx(1) - 20, y: ny(1) + 4, "text-anchor": "end", "font-size": 12, "font-weight": "bold", fill: "#C44E52" }, m.nodes),
      4: el("text", { x: nx(4), y: ny(4) - 20, "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#C44E52" }, m.nodes),
    };
    maps[key] = m;
  }
  const occColor = (f) => {
    if (f < 0.15) return "transparent";
    const t = Math.min(1, (f - 0.15) / 0.55);
    const a = [240, 184, 160], b = [196, 78, 82];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  };

  function activeEvents(t) {
    return D.events.filter(([, s, e]) => t >= s && t < e);
  }

  function drawMap(key, frame) {
    const m = maps[key];
    const f = policies[key].frames[frame];
    const t = f.t;
    for (let i = 0; i < NL; i++) {
      const id = String(i + 1);
      const fill = f.c[i] / D.meta.storage[i];
      m.occ[id].setAttribute("stroke", occColor(fill));
      const g = linkGeom[id];
      const qf = Math.min(1, f.q[i] / D.meta.storage[i]);
      m.queue[id].setAttribute("opacity", qf > 0.02 ? 0.9 : 0);
      m.queue[id].setAttribute("x2", g.ex - (g.ex - g.sx) * qf);
      m.queue[id].setAttribute("y2", g.ey - (g.ey - g.sy) * qf);
    }
    const v = f.v;
    while (m.pool.length < v.length) m.pool.push(el("circle", { r: 2.7 }, m.dots));
    const laneCount = {};
    for (let j = 0; j < m.pool.length; j++) {
      const c = m.pool[j];
      if (j >= v.length) { c.setAttribute("visibility", "hidden"); continue; }
      const code = v[j], od = code % 4, rest = Math.floor(code / 4);
      const link = Math.floor(rest / 1000), pos = (rest % 1000) / 999;
      laneCount[link] = (laneCount[link] || 0) + 1;
      const [x, y] = pointOn(link, pos, laneCount[link] % 2 ? 2.6 : -2.6);
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("fill", odColors[od]);
      c.setAttribute("visibility", "visible");
    }
    // waiting at the origins (cannot enter a full first link)
    const waitByOrigin = { 1: f.w[0], 4: f.w[1] };
    for (const o of [1, 4]) m.waitText[o].textContent = waitByOrigin[o] > 0 ? `${waitByOrigin[o]} waiting` : "";
    // incidents
    const live = new Set();
    for (const [link, s, e, kind] of activeEvents(t)) {
      const key2 = `${link}-${s}`;
      live.add(key2);
      if (!m.markPool[key2]) {
        const g = linkGeom[link];
        const mx = (g.sx + g.ex) / 2 - g.nxp * 16, my = (g.sy + g.ey) / 2 - g.nyp * 16;
        const grp = el("g", { transform: `translate(${mx.toFixed(1)},${my.toFixed(1)})` }, m.marks);
        el("path", { d: "M0,-9 L9,7 L-9,7 Z", fill: kindColor[kind], stroke: "#fff", "stroke-width": 1.5, "stroke-linejoin": "round" }, grp);
        el("text", { x: 0, y: 5, "text-anchor": "middle", "font-size": 10, "font-weight": "bold", fill: "#fff" }, grp).textContent = "!";
        el("title", {}, grp).textContent = `${kindName[kind]} on link ${link}`;
        m.markPool[key2] = grp;
      }
    }
    for (const [key2, grp] of Object.entries(m.markPool)) {
      if (!live.has(key2)) { grp.remove(); delete m.markPool[key2]; }
    }
  }

  document.getElementById("map-legend").innerHTML =
    NET.ods.map((_, i) => `<span><i style="background:${odColors[i]};height:8px;width:8px;border-radius:50%"></i>${odLabel(i)}</span>`).join("") +
    `<span><i style="background:linear-gradient(90deg,rgb(240,184,160),rgb(196,78,82));height:8px;width:22px"></i>Dense traffic</span>` +
    `<span><i style="background:#C44E52;height:8px"></i>Queue at the link end</span>` +
    `<span><i style="background:${kindColor.breakdown};height:8px;width:8px"></i>Vehicle breakdown</span>` +
    `<span><i style="background:${kindColor.capdrop};height:8px;width:8px"></i>Sudden capacity drop</span>`;

  // ---------- KPIs ----------
  const maxQueue = (f) => Math.max(...f.q);
  function drawKpis(key, frame) {
    const p = policies[key], kp = p.kpi[frame], f = p.frames[frame];
    let delta = `<em class="delta">&nbsp;</em>`;
    const ref = policies.fixed.kpi[frame];
    if (key === "adaptive" && ref.mtt > 0 && kp.mtt > 0) {
      const change = 100 * (1 - kp.mtt / ref.mtt);
      delta = `<em class="delta${change < 0 ? " worse" : ""}">${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)} % vs fixed routes</em>`;
    }
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>Vehicles in the network</span><strong>${kp.n}</strong></div>` +
      `<div class="kpi"><span>Mean travel time so far</span><strong>${kp.mtt > 0 ? Math.round(kp.mtt) + " s" : "–"}</strong>${delta}</div>` +
      `<div class="kpi"><span>Longest queue now</span><strong>${maxQueue(f)} veh</strong></div>`;
  }

  document.getElementById("outcome").textContent =
    `Watch link 4 from minute 20, where breakdowns follow one another and a capacity drop adds to them at minute 30. On fixed routes, vehicles keep driving into it: ` +
    `the link fills up and the queue backs up to origin 4. With joint adaptive routing, part of the vehicles from origin 4 switch to link 3 ` +
    `while the others stay, so the detour does not jam in turn.`;

  // ---------- Incident timeline ----------
  const timeline = (function () {
    const box = document.getElementById("incident-timeline");
    const links = [...new Set(D.events.map((e) => e[0]))].sort((a, b) => a - b);
    const Wt = Math.max(320, box.clientWidth), rowH = 16, top = 6, left = 58, right = 10;
    const Ht = top + links.length * rowH + 26;
    const tEnd = timeOf(NF - 1);
    const sx = (t) => left + (t / tEnd) * (Wt - left - right);
    const svg = el("svg", { viewBox: `0 0 ${Wt} ${Ht}`, role: "img", "aria-label": "Traffic incidents over the episode", style: "cursor:pointer" }, box);
    links.forEach((l, r) => {
      const y = top + r * rowH;
      el("text", { x: left - 8, y: y + 11, "text-anchor": "end", "font-size": 11, fill: "#5b6370" }, svg).textContent = `Link ${l}`;
      el("line", { x1: left, x2: Wt - right, y1: y + rowH / 2, y2: y + rowH / 2, stroke: "#eceff3" }, svg);
    });
    for (const [l, s, e, kind] of D.events) {
      const r = links.indexOf(l);
      el("rect", { x: sx(s), y: top + r * rowH + 3, width: Math.max(2, sx(Math.min(e, tEnd)) - sx(s)), height: rowH - 6, rx: 3, fill: kindColor[kind], opacity: 0.85 }, svg);
    }
    const axisY = top + links.length * rowH + 4;
    for (let t = 0; t <= tEnd; t += 600) {
      el("line", { x1: sx(t), x2: sx(t), y1: axisY, y2: axisY + 4, stroke: "#999" }, svg);
      el("text", { x: sx(t), y: axisY + 16, "text-anchor": "middle", "font-size": 11, fill: "#5b6370" }, svg).textContent = `${t / 60} min`;
    }
    const head = el("line", { y1: 0, y2: axisY, stroke: "#1f2328", "stroke-width": 1.5 }, svg);
    svg.addEventListener("click", (ev) => {
      const rect = svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * Wt;
      const t = Math.max(0, Math.min(tEnd, ((x - left) / (Wt - left - right)) * tEnd));
      k = Math.round(t / FRAME);
      drawFrame();
    });
    return (frame) => { const x = sx(timeOf(frame)); head.setAttribute("x1", x); head.setAttribute("x2", x); };
  })();

  function drawIncidentNow(frame) {
    const seen = new Set();
    const live = activeEvents(timeOf(frame)).filter(([l, , , kind]) => !seen.has(l + kind) && seen.add(l + kind));
    document.getElementById("incident-now").innerHTML = live.length
      ? live.map(([l, , , kind]) => `<span class="pattern-dot" style="background:${kindColor[kind]}"></span><b>Link ${l}</b><span class="note">${kindName[kind]}</span>`).join("&nbsp;&nbsp;&nbsp;")
      : `<span class="note">No incident at this moment</span>`;
  }

  // ---------- Charts ----------
  const minutes = policies.fixed.frames.map((f) => f.t / 60);
  const nTop = Math.ceil(Math.max(...policies.fixed.kpi.map((x) => x.n), ...policies.adaptive.kpi.map((x) => x.n)) / 50) * 50;
  const networkChart = lineChart(document.getElementById("chart-network"), {
    height: 250, xDomain: [0, minutes[minutes.length - 1]], yDomain: [0, nTop], xLabel: "Time (min)", yLabel: "Vehicles",
    series: [
      { x: minutes, y: policies.fixed.kpi.map((x) => x.n), color: colors.fixed, label: names.fixed },
      { x: minutes, y: policies.adaptive.kpi.map((x) => x.n), color: colors.adaptive, label: names.adaptive },
    ],
  });

  // ---------- Playback ----------
  const slider = document.getElementById("time");
  const playButton = document.getElementById("play");
  slider.max = NF - 1;
  const END = NF - 1;

  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = `${fmtClock(timeOf(k))} / ${fmtClock(timeOf(END))}`;
    for (const key of Object.keys(policies)) { drawMap(key, k); drawKpis(key, k); }
    networkChart.setReveal(k);
    timeline(k);
    drawIncidentNow(k);
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
    playButton.textContent = playing ? "Pause" : k >= END ? "Replay" : k !== START ? "Resume" : "Start";
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
