// Scaling figure shared by the scenario pages: one agent's share of a shared reward
// and the measured noise of the shared-reward gradient.
(function () {
  const { el, lineChart } = window.Plot;
  const { t } = window.I18N;
  const colors = { reward: "#8172B3" };
  (function drawScaling() {
    const BLUE = "#4C72B0", GRAY = "#cfd5de";
    const counts = [5, 50, 500];
    // Drawn at the container's width (at most 560 px) so that the labels keep their size on narrow screens.
    const box = document.getElementById("share-bars");
    const W = Math.round(Math.min(560, Math.max(300, box.clientWidth)));
    const barX = 110, barW = W - 200, barH = 26, rowH = 62;
    const svg = el("svg", { viewBox: `0 0 ${W} ${counts.length * rowH + 10}`, role: "img", "aria-label": t("Share of the shared reward caused by one agent"), style: `max-width:${W}px` }, box);
    counts.forEach((n, r) => {
      const y = 14 + r * rowH;
      el("text", { x: 0, y: y + barH / 2 + 5, class: "legend-label" }, svg).textContent = t("{n} agents", { n });
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
      xLabel: t("Number of agents N"), yLabel: t("Gradient variance"), xFormat: (v) => String(v),
      series: [
        { x: rows.map((r) => r.n), y: rows.map((r) => r.standard), color: colors.reward, label: t("Shared reward (conventional)"), static: true },
      ],
    });
  })();

})();
