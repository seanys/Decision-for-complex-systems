// Minimal SVG plotting helpers shared by all pages.
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceTicks(lo, hi, count) {
    if (hi === lo) { hi = lo + 1; }
    const raw = (hi - lo) / Math.max(1, count);
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
    const ticks = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9 * step; t += step) {
      ticks.push(Math.abs(t) < 1e-12 ? 0 : t);
    }
    return ticks;
  }

  function logTicks(lo, hi) {
    const ticks = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      const t = Math.pow(10, e);
      if (t >= lo * 0.999 && t <= hi * 1.001) ticks.push(t);
    }
    return ticks;
  }

  function formatTick(value, log) {
    if (log) {
      const e = Math.round(Math.log10(value));
      return e === 0 ? "1" : e === 1 ? "10" : "10" + String(e).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).replace("-", "⁻");
    }
    const abs = Math.abs(value);
    if (abs === 0) return "0";
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(0);
    if (abs >= 1) return String(+value.toFixed(1));
    return String(+value.toFixed(3));
  }

  function extent(arrays) {
    let lo = Infinity, hi = -Infinity;
    for (const a of arrays) for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, hi];
  }

  // Line chart with optional progressive reveal and a vertical cursor.
  function lineChart(container, options) {
    // Draw at the container's pixel width so that font sizes render as specified.
    const style = getComputedStyle(container);
    const innerWidth = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const o = Object.assign({ height: 240, margin: { top: 34, right: 14, bottom: 46, left: 62 }, xTicks: 6, yTicks: 5 }, options);
    o.width = Math.max(280, Math.round(innerWidth));
    const m = o.margin;
    const w = o.width - m.left - m.right;
    const h = o.height - m.top - m.bottom;
    const svg = el("svg", { viewBox: `0 0 ${o.width} ${o.height}`, role: "img", "aria-label": o.ariaLabel || o.yLabel || "chart" }, container);
    const root = el("g", { transform: `translate(${m.left},${m.top})` }, svg);
    const gridLayer = el("g", {}, root);
    const dataLayer = el("g", {}, root);
    const axisLayer = el("g", {}, root);
    const chart = { svg, root, dataLayer, w, h, options: o, paths: [], reveal: Infinity };

    chart.sx = (x) => {
      const [a, b] = o.xDomain;
      return o.logX ? (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) * w : (x - a) / (b - a) * w;
    };
    chart.sy = (y) => {
      const [a, b] = chart.yDomain;
      return o.logY ? h - (Math.log10(y) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) * h : h - (y - a) / (b - a) * h;
    };

    function drawAxes() {
      gridLayer.replaceChildren();
      axisLayer.replaceChildren();
      const xt = o.logX ? logTicks(...o.xDomain) : niceTicks(...o.xDomain, o.xTicks);
      const yt = o.logY ? logTicks(...chart.yDomain) : niceTicks(...chart.yDomain, o.yTicks);
      for (const t of yt) {
        const y = chart.sy(t);
        el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: "var(--grid)", "stroke-width": 1 }, gridLayer);
        el("line", { x1: -4, x2: 0, y1: y, y2: y, stroke: "#000" }, axisLayer);
        el("text", { x: -7, y: y + 4, "text-anchor": "end", class: "tick-label" }, axisLayer).textContent = (o.yFormat || ((v) => formatTick(v, o.logY)))(t);
      }
      for (const t of xt) {
        const x = chart.sx(t);
        el("line", { x1: x, x2: x, y1: 0, y2: h, stroke: "var(--grid)", "stroke-width": 1 }, gridLayer);
        el("line", { x1: x, x2: x, y1: h, y2: h + 4, stroke: "#000" }, axisLayer);
        el("text", { x, y: h + 17, "text-anchor": "middle", class: "tick-label" }, axisLayer).textContent = (o.xFormat || ((v) => formatTick(v, o.logX)))(t);
      }
      el("line", { x1: 0, x2: w, y1: h, y2: h, stroke: "#000" }, axisLayer);
      el("line", { x1: 0, x2: 0, y1: 0, y2: h, stroke: "#000" }, axisLayer);
      if (o.xLabel) el("text", { x: w / 2, y: h + 38, "text-anchor": "middle", class: "axis-label" }, axisLayer).textContent = o.xLabel;
      if (o.yLabel) el("text", { x: -m.left + 14, y: h / 2, "text-anchor": "middle", class: "axis-label", transform: `rotate(-90 ${-m.left + 14} ${h / 2})` }, axisLayer).textContent = o.yLabel;
      if (o.zeroLine && !o.logY && chart.yDomain[0] < 0 && chart.yDomain[1] > 0) {
        el("line", { x1: 0, x2: w, y1: chart.sy(0), y2: chart.sy(0), stroke: "#999", "stroke-width": 0.8 }, gridLayer);
      }
    }

    function drawLegend() {
      let x = 0;
      for (const s of o.series) {
        if (!s.label) continue;
        const g = el("g", { transform: `translate(${x},${-20})` }, axisLayer);
        el("line", { x1: 0, x2: 18, y1: 0, y2: 0, stroke: s.color, "stroke-width": 2.4, "stroke-dasharray": s.dash || "" }, g);
        const text = el("text", { x: 24, y: 5, class: "legend-label" }, g);
        text.textContent = s.label;
        x += 24 + text.getComputedTextLength() + 18;
      }
    }

    chart.yDomain = o.yDomain || (() => {
      const [lo, hi] = extent(o.series.map((s) => s.y));
      const pad = (hi - lo) * 0.06 || 1;
      return [lo - pad, hi + pad];
    })();

    chart.pathFor = (xs, ys, upto) => {
      const n = Math.min(xs.length, ys.length, upto === undefined ? Infinity : upto + 1);
      let d = "";
      for (let i = 0; i < n; i++) {
        const px = chart.sx(xs[i]).toFixed(1), py = chart.sy(ys[i]).toFixed(1);
        d += (i ? "L" : "M") + px + "," + py;
      }
      return d;
    };

    chart.render = () => {
      for (let i = 0; i < o.series.length; i++) {
        const s = o.series[i];
        if (!chart.paths[i]) {
          chart.paths[i] = el("path", { fill: "none", stroke: s.color, "stroke-width": s.width || 1.6, "stroke-dasharray": s.dash || "", "stroke-linejoin": "round", opacity: s.opacity || 1 }, dataLayer);
        }
        chart.paths[i].setAttribute("d", chart.pathFor(s.x, s.y, s.static ? undefined : chart.reveal));
      }
      if (chart.cursorLine && chart.cursorX !== undefined) {
        const x = chart.sx(chart.cursorX);
        chart.cursorLine.setAttribute("x1", x);
        chart.cursorLine.setAttribute("x2", x);
      }
    };

    chart.setReveal = (index) => { chart.reveal = index; chart.render(); };
    chart.setSeries = (i, xs, ys) => { o.series[i].x = xs; o.series[i].y = ys; chart.render(); };
    chart.setYDomain = (domain) => { chart.yDomain = domain; drawAxes(); drawLegend(); chart.render(); };
    chart.setCursor = (x) => {
      if (!chart.cursorLine) chart.cursorLine = el("line", { y1: 0, y2: h, stroke: "#555", "stroke-width": 1, "stroke-dasharray": "3 3" }, dataLayer);
      chart.cursorX = x;
      chart.render();
    };

    drawAxes();
    drawLegend();
    chart.render();
    return chart;
  }

  window.Plot = { el, lineChart, niceTicks, extent, formatTick };
})();
