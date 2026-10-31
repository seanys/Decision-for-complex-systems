// Scaling figure shared by the scenario pages: one agent's share of a shared reward
// and the measured noise of the shared-reward gradient.
(function () {
  const { el, lineChart } = window.Plot;
  const colors = { reward: "#8172B3" };
  (function drawScaling() {
    const BLUE = "#4C72B0", GRAY = "#cfd5de";
    const counts = [5, 50, 500];
    const barX = 110, barW = 360, barH = 26, rowH = 62;
    const svg = el("svg", { viewBox: `0 0 560 ${counts.length * rowH + 10}`, role: "img", "aria-label": "Share of the shared reward caused by one agent", style: "max-width:560px" }, document.getElementById("share-bars"));
    counts.forEach((n, r) => {
      const y = 14 + r * rowH;
      el("text", { x: 0, y: y + barH / 2 + 5, class: "legend-label" }, svg).textContent = `${n} agents`;
      el("rect", { x: barX, y, width: barW, height: barH, rx: 4, fill: GRAY }, svg);
      if (n <= 50) {
        for (let j = 1; j < n; j++) {
          const x = barX + (barW * j) / n;
          el("line", { x1: x, x2: x, y1: y, y2: y + barH, stroke: "#fff", "stroke-width": n <= 5 ? 2 : 1 }, svg);
        }
      }
      el("rect", { x: barX, y, width: Math.max(1.2, barW / n), height: barH, rx: n <= 5 ? 4 : 0, fill: BLUE }, svg);
      el("text", { x: barX + barW + 14, y: y + barH / 2 + 5, class: "legend-label", style: `fill:${BLUE};font-weight:bold` }, svg).textContent = `${(100 / n).toFixed(1).replace(/\.0$/, "")} %`;
    });
  })();
  (function drawNoise() {
    const rows = window.DGPG_VARIANCE;
    const ys = rows.map((r) => r.standard);
    lineChart(document.getElementById("chart-scaling"), {
      height: 230, logX: true, logY: true,
      xDomain: [rows[0].n, rows[rows.length - 1].n * 1.05],
      yDomain: [Math.pow(10, Math.floor(Math.log10(Math.min(...ys)))), Math.pow(10, Math.ceil(Math.log10(Math.max(...ys))))],
      xLabel: "Number of agents N", yLabel: "Gradient variance", xFormat: (v) => String(v),
      series: [
        { x: rows.map((r) => r.n), y: rows.map((r) => r.standard), color: colors.reward, label: "Shared reward (conventional)", static: true },
      ],
    });
  })();

})();
