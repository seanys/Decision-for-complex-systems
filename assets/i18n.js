// Language switch (English / 中文) shared by all pages.
// Each page loads this script synchronously in <head>:
//   <script src="assets/i18n.js"></script>
//
// - I18N.t(english, vars) returns the text in the current language. The English text is the key into the
//   Chinese dictionary (assets/i18n-zh.js); {name} placeholders are filled from vars. A text without a
//   translation stays in English.
// - I18N.apply() translates the static text of the page: every heading, paragraph, label, ... inside <main>
//   and the hero whose own text contains Latin letters is looked up by its HTML, with whitespace collapsed.
//   layout.js calls it right after inserting the footer, before the page scripts run.
// - Every element with [data-lang-switch] receives the EN / 中文 toggle.
// The choice is kept in localStorage and shown in the URL: Chinese pages carry ?lang=zh (added on load and to
// every link within the site), English pages have no parameter. ?lang=en in the URL also sets English.
(function () {
  const STORE = "site-lang";
  const store = {
    get() { try { return localStorage.getItem(STORE); } catch (e) { return null; } },
    set(value) { try { localStorage.setItem(STORE, value); return localStorage.getItem(STORE) === value; } catch (e) { return false; } },
  };
  const param = new URLSearchParams(location.search).get("lang");
  const lang = param === "zh" || param === "en" ? param : store.get() === "zh" ? "zh" : "en";
  if (param === lang) store.set(lang);
  const zh = lang === "zh";
  const ZH = window.I18N_ZH || {};
  const own = (key) => Object.prototype.hasOwnProperty.call(ZH, key);

  // Show the language in the address bar: ?lang=zh for Chinese, nothing for English.
  if (zh && param !== "zh") {
    const url = new URL(location.href);
    url.searchParams.set("lang", "zh");
    try { history.replaceState(history.state, "", url.href); } catch (e) { /* some file:// setups refuse */ }
  }

  // Links to other pages of the site carry the language, so the URL always says which one is shown.
  function localize(link) {
    const href = link.getAttribute("href");
    if (!zh || !href || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return;
    const url = new URL(href, location.href);
    if (url.protocol !== location.protocol || url.host !== location.host || !/(\.html|\/)$/.test(url.pathname)) return;
    url.searchParams.set("lang", "zh");
    link.setAttribute("href", href.replace(/[?#].*$/, "") + url.search + url.hash);
  }
  if (zh) document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (link) localize(link);
  }, true);

  const root = document.documentElement;
  root.lang = zh ? "zh-CN" : "en";
  // Hide the page until its static text is translated, so that English does not flash first.
  if (zh) {
    root.classList.add("i18n-pending");
    const reveal = () => root.classList.remove("i18n-pending");
    document.addEventListener("DOMContentLoaded", reveal);
    setTimeout(reveal, 3000);
  }

  // Texts asked for in Chinese that have no translation (for checking the dictionary).
  const missing = new Set();

  function t(text, vars) {
    let out = text;
    if (zh) {
      if (own(text)) out = ZH[text];
      else missing.add(text);
    }
    if (vars) out = out.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
    return out;
  }

  const TEXT = "h1, h2, h3, p, b, span, a, button, summary, mtext";
  const hasOwnLatin = (node) => [...node.childNodes].some((c) => c.nodeType === 3 && /[A-Za-z]/.test(c.nodeValue));

  function apply() {
    if (zh) {
      document.title = t(document.title);
      for (const scope of document.querySelectorAll("main, .hero")) {
        for (const node of scope.querySelectorAll(TEXT)) {
          if (!node.isConnected || !hasOwnLatin(node)) continue;
          const key = node.innerHTML.replace(/\s+/g, " ").trim();
          if (own(key)) node.innerHTML = ZH[key];
          else missing.add(key);
        }
      }
    }
    document.querySelectorAll("a[href]").forEach(localize);
    mountSwitches();
    root.classList.remove("i18n-pending");
  }

  function setLang(next) {
    store.set(next);
    const url = new URL(location.href);
    if (next === "zh") url.searchParams.set("lang", "zh");
    else url.searchParams.delete("lang");
    location.href = url.href;
  }

  function mountSwitches() {
    for (const box of document.querySelectorAll("[data-lang-switch]")) {
      if (box.childElementCount) continue;
      box.classList.add("lang-switch");
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "Language / 语言");
      box.innerHTML =
        `<button type="button" lang="en" data-lang="en" aria-pressed="${!zh}" title="English">EN</button>` +
        `<button type="button" lang="zh-CN" data-lang="zh" aria-pressed="${zh}" title="中文">中文</button>`;
      box.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-lang]");
        if (button && button.dataset.lang !== lang) setLang(button.dataset.lang);
      });
    }
  }

  window.I18N = { lang, zh, locale: zh ? "zh-CN" : "en-GB", t, apply, mountSwitches, missing };
})();
