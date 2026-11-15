// Сценарій бронювання: FE-02 (календар) → FE-03 (слоти) → FE-04 (контакти + екран успіху).
import { api } from "../api.js";
import { CALENDAR_DAYS } from "../config.js";
import { renderCalendar } from "../components/calendar.js";
import { renderSlots } from "../components/slots.js";
import { addDays, endTime, esc, formatDateLong, formatDuration, formatPrice, normalizePhone,
  shortTime, toISODate, validateName } from "../utils.js";
import { errorBox, loading, toast } from "./common.js";

export async function bookingView(root, { masterId, serviceId }) {
  root.innerHTML = loading();
  let master;
  try {
    master = await api.master(masterId);
  } catch (e) {
    root.innerHTML = errorBox(e, `<a class="btn btn--ghost" href="#/">До каталогу</a>`);
    return;
  }
  const service = master.services.find((s) => s.id === Number(serviceId));
  if (!service) {
    root.innerHTML = errorBox(new Error("Послугу не знайдено"), `<a class="btn btn--ghost" href="#/master/${master.id}">До послуг майстра</a>`);
    return;
  }

  const state = { date: null, time: null };
  const today = new Date();
  const maxDate = addDays(today, CALENDAR_DAYS - 1);

  root.innerHTML = `
    <a class="back" href="#/master/${master.id}">← ${esc(master.name)}</a>
    <h1>Запис на «${esc(service.name)}»</h1>
    <div class="booking">
      <div class="booking__main">
        <section class="step" id="step-date">
          <h2><span class="step__n">1</span>Оберіть дату</h2>
          <div id="calendar">${loading("Шукаємо вільні дні…")}</div>
        </section>
        <section class="step is-locked" id="step-time">
          <h2><span class="step__n">2</span>Оберіть час</h2>
          <div id="slots"><p class="muted">Спочатку оберіть дату.</p></div>
        </section>
        <section class="step is-locked" id="step-form">
          <h2><span class="step__n">3</span>Ваші контакти</h2>
          <form id="form" novalidate>
            <div class="field">
              <label for="name">Імʼя</label>
              <input id="name" name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Наприклад, Анна">
              <div class="field__error" id="name-error"></div>
            </div>
            <div class="field">
              <label for="phone">Телефон</label>
              <input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+380 67 123 45 67">
              <div class="field__error" id="phone-error"></div>
            </div>
            <div class="alert alert--error is-hidden" id="form-error" role="alert"></div>
            <button class="btn btn--block" type="submit" id="submit" disabled>Підтвердити запис</button>
          </form>
        </section>
      </div>
      <aside class="summary card" aria-live="polite">
        <div class="summary__title">Ваш запис</div>
        <dl>
          <dt>Майстер</dt><dd>${esc(master.name)}</dd>
          <dt>Послуга</dt><dd>${esc(service.name)}</dd>
          <dt>Тривалість</dt><dd>${formatDuration(service.duration_min)}</dd>
          <dt>Дата</dt><dd id="sum-date">—</dd>
          <dt>Час</dt><dd id="sum-time">—</dd>
        </dl>
        <div class="summary__price"><span>До сплати</span><strong>${formatPrice(service.price)}</strong></div>
        <p class="muted small">Оплата в салоні після візиту.</p>
      </aside>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const form = $("#form");

  function refreshSummary() {
    $("#sum-date").textContent = state.date ? formatDateLong(state.date) : "—";
    $("#sum-time").textContent = state.time ? `${state.time}–${endTime(state.time, service.duration_min)}` : "—";
    $("#step-time").classList.toggle("is-locked", !state.date);
    $("#step-form").classList.toggle("is-locked", !state.time);
    $("#submit").disabled = !(state.date && state.time);
  }

  async function loadSlots() {
    const box = $("#slots");
    box.innerHTML = loading("Завантажуємо вільний час…");
    try {
      const data = await api.slots(master.id, service.id, state.date);
      renderSlots(box, {
        slots: data.slots, duration: data.duration_min, selected: state.time,
        onSelect: (t) => {
          state.time = t;
          refreshSummary();
          if (window.matchMedia("(max-width: 860px)").matches) $("#step-form").scrollIntoView({ behavior: "smooth", block: "start" });
        },
      });
    } catch (e) {
      box.innerHTML = errorBox(e);
    }
  }

  async function loadCalendar() {
    try {
      const data = await api.availableDates(master.id, service.id, toISODate(today), CALENDAR_DAYS);
      const available = new Set(data.dates);
      if (!available.size) {
        $("#calendar").innerHTML = `<p class="muted">На найближчі ${CALENDAR_DAYS} днів вільного часу немає. Спробуйте іншу послугу чи майстра.</p>`;
        return;
      }
      renderCalendar($("#calendar"), {
        available, minDate: today, maxDate, selected: state.date,
        onSelect: (iso) => {
          state.date = iso;
          state.time = null;
          refreshSummary();
          loadSlots();
        },
      });
    } catch (e) {
      $("#calendar").innerHTML = errorBox(e);
    }
  }

  function validate() {
    const nameErr = validateName(form.name.value);
    const phone = normalizePhone(form.phone.value);
    const phoneErr = phone ? null : "Введіть номер у форматі +380XXXXXXXXX або 0XXXXXXXXX";
    $("#name-error").textContent = nameErr || "";
    $("#phone-error").textContent = phoneErr || "";
    form.name.setAttribute("aria-invalid", !!nameErr);
    form.phone.setAttribute("aria-invalid", !!phoneErr);
    return nameErr || phoneErr ? null : { name: form.name.value.trim(), phone };
  }

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true") validate();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = $("#form-error");
    errBox.classList.add("is-hidden");
    const data = validate();
    if (!data || !state.date || !state.time) return;
    const btn = $("#submit");
    btn.disabled = true;
    btn.textContent = "Бронюємо…";
    try {
      const booking = await api.createBooking({
        service_id: service.id, date: state.date, start_time: state.time,
        client_name: data.name, client_phone: data.phone,
      });
      sessionStorage.setItem("last-booking", JSON.stringify(booking));
      location.hash = `#/success/${booking.cancel_code}`;
    } catch (err) {
      btn.textContent = "Підтвердити запис";
      if (err.status === 409) {
        // Слот щойно зайняли — оновлюємо список і просимо обрати інший час.
        toast("Цей час щойно забронювали. Оберіть інший.", "error");
        state.time = null;
        refreshSummary();
        loadSlots();
        $("#step-time").scrollIntoView({ behavior: "smooth" });
      } else {
        errBox.textContent = err.message;
        errBox.classList.remove("is-hidden");
        btn.disabled = false;
      }
    }
  });

  refreshSummary();
  loadCalendar();
}

/** FE-04: екран успіху з кодом запису. */
export async function successView(root, { code }) {
  let booking = null;
  try {
    const cached = JSON.parse(sessionStorage.getItem("last-booking") || "null");
    if (cached?.cancel_code === code) booking = cached;
  } catch { /* ignore */ }
  if (!booking) {
    root.innerHTML = loading();
    try {
      booking = await api.booking(code);
    } catch (e) {
      root.innerHTML = errorBox(e, `<a class="btn btn--ghost" href="#/">На головну</a>`);
      return;
    }
  }
  root.innerHTML = `
    <section class="success card">
      <div class="success__icon" aria-hidden="true">✓</div>
      <h1>Ви записані!</h1>
      <p class="muted">Чекаємо на вас ${esc(formatDateLong(booking.date))} о ${shortTime(booking.start_time)}.</p>
      <dl class="details">
        <dt>Майстер</dt><dd>${esc(booking.master_name)}</dd>
        <dt>Послуга</dt><dd>${esc(booking.service_name)}</dd>
        <dt>Час</dt><dd>${shortTime(booking.start_time)}–${shortTime(booking.end_time)}</dd>
        <dt>Імʼя</dt><dd>${esc(booking.client_name)}</dd>
      </dl>
      <div class="code-box">
        <div class="muted small">Код запису — збережіть його, щоб перевірити або скасувати візит</div>
        <div class="code" id="code">${esc(booking.cancel_code)}</div>
        <button type="button" class="btn btn--ghost btn--sm" id="copy">Скопіювати код</button>
      </div>
      <div class="success__actions">
        <a class="btn btn--ghost" href="#/check/${esc(booking.cancel_code)}">Керувати записом</a>
        <a class="btn" href="#/">На головну</a>
      </div>
    </section>`;
  root.querySelector("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(booking.cancel_code);
      toast("Код скопійовано");
    } catch {
      toast("Не вдалося скопіювати — перепишіть код вручну", "error");
    }
  };
}
