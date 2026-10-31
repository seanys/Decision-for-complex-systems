// Close the scenarios menu on an outside click or Escape.
(() => {
  const menu = document.querySelector(".nav-menu");
  if (!menu) return;
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") menu.open = false;
  });
})();
