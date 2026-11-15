// FE-03: вибір часового слота. Слоти приходять із бекенду вже з урахуванням
// тривалості обраної послуги, тут вони групуються й показується час завершення.
import { endTime, esc, groupSlots } from "../utils.js";

/**
 * @param {HTMLElement} root
 * @param {{ slots: string[], duration: number, selected?: string, onSelect: (t: string) => void }} opts
 */
export function renderSlots(root, opts) {
  if (!opts.slots.length) {
    root.innerHTML = `<p class="muted">На цей день вільного часу вже немає. Оберіть іншу дату.</p>`;
    return;
  }
  root.innerHTML = groupSlots(opts.slots).map(([label, list]) => `
    <div class="slots__group">
      <div class="slots__label">${label}</div>
      <div class="slots__list">
        ${list.map((t) => `
          <button type="button" class="slot ${t === opts.selected ? "is-selected" : ""}" data-time="${esc(t)}"
            aria-pressed="${t === opts.selected}" title="${t}–${endTime(t, opts.duration)}">
            ${t}<small>до ${endTime(t, opts.duration)}</small>
          </button>`).join("")}
      </div>
    </div>`).join("");

  root.onclick = (e) => {
    const b = e.target.closest("[data-time]");
    if (!b) return;
    root.querySelectorAll(".slot").forEach((x) => {
      const on = x === b;
      x.classList.toggle("is-selected", on);
      x.setAttribute("aria-pressed", on);
    });
    opts.onSelect(b.dataset.time);
  };
}
