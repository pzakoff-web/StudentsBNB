import * as store from "../store.js";
import { icon } from "../icons.js";
import { savePhoto, deletePhoto } from "../photos.js";
import { $, $$, esc, nl2br, avatar, toast, opts, bindOpts, go } from "../ui.js";
import { ratingSummary, fmtRating, compatWith, plural } from "../logic.js";
import { UNIVERSITIES, uniById, uniShort, uniName } from "../data/places.js";
import { S, changeLang } from "../state.js";
import { t, LANGS } from "../i18n.js";
import { userLine, yearsOn, reviewHTML } from "./listing.js";
import { cardHTML, bindCards, rowFor } from "./card.js";

const SLEEP = { early: ["Лягам рано", "sun"], late: ["Лягам късно", "moon"] };
const CLEAN = ["", "Спокойно към реда", "Нормално подреден/а", "Много подреден/а"];
const GUESTS = ["", "Рядко имам гости", "Понякога имам гости", "Често имам гости"];
// Spoken languages are stored by their Bulgarian name and shown translated.
const SPOKEN = ["Български", "Английски", "Немски", "Руски", "Френски", "Испански", "Италиански", "Турски", "Гръцки"];

export function lifestyleChips(u) {
  return `<div class="life">
    <span>${icon(u.smoke ? "cigarette" : "cigarette-off", 16)}${t(u.smoke ? "Пуши" : "Не пуши")}</span>
    <span>${icon(SLEEP[u.sleep][1], 16)}${t(SLEEP[u.sleep][0])}</span>
    <span>${icon("sparkles", 16)}${t(CLEAN[u.clean])}</span>
    <span>${icon("users", 16)}${t(GUESTS[u.guests])}</span></div>`;
}

export function profilePage(main, id) {
  const u = store.user(id);
  if (!u) { main.innerHTML = `<div class="wrap empty"><h2>${t("Профилът не е намерен")}</h2><a class="btn dark" href="#/">${t("Към началото")}</a></div>`; return; }
  const me = store.me(), mine = u.id === me.id;
  const reviews = store.reviewsOfUser(u.id).sort((a, b) => b.date.localeCompare(a.date));
  const rs = ratingSummary(reviews);
  const ls = store.listingsOf(u.id).filter(l => l.status === "active" || mine);
  const livesIn = store.listings().filter(l => l.residents.includes(u.id) && l.hostId !== u.id);
  const uni = uniById(u.university);
  const c = !mine && u.role === "student" ? compatWith(me, u) : null;
  const first = u.name.split(" ")[0];
  const myGroup = store.groupOf();
  const theirGroup = store.groupOf(u.id);
  const canInvite = !mine && u.seeking && myGroup && !myGroup.members.some(m => m.userId === u.id);

  main.innerHTML = `<div class="wrap pp">
    <div>
      <div class="idcard ${u.role}">
        <div class="idcard-band">${icon(u.role === "student" ? "graduation-cap" : "key-round", 16)}<span>${u.role === "student" ? `${t("Студент")} · ${esc(uniShort(uni))}` : u.role === "agency" ? t("Агенция") : t("Хазяин")}</span><span class="idcard-no">№ ${esc(u.id.toUpperCase())}</span></div>
        <div class="idcard-body">${avatar(u, 88)}
          <div><h1>${esc(u.name)}</h1>
            <p>${u.role === "student" ? `${esc(u.faculty)}<br>${t("{n} курс", { n: u.year })}` : esc((u.languages || []).map(x => t(x)).join(", "))}</p>
            <p class="muted">${t("В делим от {t}", { t: yearsOn(u) })}</p>
            ${u.emailVerified || u.idVerified ? `<span class="stamp">${t("Потвърден")}</span>` : ""}</div></div>
        <dl class="idcard-stats"><div><dt>${t("Отзиви")}</dt><dd>${rs.count}</dd></div><div><dt>${t("Оценка")}</dt><dd>${rs.count ? fmtRating(rs.overall) : "—"}</dd></div><div><dt>${t("Обяви")}</dt><dd>${ls.length}</dd></div></dl>
      </div>
      <div class="pverify"><h3>${t("Потвърдено за {name}", { name: esc(first) })}</h3>
        ${u.emailVerified ? `<div>${icon("check", 20, "ok")}${t("Студентски имейл ({uni})", { uni: esc(uniShort(uni)) })}</div>` : ""}
        ${u.idVerified ? `<div>${icon("check", 20, "ok")}${t("Самоличност")}</div>` : ""}
        <div>${icon("check", 20, "ok")}${t("Телефонен номер")}</div>
        ${!u.emailVerified && !u.idVerified ? `<div class="muted">${icon("circle-help", 20)}${t("Още няма потвърден студентски имейл")}</div>` : ""}
        ${mine ? `<a class="btn ghost full" href="#/me/edit" style="margin-top:14px">${icon("pencil", 16)} ${t("Редактирай профила")}</a>` : ""}
      </div>
      ${mine ? `<div class="pverify"><h3>${t("Настройки")}</h3>
        <div class="field" style="margin:0"><label for="pLang">${icon("globe", 16)} ${t("Език на сайта")}</label>
          <select class="inp" id="pLang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === S.lang ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <a class="btn ghost full" href="#/group" style="margin-top:12px">${icon("users", 16)} ${myGroup ? esc(myGroup.name) : t("Моята група")}</a>
        <a class="btn ghost full" href="#/notifications" style="margin-top:8px">${icon("bell", 16)} ${t("Известия и запазени търсения")}</a></div>` : ""}
    </div>
    <div class="pmain">
      <h2>${t("За {name}", { name: esc(first) })}</h2>
      <div class="pfacts">
        ${uni ? `<div>${icon("graduation-cap", 22)}<span>${esc(uniName(uni))}</span></div>` : ""}
        ${u.faculty ? `<div>${icon("book-open", 22)}<span>${esc(u.faculty)}, ${t("{n} курс", { n: u.year })}</span></div>` : ""}
        ${u.birthYear ? `<div>${icon("calendar", 22)}<span>${t(u.gender === "f" ? "Родена {y} г." : "Роден {y} г.", { y: u.birthYear })}</span></div>` : ""}
        ${u.languages?.length ? `<div>${icon("languages", 22)}<span>${t("Говори {l}", { l: esc(u.languages.map(x => t(x)).join(", ")) })}</span></div>` : ""}
        ${u.seeking ? `<div>${icon("search", 22)}<span>${u.budget ? t("Търси стая до €{n} на месец", { n: u.budget }) : t("Търси стая")}</span></div>` : ""}
        ${theirGroup ? `<div>${icon("users", 22)}<span>${t("В група „{group}“", { group: esc(theirGroup.name) })}</span></div>` : ""}
      </div>
      <div class="desc">${nl2br(u.bio || (mine ? t("Още нямаш описание. Добави няколко думи за себе си — помага да те харесат.") : ""))}</div>
      ${u.role === "student" ? `<div class="psec" style="margin-top:28px"><h3>${t("Начин на живот")}</h3>${lifestyleChips(u)}
        ${c ? `<div style="margin-top:22px;max-width:460px"><b>${t("Съвпадение с теб")}</b><div class="meter"><div class="bar ${c.score >= 80 ? "hi" : ""}"><i style="width:${c.score}%"></i></div><b>${c.score}%</b></div>
          <ul class="why">${c.why.map(([k, txt]) => `<li class="${k}">${icon(k === "y" ? "check" : "triangle-alert", 16)}${txt}</li>`).join("")}</ul></div>` : ""}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
        ${!mine && u.seeking ? `<button class="btn dark" id="contact">${icon("message-circle", 16)} ${t("Пиши на {name}", { name: esc(first) })}</button>` : ""}
        ${canInvite ? `<button class="btn yellow" id="invGrp">${icon("user-plus", 16)} ${t("Покани в „{group}“", { group: esc(myGroup.name) })}</button>` : ""}</div></div>` : ""}
      ${ls.length ? `<div class="psec"><h3>${mine ? t("Твоите обяви") : t("Обяви на {name}", { name: esc(first) })}</h3><div class="hscroll" id="pls">${ls.map(l => cardHTML(rowFor(l))).join("")}</div></div>` : ""}
      ${livesIn.length ? `<div class="psec"><h3>${t("Живее в")}</h3><div class="hscroll" id="pli">${livesIn.map(l => cardHTML(rowFor(l))).join("")}</div></div>` : ""}
      <div class="psec"><h3>${rs.count ? `${icon("star", 20, "star")} ${fmtRating(rs.overall)} · ${plural(rs.count, "отзив", "отзива")}` : t("Още няма отзиви")}</h3>
        ${rs.count ? `<div class="reviews">${reviews.slice(0, 6).map(reviewHTML).join("")}</div>` : `<p class="muted">${t("Отзивите се пишат от хора, живели с {name}.", { name: esc(first) })}</p>`}
      </div>
    </div></div>`;
  $$(".hscroll", main).forEach(bindCards);
  $("#pLang")?.addEventListener("change", e => { changeLang(e.target.value); window.dispatchEvent(new Event("delim:rerender")); });
  $("#invGrp")?.addEventListener("click", e => { store.inviteToGroup(myGroup.id, u.id); e.currentTarget.disabled = true; toast(t("Поканата е изпратена")); });
  $("#contact")?.addEventListener("click", () => {
    // A seeker has no listing to talk about, so the thread is person-to-person.
    const th = store.openDirectThread(u.id);
    if (!th.messages.length) sessionStorage.setItem("draft:" + th.id, t("Здравей, {name}! Видях, че търсиш стая.", { name: first }) + " " +
      (store.listingsOf(me.id).length ? t("Имам свободна стая — виж обявата ми в профила.") : t("И аз търся — искаш ли да потърсим цяло жилище заедно?")));
    go("/inbox/" + th.id);
  });
}

export function editProfile(main) {
  const me = store.me();
  const v = structuredClone(me);
  const isStudent = v.role === "student";

  main.innerHTML = `<div class="wrap" style="max-width:760px;padding-top:32px;padding-bottom:120px">
    <div class="page-head" style="padding-top:0"><h1>${t("Редактирай профила")}</h1><p>${t("Хората виждат това, преди да ти пишат. Съвпадението в обявите се смята от въпросите за начин на живот.")}</p></div>
    <form id="pf" novalidate>
      <div class="fsec"><h3>${t("Снимка")}</h3><div class="avatar-edit"><span id="avBox">${avatar(v, 96)}</span>
        <div style="display:grid;gap:8px"><label class="btn ghost sm" for="avIn" style="cursor:pointer">${icon("upload", 16)} ${t("Качи снимка")}</label><input type="file" id="avIn" accept="image/*" hidden>
        <button type="button" class="btn link" id="avDel" ${v.avatar ? "" : "hidden"}>${t("Махни снимката")}</button></div></div></div>

      <div class="fsec"><h3>${t("Основно")}</h3>
        <div class="field"><label for="pName">${t("Име и фамилия")}</label><input class="inp" id="pName" value="${esc(v.name)}" maxlength="60" required autocomplete="name"></div>
        ${isStudent ? `<div class="cols-2">
          <div class="field"><span class="lbl">${t("Пол")}</span>${opts("gender", [["m", t("Мъж")], ["f", t("Жена")]], v.gender)}</div>
          <div class="field"><label for="pBy">${t("Година на раждане")}</label><input class="inp" id="pBy" type="number" min="1960" max="2010" value="${v.birthYear || ""}" inputmode="numeric"></div></div>
        <div class="field"><label for="pUni">${t("Университет")}</label><select class="inp" id="pUni">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === v.university ? "selected" : ""}>${esc(uniName(u))}</option>`).join("")}</select></div>
        <div class="cols-2"><div class="field"><label for="pFac">${t("Специалност")}</label><input class="inp" id="pFac" value="${esc(v.faculty)}" maxlength="60"></div>
          <div class="field"><label for="pYear">${t("Курс")}</label><select class="inp" id="pYear">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === v.year ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>` : ""}
        <div class="field"><label for="pBio">${t("За мен")}</label><textarea class="inp" id="pBio" maxlength="600" placeholder="${t("С какво се занимаваш, какво обичаш, какъв съквартирант си.")}">${esc(v.bio)}</textarea><div class="hint"><span id="bioN">${v.bio.length}</span>/600</div></div>
        <div class="field"><span class="lbl">${t("Езици")}</span>${opts("languages", SPOKEN.map(x => [x, t(x)]), v.languages, true)}</div>
      </div>

      ${isStudent ? `<div class="fsec"><h3>${t("Начин на живот")}</h3><p>${t("Отговори честно — така ще намериш човек, с когото наистина ще се разбирате.")}</p>
        <div class="field"><span class="lbl">${t("Пушиш ли вкъщи?")}</span>${opts("smoke", [[0, t("Не"), "cigarette-off"], [1, t("Да"), "cigarette"]], v.smoke)}</div>
        <div class="field"><span class="lbl">${t("Режим")}</span>${opts("sleep", [["early", t("Лягам рано"), "sun"], ["late", t("Лягам късно"), "moon"]], v.sleep)}</div>
        <div class="field"><span class="lbl">${t("Ред вкъщи")}</span>${opts("clean", [[1, t("Спокойно")], [2, t("Нормално")], [3, t("Много подредено")]], v.clean)}</div>
        <div class="field"><span class="lbl">${t("Гости")}</span>${opts("guests", [[1, t("Рядко")], [2, t("Понякога")], [3, t("Често")]], v.guests)}</div></div>

      <div class="fsec"><h3>${t("Търся стая")}</h3>
        <label class="check"><input type="checkbox" id="pSeek" ${v.seeking ? "checked" : ""}><span><b>${t("Покажи ме в „Търсят съквартирант“")}</b><br><span class="muted">${t("Хората със свободна стая ще могат да ти пишат.")}</span></span></label>
        <div class="field" id="budWrap" ${v.seeking ? "" : "hidden"} style="margin-top:12px"><label for="pBud">${t("Бюджет на месец, със сметките")}</label><input class="inp" id="pBud" type="number" min="100" max="1000" step="10" value="${v.budget || 350}" inputmode="numeric" style="max-width:200px"></div></div>

      <div class="fsec"><h3>${t("Студентски имейл")}</h3><p>${t("Потвърденият имейл дава значка „Потвърден студент“ на профила и обявите ти.")}</p>
        ${v.emailVerified ? `<p style="display:flex;gap:8px;align-items:center;color:var(--ok);font-weight:700">${icon("badge-check", 20)} ${t("{mail} е потвърден", { mail: esc(v.email) })}</p>` : `
        <div class="field"><label for="pMail">${t("Имейл от университета")}</label><div style="display:flex;gap:8px"><input class="inp" id="pMail" type="email" value="${esc(v.email)}" placeholder="s123456@${uniById(v.university)?.domains[0] || "ue-varna.bg"}" autocomplete="email"><button type="button" class="btn ghost" id="sendCode">${t("Изпрати код")}</button></div>
          <div class="err" id="mailErr" hidden></div></div>
        <div class="field" id="codeWrap" hidden><label for="pCode">${t("Код от имейла")}</label><div style="display:flex;gap:8px"><input class="inp" id="pCode" inputmode="numeric" maxlength="6" style="max-width:160px"><button type="button" class="btn dark" id="checkCode">${t("Потвърди")}</button></div></div>`}
      </div>` : ""}

      <div class="fsec"><h3>${t("Телефон")}</h3><p>${t("Никой не го вижда, докато и двамата не приемете да си дадете контактите в чата.")}</p>
        <div class="field"><label for="pPhone">${t("Телефон")}</label><input class="inp" id="pPhone" type="tel" value="${esc(v.phone)}" autocomplete="tel" style="max-width:260px"></div></div>

      <div class="wiz-foot"><div class="wiz-nav"><a class="btn link" href="#/u/${me.id}">${t("Отказ")}</a><button class="btn dark" type="submit">${t("Запази")}</button></div></div>
    </form></div>`;

  const f = $("#pf");
  bindOpts(f, (k, val) => { v[k] = ["smoke", "clean", "guests"].includes(k) ? +val : val; });
  $("#pBio").oninput = e => { $("#bioN").textContent = e.target.value.length; };
  $("#pSeek")?.addEventListener("change", e => { $("#budWrap").hidden = !e.target.checked; });

  $("#avIn").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const ref = await savePhoto(file, 600);
      if (v.avatar && v.avatar !== me.avatar) await deletePhoto(v.avatar);
      v.avatar = ref; $("#avBox").innerHTML = avatar(v, 96); $("#avDel").hidden = false;
    } catch { toast(t("Снимката не можа да се качи")); }
  };
  $("#avDel").onclick = () => { v.avatar = null; $("#avBox").innerHTML = avatar(v, 96); $("#avDel").hidden = true; };

  let code = null;
  $("#sendCode")?.addEventListener("click", () => {
    const mail = $("#pMail").value.trim().toLowerCase(), uni = uniById($("#pUni").value);
    const dom = mail.split("@")[1] || "";
    const ok = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(mail) && uni.domains.some(d => dom === d || dom.endsWith("." + d));
    $("#mailErr").hidden = ok;
    if (!ok) { $("#mailErr").innerHTML = `${icon("triangle-alert", 14)} ${t("Трябва да е имейл от {domains}", { domains: uni.domains.map(d => "@" + d).join(t(" или ")) })}`; return; }
    code = String(Math.floor(100000 + Math.random() * 900000));
    $("#codeWrap").hidden = false; $("#pCode").focus();
    toast(t("Демо: кодът е {code}", { code }));
  });
  $("#checkCode")?.addEventListener("click", () => {
    if ($("#pCode").value.trim() !== code) { toast(t("Грешен код")); return; }
    v.email = $("#pMail").value.trim().toLowerCase(); v.emailVerified = true;
    $("#codeWrap").outerHTML = `<p style="display:flex;gap:8px;align-items:center;color:var(--ok);font-weight:700">${icon("badge-check", 20)} ${t("{mail} е потвърден", { mail: esc(v.email) })}</p>`;
    toast(t("Имейлът е потвърден"));
  });

  f.onsubmit = async e => {
    e.preventDefault();
    const name = $("#pName").value.trim().replace(/\s+/g, " ");
    if (name.length < 2) { $("#pName").classList.add("bad"); $("#pName").focus(); toast(t("Въведи име")); return; }
    const patch = { name, bio: $("#pBio").value.trim(), languages: v.languages, avatar: v.avatar, phone: $("#pPhone").value.trim() };
    if (isStudent) {
      const uniChanged = $("#pUni").value !== me.university;
      Object.assign(patch, { gender: v.gender, birthYear: +$("#pBy").value || 0, university: $("#pUni").value, faculty: $("#pFac").value.trim(), year: +$("#pYear").value,
        smoke: v.smoke, sleep: v.sleep, clean: v.clean, guests: v.guests, seeking: $("#pSeek").checked, budget: +$("#pBud").value || 0,
        email: v.email, emailVerified: uniChanged && !v.emailVerified ? false : v.emailVerified });
      // Verification belongs to one university; switching invalidates it unless re-verified here.
      if (uniChanged && me.emailVerified && v.email === me.email) { patch.emailVerified = false; patch.email = ""; }
    }
    if (me.avatar && me.avatar !== v.avatar) await deletePhoto(me.avatar);
    store.updateUser(me.id, patch);
    toast(t("Профилът е запазен"));
    go("/u/" + me.id);
  };
}
