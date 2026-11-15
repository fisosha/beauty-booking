// Модульні тести логіки фронтенду. Запуск: node --test (з папки frontend), Node 18+.
import { test } from "node:test";
import assert from "node:assert/strict";
import { endTime, formatDuration, groupSlots, monthGrid, normalizePhone, shortTime,
  validateName, esc, toISODate, addDays } from "../js/utils.js";
import { MockApi, generateFreeSlots } from "../js/mock.js";

class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.get(k) ?? null; }
  setItem(k, v) { this.m.set(k, String(v)); }
}

// Понеділок о 08:00 — фіксована дата, щоб тести не залежали від сьогоднішнього дня.
const MONDAY = new Date(2026, 10, 16, 8, 0);
const newApi = () => new MockApi(new MemStorage(), () => new Date(MONDAY));

test("normalizePhone приймає українські формати і відкидає інші", () => {
  assert.equal(normalizePhone("+380671234567"), "+380671234567");
  assert.equal(normalizePhone("067 123-45-67"), "+380671234567");
  assert.equal(normalizePhone("(067)1234567"), "+380671234567");
  assert.equal(normalizePhone("380671234567"), "+380671234567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+48123456789"), null);
});

test("validateName", () => {
  assert.ok(validateName(" a "));
  assert.equal(validateName("Анна"), null);
  assert.ok(validateName("x".repeat(101)));
});

test("endTime, shortTime, formatDuration", () => {
  assert.equal(endTime("10:00", 90), "11:30");
  assert.equal(endTime("18:45", 30), "19:15");
  assert.equal(shortTime("09:15:00"), "09:15");
  assert.equal(formatDuration(45), "45 хв");
  assert.equal(formatDuration(60), "1 год");
  assert.equal(formatDuration(90), "1 год 30 хв");
});

test("groupSlots ділить на ранок/день/вечір і пропускає порожні", () => {
  const g = groupSlots(["10:00", "11:45", "15:00", "18:00"]);
  assert.deepEqual(g, [["Ранок", ["10:00", "11:45"]], ["День", ["15:00"]], ["Вечір", ["18:00"]]]);
  assert.deepEqual(groupSlots(["10:00"]).map(([k]) => k), ["Ранок"]);
});

test("monthGrid: тижні з понеділка, повні рядки по 7", () => {
  const weeks = monthGrid(2026, 10); // листопад 2026, 1-ше — неділя
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0].findIndex(Boolean), 6);
  assert.equal(weeks.flat().filter(Boolean).length, 30);
});

test("esc екранує HTML", () => {
  assert.equal(esc(`<b>"x"&'y'</b>`), "&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
});

test("generateFreeSlots враховує тривалість, зайнятість і крок 15 хв", () => {
  const slots = generateFreeSlots([["10:00", "12:00"]], [["10:30", "11:00"]], 60);
  assert.deepEqual(slots, ["11:00"]);
  const all = generateFreeSlots([["10:00", "11:00"]], [], 30);
  assert.deepEqual(all, ["10:00", "10:15", "10:30"]);
});

test("generateFreeSlots відкидає минулий час сьогодні", () => {
  const now = new Date(2026, 10, 16, 10, 20);
  const slots = generateFreeSlots([["10:00", "11:00"]], [], 15, 15, "2026-11-16", now);
  assert.deepEqual(slots, ["10:30", "10:45"]);
});

test("демо-API: каталог як у backend/seed.py", async () => {
  const api = newApi();
  const masters = await api.request("GET", "/api/masters");
  assert.equal(masters.length, 3);
  const m = await api.request("GET", "/api/masters/1");
  assert.equal(m.services.length, 3);
  assert.equal(m.services[0].price, 450);
});

test("демо-API: бронювання, конфлікт 409, перевірка і скасування", async () => {
  const api = newApi();
  const day = toISODate(MONDAY);
  const before = await api.request("GET", `/api/masters/1/slots?date=${day}&service_id=1`);
  assert.ok(before.slots.includes("10:00"));

  const b = await api.request("POST", "/api/bookings",
    { service_id: 1, date: day, start_time: "10:00", client_name: "Анна", client_phone: "0671234567" });
  assert.equal(b.status, "active");
  assert.equal(b.end_time, "11:00");
  assert.match(b.cancel_code, /^[0-9A-F]{8}$/);

  const after = await api.request("GET", `/api/masters/1/slots?date=${day}&service_id=1`);
  assert.ok(!after.slots.includes("10:00") && !after.slots.includes("10:45"));

  await assert.rejects(api.request("POST", "/api/bookings",
    { service_id: 1, date: day, start_time: "10:00", client_name: "Інна", client_phone: "0501234567" }),
  (e) => e.status === 409);

  const found = await api.request("GET", `/api/bookings/${b.cancel_code.toLowerCase()}`);
  assert.equal(found.id, b.id);
  const cancelled = await api.request("POST", `/api/bookings/${b.cancel_code}/cancel`);
  assert.equal(cancelled.status, "cancelled");
  const freed = await api.request("GET", `/api/masters/1/slots?date=${day}&service_id=1`);
  assert.ok(freed.slots.includes("10:00"));
});

test("демо-API: валідація телефону (422) і неіснуючий код (404)", async () => {
  const api = newApi();
  await assert.rejects(api.request("POST", "/api/bookings",
    { service_id: 1, date: toISODate(MONDAY), start_time: "10:00", client_name: "Анна", client_phone: "123" }),
  (e) => e.status === 422);
  await assert.rejects(api.request("GET", "/api/bookings/NOPE"), (e) => e.status === 404);
});

test("демо-API: неділя без графіка, available-dates її пропускає", async () => {
  const api = newApi();
  const { dates } = await api.request("GET", `/api/masters/1/available-dates?service_id=1&start=${toISODate(MONDAY)}&days=7`);
  assert.equal(dates.length, 6);
  assert.ok(!dates.includes(toISODate(addDays(MONDAY, 6))));
});

test("демо-API: адмінка вимагає токен і додає послугу та графік", async () => {
  const api = newApi();
  await assert.rejects(api.request("POST", "/api/admin/services", { master_id: 1, name: "Педикюр", duration_min: 60, price: 500 },
    { "X-Admin-Token": "wrong" }), (e) => e.status === 401);
  const s = await api.request("POST", "/api/admin/services", { master_id: 1, name: "Педикюр", duration_min: 60, price: 500 },
    { "X-Admin-Token": "admin-secret" });
  assert.equal(s.master_id, 1);
  const sunday = toISODate(addDays(MONDAY, 6));
  const r = await api.request("POST", "/api/admin/schedule", { master_id: 1, date_from: sunday, date_to: sunday,
    weekdays: [6], start_time: "10:00", end_time: "12:00" }, { "X-Admin-Token": "admin-secret" });
  assert.equal(r.created, 1);
  const again = await api.request("POST", "/api/admin/schedule", { master_id: 1, date_from: sunday, date_to: sunday,
    weekdays: [6], start_time: "11:00", end_time: "13:00" }, { "X-Admin-Token": "admin-secret" });
  assert.equal(again.created, 0); // перетин — пропускається
});
