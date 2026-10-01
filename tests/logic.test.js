import { test } from "node:test";
import assert from "node:assert/strict";
import { pricePerPerson, priceSplit, compatWith, listingCompat, search, normalize, DEFAULT_FILTERS, ratingSummary, isTopRated, fmtMonths } from "../js/logic.js";
import { distanceM, approximate, commuteMin, PRIVACY_RADIUS_M, nearestDistrict } from "../js/geo.js";
import { buildSeed, rng } from "../js/data/seed.js";
import { UNIVERSITIES } from "../js/data/places.js";
import * as store from "../js/store.js";

const NOW = new Date("2026-09-29T12:00:00Z");

test("canonical case: €600 rent + €65 utilities for 2 → €333 per person", () => {
  const l = { rent: 600, util: 65, occupants: 2 };
  assert.equal(pricePerPerson(l), 333);
  assert.equal(priceSplit(l).total, 332.5);
});

test("compatibility follows the spec penalties and floor", () => {
  const me = { smoke: 0, sleep: "late", clean: 2, guests: 2 };
  assert.equal(compatWith(me, { ...me }).score, 100);
  assert.equal(compatWith(me, { smoke: 1, sleep: "early", clean: 2, guests: 2 }).score, 60);
  assert.equal(compatWith(me, { smoke: 0, sleep: "late", clean: 3, guests: 3 }).score, 100 - 12 - 9);
  assert.equal(compatWith({ smoke: 0, sleep: "late", clean: 1, guests: 1 }, { smoke: 1, sleep: "early", clean: 3, guests: 3 }).score, 20);
});

test("privacy circle always contains the real address", () => {
  const r = rng(1);
  const p = { lat: 43.2141, lng: 27.9147 };
  for (let i = 0; i < 2000; i++) assert.ok(distanceM(p, approximate(p, r)) < PRIVACY_RADIUS_M);
});

test("commute estimate grows with distance and stays plausible", () => {
  const iu = UNIVERSITIES[0], vsu = UNIVERSITIES.find(u => u.id === "VSU");
  assert.ok(commuteMin(iu, iu) <= 5);
  assert.ok(commuteMin(iu, vsu) > 25 && commuteMin(iu, vsu) < 60);
});

test("search normalizes Latin and Cyrillic", () => {
  assert.equal(normalize("Младост"), "mladost");
  assert.equal(normalize("Чайка"), normalize("chayka"));
});

test("seed data is consistent", () => {
  const db = buildSeed(NOW);
  const ids = new Set(db.users.map(u => u.id));
  assert.ok(db.listings.length >= 30);
  for (const l of db.listings) {
    assert.ok(ids.has(l.hostId), l.id + " host");
    l.residents.forEach(r => assert.ok(ids.has(r), l.id + " resident"));
    if (l.type === "room") assert.equal(l.residents.length, l.occupants - 1, l.id + " occupants");
    assert.ok(distanceM(l.exact, l.approx) < PRIVACY_RADIUS_M, l.id + " circle");
    assert.ok(distanceM(l.exact, { lat: 43.21, lng: 27.92 }) < 9000, l.id + " in Varna");
    assert.ok(l.photos.length >= 3, l.id + " photos");
  }
  for (const r of db.reviews) { assert.ok(ids.has(r.authorId)); assert.ok(r.stars >= 1 && r.stars <= 5); }
  const canon = db.listings[0];
  assert.equal(pricePerPerson(canon), 333);
  assert.equal(canon.genderPref, "m");
  assert.equal(canon.minMonths, 24);
  assert.equal(nearestDistrict(canon.exact), "Младост");
});

test("search filters: gender, stay, price, category, query", () => {
  const db = buildSeed(NOW);
  const byId = id => db.users.find(u => u.id === id);
  const ctx = { me: byId(db.currentUserId), uniId: "IU", userById: byId, reviewsFor: id => db.reviews.filter(r => r.listingId === id), now: NOW };
  const all = search(db.listings, DEFAULT_FILTERS, ctx);
  assert.ok(all.every(r => r.l.genderPref !== "f"), "male user sees no female-only rooms");
  assert.ok(search(db.listings, { ...DEFAULT_FILTERS, showAllGenders: true }, ctx).length > all.length);
  assert.ok(search(db.listings, { ...DEFAULT_FILTERS, stay: 6 }, ctx).every(r => r.l.minMonths <= 6));
  assert.ok(search(db.listings, { ...DEFAULT_FILTERS, maxPrice: 300 }, ctx).every(r => r.pp <= 300));
  assert.ok(search(db.listings, { ...DEFAULT_FILTERS, category: "whole" }, ctx).every(r => r.l.type === "whole"));
  const q = search(db.listings, { ...DEFAULT_FILTERS, q: "mladost" }, ctx);
  assert.ok(q.length && q.every(r => r.l.district === "Младост" || /младост/i.test(r.l.title + r.l.description)));
  assert.equal(search(db.listings, { ...DEFAULT_FILTERS, q: db.listings[0].address.split("„")[1].split("“")[0] + " zzz" }, ctx).length, 0, "address is not searchable");
  const recommended = search(db.listings, DEFAULT_FILTERS, ctx);
  const scores = recommended.map(r => r.compat?.score ?? 70);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("whole-flat listings have no compatibility score", () => {
  const db = buildSeed(NOW);
  const byId = id => db.users.find(u => u.id === id);
  const whole = db.listings.find(l => l.type === "whole");
  assert.equal(listingCompat(whole, byId(db.currentUserId), byId), null);
});

test("ratings and student-favourite badge", () => {
  const rs = ratingSummary([5, 5, 5, 5, 4.9].map(s => ({ stars: s, cats: { clean: s } })));
  assert.ok(isTopRated(rs));
  assert.ok(!isTopRated(ratingSummary([{ stars: 5 }])));
  assert.equal(fmtMonths(24), "2 години");
});

test("store: create, edit, privacy, favourites, threads", () => {
  const mem = new Map();
  store.initStore({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
  const exact = { lat: 43.2236, lng: 27.9215 };
  const l = store.createListing({ type: "room", title: "Тестова стая в Левски", description: "x".repeat(50), district: "Левски", address: "ул. Тест 1",
    exact, rent: 500, util: 60, occupants: 2, genderPref: "any", minMonths: 12, availableFrom: "2026-10-01", rooms: 2, area: 55, floor: 3,
    amenities: [], photos: [], deposit: 250, landlordConsent: true });
  assert.ok(distanceM(l.approx, exact) < PRIVACY_RADIUS_M);
  assert.deepEqual(l.residents, [store.me().id]);
  assert.ok(store.canSeeAddress(l), "owner sees the address");
  const approx = { ...l.approx };
  store.updateListing(l.id, { exact: { lat: exact.lat + 0.00005, lng: exact.lng } });
  assert.deepEqual(store.listing(l.id).approx, approx, "tiny move keeps the same circle");
  assert.ok(store.toggleFavorite(l.id));
  assert.ok(store.isFav(l.id));
  const other = store.users().find(u => u.id !== store.me().id && u.role === "student");
  const myId = store.me().id;
  store.switchUser(other.id);
  assert.ok(!store.canSeeAddress(store.listing(l.id)), "others see only the circle");
  const t = store.openThread(l.id);
  t.phoneShare[other.id] = true; t.phoneShare[myId] = true;
  assert.ok(store.canSeeAddress(store.listing(l.id)), "mutual sharing reveals the address");
  store.switchUser(myId);
  store.deleteListing(l.id);
  assert.equal(store.listing(l.id), null);
  assert.ok(!store.me().favorites.includes(l.id));
  assert.ok(JSON.parse(mem.get("delim:db")).listings.length > 0, "persisted");
});

test("migration v1 → v2 keeps user data and adds new collections", async () => {
  const { migrate, DB_VERSION } = await import("../js/store.js");
  const old = { version: 1, users: [{ id: "x" }], listings: [{ id: "mine" }], reviews: [], threads: [] };
  const m = migrate(structuredClone(old));
  assert.equal(m.version, DB_VERSION);
  assert.deepEqual(m.listings, old.listings);
  assert.deepEqual([m.savedSearches, m.notifications, m.groups], [[], [], []]);
});

test("store: old v1 data is migrated, not wiped", () => {
  const mem = new Map();
  const v1 = buildSeed(NOW); v1.version = 1; delete v1.savedSearches; delete v1.notifications; delete v1.groups; delete v1.seedVersion;
  v1.listings[0].title = "Моята редакция";
  mem.set("delim:db:v1", JSON.stringify(v1));
  store.initStore({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) });
  assert.equal(store.listing("l1").title, "Моята редакция");
  assert.equal(store.startupNotice(), "migrated");
  assert.ok(!mem.has("delim:db:v1") && mem.has("delim:db"));
});

test("fair price compares with the district median", async () => {
  const { fairPrice, isGoodDeal } = await import("../js/logic.js");
  const mk = (id, rent, district = "Левски") => ({ id, type: "room", status: "active", district, rent, util: 0, occupants: 2 });
  const ls = [mk("a", 600), mk("b", 640), mk("c", 680), mk("d", 500)];
  const f = fairPrice(ls[3], ls);
  assert.equal(f.median, 320);
  assert.equal(f.diff, -70);
  assert.equal(f.scope, "district");
  assert.ok(isGoodDeal(f));
  assert.equal(fairPrice(mk("z", 500, "Бриз"), [mk("y", 500, "Бриз")]), null, "too few listings to compare");
});

test("saved search notifies on a matching new listing only", () => {
  const mem = new Map();
  store.initStore({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: () => {} });
  const seeker = store.me();
  const before = store.notifications(seeker.id).length;
  const host = store.users().find(u => u.role === "student" && u.id !== seeker.id && u.gender === "m");
  store.switchUser(host.id);
  const base = { description: "x".repeat(50), district: "Левски", address: "ул. Тест 1", exact: { lat: 43.2236, lng: 27.9215 },
    util: 50, occupants: 2, genderPref: "any", minMonths: 12, availableFrom: "2026-10-01", rooms: 2, area: 55, floor: 3, amenities: [], photos: [], deposit: 250, landlordConsent: true };
  store.createListing({ ...base, type: "room", title: "Евтина стая", rent: 500 });   // €275 → matches "rooms up to €350"
  store.createListing({ ...base, type: "room", title: "Скъпа стая", rent: 900 });    // €475 → no
  store.switchUser(seeker.id);
  const fresh = store.notifications(seeker.id).slice(0, store.notifications(seeker.id).length - before);
  assert.equal(fresh.length, 1);
  assert.equal(store.listing(fresh[0].listingId).title, "Евтина стая");
});

test("groups: budget is the tightest member budget; one group per person", () => {
  const mem = new Map();
  store.initStore({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: () => {} });
  const g = store.group("g1");
  const members = store.groupMembers(g);
  assert.equal(members.length, 3);
  assert.equal(store.groupBudget(g), Math.min(...members.map(u => u.budget)));
  const me = store.me();
  const mine = store.createGroup("Тест");
  assert.equal(store.groupOf(me.id).id, mine.id);
  store.switchUser(members[1].id);
  store.leaveGroup("g1");
  assert.equal(store.groupMembers(store.group("g1")).length, 2);
});
