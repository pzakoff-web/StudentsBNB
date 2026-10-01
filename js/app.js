import * as store from "./store.js";
import { initPhotos, clearPhotos } from "./photos.js";
import { icon } from "./icons.js";
import { $, $$, esc, avatar, modal, toast, confirmDialog, go } from "./ui.js";
import { S, saveUI, currentUni, changeLang } from "./state.js";
import { UNIVERSITIES, uniShort, uniName } from "./data/places.js";
import { DEFAULT_FILTERS } from "./logic.js";
import { t, LANGS } from "./i18n.js";
import { explore, filtersModal } from "./views/explore.js";
import { listingPage } from "./views/listing.js";
import { profilePage, editProfile } from "./views/profile.js";
import { peoplePage } from "./views/people.js";
import { favoritesPage } from "./views/favorites.js";
import { inboxPage } from "./views/inbox.js";
import { hostingPage, listingWizard } from "./views/host.js";
import { notificationsPage } from "./views/notifications.js";
import { groupPage } from "./views/group.js";

const ROUTES = [
  [/^\/?$/, explore],
  [/^\/l\/([\w-]+)$/, listingPage],
  [/^\/u\/([\w-]+)$/, profilePage],
  [/^\/me$/, () => { location.replace("#/u/" + store.me().id); }],
  [/^\/me\/edit$/, editProfile],
  [/^\/people$/, peoplePage],
  [/^\/favorites$/, favoritesPage],
  [/^\/inbox(?:\/([\w-]+))?$/, inboxPage],
  [/^\/notifications$/, notificationsPage],
  [/^\/group$/, groupPage],
  [/^\/host$/, hostingPage],
  [/^\/host\/new$/, listingWizard],
  [/^\/host\/edit\/([\w-]+)$/, (m, id) => listingWizard(m, id)],
];

let current = null; // { cleanup, refresh, path }
// Scroll positions by path, and the recent path history, so "back" returns to where you were.
const scrollAt = new Map();
const trail = [];

function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  if (current?.path) scrollAt.set(current.path, window.scrollY);
  const goingBack = trail.length >= 2 && trail[trail.length - 2] === path;
  if (goingBack) trail.pop(); else if (trail.at(-1) !== path) trail.push(path);
  if (trail.length > 30) trail.shift();

  const [fn, args] = (() => { for (const [re, f] of ROUTES) { const m = path.match(re); if (m) return [f, m.slice(1)]; } return [notFound, []]; })();
  current?.cleanup?.();
  current = null;
  document.body.classList.remove("has-book", "noscroll");
  $$(".modal-wrap").forEach(m => m.remove());
  document.documentElement.lang = S.lang;
  const main = $("#main");
  main.innerHTML = "";
  const minimal = /^\/host\/(new|edit)/.test(path);
  renderHeader(path, minimal);
  renderTabbar(path);
  // Full-screen forms have their own bottom bar.
  $("#tabbar").hidden = minimal || path === "/me/edit";
  const res = fn(main, ...args) || {};
  current = { ...res, path };
  const y = goingBack && res.restoreScroll ? scrollAt.get(path) || 0 : 0;
  window.scrollTo(0, y);
  if (y) requestAnimationFrame(() => window.scrollTo(0, y)); // after images reserve their space
  const h1 = $("h1", main)?.textContent;
  document.title = h1 && path !== "/" ? `${h1} · делим` : t("делим — стаи и съквартиранти за студенти във Варна");
}

function notFound(main) {
  main.innerHTML = `<div class="wrap empty"><h2>${t("Тази страница я няма")}</h2><p>${t("Може обявата да е изтрита.")}</p><a class="btn dark" href="#/">${t("Към началото")}</a></div>`;
}

// ---------- header ----------
const bellHTML = () => { const n = store.unreadNotifs(); return `${icon("bell", 20)}${n ? `<span class="dot">${n}</span>` : ""}`; };

function renderHeader(path, minimal) {
  const me = store.me(), f = S.filters, unread = store.totalUnread();
  const hdr = $("#hdr");
  hdr.className = "hdr" + (minimal ? " minimal" : "");
  if (minimal) {
    hdr.innerHTML = `<div class="wrap-wide hdr-in"><a class="logo" href="#/" aria-label="${t("делим, начало")}">${logoMark()}</a>
      <div style="margin-left:auto"><a class="btn ghost sm" href="#/host">${t("Изход")}</a></div></div>`;
    return;
  }
  const uni = UNIVERSITIES.find(u => u.id === currentUni());
  hdr.innerHTML = `<div class="wrap-wide hdr-in">
    <a class="logo" href="#/" aria-label="${t("делим, начало")}">${logoMark()}<small>${t("Варна")}</small></a>
    <form class="find" id="sbar" role="search">
      <label class="sr" for="sbQ">${t("Търси")}</label>${icon("search", 18)}
      <input id="sbQ" name="q" placeholder="${t("Квартал, университет или дума")}" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
    </form>
    <label class="uni-chip" title="${t("Времето за път се смята до този университет")}">${icon("graduation-cap", 18)}<span>${t("Уча в")}</span>
      <select id="sbU" aria-label="${t("Университет")}">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === uni.id ? "selected" : ""}>${uniShort(u)}</option>`).join("")}</select>${icon("chevron-down", 14)}</label>
    <button class="m-search" id="mSearch">${icon("search", 18)}<span><b>${f.q ? esc(f.q) : t("Търси във Варна")}</b><small>${t("Уча в")} ${uniShort(uni)} · ${f.maxPrice ? t("до €{n}", { n: f.maxPrice }) : t("всеки бюджет")}</small></span><span class="fb" aria-label="${t("Филтри")}">${icon("sliders-horizontal", 16)}</span></button>
    <a class="bell m-bell" href="#/notifications" aria-label="${t("Известия")}">${bellHTML()}</a>
    <div class="hdr-right">
      <a class="nav-link" href="#/people">${t("Съквартиранти")}</a>
      <a class="bell" href="#/notifications" aria-label="${t("Известия")}">${bellHTML()}</a>
      <a class="btn yellow sm" href="#/host/new">${icon("plus", 16)} ${t("Обява")}</a>
      <button class="menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-label="${t("Меню")}">${avatar(me, 34)}${icon("chevron-down", 14)}${unread ? `<span class="dot">${unread}</span>` : ""}</button>
    </div></div>`;
  const submit = e => {
    e?.preventDefault();
    S.filters.q = $("#sbQ").value.trim(); S.uniId = $("#sbU").value; saveUI();
    if (location.hash.replace(/^#/, "") !== "/" && location.hash !== "") go("/"); else route();
  };
  $("#sbar").onsubmit = submit;
  $("#sbU").onchange = submit;
  $("#menuBtn").onclick = e => { e.stopPropagation(); toggleMenu(); };
  $("#mSearch").onclick = e => {
    if (e.target.closest(".fb")) { filtersModal(() => { if (current?.path !== "/") go("/"); else route(); }); return; }
    mobileSearch();
  };
}

const logoMark = () => `<b>делим</b>`;

function toggleMenu() {
  const open = $(".dropdown");
  if (open) { open.remove(); $("#menuBtn")?.setAttribute("aria-expanded", "false"); return; }
  const me = store.me(), unread = store.totalUnread();
  const dd = document.createElement("div");
  dd.className = "dropdown"; dd.setAttribute("role", "menu");
  dd.innerHTML = `
    <a class="strong" href="#/inbox" role="menuitem">${t("Съобщения")} ${unread ? `<span class="badge-n">${unread}</span>` : ""}</a>
    <a class="strong" href="#/notifications" role="menuitem">${t("Известия")} ${store.unreadNotifs() ? `<span class="badge-n">${store.unreadNotifs()}</span>` : ""}</a>
    <a class="strong" href="#/favorites" role="menuitem">${t("Запазени")}</a>
    <a class="strong" href="#/u/${me.id}" role="menuitem">${t("Профил")}</a>
    <hr>
    <a href="#/host/new" role="menuitem">${t("Публикувай обява")}</a>
    <a href="#/host" role="menuitem">${t("Моите обяви")}</a>
    <a href="#/group" role="menuitem">${t("Моята група")}</a>
    <a href="#/people" role="menuitem">${t("Търсят съквартирант")}</a>
    <a href="#/me/edit" role="menuitem">${t("Редактирай профила")}</a>
    <hr>
    <div class="dd-lang" role="group" aria-label="${t("Език")}">${Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" aria-pressed="${k === S.lang}">${k.toUpperCase()}<span class="sr"> ${v}</span></button>`).join("")}</div>
    <hr>
    <button id="ddSwitch" role="menuitem">${t("Демо: влез като друг")} ${icon("users", 16)}</button>
    <button id="ddReset" role="menuitem">${t("Демо: върни началните данни")} ${icon("refresh-ccw", 16)}</button>`;
  $("#hdr").appendChild(dd);
  $("#menuBtn").setAttribute("aria-expanded", "true");
  const close = e => { if (!dd.contains(e.target)) { dd.remove(); $("#menuBtn")?.setAttribute("aria-expanded", "false"); document.removeEventListener("click", close); } };
  setTimeout(() => document.addEventListener("click", close));
  dd.addEventListener("click", e => {
    if (e.target.closest("a")) { dd.remove(); document.removeEventListener("click", close); }
    const lb = e.target.closest("[data-lang]");
    if (lb) { dd.remove(); document.removeEventListener("click", close); changeLang(lb.dataset.lang); route(); }
  });
  $("#ddSwitch", dd).onclick = () => { dd.remove(); switchUserDialog(); };
  $("#ddReset", dd).onclick = async () => {
    dd.remove();
    if (!await confirmDialog(t("Всички промени, обяви, снимки и съобщения ще се изтрият. Продължаваме ли?"), t("Върни началните"), true)) return;
    await clearPhotos(); store.resetDemo(); S.filters = { ...DEFAULT_FILTERS }; S.uniId = ""; saveUI();
    toast(t("Демо данните са възстановени")); go("/"); route();
  };
}

function switchUserDialog() {
  const all = store.users();
  const m = modal(`<h2>${t("Влез като")}</h2><p class="muted" style="margin-top:-8px">${t("Демо: така виждаш и другата страна на разговора.")}</p>
    <div style="display:grid;gap:4px">${all.map(u => `<button class="thr" data-id="${u.id}" style="padding:10px 8px;border-radius:10px">${avatar(u, 40)}
      <span style="text-align:left"><b>${esc(u.name)}</b><br><small class="muted">${u.role === "student" ? `${uniShort(UNIVERSITIES.find(x => x.id === u.university))} · ${u.seeking ? t("търси стая") : store.listingsOf(u.id).length ? t("има обява") : t("съквартирант")}` : u.role === "agency" ? t("агенция") : t("хазяин")}</small></span>
      ${u.id === store.me().id ? icon("check", 18) : ""}</button>`).join("")}</div>`, { label: t("Смени потребител") });
  m.el.addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (!b) return;
    store.switchUser(b.dataset.id); S.uniId = ""; saveUI(); m.close(); toast(t("Влезе като {name}", { name: store.me().name })); route(); });
}

function mobileSearch() {
  const f = S.filters;
  const m = modal(`<h2>${t("Търсене")}</h2>
    <div class="field"><label for="msQ">${t("Къде")}</label><input class="inp" id="msQ" value="${esc(f.q)}" placeholder="${t("Квартал, университет или дума")}" autofocus></div>
    <div class="field"><label for="msU">${t("Университет")}</label><select class="inp" id="msU">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === currentUni() ? "selected" : ""}>${uniShort(u)} — ${esc(uniName(u))}</option>`).join("")}</select></div>
    <div class="field"><label for="msB">${t("Бюджет на човек, със сметките")}</label><select class="inp" id="msB">${[0, 250, 300, 350, 400, 500].map(v => `<option value="${v}" ${v === f.maxPrice ? "selected" : ""}>${v ? t("до €{n}", { n: v }) : t("всеки бюджет")}</option>`).join("")}</select></div>
    <div class="field"><label for="msL">${t("Език")}</label><select class="inp" id="msL">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === S.lang ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="modal-foot"><button class="btn link" id="msClear">${t("Изчисти")}</button><button class="btn primary" id="msGo">${icon("search", 18)} ${t("Търси")}</button></div>`, { label: t("Търсене") });
  $("#msClear", m.el).onclick = () => { $("#msQ", m.el).value = ""; $("#msB", m.el).value = "0"; };
  $("#msGo", m.el).onclick = () => {
    S.filters.q = $("#msQ", m.el).value.trim(); S.filters.maxPrice = +$("#msB", m.el).value; S.uniId = $("#msU", m.el).value; saveUI();
    changeLang($("#msL", m.el).value);
    m.close(); if (current?.path !== "/") go("/"); else route();
  };
  $("#msQ", m.el).addEventListener("keydown", e => { if (e.key === "Enter") $("#msGo", m.el).click(); });
}

function renderTabbar(path) {
  const unread = store.totalUnread();
  const tabs = [["/", t("Разгледай"), "search"], ["/favorites", t("Запазени"), "bookmark"], ["/host/new", t("Обява"), "plus"], ["/inbox", t("Съобщения"), "message-circle"], ["/u/" + store.me().id, t("Профил"), "user"]];
  $("#tabbar").innerHTML = tabs.map(([p, label, ic]) => {
    const on = p === "/" ? path === "/" : path.startsWith(p) || (ic === "user" && path.startsWith("/me"));
    return `<a href="#${p}" class="${on ? "on" : ""}" ${on ? 'aria-current="page"' : ""}>${icon(ic, 22)}${label}${ic === "message-circle" && unread ? `<span class="dot">${unread}</span>` : ""}</a>`;
  }).join("");
}

// ---------- boot ----------
async function boot() {
  store.initStore();
  await initPhotos();
  store.subscribe(() => {
    const path = location.hash.replace(/^#/, "") || "/";
    // Keep badges fresh without rebuilding the page the person is typing in.
    const unread = store.totalUnread();
    const mb = $("#menuBtn");
    if (mb) { mb.querySelector(".dot")?.remove(); if (unread) mb.insertAdjacentHTML("beforeend", `<span class="dot">${unread}</span>`); }
    $$(".bell").forEach(b => { b.innerHTML = bellHTML(); });
    renderTabbar(path);
    current?.refresh?.();
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("delim:rerender", () => { if (current) current.path = null; route(); });
  route();
  const n = store.startupNotice();
  if (n === "migrated") toast(t("Сайтът е обновен. Данните ти са запазени."));
  if (n === "reseeded" || n === "reset") toast(t("Демо данните са обновени"));
}
boot();
