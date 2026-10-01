// Data layer. Everything the views need goes through here, so this file is the only one
// to replace when a real backend arrives. Persists to localStorage.
import { buildSeed, SEED_VERSION } from "./data/seed.js";
import { approximate, distanceM } from "./geo.js";
import { search, DEFAULT_FILTERS } from "./logic.js";

const KEY = "delim:db";
const LEGACY_KEYS = ["delim:db:v1"];
export const DB_VERSION = 2;
let db = null;
let storage = null;
let notice = null; // what happened to stored data at start-up, for a one-time message
const subs = new Set();

// Each step upgrades the stored shape by one version and keeps everything the person created.
const MIGRATIONS = {
  1: d => {
    d.savedSearches ??= []; d.notifications ??= []; d.groups ??= [];
    // Bring in the demo search, notification and group from v2, where those people still exist.
    const fresh = buildSeed(new Date()), has = id => d.users.some(u => u.id === id);
    d.savedSearches.push(...fresh.savedSearches.filter(s => has(s.userId)));
    d.notifications.push(...fresh.notifications.filter(n => has(n.userId) && d.listings.some(l => l.id === n.listingId)));
    d.groups.push(...fresh.groups.filter(g => g.members.every(m => has(m.userId))));
    for (const u of fresh.users) { const o = d.users.find(x => x.id === u.id); if (o && !o.budget && u.budget) o.budget = u.budget; }
    d.seedVersion = 2;
  },
};

export function migrate(d) {
  while ((d.version || 1) < DB_VERSION) {
    const v = d.version || 1;
    MIGRATIONS[v](d);
    d.version = v + 1;
  }
  return d;
}

export function initStore(s = globalThis.localStorage) {
  storage = s;
  let raw = null, key = KEY;
  try { raw = storage?.getItem(KEY); if (!raw) for (const k of LEGACY_KEYS) { raw = storage?.getItem(k); if (raw) { key = k; break; } } } catch { raw = null; }
  try { db = JSON.parse(raw || "null"); } catch { db = null; }
  if (!db || !Array.isArray(db.users)) { db = buildSeed(new Date()); notice = null; }
  else if ((db.version || 1) > DB_VERSION) { db = buildSeed(new Date()); notice = "reset"; }
  else {
    if ((db.version || 1) < DB_VERSION) { migrate(db); notice = "migrated"; }
    // Demo content changed in a new release: start from the new demo data.
    if ((db.seedVersion || 1) < SEED_VERSION) { db = buildSeed(new Date()); notice = "reseeded"; }
  }
  persist();
  if (key !== KEY) try { storage?.removeItem(key); } catch { /* ignore */ }
  return db;
}
export const startupNotice = () => { const n = notice; notice = null; return n; };

function persist() {
  try { storage?.setItem(KEY, JSON.stringify(db)); }
  catch (e) { console.warn("Записът не успя", e); }
}
function commit() { persist(); subs.forEach(f => f()); }
export const subscribe = f => (subs.add(f), () => subs.delete(f));

const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();

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
    approx: approximate(data.exact), status: "active", createdAt: now(), views: 0 };
  db.listings.unshift(l);
  notifyMatches(l);
  commit(); return l;
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
  db.notifications = db.notifications.filter(n => n.listingId !== id);
  commit();
}

export function addView(id) { const l = listing(id); if (l && l.hostId !== db.currentUserId) { l.views++; persist(); } }

export function addReview(r) {
  const rev = { ...r, id: uid("r"), authorId: db.currentUserId, date: now().slice(0, 10) };
  db.reviews.unshift(rev); commit(); return rev;
}

// ---------- saved searches & notifications ----------
export const savedSearches = (id = db.currentUserId) => db.savedSearches.filter(s => s.userId === id);

// Older saved searches have a single uniId.
export const searchUnis = s => s.uniIds ?? (s.uniId ? [s.uniId] : []);

export function saveSearch({ name, filters, uniIds }) {
  const s = { id: uid("s"), userId: db.currentUserId, name, filters: { ...DEFAULT_FILTERS, ...filters, sort: "recommended" }, uniIds, createdAt: now() };
  db.savedSearches.unshift(s); commit(); return s;
}
export function deleteSearch(id) {
  db.savedSearches = db.savedSearches.filter(s => s.id !== id);
  db.notifications = db.notifications.filter(n => n.searchId !== id);
  commit();
}

// A new listing is checked against everyone's saved searches, as that person would see it.
// In production this runs on the server and also sends an e-mail or push message.
export function matchingSearches(l) {
  const hits = [];
  for (const s of db.savedSearches) {
    if (s.userId === l.hostId) continue;
    const viewer = user(s.userId); if (!viewer) continue;
    const ok = search([l], s.filters, { me: viewer, uniIds: searchUnis(s), userById: user, reviewsFor }).length > 0;
    if (ok) hits.push(s);
  }
  return hits;
}
function notifyMatches(l) {
  for (const s of matchingSearches(l)) pushNotif(s.userId, { kind: "match", listingId: l.id, searchId: s.id, params: { search: s.name } });
}

function pushNotif(userId, n) { db.notifications.unshift({ id: uid("n"), userId, ts: now(), read: false, ...n }); }
export const notifications = (id = db.currentUserId) => db.notifications.filter(n => n.userId === id);
export const unreadNotifs = () => notifications().filter(n => !n.read).length;
export function markNotifsRead() {
  let changed = false;
  for (const n of notifications()) if (!n.read) { n.read = true; changed = true; }
  changed ? commit() : persist();
}

// ---------- groups for whole flats ----------
export const group = id => db.groups.find(g => g.id === id) || null;
export const groupOf = (id = db.currentUserId) => db.groups.find(g => g.members.some(m => m.userId === id && m.status === "accepted")) || null;
export const invitesFor = (id = db.currentUserId) => db.groups.filter(g => g.members.some(m => m.userId === id && m.status === "invited"));
export const groupMembers = g => g.members.filter(m => m.status === "accepted").map(m => user(m.userId)).filter(Boolean);
// The group can pay what its tightest budget allows.
export const groupBudget = g => { const b = groupMembers(g).map(u => u.budget).filter(Boolean); return b.length ? Math.min(...b) : 0; };

export function createGroup(name) {
  const g = { id: uid("g"), name, ownerId: db.currentUserId, createdAt: now(),
    members: [{ userId: db.currentUserId, status: "accepted" }] };
  db.groups.unshift(g); commit(); return g;
}

export function inviteToGroup(gid, userId) {
  const g = group(gid);
  if (g.members.some(m => m.userId === userId)) return;
  g.members.push({ userId, status: "invited" });
  pushNotif(userId, { kind: "invite", groupId: g.id, params: { who: me().name.split(" ")[0], group: g.name } });
  commit();
  // Demo only: the invited person accepts after a moment.
  setTimeout(() => respondInvite(g.id, userId, true), 1500);
}

export function respondInvite(gid, userId, accept) {
  const g = group(gid); if (!g) return;
  const m = g.members.find(x => x.userId === userId); if (!m || m.status !== "invited") return;
  if (accept) {
    db.groups.forEach(o => { if (o !== g) o.members = o.members.filter(x => x.userId !== userId); }); // one group at a time
    m.status = "accepted";
    for (const other of g.members) if (other.userId !== userId && other.status === "accepted")
      pushNotif(other.userId, { kind: "joined", groupId: g.id, params: { who: user(userId).name.split(" ")[0], group: g.name } });
  } else g.members = g.members.filter(x => x !== m);
  commit();
}

export function leaveGroup(gid) {
  const g = group(gid); if (!g) return;
  g.members = g.members.filter(m => m.userId !== db.currentUserId);
  if (!g.members.some(m => m.status === "accepted")) db.groups = db.groups.filter(x => x !== g);
  else if (g.ownerId === db.currentUserId) g.ownerId = g.members.find(m => m.status === "accepted").userId;
  commit();
}

// Sends one application for the whole group and tells the other members.
export function applyAsGroup(listingId, text, reply) {
  const g = groupOf(), l = listing(listingId);
  const t = openThread(listingId);
  t.groupId = g.id;
  sendMessage(t.id, text, reply);
  for (const m of groupMembers(g)) if (m.id !== db.currentUserId)
    pushNotif(m.id, { kind: "applied", listingId, groupId: g.id, params: { who: me().name.split(" ")[0], title: l.title } });
  commit();
  return t;
}

// ---------- chat ----------
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
  t.readBy ??= {}; t.readBy[db.currentUserId] = now();
  had ? commit() : persist(); // commit refreshes badges; only when something changed, to avoid loops
}

// Demo only: the other side answers once, so a single person can try the whole flow.
// `reply` picks the canned text in the viewer's language.
export function sendMessage(tid, text, reply) {
  const t = thread(tid), my = db.currentUserId;
  t.messages.push({ from: my, text, ts: now() });
  t.readBy ??= {}; t.readBy[my] = now();
  commit();
  const other = t.participants.find(p => p !== my);
  if (reply && !t.autoReplied && !t.messages.some(m => m.from === other)) {
    t.autoReplied = true; persist();
    setTimeout(() => { t.messages.push({ from: other, text: reply, ts: now() }); commit(); }, 1800);
  }
}

// System lines are stored as a key plus names, so each viewer reads them in their own language.
export function sharePhone(tid) {
  const t = thread(tid), my = db.currentUserId;
  t.phoneShare[my] = true;
  t.messages.push({ from: "system", key: "share-offer", params: { who: me().name.split(" ")[0] }, ts: now() });
  commit();
  const other = t.participants.find(p => p !== my);
  if (!t.phoneShare[other]) setTimeout(() => { // demo: the other side accepts
    t.phoneShare[other] = true;
    t.messages.push({ from: "system", key: "share-accept", params: { who: user(other).name.split(" ")[0] }, ts: now() });
    commit();
  }, 1500);
}

export function resetDemo() { db = buildSeed(new Date()); commit(); }
