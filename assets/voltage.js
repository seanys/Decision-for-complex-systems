// Distribution voltage control scenario page.
(function () {
  const D = window.DGPG_VOLTAGE;
  const { el, lineChart } = window.Plot;
  const N = D.meta.n_inverters;
  const B = D.meta.n_buses;
  const T = D.meta.horizon_steps;
  const step = D.meta.step_minutes;
  const policies = { baseline: D.baseline, dgpg: D.dgpg };
  const colors = { baseline: "#DD8452", dgpg: "#4C72B0", reward: "#8172B3", pv: "#CCB974", load: "#1f2328" };
  const names = { baseline: "Without control", dgpg: "With AI control" };
  const vUpper = D.meta.v_upper, vLower = D.meta.v_lower;

  const hours = (k) => (D.meta.start_minutes + k * step) / 60;
  const times = Array.from({ length: T }, (_, k) => hours(k));
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const fmtClock = (k) => {
    const m = D.meta.start_minutes + k * step;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  };
  const xDomain = [hours(0), hours(T)];
  const hourTick = (v) => String(Math.round(v)).padStart(2, "0") + ":00";
  const voltTick = (v) => v.toFixed(2);

  let k = 0;
  let selected = 0;
  let playing = false;
  let speed = 4;

  // Share of bus-time outside the band, accumulated over the day.
  for (const p of Object.values(policies)) {
    p.outsideSoFar = [];
    let sum = 0;
    p.out_of_band_percent.forEach((v, t) => { sum += v; p.outsideSoFar.push(sum / (t + 1)); });
  }

  const date = new Date(D.meta.display_day + "T00:00:00");
  document.getElementById("day-note").textContent =
    `A clear summer day (${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}), 06:00 to 18:00, on a ${B}-bus distribution network with ${N} rooftop PV inverters. The day was not used in training.`;

  // ---------- Problem diagram ----------
  (function drawProblem() {
    const INK = "#1f2328", MUTED = "#5b6370", BLUE = "#4C72B0", SOFT = "#f6f7f9", SUN = "#CCB974";
    const svg = el("svg", { viewBox: "0 20 1100 240", role: "img", "aria-label": "Problem setting", style: "max-width:1100px;margin:0 auto" }, document.getElementById("problem-diagram"));
    const text = (x, y, s, opts) => {
      const o = Object.assign({ size: 14, color: INK, anchor: "middle", weight: "normal" }, opts);
      el("text", { x, y, "text-anchor": o.anchor, "font-size": o.size, "font-weight": o.weight, style: `fill:${o.color}` }, svg).textContent = s;
    };

    // Substation and grid connection.
    el("rect", { x: 20, y: 60, width: 170, height: 120, rx: 12, fill: SOFT, stroke: "#d8dbe0" }, svg);
    el("circle", { cx: 92, cy: 110, r: 18, fill: "#fff", stroke: INK, "stroke-width": 2 }, svg);
    el("circle", { cx: 116, cy: 110, r: 18, fill: "none", stroke: INK, "stroke-width": 2 }, svg);
    text(105, 205, "Substation", { weight: "bold" });
    text(105, 224, "fixed voltage 1.0 p.u.", { color: MUTED });

    // Feeder with houses, voltage rising towards the end.
    const feederY = 110;
    el("line", { x1: 134, y1: feederY, x2: 1040, y2: feederY, stroke: INK, "stroke-width": 5, "stroke-linecap": "round" }, svg);
    const sunX = 1000, sunY = 50;
    el("circle", { cx: sunX, cy: sunY, r: 14, fill: SUN }, svg);
    for (let a = 0; a < 8; a++) {
      const r1 = 19, r2 = 26, t = (a * Math.PI) / 4;
      el("line", { x1: sunX + r1 * Math.cos(t), y1: sunY + r1 * Math.sin(t), x2: sunX + r2 * Math.cos(t), y2: sunY + r2 * Math.sin(t), stroke: SUN, "stroke-width": 2.4, "stroke-linecap": "round" }, svg);
    }
    range(6).forEach((j) => {
      const x = 270 + j * 135;
      const top = feederY + 34;
      el("line", { x1: x, y1: feederY, x2: x, y2: top, stroke: INK, "stroke-width": 2 }, svg);
      el("path", { d: `M${x - 26},${top + 48} L${x - 26},${top + 18} L${x},${top} L${x + 26},${top + 18} L${x + 26},${top + 48} Z`, fill: "#fff", stroke: INK, "stroke-width": 1.8, "stroke-linejoin": "round" }, svg);
      el("path", { d: `M${x - 4},${top + 3} L${x + 24},${top + 19} L${x + 24},${top + 25} L${x - 4},${top + 9} Z`, fill: BLUE, opacity: 0.85 }, svg);
      el("rect", { x: x + 32, y: top + 20, width: 28, height: 20, rx: 5, fill: BLUE }, svg);
      text(x + 46, top + 35, "AI", { size: 12, color: "#fff", weight: "bold" });
    });
    // Voltage profile above the feeder: rises with solar export.
    let d = "";
    for (let x = 150; x <= 1030; x += 10) {
      const y = 92 - 42 * Math.pow((x - 150) / 880, 1.3);
      d += (x === 150 ? "M" : "L") + x + "," + y.toFixed(1);
    }
    el("path", { d, fill: "none", stroke: colors.baseline, "stroke-width": 2.4 }, svg);
    el("line", { x1: 150, x2: 1030, y1: 62, y2: 62, stroke: MUTED, "stroke-width": 1.2, "stroke-dasharray": "5 4" }, svg);
    text(156, 56, "1.05 p.u. limit", { color: MUTED, anchor: "start", size: 13 });
    text(790, 44, "voltage rises along the feeder at midday", { color: colors.baseline, size: 13 });
    text(612, 252, "Solar export raises the voltage far from the substation; each inverter can absorb reactive power to lower it", { color: MUTED });
  })();

  // ---------- Voltage colour scale ----------
  const stops = [
    [0.95, [76, 114, 176]], [1.0, [208, 212, 218]], [1.05, [242, 199, 165]], [1.1, [221, 132, 82]], [1.2, [196, 78, 82]],
  ];
  function voltageColor(v) {
    if (v <= stops[0][0]) return `rgb(${stops[0][1]})`;
    for (let s = 1; s < stops.length; s++) {
      if (v <= stops[s][0]) {
        const [a, ca] = stops[s - 1], [b, cb] = stops[s];
        const f = (v - a) / (b - a);
        return `rgb(${ca.map((c, i) => Math.round(c + f * (cb[i] - c))).join(",")})`;
      }
    }
    return `rgb(${stops[stops.length - 1][1]})`;
  }
  const legend = document.getElementById("map-legend");
  legend.innerHTML = [[0.95, "0.95"], [1.0, "1.00"], [1.05, "1.05 (limit)"], [1.1, "1.10"], [1.2, "1.20 p.u."]]
    .map(([v, label]) => `<span><i style="background:${voltageColor(v)};height:10px;width:18px"></i>${label}</span>`).join("") +
    `<span><i style="background:#1f2328;height:8px;width:8px;border-radius:2px"></i>PV inverter</span>`;

  // ---------- Feeder maps ----------
  const F = D.feeder;
  const mapW = 1000, mapH = 330, pad = 14;
  const px = (b) => pad + (mapW - 2 * pad) * F.x[b];
  const py = (b) => pad + (mapH - 2 * pad) * F.y[b];
  function feederMap(key) {
    const svg = el("svg", { viewBox: `0 0 ${mapW} ${mapH}`, role: "img", "aria-label": `Bus voltages ${names[key]}` }, document.getElementById("map-" + key));
    const lines = F.branches.map(([a, b]) => el("line", { x1: px(a), y1: py(a), x2: px(b), y2: py(b), "stroke-width": 3.2, "stroke-linecap": "round" }, svg));
    const dots = range(B).map((b) => el("circle", { cx: px(b), cy: py(b), r: 2.6 }, svg));
    F.pv_bus.forEach((b) => el("rect", { x: px(b) - 3.5, y: py(b) - 3.5, width: 7, height: 7, rx: 1.5, fill: "#1f2328" }, svg));
    const s = F.substation;
    el("rect", { x: px(s) - 7, y: py(s) - 9, width: 14, height: 18, rx: 3, fill: "#1f2328" }, svg);
    return (frame) => {
      const v = policies[key].v_milli[frame];
      F.branches.forEach(([a, b], e) => lines[e].setAttribute("stroke", voltageColor(1 + Math.max(v[a], v[b]) / 1000)));
      dots.forEach((dot, b) => dot.setAttribute("fill", voltageColor(1 + v[b] / 1000)));
    };
  }
  const maps = [feederMap("baseline"), feederMap("dgpg")];

  // ---------- KPIs ----------
  const reduction = (key, series) => {
    if (key === "baseline" || policies.baseline[series][k] <= 0) return `<em class="delta">&nbsp;</em>`;
    const change = 100 * (1 - D.dgpg[series][k] / D.baseline[series][k]);
    return `<em class="delta">${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)} % vs no control</em>`;
  };
  function drawKpis(key) {
    const p = policies[key];
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>Highest bus voltage</span><strong>${p.v_max[k].toFixed(3)} p.u.</strong></div>` +
      `<div class="kpi"><span>Buses outside the band now</span><strong>${p.out_of_band_percent[k].toFixed(0)} %</strong></div>` +
      `<div class="kpi"><span>Bus-time outside the band so far</span><strong>${p.outsideSoFar[k].toFixed(1)} %</strong>${reduction(key, "outsideSoFar")}</div>`;
  }

  // ---------- Time-series charts ----------
  const vTop = Math.ceil(Math.max(...D.baseline.v_max) * 50) / 50;
  const vmaxChart = lineChart(document.getElementById("chart-vmax"), {
    xDomain, yDomain: [0.98, vTop], xLabel: "Time of day", yLabel: "Highest voltage (p.u.)", xFormat: hourTick, yFormat: voltTick,
    series: [
      { x: times, y: D.baseline.v_max, color: colors.baseline, label: names.baseline },
      { x: times, y: D.dgpg.v_max, color: colors.dgpg, label: names.dgpg },
      { x: xDomain, y: [vUpper, vUpper], color: "#5b6370", dash: "5 4", label: "Limit", width: 1.2, static: true },
    ],
  });
  const outsideTop = Math.ceil(Math.max(...D.baseline.out_of_band_percent) / 10) * 10;
  const outsideChart = lineChart(document.getElementById("chart-outside"), {
    xDomain, yDomain: [0, outsideTop], xLabel: "Time of day", yLabel: "Buses outside band (%)", xFormat: hourTick,
    series: [
      { x: times, y: D.baseline.out_of_band_percent, color: colors.baseline, label: names.baseline },
      { x: times, y: D.dgpg.out_of_band_percent, color: colors.dgpg, label: names.dgpg },
    ],
  });
  const pvChart = lineChart(document.getElementById("chart-pv"), {
    xDomain, yDomain: [0, Math.ceil(Math.max(...D.day.pv_mw, ...D.day.load_mw) * 2) / 2], xLabel: "Time of day", yLabel: "Power (MW)", xFormat: hourTick,
    series: [
      { x: times, y: D.day.pv_mw, color: colors.pv, label: "Solar output", width: 2, static: true },
      { x: times, y: D.day.load_mw, color: colors.load, label: "Load", width: 1.2, static: true },
    ],
  });
  const qMin = Math.min(...D.dgpg.q_total_mvar);
  const qChart = lineChart(document.getElementById("chart-q"), {
    xDomain, yDomain: [Math.floor(qMin * 2) / 2, 0.5], xLabel: "Time of day", yLabel: "Reactive power (MVAr)", xFormat: hourTick, zeroLine: true,
    series: [
      { x: times, y: D.baseline.q_total_mvar, color: colors.baseline, label: names.baseline },
      { x: times, y: D.dgpg.q_total_mvar, color: colors.dgpg, label: `${names.dgpg}, sum of ${N} inverters` },
    ],
  });
  const dayOutside = (p) => p.outsideSoFar[T - 1];
  document.getElementById("outcome").textContent =
    `Over the day, AI control lowers the share of bus-time outside the band from ${dayOutside(D.baseline).toFixed(1)} % to ${dayOutside(D.dgpg).toFixed(1)} %, and the highest voltage from ${Math.max(...D.baseline.v_max).toFixed(3)} to ${Math.max(...D.dgpg.v_max).toFixed(3)} p.u.`;

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
      height: 190, xDomain, yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true, xFormat: hourTick,
      series: [{ x: times, y: [], color: colors.reward, label: "Shared advantage A(t), same for all inverters", width: 1.1, static: true }],
    }),
    lineChart(document.getElementById("chart-signal-guide"), {
      height: 210, xDomain, yDomain: [-1, 1], xLabel: "Time of day", yLabel: "−ĝᵢ(t)", zeroLine: true, xFormat: hourTick,
      series: [{ x: times, y: [], color: colors.dgpg, label: "Guidance −ĝᵢ(t) of this inverter", width: 1.1, static: true }],
    }),
  ];
  const signalMatrices = [S.reward_advantage.map((v) => new Array(N).fill(v)), individual];
  const barCharts = [
    lineChart(document.getElementById("chart-bars-reward"), {
      height: 190, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], yLabel: "A(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.reward, label: "Shared advantage A(t)" }],
    }),
    lineChart(document.getElementById("chart-bars-guide"), {
      height: 210, xDomain: [0.5, N + 0.5], yDomain: [-1, 1], xLabel: "Inverter", yLabel: "−ĝᵢ(t)", zeroLine: true,
      series: [{ x: [], y: [], color: colors.dgpg, label: "Guidance −ĝᵢ(t)" }],
    }),
  ];
  const bw = barCharts[0].w / N;
  const barRects = barCharts.map((chart, c) => range(N).map((i) => {
    const rect = el("rect", { width: bw * 0.7, fill: c === 0 ? colors.reward : colors.dgpg, style: "cursor:pointer" }, chart.dataLayer);
    el("title", {}, rect).textContent = `Inverter ${i + 1}`;
    rect.addEventListener("click", () => select(i));
    return rect;
  }));
  const stepInput = document.getElementById("signal-step");
  stepInput.max = T - 1;
  stepInput.value = Math.floor(T / 4);
  function drawSignals() {
    const s = +stepInput.value;
    document.getElementById("signal-step-out").textContent = fmtClock(s);
    document.getElementById("signal-title").textContent = `Inverter ${selected + 1} during training`;
    signalCharts.forEach((chart, c) => {
      const values = column(signalMatrices[c], selected);
      chart.setYDomain(symmetric(values));
      chart.setSeries(0, times, values);
      chart.setCursor(hours(s));
    });
    barCharts.forEach((chart, c) => {
      const values = signalMatrices[c][s];
      chart.setYDomain(symmetric(c === 0 ? S.reward_advantage : values));
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
  // Share of each signal's variance that differs between inverters at the same time.
  function spreadShare(matrix) {
    const flat = matrix.flat();
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    const total = flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length;
    let within = 0;
    for (const row of matrix) {
      const m = row.reduce((s, v) => s + v, 0) / row.length;
      within += row.reduce((s, v) => s + (v - m) ** 2, 0) / row.length;
    }
    return total > 0 ? 100 * (within / matrix.length) / total : 0;
  }
  document.getElementById("spread-note").textContent =
    `Variation that differs between inverters: A ${spreadShare(signalMatrices[0]).toFixed(1)} %, ĝᵢ ${spreadShare(individual).toFixed(1)} %.`;
  document.getElementById("signal-note").textContent =
    `One training day after ${S.update * D.meta.rollouts_per_update} training days. Separate vertical scales. Click a bar to select an inverter.`;
  stepInput.addEventListener("input", drawSignals);

  // ---------- Learning progress ----------
  const curve = D.evaluation_curve;
  const noControl = D.meta.no_control;
  const daysOf = (update) => update * D.meta.rollouts_per_update;
  const lastDays = daysOf(curve[curve.length - 1].update);
  const curveSpecs = [
    ["chart-curve-outside", "out_of_band_percent", "Bus-time outside (%)", 0],
    ["chart-curve-vmax", "v_max", "Highest voltage (p.u.)", 0.98],
  ];
  const curveCharts = curveSpecs.map(([id, field, label, floor], c) => {
    const values = [...curve.map((row) => row[field]), noControl[field]];
    const top = field === "v_max" ? Math.ceil(Math.max(...values) * 50) / 50 : Math.ceil(Math.max(...values) / 5) * 5;
    const chart = lineChart(document.getElementById(id), {
      height: 200, xDomain: [0, lastDays], yDomain: [floor, top], xLabel: c === 1 ? "Training days" : "", yLabel: label,
      yFormat: field === "v_max" ? voltTick : undefined,
      series: [
        { x: curve.map((row) => daysOf(row.update)), y: curve.map((row) => row[field]), color: colors.dgpg, label: names.dgpg, static: true },
        { x: [0, lastDays], y: [noControl[field], noControl[field]], color: colors.baseline, dash: "5 4", label: names.baseline, static: true },
      ],
    });
    curve.forEach((row) => el("circle", { cx: chart.sx(daysOf(row.update)), cy: chart.sy(row[field]), r: 3, fill: colors.dgpg }, chart.dataLayer));
    chart.marker = el("circle", { r: 6.5, fill: "none", stroke: "#1f2328", "stroke-width": 1.6 }, chart.dataLayer);
    chart.field = field;
    return chart;
  });
  const firstBelow = curve.find((row) => row.out_of_band_percent < noControl.out_of_band_percent);
  document.getElementById("curve-note").textContent =
    `Mean over ${D.meta.evaluation_days} held-out days. Fewer voltage violations than no control after ${firstBelow ? daysOf(firstBelow.update) : "–"} training days.`;

  const progressChart = lineChart(document.getElementById("chart-progress"), {
    xDomain, yDomain: [0.98, vTop], xLabel: "Time of day", yLabel: "Highest voltage (p.u.)", xFormat: hourTick, yFormat: voltTick,
    series: [
      { x: times, y: D.baseline.v_max, color: colors.baseline, label: names.baseline, opacity: 0.7, static: true },
      { x: times, y: D.progress[0].v_max, color: colors.dgpg, label: "AI after this training", static: true },
      { x: xDomain, y: [vUpper, vUpper], color: "#5b6370", dash: "5 4", label: "Limit", width: 1.2, static: true },
    ],
  });
  const episodeInput = document.getElementById("episode");
  episodeInput.max = D.progress.length - 1;
  function drawProgress() {
    const item = D.progress[+episodeInput.value];
    progressChart.setSeries(1, times, item.v_max);
    const row = curve.find((c) => c.update === item.update);
    for (const chart of curveCharts) {
      chart.marker.setAttribute("cx", chart.sx(daysOf(item.update)));
      chart.marker.setAttribute("cy", chart.sy(row[chart.field]));
    }
    document.getElementById("episode-out").textContent = `${daysOf(item.update)}`;
  }
  episodeInput.addEventListener("input", drawProgress);

  // ---------- Playback ----------
  const slider = document.getElementById("time");
  const playButton = document.getElementById("play");
  slider.max = T - 1;
  const START = Math.round(T / 4);

  function select(i) {
    selected = i;
    drawSignals();
  }

  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = `${fmtClock(k)} / ${fmtClock(T)}`;
    for (const key of Object.keys(policies)) drawKpis(key);
    maps.forEach((draw) => draw(k));
    for (const chart of [vmaxChart, outsideChart, qChart]) chart.setReveal(k);
    pvChart.setCursor(hours(k));
  }

  let last = null, carry = 0;
  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      carry += ((now - last) / 1000) * 2 * speed;
      const advance = Math.floor(carry);
      carry -= advance;
      k = Math.min(T - 1, k + advance);
      drawFrame();
      if (k >= T - 1) { setPlaying(false); return; }
    }
    last = now;
    requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value;
    playButton.textContent = playing ? "Pause" : k >= T - 1 ? "Replay" : k !== START ? "Resume" : "Start";
    if (playing) {
      if (k >= T - 1) k = START;
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

  // Default selection: the inverter whose individual signal varies most during training.
  let bestVar = -1;
  for (let i = 0; i < N; i++) {
    const col = column(individual, i);
    const m = col.reduce((s, v) => s + v, 0) / col.length;
    const v = col.reduce((s, x) => s + (x - m) ** 2, 0);
    if (v > bestVar) { bestVar = v; selected = i; }
  }

  // Every scenario opens a quarter of the way in.
  k = START;
  drawFrame();
  drawSignals();
  drawProgress();
})();
