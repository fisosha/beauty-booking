// Клієнт REST API бекенду (див. backend/README.md → «Ендпоінти для фронтенду»).
import { API_BASE, FORCE_MOCK } from "./config.js";
import { ApiError, MockApi } from "./mock.js";

export { ApiError };

let mock = null;
let mode = null; // "live" | "mock"

/** Визначає, чи доступний бекенд; якщо ні — вмикає демо-режим. */
export async function init() {
  if (FORCE_MOCK) {
    mode = "mock";
  } else {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      mode = r.ok ? "live" : "mock";
    } catch {
      mode = "mock";
    }
  }
  if (mode === "mock") mock = new MockApi();
  return mode;
}

export const isMock = () => mode === "mock";
export const resetMock = () => mock?.reset();

/** FastAPI повертає detail рядком або масивом помилок валідації. */
function detailMessage(data, status) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return d.map((e) => String(e.msg || "").replace(/^Value error, /, "")).join("; ");
  }
  return `Помилка сервера (${status})`;
}

async function request(method, path, body, headers = {}) {
  if (mode === "mock") return mock.request(method, path, body, headers);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Немає звʼязку з сервером. Перевірте, що бекенд запущено.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detailMessage(data, res.status));
  return data;
}

const qs = (o) => new URLSearchParams(o).toString();

export const api = {
  masters: () => request("GET", "/api/masters"),
  master: (id) => request("GET", `/api/masters/${id}`),
  services: (id) => request("GET", `/api/masters/${id}/services`),
  availableDates: (masterId, serviceId, start, days) =>
    request("GET", `/api/masters/${masterId}/available-dates?${qs({ service_id: serviceId, start, days })}`),
  slots: (masterId, serviceId, date) =>
    request("GET", `/api/masters/${masterId}/slots?${qs({ date, service_id: serviceId })}`),
  createBooking: (data) => request("POST", "/api/bookings", data),
  booking: (code) => request("GET", `/api/bookings/${encodeURIComponent(code.trim())}`),
  cancelBooking: (code) => request("POST", `/api/bookings/${encodeURIComponent(code.trim())}/cancel`),

  admin: {
    createService: (token, data) => request("POST", "/api/admin/services", data, { "X-Admin-Token": token }),
    createSchedule: (token, data) => request("POST", "/api/admin/schedule", data, { "X-Admin-Token": token }),
  },
};
