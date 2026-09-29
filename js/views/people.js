import * as store from "../store.js";
import { icon } from "../icons.js";
import { $, esc, avatar, opts, bindOpts } from "../ui.js";
import { compatWith, ratingSummary, fmtRating, plural } from "../logic.js";
import { UNIVERSITIES } from "../data/places.js";
import { userLine } from "./listing.js";

const F = { uni: "", gender: "" };

export function peoplePage(main) {
  const me = store.me();
  main.innerHTML = `<div class="wrap-wide" style="padding-bottom:80px">
    <div class="page-head"><h1>Търсят съквартирант</h1><p>Студенти, които търсят стая или хора, с които да наемат цяло жилище. Подредени по съвпадение с теб.</p></div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px;align-items:center">
      ${opts("uni", [["", "Всички университети"], ...UNIVERSITIES.map(u => [u.id, u.short])], F.uni)}
      ${opts("gender", [["", "Всички"], ["m", "Мъже"], ["f", "Жени"]], F.gender)}
    </div>
    <div class="pgrid" id="pg"></div>
    ${me.role === "student" && !me.seeking ? `<p class="muted" style="margin-top:32px">И ти търсиш? <a href="#/me/edit">Включи „Търся стая“ в профила</a> и ще се появиш тук.</p>` : ""}
  </div>`;
  const draw = () => {
    const ps = store.users().filter(u => u.seeking && u.id !== me.id && (!F.uni || u.university === F.uni) && (!F.gender || u.gender === F.gender))
      .map(u => ({ u, c: me.role === "student" ? compatWith(me, u).score : null, r: ratingSummary(store.reviewsOfUser(u.id)) }))
      .sort((a, b) => (b.c ?? 0) - (a.c ?? 0));
    $("#pg").innerHTML = ps.length ? ps.map(({ u, c, r }) => `<a class="pcard-s" href="#/u/${u.id}">
      <div class="top">${avatar(u, 56)}<div><b>${esc(u.name)}</b><span class="muted" style="font-size:13px">${userLine(u)}</span></div></div>
      <div class="tags">${c != null ? `<span class="tag ${c >= 80 ? "hl" : ""}">${c}% съвпадение</span>` : ""}
        ${u.budget ? `<span class="tag">${icon("wallet", 12)} до €${u.budget}</span>` : ""}
        ${r.count ? `<span class="tag">${icon("star", 12, "star")} ${fmtRating(r.overall)} (${r.count})</span>` : ""}
        ${u.emailVerified ? `<span class="tag ok">${icon("badge-check", 12)} потвърден</span>` : ""}</div>
      <p>${esc(u.bio)}</p>
      <div class="tags"><span class="tag">${u.smoke ? "пуши" : "не пуши"}</span><span class="tag">${u.sleep === "early" ? "ляга рано" : "ляга късно"}</span>
        <span class="tag">${["", "спокойно към реда", "нормално подреден", "много подреден"][u.clean]}</span></div></a>`).join("")
      : `<div class="empty" style="grid-column:1/-1"><h2>Никой не отговаря на филтрите</h2></div>`;
    main.querySelector(".page-head p").textContent = `${plural(ps.length, "студент търси", "студенти търсят")} стая или съквартиранти. Подредени по съвпадение с теб.`;
  };
  bindOpts(main, (k, v) => { F[k] = v; draw(); });
  draw();
}
