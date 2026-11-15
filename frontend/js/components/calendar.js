// FE-02: інтерактивний календар із підсвіченими доступними датами.
import { monthGrid, toISODate } from "../utils.js";

const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/**
 * @param {HTMLElement} root
 * @param {{ available: Set<string>, minDate: Date, maxDate: Date, selected?: string,
 *           onSelect: (iso: string) => void }} opts
 */
export function renderCalendar(root, opts) {
  const state = {
    year: opts.minDate.getFullYear(),
    month: opts.minDate.getMonth(),
    selected: opts.selected || null,
  };
  // Відкрити місяць із першою доступною датою.
  const first = [...opts.available].sort()[0];
  if (!state.selected && first) {
    const [y, m] = first.split("-").map(Number);
    state.year = y;
    state.month = m - 1;
  }
  const minKey = opts.minDate.getFullYear() * 12 + opts.minDate.getMonth();
  const maxKey = opts.maxDate.getFullYear() * 12 + opts.maxDate.getMonth();
  const todayIso = toISODate(new Date());

  function draw() {
    const key = state.year * 12 + state.month;
    const weeks = monthGrid(state.year, state.month);
    root.innerHTML = `
      <div class="cal" role="group" aria-label="Вибір дати">
        <div class="cal__head">
          <button type="button" class="icon-btn" data-nav="-1" aria-label="Попередній місяць" ${key <= minKey ? "disabled" : ""}>‹</button>
          <div class="cal__title">${MONTHS[state.month]} ${state.year}</div>
          <button type="button" class="icon-btn" data-nav="1" aria-label="Наступний місяць" ${key >= maxKey ? "disabled" : ""}>›</button>
        </div>
        <div class="cal__grid cal__wd">${WD.map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="cal__grid">
          ${weeks.flat().map((d) => {
            if (!d) return `<span class="cal__cell cal__cell--empty"></span>`;
            const iso = toISODate(d);
            const ok = opts.available.has(iso);
            const cls = ["cal__cell", ok ? "is-available" : "is-disabled",
              iso === state.selected ? "is-selected" : "", iso === todayIso ? "is-today" : ""].join(" ");
            return `<button type="button" class="${cls}" data-date="${iso}" ${ok ? "" : "disabled"}
              aria-pressed="${iso === state.selected}" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}${ok ? "" : " — немає вільного часу"}">${d.getDate()}</button>`;
          }).join("")}
        </div>
        <div class="cal__legend">
          <span><i class="dot dot--ok"></i>є вільний час</span>
          <span><i class="dot dot--off"></i>недоступно</span>
        </div>
      </div>`;
  }

  root.onclick = (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav && !nav.disabled) {
      const m = state.month + Number(nav.dataset.nav);
      state.year += Math.floor(m / 12);
      state.month = (m + 12) % 12;
      draw();
      return;
    }
    const cell = e.target.closest("[data-date]");
    if (cell && !cell.disabled) {
      state.selected = cell.dataset.date;
      draw();
      opts.onSelect(state.selected);
    }
  };

  draw();
}
