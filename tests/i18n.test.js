import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dictionaries, t, setLang, plural, detectLang } from "../js/i18n.js";
import { fmtMonths, fmtDate, eur } from "../js/logic.js";

const keys = JSON.parse(execFileSync("python3", ["scripts/i18n-keys.py"], { encoding: "utf-8" }));
const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");

for (const [lang, dict] of Object.entries(dictionaries())) {
  test(`${lang}: every key used in the code is translated`, () => {
    const missing = keys.filter(k => !(k in dict));
    assert.deepEqual(missing, []);
  });
  test(`${lang}: translations keep the same {placeholders}`, () => {
    const bad = keys.filter(k => k in dict && holes(k) !== holes(dict[k]));
    assert.deepEqual(bad, []);
  });
}

test("language switching and formatting", () => {
  setLang("en");
  assert.equal(t("Запази"), "Save");
  assert.equal(t("{n} мин до {uni}", { n: 12, uni: "UE" }), "12 min to UE");
  assert.equal(plural(3, "обява", "обяви"), "3 listings");
  assert.equal(fmtMonths(24), "2 years");
  assert.equal(eur(32.5), "€32.50");
  assert.equal(fmtDate("2026-10-01", new Date("2026-09-29T12:00:00Z")), "1 October");
  setLang("de");
  assert.equal(t("Запази"), "Speichern");
  assert.equal(eur(32.5), "€32,50");
  assert.equal(fmtDate("2026-10-01", new Date("2026-09-29T12:00:00Z")), "1. Oktober");
  setLang("bg");
  assert.equal(t("Запази"), "Запази");
  assert.equal(fmtDate("2026-10-01", new Date("2026-09-29T12:00:00Z")), "1 октомври");
  assert.equal(detectLang(""), "bg");
  assert.equal(detectLang("xx"), "bg");
  assert.equal(detectLang("en"), "en");
});
