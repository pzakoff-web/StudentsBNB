import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, esc, avatar, timeAgo, go } from "../ui.js";
import { pricePerPerson } from "../logic.js";
import { t } from "../i18n.js";
import { demoReply } from "./listing.js";

// System lines in the chat are stored as a key, so each person reads them in their own language.
const SYSTEM = {
  "share-offer": "{who} предложи да си размените телефоните.",
  "share-accept": "{who} прие. Телефоните и точният адрес вече се виждат.",
};
const sysText = m => m.key ? t(SYSTEM[m.key], m.params) : m.text;

const DIRECT_REPLIES = ["Здрасти! Благодаря, че писа. Да, още търся — разкажи ми повече.", "Хей! Звучи интересно. Кога можем да се видим за кафе и да поговорим?"];

export function inboxPage(main, tid) {
  const me = store.me();
  const th = tid ? store.thread(tid) : null;
  if (tid && (!th || !th.participants.includes(me.id))) { go("/inbox"); return; }

  main.innerHTML = `<div class="inbox ${th ? "has-thread" : ""}">
    <div class="inbox-list"><h1>${t("Съобщения")}</h1><div id="thrList"></div></div>
    <section class="conv" id="conv" aria-label="${t("Разговор")}"></section></div>`;

  function drawList() {
    const ts = store.threadsOf(me.id);
    $("#thrList").innerHTML = ts.length ? ts.map(x => {
      const other = store.user(x.participants.find(p => p !== me.id));
      const l = x.listingId && store.listing(x.listingId);
      const last = x.messages.at(-1);
      const unread = store.unreadCount(x);
      return `<a class="thr ${x.id === tid ? "on" : ""}" href="#/inbox/${x.id}">${avatar(other, 48)}
        <div style="min-width:0"><div class="nm">${esc(other?.name)}<small>${last ? timeAgo(last.ts) : ""}</small></div>
        <div class="last ${unread ? "unread" : ""}">${last ? (last.from === me.id ? t("Ти: ") : "") + esc(last.from === "system" ? sysText(last) : last.text) : t("Нов разговор")}</div>
        <div class="last">${x.groupId ? icon("users", 12) + " " : ""}${l ? esc(l.title) : t("Лично съобщение")}</div></div>
        ${l?.photos[0] ? `<img class="th" src="${photoSrc(l.photos[0])}" alt="">` : ""}</a>`;
    }).join("") : `<div class="inbox-empty" style="padding:40px 24px">${icon("message-circle", 36)}<p><b>${t("Още нямаш съобщения")}</b><br>${t("Когато пишеш на някого за обява, разговорът ще е тук.")}</p><a class="btn dark" href="#/">${t("Разгледай обявите")}</a></div>`;
  }

  function drawConv(keepText) {
    const conv = $("#conv");
    if (!th) { conv.innerHTML = `<div class="inbox-empty" style="height:100%">${icon("message-circle", 40)}<p>${t("Избери разговор")}</p></div>`; return; }
    const other = store.user(th.participants.find(p => p !== me.id));
    const l = th.listingId && store.listing(th.listingId);
    const g = th.groupId && store.group(th.groupId);
    const shared = store.bothShared(th), mineShared = !!th.phoneShare?.[me.id], theirShared = !!th.phoneShare?.[other.id];
    const otherFirst = esc(other.name.split(" ")[0]);
    const text = keepText ?? sessionStorage.getItem("draft:" + th.id) ?? "";
    sessionStorage.removeItem("draft:" + th.id);
    conv.innerHTML = `<div class="conv-head">
        <a class="icon-btn" href="#/inbox" aria-label="${t("Назад към всички")}" style="flex:none">${icon("arrow-left", 18)}</a>
        <a href="#/u/${other.id}">${avatar(other, 40)}</a>
        <div class="t"><b>${esc(other.name)}</b>${l ? `<a href="#/l/${l.id}">${esc(l.title)} · ${t("€{n}/човек", { n: pricePerPerson(l) })}</a>` : `<span class="muted" style="font-size:13px">${t("Лично съобщение")}</span>`}</div>
        ${shared ? "" : `<button class="btn ghost sm" id="share" ${mineShared ? "disabled" : ""} aria-label="${t("Сподели телефон")}" title="${t("Телефонът се показва само ако и двамата приемете")}">${icon("phone", 14)} <span class="lbl">${mineShared ? t("Чакаме {name}", { name: otherFirst }) : theirShared ? t("Приеми и сподели телефон") : t("Сподели телефон")}</span></button>`}
      </div>
      ${g ? `<div class="grp-strip">${icon("users", 14)} ${t("Кандидатура от групата „{group}“", { group: esc(g.name) })}: ${store.groupMembers(g).map(u => esc(u.name.split(" ")[0])).join(", ")}</div>` : ""}
      ${shared ? `<div class="phone-box">${icon("phone", 16)} ${otherFirst}: ${esc(other.phone)}${l && store.canSeeAddress(l) ? ` · ${icon("map-pin", 16)} ${esc(l.address)}` : ""}</div>` : ""}
      <div class="msgs" id="msgs">
        <div class="bub sys">${icon("lock", 12)} ${t("Телефоните ви са скрити, докато и двамата не приемете да ги споделите.")}</div>
        ${th.messages.map(m => m.from === "system" ? `<div class="bub sys">${esc(sysText(m))}</div>` :
          `<div class="bub ${m.from === me.id ? "me" : "them"}">${esc(m.text)}<time>${timeAgo(m.ts)}</time></div>`).join("")}
      </div>
      <form class="composer" id="comp"><label class="sr" for="txt">${t("Съобщение")}</label>
        <textarea id="txt" rows="1" maxlength="2000" placeholder="${t("Напиши съобщение")}">${esc(text)}</textarea>
        <button class="send" id="send" aria-label="${t("Изпрати")}" ${text.trim() ? "" : "disabled"}>${icon("send", 18)}</button></form>`;
    const msgs = $("#msgs"); msgs.scrollTop = msgs.scrollHeight;
    const ta = $("#txt");
    const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; $("#send").disabled = !ta.value.trim(); };
    ta.oninput = fit; fit();
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#comp").requestSubmit(); } });
    $("#comp").onsubmit = e => {
      e.preventDefault(); const v = ta.value.trim(); if (!v) return; ta.value = "";
      store.sendMessage(th.id, v, th.listingId ? demoReply(th.messages.length) : t(DIRECT_REPLIES[th.messages.length % 2]));
    };
    $("#share")?.addEventListener("click", () => store.sharePhone(th.id));
    if (!keepText && text) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    store.markRead(th.id);
  }

  drawList(); drawConv();
  return { refresh: () => { const keep = $("#txt")?.value; if (th) store.markRead(th.id); drawList(); drawConv(keep ?? ""); if (keep) $("#txt")?.focus(); } };
}
