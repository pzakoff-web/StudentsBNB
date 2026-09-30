import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, $$, esc, nl2br, avatar, modal, toast, stars, go, download } from "../ui.js";
import { AMENITIES, REVIEW_CATS, GENDER_PREF, TYPE_LABEL, priceSplit, listingCompat, ratingSummary, isTopRated,
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
    const loved = isTopRated(rs);
    const fav = store.isFav(l.id);
    const seeAddr = store.canSeeAddress(l);
    const residents = l.residents.map(store.user).filter(Boolean);
    const first = host.name.split(" ")[0];
    const nearSea = seaDistanceM(l.approx) <= 900;
    const genderBlocked = !own && l.genderPref !== "any" && me.gender && l.genderPref !== me.gender;
    const amen = l.amenities.map(k => AMENITIES[k] && `<li>${icon(AMENITIES[k][1], 20)}${AMENITIES[k][0]}</li>`).filter(Boolean);
    const kind = l.type === "room" ? `Стая в ${roomsWord(l.rooms)}` : roomsWord(l.rooms)[0].toUpperCase() + roomsWord(l.rooms).slice(1);

    main.innerHTML = `<div class="lp"><div class="wrap">
      <div class="lp-top">
        <nav class="crumbs" aria-label="Път"><button class="icon-btn back-btn" id="back" aria-label="Назад">${icon("arrow-left", 18)}</button>
          <a href="#/">Варна</a>${icon("chevron-right", 14)}<span>${esc(l.district)}</span>${icon("chevron-right", 14)}<span>${l.type === "room" ? "Стаи" : "Цели жилища"}</span></nav>
        <h1 class="lp-title">${esc(l.title)}</h1>
        <div class="lp-meta"><div class="l">
          ${rs.count ? `<a href="#reviews" class="rating">${icon("star", 14, "star")} ${fmtRating(rs.overall)} <span class="muted">· ${plural(rs.count, "отзив", "отзива")}</span></a>` : `<span class="badge">Нова обява</span>`}
          ${loved ? `<span class="badge">${icon("star", 12, "star")} Топ оценка</span>` : ""}
          ${l.status === "paused" ? `<span class="badge warn">Скрита</span>` : ""}</div>
          <div class="r"><button class="btn ghost sm" id="share">${icon("share", 16)} Сподели</button>
            <button class="btn ghost sm" id="save" aria-pressed="${fav}">${icon("bookmark", 16)} ${fav ? "Запазено" : "Запази"}</button></div></div>
      </div>

      ${gallery(l.photos)}

      <div class="lp-cols">
        <div class="lp-main">
          <section class="lp-sec lp-head">
            <div class="kicker">${TYPE_LABEL[l.type]}</div>
            <h2>${kind}</h2>
            <ul class="specs">${[l.rooms > 1 && plural(l.rooms, "стая", "стаи"), `${l.area} м²`, `${l.floor} етаж`, `общо ${l.occupants} ${l.occupants === 1 ? "човек" : "души"}`, l.amenities.includes("furnished") && "обзаведено"].filter(Boolean).map(x => `<li>${x}</li>`).join("")}</ul>
            <a class="hostline" href="#/u/${host.id}">${avatar(host, 44)}<div><span class="muted">Публикувано от</span><b>${esc(host.name)}</b><span class="muted">${userLine(host)} · в делим от ${yearsOn(host)}</span></div>${icon("chevron-right", 18)}</a>
          </section>

          <section class="lp-sec"><h2>Проверки</h2>
            <ul class="checks">
              ${host.emailVerified ? chk("ok", "badge-check", "Потвърден студентски имейл", `Имейлът е от домейна на ${uniById(host.university)?.short || "университета"}.`) : host.role === "student" ? chk("", "circle-help", "Имейлът още не е потвърден", "Домакинът не е потвърдил университетски имейл.") : ""}
              ${l.type === "room" ? (l.landlordConsent ? chk("ok", "shield-check", "Хазяинът е съгласен", "Собственикът е потвърдил, че приема нов съквартирант.")
                : chk("warn", "triangle-alert", "Няма потвърждение от хазяина", "Преотдаването без съгласие на собственика е риск за договора. Поискай писмено съгласие, преди да се нанесеш.")) : chk("ok", "key-round", "Договор директно със собственика", host.role === "agency" ? "Обявата е от агенция." : "Обявата е от хазяина.")}
              ${chk("", "bus", `${commuteMin(l.approx, uni)} мин до ${uni.short}`, "Пеша или с градски транспорт, ориентировъчно.")}
              ${nearSea ? chk("", "waves", "Близо до морето", `Около ${Math.round(seaDistanceM(l.approx) / 50) * 50} м до плажа.`) : ""}
            </ul></section>

          <section class="lp-sec"><h2>За жилището</h2><div class="desc">${nl2br(l.description)}</div></section>

          ${l.type === "room" ? `<section class="lp-sec"><h2>Съквартиранти</h2>
            ${own ? `<p class="muted">Това е твоята обява. Другите виждат тук теб и съвпадението си с теб.</p>` : ""}
            <div class="people">${residents.map(u => {
              const c = compat?.per.find(p => p.user.id === u.id);
              return `<div class="person"><a href="#/u/${u.id}">${avatar(u, 56)}</a><div><a href="#/u/${u.id}" class="nm">${esc(u.name)}</a>
                <div class="muted" style="font-size:14px">${userLine(u)}</div>
                ${c ? `<div class="meter"><div class="bar ${c.score >= 80 ? "hi" : ""}"><i style="width:${c.score}%"></i></div><b>${c.score}%</b></div>
                <ul class="why">${c.why.map(([k, t]) => `<li class="${k}">${icon(k === "y" ? "check" : "triangle-alert", 16)}${t}</li>`).join("")}</ul>` : ""}</div></div>`;
            }).join("")}</div>
            ${compat ? `<p class="muted" style="font-size:13px;margin-top:12px">Съвпадението се смята от профила ти: пушене, режим на сън, чистота и гости. <a href="#/me/edit">Промени профила</a></p>` : ""}
          </section>` : `<section class="lp-sec"><h2>Съквартиранти</h2>
            <p>Жилището е за ${plural(l.occupants, "човек", "души")}. Можеш да кандидатстваш сам или с хора, с които сте се намерили тук.</p>
            <a class="btn ghost" href="#/people">${icon("users", 18)} Кой търси съквартирант</a></section>`}

          <section class="lp-sec"><h2>Удобства <span class="count">${amen.length}</span></h2><ul class="amen">${amen.join("")}</ul></section>

          <section class="lp-sec" id="where"><h2>Локация</h2>
            <p style="margin:0 0 10px">${esc(l.district)}, Варна${seeAddr ? ` · <b>${esc(l.address)}</b>` : ""}</p>
            <div class="lp-map" id="lpMap"></div>
            <div class="map-note">${icon(seeAddr ? "map-pin" : "lock", 18)}<span>${seeAddr ? (own ? "Виждаш точния адрес, защото обявата е твоя. Другите виждат само кръга." : "Виждаш точния адрес, защото с домакина си споделихте контактите.")
              : `Показваме зона от ${PRIVACY_RADIUS_M} м, а не точния адрес. Адресът се вижда, след като и двамата с ${esc(first)} се съгласите да споделите контакти в чата.`}</span></div>
            <table class="commute-table"><caption class="sr">Време до университетите</caption>
              ${UNIVERSITIES.map(u => `<tr class="${u.id === uni.id ? "on" : ""}"><th scope="row">${u.short}</th><td>${esc(u.name)}</td><td>${commuteMin(l.approx, u)} мин</td></tr>`).join("")}</table>
          </section>

          <section class="lp-sec" id="reviews"><h2>Отзиви от съквартиранти ${rs.count ? `<span class="count">${rs.count}</span>` : ""}</h2>
            ${rs.count ? `<div class="rv-sum"><div class="rv-score"><b>${fmtRating(rs.overall)}</b>${stars(Math.round(rs.overall), 14)}<span class="muted">от ${plural(rs.count, "отзив", "отзива")}</span></div>
              <dl class="rv-bars">${Object.entries(REVIEW_CATS).map(([k, t]) => `<div><dt>${t}</dt><dd><span class="bar"><i style="width:${(rs.cats[k] || 0) / 5 * 100}%"></i></span><b>${rs.cats[k] ? rs.cats[k].toFixed(1).replace(".", ",") : "—"}</b></dd></div>`).join("")}</dl></div>
              <div class="reviews">${reviews.slice(0, 6).map(reviewHTML).join("")}</div>
              <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">${reviews.length > 6 ? `<button class="btn ghost" id="allRv">Още ${rs.count - 6} отзива</button>` : ""}
              ${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} Живял/а си тук? Напиши отзив</button>`}</div>`
            : `<p class="muted">Още няма отзиви. Пишат ги бивши съквартиранти.</p>${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} Живял/а си тук? Напиши отзив</button>`}`}
          </section>

          <section class="lp-sec"><h2>Условия</h2>
            <dl class="terms">
              <div><dt>${icon("calendar", 18)} Свободно от</dt><dd>${fmtDate(l.availableFrom)}</dd></div>
              <div><dt>${icon("clock", 18)} Минимален срок</dt><dd>${fmtMonths(l.minMonths)}</dd></div>
              <div><dt>${icon("wallet", 18)} Депозит</dt><dd>€${l.deposit} на човек</dd></div>
              <div><dt>${icon("users", 18)} Търси</dt><dd>${GENDER_PREF[l.genderPref].replace("Търси ", "")}</dd></div>
              <div><dt>${icon(residents.some(u => u.smoke) ? "cigarette" : "cigarette-off", 18)} Пушене</dt><dd>${l.type === "room" ? (residents.some(u => u.smoke) ? "пуши се вкъщи" : "не се пуши вкъщи") : "по договор"}</dd></div>
            </dl>
            <button class="btn ghost wrap-text" id="agree" style="margin-top:18px">${icon("file-text", 18)} Шаблон за споразумение между съквартиранти</button></section>
        </div>

        <aside class="lp-side"><div class="bill">
          ${own ? ownBox(l) : `
          <div class="bill-head">${icon("receipt", 18)} Твоят дял <span>месечно</span></div>
          <div class="bill-total"><mark>€${split.perPerson}</mark><span>на човек,<br>със сметките</span></div>
          <table class="split">
            <tr><td>Наем ${eur(l.rent)} ÷ ${l.occupants}</td><td>${eur(split.rent)}</td></tr>
            <tr><td>Сметки ~${eur(l.util)} ÷ ${l.occupants}</td><td>${eur(split.util)}</td></tr>
            <tr class="total"><td>Общо, закръглено</td><td>€${split.perPerson}</td></tr>
          </table>
          <dl class="bill-facts"><div><dt>Нанасяне</dt><dd>${fmtDate(l.availableFrom)}</dd></div><div><dt>Мин. срок</dt><dd>${fmtMonths(l.minMonths)}</dd></div>
            <div><dt>Търси</dt><dd>${GENDER_PREF[l.genderPref].replace("Търси ", "")}</dd></div><div><dt>Депозит</dt><dd>€${l.deposit}</dd></div></dl>
          ${compat ? `<div class="bill-match"><span>Съвпадение със съквартирантите</span><div class="meter"><div class="bar ${compat.score >= 80 ? "hi" : ""}"><i style="width:${compat.score}%"></i></div><b>${compat.score}%</b></div></div>` : ""}
          ${genderBlocked ? `<p class="legal">Домакинът търси ${l.genderPref === "m" ? "мъж" : "жена"}, а в профила ти е посочено друго.</p>` : ""}
          <button class="btn dark full" id="msg" ${genderBlocked ? "disabled" : ""}>${icon("message-circle", 18)} ${l.type === "room" ? "Пиши на " + esc(first) : "Кандидатствай"}</button>
          <p class="note">Нищо не се плаща тук. Телефонът ти остава скрит, докато и двамата не приемете.</p>`}
        </div></aside>
      </div></div>
      ${own ? "" : `<div class="m-book"><div><mark>€${split.perPerson}</mark> на човек<small>със сметките · от ${fmtDate(l.availableFrom)}</small></div><button class="btn dark" id="msgM" ${genderBlocked ? "disabled" : ""}>${l.type === "room" ? "Пиши" : "Кандидатствай"}</button></div>`}
    </div>`;
    document.body.classList.toggle("has-book", !own);

    // map: circle only, unless the viewer may see the address
    map = baseMap($("#lpMap"), { scrollWheelZoom: false, maxZoom: seeAddr ? 19 : 16 });
    map.setView([l.approx.lat, l.approx.lng], 15);
    uniMarkers(map, uni.id);
    L.circle([l.approx.lat, l.approx.lng], { radius: PRIVACY_RADIUS_M, color: "#1F5FA8", weight: 2, fillColor: "#1F5FA8", fillOpacity: .16 }).addTo(map);
    if (seeAddr) L.marker([l.exact.lat, l.exact.lng], { icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="pin-exact"></div>` }) }).addTo(map);

    // events
    $("#back").onclick = () => history.length > 1 ? history.back() : go("/");
    bindGallery(main, l);
    $("#share").onclick = async () => {
      const url = location.href;
      try { if (navigator.share) await navigator.share({ title: l.title, url }); else { await navigator.clipboard.writeText(url); toast("Линкът е копиран"); } }
      catch { /* cancelled */ }
    };
    $("#save").onclick = () => { const on = store.toggleFavorite(l.id); toast(on ? "Запазено" : "Махнато от запазени"); render(); };
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

const chk = (cls, ic, title, text) => `<li class="${cls}">${icon(ic, 22)}<div><b>${title}</b><span>${text}</span></div></li>`;

// One large photo with a thumbnail strip; tapping the photo opens all of them.
function gallery(photos) {
  if (!photos.length) return `<div class="stage empty-ph">${icon("image-plus", 40)}<span>Още няма снимки</span></div>`;
  return `<div class="gallery" data-i="0">
    <div class="stage"><button class="stage-img" id="stageBtn" aria-label="Отвори снимките"><img id="stageImg" src="${photoSrc(photos[0])}" alt="Снимка 1 от ${photos.length}"></button>
      ${photos.length > 1 ? `<button class="icon-btn stage-nav prev" data-step="-1" aria-label="Предишна снимка">${icon("chevron-left", 20)}</button>
      <button class="icon-btn stage-nav next" data-step="1" aria-label="Следваща снимка">${icon("chevron-right", 20)}</button>` : ""}
      <span class="stage-count" id="stageN">1 / ${photos.length}</span></div>
    ${photos.length > 1 ? `<div class="thumbs" role="tablist" aria-label="Снимки">${photos.map((p, i) => `<button role="tab" data-ph="${i}" aria-selected="${i === 0}" aria-label="Снимка ${i + 1}"><img src="${photoSrc(p)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>`;
}

function bindGallery(root, l) {
  const g = $(".gallery", root); if (!g) return;
  const n = l.photos.length;
  const show = i => {
    i = (i + n) % n; g.dataset.i = i;
    $("#stageImg", g).src = photoSrc(l.photos[i]); $("#stageImg", g).alt = `Снимка ${i + 1} от ${n}`;
    $("#stageN", g).textContent = `${i + 1} / ${n}`;
    $$("[data-ph]", g).forEach(b => b.setAttribute("aria-selected", +b.dataset.ph === i));
    $(`[data-ph="${i}"]`, g)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  g.addEventListener("click", e => {
    const t = e.target.closest("[data-ph]"), st = e.target.closest("[data-step]");
    if (t) show(+t.dataset.ph);
    else if (st) show(+g.dataset.i + +st.dataset.step);
    else if (e.target.closest("#stageBtn")) photos(l, +g.dataset.i);
  });
  let x0 = null;
  g.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  g.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(+g.dataset.i + (dx < 0 ? 1 : -1)); x0 = null; });
}

function ownBox(l) {
  const threads = store.threadsOf(store.me().id).filter(t => t.listingId === l.id);
  return `<div class="bill-head">${icon("house", 18)} Твоята обява <span>${l.status === "active" ? "активна" : "скрита"}</span></div>
    <div class="bill-total"><mark>€${priceSplit(l).perPerson}</mark><span>така я виждат<br>другите</span></div>
    <dl class="bill-facts"><div><dt>Прегледи</dt><dd>${l.views}</dd></div><div><dt>Разговори</dt><dd>${threads.length}</dd></div>
      <div><dt>Статус</dt><dd>${l.status === "active" ? "Активна" : "Скрита"}</dd></div><div><dt>Запазили</dt><dd>${store.users().filter(u => u.favorites.includes(l.id)).length}</dd></div></dl>
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
