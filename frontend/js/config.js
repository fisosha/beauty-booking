// Налаштування клієнта.
// API_BASE можна перевизначити параметром ?api=http://host:port у адресі сторінки.
const params = new URLSearchParams(location.search);

export const API_BASE = (params.get("api") || "http://127.0.0.1:8000").replace(/\/$/, "");

// ?mock=1 — примусовий демо-режим (дані в localStorage, бекенд не потрібен).
// Якщо бекенд недоступний, демо-режим вмикається автоматично.
export const FORCE_MOCK = params.has("mock");

// Скільки днів показує календар наперед.
export const CALENDAR_DAYS = 30;
