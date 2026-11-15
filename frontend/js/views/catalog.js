// FE-01: адаптивний каталог майстрів і сторінка майстра зі списком послуг та цінами.
import { api } from "../api.js";
import { esc, formatDuration, formatPrice } from "../utils.js";
import { errorBox, loading } from "./common.js";

const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

export async function mastersView(root) {
  root.innerHTML = `
    <section class="hero">
      <h1>Запис до майстра — за хвилину</h1>
      <p>Оберіть майстра й послугу, подивіться вільний час і забронюйте візит без дзвінків.</p>
    </section>
    <div class="chips" id="filters"></div>
    <div id="list">${loading()}</div>`;

  let masters;
  try {
    masters = await api.masters();
  } catch (e) {
    root.querySelector("#list").innerHTML = errorBox(e);
    return;
  }

  const specs = [...new Set(masters.map((m) => m.specialization))];
  const filters = root.querySelector("#filters");
  const list = root.querySelector("#list");
  let active = "";

  function draw() {
    filters.innerHTML = ["", ...specs].map((s) =>
      `<button type="button" class="chip ${s === active ? "is-active" : ""}" data-spec="${esc(s)}">${s ? esc(s) : "Усі"}</button>`).join("");
    const shown = masters.filter((m) => !active || m.specialization === active);
    list.innerHTML = shown.length ? `<div class="grid">${shown.map((m) => `
      <a class="card master-card" href="#/master/${m.id}">
        <div class="avatar" aria-hidden="true">${esc(initials(m.name))}</div>
        <div>
          <div class="card__title">${esc(m.name)}</div>
          <div class="badge">${esc(m.specialization)}</div>
        </div>
        <span class="card__arrow" aria-hidden="true">→</span>
      </a>`).join("")}</div>`
      : `<p class="muted">Майстрів поки немає.</p>`;
  }

  filters.onclick = (e) => {
    const b = e.target.closest("[data-spec]");
    if (!b) return;
    active = b.dataset.spec;
    draw();
  };
  draw();
}

export async function masterView(root, { id }) {
  root.innerHTML = loading();
  let master;
  try {
    master = await api.master(id);
  } catch (e) {
    root.innerHTML = errorBox(e, `<a class="btn btn--ghost" href="#/">До каталогу</a>`);
    return;
  }
  root.innerHTML = `
    <a class="back" href="#/">← Усі майстри</a>
    <section class="master-head">
      <div class="avatar avatar--lg" aria-hidden="true">${esc(initials(master.name))}</div>
      <div>
        <h1>${esc(master.name)}</h1>
        <div class="badge">${esc(master.specialization)}</div>
      </div>
    </section>
    <h2>Послуги та ціни</h2>
    ${master.services.length ? `
    <ul class="services">
      ${master.services.map((s) => `
        <li class="service">
          <div class="service__info">
            <div class="service__name">${esc(s.name)}</div>
            <div class="muted">⏱ ${formatDuration(s.duration_min)}</div>
          </div>
          <div class="service__price">${formatPrice(s.price)}</div>
          <a class="btn" href="#/book/${master.id}/${s.id}">Записатися</a>
        </li>`).join("")}
    </ul>` : `<p class="muted">У майстра поки немає послуг.</p>`}`;
}
