import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { esc, starLine, toast, $$ } from "../ui.js";
import { pricePerPerson, listingCompat, ratingSummary, isStudentFavourite, fmtDate, fmtMonths, GENDER_PREF } from "../logic.js";
import { commuteMin } from "../geo.js";
import { uniById } from "../data/places.js";
import { currentUni } from "../state.js";

export function rowFor(l) {
  const me = store.me();
  return { l, pp: pricePerPerson(l), commute: commuteMin(l.approx, uniById(currentUni())),
    compat: listingCompat(l, me, store.user), rating: ratingSummary(store.reviewsFor(l.id)) };
}

export function pillFor({ l, compat, rating }) {
  if (compat && compat.score >= 80) return `<span class="pill match">${icon("users", 13)} ${compat.score}% съвпадение</span>`;
  if (isStudentFavourite(rating)) return `<span class="pill">${icon("trophy", 13)} Любимо на студентите</span>`;
  if (Date.now() - new Date(l.createdAt) < 7 * 864e5) return `<span class="pill">Ново</span>`;
  if (l.status === "paused") return `<span class="pill">Скрита</span>`;
  return "";
}

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
  const { l, pp, commute, rating } = row;
  const uni = uniById(currentUni());
  const fav = store.isFav(l.id);
  return `<a class="card" href="#/l/${l.id}" data-id="${l.id}">
    ${carousel(l.photos)}
    ${pillFor(row)}
    <button class="heart" data-fav="${l.id}" aria-pressed="${fav}" aria-label="${fav ? "Махни от любими" : "Запази в любими"}">${icon("heart", 24)}</button>
    <div class="card-body">
      <div class="card-top"><h3>${esc(l.district)}, Варна</h3>${starLine(rating)}</div>
      <div class="sub">${esc(l.title)}</div>
      <div class="sub">${commute} мин до ${uni.short} · ${l.type === "whole" ? `за ${l.occupants} ${l.occupants === 1 ? "човек" : "души"}` : GENDER_PREF[l.genderPref].toLowerCase()}</div>
      <div class="sub">от ${fmtDate(l.availableFrom)} · мин. ${fmtMonths(l.minMonths)}</div>
      <div class="price"><b>€${pp}</b> на човек / месец <span class="muted">· със сметките</span></div>
    </div></a>`;
}

// One delegated handler per container for carousels and hearts.
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
      $$(`[data-fav="${h.dataset.fav}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Махни от любими" : "Запази в любими"); });
      toast(on ? "Запазено в Любими" : "Премахнато от Любими");
    }
  });
}
