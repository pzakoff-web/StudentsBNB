import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc, savePhoto, deletePhoto } from "../photos.js";
import { $, $$, esc, toast, confirmDialog, go, debounce, opts, bindOpts } from "../ui.js";
import { AMENITIES, GENDER_PREF, pricePerPerson, priceSplit, eur, fmtDate, fmtMonths, plural } from "../logic.js";
import { VARNA_CENTER, UNIVERSITIES, uniShort, districtName, cityName } from "../data/places.js";
import { t } from "../i18n.js";
import { roomsWord } from "./listing.js";
import { forPeople } from "./card.js";
import { geocode, nearestDistrict, approximate, commuteMin, PRIVACY_RADIUS_M } from "../geo.js";
import { baseMap, uniMarkers } from "./explore.js";

export function hostingPage(main) {
  const draw = () => {
    const me = store.me(), ls = store.listingsOf(me.id);
    main.innerHTML = `<div class="wrap hosting"><div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;padding-top:0">
      <div><h1>${t("Моите обяви")}</h1><p>${ls.length ? plural(ls.length, "обява", "обяви") : t("Още нямаш обяви.")}</p></div>
      <a class="btn primary" href="#/host/new">${icon("plus", 18)} ${t("Нова обява")}</a></div>
      ${ls.length ? ls.map(l => {
        const conv = store.threadsOf(me.id).filter(th => th.listingId === l.id).length;
        return `<div class="hrow"><a href="#/l/${l.id}">${l.photos[0] ? `<img src="${photoSrc(l.photos[0])}" alt="">` : `<div style="width:120px;height:84px;border-radius:8px;background:var(--soft);display:grid;place-items:center">${icon("image-plus", 24)}</div>`}</a>
          <div style="min-width:0"><a href="#/l/${l.id}" style="text-decoration:none"><h3>${esc(l.title)}</h3></a>
            <div class="stat-row"><span class="tag ${l.status === "active" ? "ok" : "warn"}">${l.status === "active" ? t("Активна") : t("Скрита")}</span>
              <span>${t("€{n} на човек", { n: pricePerPerson(l) })}</span><span>${icon("eye", 14)} ${l.views}</span><span>${icon("message-circle", 14)} ${conv}</span><span>${esc(districtName(l.district))}</span></div></div>
          <div class="acts"><a class="btn ghost sm" href="#/host/edit/${l.id}">${icon("pencil", 14)} ${t("Редактирай")}</a>
            <button class="btn ghost sm" data-tg="${l.id}">${l.status === "active" ? t("Скрий") : t("Активирай")}</button>
            <button class="btn ghost sm" data-del="${l.id}" aria-label="${esc(t("Изтрий „{name}“", { name: l.title }))}">${icon("trash-2", 14)}</button></div></div>`;
      }).join("") : `<div class="empty">${icon("house", 40)}<h2 style="margin-top:12px">${t("Имаш свободна стая?")}</h2><p>${t("Публикувай я за 5 минути. Ние изчисляваме цената на човек и показваме само приблизителното място.")}</p><a class="btn primary" href="#/host/new">${t("Започни")}</a></div>`}
    </div>`;
  };
  main.addEventListener("click", async e => {
    const tg = e.target.closest("[data-tg]"), del = e.target.closest("[data-del]");
    if (tg) { const l = store.listing(tg.dataset.tg); store.updateListing(l.id, { status: l.status === "active" ? "paused" : "active" }); toast(l.status === "active" ? t("Обявата е активна") : t("Обявата е скрита")); draw(); }
    if (del) {
      const l = store.listing(del.dataset.del);
      if (!await confirmDialog(t("Да изтрием ли „{title}“? Това не може да се върне.", { title: l.title }), t("Изтрий"), true)) return;
      for (const p of l.photos) await deletePhoto(p);
      store.deleteListing(l.id); toast(t("Обявата е изтрита")); draw();
    }
  });
  draw();
}

const STEPS = ["type", "where", "details", "photos", "price", "who", "text", "review"];
const STEP_NAMES = ["Вид", "Адрес", "Жилище", "Снимки", "Цена", "Условия", "Текст", "Преглед"];

export function listingWizard(main, editId) {
  const me = store.me();
  const src = editId ? store.listing(editId) : null;
  if (editId && (!src || src.hostId !== me.id)) { main.innerHTML = `<div class="wrap empty"><h2>${t("Можеш да редактираш само свои обяви")}</h2><a class="btn dark" href="#/host">${t("Моите обяви")}</a></div>`; return; }
  const isStudent = me.role === "student";
  const today = new Date().toISOString().slice(0, 10);
  const d = src ? structuredClone(src) : {
    type: isStudent ? "room" : "whole", title: "", description: "", district: "", address: "", exact: null,
    rent: 600, util: 65, occupants: 2, genderPref: isStudent ? me.gender || "any" : "any", minMonths: 12, availableFrom: today,
    rooms: 2, area: 60, floor: 1, amenities: ["furnished", "wifi"], photos: [], landlordConsent: isStudent ? null : true, deposit: 300,
  };
  const newPhotos = new Set(); // uploaded during this session, deleted on cancel
  const removed = new Set();   // removed from an existing listing, deleted on save
  let step = 0, map = null, ctl = null, touchedTitle = !!src;

  function valid(s = STEPS[step]) {
    switch (s) {
      case "where": return !!d.exact && d.address.trim().length >= 3;
      case "price": return d.rent > 0 && d.util >= 0 && d.occupants >= 1;
      case "text": return d.title.trim().length >= 10 && d.description.trim().length >= 40;
      case "review": return d.type === "whole" || d.landlordConsent !== null;
      default: return true;
    }
  }

  function render() {
    map?.dispose(); map = null;
    const s = STEPS[step];
    const reach = i => i <= step || STEPS.slice(0, i).every(x => valid(x)) && !!src;
    main.innerHTML = `<div class="wiz">
      <aside class="wiz-steps" aria-label="${t("Стъпки")}"><p class="kicker">${src ? t("Редакция на обява") : t("Нова обява")}</p><ol>${STEPS.map((x, i) =>
        `<li class="${i === step ? "on" : i < step ? "done" : ""}"><button type="button" data-go="${i}" ${reach(i) && i !== step ? "" : "disabled"} ${i === step ? 'aria-current="step"' : ""}>
          <span class="num">${i < step ? icon("check", 14) : i + 1}</span>${t(STEP_NAMES[i])}</button></li>`).join("")}</ol></aside>
      <div class="wiz-body" id="wb"><p class="wiz-mstep">${t("Стъпка {i} от {n}", { i: step + 1, n: STEPS.length })} · ${t(STEP_NAMES[step])}</p>${body(s)}</div>
      <div class="wiz-foot"><div class="wiz-nav"><button class="btn ghost" id="prev" ${step ? "" : "hidden"}>${icon("arrow-left", 16)} ${t("Назад")}</button>
        <button class="btn ${s === "review" ? "yellow" : "dark"}" id="next" ${valid() ? "" : "disabled"}>${s === "review" ? (src ? t("Запази промените") : t("Публикувай")) : `${t("Напред")} ${icon("arrow-right", 16)}`}</button></div></div></div>`;
    $$("[data-go]").forEach(b => b.onclick = () => { if (STEPS[step] === "text") touchedTitle = true; step = +b.dataset.go; render(); });
    $("#prev").onclick = () => { step--; render(); };
    $("#next").onclick = next;
    wire(s);
    $("#wb").querySelector("input, textarea, button")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  const check = () => { $("#next").disabled = !valid(); };

  function next() {
    if (!valid()) return;
    if (STEPS[step] === "text") touchedTitle = true;
    if (step < STEPS.length - 1) { step++; render(); return; }
    publish();
  }

  function autoTitle() {
    if (touchedTitle) return;
    const rw = roomsWord(d.rooms), dn = d.district ? districtName(d.district) : "";
    d.title = d.type === "room" ? t("Стая в {kind}", { kind: rw }) + (dn ? ", " + dn : "")
      : rw[0].toUpperCase() + rw.slice(1) + (dn ? " " + t("в {d}", { d: dn }) : "") + " " + forPeople(d.occupants);
  }

  function body(s) {
    const pp = pricePerPerson(d);
    switch (s) {
      case "type": return `<h1>${t("Какво предлагаш?")}</h1><p class="lead">${t("Избери най-точното описание.")}</p>
        <div class="opts tiles" data-name="type" style="grid-template-columns:1fr 1fr">
          <button type="button" data-v="room" aria-pressed="${d.type === "room"}">${icon("door-open", 32)}<b>${t("Стая в моето жилище")}</b><span class="muted" style="font-weight:500">${t("Живееш там и търсиш съквартирант.")}</span></button>
          <button type="button" data-v="whole" aria-pressed="${d.type === "whole"}">${icon("building-2", 32)}<b>${t("Цяло жилище")}</b><span class="muted" style="font-weight:500">${t("Хазяин или агенция. Студентите кандидатстват сами или на група.")}</span></button></div>`;
      case "where": return `<h1>${t("Къде се намира жилището?")}</h1>
        <p class="lead">${t("Адресът остава скрит. Другите виждат само кръг с радиус {m} м, докато не решиш да го споделиш в чата.", { m: PRIVACY_RADIUS_M })}</p>
        <div class="field"><label for="addr">${t("Адрес")}</label><input class="inp" id="addr" value="${esc(d.address)}" placeholder="${t("напр. ул. „Студентска“ 5")}" autocomplete="off">
          <div id="sugg"></div><div class="hint">${t("Потърси адреса или натисни върху картата, за да поставиш точката. Точката може да се мести.")}</div></div>
        <div class="pick-map" id="pmap"></div>
        <div class="map-note" id="whereNote">${d.exact ? whereNote() : `${icon("map-pin", 18)}<span>${t("Още няма избрана точка.")}</span>`}</div>`;
      case "details": return `<h1>${t("Разкажи за жилището")}</h1><p class="lead">${t("Основното, което студентите гледат.")}</p>
        ${stepper("rooms", t("Стаи"), d.rooms, 1, 6)}${stepper("area", t("Площ, м²"), d.area, 15, 250, 5)}${stepper("floor", t("Етаж"), d.floor, 0, 20)}
        <div class="field" style="margin-top:28px"><span class="lbl">${t("Удобства")}</span>
          <div class="opts tiles" data-name="amenities" data-multi>${Object.entries(AMENITIES).map(([k, [label, ic]]) => `<button type="button" data-v="${k}" aria-pressed="${d.amenities.includes(k)}">${icon(ic, 24)}${t(label)}</button>`).join("")}</div></div>`;
      case "photos": return `<h1>${t("Добави снимки")}</h1><p class="lead">${t("Поне 3 снимки: стаята, общите части и кухнята. Първата е корица — можеш да я смениш.")}</p>
        <label class="drop" id="drop" for="phIn">${icon("image-plus", 36)}<b>${t("Провлачи снимки тук")}</b><span class="muted">${t("или натисни, за да избереш · JPG, PNG, HEIC · до 20 снимки")}</span></label>
        <input type="file" id="phIn" accept="image/*" multiple hidden>
        <div class="photos-grid" id="phs" style="margin-top:16px">${photoTiles()}</div>`;
      case "price": return `<h1>${t("Колко струва?")}</h1><p class="lead">${t("Въведи общите суми за жилището. Делът на човек се смята сам.")}</p>
        <div class="cols-2"><div class="field"><label for="rent">${t("Наем общо, €/месец")}</label><input class="inp" id="rent" type="number" min="0" step="10" inputmode="numeric" value="${d.rent}"></div>
          <div class="field"><label for="util">${t("Сметки средно, €/месец")}</label><input class="inp" id="util" type="number" min="0" step="5" inputmode="numeric" value="${d.util}"><div class="hint">${t("Ток, вода, парно, интернет")}</div></div></div>
        ${stepper("occupants", d.type === "room" ? t("Общо живеещи, заедно с новия") : t("За колко души е"), d.occupants, d.type === "room" ? 2 : 1, 8)}
        <div class="field" style="margin-top:18px"><label for="dep">${t("Депозит на човек, €")}</label><input class="inp" id="dep" type="number" min="0" step="10" inputmode="numeric" value="${d.deposit}" style="max-width:200px"></div>
        <div class="preview-price"><div class="muted" style="font-weight:700;font-size:13px">${t("Така ще изглежда в обявата")}</div><div class="big" id="ppv">€${pp}</div><div>${t("на човек / месец, със сметките")}</div>
          <div class="muted" id="ppx" style="margin-top:8px">${splitLine()}</div></div>`;
      case "who": return `<h1>${t("Кого търсиш и кога?")}</h1><p class="lead">${t("Ще показваме обявата само на хората, които отговарят.")}</p>
        <div class="field"><span class="lbl">${t("Търся")}</span>${opts("genderPref", [["m", t("Мъж")], ["f", t("Жена")], ["any", t("Без значение")]], d.genderPref)}</div>
        <div class="field"><span class="lbl">${t("Минимален срок")}</span>${opts("minMonths", [[5, t("Семестър")], [10, t("Учебна година")], [12, t("1 година")], [24, t("2 години")]], d.minMonths)}</div>
        <div class="field"><label for="from">${t("Свободно от")}</label><input class="inp" type="date" id="from" min="${today}" value="${d.availableFrom < today ? today : d.availableFrom}" style="max-width:240px"></div>`;
      case "text": autoTitle(); return `<h1>${t("Заглавие и описание")}</h1><p class="lead">${t("Кратко и честно. Какво ще хареса един студент?")}</p>
        <div class="field"><label for="ttl">${t("Заглавие")}</label><input class="inp" id="ttl" maxlength="60" value="${esc(d.title)}"><div class="hint"><span id="ttlN">${d.title.length}</span>/60 · ${t("поне 10 знака")}</div></div>
        <div class="field"><label for="dsc">${t("Описание")}</label><textarea class="inp" id="dsc" maxlength="1500" style="min-height:200px" placeholder="${t("Каква е стаята, кой живее там, какъв е кварталът, кои автобуси минават наблизо, какви са правилата вкъщи.")}">${esc(d.description)}</textarea>
          <div class="hint"><span id="dscN">${d.description.length}</span>/1500 · ${t("поне 40 знака")}</div></div>`;
      case "review": return `<h1>${src ? t("Прегледай промените") : t("Почти готово")}</h1><p class="lead">${t("Така ще изглежда обявата.")}</p>
        <div style="display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:24px;align-items:start" class="rev-grid">
          <div class="card" style="pointer-events:none"><div class="card-media"><div class="car">${d.photos[0] ? `<div class="car-track"><img src="${photoSrc(d.photos[0])}" alt=""></div>` : `<div class="car-empty">${t("Няма снимка")}</div>`}</div><span class="badge">${t("Нова")}</span></div>
            <div class="card-body"><div class="card-price"><mark>€${pp}</mark><span>${t("на човек · със сметките")}</span></div><h3>${esc(d.title)}</h3>
            <div class="card-meta">${icon("map-pin", 14)}${esc(districtName(d.district))}</div></div></div>
          <div style="display:grid;gap:10px;font-size:15px">
            <div>${icon("map-pin", 18)} ${esc(districtName(d.district))} · <span class="muted">${t("адресът е скрит")}</span></div>
            <div>${icon("wallet", 18)} ${eur(d.rent)} + ~${eur(d.util)} ${t("сметки")} ÷ ${d.occupants} = <b>€${pp}</b></div>
            <div>${icon("users", 18)} ${t(GENDER_PREF[d.genderPref])} · ${t("мин. {t}", { t: fmtMonths(d.minMonths) })} · ${t("от {date}", { date: fmtDate(d.availableFrom) })}</div>
            <div>${icon("layers", 18)} ${plural(d.photos.length, "снимка", "снимки")} · ${plural(d.amenities.length, "удобство", "удобства")}</div>
            <div>${icon("bus", 18)} ${UNIVERSITIES.slice(0, 3).map(u => `${uniShort(u)} ${t("{n} мин", { n: commuteMin(d.exact, u) })}`).join(" · ")}</div>
          </div></div>
        ${d.photos.length < 3 ? `<p class="legal">${icon("triangle-alert", 16)} ${t("Обявите с поне 3 снимки получават много повече съобщения.")} <button class="btn link" id="toPhotos">${t("Добави снимки")}</button></p>` : ""}
        ${d.type === "room" ? `<div class="fsec" style="border:0"><h3>${t("Съгласие на хазяина")}</h3>
          <div class="legal">${t("Ако си наемател, преотдаването на стая без съгласието на собственика може да е нарушение на договора ти за наем и основание за прекратяването му. Поискай писмено съгласие — дори съобщение е по-добре от нищо.")}</div>
          <label class="check"><input type="radio" name="cons" value="1" ${d.landlordConsent === true ? "checked" : ""}><span><b>${t("Хазяинът е съгласен")}</b> <span class="muted">${t("(или аз съм собственикът)")}</span></span></label>
          <label class="check"><input type="radio" name="cons" value="0" ${d.landlordConsent === false && src ? "checked" : ""}><span><b>${t("Още нямам потвърждение")}</b> <span class="muted">${t("— обявата ще е с предупреждение")}</span></span></label></div>` : ""}`;
    }
  }

  const stepper = (k, label, v, min, max, step = 1) => `<div class="stepper" data-k="${k}" data-min="${min}" data-max="${max}" data-step="${step}"><span>${label}</span>
    <span class="ctrl"><button type="button" data-d="-1" aria-label="${t("По-малко")}" ${v <= min ? "disabled" : ""}>−</button><span aria-live="polite">${v}</span><button type="button" data-d="1" aria-label="${t("Повече")}" ${v >= max ? "disabled" : ""}>+</button></span></div>`;
  const splitLine = () => `${eur(d.rent)} ÷ ${d.occupants} = ${eur(priceSplit(d).rent)} ${t("наем")} · ${eur(d.util)} ÷ ${d.occupants} = ${eur(priceSplit(d).util)} ${t("сметки")}`;
  const whereNote = () => `${icon("lock", 18)}<span><b>${esc(districtName(d.district))}</b> · ${t("Показваме само кръга. Точната точка (жълтата) виждаш само ти.")}</span>`;
  const photoTiles = () => d.photos.map((p, i) => `<div class="ph" draggable="true" data-i="${i}"><img src="${photoSrc(p)}" alt="${t("Снимка {i}", { i: i + 1 })}">${i === 0 ? `<span class="cover">${t("Корица")}</span>` : ""}
    <div class="acts"><button type="button" data-mv="-1" data-i="${i}" aria-label="${t("Премести наляво")}" ${i ? "" : "disabled"}>${icon("chevron-left", 14)}</button>
    <button type="button" data-mv="1" data-i="${i}" aria-label="${t("Премести надясно")}" ${i < d.photos.length - 1 ? "" : "disabled"}>${icon("chevron-right", 14)}</button>
    <button type="button" data-rm="${i}" aria-label="${t("Изтрий снимка")}">${icon("trash-2", 14)}</button></div></div>`).join("");

  function wire(s) {
    const wb = $("#wb");
    bindOpts(wb, (k, v) => {
      if (k === "amenities") d.amenities = v;
      else if (k === "minMonths") d.minMonths = +v;
      else if (k === "type") { d.type = v; if (v === "room" && d.occupants < 2) d.occupants = 2; if (v === "whole") d.landlordConsent = true; else if (!src) d.landlordConsent = null; }
      else d[k] = v;
      check();
    });
    wb.addEventListener("click", e => {
      const b = e.target.closest(".stepper button"); if (!b) return;
      const st = b.closest(".stepper"), k = st.dataset.k;
      d[k] = Math.max(+st.dataset.min, Math.min(+st.dataset.max, d[k] + +b.dataset.d * +st.dataset.step));
      st.outerHTML = stepper(k, st.firstElementChild.textContent, d[k], +st.dataset.min, +st.dataset.max, +st.dataset.step);
      if (k === "occupants") updPrice();
      check();
    });
    if (s === "where") wireWhere();
    if (s === "photos") wirePhotos();
    if (s === "price") {
      ["rent", "util", "dep"].forEach(id => $("#" + id).addEventListener("input", () => {
        d.rent = Math.max(0, +$("#rent").value || 0); d.util = Math.max(0, +$("#util").value || 0); d.deposit = Math.max(0, +$("#dep").value || 0);
        updPrice(); check();
      }));
    }
    if (s === "who") $("#from").onchange = e => { d.availableFrom = e.target.value || today; };
    if (s === "text") {
      $("#ttl").oninput = e => { d.title = e.target.value; touchedTitle = true; $("#ttlN").textContent = d.title.length; check(); };
      $("#dsc").oninput = e => { d.description = e.target.value; $("#dscN").textContent = d.description.length; check(); };
    }
    if (s === "review") {
      $$("input[name=cons]").forEach(r => r.onchange = () => { d.landlordConsent = r.value === "1"; check(); });
      $("#toPhotos")?.addEventListener("click", () => { step = STEPS.indexOf("photos"); render(); });
    }
  }
  function updPrice() { const el = $("#ppv"); if (el) { el.textContent = "€" + pricePerPerson(d); $("#ppx").textContent = splitLine(); } }

  function wireWhere() {
    map = baseMap($("#pmap"));
    const start = d.exact || VARNA_CENTER;
    map.setView([start.lat, start.lng], d.exact ? 16 : 13);
    uniMarkers(map);
    let marker = null, circle = null;
    const place = (p, fromMap) => {
      d.exact = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
      d.district = nearestDistrict(d.exact);
      // Preview uses a fresh random circle; the one stored is drawn once at save time.
      const a = src && src.exact && Math.hypot(src.exact.lat - d.exact.lat, src.exact.lng - d.exact.lng) < 2e-4 ? src.approx : approximate(d.exact);
      marker ? marker.setLatLng(d.exact) : (marker = L.marker(d.exact, { draggable: true, icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="pin-exact"></div>` }) }).addTo(map)
        .on("dragend", e => place(e.target.getLatLng(), true)));
      circle ? circle.setLatLng([a.lat, a.lng]) : (circle = L.circle([a.lat, a.lng], { radius: PRIVACY_RADIUS_M, color: "#1F5FA8", weight: 2, fillColor: "#1F5FA8", fillOpacity: .16, interactive: false }).addTo(map));
      if (!fromMap) map.setView(d.exact, 16);
      if (!d.address.trim()) { d.address = `${d.district}, Варна`; $("#addr").value = d.address; } // stored in Bulgarian
      $("#whereNote").innerHTML = whereNote();
      check();
    };
    if (d.exact) place(d.exact, true);
    map.on("click", e => place(e.latlng, true));
    const box = $("#sugg");
    let abort = null;
    const find = debounce(async q => {
      abort?.abort(); abort = new AbortController();
      if (q.length < 3) { box.innerHTML = ""; return; }
      try {
        const res = await geocode(q, abort.signal);
        box.innerHTML = res.length ? `<div class="suggest" role="listbox">${res.map((r, i) => `<button type="button" role="option" data-i="${i}">${icon("map-pin", 16)}<span>${esc(r.label)}</span></button>`).join("")}</div>`
          : `<div class="hint">${t("Не намерихме адреса. Постави точката на картата.")}</div>`;
        box.onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const r = res[+b.dataset.i];
          d.address = r.label.split(", ").slice(0, 2).join(", "); $("#addr").value = d.address; box.innerHTML = ""; place(r, false); };
      } catch (err) { if (err.name !== "AbortError") box.innerHTML = `<div class="hint">${t("Търсенето на адрес не работи в момента. Постави точката на картата.")}</div>`; }
    }, 500);
    $("#addr").oninput = e => { d.address = e.target.value; find(e.target.value.trim()); check(); };
    map.later(() => map.invalidateSize(), 60);
  }

  function wirePhotos() {
    const drop = $("#drop"), input = $("#phIn"), grid = $("#phs");
    const redraw = () => { grid.innerHTML = photoTiles(); check(); };
    const add = async files => {
      const list = [...files].filter(f => f.type.startsWith("image/")).slice(0, 20 - d.photos.length);
      if (!list.length) { toast(d.photos.length >= 20 ? t("Максимум 20 снимки") : t("Избери снимки")); return; }
      toast(t("Качване на {n}…", { n: plural(list.length, "снимка", "снимки") }));
      for (const f of list) {
        try { const ref = await savePhoto(f); d.photos.push(ref); newPhotos.add(ref); redraw(); }
        catch { toast(t("„{name}“ не можа да се качи", { name: f.name })); }
      }
    };
    input.onchange = () => { add(input.files); input.value = ""; };
    drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    drop.tabIndex = 0;
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => add(e.dataTransfer.files));
    grid.addEventListener("click", e => {
      const mv = e.target.closest("[data-mv]"), rm = e.target.closest("[data-rm]");
      if (mv) { const i = +mv.dataset.i, j = i + +mv.dataset.mv; [d.photos[i], d.photos[j]] = [d.photos[j], d.photos[i]]; redraw(); }
      if (rm) { const [ref] = d.photos.splice(+rm.dataset.rm, 1); if (newPhotos.has(ref)) { deletePhoto(ref); newPhotos.delete(ref); } else removed.add(ref); redraw(); }
    });
    let dragI = null;
    grid.addEventListener("dragstart", e => { const el = e.target.closest(".ph"); if (!el) return; dragI = +el.dataset.i; el.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; });
    grid.addEventListener("dragover", e => { if (dragI != null) e.preventDefault(); });
    grid.addEventListener("drop", e => { const el = e.target.closest(".ph"); if (dragI == null || !el) return; e.preventDefault(); e.stopPropagation();
      const [p] = d.photos.splice(dragI, 1); d.photos.splice(+el.dataset.i, 0, p); dragI = null; redraw(); });
    grid.addEventListener("dragend", () => { dragI = null; $$(".ph.drag", grid).forEach(x => x.classList.remove("drag")); });
  }

  async function publish() {
    const data = { type: d.type, title: d.title.trim(), description: d.description.trim(), district: d.district, address: d.address.trim(), exact: d.exact,
      rent: d.rent, util: d.util, occupants: d.occupants, genderPref: d.genderPref, minMonths: d.minMonths, availableFrom: d.availableFrom,
      rooms: d.rooms, area: d.area, floor: d.floor, amenities: d.amenities, photos: d.photos, deposit: d.deposit,
      landlordConsent: d.type === "whole" ? true : !!d.landlordConsent };
    for (const r of removed) await deletePhoto(r);
    newPhotos.clear();
    const l = src ? store.updateListing(src.id, data) : store.createListing(data);
    const told = src ? 0 : store.matchingSearches(l).length;
    toast(src ? t("Промените са запазени") : told ? t("Обявата е публикувана. Известихме {n} с подходящо търсене.", { n: plural(told, "човек", "души") }) : t("Обявата е публикувана"));
    go("/l/" + l.id);
  }

  render();
  return { cleanup: () => { map?.dispose(); for (const r of newPhotos) deletePhoto(r); } };
}
