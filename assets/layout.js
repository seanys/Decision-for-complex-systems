// Shared site header and footer. Each page includes this script where the header or footer belongs:
//   <script src="assets/layout.js" data-part="header"></script>
//   <script src="assets/layout.js" data-part="footer"></script>
// The markup is inserted synchronously in place of the tag, so it renders before first paint.
(() => {
  const SITE = "AI for Complex Systems";
  const EMAIL = "yang-shan@nus.edu.sg";
  const HOMEPAGE = "https://seanys.github.io/";
  const TUTORIAL = "https://seanys.github.io/blog/2026/why-we-need-analytical-models-to-guide-training-for-scalable-multi-agent-learning/";
  const SCENARIOS = [
    ["power.html", "Power generation control"],
    ["cloud.html", "Cloud job scheduling"],
    ["voltage.html", "Distribution voltage control"],
    ["rebalancing.html", "Robotaxi fleet rebalancing"],
  ];
  const SOCIAL = [
    ["https://github.com/seanys", "GitHub", '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>'],
    ["https://scholar.google.com/citations?user=Z__RCosAAAAJ", "Google Scholar", '<path d="M8.211 2.047a.5.5 0 00-.422 0l-7.5 3.5a.5.5 0 00.025.917l7.5 3a.5.5 0 00.372 0L14 7.14V13a1 1 0 00-1 1v2h3v-2a1 1 0 00-1-1V6.739l.686-.275a.5.5 0 00.025-.917l-7.5-3.5z"/><path d="M4.176 9.032a.5.5 0 00-.656.327l-.5 1.7a.5.5 0 00.294.605l4.5 1.8a.5.5 0 00.372 0l4.5-1.8a.5.5 0 00.294-.605l-.5-1.7a.5.5 0 00-.656-.327L8 10.466 4.176 9.032z"/>'],
    ["https://www.linkedin.com/in/shan-yang-712135141", "LinkedIn", '<path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 01.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>'],
  ];
  const MAIL_ICON = '<path d="M.05 3.555A2 2 0 012 2h12a2 2 0 011.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 002 14h12a2 2 0 001.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/>';

  const here = location.pathname.split("/").pop() || "index.html";
  const current = (href) => (href === here ? ' aria-current="page"' : "");
  const scenarioLinks = SCENARIOS.map(([href, name]) => `<a href="${href}"${current(href)}>${name}</a>`).join("");

  const header = `
  <header class="site-header">
    <div class="header-inner">
      <a class="header-brand" href="index.html">${SITE}</a>
      <nav class="header-nav" aria-label="Site">
        <details class="nav-menu">
          <summary>Scenarios</summary>
          <div class="nav-menu-list">${scenarioLinks}</div>
        </details>
        <a href="${TUTORIAL}">Tutorial</a>
      </nav>
    </div>
  </header>`;

  const footer = `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <p class="footer-title">${SITE}</p>
        <p>Interactive scenarios of AI agents making real-time decisions in large systems.</p>
      </div>
      <nav class="footer-col" aria-label="Scenarios">
        <p class="footer-head">Scenarios</p>
        ${scenarioLinks}
      </nav>
      <nav class="footer-col" aria-label="Resources">
        <p class="footer-head">Resources</p>
        <a href="${HOMEPAGE}">Homepage</a>
        <a href="${TUTORIAL}">Tutorial</a>
      </nav>
      <div class="footer-col footer-contact">
        <p class="footer-head">Contact</p>
        <a class="footer-email" href="mailto:${EMAIL}"><svg viewBox="0 0 16 16" aria-hidden="true">${MAIL_ICON}</svg>${EMAIL}</a>
        <div class="footer-icons">${SOCIAL.map(([href, label, path]) =>
          `<a href="${href}" title="${label}" aria-label="${label}"><svg viewBox="0 0 16 16">${path}</svg></a>`).join("")}</div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© Copyright 2026 <a href="${HOMEPAGE}">YANG Shan</a>.</span>
      <a href="#">Back to top ↑</a>
    </div>
  </footer>`;

  const script = document.currentScript;
  const part = script.dataset.part;
  script.insertAdjacentHTML("beforebegin", part === "header" ? header : footer);

  if (part === "header") {
    // Close the scenarios menu on an outside click or Escape.
    const menu = script.previousElementSibling.querySelector(".nav-menu");
    document.addEventListener("click", (event) => { if (!menu.contains(event.target)) menu.open = false; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") menu.open = false; });
  }
})();
