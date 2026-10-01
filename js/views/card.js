import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { esc, starLine, toast, $$ } from "../ui.js";
import { pricePerPerson, listingCompat, ratingSummary, isTopRated, fmtDate, GENDER_PREF, fairPrice, isGoodDeal } from "../logic.js";
import { commuteMin } from "../geo.js";
import { uniById, uniShort, districtName } from "../data/places.js";
import { currentUni } from "../state.js";
import { t } from "../i18n.js";

export function rowFor(l) {
  const me = store.me();
  return { l, pp: pricePerPerson(l), commute: commuteMin(l.approx, uniById(currentUni())),
    compat: listingCompat(l, me, store.user), rating: ratingSummary(store.reviewsFor(l.id)) };
}

export const forPeople = n => n === 1 ? t("за 1 човек") : t("за {n} души", { n });

export function pillFor(row) {
  const { l, compat, rating } = row;
  if (l.status === "paused") return `<span class="badge">${t("Скрита")}</span>`;
  if (compat && compat.score >= 80) return `<span class="badge match">${t("{n}% съвпадение", { n: compat.score })}</span>`;
  if (isGoodDeal(row.fair ?? fairPrice(l, store.listings()))) return `<span class="badge deal">${icon("wallet", 12)} ${t("Изгодна")}</span>`;
  if (isTopRated(rating)) return `<span class="badge">${icon("star", 12, "star")} ${t("Топ оценка")}</span>`;
  if (Date.now() - new Date(l.createdAt) < 7 * 864e5) return `<span class="badge">${t("Нова")}</span>`;
  return "";
}

// Bookmark toggle shared by cards, map popups and the listing page.
export const saveBtn = (id, size = 20) => {
  const on = store.isFav(id);
  return `<button class="save" data-fav="${id}" aria-pressed="${on}" aria-label="${on ? t("Махни от запазени") : t("Запази")}">${icon("bookmark", size)}</button>`;
};

// Photos scroll natively (swipe on phones, scroll-snap); arrows step one photo on desktop.
export function carousel(photos, max = 5) {
  const ps = photos.slice(0, max);
  if (!ps.length) return `<div class="car"><div class="car-track"><div class="car-empty">${icon("image-plus", 32)}</div></div></div>`;
  return `<div class="car" data-n="${ps.length}">
    <div class="car-track">${ps.map((p, i) => `<img src="${photoSrc(p)}" alt="" loading="${i ? "lazy" : "eager"}" draggable="false">`).join("")}</div>
    ${ps.length > 1 ? `<button class="car-nav prev" aria-label="${t("Предишна снимка")}" hidden>${icon("chevron-left", 16)}</button>
    <button class="car-nav next" aria-label="${t("Следваща снимка")}">${icon("chevron-right", 16)}</button>
    <div class="car-dots">${ps.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>`;
}

export function cardHTML(row) {
  const { l, pp, commute, rating, compat } = row;
  const uni = uniById(currentUni());
  const who = l.type === "whole" ? forPeople(l.occupants) : t(GENDER_PREF[l.genderPref]).toLowerCase();
  return `<a class="card" href="#/l/${l.id}" data-id="${l.id}">
    <div class="card-media">${carousel(l.photos)}${pillFor(row)}${saveBtn(l.id)}</div>
    <div class="card-body">
      <div class="card-price"><mark>€${pp}</mark><span>${t("на човек · със сметките")}</span></div>
      <h3>${esc(l.title)}</h3>
      <div class="card-meta">${icon("map-pin", 14)}${esc(districtName(l.district))} <span class="sep">·</span> ${icon("bus", 14)}${t("{n} мин до {uni}", { n: commute, uni: uniShort(uni) })}</div>
      <div class="card-foot"><span>${t(l.type === "room" ? "Стая" : "Цяло жилище")} · ${who} · ${t("от {date}", { date: fmtDate(l.availableFrom) })}</span>${starLine(rating, { count: true })}</div>
      ${compat ? `<div class="card-match" title="${t("Съвпадение със съквартирантите")}"><i style="width:${compat.score}%"></i></div>` : ""}
    </div></a>`;
}

function syncCar(car) {
  const tr = car.querySelector(".car-track"), n = +car.dataset.n;
  if (!tr || !n) return;
  const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
  $$(".car-dots i", car).forEach((d, k) => d.classList.toggle("on", k === i));
  const prev = car.querySelector(".prev"), next = car.querySelector(".next");
  if (prev) prev.hidden = i <= 0;
  if (next) next.hidden = i >= n - 1;
}

// One delegated handler per container for carousels and bookmarks.
export function bindCards(root) {
  root.addEventListener("scroll", e => { if (e.target.classList?.contains("car-track")) syncCar(e.target.closest(".car")); }, true);
  root.addEventListener("click", e => {
    const nav = e.target.closest(".car-nav");
    if (nav) {
      e.preventDefault(); e.stopPropagation();
      const tr = nav.closest(".car").querySelector(".car-track");
      tr.scrollBy({ left: (nav.classList.contains("next") ? 1 : -1) * tr.clientWidth, behavior: "smooth" });
      return;
    }
    const h = e.target.closest("[data-fav]");
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const on = store.toggleFavorite(h.dataset.fav);
      $$(`[data-fav="${h.dataset.fav}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? t("Махни от запазени") : t("Запази")); });
      toast(on ? t("Запазено") : t("Махнато от запазени"));
    }
  });
}
