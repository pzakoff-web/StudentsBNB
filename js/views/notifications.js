import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, esc, timeAgo, toast, confirmDialog, go } from "../ui.js";
import { pricePerPerson, DEFAULT_FILTERS } from "../logic.js";
import { districtName } from "../data/places.js";
import { S, saveUI } from "../state.js";
import { t } from "../i18n.js";
import { describeSearch } from "./explore.js";

function notifLine(n) {
  const p = n.params || {};
  switch (n.kind) {
    case "match": return [icon("bell-ring", 20), t("Нова обява за „{search}“", { search: esc(p.search) })];
    case "invite": return [icon("user-plus", 20), t("{who} те кани в група „{group}“", { who: esc(p.who), group: esc(p.group) })];
    case "joined": return [icon("users", 20), t("{who} се присъедини към „{group}“", { who: esc(p.who), group: esc(p.group) })];
    case "applied": return [icon("send", 20), t("{who} кандидатства от името на групата за „{title}“", { who: esc(p.who), title: esc(p.title) })];
    default: return [icon("bell", 20), ""];
  }
}

export function notificationsPage(main) {
  let fresh = new Set(store.notifications().filter(n => !n.read).map(n => n.id));
  const draw = () => {
    const ns = store.notifications(), searches = store.savedSearches(), invites = store.invitesFor();
    main.innerHTML = `<div class="wrap" style="max-width:820px;padding-bottom:80px">
      <div class="page-head"><h1>${t("Известия")}</h1><p>${t("Нови обяви по запазените ти търсения и покани за групи.")}</p></div>
      ${invites.map(g => `<div class="invite">${icon("user-plus", 20)}<div><b>${t("Покана за група „{group}“", { group: esc(g.name) })}</b>
        <span class="muted">${store.groupMembers(g).map(u => esc(u.name)).join(", ")}</span></div>
        <div class="acts"><button class="btn ghost sm" data-decline="${g.id}">${t("Откажи")}</button><button class="btn dark sm" data-accept="${g.id}">${t("Приеми")}</button></div></div>`).join("")}
      <section class="nlist" aria-label="${t("Известия")}">
        ${ns.length ? ns.map(n => {
          const [ic, text] = notifLine(n);
          const l = n.listingId && store.listing(n.listingId);
          const href = l ? `#/l/${l.id}` : n.groupId ? "#/group" : "#/";
          return `<a class="notif ${fresh.has(n.id) ? "new" : ""}" href="${href}"><span class="ic-wrap">${ic}</span>
            <div class="nb"><b>${text}</b>${l ? `<span class="muted">${esc(l.title)} · ${esc(districtName(l.district))} · <mark>€${pricePerPerson(l)}</mark></span>` : ""}<small class="muted">${timeAgo(n.ts)}</small></div>
            ${l?.photos[0] ? `<img class="th" src="${photoSrc(l.photos[0])}" alt="">` : ""}</a>`;
        }).join("") : `<div class="empty">${icon("bell", 36)}<h2 style="margin-top:10px">${t("Още нямаш известия")}</h2><p>${t("Запази търсене от началната страница и ще те известим, когато се появи подходяща обява.")}</p><a class="btn dark" href="#/">${t("Към търсенето")}</a></div>`}
      </section>

      <section class="psec"><h3>${t("Запазени търсения")} ${searches.length ? `<span class="count">${searches.length}</span>` : ""}</h3>
        ${searches.length ? `<ul class="ss-list">${searches.map(s => `<li><div><b>${esc(s.name)}</b><span class="muted">${esc(describeSearch(s.filters, s.uniId))}</span></div>
          <div class="acts"><button class="btn ghost sm" data-open="${s.id}">${t("Покажи")}</button><button class="icon-btn" data-del="${s.id}" aria-label="${esc(t("Изтрий „{name}“", { name: s.name }))}">${icon("trash-2", 16)}</button></div></li>`).join("")}</ul>
          <p class="muted" style="font-size:13px">${t("Демо: известията са само в сайта. С бекенда ще пристигат и по имейл.")}</p>`
        : `<p class="muted">${t("Нямаш запазени търсения. Настрой филтрите и натисни „Запази търсенето“.")}</p>`}
      </section></div>`;
  };
  main.addEventListener("click", async e => {
    const acc = e.target.closest("[data-accept]"), dec = e.target.closest("[data-decline]");
    const open = e.target.closest("[data-open]"), del = e.target.closest("[data-del]");
    if (acc) { store.respondInvite(acc.dataset.accept, store.me().id, true); toast(t("Вече си в групата")); go("/group"); }
    if (dec) { store.respondInvite(dec.dataset.decline, store.me().id, false); toast(t("Поканата е отказана")); }
    if (open) { const s = store.savedSearches().find(x => x.id === open.dataset.open); S.filters = { ...DEFAULT_FILTERS, ...s.filters }; S.uniId = s.uniId; saveUI(); go("/"); }
    if (del) { const s = store.savedSearches().find(x => x.id === del.dataset.del);
      if (await confirmDialog(t("Да изтрием ли търсенето „{name}“?", { name: s.name }), t("Изтрий"), true)) { store.deleteSearch(s.id); toast(t("Търсенето е изтрито")); } }
  });
  draw();
  store.markNotifsRead();
  return { refresh: () => { draw(); } };
}
