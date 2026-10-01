// UI state that survives reloads for this viewer only: search filters, chosen university, language.
import { DEFAULT_FILTERS } from "./logic.js";
import { detectLang, setLang } from "./i18n.js";
import * as store from "./store.js";

const KEY = "delim:ui:v1";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* private mode */ }

export const S = {
  filters: { ...DEFAULT_FILTERS, ...(saved.filters || {}) },
  uniId: saved.uniId || "",
  lang: setLang(detectLang(saved.lang)),
  showMap: false,
  inBounds: false,
};

export function saveUI() {
  try { localStorage.setItem(KEY, JSON.stringify({ filters: S.filters, uniId: S.uniId, lang: S.lang })); } catch { /* ignore */ }
}

export function changeLang(l) {
  S.lang = setLang(l); saveUI();
  document.documentElement.lang = S.lang;
}

export const currentUni = () => S.uniId || store.me()?.university || "IU";

export function activeFilterCount(f = S.filters) {
  let n = 0;
  if (f.type) n++; if (f.minPrice || f.maxPrice) n++; if (f.maxCommute) n++; if (f.stay) n++; if (f.moveIn) n++;
  n += f.amenities.length; if (f.verifiedOnly) n++; if (f.consentOnly) n++; if (f.minRating) n++; if (f.showAllGenders) n++;
  return n;
}
