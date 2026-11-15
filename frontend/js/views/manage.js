// FE-05: перевірка деталей запису за кодом і швидке скасування візиту клієнтом.
import { api } from "../api.js";
import { esc, formatDateLong, shortTime, toISODate } from "../utils.js";
import { toast } from "./common.js";

export function manageView(root, { code = "" } = {}) {
  root.innerHTML = `
    <h1>Мій запис</h1>
    <p class="muted">Введіть код, який ви отримали після бронювання.</p>
    <form class="code-form card" id="find" novalidate>
      <label for="code" class="sr-only">Код запису</label>
      <input id="code" name="code" placeholder="Наприклад, 3FA9C21B" autocomplete="off" autocapitalize="characters"
        maxlength="16" value="${esc(code)}" required>
      <button class="btn" type="submit">Знайти</button>
    </form>
    <div id="result" aria-live="polite"></div>`;

  const form = root.querySelector("#find");
  const result = root.querySelector("#result");

  function draw(b) {
    const cancelled = b.status === "cancelled";
    const past = b.date < toISODate(new Date());
    result.innerHTML = `
      <section class="card booking-card ${cancelled ? "is-cancelled" : ""}">
        <div class="booking-card__head">
          <div>
            <div class="muted small">Код ${esc(b.cancel_code)}</div>
            <h2>${esc(b.service_name)}</h2>
          </div>
          <span class="status ${cancelled ? "status--off" : "status--ok"}">${cancelled ? "Скасовано" : "Активний"}</span>
        </div>
        <dl class="details">
          <dt>Майстер</dt><dd>${esc(b.master_name)}</dd>
          <dt>Дата</dt><dd>${esc(formatDateLong(b.date))}</dd>
          <dt>Час</dt><dd>${shortTime(b.start_time)}–${shortTime(b.end_time)}</dd>
          <dt>Імʼя</dt><dd>${esc(b.client_name)}</dd>
        </dl>
        ${cancelled ? `<p class="muted">Запис скасовано. <a href="#/master/${b.master_id}">Записатися знову</a></p>`
          : past ? `<p class="muted">Цей візит уже минув.</p>`
          : `<div class="cancel-zone" id="cancel-zone">
              <button type="button" class="btn btn--danger" id="cancel">Скасувати запис</button>
            </div>`}
      </section>`;

    const btn = result.querySelector("#cancel");
    if (!btn) return;
    btn.onclick = () => {
      // Двокрокове підтвердження замість window.confirm — працює однаково на мобільних.
      result.querySelector("#cancel-zone").innerHTML = `
        <p><strong>Точно скасувати візит?</strong> Час звільниться для інших клієнтів.</p>
        <div class="row">
          <button type="button" class="btn btn--danger" id="yes">Так, скасувати</button>
          <button type="button" class="btn btn--ghost" id="no">Ні, залишити</button>
        </div>`;
      result.querySelector("#no").onclick = () => draw(b);
      result.querySelector("#yes").onclick = async (e) => {
        e.target.disabled = true;
        e.target.textContent = "Скасовуємо…";
        try {
          const updated = await api.cancelBooking(b.cancel_code);
          toast("Запис скасовано");
          draw(updated);
        } catch (err) {
          toast(err.message, "error");
          draw(b);
        }
      };
    };
  }

  async function find(value) {
    const c = value.trim().toUpperCase();
    if (!c) {
      result.innerHTML = `<div class="alert alert--error" role="alert">Введіть код запису.</div>`;
      return;
    }
    result.innerHTML = `<div class="loading" role="status"><span class="spinner"></span>Шукаємо…</div>`;
    try {
      draw(await api.booking(c));
      if (location.hash !== `#/check/${c}`) history.replaceState(null, "", `#/check/${c}`);
    } catch (err) {
      result.innerHTML = `<div class="alert alert--error" role="alert">${err.status === 404
        ? "Запис із таким кодом не знайдено. Перевірте код." : esc(err.message)}</div>`;
    }
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    find(form.code.value);
  };
  if (code) find(code);
}
