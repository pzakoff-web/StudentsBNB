import * as store from "../store.js";
import { icon } from "../icons.js";
import { savePhoto, deletePhoto } from "../photos.js";
import { $, $$, esc, nl2br, avatar, toast, opts, bindOpts, go } from "../ui.js";
import { ratingSummary, fmtRating, compatWith, plural } from "../logic.js";
import { UNIVERSITIES, uniById } from "../data/places.js";
import { userLine, yearsOn, reviewHTML } from "./listing.js";
import { cardHTML, bindCards, rowFor } from "./card.js";

const SLEEP = { early: ["Лягам рано", "sun"], late: ["Лягам късно", "moon"] };
const CLEAN = ["", "Спокойно към реда", "Нормално подреден/а", "Много подреден/а"];
const GUESTS = ["", "Рядко имам гости", "Понякога имам гости", "Често имам гости"];

export function lifestyleChips(u) {
  return `<div class="life">
    <span>${icon(u.smoke ? "cigarette" : "cigarette-off", 16)}${u.smoke ? "Пуши" : "Не пуши"}</span>
    <span>${icon(SLEEP[u.sleep][1], 16)}${SLEEP[u.sleep][0]}</span>
    <span>${icon("sparkles", 16)}${CLEAN[u.clean]}</span>
    <span>${icon("users", 16)}${GUESTS[u.guests]}</span></div>`;
}

export function profilePage(main, id) {
  const u = store.user(id);
  if (!u) { main.innerHTML = `<div class="wrap empty"><h2>Профилът не е намерен</h2><a class="btn dark" href="#/">Към началото</a></div>`; return; }
  const me = store.me(), mine = u.id === me.id;
  const reviews = store.reviewsOfUser(u.id).sort((a, b) => b.date.localeCompare(a.date));
  const rs = ratingSummary(reviews);
  const ls = store.listingsOf(u.id).filter(l => l.status === "active" || mine);
  const livesIn = store.listings().filter(l => l.residents.includes(u.id) && l.hostId !== u.id);
  const uni = uniById(u.university);
  const c = !mine && u.role === "student" ? compatWith(me, u) : null;
  const first = u.name.split(" ")[0];

  main.innerHTML = `<div class="wrap pp">
    <div>
      <div class="idcard ${u.role}">
        <div class="idcard-band">${icon(u.role === "student" ? "graduation-cap" : "key-round", 16)}<span>${u.role === "student" ? `Студент · ${esc(uni?.short || "")}` : u.role === "agency" ? "Агенция" : "Хазяин"}</span><span class="idcard-no">№ ${esc(u.id.toUpperCase())}</span></div>
        <div class="idcard-body">${avatar(u, 88)}
          <div><h1>${esc(u.name)}</h1>
            <p>${u.role === "student" ? `${esc(u.faculty)}<br>${u.year} курс` : esc(u.languages?.join(", ") || "")}</p>
            <p class="muted">В делим от ${yearsOn(u)}</p>
            ${u.emailVerified || u.idVerified ? `<span class="stamp">Потвърден</span>` : ""}</div></div>
        <dl class="idcard-stats"><div><dt>Отзиви</dt><dd>${rs.count}</dd></div><div><dt>Оценка</dt><dd>${rs.count ? fmtRating(rs.overall) : "—"}</dd></div><div><dt>Обяви</dt><dd>${ls.length}</dd></div></dl>
      </div>
      <div class="pverify"><h3>Потвърдено за ${esc(first)}</h3>
        ${u.emailVerified ? `<div>${icon("check", 20, "ok")}Студентски имейл (${esc(uni?.short || "")})</div>` : ""}
        ${u.idVerified ? `<div>${icon("check", 20, "ok")}Самоличност</div>` : ""}
        <div>${icon("check", 20, "ok")}Телефонен номер</div>
        ${!u.emailVerified && !u.idVerified ? `<div class="muted">${icon("circle-help", 20)}Още няма потвърден студентски имейл</div>` : ""}
        ${mine ? `<a class="btn ghost full" href="#/me/edit" style="margin-top:14px">${icon("pencil", 16)} Редактирай профила</a>` : ""}
      </div>
    </div>
    <div class="pmain">
      <h2>За ${esc(first)}</h2>
      <div class="pfacts">
        ${uni ? `<div>${icon("graduation-cap", 22)}<span>${esc(uni.name)}</span></div>` : ""}
        ${u.faculty ? `<div>${icon("book-open", 22)}<span>${esc(u.faculty)}, ${u.year} курс</span></div>` : ""}
        ${u.birthYear ? `<div>${icon("calendar", 22)}<span>Роден${u.gender === "f" ? "а" : ""} ${u.birthYear} г.</span></div>` : ""}
        ${u.languages?.length ? `<div>${icon("languages", 22)}<span>Говори ${esc(u.languages.join(", "))}</span></div>` : ""}
        ${u.seeking ? `<div>${icon("search", 22)}<span>Търси стая${u.budget ? ` до €${u.budget} на месец` : ""}</span></div>` : ""}
      </div>
      <div class="desc">${nl2br(u.bio || (mine ? "Още нямаш описание. Добави няколко думи за себе си — помага да те харесат." : ""))}</div>
      ${u.role === "student" ? `<div class="psec" style="margin-top:28px"><h3>Начин на живот</h3>${lifestyleChips(u)}
        ${c ? `<div style="margin-top:22px;max-width:460px"><b>Съвпадение с теб</b><div class="meter"><div class="bar ${c.score >= 80 ? "hi" : ""}"><i style="width:${c.score}%"></i></div><b>${c.score}%</b></div>
          <ul class="why">${c.why.map(([k, t]) => `<li class="${k}">${icon(k === "y" ? "check" : "triangle-alert", 16)}${t}</li>`).join("")}</ul></div>` : ""}
        ${!mine && u.seeking ? `<button class="btn primary" id="contact" style="margin-top:20px">Пиши на ${esc(first)}</button>` : ""}</div>` : ""}
      ${ls.length ? `<div class="psec"><h3>${mine ? "Твоите обяви" : "Обяви на " + esc(first)}</h3><div class="hscroll" id="pls">${ls.map(l => cardHTML(rowFor(l))).join("")}</div></div>` : ""}
      ${livesIn.length ? `<div class="psec"><h3>Живее в</h3><div class="hscroll" id="pli">${livesIn.map(l => cardHTML(rowFor(l))).join("")}</div></div>` : ""}
      <div class="psec"><h3>${rs.count ? `${icon("star", 20, "star")} ${fmtRating(rs.overall)} · ${plural(rs.count, "отзив", "отзива")}` : "Още няма отзиви"}</h3>
        ${rs.count ? `<div class="reviews">${reviews.slice(0, 6).map(reviewHTML).join("")}</div>` : `<p class="muted">Отзивите се пишат от хора, живели с ${esc(first)}.</p>`}
      </div>
    </div></div>`;
  $$(".hscroll", main).forEach(bindCards);
  $("#contact")?.addEventListener("click", () => {
    // A seeker has no listing to talk about, so the thread is person-to-person.
    const t = store.openDirectThread(u.id);
    if (!t.messages.length) sessionStorage.setItem("draft:" + t.id, `Здравей, ${first}! Видях, че търсиш стая. ${store.listingsOf(me.id).length ? "Имам свободна стая — виж обявата ми в профила." : "И аз търся — искаш ли да потърсим цяло жилище заедно?"}`);
    go("/inbox/" + t.id);
  });
}

export function editProfile(main) {
  const me = store.me();
  const v = structuredClone(me);
  const isStudent = v.role === "student";
  const langs = ["Български", "Английски", "Немски", "Руски", "Френски", "Испански", "Италиански", "Турски", "Гръцки"];

  main.innerHTML = `<div class="wrap" style="max-width:760px;padding-top:32px;padding-bottom:120px">
    <div class="page-head" style="padding-top:0"><h1>Редактирай профила</h1><p>Хората виждат това, преди да ти пишат. Съвпадението в обявите се смята от въпросите за начин на живот.</p></div>
    <form id="pf" novalidate>
      <div class="fsec"><h3>Снимка</h3><div class="avatar-edit"><span id="avBox">${avatar(v, 96)}</span>
        <div style="display:grid;gap:8px"><label class="btn ghost sm" for="avIn" style="cursor:pointer">${icon("upload", 16)} Качи снимка</label><input type="file" id="avIn" accept="image/*" hidden>
        <button type="button" class="btn link" id="avDel" ${v.avatar ? "" : "hidden"}>Махни снимката</button></div></div></div>

      <div class="fsec"><h3>Основно</h3>
        <div class="field"><label for="pName">Име и фамилия</label><input class="inp" id="pName" value="${esc(v.name)}" maxlength="60" required autocomplete="name"></div>
        ${isStudent ? `<div class="cols-2">
          <div class="field"><span class="lbl">Пол</span>${opts("gender", [["m", "Мъж"], ["f", "Жена"]], v.gender)}</div>
          <div class="field"><label for="pBy">Година на раждане</label><input class="inp" id="pBy" type="number" min="1960" max="2010" value="${v.birthYear || ""}" inputmode="numeric"></div></div>
        <div class="field"><label for="pUni">Университет</label><select class="inp" id="pUni">${UNIVERSITIES.map(u => `<option value="${u.id}" ${u.id === v.university ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>
        <div class="cols-2"><div class="field"><label for="pFac">Специалност</label><input class="inp" id="pFac" value="${esc(v.faculty)}" maxlength="60"></div>
          <div class="field"><label for="pYear">Курс</label><select class="inp" id="pYear">${[1, 2, 3, 4, 5, 6].map(n => `<option ${n === v.year ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>` : ""}
        <div class="field"><label for="pBio">За мен</label><textarea class="inp" id="pBio" maxlength="600" placeholder="С какво се занимаваш, какво обичаш, какъв съквартирант си.">${esc(v.bio)}</textarea><div class="hint"><span id="bioN">${v.bio.length}</span>/600</div></div>
        <div class="field"><span class="lbl">Езици</span>${opts("languages", langs.map(x => [x, x]), v.languages, true)}</div>
      </div>

      ${isStudent ? `<div class="fsec"><h3>Начин на живот</h3><p>Отговори честно — така ще намериш човек, с когото наистина ще се разбирате.</p>
        <div class="field"><span class="lbl">Пушиш ли вкъщи?</span>${opts("smoke", [[0, "Не", "cigarette-off"], [1, "Да", "cigarette"]], v.smoke)}</div>
        <div class="field"><span class="lbl">Режим</span>${opts("sleep", [["early", "Лягам рано", "sun"], ["late", "Лягам късно", "moon"]], v.sleep)}</div>
        <div class="field"><span class="lbl">Ред вкъщи</span>${opts("clean", [[1, "Спокойно"], [2, "Нормално"], [3, "Много подредено"]], v.clean)}</div>
        <div class="field"><span class="lbl">Гости</span>${opts("guests", [[1, "Рядко"], [2, "Понякога"], [3, "Често"]], v.guests)}</div></div>

      <div class="fsec"><h3>Търся стая</h3>
        <label class="check"><input type="checkbox" id="pSeek" ${v.seeking ? "checked" : ""}><span><b>Покажи ме в „Търсят съквартирант“</b><br><span class="muted">Хората със свободна стая ще могат да ти пишат.</span></span></label>
        <div class="field" id="budWrap" ${v.seeking ? "" : "hidden"} style="margin-top:12px"><label for="pBud">Бюджет на месец, със сметките</label><input class="inp" id="pBud" type="number" min="100" max="1000" step="10" value="${v.budget || 350}" inputmode="numeric" style="max-width:200px"></div></div>

      <div class="fsec"><h3>Студентски имейл</h3><p>Потвърденият имейл дава значка „Потвърден студент“ на профила и обявите ти.</p>
        ${v.emailVerified ? `<p style="display:flex;gap:8px;align-items:center;color:var(--ok);font-weight:700">${icon("badge-check", 20)} ${esc(v.email)} е потвърден</p>` : `
        <div class="field"><label for="pMail">Имейл от университета</label><div style="display:flex;gap:8px"><input class="inp" id="pMail" type="email" value="${esc(v.email)}" placeholder="s123456@${uniById(v.university)?.domains[0] || "ue-varna.bg"}" autocomplete="email"><button type="button" class="btn ghost" id="sendCode">Изпрати код</button></div>
          <div class="err" id="mailErr" hidden></div></div>
        <div class="field" id="codeWrap" hidden><label for="pCode">Код от имейла</label><div style="display:flex;gap:8px"><input class="inp" id="pCode" inputmode="numeric" maxlength="6" style="max-width:160px"><button type="button" class="btn dark" id="checkCode">Потвърди</button></div></div>`}
      </div>` : ""}

      <div class="fsec"><h3>Телефон</h3><p>Никой не го вижда, докато и двамата не приемете да си дадете контактите в чата.</p>
        <div class="field"><label for="pPhone">Телефон</label><input class="inp" id="pPhone" type="tel" value="${esc(v.phone)}" autocomplete="tel" style="max-width:260px"></div></div>

      <div class="wiz-foot"><div class="wiz-nav"><a class="btn link" href="#/u/${me.id}">Отказ</a><button class="btn dark" type="submit">Запази</button></div></div>
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
    } catch (err) { toast(err.message || "Снимката не можа да се качи"); }
  };
  $("#avDel").onclick = () => { v.avatar = null; $("#avBox").innerHTML = avatar(v, 96); $("#avDel").hidden = true; };

  let code = null;
  $("#sendCode")?.addEventListener("click", () => {
    const mail = $("#pMail").value.trim().toLowerCase(), uni = uniById($("#pUni").value);
    const dom = mail.split("@")[1] || "";
    const ok = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(mail) && uni.domains.some(d => dom === d || dom.endsWith("." + d));
    $("#mailErr").hidden = ok;
    if (!ok) { $("#mailErr").innerHTML = `${icon("triangle-alert", 14)} Трябва да е имейл от ${uni.domains.map(d => "@" + d).join(" или ")}`; return; }
    code = String(Math.floor(100000 + Math.random() * 900000));
    $("#codeWrap").hidden = false; $("#pCode").focus();
    toast(`Демо: кодът е ${code}`);
  });
  $("#checkCode")?.addEventListener("click", () => {
    if ($("#pCode").value.trim() !== code) { toast("Грешен код"); return; }
    v.email = $("#pMail").value.trim().toLowerCase(); v.emailVerified = true;
    $("#codeWrap").outerHTML = `<p style="display:flex;gap:8px;align-items:center;color:var(--ok);font-weight:700">${icon("badge-check", 20)} ${esc(v.email)} е потвърден</p>`;
    toast("Имейлът е потвърден");
  });

  f.onsubmit = async e => {
    e.preventDefault();
    const name = $("#pName").value.trim().replace(/\s+/g, " ");
    if (name.length < 2) { $("#pName").classList.add("bad"); $("#pName").focus(); toast("Въведи име"); return; }
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
    toast("Профилът е запазен");
    go("/u/" + me.id);
  };
}
