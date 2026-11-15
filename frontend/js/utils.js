// Допоміжні функції без залежностей від DOM — покриті тестами в tests/utils.test.js.

/** Date → "YYYY-MM-DD" у локальному часовому поясі. */
export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date (локальна північ). */
export function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** "HH:MM[:SS]" → "HH:MM". */
export function shortTime(t) {
  return String(t).slice(0, 5);
}

export function timeToMinutes(t) {
  const [h, m] = shortTime(t).split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Час завершення послуги: "10:00" + 90 хв → "11:30". */
export function endTime(start, durationMin) {
  return minutesToTime(timeToMinutes(start) + durationMin);
}

export function formatPrice(p) {
  return `${Number(p).toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴`;
}

export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} хв`;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

const MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
const WEEKDAYS = ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"];

/** "2026-11-17" → "вівторок, 17 листопада". */
export function formatDateLong(iso) {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** Ті самі правила, що й у бекенді (schemas.normalize_phone): +380XXXXXXXXX або 0XXXXXXXXX. */
export function normalizePhone(value) {
  const digits = String(value).replace(/[\s\-()]/g, "");
  if (!/^(\+?38)?0\d{9}$/.test(digits)) return null;
  return "+38" + digits.slice(-10);
}

export function validateName(value) {
  const v = String(value).trim();
  if (v.length < 2) return "Імʼя має містити щонайменше 2 символи";
  if (v.length > 100) return "Імʼя занадто довге";
  return null;
}

/** Розбиває слоти на частини доби для зручного вибору. */
export function groupSlots(slots) {
  const groups = { "Ранок": [], "День": [], "Вечір": [] };
  for (const s of slots) {
    const m = timeToMinutes(s);
    if (m < 12 * 60) groups["Ранок"].push(s);
    else if (m < 17 * 60) groups["День"].push(s);
    else groups["Вечір"].push(s);
  }
  return Object.entries(groups).filter(([, list]) => list.length);
}

/** Сітка місяця для календаря: масив тижнів (пн–нд), у кожному 7 Date або null. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // понеділок = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Екранування для вставки тексту в innerHTML. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
