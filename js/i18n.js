// Tiny i18n. Bulgarian source strings are the keys, so untranslated text falls back to Bulgarian.
// Placeholders use {name}. Pure module: no DOM, usable from tests.
import EN from "./i18n/en.js";
import DE from "./i18n/de.js";

export const LANGS = { bg: "Български", en: "English", de: "Deutsch" };
export const LOCALES = { bg: "bg-BG", en: "en-GB", de: "de-DE" };
const DICT = { en: EN, de: DE };
let lang = "bg";

export const getLang = () => lang;
export const locale = () => LOCALES[lang];
export function setLang(l) { if (LANGS[l]) lang = l; return lang; }

// Bulgarian unless the person picked another language: the site is for Varna, and a phone
// set to English shouldn't make a Bulgarian student think the site changed.
export function detectLang(saved) {
  return LANGS[saved] ? saved : "bg";
}

export function t(s, vars) {
  let out = (lang !== "bg" && DICT[lang]?.[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

// "1 обява" / "5 обяви" — both forms are translation keys.
export const plural = (n, one, many) => `${n} ${n === 1 ? t(one) : t(many)}`;

// For tests: every key used in code must exist in each dictionary.
export const dictionaries = () => DICT;
