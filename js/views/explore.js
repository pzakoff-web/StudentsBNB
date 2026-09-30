import * as store from "../store.js";
import { icon } from "../icons.js";
import { $, $$, esc, modal, starLine } from "../ui.js";
import { search, CATEGORIES, AMENITIES, DEFAULT_FILTERS, plural } from "../logic.js";
import { UNIVERSITIES, uniById, VARNA_CENTER } from "../data/places.js";
import { PRIVACY_RADIUS_M } from "../geo.js";
import { S, saveUI, currentUni, activeFilterCount } from "../state.js";
import { cardHTML, bindCards, carousel, pillFor, saveBtn } from "./card.js";

// Standard OpenStreetMap tiles: fine for a prototype under the OSM tile usage policy.
// Production needs a tile provider with an API key (MapTiler, Stadia, Mapbox…).
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function baseMap(el, opts = {}) {
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: true, attributionControl: true, ...opts });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
  // Views leave while tiles or animations are in flight; later timers must become no-ops.
  map.alive = true;
  map.dispose = () => { if (!map.alive) return; map.alive = false; map.stop();
    if (map._animatingZoom) map._onZoomTransitionEnd(); // else Leaflet finishes the zoom on a removed map
    map.remove(); };
  map.later = (fn, ms) => setTimeout(() => { if (map.alive) fn(); }, ms);
  return map;
}

export function uniMarkers(map, activeId) {
  return UNIVERSITIES.map(u => L.marker([u.lat, u.lng], {
    icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="uni-pin ${u.id === activeId ? "on" : ""}" title="${esc(u.name)}">${icon("graduation-cap", 12)}${u.short}</div>` }),
    keyboard: false, zIndexOffset: -100,
  }).bindTooltip(u.name, { direction: "top", offset: [0, -12] }).addTo(map));
}

export function explore(main) {
  const f = S.filters;
  const uni = uniById(currentUni());
  main.innerHTML = `
    <div class="cats" id="cats"><div class="wrap-wide cats-in">
      <button class="filter-btn" id="fBtn">${icon("sliders-horizontal", 16)} Филтри ${activeFilterCount() ? `<span class="n">${activeFilterCount()}</span>` : ""}</button>
      <div class="cat-scroll" role="toolbar" aria-label="Бързи филтри">
        ${f.q ? `<button class="cat q" id="clearQ" aria-label="Махни търсенето „${esc(f.q)}“">„${esc(f.q)}“ ${icon("x", 14)}</button>` : ""}
        ${CATEGORIES.map(c => `<button class="cat" data-cat="${c.id}" aria-pressed="${f.category === c.id}">${c.label}</button>`).join("")}</div>
    </div></div>
    <div class="explore ${S.showMap ? "show-map" : ""}" id="exp">
      <section class="results" aria-live="polite">
        <div class="results-head"><h1 id="rCount"></h1>
          <label class="sr" for="sortSel">Подреди</label>
          <select id="sortSel">${[["recommended", "Препоръчани за теб"], ["price", "Най-ниска цена"], ["commute", "Най-близо до " + uni.short], ["rating", "Най-висок рейтинг"], ["newest", "Най-нови"]]
            .map(([v, t]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <p class="uni-note">${icon("bus", 16)}<span>Времето е до <b>${esc(uni.name)}</b> пеша или с градски транспорт, ориентировъчно. Цените са на човек, със сметките.</span>
          <label class="check" style="padding:0;font-size:13px;margin-left:auto"><input type="checkbox" id="inBounds" ${S.inBounds ? "checked" : ""}> Само в района на картата</label></p>
        <div class="grid" id="grid"></div>
      </section>
      <aside class="mapcol" aria-label="Карта"><div id="map"></div></aside>
      <button class="map-toggle" id="mapTgl">${S.showMap ? `Списък ${icon("list", 16)}` : `Карта ${icon("map", 16)}`}</button>
    </div>
    <footer class="foot"><div class="wrap-wide"><span>© 2026 делим · прототип</span><span>Карта: © OpenStreetMap</span></div></footer>`;

  const grid = $("#grid");
  bindCards(grid);

  // ---- map ----
  const map = baseMap($("#map"), { zoomControl: false });
  L.control.zoom({ position: "topright" }).addTo(map);
  map.setView([VARNA_CENTER.lat, VARNA_CENTER.lng], 13);
  uniMarkers(map, uni.id);
  const layer = L.layerGroup().addTo(map);
  let circle = null, markers = new Map(), rows = [], firstFit = true;

  const ctx = () => ({ me: store.me(), uniId: currentUni(), userById: store.user, reviewsFor: store.reviewsFor });

  function draw() {
    rows = search(store.listings(), S.filters, ctx());
    let shown = rows;
    if (S.inBounds && !firstFit) { const b = map.getBounds(); shown = rows.filter(r => b.contains([r.l.approx.lat, r.l.approx.lng])); }
    $("#rCount").textContent = shown.length ? `${plural(shown.length, "обява", "обяви")} във Варна` : "Няма обяви";
    grid.innerHTML = shown.length ? shown.map(cardHTML).join("") : `<div class="empty" style="grid-column:1/-1">
      <h2>Нищо не отговаря на търсенето</h2><p>Опитай с по-голям бюджет, друга категория или по-малко филтри.</p>
      <button class="btn dark" id="resetAll">Изчисти всички филтри</button></div>`;
    $("#resetAll")?.addEventListener("click", () => { S.filters = { ...DEFAULT_FILTERS }; S.inBounds = false; saveUI(); rerender(); });

    layer.clearLayers(); markers.clear();
    for (const r of rows) {
      const m = L.marker([r.l.approx.lat, r.l.approx.lng], {
        icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: pinHTML(r) }),
        riseOnHover: true, title: `${r.l.title}, €${r.pp}`,
      });
      m.bindPopup(() => popupHTML(r), { closeButton: true, offset: [0, -8], maxWidth: 300, minWidth: 280, autoPanPadding: [30, 30] });
      m.on("popupopen", e => { bindCards(e.popup.getElement()); setSel(r.l.id); });
      m.on("popupclose", () => setSel(null));
      m.addTo(layer); markers.set(r.l.id, m);
    }
    if (firstFit && rows.length) { map.fitBounds(L.latLngBounds(rows.map(r => [r.l.approx.lat, r.l.approx.lng])).pad(0.08), { maxZoom: 15 }); }
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
    <div class="card-body"><div class="card-price"><mark>€${r.pp}</mark><span>на човек · със сметките</span></div>
    <h3>${esc(r.l.title)}</h3><div class="card-foot"><span>${esc(r.l.district)}</span>${starLine(r.rating)}</div></div></a>`;

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
    $$(".cat").forEach(x => x.setAttribute("aria-pressed", x === b));
    firstFit = true; draw();
  });
  $("#clearQ")?.addEventListener("click", () => { S.filters.q = ""; saveUI(); rerender(); });
  $("#sortSel").onchange = e => { S.filters.sort = e.target.value; saveUI(); draw(); };
  $("#inBounds").onchange = e => { S.inBounds = e.target.checked; draw(); };
  $("#fBtn").onclick = () => filtersModal(rerender);
  $("#mapTgl").onclick = () => {
    S.showMap = !S.showMap;
    $("#exp").classList.toggle("show-map", S.showMap);
    $("#mapTgl").innerHTML = S.showMap ? `Списък ${icon("list", 16)}` : `Карта ${icon("map", 16)}`;
    map.later(() => map.invalidateSize(), 50);
  };
  const onScroll = () => $("#cats")?.classList.toggle("shadow", window.scrollY > 4);
  window.addEventListener("scroll", onScroll, { passive: true });

  draw();
  map.later(() => map.invalidateSize(), 100);
  return { cleanup: () => { window.removeEventListener("scroll", onScroll); map.dispose(); } };
}

// Re-runs the router, so the header, chips and map are rebuilt from the new filters.
export const rerender = () => window.dispatchEvent(new Event("delim:rerender"));

export function filtersModal(onApply = rerender) {
  const f = structuredClone(S.filters);
  const uni = uniById(currentUni());
  const all = search(store.listings(), { ...DEFAULT_FILTERS, showAllGenders: true }, { me: store.me(), uniId: uni.id, userById: store.user, reviewsFor: store.reviewsFor });
  const prices = all.map(r => r.pp);
  const lo = 150, hi = 650, bins = 20;
  const hist = Array(bins).fill(0); prices.forEach(p => hist[Math.min(bins - 1, Math.max(0, Math.floor((p - lo) / (hi - lo) * bins)))]++);
  const hmax = Math.max(1, ...hist);

  const m = modal(`<h2>Филтри</h2>
    <div class="fsec"><h3>Вид жилище</h3><p>Стая при студент — влизаш при някой, който вече живее там. Цяло жилище — от хазяин или агенция.</p>
      ${optsHTML("type", [["", "Всички"], ["room", "Стая при студент"], ["whole", "Цяло жилище"]], f.type)}</div>
    <div class="fsec"><h3>Цена на човек</h3><p>На месец, наемът и сметките разделени на всички живеещи.</p>
      <div class="hist" id="hist">${hist.map((n, i) => `<i style="height:${Math.max(4, n / hmax * 100)}%" data-b="${lo + (i + .5) * (hi - lo) / bins}"></i>`).join("")}</div>
      <input type="range" id="fMax" min="${lo}" max="${hi}" step="10" value="${f.maxPrice || hi}" aria-label="Максимална цена">
      <div class="range-vals"><span>от €${lo}</span><span id="fMaxV"></span></div></div>
    <div class="fsec"><h3>Време до ${esc(uni.short)}</h3><p>С градски транспорт, ориентировъчно. Университетът се сменя от търсачката горе.</p>
      <input type="range" id="fCom" min="10" max="60" step="5" value="${f.maxCommute || 60}" aria-label="Максимално време за път">
      <div class="range-vals"><span>10 мин</span><span id="fComV"></span></div></div>
    <div class="fsec"><h3>За колко време търсиш</h3><p>Скриваме обявите, които искат по-дълъг минимален срок.</p>
      ${optsHTML("stay", [[0, "Без значение"], [6, "6 месеца"], [10, "Учебна година"], [12, "1 година"], [24, "2+ години"]], f.stay)}</div>
    <div class="fsec"><h3>Нанасяне до</h3><p>Показва жилищата, свободни до тази дата.</p>
      <input class="inp" type="date" id="fMove" value="${f.moveIn}" style="max-width:240px"></div>
    <div class="fsec"><h3>Удобства</h3>
      <div class="opts tiles" data-name="amenities" data-multi>${Object.entries(AMENITIES).map(([k, [t, ic]]) =>
        `<button type="button" data-v="${k}" aria-pressed="${f.amenities.includes(k)}">${icon(ic, 24)}${t}</button>`).join("")}</div></div>
    <div class="fsec"><h3>Рейтинг</h3>${optsHTML("minRating", [[0, "Всички"], [4, "4+"], [4.5, "4,5+"], [4.8, "4,8+"]], f.minRating)}</div>
    <div class="fsec"><h3>Доверие</h3>
      <label class="check"><input type="checkbox" id="fVer" ${f.verifiedOnly ? "checked" : ""}><span><b>Потвърден студентски имейл</b><br><span class="muted">Домакинът е потвърдил имейл от университета.</span></span></label>
      <label class="check"><input type="checkbox" id="fCons" ${f.consentOnly ? "checked" : ""}><span><b>Хазяинът е съгласен</b><br><span class="muted">Само стаи, за които собственикът е дал съгласие за нов съквартирант.</span></span></label>
      <label class="check"><input type="checkbox" id="fGen" ${f.showAllGenders ? "checked" : ""}><span><b>Покажи и обяви за друг пол</b><br><span class="muted">По подразбиране скриваме стаите, в които търсят съквартирант от друг пол.</span></span></label></div>
    <div class="modal-foot"><button class="btn link" id="fClear">Изчисти всички</button><button class="btn dark" id="fGo"></button></div>`,
  { cls: "", label: "Филтри" });

  const el = m.el;
  const upd = () => {
    const max = +$("#fMax", el).value, com = +$("#fCom", el).value;
    f.maxPrice = max >= hi ? 0 : max; f.maxCommute = com >= 60 ? 0 : com;
    f.moveIn = $("#fMove", el).value; f.verifiedOnly = $("#fVer", el).checked; f.consentOnly = $("#fCons", el).checked; f.showAllGenders = $("#fGen", el).checked;
    $("#fMaxV", el).textContent = f.maxPrice ? `до €${f.maxPrice}` : "всяка цена";
    $("#fComV", el).textContent = f.maxCommute ? `до ${f.maxCommute} мин` : "без ограничение";
    $$("#hist i", el).forEach(i => i.classList.toggle("in", !f.maxPrice || +i.dataset.b <= f.maxPrice));
    const n = search(store.listings(), f, { me: store.me(), uniId: uni.id, userById: store.user, reviewsFor: store.reviewsFor }).length;
    $("#fGo", el).textContent = n ? `Покажи ${plural(n, "обява", "обяви")}` : "Няма обяви";
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
  return `<div class="opts" data-name="${name}">${pairs.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join("")}</div>`;
}
