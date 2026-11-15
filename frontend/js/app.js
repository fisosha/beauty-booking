// Точка входу: hash-маршрутизація між сторінками.
import { init, isMock, resetMock } from "./api.js";
import { masterView, mastersView } from "./views/catalog.js";
import { bookingView, successView } from "./views/booking.js";
import { manageView } from "./views/manage.js";
import { cabinetView } from "./views/cabinet.js";

const routes = [
  [/^#?\/?$/, mastersView, []],
  [/^#\/master\/(\d+)$/, masterView, ["id"]],
  [/^#\/book\/(\d+)\/(\d+)$/, bookingView, ["masterId", "serviceId"]],
  [/^#\/success\/([\w-]+)$/, successView, ["code"]],
  [/^#\/check(?:\/([\w-]+))?$/, manageView, ["code"]],
  [/^#\/cabinet$/, cabinetView, []],
];

const root = document.getElementById("app");

function render() {
  const hash = location.hash || "#/";
  for (const [re, view, keys] of routes) {
    const m = hash.match(re);
    if (m) {
      const params = Object.fromEntries(keys.map((k, i) => [k, m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined]));
      const section = hash.startsWith("#/check") ? "#/check" : hash.startsWith("#/cabinet") ? "#/cabinet" : "#/";
      document.querySelectorAll(".nav a").forEach((a) => {
        const on = a.getAttribute("href") === section;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      window.scrollTo(0, 0);
      view(root, params);
      root.focus({ preventScroll: true });
      return;
    }
  }
  root.innerHTML = `<div class="empty"><h1>Сторінку не знайдено</h1><a class="btn" href="#/">На головну</a></div>`;
}

(async () => {
  await init();
  if (isMock()) {
    const bar = document.getElementById("demo-bar");
    bar.hidden = false;
    bar.querySelector("button").onclick = () => {
      resetMock();
      sessionStorage.clear();
      location.hash = "#/";
      render();
    };
  }
  window.addEventListener("hashchange", render);
  render();
})();
