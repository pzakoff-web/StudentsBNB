import * as store from "../store.js";
import { icon } from "../icons.js";
import { esc, avatar, opts, bindOpts, toast } from "../ui.js";
import { compatWith, ratingSummary, fmtRating, plural } from "../logic.js";
import { UNIVERSITIES, uniShort } from "../data/places.js";
import { t } from "../i18n.js";
import { userLine } from "./listing.js";
import { tx, nm } from "../translate.js";

const F = { uni: "", gender: "" };
const CLEAN = ["", "спокойно към реда", "нормално подреден", "много подреден"];

export function peoplePage(main) {
  const me = store.me();
  main.innerHTML = `<div class="wrap-wide" style="padding-bottom:80px">
    <div class="page-head"><h1>${t("Търсят съквартирант")}</h1><p id="pSub"></p></div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px;align-items:center">
      ${opts("uni", [["", t("Всички университети")], ...UNIVERSITIES.map(u => [u.id, uniShort(u)])], F.uni)}
      ${opts("gender", [["", t("Всички")], ["m", t("Мъже")], ["f", t("Жени")]], F.gender)}
    </div>
    <div class="pgrid" id="pg"></div>
    ${me.role === "student" && !me.seeking ? `<p class="muted" style="margin-top:32px">${t("И ти търсиш?")} <a href="#/me/edit">${t("Включи „Търся стая“ в профила")}</a> ${t("и ще се появиш тук.")}</p>` : ""}
  </div>`;
  const draw = () => {
    const grp = store.groupOf();
    const inGrp = new Set(grp?.members.map(m => m.userId) || []);
    const ps = store.users().filter(u => u.seeking && u.id !== me.id && (!F.uni || u.university === F.uni) && (!F.gender || u.gender === F.gender))
      .map(u => ({ u, c: me.role === "student" ? compatWith(me, u).score : null, r: ratingSummary(store.reviewsOfUser(u.id)), g: store.groupOf(u.id) }))
      .sort((a, b) => (b.c ?? 0) - (a.c ?? 0));
    main.querySelector("#pg").innerHTML = ps.length ? ps.map(({ u, c, r, g }) => `<div class="pcard-s"><a class="top" href="#/u/${u.id}">${avatar(u, 56)}<div><b>${esc(nm(u.name))}</b><span class="muted" style="font-size:13px">${userLine(u)}</span></div></a>
      <div class="tags">${c != null ? `<span class="tag ${c >= 80 ? "hl" : ""}">${t("{n}% съвпадение", { n: c })}</span>` : ""}
        ${u.budget ? `<span class="tag">${icon("wallet", 12)} ${t("до €{n}", { n: u.budget })}</span>` : ""}
        ${r.count ? `<span class="tag">${icon("star", 12, "star")} ${fmtRating(r.overall)} (${r.count})</span>` : ""}
        ${u.emailVerified ? `<span class="tag ok">${icon("badge-check", 12)} ${t("потвърден")}</span>` : ""}
        ${g ? `<span class="tag">${icon("users", 12)} ${tx(g.name)}</span>` : ""}</div>
      <p>${tx(u.bio)}</p>
      <div class="tags"><span class="tag">${t(u.smoke ? "пуши" : "не пуши")}</span><span class="tag">${t(u.sleep === "early" ? "ляга рано" : "ляга късно")}</span>
        <span class="tag">${t(CLEAN[u.clean])}</span></div>
      ${grp && !inGrp.has(u.id) ? `<button class="btn ghost sm" data-inv="${u.id}">${icon("user-plus", 14)} ${t("Покани в „{group}“", { group: tx(grp.name) })}</button>` : ""}</div>`).join("")
      : `<div class="empty" style="grid-column:1/-1"><h2>${t("Никой не отговаря на филтрите")}</h2></div>`;
    main.querySelector("#pSub").textContent = t("{n} стая или съквартиранти. Подредени по съвпадение с теб.", { n: plural(ps.length, "студент търси", "студенти търсят") });
  };
  bindOpts(main, (k, v) => { F[k] = v; draw(); });
  main.addEventListener("click", e => {
    const b = e.target.closest("[data-inv]"); if (!b) return;
    store.inviteToGroup(store.groupOf().id, b.dataset.inv);
    b.disabled = true; b.textContent = t("Поканен");
    toast(t("Поканата е изпратена"));
  });
  draw();
}
