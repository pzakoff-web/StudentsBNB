// Translation of what people write (titles, descriptions, bios, reviews, chat) into the interface language.
// Names are transliterated, not translated. Demo content has ready translations (js/i18n/content.js);
// anything else goes to a machine-translation service once, then lives in a local cache.
//
// Prototype provider: MyMemory (free, CORS, no key, ~5000 characters a day per IP). Production should
// call DeepL or Google through the backend so the key stays secret and the cache is shared.
// Only the text itself is sent: no names, e-mails or ids.
import { getLang, t } from "./i18n.js";
import CONTENT from "./i18n/content.js";

const CYR = /[Ѐ-ӿ]/;
const READY = { en: new Map(CONTENT.map(r => [r[0], r[1]])), de: new Map(CONTENT.map(r => [r[0], r[2]])) };

// Official Bulgarian transliteration (Transliteration Act 2009, "Streamlined System").
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
export function translit(s) {
  return String(s ?? "")
    .replace(/(и|И)(я|Я)(?![\u0400-\u04FF])/g, (m, i, y) => (i === "и" ? "i" : "I") + (y === "я" ? "a" : "A"))
    .replace(/[Ѐ-ӿ]/g, c => {
      const lo = c.toLowerCase(), r = TR[lo];
      if (r == null) return c;
      if (c === lo) return r;
      return r.charAt(0).toUpperCase() + r.slice(1);
    });
}

// A person's or company's name in the interface language.
export const nm = s => getLang() === "bg" ? (s ?? "") : translit(s);

// ---- cache ----
const KEY = "delim:tx";
let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { cache = {}; }
const saveCache = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* full or blocked: keep in memory */ } };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length.toString(36); };

// Needs translating into `lang`? Bulgarian text for en/de; Latin text for a Bulgarian reader.
const needs = (s, lang) => !!s && s.trim() && (lang === "bg" ? /[A-Za-z]{3}/.test(s) && !CYR.test(s) : CYR.test(s));

// Synchronous lookup: { text, auto } where auto says the text was translated by a machine/table.
export function lookup(s, lang = getLang()) {
  s = String(s ?? "");
  if (!needs(s, lang)) return { text: s, auto: false };
  const ready = READY[lang]?.get(s);
  if (ready) return { text: ready, auto: true };
  const hit = cache[lang]?.[hash(s)];
  if (hit) return { text: hit, auto: true };
  queue(s, lang);
  return { text: s, auto: false, pending: true };
}
export const plain = s => lookup(s).text;

// ---- fetching ----
export const PROVIDER = "https://api.mymemory.translated.net/get";
let stopped = false;           // after a quota or network error, stop for this visit
const waiting = new Map();     // hash → { s, lang }
let timer = null;

function queue(s, lang) {
  if (stopped) return;
  const k = lang + ":" + hash(s);
  if (waiting.has(k)) return;
  waiting.set(k, { s, lang });
  clearTimeout(timer); timer = setTimeout(flush, 30);
}

// The service takes ≤500 characters per request: split by paragraph, then sentence.
function chunks(s) {
  const out = [];
  for (const para of s.split(/(\n+)/)) {
    if (/^\n+$/.test(para) || para.length <= 450) { out.push(para); continue; }
    let cur = "";
    for (const sen of para.match(/[^.!?]+[.!?]*\s*/g) || [para]) {
      if ((cur + sen).length > 450 && cur) { out.push(cur); cur = ""; }
      cur += sen;
    }
    if (cur) out.push(cur);
  }
  return out;
}

async function translateOne(s, lang) {
  const from = lang === "bg" ? "en" : "bg";
  const parts = await Promise.all(chunks(s).map(async c => {
    if (!c.trim() || /^\n+$/.test(c)) return c;
    const u = new URL(PROVIDER);
    u.search = new URLSearchParams({ q: c, langpair: `${from}|${lang}` });
    const res = await fetch(u, { referrerPolicy: "no-referrer" });
    const j = await res.json();
    const out = j?.responseData?.translatedText;
    if (!res.ok || j.responseStatus !== 200 || !out || /MYMEMORY WARNING/i.test(out)) throw new Error("translate: " + (j?.responseStatus || res.status));
    const lead = c.match(/^\s*/)[0], trail = c.match(/\s*$/)[0];
    return lead + decode(out).trim() + trail;
  }));
  return parts.join("");
}
const decode = s => { const el = document.createElement("textarea"); el.innerHTML = s; return el.value; };

async function flush() {
  const jobs = [...waiting.entries()];
  for (const [k, { s, lang }] of jobs) {
    if (stopped) break;
    try {
      const out = await translateOne(s, lang);
      (cache[lang] ||= {})[hash(s)] = out;
      saveCache();
      document.dispatchEvent(new CustomEvent("delim:translated", { detail: { key: hash(s), lang } }));
    } catch {
      stopped = true;
    } finally { waiting.delete(k); }
  }
}

// ---- rendering ----
const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FMT = { i: escH, p: s => escH(s).replace(/\n/g, "<br>") };

// Inline translated text. While a translation is on its way the original shows and is swapped in place.
export function tx(s, kind = "i") {
  const r = lookup(s);
  return r.pending ? `<span data-tx="${hash(String(s))}" data-txf="${kind}" data-src="${escH(s)}">${FMT[kind](r.text)}</span>` : FMT[kind](r.text);
}

// A block (description, bio) with a note that it was translated and a switch back to the original.
export function txBlock(s, cls = "desc") {
  s = String(s ?? "");
  const lang = getLang(), r = lookup(s, lang);
  if (!r.auto && !r.pending) return `<div class="${cls}">${FMT.p(s)}</div>`;
  return `<div class="tx-wrap"><div class="${cls}">${r.pending ? tx(s, "p") : FMT.p(r.text)}</div>
    <div class="${cls} tx-orig" hidden lang="${lang === "bg" ? "" : "bg"}">${FMT.p(s)}</div>
    <button type="button" class="tx-note" data-tx-toggle ${r.pending ? `data-tx-wait="${hash(s)}" hidden` : ""}><span>${NOTE()[0]}</span> · <u>${NOTE()[1]}</u></button></div>`;
}
const NOTE = () => [t("Преведено автоматично"), t("Покажи оригинала"), t("Покажи превода")];

// Swap translations into the page as they arrive, and handle the original/translation switch.
export function bindTranslations(root = document) {
  document.addEventListener("delim:translated", e => {
    const { key, lang } = e.detail;
    if (lang !== getLang()) return;
    root.querySelectorAll(`[data-tx="${key}"]`).forEach(el => {
      const r = lookup(el.dataset.src, lang);
      if (r.auto) { el.innerHTML = FMT[el.dataset.txf || "i"](r.text); el.removeAttribute("data-tx"); }
    });
    root.querySelectorAll(`[data-tx-wait="${key}"]`).forEach(b => { b.hidden = false; b.removeAttribute("data-tx-wait"); });
  });
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-tx-toggle]");
    if (!b) return;
    const w = b.closest(".tx-wrap"), [tr, orig] = w.children;
    const showOrig = orig.hidden;
    orig.hidden = !showOrig; tr.hidden = showOrig;
    b.querySelector("u").textContent = NOTE()[showOrig ? 2 : 1];
  });
}

// For tests.
export const _internal = { chunks, needs, hash, reset: () => { stopped = false; waiting.clear(); cache = {}; } };
