import { icon } from "./icons.js";
import { photoSrc } from "./photos.js";
import { fmtRating } from "./logic.js";
import { t, locale } from "./i18n.js";

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
  if (!r || r.overall == null) return `<span class="rating new ${cls}">${icon("star", 14, "star")} ${t("Нова")}</span>`;
  return `<span class="rating ${cls}">${icon("star", 14, "star")} ${fmtRating(r.overall)}${count ? ` <span class="muted">(${r.count})</span>` : ""}</span>`;
}

export function stars(n, size = 14) {
  return `<span class="stars" aria-label="${esc(t("{n} от 5", { n }))}">${[1, 2, 3, 4, 5].map(i => icon("star", size, i <= n ? "on" : "off")).join("")}</span>`;
}

let toastT;
export function toast(text) {
  const el = $("#toast");
  el.textContent = text; el.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2800);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Modal dialog. Keeps keyboard focus inside while open and returns it to the opener on close.
export function modal(html, { cls = "", onClose, label = t("Диалог") } = {}) {
  const opener = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <button class="icon-btn modal-x" data-close aria-label="${esc(t("Затвори"))}">${icon("x", 18)}</button>${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("noscroll");
  requestAnimationFrame(() => wrap.classList.add("on"));
  const box = $(".modal", wrap);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    wrap.classList.remove("on"); document.removeEventListener("keydown", key, true);
    setTimeout(() => { wrap.remove(); if (!$(".modal-wrap")) document.body.classList.remove("noscroll"); }, 180);
    opener?.focus?.(); onClose?.();
  };
  const key = e => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const f = $$(FOCUSABLE, box).filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", key, true);
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
  setTimeout(() => ($("[autofocus]", box) || box.querySelector("input,button:not(.modal-x),select,textarea") || $(".modal-x", box))?.focus(), 50);
  return { el: box, close };
}

export function confirmDialog(text, ok = t("Да"), danger = false) {
  return new Promise(res => {
    let v = false;
    const m = modal(`<h2 class="h2">${esc(text)}</h2><div class="row-end"><button class="btn ghost" data-close>${t("Отказ")}</button>
      <button class="btn ${danger ? "danger" : "dark"}" id="cOk">${esc(ok)}</button></div>`, { cls: "small", onClose: () => res(v) });
    $("#cOk", m.el).onclick = () => { v = true; m.close(); };
  });
}

// Segmented choices: <div class="opts" data-name> with buttons carrying data-v. Labels are already translated.
export function opts(name, pairs, cur, multi = false) {
  const on = v => multi ? cur.includes(v) : String(v) === String(cur);
  return `<div class="opts" data-name="${name}" ${multi ? "data-multi" : ""} role="group">` + pairs.map(([v, label, ic]) =>
    `<button type="button" data-v="${esc(v)}" aria-pressed="${on(v)}">${ic ? icon(ic, 18) : ""}${esc(label)}</button>`).join("") + `</div>`;
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

export const debounce = (f, ms) => { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => f(...a), ms); }; };

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return t("сега");
  if (s < 3600) return t("преди {n} мин", { n: Math.floor(s / 60) });
  if (s < 86400) return t("преди {n} ч", { n: Math.floor(s / 3600) });
  const d = Math.floor(s / 86400);
  return d === 1 ? t("вчера") : d < 30 ? t("преди {n} дни", { n: d }) : new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

export function download(name, data, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}
