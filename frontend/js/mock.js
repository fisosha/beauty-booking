// Демо-бекенд у браузері: ті самі ендпоінти й правила, що й FastAPI-бекенд
// (дані як у backend/seed.py, крок слотів 15 хв, без подвійного запису).
// Потрібен, щоб показати фронт без запущеного сервера; дані живуть у localStorage.
import { addDays, endTime, normalizePhone, shortTime, timeToMinutes, minutesToTime,
  toISODate, parseISODate } from "./utils.js";

const STORAGE_KEY = "beauty-booking-mock-v1";
const SLOT_STEP_MIN = 15;

const SEED_MASTERS = [
  ["Олена Коваль", "Манікюр", [["Манікюр класичний", 60, 450], ["Покриття гель-лаком", 90, 650], ["Зняття покриття", 30, 150]]],
  ["Ірина Мельник", "Брови та вії", [["Корекція брів", 30, 300], ["Фарбування брів", 45, 350], ["Ламінування вій", 60, 600]]],
  ["Марта Шевчук", "Перукар", [["Жіноча стрижка", 60, 500], ["Укладка", 45, 400], ["Фарбування волосся", 120, 1400]]],
];

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function seed(today = new Date()) {
  const db = { masters: [], services: [], schedule: [], bookings: [], seq: { m: 0, s: 0, t: 0, b: 0 } };
  for (const [name, specialization, items] of SEED_MASTERS) {
    const id = ++db.seq.m;
    db.masters.push({ id, name, specialization });
    for (const [n, d, p] of items) db.services.push({ id: ++db.seq.s, master_id: id, name: n, duration_min: d, price: p });
  }
  for (const m of db.masters) {
    addScheduleTo(db, m.id, toISODate(today), toISODate(addDays(today, 13)), [0, 1, 2, 3, 4, 5], "10:00", "14:00");
    addScheduleTo(db, m.id, toISODate(today), toISODate(addDays(today, 13)), [0, 1, 2, 3, 4], "15:00", "19:00");
  }
  return db;
}

function overlaps(aS, aE, bS, bE) {
  return aS < bE && bS < aE;
}

function addScheduleTo(db, masterId, from, to, weekdays, start, end) {
  let created = 0;
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  for (let d = parseISODate(from); d <= parseISODate(to); d = addDays(d, 1)) {
    const wd = (d.getDay() + 6) % 7;
    const iso = toISODate(d);
    const existing = db.schedule.filter((t) => t.master_id === masterId && t.date === iso);
    if (weekdays.includes(wd) && !existing.some((t) => overlaps(s, e, timeToMinutes(t.start_time), timeToMinutes(t.end_time)))) {
      db.schedule.push({ id: ++db.seq.t, master_id: masterId, date: iso, start_time: start, end_time: end });
      created++;
    }
  }
  return created;
}

/** Та сама логіка, що й backend/app/slots.py::generate_free_slots. */
export function generateFreeSlots(work, busy, duration, step = SLOT_STEP_MIN, day = null, now = null) {
  let minStart = null;
  if (day && now) {
    const today = toISODate(now);
    if (day < today) return [];
    if (day === today) minStart = now.getHours() * 60 + now.getMinutes();
  }
  const b = busy.map(([s, e]) => [timeToMinutes(s), timeToMinutes(e)]);
  const result = new Set();
  for (const [ws, we] of work) {
    const start = timeToMinutes(ws);
    const end = timeToMinutes(we);
    for (let m = start; m + duration <= end; m += step) {
      if (minStart !== null && m < minStart) continue;
      if (b.every(([bs, be]) => !(m < be && bs < m + duration))) result.add(m);
    }
  }
  return [...result].sort((x, y) => x - y).map(minutesToTime);
}

export class MockApi {
  constructor(storage = globalThis.localStorage, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
    this.db = this.load();
  }

  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* пошкоджені дані — пересіяти */ }
    const db = seed(this.now());
    this.save(db);
    return db;
  }

  save(db = this.db) {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* приватний режим */ }
  }

  reset() {
    this.db = seed(this.now());
    this.save();
  }

  master(id) {
    const m = this.db.masters.find((x) => x.id === Number(id));
    if (!m) throw new ApiError(404, "майстра не знайдено");
    return m;
  }

  service(id) {
    const s = this.db.services.find((x) => x.id === Number(id));
    if (!s) throw new ApiError(404, "послугу не знайдено");
    return s;
  }

  freeSlots(masterId, serviceId, day) {
    const service = this.service(serviceId);
    if (service.master_id !== Number(masterId)) throw new ApiError(404, "у цього майстра немає такої послуги");
    const work = this.db.schedule.filter((t) => t.master_id === service.master_id && t.date === day)
      .map((t) => [t.start_time, t.end_time]);
    const busy = this.db.bookings.filter((b) => b.master_id === service.master_id && b.date === day && b.status === "active")
      .map((b) => [b.start_time, b.end_time]);
    return generateFreeSlots(work, busy, service.duration_min, SLOT_STEP_MIN, day, this.now());
  }

  bookingOut(b) {
    const s = this.service(b.service_id);
    const m = this.master(b.master_id);
    return { ...b, service_name: s.name, master_name: m.name, client_phone: undefined };
  }

  /** Маршрутизатор: імітує HTTP-запит до бекенду. */
  async request(method, path, body, headers = {}) {
    await new Promise((r) => setTimeout(r, 120)); // невелика затримка, як у мережі
    const url = new URL(path, "http://mock");
    const p = url.pathname;
    const q = url.searchParams;
    let m;

    if (p.startsWith("/api/admin/")) {
      if (headers["X-Admin-Token"] !== "admin-secret") throw new ApiError(401, "невірний адмін-токен");
    }

    if (method === "GET" && p === "/health") return { status: "ok" };
    if (method === "GET" && p === "/api/masters") return this.db.masters;
    if (method === "GET" && (m = p.match(/^\/api\/masters\/(\d+)$/))) {
      return { ...this.master(m[1]), services: this.db.services.filter((s) => s.master_id === Number(m[1])) };
    }
    if (method === "GET" && (m = p.match(/^\/api\/masters\/(\d+)\/services$/))) {
      this.master(m[1]);
      return this.db.services.filter((s) => s.master_id === Number(m[1]));
    }
    if (method === "GET" && (m = p.match(/^\/api\/masters\/(\d+)\/slots$/))) {
      const day = q.get("date");
      const service = this.service(q.get("service_id"));
      return { master_id: Number(m[1]), service_id: service.id, date: day, duration_min: service.duration_min,
        slots: this.freeSlots(m[1], service.id, day) };
    }
    if (method === "GET" && (m = p.match(/^\/api\/masters\/(\d+)\/available-dates$/))) {
      const start = parseISODate(q.get("start"));
      const days = Number(q.get("days") || 14);
      const sid = q.get("service_id");
      const dates = [];
      for (let i = 0; i < days; i++) {
        const d = toISODate(addDays(start, i));
        if (this.freeSlots(m[1], sid, d).length) dates.push(d);
      }
      return { master_id: Number(m[1]), service_id: Number(sid), dates };
    }
    if (method === "POST" && p === "/api/bookings") {
      const name = String(body.client_name || "").trim();
      const phone = normalizePhone(body.client_phone || "");
      if (name.length < 2) throw new ApiError(422, "імʼя занадто коротке");
      if (!phone) throw new ApiError(422, "номер телефону має бути у форматі +380XXXXXXXXX або 0XXXXXXXXX");
      const service = this.service(body.service_id);
      const start = shortTime(body.start_time);
      if (!this.freeSlots(service.master_id, service.id, body.date).includes(start)) {
        throw new ApiError(409, "цей час уже зайнятий або недоступний");
      }
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
      const b = { id: ++this.db.seq.b, master_id: service.master_id, service_id: service.id, client_name: name,
        client_phone: phone, date: body.date, start_time: start, end_time: endTime(start, service.duration_min),
        status: "active", cancel_code: code };
      this.db.bookings.push(b);
      this.save();
      return this.bookingOut(b);
    }
    if ((m = p.match(/^\/api\/bookings\/([^/]+)(\/cancel)?$/))) {
      const b = this.db.bookings.find((x) => x.cancel_code === decodeURIComponent(m[1]).toUpperCase());
      if (!b) throw new ApiError(404, "запис не знайдено");
      if (method === "POST" && m[2]) {
        b.status = "cancelled";
        this.save();
      }
      return this.bookingOut(b);
    }
    if (method === "POST" && p === "/api/admin/services") {
      this.master(body.master_id);
      if (String(body.name || "").trim().length < 2) throw new ApiError(422, "назва занадто коротка");
      if (!(body.duration_min > 0 && body.duration_min <= 480)) throw new ApiError(422, "тривалість 1–480 хв");
      if (!(body.price >= 0)) throw new ApiError(422, "ціна не може бути відʼємною");
      const s = { id: ++this.db.seq.s, master_id: Number(body.master_id), name: body.name.trim(),
        duration_min: Number(body.duration_min), price: Number(body.price) };
      this.db.services.push(s);
      this.save();
      return s;
    }
    if (method === "POST" && p === "/api/admin/schedule") {
      this.master(body.master_id);
      if (body.date_from > body.date_to) throw new ApiError(422, "date_from пізніше за date_to");
      if (shortTime(body.start_time) >= shortTime(body.end_time)) throw new ApiError(422, "start_time має бути раніше за end_time");
      const created = addScheduleTo(this.db, Number(body.master_id), body.date_from, body.date_to, body.weekdays,
        shortTime(body.start_time), shortTime(body.end_time));
      this.save();
      return { created };
    }
    if (method === "POST" && p === "/api/admin/masters") {
      const mm = { id: ++this.db.seq.m, name: body.name, specialization: body.specialization };
      this.db.masters.push(mm);
      this.save();
      return mm;
    }
    throw new ApiError(404, "Not Found");
  }
}
