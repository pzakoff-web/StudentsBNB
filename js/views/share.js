// "Post to Facebook groups": a 1200×630 image (the size Facebook uses for link previews)
// plus ready-to-paste text that links back to the listing.
import { icon } from "../icons.js";
import { photoSrc } from "../photos.js";
import { $, esc, modal, toast, download, copyText } from "../ui.js";
import { pricePerPerson, fmtDate, fmtMonths, TYPE_LABEL } from "../logic.js";
import { nearestUni } from "../geo.js";
import { uniShort, districtName, cityName, unisByIds } from "../data/places.js";
import { currentUnis } from "../state.js";
import { t } from "../i18n.js";

const W = 1200, H = 630;
const C = { paper: "#F3F6F4", ink: "#16232E", muted: "#5B6B77", hl: "#FFD83D", marine: "#1F5FA8", line: "#D5DDD9" };

export const listingUrl = l => `${location.origin}${location.pathname}#/l/${l.id}`;

export function postText(l) {
  const near = nearestUni(l.approx, unisByIds(currentUnis()));
  const who = { m: t("Търся съквартирант (мъж)."), f: t("Търся съквартирантка."), any: "" }[l.genderPref];
  return [
    t("{type} в {d}, {city} — €{pp} на човек със сметките", { type: t(TYPE_LABEL[l.type]), d: districtName(l.district), city: cityName(), pp: pricePerPerson(l) }),
    t("{n} мин до {uni} · от {date} · мин. {months}", { n: near.min, uni: uniShort(near.uni), date: fmtDate(l.availableFrom), months: fmtMonths(l.minMonths) }),
    l.type === "room" ? who : t("За {n} души. Може и група.", { n: l.occupants }),
    "",
    t("Снимки, точна сметка и чат с домакина:"),
    listingUrl(l),
  ].filter((x, i) => x || i === 3).join("\n");
}

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  return lines;
}

export async function renderCard(l) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  try { await Promise.all(["700 120px Unbounded", "600 40px Unbounded", "700 30px Manrope", "600 26px Manrope"].map(f => document.fonts.load(f))); } catch { /* fallback fonts */ }

  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  // Photo on the left, cropped to a square.
  let photoOk = false;
  if (l.photos[0]) {
    try {
      const img = await loadImg(photoSrc(l.photos[0]));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, H, H);
      photoOk = true;
    } catch { /* draw without the photo */ }
  }
  if (!photoOk) { ctx.fillStyle = C.marine; ctx.fillRect(0, 0, H, H); }
  ctx.fillStyle = C.ink; ctx.fillRect(H, 0, 8, H);

  const x = H + 56, maxW = W - x - 48;
  ctx.textBaseline = "alphabetic";
  // Logo.
  ctx.font = "700 40px Unbounded, 'Arial Black', sans-serif";
  const lw = ctx.measureText("делим").width;
  ctx.fillStyle = C.hl; ctx.fillRect(x - 4, 66, lw + 8, 20);
  ctx.fillStyle = C.ink; ctx.fillText("делим", x, 84);
  ctx.font = "600 22px Manrope, Arial, sans-serif"; ctx.fillStyle = C.muted;
  ctx.fillText(cityName(), x + lw + 16, 84);

  // Place and title.
  ctx.font = "800 24px Manrope, Arial, sans-serif"; ctx.fillStyle = C.marine;
  ctx.fillText(`${districtName(l.district)} · ${t(TYPE_LABEL[l.type])}`.toUpperCase(), x, 150);
  ctx.font = "700 32px Manrope, Arial, sans-serif"; ctx.fillStyle = C.ink;
  wrap(ctx, l.title, maxW, 2).forEach((ln, i) => ctx.fillText(ln, x, 196 + i * 40));

  // Price as a highlighter mark.
  const price = `€${pricePerPerson(l)}`;
  ctx.font = "700 112px Unbounded, 'Arial Black', sans-serif";
  const pw = ctx.measureText(price).width;
  ctx.fillStyle = C.hl; ctx.fillRect(x - 8, 330, pw + 16, 46);
  ctx.fillStyle = C.ink; ctx.fillText(price, x, 370);
  ctx.font = "600 26px Manrope, Arial, sans-serif"; ctx.fillStyle = C.muted;
  ctx.fillText(t("на човек / месец, със сметките"), x, 414);

  // Receipt line and facts.
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(x, 448); ctx.lineTo(W - 48, 448); ctx.stroke(); ctx.setLineDash([]);
  const near = nearestUni(l.approx, unisByIds(currentUnis()));
  ctx.font = "700 26px Manrope, Arial, sans-serif"; ctx.fillStyle = C.ink;
  ctx.fillText(t("{n} мин до {uni}", { n: near.min, uni: uniShort(near.uni) }) + "  ·  " + t("от {date}", { date: fmtDate(l.availableFrom) }), x, 494);
  ctx.font = "600 24px Manrope, Arial, sans-serif"; ctx.fillStyle = C.muted;
  ctx.fillText(t("Минимален срок") + ": " + fmtMonths(l.minMonths), x, 532);
  ctx.font = "700 20px Manrope, Arial, sans-serif"; ctx.fillStyle = C.marine;
  ctx.fillText(location.host + location.pathname.replace(/\/$/, ""), x, 590);

  return new Promise(res => {
    try { cv.toBlob(b => res({ blob: b, url: b ? URL.createObjectURL(b) : "" }), "image/png"); }
    catch { res({ blob: null, url: "" }); } // a browser that taints SVG images on canvas
  });
}

export function shareDialog(l) {
  const text = postText(l);
  const m = modal(`<h2>${t("Публикувай във Facebook")}</h2>
    <p class="muted" style="margin-top:-6px">${t("Готова картинка и текст за групи като „Квартири Варна“. Линкът води обратно към обявата.")}</p>
    <div class="share-prev" id="shPrev"><span class="muted">${t("Подготвяме картинката…")}</span></div>
    <div class="field" style="margin-top:14px"><label for="shText">${t("Текст за поста")}</label><textarea class="inp" id="shText" rows="7">${esc(text)}</textarea></div>
    <ol class="steps-mini"><li>${t("Натисни „Сподели“ и избери Facebook, или изтегли картинката.")}</li><li>${t("Постави текста в поста.")}</li><li>${t("Публикувай в групата.")}</li></ol>
    <div class="modal-foot share-foot">
      <button class="btn ghost" id="shCopy">${icon("copy", 16)} ${t("Копирай текста")}</button>
      <button class="btn ghost" id="shDl" disabled>${icon("download", 16)} ${t("Картинката")}</button>
      <button class="btn yellow" id="shGo" disabled>${icon("share-2", 16)} ${t("Сподели")}</button></div>`, { label: t("Публикувай във Facebook") });
  let card = null;
  const txt = () => $("#shText", m.el).value;
  renderCard(l).then(c => {
    card = c;
    $("#shPrev", m.el).innerHTML = c.url ? `<img src="${c.url}" alt="${esc(t("Картинка за поста: {title}", { title: l.title }))}">` : `<span class="muted">${t("Браузърът не позволи картинката. Текстът и линкът стигат.")}</span>`;
    $("#shDl", m.el).disabled = !c.blob; $("#shGo", m.el).disabled = false;
  });
  $("#shCopy", m.el).onclick = async () => toast(await copyText(txt()) ? t("Текстът е копиран") : t("Маркирай текста и го копирай ръчно"));
  $("#shDl", m.el).onclick = () => card?.blob && download(`delim-${l.id}.png`, card.blob);
  $("#shGo", m.el).onclick = async () => {
    const file = card?.blob ? new File([card.blob], `delim-${l.id}.png`, { type: "image/png" }) : null;
    await copyText(txt()); // Facebook ignores shared text, so it goes to the clipboard too
    try {
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: txt() }); return; }
      if (navigator.share) { await navigator.share({ text: txt(), url: listingUrl(l) }); return; }
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl(l))}`, "_blank", "noopener");
      toast(t("Текстът е копиран — постави го в поста"));
    } catch { /* cancelled */ }
  };
  return m;
}

