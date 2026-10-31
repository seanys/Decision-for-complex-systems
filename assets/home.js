// Overview page: hero illustration and scenario cards.
(function () {
  const { el } = window.Plot;
  const LINE = "#7fb8ff", GLOW = "#5cc8ff", NET = "#2a6fdb";

  // ---------- Line-art icons shared by the hero and the scenario tiles ----------
  const icons = {
    turbine(g, x, y, s) {
      el("path", { d: `M${x},${y} L${x - 3 * s},${y + 70 * s} L${x + 3 * s},${y + 70 * s} Z`, fill: "none" }, g);
      for (const a of [90, 210, 330]) {
        el("path", { d: `M${x},${y} C${x - 4 * s},${y - 14 * s} ${x - 2 * s},${y - 30 * s} ${x},${y - 38 * s} C${x + 2 * s},${y - 30 * s} ${x + 4 * s},${y - 14 * s} ${x},${y} Z`, transform: `rotate(${a - 90} ${x} ${y})`, fill: "none" }, g);
      }
      el("circle", { cx: x, cy: y, r: 3 * s, fill: "none" }, g);
    },
    tower(g, x, y, s) {
      el("path", { d: `M${x - 18 * s},${y + 80 * s} L${x},${y} L${x + 18 * s},${y + 80 * s} M${x - 12 * s},${y + 55 * s} L${x + 12 * s},${y + 55 * s} M${x - 6 * s},${y + 28 * s} L${x + 6 * s},${y + 28 * s} M${x - 26 * s},${y + 14 * s} L${x + 26 * s},${y + 14 * s} M${x - 8 * s},${y + 55 * s} L${x + 5 * s},${y + 28 * s} M${x + 8 * s},${y + 55 * s} L${x - 5 * s},${y + 28 * s}`, fill: "none" }, g);
    },
    generator(g, x, y, s) {
      el("circle", { cx: x, cy: y, r: 16 * s, fill: "none" }, g);
      el("path", { d: `M${x - 9 * s},${y} q${4.5 * s},${-8 * s} ${9 * s},0 t${9 * s},0`, fill: "none" }, g);
    },
    rack(g, x, y, s) {
      el("rect", { x: x - 20 * s, y, width: 40 * s, height: 80 * s, rx: 3 * s, fill: "none" }, g);
      for (let j = 0; j < 5; j++) {
        const yy = y + 8 * s + j * 14 * s;
        el("rect", { x: x - 15 * s, y: yy, width: 30 * s, height: 9 * s, rx: 1.5 * s, fill: "none" }, g);
        el("circle", { cx: x + 10 * s, cy: yy + 4.5 * s, r: 1.6 * s, fill: j % 2 ? GLOW : "none" }, g);
      }
    },
    trafficLight(g, x, y, s) {
      el("rect", { x: x - 8 * s, y, width: 16 * s, height: 40 * s, rx: 4 * s, fill: "none" }, g);
      [0, 1, 2].forEach((j) => el("circle", { cx: x, cy: y + 8 * s + j * 12 * s, r: 4 * s, fill: j === 2 ? GLOW : "none" }, g));
      el("line", { x1: x, y1: y + 40 * s, x2: x, y2: y + 75 * s }, g);
    },
    intersection(g, x, y, s) {
      el("path", { d: `M${x - 70 * s},${y - 12 * s} L${x - 12 * s},${y - 12 * s} L${x - 12 * s},${y - 50 * s} M${x + 12 * s},${y - 50 * s} L${x + 12 * s},${y - 12 * s} L${x + 70 * s},${y - 12 * s} M${x + 70 * s},${y + 12 * s} L${x + 12 * s},${y + 12 * s} L${x + 12 * s},${y + 50 * s} M${x - 12 * s},${y + 50 * s} L${x - 12 * s},${y + 12 * s} L${x - 70 * s},${y + 12 * s}`, fill: "none" }, g);
      el("path", { d: `M${x - 70 * s},${y} L${x - 20 * s},${y} M${x + 20 * s},${y} L${x + 70 * s},${y} M${x},${y - 50 * s} L${x},${y - 20 * s} M${x},${y + 20 * s} L${x},${y + 50 * s}`, "stroke-dasharray": `${4 * s} ${4 * s}`, fill: "none" }, g);
    },
    transformer(g, x, y, s) {
      el("circle", { cx: x - 7 * s, cy: y, r: 12 * s, fill: "none" }, g);
      el("circle", { cx: x + 7 * s, cy: y, r: 12 * s, fill: "none" }, g);
      el("line", { x1: x - 34 * s, y1: y, x2: x - 19 * s, y2: y }, g);
      el("line", { x1: x + 19 * s, y1: y, x2: x + 34 * s, y2: y }, g);
    },
  };
  const iconLayer = (parent, opacity = 0.9, width = 1.6) =>
    el("g", { stroke: LINE, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", opacity }, parent);

  // ---------- Hero: network of agents with scene vignettes ----------
  const W = 1440, H = 520;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice" }, document.getElementById("hero-art"));
  const defs = el("defs", {}, svg);
  const bg = el("linearGradient", { id: "hero-bg", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el("stop", { offset: "0", "stop-color": "#060d1a" }, bg);
  el("stop", { offset: "1", "stop-color": "#0d2647" }, bg);
  const glow = el("radialGradient", { id: "hero-glow" }, defs);
  el("stop", { offset: "0", "stop-color": GLOW, "stop-opacity": 0.55 }, glow);
  el("stop", { offset: "1", "stop-color": GLOW, "stop-opacity": 0 }, glow);
  el("rect", { width: W, height: H, fill: "url(#hero-bg)" }, svg);
  const grid = el("g", { stroke: "#16304f", "stroke-width": 1, opacity: 0.5 }, svg);
  for (let x = 0; x <= W; x += 40) el("line", { x1: x, y1: 0, x2: x, y2: H }, grid);
  for (let y = 0; y <= H; y += 40) el("line", { x1: 0, y1: y, x2: W, y2: y }, grid);

  // Deterministic pseudo-random nodes, placed on the right where the scenes sit.
  let state = 7;
  const rand = () => ((state = (state * 16807) % 2147483647) / 2147483647);
  const nodes = Array.from({ length: 70 }, () => ({ x: 380 + rand() * 1060, y: 20 + rand() * (H - 40) }));
  const net = el("g", { stroke: NET, "stroke-width": 1, opacity: 0.45 }, svg);
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((o) => o.j > i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2)
      .forEach((o) => el("line", { x1: a.x, y1: a.y, x2: nodes[o.j].x, y2: nodes[o.j].y }, net));
  });
  nodes.forEach((n, i) => el("circle", { cx: n.x, cy: n.y, r: i % 6 === 0 ? 3 : 1.8, fill: i % 6 === 0 ? GLOW : NET, class: i % 6 === 0 ? "pulse" : "" }, svg));

  // Central AI hub linked to the scenes.
  const hub = { x: 1010, y: 260 };
  const scenes = [
    { x: 1250, y: 110, draw: (g) => { icons.turbine(g, 1215, 70, 1); icons.turbine(g, 1265, 85, 0.8); icons.tower(g, 1320, 70, 1); } },
    { x: 1270, y: 330, draw: (g) => { icons.rack(g, 1230, 290, 1); icons.rack(g, 1285, 290, 1); icons.rack(g, 1340, 290, 1); } },
    { x: 760, y: 410, draw: (g) => { icons.intersection(g, 760, 420, 1); icons.trafficLight(g, 850, 340, 1); } },
    { x: 760, y: 120, draw: (g) => { icons.generator(g, 700, 120, 1.2); icons.generator(g, 760, 120, 1); icons.generator(g, 810, 120, 0.8); } },
  ];
  const links = el("g", { stroke: GLOW, "stroke-width": 1.6, fill: "none", opacity: 0.8 }, svg);
  scenes.forEach((sc) => el("path", { d: `M${hub.x},${hub.y} Q${(hub.x + sc.x) / 2},${hub.y} ${sc.x},${sc.y}`, class: "flow" }, links));
  scenes.forEach((sc) => sc.draw(iconLayer(svg)));
  el("circle", { cx: hub.x, cy: hub.y, r: 90, fill: "url(#hero-glow)" }, svg);
  el("path", { d: hexagon(hub.x, hub.y, 34), fill: "#0b1d36", stroke: GLOW, "stroke-width": 2 }, svg);
  el("text", { x: hub.x, y: hub.y + 8, "text-anchor": "middle", "font-size": 22, "font-weight": "bold", style: "fill:#e8f4ff" }, svg).textContent = "AI";

  function hexagon(cx, cy, r) {
    return Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      return `${k ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join("") + "Z";
  }

  // ---------- Scenario tiles ----------
  function tile(id, draw, viewBox = "0 0 240 140") {
    const t = el("svg", { viewBox, role: "img" }, document.getElementById(id));
    el("rect", { width: "100%", height: "100%", fill: "#0b1d36" }, t);
    draw(iconLayer(t, 1, 1.8));
  }
  tile("thumb-power", (g) => { icons.turbine(g, 50, 45, 0.8); icons.tower(g, 105, 40, 0.9); icons.generator(g, 160, 80, 1); icons.generator(g, 205, 80, 0.8); });
  tile("thumb-cloud", (g) => { icons.rack(g, 70, 30, 1); icons.rack(g, 120, 30, 1); icons.rack(g, 170, 30, 1); });
  tile("thumb-voltage", (g) => {
    icons.transformer(g, 40, 50, 0.9);
    el("line", { x1: 71, y1: 50, x2: 225, y2: 50 }, g);
    [100, 150, 200].forEach((x) => {
      el("line", { x1: x, y1: 50, x2: x, y2: 72 }, g);
      el("path", { d: `M${x - 16},${108} L${x - 16},${86} L${x},${72} L${x + 16},${86} L${x + 16},${108} Z`, fill: "none" }, g);
      el("path", { d: `M${x - 2},${75} L${x + 14},${85}`, stroke: GLOW, "stroke-width": 3 }, g);
    });
  });
  tile("thumb-more", (g) => { icons.trafficLight(g, 60, 25, 1); icons.transformer(g, 150, 70, 1.2); }, "0 0 220 120");

})();
