// Data layer. Everything the views need goes through here, so this file is the only one
// to replace when a real backend arrives. Persists to localStorage.
import { buildSeed } from "./data/seed.js";
import { approximate, distanceM } from "./geo.js";

const KEY = "delim:db:v1";
let db = null;
let storage = null;
const subs = new Set();

export function initStore(s = globalThis.localStorage) {
  storage = s;
  try { db = JSON.parse(storage?.getItem(KEY) || "null"); } catch { db = null; }
  if (!db || db.version !== 1) { db = buildSeed(new Date()); persist(); }
  return db;
}

function persist() {
  try { storage?.setItem(KEY, JSON.stringify(db)); }
  catch (e) { console.warn("Записът не успя", e); }
}
function commit() { persist(); subs.forEach(f => f()); }
export const subscribe = f => (subs.add(f), () => subs.delete(f));

const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- reads ----------
export const me = () => db.users.find(u => u.id === db.currentUserId) || null;
export const user = id => db.users.find(u => u.id === id) || null;
export const users = () => db.users;
export const listing = id => db.listings.find(l => l.id === id) || null;
export const listings = () => db.listings;
export const reviewsFor = lid => db.reviews.filter(r => r.listingId === lid);
export const reviewsOfUser = id => db.reviews.filter(r => r.targetUserId === id);
export const listingsOf = id => db.listings.filter(l => l.hostId === id);
export const thread = id => db.threads.find(t => t.id === id) || null;
export const threadsOf = id => db.threads.filter(t => t.participants.includes(id))
  .sort((a, b) => (b.messages.at(-1)?.ts || "").localeCompare(a.messages.at(-1)?.ts || ""));
export const isFav = lid => !!me()?.favorites.includes(lid);

export function unreadCount(t, id = db.currentUserId) {
  const seen = t.readBy?.[id] || "";
  return t.messages.filter(m => m.from !== id && m.ts > seen).length;
}
export const totalUnread = () => threadsOf(db.currentUserId).reduce((a, t) => a + unreadCount(t), 0);

// The exact address is shown only to the owner, and to someone whose chat with the owner
// about this listing reached mutual contact sharing. Everyone else sees the 100 m circle.
export function canSeeAddress(l, viewer = me()) {
  if (!viewer) return false;
  if (l.hostId === viewer.id || l.residents.includes(viewer.id)) return true;
  return db.threads.some(t => t.listingId === l.id && t.participants.includes(viewer.id) && bothShared(t));
}
export const bothShared = t => t.participants.every(p => t.phoneShare?.[p]);

// ---------- writes ----------
export function switchUser(id) { db.currentUserId = id; commit(); }

export function updateUser(id, patch) {
  Object.assign(user(id), patch); commit();
}

export function toggleFavorite(lid) {
  const u = me(); if (!u) return false;
  const i = u.favorites.indexOf(lid);
  i >= 0 ? u.favorites.splice(i, 1) : u.favorites.push(lid);
  commit(); return i < 0;
}

export function createListing(data) {
  const u = me();
  const l = { ...data, id: uid("l"), hostId: u.id, residents: data.type === "room" ? [u.id] : [],
    approx: approximate(data.exact), status: "active", createdAt: new Date().toISOString(), views: 0 };
  db.listings.unshift(l); commit(); return l;
}

export function updateListing(id, patch) {
  const l = listing(id);
  // A new circle only when the address really moved, so repeated saves can't be averaged.
  if (patch.exact && distanceM(patch.exact, l.exact) > 25) patch = { ...patch, approx: approximate(patch.exact) };
  if (patch.type) patch.residents = patch.type === "room" ? (l.residents.length ? l.residents : [l.hostId]) : [];
  Object.assign(l, patch); commit(); return l;
}

export function deleteListing(id) {
  db.listings = db.listings.filter(l => l.id !== id);
  for (const u of db.users) u.favorites = u.favorites.filter(x => x !== id);
  commit();
}

export function addView(id) { const l = listing(id); if (l && l.hostId !== db.currentUserId) { l.views++; persist(); } }

export function addReview(r) {
  const rev = { ...r, id: uid("r"), authorId: db.currentUserId, date: new Date().toISOString().slice(0, 10) };
  db.reviews.unshift(rev); commit(); return rev;
}

export function openThread(listingId) {
  const l = listing(listingId), my = db.currentUserId;
  let t = db.threads.find(t => t.listingId === listingId && t.participants.includes(my));
  if (!t) { t = { id: uid("t"), listingId, participants: [my, l.hostId], phoneShare: {}, messages: [], readBy: {} }; db.threads.unshift(t); commit(); }
  return t;
}

// Person-to-person thread, e.g. writing to someone from "Търсят съквартирант".
export function openDirectThread(otherId) {
  const my = db.currentUserId;
  let t = db.threads.find(t => !t.listingId && t.participants.includes(my) && t.participants.includes(otherId));
  if (!t) { t = { id: uid("t"), listingId: null, participants: [my, otherId], phoneShare: {}, messages: [], readBy: {} }; db.threads.unshift(t); commit(); }
  return t;
}

export function markRead(tid) {
  const t = thread(tid); if (!t) return;
  const had = unreadCount(t) > 0;
  t.readBy ??= {}; t.readBy[db.currentUserId] = new Date().toISOString();
  had ? commit() : persist(); // commit refreshes badges; only when something changed, to avoid loops
}

const DIRECT_REPLIES = [
  "Здрасти! Благодаря, че писа. Да, още търся — разкажи ми повече.",
  "Хей! Звучи интересно. Кога можем да се видим за кафе и да поговорим?",
];
const REPLIES = [
  "Здрасти! Благодаря за съобщението. Стаята още е свободна — кога ти е удобно да минеш да я видиш?",
  "Здравей! Да, още търся. Можеш ли в четвъртък след 18:00? Ще ти покажа всичко на място.",
  "Хей! Звучи добре. Разкажи ми малко повече — за колко време търсиш?",
];

// Demo only: the other side answers once, so a single person can try the whole flow.
export function sendMessage(tid, text) {
  const t = thread(tid), my = db.currentUserId;
  t.messages.push({ from: my, text, ts: new Date().toISOString() });
  t.readBy ??= {}; t.readBy[my] = new Date().toISOString();
  commit();
  const other = t.participants.find(p => p !== my);
  if (!t.autoReplied && !t.messages.some(m => m.from === other)) {
    t.autoReplied = true; persist();
    setTimeout(() => {
      const pool = t.listingId ? REPLIES : DIRECT_REPLIES;
      t.messages.push({ from: other, text: pool[t.messages.length % pool.length], ts: new Date().toISOString() });
      commit();
    }, 1800);
  }
}

export function sharePhone(tid) {
  const t = thread(tid), my = db.currentUserId;
  t.phoneShare[my] = true;
  t.messages.push({ from: "system", text: `${me().name.split(" ")[0]} предложи да си размените телефоните.`, ts: new Date().toISOString() });
  commit();
  const other = t.participants.find(p => p !== my);
  if (!t.phoneShare[other]) setTimeout(() => { // demo: the other side accepts
    t.phoneShare[other] = true;
    t.messages.push({ from: "system", text: `${user(other).name.split(" ")[0]} прие. Телефоните и точният адрес вече се виждат.`, ts: new Date().toISOString() });
    commit();
  }, 1500);
}

export function resetDemo() { db = buildSeed(new Date()); commit(); }
