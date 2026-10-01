import * as store from "../store.js";
import { icon } from "../icons.js";
import { $, $$, esc, modal, starLine, toast } from "../ui.js";
import { search, CATEGORIES, AMENITIES, DEFAULT_FILTERS, plural } from "../logic.js";
import { UNIVERSITIES, uniShort, uniName, districtName, cityName, VARNA_CENTER, VARNA_BOUNDS, isAllUnis, unisByIds } from "../data/places.js";
import { PRIVACY_RADIUS_M } from "../geo.js";
import { S, saveUI, currentUnis, setUnis, activeFilterCount, changeLang } from "../state.js";
import { uniLabel, uniPickerDialog } from "./unipicker.js";
import { t, LANGS } from "../i18n.js";
import { cardHTML, bindCards, carousel, pillFor, saveBtn } from "./card.js";
import { tx, plain } from "../translate.js";

// Standard OpenStreetMap tiles: fine for a prototype under the OSM tile usage policy.
// Production needs a tile provider with an API key (MapTiler, Stadia, Mapbox…).
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function baseMap(el, opts = {}) {
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: true, attributionControl: true,
    center: [VARNA_CENTER.lat, VARNA_CENTER.lng], zoom: 13, minZoom: 11, maxBounds: VARNA_BOUNDS, maxBoundsViscosity: 0.9, ...opts });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, minZoom: 11, bounds: VARNA_BOUNDS, keepBuffer: 4 }).addTo(map);
  // A hidden container (phone list view) has no size: fitting then would zoom out to the minimum. Fit once it is visible.
  map.fit = (latlngs, o = {}) => {
    if (!latlngs.length) return;
    const b = L.latLngBounds(latlngs).pad(o.pad ?? 0.08);
    if (!el.clientWidth || !el.clientHeight) { map.pendingFit = [latlngs, o]; return; }
    map.pendingFit = null; map.fitBounds(b, { maxZoom: o.maxZoom ?? 15, animate: false });
  };
  map.refit = () => { map.invalidateSize(); if (map.pendingFit) map.fit(...map.pendingFit); };
  // Views leave while tiles or animations are in flight; later timers must become no-ops.
  map.alive = true;
  map.dispose = () => { if (!map.alive) return; map.alive = false; map.stop();
    if (map._animatingZoom) map._onZoomTransitionEnd(); // else Leaflet finishes the zoom on a removed map
    map.remove(); };
  map.later = (fn, ms) => setTimeout(() => { if (map.alive) fn(); }, ms);
  return map;
}

export function uniMarkers(map, activeIds = []) {
  const on = new Set(isAllUnis(activeIds) ? [] : activeIds);
  return UNIVERSITIES.map(u => L.marker([u.lat, u.lng], {
    icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="uni-pin ${on.has(u.id) ? "on" : ""}" title="${esc(uniName(u))}">${icon("graduation-cap", 12)}${uniShort(u)}</div>` }),
    keyboard: false, zIndexOffset: -100,
  }).bindTooltip(esc(uniName(u)), { direction: "top", offset: [0, -12] }).addTo(map));
}

// Short human name for a set of filters, e.g. "Стаи · до €350 · ИУ".
export function describeSearch(f, uniIds) {
  const parts = [];
  parts.push(f.type === "room" ? t("Стаи") : f.type === "whole" ? t("Цели жилища") : t("Всички жилища"));
  if (f.category && f.category !== "all" && !["room", "whole"].includes(f.category)) parts.push(t(CATEGORIES.find(c => c.id === f.category)?.label || ""));
  if (f.q) parts.push(`„${f.q}“`);
  if (f.maxPrice) parts.push(t("до €{n}", { n: f.maxPrice }));
  if (f.maxCommute) parts.push(t("до {n} мин", { n: f.maxCommute }));
  parts.push(uniLabel(uniIds));
  return parts.filter(Boolean).join(" · ");
}

const sameSearch = (a, b) => JSON.stringify({ ...a, sort: "" }) === JSON.stringify({ ...b, sort: "" });

export function explore(main) {
  const f = S.filters;
  const unis = currentUnis(), many = isAllUnis(unis) || unis.length > 1;
  const grp = store.groupOf();
  const gsize = grp ? store.groupMembers(grp).length : 0;
  if (f.category === "group" && gsize < 2) f.category = "all";
  const cats = CATEGORIES.filter(c => c.id !== "group" || gsize >= 2);
  main.innerHTML = `
    <div class="cats" id="cats"><div class="wrap-wide cats-in">
      <button class="filter-btn" id="fBtn">${icon("sliders-horizontal", 16)} ${t("Филтри")} ${activeFilterCount() ? `<span class="n">${activeFilterCount()}</span>` : ""}</button>
      <div class="cat-scroll" role="toolbar" aria-label="${t("Бързи филтри")}">
        ${f.q ? `<button class="cat q" id="clearQ" aria-label="${esc(t("Махни търсенето „{q}“", { q: f.q }))}">„${esc(f.q)}“ ${icon("x", 14)}</button>` : ""}
        ${cats.map(c => `<button class="cat" data-cat="${c.id}" aria-pressed="${f.category === c.id}">${c.id === "group" ? icon("users", 14) + " " + t("За групата ни ({n})", { n: gsize }) : t(c.label)}</button>`).join("")}</div>
    </div></div>
    <div class="explore ${S.showMap ? "show-map" : ""}" id="exp">
      <section class="results" aria-live="polite">
        <div class="results-head"><h1 id="rCount"></h1>
          <div class="results-tools"><button class="btn ghost sm" id="saveSearch">${icon("bell-plus", 16)} <span>${t("Запази търсенето")}</span></button>
          <label class="sr" for="sortSel">${t("Подреди")}</label>
          <select id="sortSel">${[["recommended", t("Препоръчани за теб")], ["price", t("Най-ниска цена")], ["commute", many ? t("Най-близо до университет") : t("Най-близо до {uni}", { uni: uniLabel(unis) })], ["rating", t("Най-висок рейтинг")], ["newest", t("Най-нови")]]
            .map(([v, label]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${label}</option>`).join("")}</select></div></div>
        <p class="uni-note">${icon("bus", 16)}<span>${many ? t("Времето е до най-близкия от {list} пеша или с градски транспорт, ориентировъчно. Цените са на човек, със сметките.", { list: `<b>${esc(uniLabel(unis))}</b>` })
          : t("Времето е до {uni} пеша или с градски транспорт, ориентировъчно. Цените са на човек, със сметките.", { uni: `<b>${esc(uniName(unisByIds(unis)[0]))}</b>` })} <button class="btn link" id="uniChange">${t("Промени")}</button></span>
          <label class="check" style="padding:0;font-size:13px;margin-left:auto"><input type="checkbox" id="inBounds" ${S.inBounds ? "checked" : ""}> ${t("Само в района на картата")}</label></p>
        ${f.category === "group" ? `<p class="group-note">${icon("users", 16)}<span>${t("Цели жилища точно за {n} души. Бюджетът на групата е до €{b} на човек.", { n: gsize, b: store.groupBudget(grp) || "—" })} <a href="#/group">${t("Към групата")}</a></span></p>` : ""}
        <div class="grid" id="grid"></div>
      </section>
      <aside class="mapcol" aria-label="${t("Карта")}"><div id="map"></div></aside>
      <button class="map-toggle" id="mapTgl">${S.showMap ? `${t("Списък")} ${icon("list", 16)}` : `${t("Карта")} ${icon("map", 16)}`}</button>
    </div>
    <footer class="foot"><div class="wrap-wide"><span>© 2026 делим · ${t("прототип")}</span>
      <label class="lang-pick">${icon("globe", 16)}<span class="sr">${t("Език")}</span><select id="langSel">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === S.lang ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <span>${t("Карта")}: © OpenStreetMap</span></div></footer>`;

  const grid = $("#grid");
  bindCards(grid);

  // ---- map ----
  const map = baseMap($("#map"), { zoomControl: false, zoomSnap: 0.25 });
  L.control.zoom({ position: "topright" }).addTo(map);
  uniMarkers(map, unis);
  const layer = L.layerGroup().addTo(map);
  let circle = null, markers = new Map(), rows = [], firstFit = true;

  const ctx = () => ({ me: store.me(), uniIds: currentUnis(), userById: store.user, reviewsFor: store.reviewsFor, groupSize: gsize });
  const sameUnis = s => JSON.stringify([...store.searchUnis(s)].sort()) === JSON.stringify([...currentUnis()].sort());

  function syncSaveBtn() {
    const saved = store.savedSearches().some(s => sameUnis(s) && sameSearch(s.filters, S.filters));
    const b = $("#saveSearch");
    b.disabled = saved;
    b.querySelector("span").textContent = saved ? t("Търсенето е запазено") : t("Запази търсенето");
  }

  function draw() {
    rows = search(store.listings(), S.filters, ctx());
    let shown = rows;
    if (S.inBounds && !firstFit) { const b = map.getBounds(); shown = rows.filter(r => b.contains([r.l.approx.lat, r.l.approx.lng])); }
    $("#rCount").textContent = shown.length ? t("{n} във {city}", { n: plural(shown.length, "обява", "обяви"), city: cityName() }) : t("Няма обяви");
    grid.innerHTML = shown.length ? shown.map(cardHTML).join("") : `<div class="empty" style="grid-column:1/-1">
      <h2>${t("Нищо не отговаря на търсенето")}</h2><p>${t("Опитай с по-голям бюджет, друга категория или по-малко филтри. Или запази търсенето и ще ти кажем, когато се появи подходяща обява.")}</p>
      <button class="btn dark" id="resetAll">${t("Изчисти всички филтри")}</button></div>`;
    $("#resetAll")?.addEventListener("click", () => { S.filters = { ...DEFAULT_FILTERS }; S.inBounds = false; saveUI(); rerender(); });
    syncSaveBtn();

    layer.clearLayers(); markers.clear();
    for (const r of rows) {
      const m = L.marker([r.l.approx.lat, r.l.approx.lng], {
        icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: pinHTML(r) }),
        riseOnHover: true, title: `${plain(r.l.title)}, €${r.pp}`,
      });
      m.bindPopup(() => popupHTML(r), { closeButton: true, offset: [0, -8], maxWidth: 300, minWidth: 280, autoPanPadding: [30, 30] });
      m.on("popupopen", e => { bindCards(e.popup.getElement()); setSel(r.l.id); });
      m.on("popupclose", () => setSel(null));
      m.addTo(layer); markers.set(r.l.id, m);
    }
    if (firstFit) map.fit(rows.map(r => [r.l.approx.lat, r.l.approx.lng]));
    firstFit = false;
    declutter();
  }

  // A price tag only where it fits; the rest shrink to dots until you zoom in.
  function declutter() {
    const placed = [];
    for (const r of rows) {
      const m = markers.get(r.l.id); if (!m) continue;
      const pt = map.latLngToLayerPoint(m.getLatLng());
      const w = 16 + String(r.pp).length * 9, h = 30;
      const hit = placed.some(q => Math.abs(q.x - pt.x) < (q.w + w) / 2 + 2 && Math.abs(q.y - pt.y) < h);
      if (!hit) placed.push({ x: pt.x, y: pt.y, w });
      m.getElement()?.querySelector(".pin")?.classList.toggle("dot", hit);
      m.setZIndexOffset(hit ? -50 : 0);
    }
  }
  map.on("zoomend", declutter);

  const pinHTML = r => `<div class="pin ${r.compat?.score >= 80 ? "match" : ""} ${store.isFav(r.l.id) ? "fav" : ""}" data-pin="${r.l.id}">€${r.pp}</div>`;
  const popupHTML = r => `<a class="card" href="#/l/${r.l.id}" style="display:block"><div class="card-media">${carousel(r.l.photos)}${pillFor(r)}${saveBtn(r.l.id, 18)}</div>
    <div class="card-body"><div class="card-price"><mark>€${r.pp}</mark><span>${t("на човек · със сметките")}</span></div>
    <h3>${tx(r.l.title)}</h3><div class="card-foot"><span>${esc(districtName(r.l.district))}</span>${starLine(r.rating)}</div></div></a>`;

  function setSel(id, hover = false) {
    $$(".pin.sel, .pin.hover").forEach(p => p.classList.remove("sel", "hover"));
    if (circle) { circle.remove(); circle = null; }
    if (!id) return;
    const r = rows.find(x => x.l.id === id); if (!r) return;
    $(`[data-pin="${id}"]`)?.classList.add(hover ? "hover" : "sel");
    circle = L.circle([r.l.approx.lat, r.l.approx.lng], { radius: PRIVACY_RADIUS_M, color: "#16232E", weight: 1.5, fillColor: "#1F5FA8", fillOpacity: .14, interactive: false }).addTo(map);
  }

  grid.addEventListener("mouseover", e => { const c = e.target.closest(".card"); if (c && !c.contains(e.relatedTarget)) { setSel(c.dataset.id, true); markers.get(c.dataset.id)?.setZIndexOffset(1000); } });
  grid.addEventListener("mouseout", e => { const c = e.target.closest(".card"); if (c && !c.contains(e.relatedTarget)) { setSel(null); markers.get(c.dataset.id)?.setZIndexOffset(0); } });

  map.on("moveend", () => { if (S.inBounds) draw(); });

  // ---- controls ----
  $("#cats").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    S.filters.category = b.dataset.cat; saveUI();
    rerender();
  });
  $("#clearQ")?.addEventListener("click", () => { S.filters.q = ""; saveUI(); rerender(); });
  $("#sortSel").onchange = e => { S.filters.sort = e.target.value; saveUI(); draw(); };
  $("#inBounds").onchange = e => { S.inBounds = e.target.checked; draw(); };
  $("#fBtn").onclick = () => filtersModal(rerender);
  $("#uniChange").onclick = () => uniPickerDialog(rerender);
  $("#saveSearch").onclick = () => saveSearchDialog(syncSaveBtn);
  $("#langSel").onchange = e => { changeLang(e.target.value); rerender(); };
  $("#mapTgl").onclick = () => {
    S.showMap = !S.showMap;
    $("#exp").classList.toggle("show-map", S.showMap);
    $("#mapTgl").innerHTML = S.showMap ? `${t("Списък")} ${icon("list", 16)}` : `${t("Карта")} ${icon("map", 16)}`;
    map.later(() => map.refit(), 50);
  };
  const onScroll = () => $("#cats")?.classList.toggle("shadow", window.scrollY > 4);
  window.addEventListener("scroll", onScroll, { passive: true });

  draw();
  map.later(() => map.refit(), 100);
  return { cleanup: () => { window.removeEventListener("scroll", onScroll); map.dispose(); }, restoreScroll: true };
}

function saveSearchDialog(done) {
  const name = describeSearch(S.filters, currentUnis());
  const m = modal(`<h2>${t("Запази търсенето")}</h2>
    <p class="muted" style="margin-top:-6px">${t("Когато се появи нова обява, която отговаря, ще я видиш в Известия.")}</p>
    <div class="field"><label for="ssName">${t("Име")}</label><input class="inp" id="ssName" maxlength="60" value="${esc(name)}"></div>
    <p class="legal" style="margin-top:0">${t("Демо: известията са само в сайта. С бекенда ще пристигат и по имейл.")}</p>
    <div class="modal-foot"><button class="btn link" data-close>${t("Отказ")}</button><button class="btn dark" id="ssGo">${icon("bell-plus", 16)} ${t("Запази")}</button></div>`, { cls: "small", label: t("Запази търсенето") });
  $("#ssGo", m.el).onclick = () => {
    store.saveSearch({ name: $("#ssName", m.el).value.trim() || name, filters: structuredClone(S.filters), uniIds: [...currentUnis()] });
    m.close(); toast(t("Ще те известим за нови обяви")); done();
  };
}

// Re-runs the router, so the header, chips and map are rebuilt from the new filters.
export const rerender = () => window.dispatchEvent(new Event("delim:rerender"));

export function filtersModal(onApply = rerender) {
  const f = structuredClone(S.filters);
  const unis = currentUnis(), many = isAllUnis(unis) || unis.length > 1;
  const all = search(store.listings(), { ...DEFAULT_FILTERS, showAllGenders: true }, { me: store.me(), uniIds: unis, userById: store.user, reviewsFor: store.reviewsFor });
  const prices = all.map(r => r.pp);
  const lo = 150, hi = 650, bins = 20;
  const hist = Array(bins).fill(0); prices.forEach(p => hist[Math.min(bins - 1, Math.max(0, Math.floor((p - lo) / (hi - lo) * bins)))]++);
  const hmax = Math.max(1, ...hist);

  const m = modal(`<h2>${t("Филтри")}</h2>
    <div class="fsec"><h3>${t("Вид жилище")}</h3><p>${t("Стая при студент — влизаш при някой, който вече живее там. Цяло жилище — от хазяин или агенция.")}</p>
      ${optsHTML("type", [["", t("Всички")], ["room", t("Стая при студент")], ["whole", t("Цяло жилище")]], f.type)}</div>
    <div class="fsec"><h3>${t("Цена на човек")}</h3><p>${t("На месец, наемът и сметките разделени на всички живеещи.")}</p>
      <div class="hist" id="hist">${hist.map((n, i) => `<i style="height:${Math.max(4, n / hmax * 100)}%" data-b="${lo + (i + .5) * (hi - lo) / bins}"></i>`).join("")}</div>
      <input type="range" id="fMax" min="${lo}" max="${hi}" step="10" value="${f.maxPrice || hi}" aria-label="${t("Максимална цена")}">
      <div class="range-vals"><span>${t("от €{n}", { n: lo })}</span><span id="fMaxV"></span></div></div>
    <div class="fsec"><h3>${many ? t("Време до най-близкия избран университет") : t("Време до {uni}", { uni: esc(uniLabel(unis)) })}</h3><p>${t("Пеша или с градски транспорт, ориентировъчно. Университетът се сменя от търсачката горе.")}</p>
      <input type="range" id="fCom" min="10" max="60" step="5" value="${f.maxCommute || 60}" aria-label="${t("Максимално време за път")}">
      <div class="range-vals"><span>${t("{n} мин", { n: 10 })}</span><span id="fComV"></span></div></div>
    <div class="fsec"><h3>${t("За колко време търсиш")}</h3><p>${t("Скриваме обявите, които искат по-дълъг минимален срок.")}</p>
      ${optsHTML("stay", [[0, t("Без значение")], [6, t("6 месеца")], [10, t("Учебна година")], [12, t("1 година")], [24, t("2+ години")]], f.stay)}</div>
    <div class="fsec"><h3>${t("Нанасяне до")}</h3><p>${t("Показва жилищата, свободни до тази дата.")}</p>
      <input class="inp" type="date" id="fMove" value="${f.moveIn}" style="max-width:240px"></div>
    <div class="fsec"><h3>${t("Удобства")}</h3>
      <div class="opts tiles" data-name="amenities" data-multi>${Object.entries(AMENITIES).map(([k, [label, ic]]) =>
        `<button type="button" data-v="${k}" aria-pressed="${f.amenities.includes(k)}">${icon(ic, 24)}${t(label)}</button>`).join("")}</div></div>
    <div class="fsec"><h3>${t("Рейтинг")}</h3>${optsHTML("minRating", [[0, t("Всички")], [4, "4+"], [4.5, S.lang === "en" ? "4.5+" : "4,5+"], [4.8, S.lang === "en" ? "4.8+" : "4,8+"]], f.minRating)}</div>
    <div class="fsec"><h3>${t("Доверие")}</h3>
      <label class="check"><input type="checkbox" id="fVer" ${f.verifiedOnly ? "checked" : ""}><span><b>${t("Потвърден студентски имейл")}</b><br><span class="muted">${t("Домакинът е потвърдил имейл от университета.")}</span></span></label>
      <label class="check"><input type="checkbox" id="fCons" ${f.consentOnly ? "checked" : ""}><span><b>${t("Хазяинът е съгласен")}</b><br><span class="muted">${t("Само стаи, за които собственикът е дал съгласие за нов съквартирант.")}</span></span></label>
      <label class="check"><input type="checkbox" id="fGen" ${f.showAllGenders ? "checked" : ""}><span><b>${t("Покажи и обяви за друг пол")}</b><br><span class="muted">${t("По подразбиране скриваме стаите, в които търсят съквартирант от друг пол.")}</span></span></label></div>
    <div class="modal-foot"><button class="btn link" id="fClear">${t("Изчисти всички")}</button><button class="btn dark" id="fGo"></button></div>`,
  { cls: "", label: t("Филтри") });

  const el = m.el;
  const upd = () => {
    const max = +$("#fMax", el).value, com = +$("#fCom", el).value;
    f.maxPrice = max >= hi ? 0 : max; f.maxCommute = com >= 60 ? 0 : com;
    f.moveIn = $("#fMove", el).value; f.verifiedOnly = $("#fVer", el).checked; f.consentOnly = $("#fCons", el).checked; f.showAllGenders = $("#fGen", el).checked;
    $("#fMaxV", el).textContent = f.maxPrice ? t("до €{n}", { n: f.maxPrice }) : t("всяка цена");
    $("#fComV", el).textContent = f.maxCommute ? t("до {n} мин", { n: f.maxCommute }) : t("без ограничение");
    $$("#hist i", el).forEach(i => i.classList.toggle("in", !f.maxPrice || +i.dataset.b <= f.maxPrice));
    const grp = store.groupOf();
    const n = search(store.listings(), f, { me: store.me(), uniIds: unis, userById: store.user, reviewsFor: store.reviewsFor, groupSize: grp ? store.groupMembers(grp).length : 0 }).length;
    $("#fGo", el).textContent = n ? t("Покажи {n}", { n: plural(n, "обява", "обяви") }) : t("Няма обяви");
  };
  el.addEventListener("input", upd);
  el.addEventListener("click", e => {
    const b = e.target.closest(".opts button"); if (!b) return;
    const g = b.closest(".opts"), name = g.dataset.name;
    if (g.hasAttribute("data-multi")) {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
      f[name] = $$("button[aria-pressed=true]", g).map(x => x.dataset.v);
    } else {
      $$("button", g).forEach(x => x.setAttribute("aria-pressed", x === b));
      f[name] = name === "type" ? b.dataset.v : +b.dataset.v;
    }
    upd();
  });
  $("#fClear", el).onclick = () => { Object.assign(f, { ...DEFAULT_FILTERS, q: f.q, category: f.category, sort: f.sort }); m.close(); S.filters = f; saveUI(); onApply(); };
  $("#fGo", el).onclick = () => { S.filters = f; saveUI(); m.close(); onApply(); };
  upd();
}

function optsHTML(name, pairs, cur) {
  return `<div class="opts" data-name="${name}">${pairs.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${label}</button>`).join("")}</div>`;
}
