import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, $$, esc, nl2br, avatar, modal, toast, stars, go, download, copyText } from "../ui.js";
import { AMENITIES, REVIEW_CATS, TYPE_LABEL, priceSplit, listingCompat, ratingSummary, isTopRated,
  fmtRating, fmtDate, fmtMonths, fmtMonthYear, eur, plural, fairPrice, fairLabel, isGoodDeal, groupCompat } from "../logic.js";
import { UNIVERSITIES, uniById, uniShort, uniName, districtName, cityName, unisByIds, isAllUnis } from "../data/places.js";
import { commuteMin, seaDistanceM, nearestUni, PRIVACY_RADIUS_M } from "../geo.js";
import { currentUnis, S } from "../state.js";
import { t } from "../i18n.js";
import { baseMap, uniMarkers } from "./explore.js";
import { shareDialog } from "./share.js";
import { forPeople } from "./card.js";
import { tx, txBlock, nm } from "../translate.js";

const ROOMS = ["", "гарсониера", "двустаен", "тристаен", "четиристаен", "петстаен"];
export const roomsWord = n => ROOMS[n] ? t(ROOMS[n]) : t("{n}-стаен", { n });
const cap = s => s[0].toUpperCase() + s.slice(1);
const peopleCount = n => n === 1 ? t("1 човек") : t("{n} души", { n });

export function userLine(u) {
  if (!u) return "";
  if (u.role !== "student") return u.role === "agency" ? t("Агенция") : t("Хазяин, частно лице");
  const uni = uniById(u.university);
  return t("{year} курс, {faculty}, {uni}", { year: u.year, faculty: tx(u.faculty), uni: uniShort(uni) });
}

export function yearsOn(u) {
  const m = Math.max(1, Math.round((Date.now() - new Date(u.joined)) / (30.4 * 864e5)));
  return m < 12 ? plural(m, "месец", "месеца") : plural(Math.floor(m / 12), "година", "години");
}

const genderWord = g => t({ m: "мъж", f: "жена", any: "без значение" }[g]);

// Canned demo replies in the viewer's language.
export const demoReply = n => t(["Здрасти! Благодаря за съобщението. Стаята още е свободна — кога ти е удобно да минеш да я видиш?",
  "Здравей! Да, още търся. Можеш ли в четвъртък след 18:00? Ще ти покажа всичко на място.",
  "Хей! Звучи добре. Разкажи ми малко повече — за колко време търсиш?"][n % 3]);

export function listingPage(main, id) {
  const l = store.listing(id);
  if (!l) { main.innerHTML = `<div class="wrap empty"><h2>${t("Обявата не е намерена")}</h2><p>${t("Може да е изтрита или скрита.")}</p><a class="btn dark" href="#/">${t("Към всички обяви")}</a></div>`; return; }
  store.addView(id);
  let map = null;

  function render() {
    map?.dispose(); map = null;
    const me = store.me(), host = store.user(l.hostId), own = l.hostId === me.id;
    const unis = currentUnis(), picked = new Set(isAllUnis(unis) ? [] : unis);
    const near = nearestUni(l.approx, unisByIds(unis));
    const split = priceSplit(l);
    const compat = listingCompat(l, me, store.user);
    const reviews = store.reviewsFor(l.id).sort((a, b) => b.date.localeCompare(a.date));
    const rs = ratingSummary(reviews);
    const loved = isTopRated(rs);
    const fav = store.isFav(l.id);
    const seeAddr = store.canSeeAddress(l);
    const residents = l.residents.map(store.user).filter(Boolean);
    const first = nm(host.name).split(" ")[0];
    const nearSea = seaDistanceM(l.approx) <= 900;
    const genderBlocked = !own && l.genderPref !== "any" && me.gender && l.genderPref !== me.gender;
    const amen = l.amenities.map(k => AMENITIES[k] && `<li>${icon(AMENITIES[k][1], 20)}${t(AMENITIES[k][0])}</li>`).filter(Boolean);
    const kind = l.type === "room" ? t("Стая в {kind}", { kind: roomsWord(l.rooms) }) : cap(roomsWord(l.rooms));
    const fair = fairPrice(l, store.listings());
    const grp = store.groupOf(), gsize = grp ? store.groupMembers(grp).length : 0;
    const canGroup = !own && l.type === "whole" && gsize >= 2;
    const dec = v => v.toFixed(1).replace(".", S.lang === "en" ? "." : ",");

    main.innerHTML = `<div class="lp"><div class="wrap">
      <div class="lp-top">
        <nav class="crumbs" aria-label="${t("Път")}"><button class="icon-btn back-btn" id="back" aria-label="${t("Назад")}">${icon("arrow-left", 18)}</button>
          <a href="#/">${cityName()}</a>${icon("chevron-right", 14)}<span>${esc(districtName(l.district))}</span>${icon("chevron-right", 14)}<span>${t(l.type === "room" ? "Стаи" : "Цели жилища")}</span></nav>
        <h1 class="lp-title">${tx(l.title)}</h1>
        <div class="lp-meta"><div class="l">
          ${rs.count ? `<a href="#reviews" class="rating">${icon("star", 14, "star")} ${fmtRating(rs.overall)} <span class="muted">· ${plural(rs.count, "отзив", "отзива")}</span></a>` : `<span class="badge">${t("Нова обява")}</span>`}
          ${loved ? `<span class="badge">${icon("star", 12, "star")} ${t("Топ оценка")}</span>` : ""}
          ${isGoodDeal(fair) ? `<span class="badge deal">${icon("wallet", 12)} ${t("Изгодна")}</span>` : ""}
          ${l.status === "paused" ? `<span class="badge warn">${t("Скрита")}</span>` : ""}</div>
          <div class="r"><button class="btn ghost sm" id="fbShare">${icon("share-2", 16)} ${t("Публикувай във Facebook")}</button>
            <button class="btn ghost sm" id="share">${icon("share", 16)} ${t("Сподели")}</button>
            <button class="btn ghost sm" id="save" aria-pressed="${fav}">${icon("bookmark", 16)} ${fav ? t("Запазено") : t("Запази")}</button></div></div>
        ${S.lang !== "bg" ? `<p class="lang-note">${icon("globe", 14)} ${t("Текстът на обявата е написан от домакина на български.")}</p>` : ""}
      </div>

      ${gallery(l.photos)}

      <div class="lp-cols">
        <div class="lp-main">
          <section class="lp-sec lp-head">
            <div class="kicker">${t(TYPE_LABEL[l.type])}</div>
            <h2>${kind}</h2>
            <ul class="specs">${[l.rooms > 1 && plural(l.rooms, "стая", "стаи"), `${l.area} м²`, t("{n} етаж", { n: l.floor }), t("общо {who}", { who: peopleCount(l.occupants) }), l.amenities.includes("furnished") && t("обзаведено")].filter(Boolean).map(x => `<li>${x}</li>`).join("")}</ul>
            <a class="hostline" href="#/u/${host.id}">${avatar(host, 44)}<div><span class="muted">${t("Публикувано от")}</span><b>${esc(nm(host.name))}</b><span class="muted">${userLine(host)} · ${t("в делим от {t}", { t: yearsOn(host) })}</span></div>${icon("chevron-right", 18)}</a>
          </section>

          <section class="lp-sec"><h2>${t("Проверки")}</h2>
            <ul class="checks">
              ${host.emailVerified ? chk("ok", "badge-check", t("Потвърден студентски имейл"), t("Имейлът е от домейна на {uni}.", { uni: uniShort(uniById(host.university)) || t("университета") })) : host.role === "student" ? chk("", "circle-help", t("Имейлът още не е потвърден"), t("Домакинът не е потвърдил университетски имейл.")) : ""}
              ${l.type === "room" ? (l.landlordConsent ? chk("ok", "shield-check", t("Хазяинът е съгласен"), t("Собственикът е потвърдил, че приема нов съквартирант."))
                : chk("warn", "triangle-alert", t("Няма потвърждение от хазяина"), t("Преотдаването без съгласие на собственика е риск за договора. Поискай писмено съгласие, преди да се нанесеш."))) : chk("ok", "key-round", t("Договор директно със собственика"), host.role === "agency" ? t("Обявата е от агенция.") : t("Обявата е от хазяина."))}
              ${fair ? chk(isGoodDeal(fair) ? "ok" : fair.pct > 0.08 ? "warn" : "", fair.diff <= 0 ? "trending-down" : "trending-up", t("Цена спрямо района"), esc(fairLabel(fair, l.district)) + " · " + t("сравнено с {n} обяви", { n: fair.n })) : ""}
              ${chk("", "bus", t("{n} мин до {uni}", { n: near.min, uni: uniShort(near.uni) }), t("Пеша или с градски транспорт, ориентировъчно."))}
              ${nearSea ? chk("", "waves", t("Близо до морето"), t("Около {m} м до плажа.", { m: Math.round(seaDistanceM(l.approx) / 50) * 50 })) : ""}
            </ul></section>

          <section class="lp-sec"><h2>${t("За жилището")}</h2>${txBlock(l.description)}</section>

          ${l.type === "room" ? `<section class="lp-sec"><h2>${t("Съквартиранти")}</h2>
            ${own ? `<p class="muted">${t("Това е твоята обява. Другите виждат тук теб и съвпадението си с теб.")}</p>` : ""}
            <div class="people">${residents.map(u => {
              const c = compat?.per.find(p => p.user.id === u.id);
              return `<div class="person"><a href="#/u/${u.id}">${avatar(u, 56)}</a><div><a href="#/u/${u.id}" class="nm">${esc(nm(u.name))}</a>
                <div class="muted" style="font-size:14px">${userLine(u)}</div>
                ${c ? `<div class="meter"><div class="bar ${c.score >= 80 ? "hi" : ""}"><i style="width:${c.score}%"></i></div><b>${c.score}%</b></div>
                <ul class="why">${c.why.map(([k, txt]) => `<li class="${k}">${icon(k === "y" ? "check" : "triangle-alert", 16)}${txt}</li>`).join("")}</ul>` : ""}</div></div>`;
            }).join("")}</div>
            ${compat ? `<p class="muted" style="font-size:13px;margin-top:12px">${t("Съвпадението се смята от профила ти: пушене, режим на сън, чистота и гости.")} <a href="#/me/edit">${t("Промени профила")}</a></p>` : ""}
          </section>` : `<section class="lp-sec"><h2>${t("Съквартиранти")}</h2>
            <p>${t("Жилището е {who}. Можеш да кандидатстваш сам или с група, с която сте се намерили тук.", { who: forPeople(l.occupants) })}</p>
            ${grp ? groupBox(grp, l) : `<a class="btn ghost" href="#/group">${icon("users", 18)} ${t("Направи група")}</a> <a class="btn link" href="#/people" style="margin-left:12px">${t("Кой търси съквартирант")}</a>`}</section>`}

          <section class="lp-sec"><h2>${t("Удобства")} <span class="count">${amen.length}</span></h2><ul class="amen">${amen.join("")}</ul></section>

          <section class="lp-sec" id="where"><h2>${t("Локация")}</h2>
            <p style="margin:0 0 10px">${esc(districtName(l.district))}, ${cityName()}${seeAddr ? ` · <b>${esc(l.address)}</b>` : ""}</p>
            <div class="lp-map" id="lpMap"></div>
            <div class="map-note">${icon(seeAddr ? "map-pin" : "lock", 18)}<span>${seeAddr ? (own ? t("Виждаш точния адрес, защото обявата е твоя. Другите виждат само кръга.") : t("Виждаш точния адрес, защото с домакина си споделихте контактите."))
              : t("Показваме зона от {m} м, а не точния адрес. Адресът се вижда, след като и двамата с {name} се съгласите да споделите контакти в чата.", { m: PRIVACY_RADIUS_M, name: esc(first) })}</span></div>
            <table class="commute-table"><caption class="sr">${t("Време до университетите")}</caption>
              ${UNIVERSITIES.map(u => `<tr class="${picked.has(u.id) || u.id === near.uni.id ? "on" : ""}"><th scope="row">${uniShort(u)}</th><td>${esc(uniName(u))}</td><td>${t("{n} мин", { n: commuteMin(l.approx, u) })}</td></tr>`).join("")}</table>
          </section>

          <section class="lp-sec" id="reviews"><h2>${t("Отзиви от съквартиранти")} ${rs.count ? `<span class="count">${rs.count}</span>` : ""}</h2>
            ${rs.count ? `<div class="rv-sum"><div class="rv-score"><b>${fmtRating(rs.overall)}</b>${stars(Math.round(rs.overall), 14)}<span class="muted">${t("от {n}", { n: plural(rs.count, "отзив", "отзива") })}</span></div>
              <dl class="rv-bars">${Object.entries(REVIEW_CATS).map(([k, label]) => `<div><dt>${t(label)}</dt><dd><span class="bar"><i style="width:${(rs.cats[k] || 0) / 5 * 100}%"></i></span><b>${rs.cats[k] ? dec(rs.cats[k]) : "—"}</b></dd></div>`).join("")}</dl></div>
              ${S.lang !== "bg" ? `<p class="lang-note">${icon("globe", 14)} ${t("Отзивите са на езика, на който са написани.")}</p>` : ""}
              <div class="reviews">${reviews.slice(0, 6).map(reviewHTML).join("")}</div>
              <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">${reviews.length > 6 ? `<button class="btn ghost" id="allRv">${t("Още {n}", { n: plural(rs.count - 6, "отзив", "отзива") })}</button>` : ""}
              ${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} ${t("Живял/а си тук? Напиши отзив")}</button>`}</div>`
            : `<p class="muted">${t("Още няма отзиви. Пишат ги бивши съквартиранти.")}</p>${own ? "" : `<button class="btn ghost" id="addRv">${icon("pencil", 16)} ${t("Живял/а си тук? Напиши отзив")}</button>`}`}
          </section>

          <section class="lp-sec"><h2>${t("Условия")}</h2>
            <dl class="terms">
              <div><dt>${icon("calendar", 18)} ${t("Свободно от")}</dt><dd>${fmtDate(l.availableFrom)}</dd></div>
              <div><dt>${icon("clock", 18)} ${t("Минимален срок")}</dt><dd>${fmtMonths(l.minMonths)}</dd></div>
              <div><dt>${icon("wallet", 18)} ${t("Депозит")}</dt><dd>${t("€{n} на човек", { n: l.deposit })}</dd></div>
              <div><dt>${icon("users", 18)} ${t("Търси")}</dt><dd>${genderWord(l.genderPref)}</dd></div>
              <div><dt>${icon(residents.some(u => u.smoke) ? "cigarette" : "cigarette-off", 18)} ${t("Пушене")}</dt><dd>${l.type === "room" ? (residents.some(u => u.smoke) ? t("пуши се вкъщи") : t("не се пуши вкъщи")) : t("по договор")}</dd></div>
            </dl>
            <button class="btn ghost wrap-text" id="agree" style="margin-top:18px">${icon("file-text", 18)} ${t("Шаблон за споразумение между съквартиранти")}</button></section>
        </div>

        <aside class="lp-side"><div class="bill">
          ${own ? ownBox(l) : `
          <div class="bill-head">${icon("receipt", 18)} ${t("Твоят дял")} <span>${t("месечно")}</span></div>
          <div class="bill-total"><mark>€${split.perPerson}</mark><span>${t("на човек,<br>със сметките")}</span></div>
          <table class="split">
            <tr><td>${t("Наем")} ${eur(l.rent)} ÷ ${l.occupants}</td><td>${eur(split.rent)}</td></tr>
            <tr><td>${t("Сметки")} ~${eur(l.util)} ÷ ${l.occupants}</td><td>${eur(split.util)}</td></tr>
            <tr class="total"><td>${t("Общо, закръглено")}</td><td>€${split.perPerson}</td></tr>
          </table>
          ${fair ? `<p class="bill-fair ${isGoodDeal(fair) ? "good" : fair.pct > 0.08 ? "high" : ""}">${icon(fair.diff <= 0 ? "trending-down" : "trending-up", 16)} ${esc(fairLabel(fair, l.district))}</p>` : ""}
          <dl class="bill-facts"><div><dt>${t("Нанасяне")}</dt><dd>${fmtDate(l.availableFrom)}</dd></div><div><dt>${t("Мин. срок")}</dt><dd>${fmtMonths(l.minMonths)}</dd></div>
            <div><dt>${t("Търси")}</dt><dd>${genderWord(l.genderPref)}</dd></div><div><dt>${t("Депозит")}</dt><dd>€${l.deposit}</dd></div></dl>
          ${compat ? `<div class="bill-match"><span>${t("Съвпадение със съквартирантите")}</span><div class="meter"><div class="bar ${compat.score >= 80 ? "hi" : ""}"><i style="width:${compat.score}%"></i></div><b>${compat.score}%</b></div></div>` : ""}
          ${genderBlocked ? `<p class="legal">${t("Домакинът търси {g}, а в профила ти е посочено друго.", { g: genderWord(l.genderPref) })}</p>` : ""}
          ${canGroup ? `<button class="btn yellow full" id="grpApply">${icon("users", 18)} ${t("Кандидатствай с групата ({n})", { n: gsize })}</button>` : ""}
          <button class="btn dark full" id="msg" ${genderBlocked ? "disabled" : ""}>${icon("message-circle", 18)} ${l.type === "room" ? t("Пиши на {name}", { name: esc(first) }) : t("Кандидатствай")}</button>
          <p class="note">${t("Нищо не се плаща тук. Телефонът ти остава скрит, докато и двамата не приемете.")}</p>`}
        </div></aside>
      </div></div>
      ${own ? "" : `<div class="m-book"><div><mark>€${split.perPerson}</mark> ${t("на човек")}<small>${t("със сметките")} · ${t("от {date}", { date: fmtDate(l.availableFrom) })}</small></div><button class="btn dark" id="msgM" ${genderBlocked ? "disabled" : ""}>${canGroup ? t("С групата") : l.type === "room" ? t("Пиши") : t("Кандидатствай")}</button></div>`}
    </div>`;
    document.body.classList.toggle("has-book", !own);

    // map: circle only, unless the viewer may see the address
    map = baseMap($("#lpMap"), { scrollWheelZoom: false, maxZoom: seeAddr ? 19 : 16 });
    map.setView([l.approx.lat, l.approx.lng], 15);
    uniMarkers(map, unis);
    L.circle([l.approx.lat, l.approx.lng], { radius: PRIVACY_RADIUS_M, color: "#1F5FA8", weight: 2, fillColor: "#1F5FA8", fillOpacity: .16 }).addTo(map);
    if (seeAddr) L.marker([l.exact.lat, l.exact.lng], { icon: L.divIcon({ className: "pin-wrap", iconSize: [0, 0], html: `<div class="pin-exact"></div>` }) }).addTo(map);

    // events
    $("#back").onclick = () => history.length > 1 ? history.back() : go("/");
    bindGallery(main, l);
    $("#share").onclick = async () => {
      const url = location.href;
      try { if (navigator.share) await navigator.share({ title: l.title, url }); else if (await copyText(url)) toast(t("Линкът е копиран")); }
      catch { /* cancelled */ }
    };
    $("#fbShare").onclick = () => shareDialog(l);
    $("#save").onclick = () => { const on = store.toggleFavorite(l.id); toast(on ? t("Запазено") : t("Махнато от запазени")); render(); };
    $("#allRv")?.addEventListener("click", () => modal(`<h2>${plural(rs.count, "отзив", "отзива")}</h2><div class="reviews" style="grid-template-columns:1fr">${reviews.map(reviewHTML).join("")}</div>`, { cls: "wide", label: t("Отзиви") }));
    $("#addRv")?.addEventListener("click", () => reviewDialog(l, render));
    $("#agree").onclick = () => agreement(l, me);
    const contact = () => {
      const th = store.openThread(l.id);
      if (!th.messages.length) sessionStorage.setItem("draft:" + th.id, introDraft(l, me));
      go("/inbox/" + th.id);
    };
    const groupApply = () => groupApplyDialog(l, grp);
    $("#msg")?.addEventListener("click", contact);
    $("#grpApply")?.addEventListener("click", groupApply);
    $("#grpApply2")?.addEventListener("click", groupApply);
    $("#msgM")?.addEventListener("click", canGroup ? groupApply : contact);
    $("#pause")?.addEventListener("click", () => { store.updateListing(l.id, { status: l.status === "active" ? "paused" : "active" }); toast(l.status === "active" ? t("Обявата е активна") : t("Обявата е скрита")); render(); });
  }

  render();
  return { cleanup: () => { map?.dispose(); document.body.classList.remove("has-book"); } };
}

const chk = (cls, ic, title, text) => `<li class="${cls}">${icon(ic, 22)}<div><b>${title}</b>${text ? `<span>${text}</span>` : ""}</div></li>`;

function groupBox(g, l) {
  const members = store.groupMembers(g), n = members.length;
  const fits = n === l.occupants, budget = store.groupBudget(g), pp = priceSplit(l).perPerson;
  return `<div class="grp-box"><div class="grp-head">${icon("users", 18)}<b>${tx(g.name)}</b><span class="muted">${peopleCount(n)}</span></div>
    <div class="grp-avs">${members.map(u => avatar(u, 32)).join("")}</div>
    <ul class="checks compact">
      ${chk(fits ? "ok" : "warn", fits ? "check" : "triangle-alert", fits ? t("Жилището е точно за групата ви") : t("Жилището е за {a}, а групата ви е {b}", { a: peopleCount(l.occupants), b: peopleCount(n) }), "")}
      ${budget ? chk(pp <= budget ? "ok" : "warn", "wallet", pp <= budget ? t("В рамките на бюджета ви (до €{b})", { b: budget }) : t("Над бюджета ви с €{d}", { d: pp - budget }), "") : ""}
      ${n >= 2 ? chk("", "sparkles", t("Съвпадение в групата: {n}%", { n: groupCompat(members) }), "") : ""}
    </ul>
    ${n >= 2 ? `<button class="btn yellow" id="grpApply2">${icon("send", 16)} ${t("Кандидатствай с групата ({n})", { n })}</button>` : `<a class="btn ghost" href="#/group">${t("Покани хора в групата")}</a>`}</div>`;
}

function groupApplyDialog(l, g) {
  const members = store.groupMembers(g);
  const host = store.user(l.hostId);
  const text = t("Здравейте! Ние сме група от {n} студенти и искаме да наемем жилището заедно: {names}. Кога можем да дойдем на оглед?",
    { n: members.length, names: members.map(u => u.name).join(", ") });
  const m = modal(`<h2>${t("Кандидатура на групата")}</h2>
    <div class="grp-avs" style="margin-bottom:12px">${members.map(u => avatar(u, 36)).join("")}</div>
    <div class="field"><label for="gaText">${t("Съобщение до {name}", { name: esc(nm(host.name)) })}</label><textarea class="inp" id="gaText" maxlength="1000">${esc(text)}</textarea></div>
    <p class="muted" style="font-size:13px">${t("Останалите от групата ще получат известие, че сте кандидатствали.")}</p>
    <div class="modal-foot"><button class="btn link" data-close>${t("Отказ")}</button><button class="btn dark" id="gaGo">${icon("send", 16)} ${t("Изпрати")}</button></div>`, { label: t("Кандидатура на групата") });
  $("#gaGo", m.el).onclick = () => {
    const th = store.applyAsGroup(l.id, $("#gaText", m.el).value.trim() || text, demoReply(1));
    m.close(); toast(t("Кандидатурата е изпратена")); go("/inbox/" + th.id);
  };
}

// One large photo with a thumbnail strip; tapping the photo opens all of them.
function gallery(photos) {
  if (!photos.length) return `<div class="stage empty-ph">${icon("image-plus", 40)}<span>${t("Още няма снимки")}</span></div>`;
  return `<div class="gallery" data-i="0">
    <div class="stage"><button class="stage-img" id="stageBtn" aria-label="${t("Отвори снимките")}"><img id="stageImg" src="${photoSrc(photos[0])}" alt="${t("Снимка {i} от {n}", { i: 1, n: photos.length })}"></button>
      ${photos.length > 1 ? `<button class="icon-btn stage-nav prev" data-step="-1" aria-label="${t("Предишна снимка")}">${icon("chevron-left", 20)}</button>
      <button class="icon-btn stage-nav next" data-step="1" aria-label="${t("Следваща снимка")}">${icon("chevron-right", 20)}</button>` : ""}
      <span class="stage-count" id="stageN">1 / ${photos.length}</span></div>
    ${photos.length > 1 ? `<div class="thumbs" role="tablist" aria-label="${t("Снимки")}">${photos.map((p, i) => `<button role="tab" data-ph="${i}" aria-selected="${i === 0}" aria-label="${t("Снимка {i}", { i: i + 1 })}"><img src="${photoSrc(p)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>`;
}

function bindGallery(root, l) {
  const g = $(".gallery", root); if (!g) return;
  const n = l.photos.length;
  const show = i => {
    i = (i + n) % n; g.dataset.i = i;
    $("#stageImg", g).src = photoSrc(l.photos[i]); $("#stageImg", g).alt = t("Снимка {i} от {n}", { i: i + 1, n });
    $("#stageN", g).textContent = `${i + 1} / ${n}`;
    $$("[data-ph]", g).forEach(b => b.setAttribute("aria-selected", +b.dataset.ph === i));
    $(`[data-ph="${i}"]`, g)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  g.addEventListener("click", e => {
    const tb = e.target.closest("[data-ph]"), st = e.target.closest("[data-step]");
    if (tb) show(+tb.dataset.ph);
    else if (st) show(+g.dataset.i + +st.dataset.step);
    else if (e.target.closest("#stageBtn")) photos(l, +g.dataset.i);
  });
  let x0 = null;
  g.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  g.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(+g.dataset.i + (dx < 0 ? 1 : -1)); x0 = null; });
}

function ownBox(l) {
  const threads = store.threadsOf(store.me().id).filter(th => th.listingId === l.id);
  return `<div class="bill-head">${icon("house", 18)} ${t("Твоята обява")} <span>${l.status === "active" ? t("активна") : t("скрита")}</span></div>
    <div class="bill-total"><mark>€${priceSplit(l).perPerson}</mark><span>${t("така я виждат<br>другите")}</span></div>
    <dl class="bill-facts"><div><dt>${t("Прегледи")}</dt><dd>${l.views}</dd></div><div><dt>${t("Разговори")}</dt><dd>${threads.length}</dd></div>
      <div><dt>${t("Статус")}</dt><dd>${l.status === "active" ? t("Активна") : t("Скрита")}</dd></div><div><dt>${t("Запазили")}</dt><dd>${store.users().filter(u => u.favorites.includes(l.id)).length}</dd></div></dl>
    <a class="btn dark full" href="#/host/edit/${l.id}">${icon("pencil", 16)} ${t("Редактирай")}</a>
    <button class="btn ghost full" id="pause" style="margin-top:10px">${l.status === "active" ? t("Скрий временно") : t("Активирай отново")}</button>`;
}

export function reviewHTML(r) {
  const a = store.user(r.authorId);
  return `<div class="review"><a class="who" href="#/u/${a?.id}">${avatar(a, 44)}<span><b>${esc(a ? nm(a.name) : t("Бивш потребител"))}</b><span class="muted" style="font-size:13px">${a ? userLine(a) : ""}</span></span></a>
    <div class="when">${stars(r.stars, 10)} · <b>${fmtMonthYear(r.date)}</b> · <span class="muted">${t("живя {t}", { t: fmtMonths(r.stayMonths) })}</span></div><p>${tx(r.text)}</p></div>`;
}

function photos(l, start) {
  const m = modal(`<h2>${t("Снимки")}</h2><div class="photo-list">${l.photos.map((p, i) => `<img src="${photoSrc(p)}" alt="${t("Снимка {i}", { i: i + 1 })}" id="ph${i}">`).join("")}</div>`, { cls: "photo-modal", label: t("Снимки") });
  setTimeout(() => $("#ph" + start, m.el)?.scrollIntoView({ block: "start" }), 60);
}

function introDraft(l, me) {
  const uni = uniById(me.university);
  const parts = [
    t("Здравей! Видях обявата в {d} и много ми харесва.", { d: districtName(l.district) }),
    uni ? t("Аз съм {year} курс, {faculty}, в {uni}.", { year: me.year, faculty: me.faculty, uni: uniShort(uni) }) : "",
    t(me.smoke ? "Пуша" : "Не пуша") + ", " + t(me.sleep === "late" ? "лягам късно" : "лягам рано") + (me.guests === 1 ? t(" и рядко имам гости") : me.guests === 3 ? t(" и често имам гости") : "") + ".",
    t("Търся за поне {t}. Мога ли да дойда да видя жилището тази седмица?", { t: fmtMonths(l.minMonths) }),
  ];
  return parts.filter(Boolean).join(" ");
}

function reviewDialog(l, done) {
  const v = { stars: 0, cats: Object.fromEntries(Object.keys(REVIEW_CATS).map(k => [k, 0])), stayMonths: 12, text: "" };
  const starPick = (name, n) => `<div class="starpick" data-name="${name}" role="radiogroup" aria-label="${name === "stars" ? t("Обща оценка") : t(REVIEW_CATS[name])}">${[1, 2, 3, 4, 5].map(i =>
    `<button type="button" data-v="${i}" role="radio" aria-checked="${i === n}" aria-label="${i}">${icon("star", name === "stars" ? 30 : 20, i <= n ? "on" : "off")}</button>`).join("")}</div>`;
  const m = modal(`<h2>${t("Отзив за {title}", { title: tx(l.title) })}</h2>
    <div class="legal" style="margin-top:0">${t("Демо: всеки може да пише. В истинския продукт отзив пишат само хора, живели в жилището, потвърдени от домакина.")}</div>
    <div class="field"><span class="lbl">${t("Обща оценка")}</span><div id="spMain">${starPick("stars", 0)}</div></div>
    <div class="cols-2">${Object.entries(REVIEW_CATS).map(([k, label]) => `<div class="field"><span class="lbl">${t(label)}</span><div data-wrap="${k}">${starPick(k, 0)}</div></div>`).join("")}</div>
    <div class="field"><label for="rvStay">${t("Колко време живя там")}</label><select class="inp" id="rvStay">${[3, 6, 10, 12, 18, 24, 36].map(n => `<option value="${n}" ${n === 12 ? "selected" : ""}>${fmtMonths(n)}</option>`).join("")}</select></div>
    <div class="field"><label for="rvText">${t("Какво да знаят следващите")}</label><textarea class="inp" id="rvText" maxlength="1000" placeholder="${t("Как се живееше, какви бяха съквартирантите, какво бихте искали да знаете предварително?")}"></textarea><div class="hint" id="rvCnt">${t("Поне 20 знака")}</div></div>
    <div class="modal-foot"><button class="btn link" data-close>${t("Отказ")}</button><button class="btn dark" id="rvGo" disabled>${t("Публикувай")}</button></div>`, { label: t("Нов отзив") });
  const el = m.el;
  const valid = () => v.stars && Object.values(v.cats).every(Boolean) && v.text.trim().length >= 20;
  const sync = () => { $("#rvGo", el).disabled = !valid(); $("#rvCnt", el).textContent = v.text.trim().length >= 20 ? `${v.text.length}/1000` : t("Поне 20 знака ({n})", { n: v.text.trim().length }); };
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
    m.close(); toast(t("Благодарим за отзива")); done();
  };
}

// The agreement stays in Bulgarian: it is meant to be signed under Bulgarian law.
const bgMonths = n => n >= 12 && n % 12 === 0 ? (n === 12 ? "1 година" : `${n / 12} години`) : `${n} месеца`;

function agreement(l, me) {
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
3.1. Споразумението е за срок от ${bgMonths(l.minMonths)}, считано от ____________.
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
  const m = modal(`<h2>${t("Шаблон за споразумение между съквартиранти")}</h2>
    ${S.lang !== "bg" ? `<p class="legal" style="margin-top:0">${t("Шаблонът е на български, защото договорът се сключва по българското право.")}</p>` : ""}
    <pre class="doc" id="agText">${esc(text)}</pre>
    <div class="modal-foot"><button class="btn ghost" id="agCopy">${icon("copy", 16)} ${t("Копирай")}</button><button class="btn dark" id="agDl">${icon("download", 16)} ${t("Изтегли .txt")}</button></div>`, { cls: "wide", label: t("Шаблон за споразумение") });
  $("#agCopy", m.el).onclick = async () => toast(await copyText(text) ? t("Текстът е копиран") : t("Маркирай текста и го копирай ръчно"));
  $("#agDl", m.el).onclick = () => { download("споразумение-съквартиранти.txt", text); toast(t("Шаблонът е изтеглен")); };
}
