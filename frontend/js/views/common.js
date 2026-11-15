import { esc } from "../utils.js";

export const loading = (text = "Завантаження…") =>
  `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${esc(text)}</div>`;

export function errorBox(err, extra = "") {
  const msg = err?.message || String(err);
  return `<div class="alert alert--error" role="alert"><strong>Не вдалося завантажити дані.</strong><br>${esc(msg)}${extra ? `<div class="alert__actions">${extra}</div>` : ""}</div>`;
}

export function toast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
