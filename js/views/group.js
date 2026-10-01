// A group of students who want to rent a whole flat together.
import * as store from "../store.js";
import { icon } from "../icons.js";
import { $, esc, avatar, modal, toast, confirmDialog, go } from "../ui.js";
import { search, DEFAULT_FILTERS, groupCompat, compatWith } from "../logic.js";
import { S, saveUI, currentUni } from "../state.js";
import { t } from "../i18n.js";
import { userLine } from "./listing.js";
import { cardHTML, bindCards, rowFor } from "./card.js";

export function groupPage(main) {
  const draw = () => {
    const me = store.me(), g = store.groupOf(), invites = store.invitesFor();
    if (!g) {
      main.innerHTML = `<div class="wrap" style="max-width:820px;padding-bottom:80px">
        <div class="page-head"><h1>${t("Моята група")}</h1><p>${t("Съберете се 2–4 души и наемете цяло жилище заедно. Ще виждате общия бюджет, съвпадението помежду ви и жилищата точно за толкова хора.")}</p></div>
        ${invites.map(gr => `<div class="invite">${icon("user-plus", 20)}<div><b>${t("Покана за група „{group}“", { group: esc(gr.name) })}</b><span class="muted">${store.groupMembers(gr).map(u => esc(u.name)).join(", ")}</span></div>
          <div class="acts"><button class="btn ghost sm" data-decline="${gr.id}">${t("Откажи")}</button><button class="btn dark sm" data-accept="${gr.id}">${t("Приеми")}</button></div></div>`).join("")}
        <form class="grp-new" id="newGrp"><label for="gName" class="lbl">${t("Име на групата")}</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="inp" id="gName" maxlength="40" placeholder="${t("напр. Тримата от ТУ")}" style="flex:1;min-width:200px" required>
          <button class="btn dark">${icon("plus", 16)} ${t("Създай група")}</button></div></form>
        <p class="muted" style="margin-top:18px">${t("После покани хора от „Търсят съквартирант“.")} <a href="#/people">${t("Виж кой търси")}</a></p></div>`;
      $("#newGrp").onsubmit = e => { e.preventDefault(); const n = $("#gName").value.trim(); if (!n) return; store.createGroup(n); toast(t("Групата е създадена")); };
      return;
    }
    const members = store.groupMembers(g), pending = g.members.filter(m => m.status === "invited").map(m => store.user(m.userId)).filter(Boolean);
    const n = members.length, budget = store.groupBudget(g), gc = groupCompat(members);
    const ctx = { me, uniId: currentUni(), userById: store.user, reviewsFor: store.reviewsFor, groupSize: n };
    const fit = n >= 2 ? search(store.listings(), { ...DEFAULT_FILTERS, category: "group", maxPrice: budget || 0, showAllGenders: true }, ctx) : [];
    const over = n >= 2 && budget ? search(store.listings(), { ...DEFAULT_FILTERS, category: "group", minPrice: budget + 1, showAllGenders: true }, ctx) : [];
    main.innerHTML = `<div class="wrap" style="padding-bottom:80px">
      <div class="page-head grp-page-head"><div><p class="kicker">${t("Моята група")}</p><h1>${esc(g.name)}</h1></div>
        <div class="acts"><button class="btn yellow" id="invite">${icon("user-plus", 16)} ${t("Покани")}</button><button class="btn ghost" id="leave">${icon("log-out", 16)} ${t("Напусни")}</button></div></div>
      <dl class="grp-stats"><div><dt>${t("Души")}</dt><dd>${n}</dd></div><div><dt>${t("Бюджет на човек")}</dt><dd>${budget ? "€" + budget : "—"}</dd></div>
        <div><dt>${t("Съвпадение помежду ви")}</dt><dd>${gc != null ? gc + "%" : "—"}</dd></div></dl>
      <p class="muted" style="font-size:13px;margin-top:-6px">${t("Бюджетът на групата е най-ниският бюджет сред членовете.")}</p>
      <div class="people grp-members">${members.map(u => `<div class="person"><a href="#/u/${u.id}">${avatar(u, 48)}</a><div><a class="nm" href="#/u/${u.id}">${esc(u.name)}${u.id === g.ownerId ? ` <span class="tag">${t("създател")}</span>` : ""}</a>
        <div class="muted" style="font-size:14px">${userLine(u)}${u.budget ? " · " + t("до €{n}", { n: u.budget }) : ""}</div>
        ${u.id !== me.id ? `<div class="muted" style="font-size:13px">${t("Съвпадение с теб: {n}%", { n: compatWith(me, u).score })}</div>` : ""}</div></div>`).join("")}
        ${pending.map(u => `<div class="person pending">${avatar(u, 48)}<div><span class="nm">${esc(u.name)}</span><div class="muted" style="font-size:14px">${t("Поканен, чака отговор")}</div></div></div>`).join("")}</div>

      <section class="psec"><h3>${t("Жилища за вас")} <span class="count">${fit.length}</span></h3>
        ${n < 2 ? `<p class="muted">${t("Покани поне още един човек, за да видите жилища за групата.")}</p>` :
          fit.length ? `<div class="grid" id="gFit">${fit.map(r => cardHTML(r)).join("")}</div>` : `<p class="muted">${t("Няма цели жилища точно за {n} души в бюджета ви. Виж тези малко над бюджета или запази търсене.", { n })}</p>`}
        ${over.length ? `<h3 style="margin-top:28px;font-size:16px">${t("Малко над бюджета")}</h3><div class="grid" id="gOver">${over.slice(0, 6).map(r => cardHTML(r)).join("")}</div>` : ""}
        ${n >= 2 ? `<button class="btn ghost" id="allForGroup" style="margin-top:20px">${icon("search", 16)} ${t("Всички жилища за групата на картата")}</button>` : ""}
      </section></div>`;
    ["gFit", "gOver"].forEach(id => { const el = $("#" + id); if (el) bindCards(el); });
    $("#invite").onclick = () => inviteDialog(g);
    $("#leave").onclick = async () => { if (await confirmDialog(t("Да напуснеш ли групата „{group}“?", { group: g.name }), t("Напусни"), true)) { store.leaveGroup(g.id); toast(t("Напусна групата")); } };
    $("#allForGroup")?.addEventListener("click", () => { S.filters = { ...DEFAULT_FILTERS, category: "group" }; saveUI(); go("/"); });
  };
  main.addEventListener("click", e => {
    const acc = e.target.closest("[data-accept]"), dec = e.target.closest("[data-decline]");
    if (acc) { store.respondInvite(acc.dataset.accept, store.me().id, true); toast(t("Вече си в групата")); }
    if (dec) { store.respondInvite(dec.dataset.decline, store.me().id, false); toast(t("Поканата е отказана")); }
  });
  draw();
  return { refresh: draw };
}

export function inviteDialog(g) {
  const me = store.me();
  const inGroup = new Set(g.members.map(m => m.userId));
  const people = store.users().filter(u => u.role === "student" && u.seeking && !inGroup.has(u.id))
    .map(u => ({ u, c: compatWith(me, u).score })).sort((a, b) => b.c - a.c);
  const m = modal(`<h2>${t("Покани в „{group}“", { group: esc(g.name) })}</h2>
    <p class="muted" style="margin-top:-6px">${t("Студенти, които търсят жилище. Подредени по съвпадение с теб.")}</p>
    <div class="inv-list">${people.map(({ u, c }) => `<div class="inv-row">${avatar(u, 40)}<div><b>${esc(u.name)}</b><span class="muted">${userLine(u)}${u.budget ? " · " + t("до €{n}", { n: u.budget }) : ""} · ${c}%</span></div>
      <button class="btn ghost sm" data-inv="${u.id}">${icon("user-plus", 14)} ${t("Покани")}</button></div>`).join("") || `<p class="muted">${t("Няма свободни хора за покана.")}</p>`}</div>
    <p class="legal">${t("Демо: поканените приемат автоматично след секунда.")}</p>`, { label: t("Покани в групата") });
  m.el.addEventListener("click", e => {
    const b = e.target.closest("[data-inv]"); if (!b) return;
    store.inviteToGroup(g.id, b.dataset.inv);
    b.disabled = true; b.textContent = t("Поканен");
  });
}
