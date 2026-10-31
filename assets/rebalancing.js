// Robotaxi fleet rebalancing scenario page.
(function () {
  const D = window.DGPG_REBALANCING;
  const { el, lineChart } = window.Plot;
  const N = D.meta.n_regions;
  const COLS = D.meta.cols;
  const T = D.meta.horizon_steps;
  const step = D.meta.step_minutes;
  const colors = { baseline: "#DD8452", dgpg: "#4C72B0", lost: "#C44E52", reward: "#8172B3", car: "#1f2328" };
  const patternColors = { commute: "#55A868", reverse: "#8172B3", event: "#CCB974" };
  const names = { baseline: "Planned rebalancing", dgpg: "With AI rebalancing" };
  const districts = ["North-west", "North", "North-east", "West", "Centre", "East", "South-west", "South", "South-east"];
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  const kind = (p) => (p === 0 ? "commute" : p === 1 ? "reverse" : "event");
  const patternShort = (p) => (p === 0 ? "Commute" : p === 1 ? "Reverse commute" : `Event · ${districts[p - 2]}`);
  const patternLong = (p) => p === 0
    ? "Commute: riders travel from the outskirts to the centre and the south-east"
    : p === 1 ? "Reverse commute: riders travel back to the outskirts"
      : `Event ending in the ${districts[p - 2].toLowerCase()} district: many riders leave it at once`;
  const fmtClock = (k) => {
    const m = k * step;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  };

  const requests = D.display.requests;                 // (T + 1, N), per 5 minutes
  const pattern = D.display.pattern;                   // (T + 1,)
  const policies = { baseline: D.baseline, dgpg: D.dgpg };
  for (const p of Object.values(policies)) {
    p.lostTotal = p.lost.map(sum);
    p.lostSoFar = [];
    p.requestsSoFar = [];
    let lost = 0, req = 0;
    p.lostTotal.forEach((v, t) => { lost += v; req += sum(requests[t]); p.lostSoFar.push(lost); p.requestsSoFar.push(req); });
  }

  let k = 0;
  let playing = false;
  let speed = 2;

  document.getElementById("episode-note").textContent =
    `Six hours in a city of ${N} districts served by ${D.meta.fleet} robotaxis, with about ${Math.round(D.meta.total_demand * 12)} ride requests per hour. ` +
    `Demand switches between a commute pattern, its reverse and events that send many riders out of one district. ` +
    `Both cities see exactly the same requests; this episode was not used in training.`;

  // ---------- City geometry shared by all maps ----------
  const S = 176, G = 26, M = 10, SIZE = 3 * S + 2 * G + 2 * M;
  const blockX = (i) => M + (i % COLS) * (S + G);
  const blockY = (i) => M + Math.floor(i / COLS) * (S + G);
  const centre = (i) => [blockX(i) + S / 2, blockY(i) + S / 2];

  function arrowPath(i, j, bend) {
    const [x1, y1] = centre(i), [x2, y2] = centre(j);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const edge = S / 2 / Math.max(Math.abs(ux), Math.abs(uy));   // centre to block edge along the arrow
    const sx = x1 + ux * 40, sy = y1 + uy * 40, ex = x2 - ux * (edge - 4), ey = y2 - uy * (edge - 4);
    const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
    return { d: `M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, mx, my };
  }

  function arrowMarker(svg, id, color) {
    const defs = el("defs", {}, svg);
    const marker = el("marker", { id, viewBox: "0 0 10 10", refX: 7, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 Z", fill: color }, marker);
  }

  // ---------- Problem diagram ----------
  (function drawProblem() {
    const INK = "#1f2328", MUTED = "#5b6370";
    const svg = el("svg", { viewBox: "0 0 1100 270", role: "img", "aria-label": "Problem setting", style: "max-width:1100px;margin:0 auto" }, document.getElementById("problem-diagram"));
    arrowMarker(svg, "problem-arrow", colors.dgpg);
    const text = (x, y, s, opts) => {
      const o = Object.assign({ size: 14, color: INK, anchor: "middle", weight: "normal" }, opts);
      el("text", { x, y, "text-anchor": o.anchor, "font-size": o.size, "font-weight": o.weight, style: `fill:${o.color}` }, svg).textContent = s;
    };
    const s = 66, g = 12, x0 = 70, y0 = 22;
    const bx = (i) => x0 + (i % 3) * (s + g), by = (i) => y0 + Math.floor(i / 3) * (s + g);
    const cars = [2, 4, 1, 3, 26, 9, 1, 8, 5];
    el("rect", { x: x0 - 8, y: y0 - 8, width: 3 * s + 2 * g + 16, height: 3 * s + 2 * g + 16, rx: 14, fill: "#dfe3e9" }, svg);
    range(9).forEach((i) => {
      el("rect", { x: bx(i), y: by(i), width: s, height: s, rx: 9, fill: i === 0 ? "#f6dcdc" : "#fff" }, svg);
      range(cars[i]).forEach((c) => el("rect", { x: bx(i) + 9 + (c % 6) * 8.5, y: by(i) + 12 + Math.floor(c / 6) * 9, width: 6, height: 4.4, rx: 1.2, fill: INK }, svg));
    });
    // A rider without a car in the north-west district.
    el("circle", { cx: bx(0) + 46, cy: by(0) + 40, r: 5, fill: colors.lost }, svg);
    el("path", { d: `M${bx(0) + 38},${by(0) + 58} q8,-14 16,0`, fill: colors.lost }, svg);
    // Empty robotaxis sent from the centre.
    for (const j of [0, 2, 6]) {
      const [x1, y1] = [bx(4) + s / 2, by(4) + s / 2], [x2, y2] = [bx(j) + s / 2, by(j) + s / 2];
      el("path", { d: `M${x1 + (x2 - x1) * 0.28},${y1 + (y2 - y1) * 0.28} L${x1 + (x2 - x1) * 0.7},${y1 + (y2 - y1) * 0.7}`, stroke: colors.dgpg, "stroke-width": 4, class: "flow", "marker-end": "url(#problem-arrow)", fill: "none" }, svg);
    }
    const tx = 400;
    text(tx, 52, "Trips pile robotaxis up where riders go", { anchor: "start", size: 18, weight: "bold" });
    text(tx, 76, "Riders flow from some districts to others, so idle robotaxis gather where trips end and run short where trips begin.", { anchor: "start", color: MUTED });
    text(tx, 124, "A rider who finds no robotaxi is lost", { anchor: "start", size: 18, weight: "bold", color: colors.lost });
    text(tx, 148, "A request is served only by an idle robotaxi in the rider's own district; otherwise the rider leaves.", { anchor: "start", color: MUTED });
    text(tx, 196, "Each district sends idle robotaxis ahead of demand", { anchor: "start", size: 18, weight: "bold", color: colors.dgpg });
    text(tx, 220, "An empty robotaxi takes 5 to 20 minutes to reach another district, so it must leave before the riders appear.", { anchor: "start", color: MUTED });
  })();

  // ---------- Demand timeline ----------
  const timeline = (function drawTimeline() {
    const box = document.getElementById("timeline");
    const W = Math.max(600, box.clientWidth), H = 190;
    const left = 92, right = 12, top = 6, band = 30, mid = 112, amp = 62;
    const w = W - left - right;
    const sx = (t) => left + (t / (T + 1)) * w;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Demand patterns and riders without a car over the episode", style: "cursor:pointer" }, box);
    // Pattern segments.
    let start = 0;
    for (let t = 1; t <= T + 1; t++) {
      if (t === T + 1 || pattern[t] !== pattern[start]) {
        const p = pattern[start];
        el("rect", { x: sx(start) + 1, y: top, width: sx(t) - sx(start) - 2, height: band, rx: 5, fill: patternColors[kind(p)], opacity: 0.85 }, svg);
        const label = el("text", { x: (sx(start) + sx(t)) / 2, y: top + 20, "text-anchor": "middle", "font-size": 13, style: "fill:#fff;font-weight:bold" }, svg);
        const width = sx(t) - sx(start);
        label.textContent = width > 110 ? patternShort(p) : width > 54 ? (p >= 2 ? "Event" : patternShort(p).split(" ")[0]) : "";
        start = t;
      }
    }
    // Riders without a car per 5 minutes: without rebalancing above, AI below.
    const maxLost = Math.max(...D.baseline.lostTotal, 1);
    const bw = w / (T + 1);
    range(T + 1).forEach((t) => {
      const hb = (D.baseline.lostTotal[t] / maxLost) * amp, hd = (D.dgpg.lostTotal[t] / maxLost) * amp;
      el("rect", { x: sx(t) + 0.6, y: mid - hb, width: bw - 1.2, height: hb, fill: colors.baseline }, svg);
      el("rect", { x: sx(t) + 0.6, y: mid, width: bw - 1.2, height: hd, fill: colors.dgpg }, svg);
    });
    el("line", { x1: left, x2: W - right, y1: mid, y2: mid, stroke: "#1f2328", "stroke-width": 1 }, svg);
    el("text", { x: left - 10, y: mid - 26, "text-anchor": "end", class: "tick-label", style: `fill:${colors.baseline};font-weight:bold` }, svg).textContent = "Planned";
    el("text", { x: left - 10, y: mid + 34, "text-anchor": "end", class: "tick-label", style: `fill:${colors.dgpg};font-weight:bold` }, svg).textContent = "With AI";
    el("text", { x: left - 10, y: top + 20, "text-anchor": "end", class: "tick-label" }, svg).textContent = "Demand";
    for (let h = 0; h <= 6; h++) {
      const x = sx(h * 60 / step);
      el("line", { x1: x, x2: x, y1: H - 14, y2: H - 10, stroke: "#000" }, svg);
      el("text", { x, y: H, "text-anchor": "middle", class: "tick-label" }, svg).textContent = `${h}:00`;
    }
    const head = el("line", { y1: top - 2, y2: H - 16, stroke: "#1f2328", "stroke-width": 1.6, "stroke-dasharray": "3 3" }, svg);
    svg.addEventListener("click", (event) => {
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      k = Math.max(0, Math.min(T, Math.floor(((x - left) / w) * (T + 1))));
      drawFrame();
    });
    return (frame) => { const x = sx(frame + 0.5); head.setAttribute("x1", x); head.setAttribute("x2", x); };
  })();

  // ---------- City maps ----------
  const PITCH = 7, CAR_R = 2.5, CAR_COLS = 22, CAR_ROWS = 14;
  function cityMap(key) {
    const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, role: "img", "aria-label": `City ${names[key]}` }, document.getElementById("city-" + key));
    arrowMarker(svg, `dispatch-${key}`, colors[key]);
    el("rect", { width: SIZE, height: SIZE, rx: 16, fill: "#dfe3e9" }, svg);
    const blocks = range(N).map((i) => {
      const x = blockX(i), y = blockY(i);
      el("rect", { x, y, width: S, height: S, rx: 14, fill: "#fff" }, svg);
      const tint = el("rect", { x, y, width: S, height: S, rx: 14, fill: colors.lost, opacity: 0 }, svg);
      el("text", { x: x + 12, y: y + 22, "font-size": 14, style: "fill:#5b6370" }, svg).textContent = districts[i];
      const carCount = el("text", { x: x + S - 12, y: y + 22, "text-anchor": "end", "font-size": 14, "font-weight": "bold" }, svg);
      const reqText = el("text", { x: x + 12, y: y + 40, "font-size": 13, style: "fill:#5b6370" }, svg);
      const cars = range(CAR_COLS * CAR_ROWS).map((c) => el("circle", {
        cx: x + 15 + (c % CAR_COLS) * PITCH, cy: y + 54 + Math.floor(c / CAR_COLS) * PITCH, r: CAR_R, fill: colors.car, visibility: "hidden",
      }, svg));
      const lostText = el("text", { x: x + 12, y: y + S - 12, "font-size": 14, "font-weight": "bold", style: `fill:${colors.lost}` }, svg);
      return { tint, carCount, cars, lostText, reqText };
    });
    const dispatchLayer = el("g", {}, svg);
    return (frame) => {
      const p = policies[key];
      range(N).forEach((i) => {
        const b = blocks[i], n = p.available[frame][i], lost = p.lost[frame][i], req = requests[frame][i];
        b.carCount.textContent = `${n} idle`;
        b.cars.forEach((car, c) => car.setAttribute("visibility", c < n ? "visible" : "hidden"));
        b.lostText.textContent = lost > 0 ? `${lost} riders without a car` : "";
        b.reqText.textContent = `${req} ride requests`;
        b.tint.setAttribute("opacity", req > 0 ? Math.min(0.42, 0.6 * lost / req) : 0);
      });
      dispatchLayer.replaceChildren();
      if (frame < T) {
        const moves = [];
        p.dispatch[frame].forEach((row, i) => row.forEach((n, j) => { if (i !== j && n > 0) moves.push([i, j, n]); }));
        moves.sort((a, b) => b[2] - a[2]).slice(0, 8).forEach(([i, j, n]) => {
          const a = arrowPath(i, j, -16);
          el("path", { d: a.d, fill: "none", stroke: colors[key], "stroke-width": 1.5 + 1.6 * Math.sqrt(n), class: "flow", "marker-end": `url(#dispatch-${key})` }, dispatchLayer);
          if (n >= 4) {
            el("circle", { cx: a.mx, cy: a.my, r: 11, fill: "#fff", stroke: colors[key], "stroke-width": 1.4 }, dispatchLayer);
            el("text", { x: a.mx, y: a.my + 4.5, "text-anchor": "middle", "font-size": 12, "font-weight": "bold", style: `fill:${colors[key]}` }, dispatchLayer).textContent = n;
          }
        });
      }
    };
  }
  const maps = { baseline: cityMap("baseline"), dgpg: cityMap("dgpg") };
  document.getElementById("city-legend").innerHTML =
    `<span><i style="background:${colors.car};height:6px;width:6px;border-radius:50%"></i>Idle robotaxi</span>` +
    `<span><i style="background:${colors.lost};opacity:.45;height:12px;width:14px;border-radius:3px"></i>District where riders find no car</span>` +
    `<span><i style="background:${colors.baseline};height:4px;width:18px"></i>Empty robotaxis sent by the fixed plan</span>` +
    `<span><i style="background:${colors.dgpg};height:4px;width:18px"></i>Empty robotaxis sent by the AI (largest groups in these 5 minutes)</span>`;

  // ---------- KPIs ----------
  function drawKpis(key) {
    const p = policies[key];
    const served = p.requestsSoFar[k] - p.lostSoFar[k];
    const share = p.requestsSoFar[k] > 0 ? (100 * p.lostSoFar[k]) / p.requestsSoFar[k] : 0;
    let delta = `<em class="delta">&nbsp;</em>`;
    if (key === "dgpg" && D.baseline.lostSoFar[k] > 0) {
      const change = 100 * (1 - p.lostSoFar[k] / D.baseline.lostSoFar[k]);
      delta = `<em class="delta">${change >= 0 ? "−" : "+"}${Math.abs(change).toFixed(0)} % vs fixed plan</em>`;
    }
    document.getElementById("kpi-" + key).innerHTML =
      `<div class="kpi"><span>Riders served so far</span><strong>${served.toLocaleString("en-GB")}</strong></div>` +
      `<div class="kpi"><span>Riders without a car so far</span><strong>${p.lostSoFar[k].toLocaleString("en-GB")}</strong>${delta}</div>` +
      `<div class="kpi"><span>Share without a car</span><strong>${share.toFixed(1)} %</strong></div>`;
  }
  const finalShare = (p) => (100 * p.lostSoFar[T]) / p.requestsSoFar[T];
  document.getElementById("outcome").textContent =
    `Over the six hours, AI rebalancing lowers the share of riders without a car from ${finalShare(D.baseline).toFixed(1)} % to ${finalShare(D.dgpg).toFixed(1)} %. ` +
    `Over ${D.meta.evaluation_episodes} held-out episodes, the share falls from ${D.meta.baseline_lost_percent.toFixed(1)} % to ${D.meta.final.lost_percent.toFixed(1)} %.`;

  // ---------- Training: robotaxis 20 minutes ahead against the reference ----------
  const TR = D.training;
  const K = TR.reward_advantage.length;
  const individual = TR.guidance.map((row) => row.map((v) => -v));
  let selected = 4;
  const guideStep = document.getElementById("guide-step");
  guideStep.max = K - 1;
  const guide = (function guideCity() {
    const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, role: "img", "aria-label": "Robotaxis 20 minutes ahead and the reference" }, document.getElementById("guide-city"));
    arrowMarker(svg, "guide-arrow", colors.dgpg);
    el("rect", { width: SIZE, height: SIZE, rx: 16, fill: "#dfe3e9" }, svg);
    const top = Math.max(...TR.state.flat(), ...TR.target.flat());
    const barTop = 40, barH = 96, barW = 34;
    const blocks = range(N).map((i) => {
      const x = blockX(i), y = blockY(i);
      const frame = el("rect", { x, y, width: S, height: S, rx: 14, fill: "#fff", stroke: "transparent", "stroke-width": 4, style: "cursor:pointer" }, svg);
      frame.addEventListener("click", () => { selected = i; drawGuide(); });
      el("text", { x: x + 12, y: y + 22, "font-size": 14, style: "fill:#5b6370;pointer-events:none" }, svg).textContent = districts[i];
      el("line", { x1: x + 30, x2: x + S - 30, y1: y + barTop + barH, y2: y + barTop + barH, stroke: "#c4c9d1", style: "pointer-events:none" }, svg);
      const bar = el("rect", { x: x + S / 2 - barW - 4, width: barW, fill: colors.dgpg, rx: 3, style: "pointer-events:none" }, svg);
      const ref = el("rect", { x: x + S / 2 + 4, width: barW, fill: "none", stroke: colors.car, "stroke-width": 1.6, "stroke-dasharray": "4 3", rx: 3, style: "pointer-events:none" }, svg);
      const values = el("text", { x: x + S / 2, y: y + barTop + barH + 18, "text-anchor": "middle", "font-size": 13, style: "pointer-events:none" }, svg);
      const signal = el("text", { x: x + S / 2, y: y + S - 10, "text-anchor": "middle", "font-size": 13, "font-weight": "bold", style: "pointer-events:none" }, svg);
      return { frame, bar, ref, values, signal, x, y };
    });
    const arrows = el("g", {}, svg);
    const sy = (v) => (v / top) * barH;
    return (s) => {
      blocks.forEach((b, i) => {
        const x = TR.state[s][i], ref = TR.target[s][i], g = individual[s][i];
        b.bar.setAttribute("y", b.y + barTop + barH - sy(x));
        b.bar.setAttribute("height", sy(x));
        b.ref.setAttribute("y", b.y + barTop + barH - sy(ref));
        b.ref.setAttribute("height", sy(ref));
        b.values.textContent = `${x} vs ${Math.round(ref)}`;
        b.signal.textContent = `−ĝ = ${g >= 0 ? "+" : "−"}${Math.abs(g).toFixed(2)}`;
        b.signal.setAttribute("style", `pointer-events:none;fill:${g >= 0 ? "#3f8a52" : colors.lost}`);
        b.frame.setAttribute("stroke", i === selected ? colors.car : "transparent");
      });
      arrows.replaceChildren();
      TR.dispatch[s][selected].forEach((n, j) => {
        if (j === selected || n === 0) return;
        const a = arrowPath(selected, j, -16);
        el("path", { d: a.d, fill: "none", stroke: colors.dgpg, "stroke-width": 1.5 + 1.6 * Math.sqrt(n), class: "flow", "marker-end": "url(#guide-arrow)" }, arrows);
        el("circle", { cx: a.mx, cy: a.my, r: 11, fill: "#fff", stroke: colors.dgpg, "stroke-width": 1.4 }, arrows);
        el("text", { x: a.mx, y: a.my + 4.5, "text-anchor": "middle", "font-size": 12, "font-weight": "bold", style: `fill:${colors.dgpg}` }, arrows).textContent = n;
      });
    };
  })();
  document.getElementById("guide-legend").innerHTML =
    `<span><i style="background:${colors.dgpg};height:10px;width:12px;border-radius:2px"></i>Robotaxis 20 minutes ahead, x<sub>j</sub></span>` +
    `<span><i style="border:1.6px dashed ${colors.car};height:10px;width:10px;border-radius:2px;background:none"></i>Reference x̃<sub>j</sub></span>` +
    `<span><i style="background:${colors.dgpg};height:4px;width:18px"></i>Dispatch of the selected district</span>`;

  const minutes = range(K).map((t) => (t * step) / 60);
  const hourTick = (v) => `${Math.round(v)}:00`;
  const symmetric = (values) => {
    let m = 0;
    for (const v of values) m = Math.max(m, Math.abs(v));
    m = 1.08 * (m || 1);
    return [-m, m];
  };
  const signalCharts = [
    lineChart(document.getElementById("chart-signal-reward"), {
      height: 200, xDomain: [0, T * step / 60], yDomain: symmetric(TR.reward_advantage), yLabel: "A(t)", zeroLine: true, xFormat: hourTick,
      series: [{ x: minutes, y: TR.reward_advantage, color: colors.reward, label: "Shared advantage A(t), same for all districts", width: 1.2, static: true }],
    }),
    lineChart(document.getElementById("chart-signal-guide"), {
      height: 220, xDomain: [0, T * step / 60], yDomain: [-1, 1], xLabel: "Time in the training episode", yLabel: "−ĝᵢ(t)", zeroLine: true, xFormat: hourTick,
      series: [{ x: minutes, y: [], color: colors.dgpg, label: "Guidance −ĝᵢ(t) of the selected district", width: 1.2, static: true }],
    }),
  ];
  document.getElementById("signal-note").textContent =
    `One training episode after ${TR.update * D.meta.rollouts_per_update} training episodes. A(t) rises and falls with how many riders the whole city loses, ` +
    `while −ĝᵢ(t) scores only district i's own dispatch against the reference. Click a district on the left to select it.`;
  function drawGuide() {
    const s = +guideStep.value;
    document.getElementById("guide-step-out").textContent = `${fmtClock(s)} · ${patternShort(TR.pattern[s])}`;
    document.getElementById("signal-title").textContent = `Learning signals of the ${districts[selected].toLowerCase()} district`;
    guide(s);
    const values = individual.map((row) => row[selected]);
    signalCharts[1].setYDomain(symmetric(values));
    signalCharts[1].setSeries(0, minutes, values);
    signalCharts.forEach((chart) => chart.setCursor(minutes[s]));
  }
  guideStep.addEventListener("input", drawGuide);

  // ---------- Learning progress ----------
  const curve = D.evaluation_curve;
  const episodesOf = (update) => update * D.meta.rollouts_per_update;
  const lastEpisodes = episodesOf(curve[curve.length - 1].update);
  const curveTop = Math.ceil(Math.max(D.meta.baseline_lost_percent, ...curve.map((c) => c.lost_percent)) / 5) * 5;
  const curveChart = lineChart(document.getElementById("chart-curve"), {
    height: 260, xDomain: [0, lastEpisodes], yDomain: [0, curveTop], xLabel: "Training episodes", yLabel: "Riders without a car (%)",
    series: [
      { x: curve.map((c) => episodesOf(c.update)), y: curve.map((c) => c.lost_percent), color: colors.dgpg, label: names.dgpg, static: true },
      { x: [0, lastEpisodes], y: [D.meta.baseline_lost_percent, D.meta.baseline_lost_percent], color: colors.baseline, dash: "5 4", label: names.baseline, static: true },
    ],
  });
  curve.forEach((c) => el("circle", { cx: curveChart.sx(episodesOf(c.update)), cy: curveChart.sy(c.lost_percent), r: 3, fill: colors.dgpg }, curveChart.dataLayer));
  const marker = el("circle", { r: 6.5, fill: "none", stroke: colors.car, "stroke-width": 1.6 }, curveChart.dataLayer);
  document.getElementById("curve-note").textContent =
    `Mean over ${D.meta.evaluation_episodes} held-out episodes of six hours; each training update uses ${D.meta.rollouts_per_update} episodes.`;

  const frames = range(T + 1).map((t) => (t * step) / 60);
  const progressTop = Math.ceil(Math.max(...D.baseline.lostTotal) / 10) * 10;
  const progressChart = lineChart(document.getElementById("chart-progress"), {
    height: 260, xDomain: [0, T * step / 60], yDomain: [0, progressTop], xLabel: "Time in the episode", yLabel: "Without a car per 5 min", xFormat: hourTick,
    series: [
      { x: frames, y: D.baseline.lostTotal, color: colors.baseline, label: names.baseline, opacity: 0.7, static: true },
      { x: frames, y: D.progress[0].lost, color: colors.dgpg, label: "AI after this training", static: true },
    ],
  });
  const episodeInput = document.getElementById("episode");
  episodeInput.max = D.progress.length - 1;
  function drawProgress() {
    const item = D.progress[+episodeInput.value];
    progressChart.setSeries(1, frames, item.lost);
    const row = curve.find((c) => c.update === item.update);
    marker.setAttribute("cx", curveChart.sx(episodesOf(item.update)));
    marker.setAttribute("cy", curveChart.sy(row.lost_percent));
    document.getElementById("episode-out").textContent = `${episodesOf(item.update)}`;
  }
  episodeInput.addEventListener("input", drawProgress);

  // ---------- Playback ----------
  const slider = document.getElementById("time");
  const playButton = document.getElementById("play");
  slider.max = T;

  function drawFrame() {
    slider.value = k;
    document.getElementById("clock").textContent = `${fmtClock(k)} / ${fmtClock(T)}`;
    const p = pattern[k];
    document.getElementById("pattern-now").innerHTML =
      `<span class="pattern-dot" style="background:${patternColors[kind(p)]}"></span><b>${patternShort(p)}</b><span class="note">${patternLong(p)}</span>`;
    for (const key of Object.keys(policies)) { drawKpis(key); maps[key](k); }
    timeline(k);
  }

  let last = null, carry = 0;
  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      carry += ((now - last) / 1000) * speed;
      const advance = Math.floor(carry);
      carry -= advance;
      if (advance > 0) {
        k = Math.min(T, k + advance);
        drawFrame();
      }
      if (k >= T) { setPlaying(false); return; }
    }
    last = now;
    requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value;
    playButton.textContent = playing ? "Pause" : k >= T ? "Replay" : k > 0 ? "Resume" : "Start";
    if (playing) {
      if (k >= T) k = 0;
      last = null;
      requestAnimationFrame(tick);
    }
  }
  playButton.addEventListener("click", () => setPlaying(!playing));
  document.getElementById("restart").addEventListener("click", () => { k = 0; drawFrame(); setPlaying(true); });
  slider.addEventListener("input", () => { k = +slider.value; drawFrame(); if (!playing) setPlaying(false); });
  document.querySelectorAll(".speed button").forEach((b) => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll(".speed button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  // Open on the step where the city without rebalancing loses most riders.
  k = D.baseline.lostTotal.indexOf(Math.max(...D.baseline.lostTotal));
  drawFrame();
  drawGuide();
  drawProgress();
})();
