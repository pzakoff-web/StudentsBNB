import test from "node:test";
import assert from "node:assert/strict";
import { translit, lookup, nm, _internal } from "../js/translate.js";
import { setLang } from "../js/i18n.js";
import { buildSeed } from "../js/data/seed.js";

test("names are transliterated by the official Bulgarian system", () => {
  assert.equal(translit("Александър Петров"), "Aleksandar Petrov");
  assert.equal(translit("Лъчезар Димов"), "Lachezar Dimov");
  assert.equal(translit("Цветелина Русева"), "Tsvetelina Ruseva");
  assert.equal(translit("Жана Михайлова"), "Zhana Mihaylova");
  assert.equal(translit("Щерю Юсеинов"), "Shteryu Yuseinov");
  assert.equal(translit("Мария"), "Maria");
  setLang("bg"); assert.equal(nm("Иван"), "Иван");
  setLang("en"); assert.equal(nm("Иван"), "Ivan");
  setLang("bg");
});

test("every piece of demo content has a ready English and German translation", () => {
  const db = buildSeed();
  const texts = new Set();
  for (const u of db.users) { if (u.bio) texts.add(u.bio); if (u.faculty) texts.add(u.faculty); }
  for (const l of db.listings) { texts.add(l.title); texts.add(l.description); }
  for (const r of db.reviews) texts.add(r.text);
  for (const th of db.threads) for (const m of th.messages) texts.add(m.text);
  for (const s of db.savedSearches) texts.add(s.name);
  for (const g of db.groups) texts.add(g.name);
  for (const lang of ["en", "de"]) {
    const missing = [...texts].filter(s => !lookup(s, lang).auto);
    assert.deepEqual(missing, [], `${lang}: no ready translation`);
  }
  assert.equal(lookup(db.listings[0].title, "bg").auto, false, "Bulgarian readers see the original");
});

test("long texts are split for the translation service without losing anything", () => {
  const long = ("Изречение номер едно е тук. ").repeat(40) + "\n\nВтори абзац.";
  const parts = _internal.chunks(long);
  assert.ok(parts.every(p => p.length <= 450));
  assert.equal(parts.join(""), long);
  assert.equal(_internal.needs("PlayStation", "en"), false);
  assert.equal(_internal.needs("Стая", "de"), true);
});
