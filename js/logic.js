// Pure domain logic: no DOM, no storage. Covered by tests/logic.test.js.
import { UNIVERSITIES, uniById } from "./data/places.js";
import { commuteMin, seaDistanceM } from "./geo.js";

export const AMENITIES = {
  furnished: ["Обзаведено", "sofa"],
  wifi: ["Интернет", "wifi"],
  washer: ["Пералня", "washing-machine"],
  ac: ["Климатик", "snowflake"],
  heating: ["Отопление", "heater"],
  kitchen: ["Оборудвана кухня", "utensils"],
  balcony: ["Балкон", "sun"],
  desk: ["Бюро за учене", "book-open"],
  dishwasher: ["Съдомиялна", "sparkles"],
  elevator: ["Асансьор", "layers"],
  parking: ["Паркомясто", "car"],
  pets: ["Може с домашен любимец", "paw-print"],
  tv: ["Телевизор", "tv"],
  bath: ["Вана", "bath"],
};

export const REVIEW_CATS = {
  clean: "Чистота", comm: "Комуникация", accuracy: "Точност на обявата", location: "Местоположение", value: "Цена/качество",
};

export const GENDER_PREF = { m: "Търси мъж", f: "Търси жена", any: "Без значение" };
export const TYPE_LABEL = { room: "Стая при студент", whole: "Цяло жилище" };

export const pricePerPerson = l => Math.round(l.rent / l.occupants + l.util / l.occupants);

export function priceSplit(l) {
  const n = l.occupants;
  return { rent: l.rent / n, util: l.util / n, total: l.rent / n + l.util / n, perPerson: pricePerPerson(l) };
}

// Scoring from the product spec. Weights are placeholders until real match data exists.
export function compatWith(me, other) {
  const why = []; let s = 100;
  if (other.smoke !== me.smoke) { s -= 25; why.push(["n", other.smoke ? "Пуши вкъщи, а ти не" : "Не пуши, а ти пушиш"]); }
  else why.push(["y", other.smoke ? "И двамата пушите" : "И двамата не пушите"]);
  if (other.sleep !== me.sleep) { s -= 15; why.push(["n", "Различен режим на сън"]); }
  else why.push(["y", other.sleep === "early" ? "И двамата лягате рано" : "И двамата лягате късно"]);
  const dc = Math.abs(other.clean - me.clean); s -= dc * 12;
  why.push([dc ? "n" : "y", dc ? "Различни разбирания за чистота" : "Сходни разбирания за чистота"]);
  const dg = Math.abs(other.guests - me.guests); s -= dg * 9;
  why.push([dg ? "n" : "y", dg ? "Различно отношение към гостите" : "Сходно отношение към гостите"]);
  return { score: Math.max(20, s), why };
}

// Compatibility with everyone already living in the flat. Whole-flat listings have no residents.
export function listingCompat(listing, me, userById) {
  if (!me || listing.type !== "room" || listing.hostId === me.id) return null;
  const per = listing.residents.map(userById).filter(Boolean).map(u => ({ user: u, ...compatWith(me, u) }));
  if (!per.length) return null;
  return { score: Math.round(per.reduce((a, p) => a + p.score, 0) / per.length), per };
}

export function avg(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

export function ratingSummary(reviews) {
  const overall = avg(reviews.map(r => r.stars));
  const cats = {};
  for (const k in REVIEW_CATS) {
    const v = reviews.map(r => r.cats?.[k]).filter(x => x != null);
    cats[k] = avg(v);
  }
  return { overall, count: reviews.length, cats };
}

export const isStudentFavourite = rs => rs.count >= 5 && rs.overall >= 4.85;

export const fmtRating = x => x == null ? "" : x.toFixed(2).replace(/0$/, "").replace(".", ",");

// ---------- search ----------
const LAT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",
  с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sht",ъ:"a",ь:"y",ю:"yu",я:"ya" };
export const normalize = s => String(s || "").toLowerCase().replace(/[„“"'.,()]/g, " ")
  .replace(/[а-я]/g, c => LAT[c] ?? c).replace(/\s+/g, " ").trim();

// Deliberately excludes the street address: searching by street would leak the location.
export function haystack(l, userById) {
  const host = userById(l.hostId);
  const uni = host && uniById(host.university);
  return normalize([l.title, l.description, l.district, TYPE_LABEL[l.type],
    ...l.amenities.map(a => AMENITIES[a]?.[0]), host?.name, uni?.short, uni?.name].join(" "));
}

export function matchesQuery(l, q, userById) {
  const tokens = normalize(q).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const h = haystack(l, userById);
  return tokens.every(t => h.includes(t));
}

export const CATEGORIES = [
  { id: "all", label: "Всички", icon: "house" },
  { id: "room", label: "Стаи при студенти", icon: "door-open" },
  { id: "whole", label: "Цели жилища", icon: "building-2" },
  { id: "match", label: "Високо съвпадение", icon: "users" },
  { id: "close", label: "До 15 мин от уни", icon: "graduation-cap" },
  { id: "sea", label: "До морето", icon: "waves" },
  { id: "loved", label: "Любими на студентите", icon: "trophy" },
  { id: "budget", label: "До €280", icon: "wallet" },
  { id: "balcony", label: "С балкон", icon: "sun" },
  { id: "quiet", label: "Тихи квартири", icon: "moon" },
  { id: "pets", label: "С любимец", icon: "paw-print" },
  { id: "new", label: "Нови", icon: "sparkles" },
];

export const DEFAULT_FILTERS = {
  q: "", category: "all", type: "", minPrice: 0, maxPrice: 0, maxCommute: 0, stay: 0, moveIn: "",
  amenities: [], verifiedOnly: false, consentOnly: false, minRating: 0, showAllGenders: false, sort: "recommended",
};

// Returns enriched rows {l, pp, commute, compat, rating} that pass the filters, sorted.
export function search(listings, f, ctx) {
  const { me, uniId, userById, reviewsFor, now = new Date() } = ctx;
  const uni = uniById(uniId) || UNIVERSITIES[0];
  const rows = [];
  for (const l of listings) {
    if (l.status !== "active") continue;
    const own = me && l.hostId === me.id;
    if (!own && !f.showAllGenders && me?.gender && l.genderPref !== "any" && l.genderPref !== me.gender) continue;
    if (f.type && l.type !== f.type) continue;
    const pp = pricePerPerson(l);
    if (f.maxPrice && pp > f.maxPrice) continue;
    if (f.minPrice && pp < f.minPrice) continue;
    const commute = commuteMin(l.approx, uni);
    if (f.maxCommute && commute > f.maxCommute) continue;
    if (f.stay && l.minMonths > f.stay) continue;
    if (f.moveIn && l.availableFrom > f.moveIn) continue;
    if (f.amenities.length && !f.amenities.every(a => l.amenities.includes(a))) continue;
    if (f.verifiedOnly && !userById(l.hostId)?.emailVerified) continue;
    if (f.consentOnly && l.type === "room" && !l.landlordConsent) continue;
    if (!matchesQuery(l, f.q, userById)) continue;
    const rating = ratingSummary(reviewsFor(l.id));
    if (f.minRating && !(rating.overall >= f.minRating)) continue;
    const compat = listingCompat(l, me, userById);
    const row = { l, pp, commute, compat, rating };
    if (!inCategory(row, f.category, userById, now)) continue;
    rows.push(row);
  }
  return sortRows(rows, f.sort);
}

function inCategory({ l, pp, commute, compat, rating }, cat, userById, now) {
  switch (cat) {
    case "room": case "whole": return l.type === cat;
    case "match": return !!compat && compat.score >= 80;
    case "close": return commute <= 15;
    case "sea": return seaDistanceM(l.approx) <= 900;
    case "loved": return isStudentFavourite(rating);
    case "budget": return pp <= 280;
    case "balcony": return l.amenities.includes("balcony");
    case "pets": return l.amenities.includes("pets");
    case "quiet": return l.type === "room" && l.residents.map(userById).every(u => u && u.sleep === "early" && u.guests <= 2);
    case "new": return now - new Date(l.createdAt) < 14 * 864e5;
    default: return true;
  }
}

export function sortRows(rows, sort) {
  const by = {
    price: (a, b) => a.pp - b.pp,
    commute: (a, b) => a.commute - b.commute || a.pp - b.pp,
    rating: (a, b) => (b.rating.overall ?? 0) - (a.rating.overall ?? 0) || b.rating.count - a.rating.count,
    newest: (a, b) => b.l.createdAt.localeCompare(a.l.createdAt),
    recommended: (a, b) => (b.compat?.score ?? 70) - (a.compat?.score ?? 70) || a.commute - b.commute,
  }[sort] || (() => 0);
  return rows.slice().sort(by);
}

// ---------- formatting ----------
const MONTHS = ["януари","февруари","март","април","май","юни","юли","август","септември","октомври","ноември","декември"];
export function fmtDate(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (d <= now) return "веднага";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}` + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "");
}
export const fmtMonthYear = iso => { const d = new Date(iso); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtMonths = n => n >= 12 && n % 12 === 0 ? (n === 12 ? "1 година" : `${n / 12} години`) : `${n} месеца`;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const eur = v => { const r = Math.round(v * 100) / 100;
  return "€" + r.toLocaleString("bg-BG", { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
