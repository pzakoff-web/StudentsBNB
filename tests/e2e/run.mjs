// End-to-end check in a real browser: serves the repo, drives the main flows, fails on any page error.
// Run: npm run test:e2e   (needs Playwright with Chromium; in CI: npx playwright install --with-deps chromium)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const U = `http://127.0.0.1:${server.address().port}/`;

// A small PNG to upload as a photo.
function png(w = 320, h = 240) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = x; raw[o + 1] = y; raw[o + 2] = 180; }
  const tbl = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let r = 0xffffffff; for (const x of b) r = tbl[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = path.join(os.tmpdir(), "delim-e2e.png");
fs.writeFileSync(PNG, png());

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log("  ✓", msg); } else { failed++; console.log("  ✗", msg); } };

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await pw.chromium.launch({ args: proxy ? ["--proxy-server=https=" + proxy.replace(/^https?:\/\//, "")] : [] });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, locale: "bg-BG" });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  // Map tiles and fonts come from the internet; the app must work without them.
  await p.route(/tile\.openstreetmap\.org|fonts\.(googleapis|gstatic)\.com|nominatim/, r => r.abort());
  // Machine translation is stubbed: "[en] " + the text, and the requests are counted.
  p.txCalls = [];
  await p.route(/api\.mymemory\.translated\.net/, r => {
    const u = new URL(r.request().url()), q = u.searchParams.get("q"), to = u.searchParams.get("langpair").split("|")[1];
    p.txCalls.push(q);
    r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: `[${to}] ${q}` } }) });
  });
  return { ctx, p };
}
const store = (p, fn, ...args) => p.evaluate(async ([f, a]) => { const s = await import("/js/store.js"); return s[f](...a); }, [fn, args]);

try {
  // ---------------- desktop ----------------
  const { p } = await newPage({ width: 1366, height: 900 });
  console.log("Desktop");
  await p.goto(U); await p.waitForSelector("#grid .card");
  const n0 = await p.locator("#grid .card").count();
  await p.fill("#sbQ", "chayka"); await p.press("#sbQ", "Enter"); await p.waitForTimeout(200);
  const metas = await p.locator("#grid .card .card-meta").allTextContents();
  ok(metas.length > 0 && metas.length < n0 && metas.every(m => m.includes("Чайка")), `Latin search "chayka" finds ${metas.length} listings in Чайка`);
  await p.click("#clearQ"); await p.waitForSelector("#grid .card");

  // filters + focus trap
  await p.click("#fBtn"); await p.waitForSelector(".modal");
  for (let i = 0; i < 70; i++) await p.keyboard.press("Tab");
  ok(await p.evaluate(() => !!document.activeElement.closest(".modal")), "keyboard focus stays inside the filters dialog");
  await p.locator("#fMax").fill("300"); await p.locator("#fMax").dispatchEvent("input");
  await p.click("#fGo"); await p.waitForTimeout(300);
  const prices = (await p.locator("#grid .card .card-price mark").allTextContents()).map(s => +s.replace("€", ""));
  ok(prices.length && prices.every(x => x <= 300), `price filter keeps ${prices.length} listings ≤ €300`);
  await p.click("#fBtn"); await p.click("#fClear"); await p.waitForSelector("#grid .card");

  // back keeps the scroll position
  await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(150);
  const y0 = await p.evaluate(() => scrollY);
  const target = await p.evaluate(() => [...document.querySelectorAll("#grid .card")].find(c => c.getBoundingClientRect().top > 80)?.dataset.id);
  await p.click(`#grid .card[data-id="${target}"] h3`); await p.waitForSelector(".lp-title");
  await p.goBack(); await p.waitForSelector("#grid .card"); await p.waitForTimeout(300);
  const y1 = await p.evaluate(() => scrollY);
  ok(Math.abs(y1 - y0) < 60, `"back" returns to the same place in the list (${y0} → ${y1})`);

  // several universities
  await p.click("#uniBtn"); await p.waitForSelector("#upAll");
  await p.uncheck("#upAll"); await p.check('[data-uni="IU"]'); await p.check('[data-uni="TU"]'); await p.click("#upGo");
  await p.waitForTimeout(300);
  const uniTxt = await p.textContent("#uniBtn b");
  const cm = await p.locator("#grid .card .card-meta").allTextContents();
  ok(uniTxt.includes("ИУ") && uniTxt.includes("ТУ") && cm.length && cm.every(m => /ИУ|ТУ/.test(m)), `two universities picked: ${uniTxt}`);
  await p.click("#uniBtn"); await p.check("#upAll"); await p.click("#upGo"); await p.waitForTimeout(300);
  ok((await p.textContent("#uniBtn b")).includes("всички"), "all universities");

  // fair price
  await p.click('[data-cat="fair"]'); await p.waitForSelector("#grid .card");
  const deals = await p.locator("#grid .card").count();
  ok(deals > 0, `"Изгодни" shows ${deals} listings below the area median`);
  await p.click("#grid .card h3"); await p.waitForSelector(".lp-title");
  ok(await p.locator(".bill-fair.good").count() === 1, "a good deal explains the price against the area median");
  await p.goto(U); await p.click('[data-cat="all"]');

  // canonical listing, share card, saving, chat
  await p.goto(U + "#/l/l1"); await p.waitForSelector("#msg");
  ok((await p.textContent(".bill-total mark")) === "€333", "canonical listing shows €333 per person");
  ok((await p.textContent(".split")).includes("€32,50"), "bill shows €32,50 utilities share");
  ok(await p.locator(".pin-exact").count() === 0, "exact address hidden from others");
  await p.click("#fbShare"); await p.waitForSelector(".share-prev img", { timeout: 15000 });
  ok((await p.getAttribute(".share-prev img", "src")).startsWith("blob:"), "Facebook card image is generated");
  ok((await p.inputValue("#shText")).includes("#/l/l1"), "post text links back to the listing");
  await p.keyboard.press("Escape");
  await p.click("#save");
  await p.click("#msg"); await p.waitForSelector("#txt");
  ok((await p.inputValue("#txt")).includes("ИУ"), "intro message uses my profile");
  await p.click("#send"); await p.waitForSelector(".bub.them", { timeout: 5000 });
  ok(true, "demo reply arrives");
  await p.click("#share"); await p.waitForSelector(".phone-box", { timeout: 5000 });
  await p.goto(U + "#/l/l1"); await p.waitForSelector("#lpMap");
  ok(await p.locator(".pin-exact").count() === 1, "exact address visible after both shared contacts");

  // notifications & saved searches
  ok((await p.textContent(".hdr-right .bell .dot")) === "1", "bell shows the seeded notification");
  await p.goto(U + "#/notifications"); await p.waitForSelector(".notif");
  ok(await p.locator(".notif.new").count() === 1, "notification is listed as new");
  ok(await p.locator(".hdr-right .bell .dot").count() === 0, "opening notifications clears the bell");
  await p.click('[data-open="s1"]'); await p.waitForSelector("#grid .card");
  ok((await p.locator("#grid .card").allTextContents()).every(s => s.includes("Стая")), "a saved search reopens its filters");
  ok(await p.isDisabled("#saveSearch"), "the same search shows as already saved");

  // wizard → new listing reaches a saved search of another person
  await store(p, "switchUser", "u1"); // Иван has a listing; his saved search is empty
  await p.goto(U + "#/host/new"); await p.waitForSelector(".wiz");
  await p.click('[data-v="whole"]'); await p.click("#next");
  const box = await p.locator("#pmap").boundingBox();
  await p.mouse.click(box.x + box.width * .55, box.y + box.height * .45);
  await p.fill("#addr", "ул. Тестова 12"); await p.click("#next");
  await p.click("#next");
  await p.setInputFiles("#phIn", [PNG, PNG]);
  await p.waitForFunction(() => document.querySelectorAll("#phs .ph").length === 2, null, { timeout: 8000 });
  await p.click("#next");
  await p.fill("#rent", "600"); await p.fill("#util", "60");
  await p.click('.stepper[data-k="occupants"] [data-d="1"]'); // 3 people → €220
  ok((await p.textContent("#ppv")) === "€220", "wizard shows the live per-person price");
  await p.click("#next"); await p.click("#next");
  await p.fill("#dsc", "Тристаен за трима студенти, тих блок, до спирка, ремонтиран преди година.");
  await p.click("#next"); await p.click("#next");
  await p.waitForSelector(".lp-title");
  const newId = p.url().split("/l/")[1];
  ok((await p.locator(".thumbs img").count()) === 2, "published listing shows the uploaded photos");
  await p.reload(); await p.waitForSelector(".lp-title");
  ok((await p.locator(".thumbs img").count()) === 2, "photos survive a reload");

  // groups: Мирослав's group of 3 applies for the new 3-person flat
  await store(p, "switchUser", "u24");
  await p.goto(U + "#/group"); await p.waitForSelector(".grp-stats");
  ok((await p.textContent(".grp-stats dd")) === "3", "group page shows 3 members");
  ok(await p.locator(`#gFit .card[data-id="${newId}"], #gOver .card[data-id="${newId}"]`).count() === 1, "the new 3-person flat is suggested to the group");
  await p.goto(U + "#/l/" + newId); await p.waitForSelector("#grpApply");
  await p.click("#grpApply"); await p.click("#gaGo"); await p.waitForSelector(".grp-strip");
  ok(true, "group application opens a chat marked as a group application");
  await store(p, "switchUser", "u31"); // Живко, a member
  await p.goto(U + "#/notifications"); await p.waitForSelector(".notif");
  ok((await p.textContent(".nlist")).includes("от името на групата"), "other members are notified about the application");

  // my own group + invite
  await store(p, "switchUser", "u23");
  await p.goto(U + "#/group"); await p.fill("#gName", "Тест"); await p.click("#newGrp button");
  await p.waitForSelector("#invite"); await p.click("#invite"); await p.click(".inv-row [data-inv]");
  await p.waitForTimeout(1900); await p.keyboard.press("Escape");
  await p.goto(U); await p.waitForSelector("#grid .card");
  ok(await p.locator('[data-cat="group"]').count() === 1, "explore offers “For our group” once the group has 2 people");

  // language
  await p.click("#menuBtn"); await p.click('[data-lang="en"]'); await p.waitForSelector("#grid .card");
  ok((await p.getAttribute("#sbQ", "placeholder")) === "Area, university or keyword", "English header");
  ok((await p.textContent("#grid .card .card-price span")).includes("per person"), "English cards");
  await p.goto(U + "#/l/l1"); await p.waitForSelector(".bill-head");
  ok((await p.textContent(".bill-head")).includes("Your share"), "English bill");
  ok((await p.textContent(".split")).includes("€32.50"), "English number format");
  ok((await p.textContent(".lp-title")) === "Free bedroom in a two-room flat, Mladost", "listing title translated");
  ok((await p.textContent(".hostline b")) === "Ivan Petkov", "host name transliterated");
  ok((await p.textContent(".lp-sec .tx-wrap .desc")).startsWith("My flatmate graduated"), "description translated");
  await p.click(".tx-note"); ok((await p.isVisible(".tx-orig")) && (await p.textContent(".tx-orig")).startsWith("Съквартирантът"), "switch shows the original");
  ok(p.txCalls.length === 0, "demo content needs no translation service");
  await p.goto(U + "#/l/" + newId); await p.waitForSelector(".lp-title");
  await p.waitForFunction(() => document.querySelector(".lp-sec .tx-wrap .desc")?.textContent.startsWith("[en] "), null, { timeout: 5000 });
  ok((await p.textContent(".lp-sec .tx-wrap .desc")).startsWith("[en] Тристаен"), "new listing translated by the service, swapped in place");
  const calls = p.txCalls.length;
  await p.reload(); await p.waitForSelector(".lp-title"); await p.waitForTimeout(300);
  ok(p.txCalls.length === calls && (await p.textContent(".lp-sec .tx-wrap .desc")).startsWith("[en] "), "translations are cached");
  await p.click("#menuBtn"); await p.click('[data-lang="de"]'); await p.waitForSelector(".bill-head");
  ok((await p.textContent(".bill-head")).includes("Dein Anteil"), "German bill");
  ok(await p.evaluate(() => document.documentElement.lang) === "de", "html lang follows the language");
  await p.click("#menuBtn"); await p.click('[data-lang="bg"]');

  // owner actions
  await store(p, "switchUser", "u1");
  await p.goto(U + "#/host"); await p.waitForSelector(".hrow");
  await p.click(`[data-del="${newId}"]`); await p.click("#cOk"); await p.waitForTimeout(300);
  ok(await p.locator(`[data-del="${newId}"]`).count() === 0, "listing deleted");
  ok(p.errors.length === 0, "no page errors on desktop" + (p.errors.length ? ": " + p.errors.join(" | ") : ""));

  // ---------------- phone ----------------
  console.log("Phone");
  const m = (await newPage({ width: 390, height: 844 })).p;
  await m.goto(U); await m.waitForSelector("#grid .card");
  const swiped = await m.evaluate(async () => {
    const car = document.querySelector("#grid .car[data-n]"), tr = car.querySelector(".car-track");
    tr.scrollLeft = tr.clientWidth; await new Promise(r => setTimeout(r, 200));
    return { scrollable: tr.scrollWidth > tr.clientWidth, dot: [...car.querySelectorAll(".car-dots i")].findIndex(i => i.classList.contains("on")) };
  });
  ok(swiped.scrollable && swiped.dot === 1, "card photos scroll sideways (swipe) and the dots follow");
  ok(await m.isVisible(".m-bell"), "bell is in the phone header");
  await m.click("#mapTgl"); await m.waitForTimeout(400);
  const tiles = await m.evaluate(() => [...document.querySelectorAll("#map .leaflet-tile")].map(i => new URL(i.src).pathname.split("/").slice(1, 4).map(n => parseInt(n))));
  const z = tiles[0]?.[0], n = 2 ** z, cx = Math.floor((27.9147 + 180) / 360 * n);
  const cy = Math.floor((1 - Math.log(Math.tan(43.2141 * Math.PI / 180) + 1 / Math.cos(43.2141 * Math.PI / 180)) / Math.PI) / 2 * n);
  ok(z >= 12 && tiles.every(t => t[0] === z) && tiles.some(t => t[1] === cx && t[2] === cy), `phone map opens on Varna (tile zoom ${z})`);
  await m.click("#mapTgl");
  for (const lang of ["bg", "en"]) {
    for (const r of ["", "#/l/l1", "#/l/l4", "#/u/u1", "#/people", "#/inbox/t1", "#/group", "#/notifications", "#/host/new", "#/me/edit"]) {
      await m.goto(U + r); await m.waitForTimeout(350);
      const w = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (w > 0) ok(false, `no sideways scroll on ${lang} ${r || "/"} (+${w}px)`);
    }
    await m.evaluate(async () => { const s = await import("/js/state.js"); s.changeLang("en"); });
  }
  ok(true, "no sideways scroll on phone pages in Bulgarian and English");
  ok(m.errors.length === 0, "no page errors on phone" + (m.errors.length ? ": " + m.errors.join(" | ") : ""));
} catch (e) {
  failed++; console.log("  ✗ crashed:", e.message.split("\n")[0]);
} finally {
  await browser.close(); server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
