import * as store from "../store.js";
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, esc, avatar, timeAgo, go } from "../ui.js";
import { pricePerPerson } from "../logic.js";

export function inboxPage(main, tid) {
  const me = store.me();
  const t = tid ? store.thread(tid) : null;
  if (tid && (!t || !t.participants.includes(me.id))) { go("/inbox"); return; }

  main.innerHTML = `<div class="inbox ${t ? "has-thread" : ""}">
    <div class="inbox-list"><h1>Съобщения</h1><div id="thrList"></div></div>
    <section class="conv" id="conv" aria-label="Разговор"></section></div>`;

  function drawList() {
    const ts = store.threadsOf(me.id);
    $("#thrList").innerHTML = ts.length ? ts.map(x => {
      const other = store.user(x.participants.find(p => p !== me.id));
      const l = x.listingId && store.listing(x.listingId);
      const last = x.messages.at(-1);
      const unread = store.unreadCount(x);
      return `<a class="thr ${x.id === tid ? "on" : ""}" href="#/inbox/${x.id}">${avatar(other, 48)}
        <div style="min-width:0"><div class="nm">${esc(other?.name)}<small>${last ? timeAgo(last.ts) : ""}</small></div>
        <div class="last ${unread ? "unread" : ""}">${last ? (last.from === me.id ? "Ти: " : "") + esc(last.text) : "Нов разговор"}</div>
        <div class="last">${l ? esc(l.title) : "Лично съобщение"}</div></div>
        ${l?.photos[0] ? `<img class="th" src="${photoSrc(l.photos[0])}" alt="">` : ""}</a>`;
    }).join("") : `<div class="inbox-empty" style="padding:40px 24px">${icon("message-circle", 36)}<p><b>Още нямаш съобщения</b><br>Когато пишеш на някого за обява, разговорът ще е тук.</p><a class="btn dark" href="#/">Разгледай обявите</a></div>`;
  }

  function drawConv(keepText) {
    const conv = $("#conv");
    if (!t) { conv.innerHTML = `<div class="inbox-empty" style="height:100%">${icon("message-circle", 40)}<p>Избери разговор</p></div>`; return; }
    const other = store.user(t.participants.find(p => p !== me.id));
    const l = t.listingId && store.listing(t.listingId);
    const shared = store.bothShared(t), mineShared = !!t.phoneShare?.[me.id], theirShared = !!t.phoneShare?.[other.id];
    const text = keepText ?? sessionStorage.getItem("draft:" + t.id) ?? "";
    sessionStorage.removeItem("draft:" + t.id);
    conv.innerHTML = `<div class="conv-head">
        <a class="icon-btn" href="#/inbox" aria-label="Назад към всички" style="flex:none">${icon("arrow-left", 18)}</a>
        <a href="#/u/${other.id}">${avatar(other, 40)}</a>
        <div class="t"><b>${esc(other.name)}</b>${l ? `<a href="#/l/${l.id}">${esc(l.title)} · €${pricePerPerson(l)}/човек</a>` : `<span class="muted" style="font-size:13px">Лично съобщение</span>`}</div>
        ${shared ? "" : `<button class="btn ghost sm" id="share" ${mineShared ? "disabled" : ""} aria-label="Сподели телефон" title="Телефонът се показва само ако и двамата приемете">${icon("phone", 14)} <span class="lbl">${mineShared ? "Чакаме " + esc(other.name.split(" ")[0]) : theirShared ? "Приеми и сподели телефон" : "Сподели телефон"}</span></button>`}
      </div>
      ${shared ? `<div class="phone-box" style="margin-top:12px">${icon("phone", 16)} ${esc(other.name.split(" ")[0])}: ${esc(other.phone)}${l && store.canSeeAddress(l) ? ` · ${icon("map-pin", 16)} ${esc(l.address)}` : ""}</div>` : ""}
      <div class="msgs" id="msgs">
        <div class="bub sys">${icon("lock", 12)} Телефоните ви са скрити, докато и двамата не приемете да ги споделите.</div>
        ${t.messages.map(m => m.from === "system" ? `<div class="bub sys">${esc(m.text)}</div>` :
          `<div class="bub ${m.from === me.id ? "me" : "them"}">${esc(m.text)}<time>${timeAgo(m.ts)}</time></div>`).join("")}
      </div>
      <form class="composer" id="comp"><label class="sr" for="txt">Съобщение</label>
        <textarea id="txt" rows="1" maxlength="2000" placeholder="Напиши съобщение">${esc(text)}</textarea>
        <button class="send" id="send" aria-label="Изпрати" ${text.trim() ? "" : "disabled"}>${icon("send", 18)}</button></form>`;
    const msgs = $("#msgs"); msgs.scrollTop = msgs.scrollHeight;
    const ta = $("#txt");
    const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; $("#send").disabled = !ta.value.trim(); };
    ta.oninput = fit; fit();
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#comp").requestSubmit(); } });
    $("#comp").onsubmit = e => { e.preventDefault(); const v = ta.value.trim(); if (!v) return; ta.value = ""; store.sendMessage(t.id, v); };
    $("#share")?.addEventListener("click", () => store.sharePhone(t.id));
    if (!keepText && text) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    store.markRead(t.id);
  }

  drawList(); drawConv();
  return { refresh: () => { const keep = $("#txt")?.value; if (t) store.markRead(t.id); drawList(); drawConv(keep ?? ""); if (keep) $("#txt")?.focus(); } };
}
