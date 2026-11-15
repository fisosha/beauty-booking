// FE-07: особистий кабінет майстра — керування послугами й робочим графіком.
// Працює через адмін-API бекенду (заголовок X-Admin-Token).
import { api, isMock } from "../api.js";
import { addDays, esc, formatDateLong, formatDuration, formatPrice, toISODate } from "../utils.js";
import { errorBox, loading, toast } from "./common.js";

const TOKEN_KEY = "admin-token";
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export async function cabinetView(root) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return loginView(root);

  root.innerHTML = loading();
  let masters;
  try {
    masters = await api.masters();
  } catch (e) {
    root.innerHTML = errorBox(e);
    return;
  }
  if (!masters.length) {
    root.innerHTML = `<p class="muted">Майстрів поки немає.</p>`;
    return;
  }
  const saved = Number(sessionStorage.getItem("cabinet-master"));
  const state = { masterId: masters.some((m) => m.id === saved) ? saved : masters[0].id };
  const today = toISODate(new Date());
  const in2w = toISODate(addDays(new Date(), 13));

  root.innerHTML = `
    <div class="cabinet-head">
      <div>
        <h1>Кабінет майстра</h1>
        <p class="muted">Послуги, ціни й робочий графік.</p>
      </div>
      <div class="row">
        <label for="master" class="sr-only">Майстер</label>
        <select id="master">${masters.map((m) =>
          `<option value="${m.id}" ${m.id === state.masterId ? "selected" : ""}>${esc(m.name)} — ${esc(m.specialization)}</option>`).join("")}</select>
        <button type="button" class="btn btn--ghost btn--sm" id="logout">Вийти</button>
      </div>
    </div>

    <div class="cabinet">
      <section class="card">
        <h2>Мої послуги</h2>
        <div id="services">${loading()}</div>
        <form id="service-form" class="form-grid" novalidate>
          <h3>Додати послугу</h3>
          <div class="field field--wide">
            <label for="s-name">Назва</label>
            <input id="s-name" name="name" required minlength="2" maxlength="100" placeholder="Наприклад, Педикюр">
          </div>
          <div class="field">
            <label for="s-duration">Тривалість, хв</label>
            <input id="s-duration" name="duration" type="number" min="5" max="480" step="5" value="60" required>
          </div>
          <div class="field">
            <label for="s-price">Ціна, ₴</label>
            <input id="s-price" name="price" type="number" min="0" step="10" value="500" required>
          </div>
          <button class="btn field--wide" type="submit">Додати послугу</button>
        </form>
      </section>

      <section class="card">
        <h2>Робочий графік</h2>
        <form id="schedule-form" class="form-grid" novalidate>
          <div class="field">
            <label for="d-from">З дати</label>
            <input id="d-from" name="from" type="date" value="${today}" min="${today}" required>
          </div>
          <div class="field">
            <label for="d-to">По дату</label>
            <input id="d-to" name="to" type="date" value="${in2w}" min="${today}" required>
          </div>
          <fieldset class="field field--wide weekdays">
            <legend>Робочі дні</legend>
            ${WD.map((d, i) => `<label class="wd"><input type="checkbox" name="wd" value="${i}" ${i < 5 ? "checked" : ""}><span>${d}</span></label>`).join("")}
          </fieldset>
          <div class="field">
            <label for="t-start">Початок</label>
            <input id="t-start" name="start" type="time" value="10:00" step="900" required>
          </div>
          <div class="field">
            <label for="t-end">Кінець</label>
            <input id="t-end" name="end" type="time" value="18:00" step="900" required>
          </div>
          <div class="alert alert--error is-hidden field--wide" id="schedule-error" role="alert"></div>
          <button class="btn field--wide" type="submit">Додати робочі години</button>
          <p class="muted small field--wide">Дні, на які вже є перетин із наявним графіком, пропускаються.
            Щоб додати перерву, створіть два інтервали, наприклад 10:00–14:00 і 15:00–19:00.</p>
        </form>
        <h3>Вільні дні на 2 тижні</h3>
        <div id="availability">${loading()}</div>
      </section>
    </div>`;

  const $ = (s) => root.querySelector(s);
  let services = [];

  async function loadServices() {
    $("#services").innerHTML = loading();
    try {
      services = await api.services(state.masterId);
      $("#services").innerHTML = services.length ? `
        <table class="table">
          <thead><tr><th>Послуга</th><th>Тривалість</th><th class="num">Ціна</th></tr></thead>
          <tbody>${services.map((s) => `<tr><td>${esc(s.name)}</td><td>${formatDuration(s.duration_min)}</td><td class="num">${formatPrice(s.price)}</td></tr>`).join("")}</tbody>
        </table>` : `<p class="muted">Послуг ще немає — додайте першу нижче.</p>`;
    } catch (e) {
      $("#services").innerHTML = errorBox(e);
    }
    loadAvailability();
  }

  async function loadAvailability() {
    const box = $("#availability");
    if (!services.length) {
      box.innerHTML = `<p class="muted">Додайте послугу, щоб побачити вільний час.</p>`;
      return;
    }
    // Найкоротша послуга показує, у які дні взагалі є вільні вікна.
    const shortest = services.reduce((a, b) => (a.duration_min <= b.duration_min ? a : b));
    box.innerHTML = loading();
    try {
      const { dates } = await api.availableDates(state.masterId, shortest.id, today, 14);
      const set = new Set(dates);
      box.innerHTML = `<div class="week-strip">${Array.from({ length: 14 }, (_, i) => {
        const iso = toISODate(addDays(new Date(), i));
        const d = addDays(new Date(), i);
        return `<div class="day ${set.has(iso) ? "day--ok" : "day--off"}" title="${esc(formatDateLong(iso))}">
          <span>${WD[(d.getDay() + 6) % 7]}</span><strong>${d.getDate()}</strong></div>`;
      }).join("")}</div>`;
    } catch (e) {
      box.innerHTML = errorBox(e);
    }
  }

  function onAuthError(err) {
    if (err.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      toast("Невірний токен доступу", "error");
      loginView(root);
      return true;
    }
    return false;
  }

  $("#master").onchange = (e) => {
    state.masterId = Number(e.target.value);
    sessionStorage.setItem("cabinet-master", state.masterId);
    loadServices();
  };

  $("#logout").onclick = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    loginView(root);
  };

  $("#service-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const duration = Number(f.duration.value);
    const price = Number(f.price.value);
    if (name.length < 2) return toast("Назва має містити щонайменше 2 символи", "error");
    if (!(duration > 0 && duration <= 480)) return toast("Тривалість — від 1 до 480 хвилин", "error");
    if (!(price >= 0) || f.price.value === "") return toast("Вкажіть ціну", "error");
    try {
      await api.admin.createService(sessionStorage.getItem(TOKEN_KEY),
        { master_id: state.masterId, name, duration_min: duration, price });
      toast("Послугу додано");
      f.name.value = "";
      loadServices();
    } catch (err) {
      if (!onAuthError(err)) toast(err.message, "error");
    }
  };

  $("#schedule-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $("#schedule-error");
    err.classList.add("is-hidden");
    const weekdays = [...f.querySelectorAll("input[name=wd]:checked")].map((x) => Number(x.value));
    const problem = !f.from.value || !f.to.value ? "Вкажіть діапазон дат"
      : f.from.value > f.to.value ? "Дата початку пізніша за дату кінця"
      : !weekdays.length ? "Оберіть хоча б один робочий день"
      : f.start.value >= f.end.value ? "Початок має бути раніше за кінець" : null;
    if (problem) {
      err.textContent = problem;
      err.classList.remove("is-hidden");
      return;
    }
    try {
      const { created } = await api.admin.createSchedule(sessionStorage.getItem(TOKEN_KEY), {
        master_id: state.masterId, date_from: f.from.value, date_to: f.to.value, weekdays,
        start_time: f.start.value, end_time: f.end.value,
      });
      toast(created ? `Додано робочих днів: ${created}` : "Нових днів не додано — графік на ці дні вже є");
      loadAvailability();
    } catch (er) {
      if (!onAuthError(er)) {
        err.textContent = er.message;
        err.classList.remove("is-hidden");
      }
    }
  };

  loadServices();
}

function loginView(root) {
  root.innerHTML = `
    <section class="card login">
      <h1>Кабінет майстра</h1>
      <p class="muted">Введіть токен доступу, щоб керувати послугами та графіком.</p>
      <form id="login" novalidate>
        <div class="field">
          <label for="token">Токен доступу</label>
          <input id="token" name="token" type="password" autocomplete="current-password" required>
          ${isMock() ? `<div class="muted small">Демо-режим: токен <code>admin-secret</code></div>` : ""}
        </div>
        <button class="btn btn--block" type="submit">Увійти</button>
      </form>
    </section>`;
  root.querySelector("#login").onsubmit = (e) => {
    e.preventDefault();
    const t = e.target.token.value.trim();
    if (!t) return toast("Введіть токен", "error");
    sessionStorage.setItem(TOKEN_KEY, t);
    cabinetView(root);
  };
}
