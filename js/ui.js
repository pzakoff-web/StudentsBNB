import { icon } from "./icons.js";
import { photoSrc } from "./photos.js";
import { fmtRating } from "./logic.js";

export const go = path => { location.hash = "#" + path; };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const nl2br = s => esc(s).replace(/\n/g, "<br>");

export function initials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function avatar(u, size = 40) {
  if (!u) return "";
  const src = photoSrc(u.avatar);
  return src
    ? `<img class="av" src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`
    : `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px;background:hsl(${u.hue} 45% 42%)" aria-hidden="true">${esc(initials(u.name))}</span>`;
}

export function starLine(r, { count = true, cls = "" } = {}) {
  if (!r || r.overall == null) return `<span class="rating new ${cls}">${icon("star", 14, "star")} Нова</span>`;
  return `<span class="rating ${cls}">${icon("star", 14, "star")} ${fmtRating(r.overall)}${count ? ` <span class="muted">(${r.count})</span>` : ""}</span>`;
}

export function stars(n, size = 14) {
  return `<span class="stars" aria-label="${n} от 5">${[1, 2, 3, 4, 5].map(i => icon("star", size, i <= n ? "on" : "off")).join("")}</span>`;
}

let toastT;
export function toast(text) {
  const el = $("#toast");
  el.textContent = text; el.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2800);
}

// Modal dialog. Returns a close function. Focus returns to the opener on close.
export function modal(html, { cls = "", onClose, label = "Диалог" } = {}) {
  const opener = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <button class="icon-btn modal-x" data-close aria-label="Затвори">${icon("x", 18)}</button>${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("noscroll");
  requestAnimationFrame(() => wrap.classList.add("on"));
  const close = () => {
    wrap.classList.remove("on"); document.removeEventListener("keydown", key);
    setTimeout(() => { wrap.remove(); if (!$(".modal-wrap")) document.body.classList.remove("noscroll"); }, 180);
    opener?.focus?.(); onClose?.();
  };
  const key = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key);
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  setTimeout(() => ($(".modal [autofocus]", wrap) || $(".modal", wrap).querySelector("input,button:not(.modal-x),select,textarea"))?.focus(), 50);
  return { el: $(".modal", wrap), close };
}

export function confirmDialog(text, ok = "Да", danger = false) {
  return new Promise(res => {
    let v = false;
    const m = modal(`<h2 class="h2">${esc(text)}</h2><div class="row-end"><button class="btn ghost" data-close>Отказ</button>
      <button class="btn ${danger ? "danger" : "dark"}" id="cOk">${esc(ok)}</button></div>`, { cls: "small", onClose: () => res(v) });
    $("#cOk", m.el).onclick = () => { v = true; m.close(); };
  });
}

// Segmented choices: <div class="opts" data-name> with buttons carrying data-v.
export function opts(name, pairs, cur, multi = false) {
  const on = v => multi ? cur.includes(v) : String(v) === String(cur);
  return `<div class="opts" data-name="${name}" ${multi ? "data-multi" : ""} role="group">` + pairs.map(([v, t, ic]) =>
    `<button type="button" data-v="${esc(v)}" aria-pressed="${on(v)}">${ic ? icon(ic, 18) : ""}${esc(t)}</button>`).join("") + `</div>`;
}
export function bindOpts(root, cb) {
  $$(".opts", root).forEach(g => g.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (g.hasAttribute("data-multi")) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
    else $$("button", g).forEach(x => x.setAttribute("aria-pressed", x === b));
    const val = g.hasAttribute("data-multi") ? $$("button[aria-pressed=true]", g).map(x => x.dataset.v) : b.dataset.v;
    cb(g.dataset.name, val);
  }));
}

export const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "сега";
  if (s < 3600) return `преди ${Math.floor(s / 60)} мин`;
  if (s < 86400) return `преди ${Math.floor(s / 3600)} ч`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "вчера" : d < 30 ? `преди ${d} дни` : new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "short" });
}

export function download(name, text, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
