// Cloud scheduling scenario page.
(function () {
  const D = window.DGPG_CLOUD;
  const { el, lineChart } = window.Plot;
  const { t } = window.I18N;
  const N = D.meta.n_servers;
  const T = D.meta.display_steps;
  const generation = D.servers.generation;
  const policies = { baseline: D.baseline, dgpg: D.dgpg };
  const colors = { baseline: "#DD8452", dgpg: "#4C72B0", reward: "#8172B3" };
  const names = { baseline: t("Distributed heuristic"), dgpg: t("With AI control") };
  // Generations from the most to the least efficient.
  const genOrder = [2, 1, 0];
  const genNames = { 2: t("New"), 1: t("Mid"), 0: t("Old") };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const steps = range(T).map((t) => t + 1);

  const START = Math.round(T / 4);   // every scenario opens a quarter of the way in
  let k = START;
  let selected = 0;
  let playing = false;
  let speed = 4;

  // Running averages of jobs queued at servers and energy per unit of work.
  for (const p of Object.values(policies)) {
    p.meanQueued = [0];
    p.meanEnergy = [0];
    let queued = 0, energy = 0;
    p.jobs_queued.forEach((v, t) => {
      queued += v;
      energy += p.energy_per_work[t];
      p.meanQueued.push(queued / (t + 1));
      p.meanEnergy.push(energy / (t + 1));
    });
  }

  // ---------- Problem diagram ----------
  (function drawProblem() {
    const INK = "#1f2328", MUTED = "#5b6370", BLUE = "#4C72B0", SOFT = "#f6f7f9", ORANGE = "#DD8452";
    const svg = el("svg", { viewBox: "0 20 1100 236", role: "img", "aria-label": t("Problem setting"), style: "max-width:1100px;margin:0 auto" }, document.getElementById("problem-diagram"));
    const text = (x, y, s, opts) => {
      const o = Object.assign({ size: 14, color: INK, anchor: "middle", weight: "normal" }, opts);
      el("text", { x, y, "text-anchor": o.anchor, "font-size": o.size, "font-weight": o.weight, style: `fill:${o.color}` }, svg).textContent = s;
    };
    // Arriving jobs: CPU-heavy (wide) and memory-heavy (tall) boxes.
    el("rect", { x: 20, y: 50, width: 180, height: 130, rx: 12, fill: SOFT, stroke: "#d8dbe0" }, svg);
    [[40, 70, 44, 18], [92, 66, 22, 40], [124, 70, 50, 18], [44, 104, 24, 44], [78, 120, 50, 18], [138, 100, 22, 46], [40, 156, 46, 14], [100, 150, 30, 18]].forEach(([x, y, w, h]) =>
      el("rect", { x, y, width: w, height: h, rx: 3, fill: "#fff", stroke: INK, "stroke-width": 1.5 }, svg));
    text(110, 205, t("Arriving jobs"), { weight: "bold" });
    text(110, 224, t("demand rises and falls"), { color: MUTED });

    // Dispatchers, one per arriving job.
    const dispatcherY = [70, 115, 160];
    dispatcherY.forEach((y) => {
      el("path", { d: `M200,${y + 2} L268,${y + 2}`, stroke: INK, "stroke-width": 1.5 }, svg);
      el("circle", { cx: 290, cy: y + 2, r: 20, fill: "#fff", stroke: INK, "stroke-width": 2 }, svg);
      el("rect", { x: 276, y: y - 8, width: 28, height: 20, rx: 5, fill: BLUE }, svg);
      text(290, y + 7, "AI", { size: 12, color: "#fff", weight: "bold" });
      el("path", { d: `M310,${y + 2} C380,${y + 2} 400,115 470,115`, fill: "none", stroke: INK, "stroke-width": 1.5 }, svg);
    });
    text(290, 205, t("Dispatchers"), { weight: "bold" });
    text(290, 224, t("one per arriving job"), { color: MUTED });

    // Server groups with queues in front.
    el("line", { x1: 470, y1: 60, x2: 470, y2: 175, stroke: INK, "stroke-width": 5, "stroke-linecap": "round" }, svg);
    const groups = [[genNames[2], t("efficient"), 3], [genNames[1], "", 3], [genNames[0], t("slow"), 2]];
    groups.forEach(([name, sub, racks], g) => {
      const x0 = 540 + g * 190;
      el("line", { x1: 470, y1: 115, x2: x0 - 20, y2: 115, stroke: INK, "stroke-width": 1.5 }, svg);
      for (let q = 0; q < (g === 2 ? 5 : 1); q++) el("rect", { x: x0 - 16 + q * 7, y: 150 - q * 0, width: 5, height: 12, fill: ORANGE }, svg);
      for (let r = 0; r < racks; r++) {
        const x = x0 + 14 + r * 36;
        el("rect", { x, y: 70, width: 30, height: 80, rx: 3, fill: "#fff", stroke: INK, "stroke-width": 1.6 }, svg);
        for (let j = 0; j < 5; j++) el("rect", { x: x + 5, y: 77 + j * 14, width: 20, height: 8, rx: 1.5, fill: "none", stroke: INK, "stroke-width": 1 }, svg);
      }
      text(x0 + 55, 182, name + (sub ? ` · ${sub}` : ""), { weight: "bold" });
    });
    text(785, 224, t("Servers differ in capacity and efficiency; jobs queue when a server is full"), { color: MUTED });
  })();

  // ---------- Server panels: utilization (bottom) and queued jobs (top) ----------
  // Queue bars are full at QUEUE_FULL jobs.
  const QUEUE_FULL = 20;
  const labelW = 64, colW = 16, barW = 11, half = 34, rowGap = 14;
  const rowsByGen = genOrder.map((g) => range(N).filter((i) => generation[i] === g));
  const panelWidth = labelW + Math.max(...rowsByGen.map((r) => r.length)) * colW;
  const rowH = 2 * half + 4;
  const panels = {};
  for (const key of Object.keys(policies)) {
    const svg = el("svg", { viewBox: `0 0 ${panelWidth} ${rowsByGen.length * (rowH + rowGap)}`, role: "img", "aria-label": t("Server utilization and queues"), style: `max-width:${panelWidth}px` }, document.getElementById("servers-" + key));
    const util = [], queue = [], count = [];
    rowsByGen.forEach((members, r) => {
      const y0 = r * (rowH + rowGap);
      el("text", { x: 0, y: y0 + half + 6, class: "legend-label" }, svg).textContent = genNames[genOrder[r]];
      el("text", { x: 0, y: y0 + half + 22, class: "tick-label", style: "fill:#5b6370" }, svg).textContent = t("{n} servers", { n: members.length });
      members.forEach((i, c) => {
        const x = labelW + c * colW;
        el("rect", { x, y: y0, width: barW, height: half, fill: "#fdf5ef" }, svg);
        el("rect", { x, y: y0 + half + 4, width: barW, height: half, fill: "#f0f2f5" }, svg);
        queue[i] = el("rect", { x, width: barW, fill: "#DD8452" }, svg);
        util[i] = el("rect", { x, width: barW, fill: "var(--bar)" }, svg);
        count[i] = { y0 };
      });
    });
    panels[key] = { util, queue, count };
  }
  function drawServers(key) {
    const p = policies[key];
    const { util, queue, count } = panels[key];
    const row = k === 0 ? null : k - 1;
    for (let i = 0; i < N; i++) {
      const y0 = count[i].y0;
      const u = row === null ? 0 : p.util[row][i];
      const q = row === null ? 0 : Math.min(1, p.queue[row][i] / QUEUE_FULL);
      util[i].setAttribute("y", y0 + half + 4 + half * (1 - u));
      util[i].setAttribute("height", half * u);
      queue[i].setAttribute("y", y0 + half * (1 - q));
      queue[i].setAttribute("height", half * q);
    }
  }

  // ---------- KPIs ----------
  const reduction = (key, series) => {
    if (key === "baseline" || k === 0 || D.baseline[series][k] <= 0) return "";
    const change = 100 * (1 - D.dgpg[series][k] / D.baseline[series][k]);
    return `<em class="delta${change >= 0 ? "" : " worse"}">${t("{change} % vs heuristic", { change: `${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)}` })}</em>`;
  };
  function drawKpis(key) {
    const p = policies[key];
    const now = k === 0 ? 0 : p.jobs_queued[k - 1];
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>${t("Jobs queued at servers")}</span><strong>${now.toFixed(0)}</strong></div>` +
      `<div class="kpi"><span>${t("Mean jobs queued so far")}</span><strong>${p.meanQueued[k].toFixed(1)}</strong>${reduction(key, "meanQueued")}</div>` +
      `<div class="kpi"><span>${t("Energy per unit of work so far")}</span><strong>${k === 0 ? "–" : p.meanEnergy[k].toFixed(3)}</strong>${reduction(key, "meanEnergy")}</div>`;
  }

  // ---------- Time-series charts ----------
  const xDomain = [0, T];
  const queuedChart = lineChart(document.getElementById("chart-queued"), {
    xDomain, xLabel: t("Step"), yLabel: t("Jobs queued at servers"),
    series: [
      { x: steps, y: D.baseline.jobs_queued, color: colors.baseline, label: names.baseline },
      { x: steps, y: D.dgpg.jobs_queued, color: colors.dgpg, label: names.dgpg },
    ],
  });
  const energyChart = lineChart(document.getElementById("chart-energy"), {
    xDomain, xLabel: t("Step"), yLabel: t("Energy per unit of work"), yFormat: (v) => v.toFixed(3),
    series: [
      { x: steps, y: D.baseline.energy_per_work, color: colors.baseline, label: names.baseline },
      { x: steps, y: D.dgpg.energy_per_work, color: colors.dgpg, label: names.dgpg },
    ],
  });
  const cut = (series) => (100 * (1 - D.dgpg[series][T] / D.baseline[series][T])).toFixed(0);
  // Mean utilization of one server generation over the replay, in percent.
  const genUtil = (key, g) => {
    const members = range(N).filter((i) => generation[i] === g);
    let sum = 0;
    for (const row of policies[key].util) for (const i of members) sum += row[i];
    return ((100 * sum) / (members.length * policies[key].util.length)).toFixed(0);
  };
  document.getElementById("outcome").textContent =
    t("Over {steps} steps, AI control moves work from old servers (utilization {oldBefore} % → {oldAfter} %) to new servers ({newBefore} % → {newAfter} %), with {queued} % fewer jobs queued at servers and {energy} % lower energy per unit of work.", {
      steps: T, oldBefore: genUtil("baseline", 0), oldAfter: genUtil("dgpg", 0), newBefore: genUtil("baseline", 2), newAfter: genUtil("dgpg", 2),
      queued: cut("meanQueued"), energy: cut("meanEnergy"),
    });

  // ---------- Training: shared advantage and guidance per dispatcher ----------
  const S = D.signals;
  const A = S.shared_advantage.slice(0, T);
  const nActive = S.n_active.slice(0, T);
  const guidance = S.guidance.slice(0, T).map((row) => row.map((v) => -v));
  const forDispatcher = (i) => guidance.map((row) => (i < row.length ? row[i] : 0));
  const sharedFor = (i) => A.map((v, t) => (i < nActive[t] ? v : 0));
  const symmetric = (values) => {
    let m = 0;
    for (const v of values) m = Math.max(m, Math.abs(v));
    m = 1.08 * (m || 1);
    return [-m, m];
  };
  const signalCharts = [
    lineChart(document.getElementById("chart-signal-reward"), {
      height: 190, xDomain, yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true,
      series: [{ x: steps, y: [], color: colors.reward, label: t("Shared advantage A(t), same for all dispatchers"), width: 1.1, static: true }],
    }),
    lineChart(document.getElementById("chart-signal-guide"), {
      height: 210, xDomain, yDomain: [-1, 1], xLabel: t("Step"), yLabel: "−ĝᵢ(t)", zeroLine: true,
      series: [{ x: steps, y: [], color: colors.dgpg, label: t("Guidance −ĝᵢ(t) of this dispatcher"), width: 1.1, static: true }],
    }),
  ];
  const barCharts = [
    lineChart(document.getElementById("chart-bars-reward"), {
      height: 190, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.reward, label: t("Shared advantage A(t)") }],
    }),
    lineChart(document.getElementById("chart-bars-guide"), {
      height: 210, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], xLabel: t("Dispatcher"), yLabel: "−ĝᵢ(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.dgpg, label: t("Guidance −ĝᵢ(t)") }],
    }),
  ];
  const bw = barCharts[0].w / N;
  const barRects = barCharts.map((chart, c) => range(N).map((i) => {
    const rect = el("rect", { width: bw * 0.7, fill: c === 0 ? colors.reward : colors.dgpg, style: "cursor:pointer" }, chart.dataLayer);
    el("title", {}, rect).textContent = t("Dispatcher {n}", { n: i + 1 });
    rect.addEventListener("click", () => selectDispatcher(i));
    return rect;
  }));
  const stepInput = document.getElementById("signal-step");
  stepInput.max = T - 1;
  stepInput.value = Math.floor(T / 4);
  function drawSignals() {
    const s = +stepInput.value;
    document.getElementById("signal-step-out").textContent = `${s + 1}`;
    document.getElementById("signal-title").textContent = t("Dispatcher {n} during training", { n: selected + 1 });
    [sharedFor(selected), forDispatcher(selected)].forEach((values, c) => {
      signalCharts[c].setYDomain(symmetric(values));
      signalCharts[c].setSeries(0, steps, values);
      signalCharts[c].setCursor(s + 1);
    });
    const active = nActive[s];
    [range(N).map((i) => (i < active ? A[s] : 0)), range(N).map((i) => (i < active ? guidance[s][i] : 0))].forEach((values, c) => {
      const chart = barCharts[c];
      chart.setYDomain(symmetric(values));
      const y0 = chart.sy(0);
      values.forEach((v, i) => {
        const y = chart.sy(v);
        const rect = barRects[c][i];
        rect.setAttribute("x", chart.sx(i + 1) - bw * 0.35);
        rect.setAttribute("y", Math.min(y, y0));
        rect.setAttribute("height", Math.abs(y - y0));
        rect.setAttribute("opacity", i === selected ? 1 : 0.55);
      });
    });
  }
  // Share of each signal's variance that differs between dispatchers at the same step.
  function spreadShare(rows) {
    const flat = rows.flat();
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    const total = flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length;
    let within = 0;
    for (const row of rows) {
      const m = row.reduce((s, v) => s + v, 0) / row.length;
      within += row.reduce((s, v) => s + (v - m) ** 2, 0) / row.length;
    }
    return 100 * (within / rows.length) / total;
  }
  const activeRows = (values) => values.map((v, t) => (Array.isArray(v) ? v : new Array(nActive[t]).fill(v))).filter((row) => row.length > 0);
  document.getElementById("spread-note").textContent =
    t("Variation that differs between dispatchers: A {a} %, ĝᵢ {g} %.", { a: spreadShare(activeRows(A)).toFixed(1), g: spreadShare(activeRows(guidance)).toFixed(1) });
  stepInput.addEventListener("input", drawSignals);
  function selectDispatcher(i) {
    selected = i;
    drawSignals();
  }

  // ---------- Learning progress ----------
  const curve = D.evaluation_curve;
  const heuristic = D.meta.baseline_test;
  const lastEpisode = curve[curve.length - 1].episode;
  const curveSpecs = [
    ["chart-curve-queued", "jobs_queued", t("Mean jobs queued")],
    ["chart-curve-energy", "energy_per_work", t("Energy per unit of work")],
  ];
  const curveCharts = curveSpecs.map(([id, field, label], c) => {
    const values = curve.map((row) => row[field]).concat(heuristic[field]);
    const lo = field === "jobs_queued" ? 0 : Math.floor(Math.min(...values) * 100) / 100 - 0.01;
    const hi = field === "jobs_queued" ? Math.ceil((Math.max(...values) * 1.1) / 5) * 5 : Math.ceil(Math.max(...values) * 100) / 100 + 0.01;
    const chart = lineChart(document.getElementById(id), {
      height: 200, xDomain: [0, lastEpisode], yDomain: [lo, hi], xLabel: c === 1 ? t("Training episode") : "", yLabel: label,
      yFormat: field === "jobs_queued" ? undefined : (v) => v.toFixed(2),
      series: [
        { x: curve.map((row) => row.episode), y: curve.map((row) => row[field]), color: colors.dgpg, label: names.dgpg, static: true },
        { x: [0, lastEpisode], y: [heuristic[field], heuristic[field]], color: colors.baseline, dash: "5 4", label: names.baseline, static: true },
      ],
    });
    curve.forEach((row) => el("circle", { cx: chart.sx(row.episode), cy: chart.sy(row[field]), r: 3, fill: colors.dgpg }, chart.dataLayer));
    chart.marker = el("circle", { r: 6.5, fill: "none", stroke: "#1f2328", "stroke-width": 1.6 }, chart.dataLayer);
    chart.field = field;
    return chart;
  });
  document.getElementById("curve-note").textContent =
    t("Mean over the first {steps} steps of 10 test scenarios.", { steps: T });

  // The vertical scale follows the selected episode; early policies queue thousands of jobs.
  const progressTop = (item) => Math.ceil((Math.max(...D.baseline.jobs_queued, ...item.jobs_queued) * 1.05) / 10) * 10;
  const progressChart = lineChart(document.getElementById("chart-progress"), {
    xDomain, yDomain: [0, progressTop(D.progress[0])], xLabel: t("Step"), yLabel: t("Jobs queued at servers"),
    series: [
      { x: steps, y: D.baseline.jobs_queued, color: colors.baseline, label: names.baseline, opacity: 0.7, static: true },
      { x: steps, y: D.progress[0].jobs_queued, color: colors.dgpg, label: t("AI after this episode"), static: true },
    ],
  });
  const episodeInput = document.getElementById("episode");
  episodeInput.max = D.progress.length - 1;
  function drawProgress() {
    const item = D.progress[+episodeInput.value];
    progressChart.setYDomain([0, progressTop(item)]);
    progressChart.setSeries(1, steps, item.jobs_queued);
    const row = curve.find((c) => c.episode === item.episode);
    for (const chart of curveCharts) {
      chart.marker.setAttribute("cx", chart.sx(item.episode));
      chart.marker.setAttribute("cy", chart.sy(row[chart.field]));
    }
    document.getElementById("episode-out").textContent = `${item.episode}`;
  }
  episodeInput.addEventListener("input", drawProgress);

  // ---------- Playback ----------
  const slider = document.getElementById("time");
  const playButton = document.getElementById("play");
  slider.max = T;
  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = t("Step {k} / {total}", { k, total: T });
    for (const key of Object.keys(policies)) { drawServers(key); drawKpis(key); }
    queuedChart.setReveal(k - 1);
    energyChart.setReveal(k - 1);
  }
  let last = null, carry = 0;
  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      carry += ((now - last) / 1000) * 10 * speed;
      const advance = Math.floor(carry);
      carry -= advance;
      k = Math.min(T, k + advance);
      drawFrame();
      if (k >= T) { setPlaying(false); return; }
    }
    last = now;
    requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value;
    playButton.textContent = t(playing ? "Pause" : k >= T ? "Replay" : k !== START ? "Resume" : "Start");
    if (playing) {
      if (k >= T) k = START;
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

  // Default selection: the dispatcher whose guidance varies most during training.
  let bestVar = -1;
  for (let i = 0; i < N; i++) {
    const col = forDispatcher(i);
    const m = col.reduce((s, v) => s + v, 0) / col.length;
    const v = col.reduce((s, x) => s + (x - m) ** 2, 0);
    if (v > bestVar) { bestVar = v; selected = i; }
  }

  drawFrame();
  drawSignals();
  drawProgress();
})();
