// Power generation scenario page.
(function () {
  const D = window.DGPG_POWER;
  const { el, lineChart } = window.Plot;
  const N = D.meta.n_generators;
  // Show the first 20 minutes of the test disturbance.
  const H = D.meta.horizon_steps;
  const T = Math.round((20 * 60) / D.meta.control_dt);
  const trim = (record) => {
    for (const [name, values] of Object.entries(record)) {
      if (!Array.isArray(values)) continue;
      if (values.length === H + 1) record[name] = values.slice(0, T + 1);
      else if (values.length === H) record[name] = values.slice(0, T);
    }
  };
  [D.baseline, D.dgpg, D.signals, ...D.progress].forEach(trim);
  const dt = D.meta.control_dt;
  const pMin = D.generators.p_min;
  const pMax = D.generators.p_max;
  const costA = D.generators.cost_a;
  const costB = D.generators.cost_b;
  const archetype = D.generators.archetype;
  const policies = { baseline: D.baseline, dgpg: D.dgpg };
  const colors = { baseline: "#DD8452", dgpg: "#4C72B0", reward: "#8172B3" };
  const names = { baseline: "Without control", dgpg: "With AI control" };

  const minutes = (k) => (k * dt) / 60;
  const stateTimes = Array.from({ length: T + 1 }, (_, k) => minutes(k));
  const stepTimes = Array.from({ length: T }, (_, k) => minutes(k + 1));
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const fmtClock = (k) => {
    const s = Math.round(k * dt);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  };

  const START = Math.round(T / 4);   // every scenario opens a quarter of the way in
  let k = START;
  let selected = 0;
  let playing = false;
  let speed = 4;

  // Running averages of extra cost and RMS frequency deviation.
  for (const p of Object.values(policies)) {
    p.meanExtra = [0];
    let extra = 0;
    p.regret_percent.forEach((v, t) => {
      extra += v;
      p.meanExtra.push(extra / (t + 1));
    });
    p.rmsFrequency = [];
    let square = 0;
    p.frequency_mhz.forEach((v, t) => {
      square += v * v;
      p.rmsFrequency.push(Math.sqrt(square / (t + 1)));
    });
  }

  // ---------- Problem diagram ----------
  (function drawProblem() {
    const INK = "#1f2328", MUTED = "#5b6370", BLUE = "#4C72B0", SOFT = "#f6f7f9";
    const svg = el("svg", { viewBox: "0 20 1100 236", role: "img", "aria-label": "Problem setting", style: "max-width:1100px;margin:0 auto" }, document.getElementById("problem-diagram"));
    const text = (x, y, s, opts) => {
      const o = Object.assign({ size: 14, color: INK, anchor: "middle", weight: "normal" }, opts);
      el("text", { x, y, "text-anchor": o.anchor, "font-size": o.size, "font-weight": o.weight, style: `fill:${o.color}` }, svg).textContent = s;
    };

    // Load source: wind and demand.
    el("rect", { x: 20, y: 50, width: 180, height: 130, rx: 12, fill: SOFT, stroke: "#d8dbe0" }, svg);
    el("path", { d: "M70,164 L73,104 L67,104 Z", fill: INK }, svg);
    for (const angle of [90, 210, 330]) {
      el("path", { d: "M70,100 C66,88 68,74 70,66 C72,74 74,88 70,100 Z", fill: INK, transform: `rotate(${angle - 90} 70 100)` }, svg);
    }
    el("circle", { cx: 70, cy: 100, r: 3.5, fill: "#fff", stroke: INK, "stroke-width": 1.5 }, svg);
    el("path", { d: "M118,164 L118,126 L138,110 L158,126 L158,164 Z", fill: "#fff", stroke: INK, "stroke-width": 1.8, "stroke-linejoin": "round" }, svg);
    el("rect", { x: 132, y: 140, width: 12, height: 24, fill: "#fff", stroke: INK, "stroke-width": 1.5 }, svg);
    text(110, 205, "Wind and demand", { weight: "bold" });
    text(110, 224, "net load fluctuates", { color: MUTED });

    // Shared grid bus with its frequency.
    const busY = 115;
    el("path", { d: `M200,${busY} L236,${busY}`, stroke: INK, "stroke-width": 2, "marker-end": "none" }, svg);
    el("line", { x1: 240, y1: busY, x2: 1070, y2: busY, stroke: INK, "stroke-width": 6, "stroke-linecap": "round" }, svg);
    el("rect", { x: 560, y: 46, width: 220, height: 34, rx: 17, fill: "#fff", stroke: INK, "stroke-width": 1.5 }, svg);
    el("path", { d: "M580,63 q6,-10 12,0 t12,0", fill: "none", stroke: BLUE, "stroke-width": 2 }, svg);
    text(686, 68, "Shared frequency 50 Hz", { weight: "bold" });
    el("line", { x1: 670, y1: 80, x2: 670, y2: busY - 3, stroke: INK, "stroke-width": 1.5, "stroke-dasharray": "3 3" }, svg);

    // Heterogeneous generators, each with its own AI controller and cost level.
    const units = [[26, "$"], [24, "$"], [22, "$$"], [18, "$$"], [15, "$$$"], [13, "$$$$"]];
    units.forEach(([r, cost], j) => {
      const x = 300 + j * 125;
      const cy = 175;
      el("line", { x1: x, y1: busY, x2: x, y2: cy - r, stroke: INK, "stroke-width": 2 }, svg);
      el("circle", { cx: x, cy, r, fill: "#fff", stroke: INK, "stroke-width": 2 }, svg);
      const w = r * 0.5;
      el("path", { d: `M${x - w},${cy} q${w / 2},${-w * 0.9} ${w},0 t${w},0`, fill: "none", stroke: INK, "stroke-width": 1.8 }, svg);
      el("rect", { x: x + r + 6, y: cy - r - 4, width: 28, height: 20, rx: 5, fill: BLUE }, svg);
      text(x + r + 20, cy - r + 11, "AI", { size: 12, color: "#fff", weight: "bold" });
      text(x, cy + r + 20, cost, { color: MUTED });
    });
    text(1048, 180, "…", { size: 20, color: MUTED });
    text(612, 250, "Generators differ in capacity, cost and ramp speed; each one is a decision maker", { color: MUTED });
  })();

  // ---------- Cost classes: generator types ordered by marginal cost at the start ----------
  const typeCost = range(5).map((a) => {
    const members = range(N).filter((i) => archetype[i] === a);
    return members.reduce((s, i) => s + 2 * costA[i] * D.baseline.power[0][i] + costB[i], 0) / members.length;
  });
  const typeOrder = range(5).sort((x, y) => typeCost[x] - typeCost[y]);
  const classMembers = typeOrder.map((a) => range(N).filter((i) => archetype[i] === a));
  const classNames = ["Cheapest", "Class 2", "Class 3", "Class 4", "Costliest"];
  const classColors = ["#c9d4e5", "#9fb3d1", "#f2c7a5", "#e39a73", "#C44E52"];
  for (const p of Object.values(policies)) {
    p.classOutput = p.power.map((row) => classMembers.map((m) => m.reduce((s, i) => s + row[i], 0)));
  }

  // Reduction relative to no control, shown under the AI values.
  const reduction = (key, series) => {
    if (key === "baseline" || k === 0 || D.baseline[series][k] <= 0) return "";
    const change = 100 * (1 - D.dgpg[series][k] / D.baseline[series][k]);
    return `<em class="delta">${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)} % vs no control</em>`;
  };
  function drawKpis(key) {
    const p = policies[key];
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>Frequency deviation</span><strong>${p.frequency_mhz[k].toFixed(1)} mHz</strong></div>` +
      `<div class="kpi"><span>RMS frequency deviation so far</span><strong>${p.rmsFrequency[k].toFixed(1)} mHz</strong>${reduction(key, "rmsFrequency")}</div>` +
      `<div class="kpi"><span>Extra cost so far</span><strong>${p.meanExtra[k].toFixed(2)} %</strong>${reduction(key, "meanExtra")}</div>`;
  }

  // ---------- Time-series charts ----------
  const xDomain = [0, minutes(T)];
  // Generation stacked by cost class, cheapest at the bottom; the load line sits on top.
  const generationTop = Math.ceil(Math.max(...D.baseline.load) + 0.5);
  function generationChart(key) {
    const chart = lineChart(document.getElementById("chart-gen-" + key), {
      xDomain, yDomain: [0, generationTop], xLabel: "Time (min)", yLabel: "Generation (p.u.)",
      series: [
        ...classNames.map((name, c) => ({ x: [], y: [], color: classColors[c], label: name, width: 6 })),
        { x: stateTimes, y: policies[key].load, color: "#1f2328", label: "Load", width: 1.2 },
      ],
    });
    const layer = el("g", {});
    chart.dataLayer.insertBefore(layer, chart.dataLayer.firstChild);
    const areas = classNames.map((_, c) => el("path", { fill: classColors[c], stroke: "none" }, layer));
    chart.drawAreas = (upto) => {
      const rows = policies[key].classOutput;
      const n = Math.min(rows.length, upto + 1);
      let lower = new Array(n).fill(0);
      areas.forEach((area, c) => {
        const upper = lower.map((v, t) => v + rows[t][c]);
        let d = "";
        for (let t = 0; t < n; t++) d += (t ? "L" : "M") + chart.sx(stateTimes[t]).toFixed(1) + "," + chart.sy(upper[t]).toFixed(1);
        for (let t = n - 1; t >= 0; t--) d += "L" + chart.sx(stateTimes[t]).toFixed(1) + "," + chart.sy(lower[t]).toFixed(1);
        area.setAttribute("d", n > 0 ? d + "Z" : "");
        lower = upper;
      });
    };
    return chart;
  }
  const generationCharts = [generationChart("baseline"), generationChart("dgpg")];
  const freqChart = lineChart(document.getElementById("chart-frequency"), {
    xDomain, xLabel: "Time (min)", yLabel: "Frequency deviation (mHz)", zeroLine: true,
    series: [
      { x: stateTimes, y: D.baseline.frequency_mhz, color: colors.baseline, label: names.baseline },
      { x: stateTimes, y: D.dgpg.frequency_mhz, color: colors.dgpg, label: names.dgpg },
    ],
  });
  const costChart = lineChart(document.getElementById("chart-cost"), {
    xDomain, xLabel: "Time (min)", yLabel: "Extra cost (%)",
    series: [
      { x: stepTimes, y: D.baseline.regret_percent, color: colors.baseline, label: names.baseline },
      { x: stepTimes, y: D.dgpg.regret_percent, color: colors.dgpg, label: names.dgpg },
    ],
  });
  const cut = (series) => (100 * (1 - D.dgpg[series][T] / D.baseline[series][T])).toFixed(0);
  document.getElementById("outcome").textContent =
    `Over 20 minutes, AI control lowers the RMS frequency deviation by ${cut("rmsFrequency")} % and the extra cost by ${cut("meanExtra")} %.`;

  // ---------- Training: shared score and individual signal ----------
  const S = D.signals;
  const individual = S.guidance.map((row) => row.map((v) => -v));
  const column = (matrix, i) => matrix.map((row) => row[i]);
  const symmetric = (values) => {
    let m = 0;
    for (const v of values) m = Math.max(m, Math.abs(v));
    m = 1.08 * (m || 1);
    return [-m, m];
  };
  const signalCharts = [
    lineChart(document.getElementById("chart-signal-reward"), {
      height: 190, xDomain, yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true,
      series: [{ x: stepTimes, y: [], color: colors.reward, label: "Shared advantage A(t), same for all generators", width: 1.1, static: true }],
    }),
    lineChart(document.getElementById("chart-signal-guide"), {
      height: 210, xDomain, yDomain: [-1, 1], xLabel: "Time (min)", yLabel: "−ĝᵢ(t)", zeroLine: true,
      series: [{ x: stepTimes, y: [], color: colors.dgpg, label: "Guidance −ĝᵢ(t) of this generator", width: 1.1, static: true }],
    }),
  ];
  const signalMatrices = [S.reward_advantage, individual];
  const barCharts = [
    lineChart(document.getElementById("chart-bars-reward"), {
      height: 190, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.reward, label: "Shared advantage A(t)" }],
    }),
    lineChart(document.getElementById("chart-bars-guide"), {
      height: 210, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], xLabel: "Generator", yLabel: "−ĝᵢ(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.dgpg, label: "Guidance −ĝᵢ(t)" }],
    }),
  ];
  const bw = barCharts[0].w / N;
  const barRects = barCharts.map((chart, c) => range(N).map((i) => {
    const rect = el("rect", { width: bw * 0.7, fill: c === 0 ? colors.reward : colors.dgpg, style: "cursor:pointer" }, chart.dataLayer);
    el("title", {}, rect).textContent = `Generator ${i + 1}`;
    rect.addEventListener("click", () => select(i));
    return rect;
  }));
  const stepInput = document.getElementById("signal-step");
  stepInput.max = T - 1;
  stepInput.value = Math.floor(T / 4);
  function drawSignals() {
    const s = +stepInput.value;
    document.getElementById("signal-step-out").textContent = fmtClock(s + 1);
    document.getElementById("signal-title").textContent = `Generator ${selected + 1} during training`;
    signalCharts.forEach((chart, c) => {
      const values = column(signalMatrices[c], selected);
      chart.setYDomain(symmetric(values));
      chart.setSeries(0, stepTimes, values);
      chart.setCursor(minutes(s + 1));
    });
    barCharts.forEach((chart, c) => {
      const values = signalMatrices[c][s];
      chart.setYDomain(symmetric(values));
      const y0 = chart.sy(0);
      for (let i = 0; i < N; i++) {
        const y = chart.sy(values[i]);
        const rect = barRects[c][i];
        rect.setAttribute("x", chart.sx(i + 1) - bw * 0.35);
        rect.setAttribute("y", Math.min(y, y0));
        rect.setAttribute("height", Math.abs(y - y0));
        rect.setAttribute("opacity", i === selected ? 1 : 0.55);
      }
    });
  }
  // Share of each signal's variance that differs between generators at the same time.
  function spreadShare(matrix) {
    const flat = matrix.flat();
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    const total = flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length;
    let within = 0;
    for (const row of matrix) {
      const m = row.reduce((s, v) => s + v, 0) / row.length;
      within += row.reduce((s, v) => s + (v - m) ** 2, 0) / row.length;
    }
    return 100 * (within / matrix.length) / total;
  }
  document.getElementById("spread-note").textContent =
    `Variation that differs between generators: A ${spreadShare(S.reward_advantage).toFixed(1)} %, ĝᵢ ${spreadShare(individual).toFixed(1)} %.`;
  stepInput.addEventListener("input", drawSignals);

  // ---------- Learning progress: RMS frequency deviation and extra cost per checkpoint ----------
  const curve = D.evaluation_curve;
  const curveSpecs = [
    ["chart-curve-frequency", "frequency_rms_mhz", D.meta.baseline_test_frequency_rms_mhz, "RMS frequency dev. (mHz)"],
    ["chart-curve-cost", "extra_cost_percent", D.meta.baseline_test_extra_cost_percent, "Extra cost (%)"],
  ];
  const curveCharts = curveSpecs.map(([id, field, noControl, label], c) => {
    const top = Math.max(...curve.map((row) => row[field]), noControl);
    const chart = lineChart(document.getElementById(id), {
      height: 200, xDomain: [0, 50], yDomain: [0, Math.ceil(top)], xLabel: c === 1 ? "Training episode" : "", yLabel: label,
      series: [
        { x: curve.map((row) => row.episode), y: curve.map((row) => row[field]), color: colors.dgpg, label: names.dgpg, static: true },
        { x: [0, 50], y: [noControl, noControl], color: colors.baseline, dash: "5 4", label: names.baseline, static: true },
      ],
    });
    curve.forEach((row) => el("circle", { cx: chart.sx(row.episode), cy: chart.sy(row[field]), r: 3, fill: colors.dgpg }, chart.dataLayer));
    chart.marker = el("circle", { r: 6.5, fill: "none", stroke: "#1f2328", "stroke-width": 1.6 }, chart.dataLayer);
    chart.field = field;
    return chart;
  });
  const firstBelow = curve.find((row) => curveSpecs.every(([, field, noControl]) => row[field] < noControl));
  document.getElementById("curve-note").textContent =
    `Mean of the first ${D.meta.display_minutes} minutes of 10 test disturbances. Better than no control on both after ${firstBelow ? firstBelow.episode : "–"} episodes.`;

  // One-minute moving average of the extra cost.
  const smooth = (values, width = 30) => values.map((_, t) => {
    const from = Math.max(0, t - width + 1);
    let sum = 0;
    for (let j = from; j <= t; j++) sum += values[j];
    return sum / (t - from + 1);
  });
  const progressCost = D.progress.map((item) => smooth(item.regret_percent));
  const baselineCost = smooth(D.baseline.regret_percent);
  const costMax = Math.max(...progressCost.flat(), ...baselineCost);
  const progressChart = lineChart(document.getElementById("chart-progress"), {
    xDomain, yDomain: [0, Math.ceil(costMax)], xLabel: "Time (min)", yLabel: "Extra cost, 1-min avg. (%)",
    series: [
      { x: stepTimes, y: baselineCost, color: colors.baseline, label: names.baseline, opacity: 0.7, static: true },
      { x: stepTimes, y: progressCost[0], color: colors.dgpg, label: "AI after this episode", static: true },
    ],
  });
  const episodeInput = document.getElementById("episode");
  episodeInput.max = D.progress.length - 1;
  function drawProgress() {
    const index = +episodeInput.value;
    const item = D.progress[index];
    progressChart.setSeries(1, stepTimes, progressCost[index]);
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

  function select(i) {
    selected = i;
    drawFrame();
    drawSignals();
  }

  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = `${fmtClock(k)} / ${fmtClock(T)}`;
    for (const key of Object.keys(policies)) drawKpis(key);
    freqChart.setReveal(k);
    for (const c of generationCharts) { c.setReveal(k); c.drawAreas(k); }
    costChart.setReveal(k - 1);
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
    playButton.textContent = playing ? "Pause" : k >= T ? "Replay" : k !== START ? "Resume" : "Start";
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

  // Default selection: the generator whose individual signal varies most during training.
  let bestVar = -1;
  for (let i = 0; i < N; i++) {
    const col = column(individual, i);
    const m = col.reduce((s, v) => s + v, 0) / col.length;
    const v = col.reduce((s, x) => s + (x - m) ** 2, 0);
    if (v > bestVar) { bestVar = v; selected = i; }
  }


  drawFrame();
  drawSignals();
  drawProgress();
})();
