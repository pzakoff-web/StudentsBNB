import * as store from "./store.js";
import { initPhotos, clearPhotos } from "./photos.js";
import { icon } from "./icons.js";
import { $, $$, esc, avatar, modal, toast, confirmDialog, go } from "./ui.js";
import { S, saveUI, currentUni } from "./state.js";
import { UNIVERSITIES } from "./data/places.js";
import { DEFAULT_FILTERS } from "./logic.js";
import { explore, filtersModal } from "./views/explore.js";
import { listingPage } from "./views/listing.js";
import { profilePage, editProfile } from "./views/profile.js";
import { peoplePage } from "./views/people.js";
import { favoritesPage } from "./views/favorites.js";
import { inboxPage } from "./views/inbox.js";
import { hostingPage, listingWizard } from "./views/host.js";

const ROUTES = [
  [/^\/?$/, explore],
  [/^\/l\/([\w-]+)$/, listingPage],
  [/^\/u\/([\w-]+)$/, profilePage],
  [/^\/me$/, () => { location.replace("#/u/" + store.me().id); }],
  [/^\/me\/edit$/, editProfile],
  [/^\/people$/, peoplePage],
  [/^\/favorites$/, favoritesPage],
  [/^\/inbox(?:\/([\w-]+))?$/, inboxPage],
  [/^\/host$/, hostingPage],
  [/^\/host\/new$/, listingWizard],
  [/^\/host\/edit\/([\w-]+)$/, (m, id) => listingWizard(m, id)],
];

let current = null; // { cleanup, refresh, path }

function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  const [, fn, args] = (() => { for (const [re, f] of ROUTES) { const m = path.match(re); if (m) return [null, f, m.slice(1)]; } return [null, notFound, []]; })();
  current?.cleanup?.();
  current = null;
  document.body.classList.remove("has-book", "noscroll");
  $$(".modal-wrap").forEach(m => m.remove());
  const main = $("#main");
  main.innerHTML = "";
  const minimal = /^\/host\/(new|edit)/.test(path);
  renderHeader(path, minimal);
  renderTabbar(path);
  // Full-screen forms have their own bottom bar.
  $("#tabbar").hidden = minimal || path === "/me/edit";
  const res = fn(main, ...args) || {};
  current = { ...res, path };
  if (!res.keepScroll) window.scrollTo(0, 0);
  const t = $("h1", main)?.textContent;
  document.title = t && path !== "/" ? `${t} · делим` : "делим — стаи и съквартиранти за студенти във Варна";
}

function notFound(main) {
  main.innerHTML = `<div class="wrap empty"><h2>Тази страница я няма</h2><p>Може обявата да е изтрита.</p><a class="btn dark" href="#/">Към началото</a></div>`;
}

// ---------- header ----------
function renderHeader(path, minimal) {
  const me = store.me(), f = S.filters, unread = store.totalUnread();
  const hdr = $("#hdr");
  hdr.className = "hdr" + (minimal ? " minimal" : "");
  if (minimal) {
    hdr.innerHTML = `<div class="wrap-wide hdr-in"><a class="logo" href="#/" aria-label="делим, начало">${logoMark()}</a>
      <div style="margin-left:auto"><a class="btn ghost sm" href="#/host">Изход</a></div></div>`;
    return;
  }
  const uni = UNIVERSITIES.find(u => u.id === currentUni());
  hdr.innerHTML = `<div class="wrap-wide hdr-in">
    <a class="logo" href="#/" aria-label="делим, начало">${logoMark()}<small>Варна</small></a>
    <form class="find" id="sbar" role="search">
      <label class="sr" for="sbQ">Търси</label>${icon("search", 18)}
      <input id="sbQ" name="q" placeholder="Квартал, университет или дума" value="${esc(f.q)}" autocomplete="off" enterkeyhint="search">
    </form>
    <label class="uni-chip" title="Времето за път се смята до този университет">${icon("graduation-cap", 18)}<span>Уча в</span>
      <select id="sbU" aria-label="Университет">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === uni.id ? "selected" : ""}>${u.short}</option>`).join("")}</select>${icon("chevron-down", 14)}</label>
    <button class="m-search" id="mSearch">${icon("search", 18)}<span><b>${f.q ? esc(f.q) : "Търси във Варна"}</b><small>Уча в ${uni.short} · ${f.maxPrice ? "до €" + f.maxPrice : "всеки бюджет"}</small></span><span class="fb" aria-label="Филтри">${icon("sliders-horizontal", 16)}</span></button>
    <div class="hdr-right">
      <a class="nav-link" href="#/people">Съквартиранти</a>
      <a class="btn yellow sm" href="#/host/new">${icon("plus", 16)} Обява</a>
      <button class="menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Меню">${avatar(me, 34)}${icon("chevron-down", 14)}${unread ? `<span class="dot">${unread}</span>` : ""}</button>
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
    <a class="strong" href="#/inbox" role="menuitem">Съобщения ${unread ? `<span class="badge-n">${unread}</span>` : ""}</a>
    <a class="strong" href="#/favorites" role="menuitem">Запазени</a>
    <a class="strong" href="#/u/${me.id}" role="menuitem">Профил</a>
    <hr>
    <a href="#/host/new" role="menuitem">Публикувай обява</a>
    <a href="#/host" role="menuitem">Моите обяви</a>
    <a href="#/people" role="menuitem">Търсят съквартирант</a>
    <a href="#/me/edit" role="menuitem">Редактирай профила</a>
    <hr>
    <button id="ddSwitch" role="menuitem">Демо: влез като друг ${icon("users", 16)}</button>
    <button id="ddReset" role="menuitem">Демо: върни началните данни ${icon("refresh-ccw", 16)}</button>`;
  $("#hdr").appendChild(dd);
  $("#menuBtn").setAttribute("aria-expanded", "true");
  const close = e => { if (!dd.contains(e.target)) { dd.remove(); $("#menuBtn")?.setAttribute("aria-expanded", "false"); document.removeEventListener("click", close); } };
  setTimeout(() => document.addEventListener("click", close));
  dd.addEventListener("click", e => { if (e.target.closest("a")) { dd.remove(); document.removeEventListener("click", close); } });
  $("#ddSwitch", dd).onclick = () => { dd.remove(); switchUserDialog(); };
  $("#ddReset", dd).onclick = async () => {
    dd.remove();
    if (!await confirmDialog("Всички промени, обяви, снимки и съобщения ще се изтрият. Продължаваме ли?", "Върни началните", true)) return;
    await clearPhotos(); store.resetDemo(); S.filters = { ...DEFAULT_FILTERS }; S.uniId = ""; saveUI();
    toast("Демо данните са възстановени"); go("/"); route();
  };
}

function switchUserDialog() {
  const all = store.users();
  const m = modal(`<h2>Влез като</h2><p class="muted" style="margin-top:-8px">Демо: така виждаш и другата страна на разговора.</p>
    <div style="display:grid;gap:4px">${all.map(u => `<button class="thr" data-id="${u.id}" style="padding:10px 8px;border-radius:10px">${avatar(u, 40)}
      <span style="text-align:left"><b>${esc(u.name)}</b><br><small class="muted">${u.role === "student" ? `${UNIVERSITIES.find(x => x.id === u.university)?.short} · ${u.seeking ? "търси стая" : store.listingsOf(u.id).length ? "има обява" : "съквартирант"}` : u.role === "agency" ? "агенция" : "хазяин"}</small></span>
      ${u.id === store.me().id ? icon("check", 18) : ""}</button>`).join("")}</div>`, { label: "Смени потребител" });
  m.el.addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (!b) return;
    store.switchUser(b.dataset.id); S.uniId = ""; saveUI(); m.close(); toast("Влезе като " + store.me().name); route(); });
}

function mobileSearch() {
  const f = S.filters;
  const m = modal(`<h2>Търсене</h2>
    <div class="field"><label for="msQ">Къде</label><input class="inp" id="msQ" value="${esc(f.q)}" placeholder="Квартал, университет, дума" autofocus></div>
    <div class="field"><label for="msU">Университет</label><select class="inp" id="msU">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === currentUni() ? "selected" : ""}>${u.short} — ${esc(u.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="msB">Бюджет на човек, със сметките</label><select class="inp" id="msB">${[0, 250, 300, 350, 400, 500].map(v => `<option value="${v}" ${v === f.maxPrice ? "selected" : ""}>${v ? "До €" + v : "Всеки бюджет"}</option>`).join("")}</select></div>
    <div class="modal-foot"><button class="btn link" id="msClear">Изчисти</button><button class="btn primary" id="msGo">${icon("search", 18)} Търси</button></div>`, { label: "Търсене" });
  $("#msClear", m.el).onclick = () => { $("#msQ", m.el).value = ""; $("#msB", m.el).value = "0"; };
  $("#msGo", m.el).onclick = () => {
    S.filters.q = $("#msQ", m.el).value.trim(); S.filters.maxPrice = +$("#msB", m.el).value; S.uniId = $("#msU", m.el).value; saveUI();
    m.close(); if (current?.path !== "/") go("/"); else route();
  };
  $("#msQ", m.el).addEventListener("keydown", e => { if (e.key === "Enter") $("#msGo", m.el).click(); });
}

function renderTabbar(path) {
  const unread = store.totalUnread();
  const tabs = [["/", "Разгледай", "search"], ["/favorites", "Запазени", "bookmark"], ["/host/new", "Обява", "plus"], ["/inbox", "Съобщения", "message-circle"], ["/u/" + store.me().id, "Профил", "user"]];
  $("#tabbar").innerHTML = tabs.map(([p, t, ic]) => {
    const on = p === "/" ? path === "/" : path.startsWith(p) || (ic === "user" && path.startsWith("/me"));
    return `<a href="#${p}" class="${on ? "on" : ""}" ${on ? 'aria-current="page"' : ""}>${icon(ic, 22)}${t}${ic === "message-circle" && unread ? `<span class="dot">${unread}</span>` : ""}</a>`;
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
    renderTabbar(path);
    current?.refresh?.();
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("delim:rerender", route);
  route();
}
boot();
