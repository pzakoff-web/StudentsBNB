import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { esc, starLine, toast, $$ } from "../ui.js";
import { pricePerPerson, listingCompat, ratingSummary, isTopRated, fmtDate, GENDER_PREF } from "../logic.js";
import { commuteMin } from "../geo.js";
import { uniById } from "../data/places.js";
import { currentUni } from "../state.js";

export function rowFor(l) {
  const me = store.me();
  return { l, pp: pricePerPerson(l), commute: commuteMin(l.approx, uniById(currentUni())),
    compat: listingCompat(l, me, store.user), rating: ratingSummary(store.reviewsFor(l.id)) };
}

export function pillFor({ l, compat, rating }) {
  if (l.status === "paused") return `<span class="badge">Скрита</span>`;
  if (compat && compat.score >= 80) return `<span class="badge match">${compat.score}% съвпадение</span>`;
  if (isTopRated(rating)) return `<span class="badge">${icon("star", 12, "star")} Топ оценка</span>`;
  if (Date.now() - new Date(l.createdAt) < 7 * 864e5) return `<span class="badge">Нова</span>`;
  return "";
}

// Bookmark toggle shared by cards, map popups and the listing page.
export const saveBtn = (id, size = 20) => {
  const on = store.isFav(id);
  return `<button class="save" data-fav="${id}" aria-pressed="${on}" aria-label="${on ? "Махни от запазени" : "Запази"}">${icon("bookmark", size)}</button>`;
};

export function carousel(photos, max = 5) {
  const ps = photos.slice(0, max);
  if (!ps.length) return `<div class="car"><div class="car-track"><div style="display:grid;place-items:center;width:100%;color:var(--muted)">${icon("image-plus", 32)}</div></div></div>`;
  return `<div class="car" data-i="0" data-n="${ps.length}">
    <div class="car-track">${ps.map((p, i) => `<img src="${photoSrc(p)}" alt="" loading="${i ? "lazy" : "eager"}" draggable="false">`).join("")}</div>
    ${ps.length > 1 ? `<button class="car-nav prev" aria-label="Предишна снимка" hidden>${icon("chevron-left", 16)}</button>
    <button class="car-nav next" aria-label="Следваща снимка">${icon("chevron-right", 16)}</button>
    <div class="car-dots">${ps.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>`;
}

export function cardHTML(row) {
  const { l, pp, commute, rating, compat } = row;
  const uni = uniById(currentUni());
  const who = l.type === "whole" ? `за ${l.occupants} ${l.occupants === 1 ? "човек" : "души"}` : GENDER_PREF[l.genderPref].toLowerCase();
  return `<a class="card" href="#/l/${l.id}" data-id="${l.id}">
    <div class="card-media">${carousel(l.photos)}${pillFor(row)}${saveBtn(l.id)}</div>
    <div class="card-body">
      <div class="card-price"><mark>€${pp}</mark><span>на човек · със сметките</span></div>
      <h3>${esc(l.title)}</h3>
      <div class="card-meta">${icon("map-pin", 14)}${esc(l.district)} <span class="sep">·</span> ${icon("bus", 14)}${commute} мин до ${uni.short}</div>
      <div class="card-foot"><span>${l.type === "room" ? "Стая" : "Цяло жилище"} · ${who} · от ${fmtDate(l.availableFrom)}</span>${starLine(rating, { count: true })}</div>
      ${compat ? `<div class="card-match" title="Съвпадение със съквартирантите"><i style="width:${compat.score}%"></i></div>` : ""}
    </div></a>`;
}

// One delegated handler per container for carousels and bookmarks.
export function bindCards(root) {
  root.addEventListener("click", e => {
    const nav = e.target.closest(".car-nav");
    if (nav) {
      e.preventDefault(); e.stopPropagation();
      const car = nav.closest(".car"), n = +car.dataset.n;
      const i = Math.max(0, Math.min(n - 1, +car.dataset.i + (nav.classList.contains("next") ? 1 : -1)));
      car.dataset.i = i;
      car.querySelector(".car-track").style.transform = `translateX(-${i * 100}%)`;
      $$(".car-dots i", car).forEach((d, k) => d.classList.toggle("on", k === i));
      car.querySelector(".prev").hidden = i === 0; car.querySelector(".next").hidden = i === n - 1;
      return;
    }
    const h = e.target.closest("[data-fav]");
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const on = store.toggleFavorite(h.dataset.fav);
      $$(`[data-fav="${h.dataset.fav}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Махни от запазени" : "Запази"); });
      toast(on ? "Запазено" : "Махнато от запазени");
    }
  });
}
