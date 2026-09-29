import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, $$, esc, nl2br, avatar, modal, toast, stars, go, download } from "../ui.js";
import { AMENITIES, REVIEW_CATS, GENDER_PREF, TYPE_LABEL, priceSplit, listingCompat, ratingSummary, isStudentFavourite,
  fmtRating, fmtDate, fmtMonths, fmtMonthYear, eur, plural } from "../logic.js";
import { UNIVERSITIES, uniById } from "../data/places.js";
import { commuteMin, seaDistanceM, PRIVACY_RADIUS_M } from "../geo.js";
import { currentUni } from "../state.js";
import { baseMap, uniMarkers } from "./explore.js";

const roomsWord = n => ["", "гарсониера", "двустаен", "тристаен", "четиристаен", "петстаен"][n] || `${n}-стаен`;

export function userLine(u) {
  if (!u) return "";
  if (u.role !== "student") return u.role === "agency" ? "Агенция" : "Хазяин, частно лице";
  const uni = uniById(u.university);
  return `${u.year} курс, ${esc(u.faculty)}, ${uni?.short || ""}`;
}

export function yearsOn(u) {
  const m = Math.max(1, Math.round((Date.now() - new Date(u.joined)) / (30.4 * 864e5)));
  return m < 12 ? plural(m, "месец", "месеца") : plural(Math.floor(m / 12), "година", "години");
}

export function listingPage(main, id) {
  const l = store.listing(id);
  if (!l) { main.innerHTML = `<div class="wrap empty"><h2>Обявата не е намерена</h2><p>Може да е изтрита или скрита.</p><a class="btn dark" href="#/">Към всички обяви</a></div>`; return; }
  store.addView(id);
  let map = null;

  function render() {
    map?.dispose(); map = null;
    const me = store.me(), host = store.user(l.hostId), own = l.hostId === me.id;
    const uni = uniById(currentUni());
    const split = priceSplit(l);
    const compat = listingCompat(l, me, store.user);
    const reviews = store.reviewsFor(l.id).sort((a, b) => b.date.localeCompare(a.date));
    const rs = ratingSummary(reviews);
    const loved = isStudentFavourite(rs);
    const fav = store.isFav(l.id);
    const seeAddr = store.canSeeAddress(l);
    const residents = l.residents.map(store.user).filter(Boolean);
    const first = host.name.split(" ")[0];
    const ph = l.photos.slice(0, 5);
    const nearSea = seaDistanceM(l.approx) <= 900;
    const genderBlocked = !own && l.genderPref !== "any" && me.gender && l.genderPref !== me.gender;

    const amen = l.amenities.map(k => AMENITIES[k] && `<div>${icon(AMENITIES[k][1], 24)}${AMENITIES[k][0]}</div>`).filter(Boolean);

    main.innerHTML = `<div class="lp"><div class="wrap">
      <div class="gal-wrap">
        <button class="icon-btn back-btn" id="back" aria-label="Назад">${icon("chevron-left", 18)}</button>
        ${ph.length ? `<div class="gallery n${Math.min(ph.length, 5)}">${ph.map((p, i) => `<button data-ph="${i}" aria-label="Снимка ${i + 1}"><img src="${photoSrc(p)}" alt=""></button>`).join("")}
          ${l.photos.length > 1 ? `<button class="show-all" id="allPh">${icon("layers", 16)} Всички снимки (${l.photos.length})</button>` : ""}</div>` :
          `<div class="gallery n1"><button disabled><div style="display:grid;place-items:center;height:100%;color:var(--muted)">${icon("image-plus", 40)}<br>Още няма снимки</div></button></div>`}
      </div>
      <div class="lp-top">
        <h1 class="lp-title">${esc(l.title)}</h1>
        <div class="lp-meta"><div class="l">${rs.count ? `${icon("star", 14, "star")}<b>${fmtRating(rs.overall)}</b> · <a href="#reviews" class="btn link">${plural(rs.count, "отзив", "отзива")}</a> ·` : `<span class="tag">Нова обява</span> ·`}
          <span>${esc(l.district)}, Варна</span>${loved ? ` · <span>${icon("trophy", 14)} Любимо на студентите</span>` : ""}${l.status === "paused" ? ` · <span class="tag warn">Скрита</span>` : ""}</div>
          <div class="r"><button id="share">${icon("share", 16)} Сподели</button><button id="save" aria-pressed="${fav}">${icon("heart", 16)} ${fav ? "Запазено" : "Запази"}</button></div></div>
      </div>

      <div class="lp-cols">
        <div class="lp-main">
          <div class="lp-head" style="padding-bottom:24px;border-bottom:1px solid var(--line)">
            <h2>${l.type === "room" ? `Стая в ${roomsWord(l.rooms)}` : `${roomsWord(l.rooms)[0].toUpperCase() + roomsWord(l.rooms).slice(1)}`} · ${l.type === "room" ? "домакин" : "предлага"} ${esc(first)}</h2>
            <div class="facts">${[l.rooms > 1 && plural(l.rooms, "стая", "стаи"), `${l.area} м²`, `${l.floor} етаж`, `общо ${l.occupants} ${l.occupants === 1 ? "човек" : "души"}`, l.amenities.includes("furnished") && "обзаведено"].filter(Boolean).join(" · ")}</div>
            ${loved ? `<div class="fav-box"><div class="laurel">${icon("trophy", 26)}<span>Любимо на<br>студентите</span></div><div class="t">Едно от най-високо оценените жилища в делим, според бившите съквартиранти</div>
              <div class="n"><b>${fmtRating(rs.overall)}</b>${stars(Math.round(rs.overall), 10)}</div><div class="n"><b>${rs.count}</b><span style="font-size:12px">отзива</span></div></div>` : ""}
          </div>

          <a class="hostline" href="#/u/${host.id}">${avatar(host, 48)}<div><b>${l.type === "room" ? "Домакин" : "Предлага"}: ${esc(host.name)}</b><span class="muted">${userLine(host)} · в делим от ${yearsOn(host)}</span></div></a>

          <div class="highlights">
            ${host.emailVerified ? hl("badge-check", "Потвърден студентски имейл", `Имейлът е от домейна на ${uniById(host.university)?.short || "университета"}.`) : ""}
            ${l.type === "room" ? (l.landlordConsent ? hl("shield-check", "Хазяинът е съгласен", "Собственикът е потвърдил, че приема нов съквартирант. Така договорът ти е защитен.")
              : hl("triangle-alert", "Няма потвърждение от хазяина", "Преотдаването без съгласие на собственика е риск за договора. Поискай писмено съгласие преди да се нанесеш.", "warn")) : ""}
            ${hl("bus", `${commuteMin(l.approx, uni)} мин до ${uni.short}`, "Пеша или с градски транспорт, ориентировъчно. Виж времената до всички университети по-долу.")}
            ${nearSea ? hl("waves", "Близо до морето", `Около ${Math.round(seaDistanceM(l.approx) / 50) * 50} м до плажа.`) : ""}
          </div>

          <section class="lp-sec" style="padding-top:28px"><h2>За мястото</h2><div class="desc">${nl2br(l.description)}</div></section>

          ${l.type === "room" ? `<section class="lp-sec"><h2>С кого ще живееш</h2>
            ${own ? `<p class="muted">Това е твоята обява. Другите виждат тук теб и съвпадението си с теб.</p>` : ""}
            <div class="people">${residents.map(u => {
              const c = compat?.per.find(p => p.user.id === u.id);
              return `<div class="person"><a href="#/u/${u.id}">${avatar(u, 56)}</a><div><a href="#/u/${u.id}" class="nm">${esc(u.name)}</a>
                <div class="muted" style="font-size:14px">${userLine(u)}</div>
                ${c ? `<div class="meter"><div class="bar ${c.score >= 80 ? "hi" : ""}"><i style="width:${c.score}%"></i></div><b>${c.score}%</b></div>
                <ul class="why">${c.why.map(([k, t]) => `<li class="${k}">${icon(k === "y" ? "check" : "triangle-alert", 16)}${t}</li>`).join("")}</ul>` : ""}</div></div>`;
            }).join("")}</div>
            ${compat ? `<p class="muted" style="font-size:13px;margin-top:12px">Съвпадението се смята от профила ти: пушене, режим на сън, чистота и гости. <a href="#/me/edit">Промени профила</a></p>` : ""}
          </section>` : `<section class="lp-sec"><h2>Търсиш с кого да го наемеш?</h2>
            <p>Жилището е за ${plural(l.occupants, "човек", "души")}. Можеш да кандидатстваш сам или с хора, с които сте се намерили тук.</p>
            <a class="btn ghost" href="#/people">${icon("users", 18)} Виж кой търси съквартирант</a></section>`}

          <section class="lp-sec"><h2>Какво предлага мястото</h2><div class="amen">${amen.slice(0, 10).join("")}</div>
            ${amen.length > 10 ? `<button class="btn ghost" id="allAm" style="margin-top:24px">Всички ${amen.length} удобства</button>` : ""}</section>

          <section class="lp-sec" id="where"><h2>Къде ще живееш</h2>
            <p style="margin:0 0 8px">${esc(l.district)}, Варна${seeAddr ? ` · <b>${esc(l.address)}</b>` : ""}</p>
            <div class="lp-map" id="lpMap"></div>
            <div class="map-note">${icon(seeAddr ? "map-pin" : "lock", 18)}<span>${seeAddr ? (own ? "Виждаш точния адрес, защото обявата е твоя. Другите виждат само кръга." : "Виждаш точния адрес, защото с домакина си споделихте контактите.")
              : `Показваме зона от ${PRIVACY_RADIUS_M} м, а не точния адрес. Адресът се вижда, след като и двамата с ${esc(first)} се съгласите да споделите контакти в чата.`}</span></div>
            <div class="commutes">${UNIVERSITIES.map(u => `<div class="commute ${u.id === uni.id ? "on" : ""}"><b>${commuteMin(l.approx, u)} мин</b>до ${u.short}<br><span class="muted" style="font-size:12px">${esc(u.name.split(" ").slice(0, 2).join(" "))}</span></div>`).join("")}</div>
          </section>

          <section class="lp-sec" id="reviews">
            ${rs.count ? `<div class="rv-head">${icon("star", 22, "star")} ${fmtRating(rs.overall)} · ${plural(rs.count, "отзив", "отзива")}</div>
              <div class="rv-cats">${Object.entries(REVIEW_CATS).map(([k, t]) => `<div><span>${t}</span><b>${rs.cats[k] ? rs.cats[k].toFixed(1).replace(".", ",") : "—"}</b></div>`).join("")}</div>
              <div class="reviews">${reviews.slice(0, 6).map(reviewHTML).join("")}</div>
              <div style="display:flex;gap:12px;margin-top:32px;flex-wrap:wrap">${reviews.length > 6 ? `<button class="btn ghost" id="allRv">Всички ${rs.count} отзива</button>` : ""}
              ${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} Живял/а си тук? Напиши отзив</button>`}</div>`
            : `<h2>Още няма отзиви</h2><p class="muted">Отзивите пишат бивши съквартиранти.</p>${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} Живял/а си тук? Напиши отзив</button>`}`}
          </section>

          <section class="lp-sec" style="border-bottom:0"><h2>Добре е да знаеш</h2>
            <div class="amen">
              <div>${icon("calendar", 22)}<span>Свободно от <b>${fmtDate(l.availableFrom)}</b></span></div>
              <div>${icon("clock", 22)}<span>Минимален срок <b>${fmtMonths(l.minMonths)}</b></span></div>
              <div>${icon("wallet", 22)}<span>Депозит <b>€${l.deposit}</b> на човек</span></div>
              <div>${icon("users", 22)}<span>${GENDER_PREF[l.genderPref]}</span></div>
              <div>${icon(host.role === "student" ? "cigarette-off" : "key-round", 22)}<span>${l.type === "room" ? (residents.some(u => u.smoke) ? "Пуши се вкъщи" : "Не се пуши вкъщи") : "Договор директно с " + (host.role === "agency" ? "агенцията" : "хазяина")}</span></div>
              <div>${icon("file-text", 22)}<button class="btn link" id="agree">Шаблон за споразумение между съквартиранти</button></div>
            </div></section>
        </div>

        <aside class="lp-side"><div class="sticky-box">
          ${own ? ownBox(l) : `
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span><span class="big">€${split.perPerson}</span> на човек / месец</span>
            ${rs.count ? `<span class="rating">${icon("star", 14, "star")} ${fmtRating(rs.overall)} · <a href="#reviews" class="muted">${rs.count}</a></span>` : ""}</div>
          <div class="box-facts"><div><b>Нанасяне</b><span>${fmtDate(l.availableFrom)}</span></div><div><b>Срок</b><span>мин. ${fmtMonths(l.minMonths)}</span></div>
            <div><b>Търси</b><span>${GENDER_PREF[l.genderPref].replace("Търси ", "")}</span></div><div><b>Депозит</b><span>€${l.deposit}</span></div></div>
          ${genderBlocked ? `<p class="legal" style="margin-top:0">Домакинът търси ${l.genderPref === "m" ? "мъж" : "жена"}, а в профила ти е посочено друго.</p>` : ""}
          <button class="btn primary full" id="msg" ${genderBlocked ? "disabled" : ""}>${l.type === "room" ? "Пиши на " + esc(first) : "Кандидатствай"}</button>
          <p class="note">Все още нищо не се плаща. Телефонът ти остава скрит, докато и двамата не приемете.</p>
          <table class="split">
            <tr><td class="u">Наем ${eur(l.rent)} ÷ ${l.occupants}</td><td>${eur(split.rent)}</td></tr>
            <tr><td class="u">Сметки ~${eur(l.util)} ÷ ${l.occupants}</td><td>${eur(split.util)}</td></tr>
            <tr class="total"><td>Твоят дял</td><td>€${split.perPerson}</td></tr>
          </table>
          ${compat ? `<div style="border-top:1px solid var(--line);padding-top:16px"><b style="font-size:14px">Съвпадение със съквартирантите</b>
            <div class="meter"><div class="bar ${compat.score >= 80 ? "hi" : ""}"><i style="width:${compat.score}%"></i></div><b>${compat.score}%</b></div></div>` : ""}`}
        </div></aside>
      </div></div>
      ${own ? "" : `<div class="m-book"><div><b>€${split.perPerson}</b> на човек<small>със сметките · от ${fmtDate(l.availableFrom)}</small></div><button class="btn primary" id="msgM" ${genderBlocked ? "disabled" : ""}>${l.type === "room" ? "Пиши" : "Кандидатствай"}</button></div>`}
    </div>`;
    document.body.classList.toggle("has-book", !own);

    // map: circle only, unless the viewer may see the address
    map = baseMap($("#lpMap"), { scrollWheelZoom: false, maxZoom: seeAddr ? 19 : 16 });
    map.setView([l.approx.lat, l.approx.lng], 15);
    uniMarkers(map, uni.id);
    L.circle([l.approx.lat, l.approx.lng], { radius: PRIVACY_RADIUS_M, color: "#E5484D", weight: 2, fillColor: "#E5484D", fillOpacity: .18 }).addTo(map);
    if (seeAddr) L.marker([l.exact.lat, l.exact.lng], { icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="pin-exact"></div>` }) }).addTo(map);

    // events
    $("#back").onclick = () => history.length > 1 ? history.back() : go("/");
    $$("[data-ph]").forEach(b => b.onclick = () => photos(l, +b.dataset.ph));
    $("#allPh")?.addEventListener("click", () => photos(l, 0));
    $("#share").onclick = async () => {
      const url = location.href;
      try { if (navigator.share) await navigator.share({ title: l.title, url }); else { await navigator.clipboard.writeText(url); toast("Линкът е копиран"); } }
      catch { /* cancelled */ }
    };
    $("#save").onclick = () => { const on = store.toggleFavorite(l.id); toast(on ? "Запазено в Любими" : "Премахнато от Любими"); render(); };
    $("#allAm")?.addEventListener("click", () => modal(`<h2>Какво предлага мястото</h2><div class="amen" style="grid-template-columns:1fr">${amen.join("")}</div>`, { label: "Удобства" }));
    $("#allRv")?.addEventListener("click", () => modal(`<h2>${plural(rs.count, "отзив", "отзива")}</h2><div class="reviews" style="grid-template-columns:1fr">${reviews.map(reviewHTML).join("")}</div>`, { cls: "wide", label: "Отзиви" }));
    $("#addRv")?.addEventListener("click", () => reviewDialog(l, render));
    $("#agree").onclick = () => agreement(l, host, me);
    const contact = () => {
      const t = store.openThread(l.id);
      if (!t.messages.length) sessionStorage.setItem("draft:" + t.id, introDraft(l, me));
      go("/inbox/" + t.id);
    };
    $("#msg")?.addEventListener("click", contact);
    $("#msgM")?.addEventListener("click", contact);
    $("#pause")?.addEventListener("click", () => { store.updateListing(l.id, { status: l.status === "active" ? "paused" : "active" }); toast(l.status === "active" ? "Обявата е активна" : "Обявата е скрита"); render(); });
  }

  render();
  return { cleanup: () => { map?.dispose(); document.body.classList.remove("has-book"); } };
}

const hl = (ic, title, text, cls = "") => `<div class="hl ${cls}">${icon(ic, 26)}<div><b>${title}</b><span>${text}</span></div></div>`;

function ownBox(l) {
  const threads = store.threadsOf(store.me().id).filter(t => t.listingId === l.id);
  return `<div class="big" style="margin-bottom:6px">Твоята обява</div>
    <p class="muted" style="margin:0 0 16px">Показва се като €${priceSplit(l).perPerson} на човек, със сметките.</p>
    <div class="box-facts"><div><b>Прегледи</b><span>${l.views}</span></div><div><b>Разговори</b><span>${threads.length}</span></div>
      <div><b>Статус</b><span>${l.status === "active" ? "Активна" : "Скрита"}</span></div><div><b>Любими</b><span>${store.users().filter(u => u.favorites.includes(l.id)).length}</span></div></div>
    <a class="btn dark full" href="#/host/edit/${l.id}">${icon("pencil", 16)} Редактирай</a>
    <button class="btn ghost full" id="pause" style="margin-top:10px">${l.status === "active" ? "Скрий временно" : "Активирай отново"}</button>`;
}

export function reviewHTML(r) {
  const a = store.user(r.authorId);
  return `<div class="review"><a class="who" href="#/u/${a?.id}">${avatar(a, 44)}<span><b>${esc(a?.name || "Бивш потребител")}</b><span class="muted" style="font-size:13px">${a ? userLine(a) : ""}</span></span></a>
    <div class="when">${stars(r.stars, 10)} · <b>${fmtMonthYear(r.date)}</b> · <span class="muted">живя ${fmtMonths(r.stayMonths)}</span></div><p>${esc(r.text)}</p></div>`;
}

function photos(l, start) {
  const m = modal(`<h2>Снимки</h2><div class="photo-list">${l.photos.map((p, i) => `<img src="${photoSrc(p)}" alt="Снимка ${i + 1}" id="ph${i}">`).join("")}</div>`, { cls: "photo-modal", label: "Снимки" });
  setTimeout(() => $("#ph" + start, m.el)?.scrollIntoView({ block: "start" }), 60);
}

function introDraft(l, me) {
  const uni = uniById(me.university);
  const parts = [
    `Здравей! Видях обявата в ${l.district} и много ми харесва.`,
    uni ? `Аз съм ${me.year ? me.year + " курс" : ""} ${me.faculty ? "„" + me.faculty + "“" : ""} в ${uni.short}.`.replace(/\s+/g, " ") : "",
    `${me.smoke ? "Пуша" : "Не пуша"}, ${me.sleep === "late" ? "лягам късно" : "лягам рано"}${me.guests === 1 ? " и рядко имам гости" : me.guests === 3 ? " и често имам гости" : ""}.`,
    `Търся за поне ${fmtMonths(l.minMonths)}. Мога ли да дойда да видя жилището тази седмица?`,
  ];
  return parts.filter(Boolean).join(" ");
}

function reviewDialog(l, done) {
  const v = { stars: 0, cats: Object.fromEntries(Object.keys(REVIEW_CATS).map(k => [k, 0])), stayMonths: 12, text: "" };
  const starPick = (name, n) => `<div class="starpick" data-name="${name}" role="radiogroup" aria-label="${name === "stars" ? "Обща оценка" : REVIEW_CATS[name]}">${[1, 2, 3, 4, 5].map(i =>
    `<button type="button" data-v="${i}" role="radio" aria-checked="${i === n}" aria-label="${i}">${icon("star", name === "stars" ? 30 : 20, i <= n ? "on" : "off")}</button>`).join("")}</div>`;
  const m = modal(`<h2>Отзив за ${esc(l.title)}</h2>
    <div class="legal" style="margin-top:0">Демо: всеки може да пише. В истинския продукт отзив пишат само хора, живели в жилището, потвърдени от домакина.</div>
    <div class="field"><span class="lbl">Обща оценка</span><div id="spMain">${starPick("stars", 0)}</div></div>
    <div class="cols-2">${Object.entries(REVIEW_CATS).map(([k, t]) => `<div class="field"><span class="lbl">${t}</span><div data-wrap="${k}">${starPick(k, 0)}</div></div>`).join("")}</div>
    <div class="field"><label for="rvStay">Колко време живя там</label><select class="inp" id="rvStay">${[3, 6, 10, 12, 18, 24, 36].map(n => `<option value="${n}" ${n === 12 ? "selected" : ""}>${fmtMonths(n)}</option>`).join("")}</select></div>
    <div class="field"><label for="rvText">Какво да знаят следващите</label><textarea class="inp" id="rvText" maxlength="1000" placeholder="Как се живееше, какви бяха съквартирантите, какво бихте искали да знаете предварително?"></textarea><div class="hint" id="rvCnt">Поне 20 знака</div></div>
    <div class="modal-foot"><button class="btn link" data-close>Отказ</button><button class="btn dark" id="rvGo" disabled>Публикувай</button></div>`, { label: "Нов отзив" });
  const el = m.el;
  const valid = () => v.stars && Object.values(v.cats).every(Boolean) && v.text.trim().length >= 20;
  const sync = () => { $("#rvGo", el).disabled = !valid(); $("#rvCnt", el).textContent = v.text.trim().length >= 20 ? `${v.text.length}/1000` : `Поне 20 знака (${v.text.trim().length})`; };
  el.addEventListener("click", e => {
    const b = e.target.closest(".starpick button"); if (!b) return;
    const g = b.closest(".starpick"), name = g.dataset.name, n = +b.dataset.v;
    if (name === "stars") { v.stars = n; for (const k in v.cats) if (!v.cats[k]) { v.cats[k] = n; $(`[data-wrap="${k}"]`, el).innerHTML = starPick(k, n); } }
    else v.cats[name] = n;
    g.outerHTML = starPick(name, n);
    sync();
  });
  $("#rvText", el).oninput = e => { v.text = e.target.value; sync(); };
  $("#rvGo", el).onclick = () => {
    store.addReview({ listingId: l.id, targetUserId: l.hostId, stars: v.stars, cats: v.cats, text: v.text.trim(), stayMonths: +$("#rvStay", el).value });
    m.close(); toast("Благодарим за отзива"); done();
  };
}

function agreement(l, host, me) {
  const s = priceSplit(l);
  const addr = store.canSeeAddress(l) ? l.address : "[адрес на жилището]";
  const names = l.type === "room" ? [...l.residents.map(id => store.user(id)?.name), me.id === l.hostId ? "[нов съквартирант]" : me.name] : [me.name, "[съквартирант]"];
  const text = `ШАБЛОН — СПОРАЗУМЕНИЕ МЕЖДУ СЪКВАРТИРАНТИ
(Чернова от делим. Не е правен съвет. Прегледайте я, преди да я подпишете.)

Днес, ____________ г., в гр. Варна, между:
${names.map((n, i) => `${i + 1}. ${n}, ЕГН/ЛНЧ ______________`).join("\n")}
наричани по-долу „съквартиранти“, се сключи настоящото споразумение за съвместно ползване на жилище:
${addr}, гр. Варна (${l.rooms} стаи, ${l.area} м²).

1. НАЕМ И СМЕТКИ
1.1. Месечният наем по договора с наемодателя е €${l.rent} и се разделя поравно: по €${s.rent.toFixed(2)} на човек.
1.2. Сметките (ток, вода, парно, интернет) се разделят поравно. Очакваната стойност е около €${l.util} на месец общо (~€${s.util.toFixed(2)} на човек).
1.3. Всеки превежда своя дял до ____ число на месеца по сметка ______________________.
1.4. Общо очакван дял на човек: около €${s.perPerson} на месец.

2. ДЕПОЗИТ
2.1. Всеки съквартирант внася депозит от €${l.deposit}, който се връща при напускане, ако няма щети и неплатени сметки.

3. СРОК И НАПУСКАНЕ
3.1. Споразумението е за срок от ${fmtMonths(l.minMonths)}, считано от ____________.
3.2. Съквартирант, който иска да напусне по-рано, предупреждава останалите поне 30 дни предварително и помага да се намери заместник.

4. СЪГЛАСИЕ НА НАЕМОДАТЕЛЯ
4.1. ${l.landlordConsent ? "Наемодателят е дал съгласие за ползването на жилището от всички съквартиранти." : "Наемодателят ТРЯБВА да даде писмено съгласие, преди новият съквартирант да се нанесе."}
4.2. Никой не преотдава стаята си на трето лице без съгласието на останалите и на наемодателя.

5. ПРАВИЛА ЗА СЪЖИТЕЛСТВО
5.1. Тишина от 23:00 до 7:00 в делнични дни.
5.2. Пушене: ${l.type === "room" && l.residents.some(id => store.user(id)?.smoke) ? "само на балкона" : "не се пуши в жилището"}.
5.3. Гости с преспиване: до ____ нощи в месеца, след предупреждение.
5.4. Общите помещения се почистват по график: ______________________.

6. СПОРОВЕ
6.1. Страните решават споровете по взаимно съгласие, а при невъзможност — по реда на българското законодателство.

Подписи:
${names.map(n => `${n}: ____________________`).join("\n")}
`;
  download("споразумение-съквартиранти.txt", text);
  toast("Шаблонът е изтеглен");
}
