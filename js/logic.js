// Pure domain logic: no DOM, no storage. Covered by tests/logic.test.js.
import { uniById, districtName, unisByIds } from "./data/places.js";
import { seaDistanceM, nearestUni } from "./geo.js";
import { t, plural, getLang, locale } from "./i18n.js";
import { plain } from "./translate.js";

export { plural };

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
  if (other.smoke !== me.smoke) { s -= 25; why.push(["n", t(other.smoke ? "Пуши вкъщи, а ти не" : "Не пуши, а ти пушиш")]); }
  else why.push(["y", t(other.smoke ? "И двамата пушите" : "И двамата не пушите")]);
  if (other.sleep !== me.sleep) { s -= 15; why.push(["n", t("Различен режим на сън")]); }
  else why.push(["y", t(other.sleep === "early" ? "И двамата лягате рано" : "И двамата лягате късно")]);
  const dc = Math.abs(other.clean - me.clean); s -= dc * 12;
  why.push([dc ? "n" : "y", t(dc ? "Различни разбирания за чистота" : "Сходни разбирания за чистота")]);
  const dg = Math.abs(other.guests - me.guests); s -= dg * 9;
  why.push([dg ? "n" : "y", t(dg ? "Различно отношение към гостите" : "Сходно отношение към гостите")]);
  return { score: Math.max(20, s), why };
}

// Average pairwise compatibility inside a group of people.
export function groupCompat(people) {
  const scores = [];
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) scores.push(compatWith(people[i], people[j]).score);
  return scores.length ? Math.round(avg(scores)) : null;
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

export const isTopRated = rs => rs.count >= 5 && rs.overall >= 4.85;

export const fmtRating = x => x == null ? "" : x.toFixed(2).replace(/0$/, "").replace(".", getLang() === "en" ? "." : ",");

// ---------- fair price ----------
const median = xs => { const a = xs.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

// Compares a listing with others of the same type: same district when there are at least 3, else the whole city.
export function fairPrice(l, listings) {
  const others = listings.filter(o => o.id !== l.id && o.status === "active" && o.type === l.type);
  const near = others.filter(o => o.district === l.district);
  const pool = near.length >= 3 ? near : others.length >= 3 ? others : null;
  if (!pool) return null;
  const med = Math.round(median(pool.map(pricePerPerson)));
  const pp = pricePerPerson(l);
  return { median: med, diff: pp - med, pct: (pp - med) / med, scope: pool === near ? "district" : "city", n: pool.length };
}

export function fairLabel(f, district) {
  if (!f) return "";
  const where = f.scope === "district" ? t("за {d}", { d: districtName(district) }) : t("за града");
  if (Math.abs(f.pct) < 0.05) return t("Около средното {where} (€{m})", { where, m: f.median });
  return f.diff < 0 ? t("€{d} под средното {where} (€{m})", { d: -f.diff, where, m: f.median })
    : t("€{d} над средното {where} (€{m})", { d: f.diff, where, m: f.median });
}
export const isGoodDeal = f => !!f && f.pct <= -0.08;

// ---------- search ----------
const LAT = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",
  с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sht",ъ:"a",ь:"y",ю:"yu",я:"ya" };
export const normalize = s => String(s || "").toLowerCase().replace(/[„“"'.,()]/g, " ")
  .replace(/[а-я]/g, c => LAT[c] ?? c).replace(/\s+/g, " ").trim();

// Deliberately excludes the street address: searching by street would leak the location.
export function haystack(l, userById) {
  const host = userById(l.hostId);
  const uni = host && uniById(host.university);
  return normalize([l.title, l.description, plain(l.title), plain(l.description), l.district, districtName(l.district), TYPE_LABEL[l.type], t(TYPE_LABEL[l.type]),
    ...l.amenities.flatMap(a => AMENITIES[a] ? [AMENITIES[a][0], t(AMENITIES[a][0])] : []), host?.name, uni?.short, uni?.shortLat, uni?.name, uni?.nameEn].join(" "));
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
  { id: "group", label: "За групата ни", icon: "users" },
  { id: "fair", label: "Изгодни", icon: "wallet" },
  { id: "loved", label: "Топ оценка", icon: "trophy" },
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
  const { me, userById, reviewsFor, now = new Date(), groupSize = 0 } = ctx;
  // Travel time is to the closest of the chosen universities; [] means all of them.
  const unis = unisByIds(ctx.uniIds ?? (ctx.uniId ? [ctx.uniId] : []));
  const rows = [];
  for (const l of listings) {
    if (l.status !== "active") continue;
    const own = me && l.hostId === me.id;
    if (!own && !f.showAllGenders && me?.gender && l.genderPref !== "any" && l.genderPref !== me.gender) continue;
    if (f.type && l.type !== f.type) continue;
    const pp = pricePerPerson(l);
    if (f.maxPrice && pp > f.maxPrice) continue;
    if (f.minPrice && pp < f.minPrice) continue;
    const near = nearestUni(l.approx, unis), commute = near.min;
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
    const row = { l, pp, commute, commuteUni: near.uni, compat, rating };
    if (f.category === "fair") row.fair = fairPrice(l, listings);
    if (!inCategory(row, f.category, userById, now, groupSize)) continue;
    rows.push(row);
  }
  return sortRows(rows, f.sort);
}

function inCategory({ l, pp, commute, compat, rating, fair }, cat, userById, now, groupSize) {
  switch (cat) {
    case "group": return l.type === "whole" && groupSize >= 2 && l.occupants === groupSize;
    case "fair": return isGoodDeal(fair);
    case "room": case "whole": return l.type === cat;
    case "match": return !!compat && compat.score >= 80;
    case "close": return commute <= 15;
    case "sea": return seaDistanceM(l.approx) <= 900;
    case "loved": return isTopRated(rating);
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
export function fmtDate(iso, now = new Date()) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (d <= now) return t("веднага");
  const o = { day: "numeric", month: "long" };
  if (d.getFullYear() !== now.getFullYear()) o.year = "numeric";
  return d.toLocaleDateString(locale(), o).replace(/ г\.$/, "");
}
export const fmtMonthYear = iso => new Date(iso).toLocaleDateString(locale(), { month: "long", year: "numeric" }).replace(/ г\.$/, "");
export const fmtMonths = n => n >= 12 && n % 12 === 0 ? plural(n / 12, "година", "години") : plural(n, "месец", "месеца");
export const eur = v => { const r = Math.round(v * 100) / 100;
  return "€" + r.toLocaleString(locale(), { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
