// Photos. Two kinds of reference are stored on listings and users:
//   "gen:<kind>:<seed>" → a generated room illustration for demo data;
//   "idb:<id>"          → a photo uploaded by the user, resized and kept in IndexedDB.
// In production uploads go to object storage; the ref format stays the same.
import { rng } from "./data/seed.js";

const cache = new Map();
let dbp = null;

function db() {
  dbp ??= new Promise((res, rej) => {
    const q = indexedDB.open("delim-photos", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("photos");
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => {
  const t = d.transaction("photos", mode); const r = fn(t.objectStore("photos"));
  t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };

// Load every stored upload once at start-up so rendering can stay synchronous.
export async function initPhotos() {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const t = d.transaction("photos", "readonly"); const c = t.objectStore("photos").openCursor();
      c.onsuccess = () => { const cur = c.result; if (!cur) return res();
        cache.set("idb:" + cur.key, URL.createObjectURL(cur.value)); cur.continue(); };
      c.onerror = () => rej(c.error);
    });
  } catch (e) { console.warn("Снимките не могат да се заредят", e); }
}

export function photoSrc(ref) {
  if (!ref) return "";
  if (cache.has(ref)) return cache.get(ref);
  if (ref.startsWith("gen:")) {
    const [, kind, seed] = ref.split(":");
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(roomSVG(kind, +seed));
    cache.set(ref, url);
    return url;
  }
  return "";
}

export async function savePhoto(file, maxSide = 1600) {
  if (!/^image\//.test(file.type)) throw new Error("Файлът не е снимка");
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
  const id = crypto.randomUUID();
  await tx("readwrite", s => s.put(blob, id));
  const ref = "idb:" + id;
  cache.set(ref, URL.createObjectURL(blob));
  return ref;
}

export async function deletePhoto(ref) {
  if (!ref?.startsWith("idb:")) return;
  await tx("readwrite", s => s.delete(ref.slice(4)));
  URL.revokeObjectURL(cache.get(ref)); cache.delete(ref);
}

export async function clearPhotos() {
  await tx("readwrite", s => s.clear());
  for (const [k, v] of cache) if (k.startsWith("idb:")) { URL.revokeObjectURL(v); cache.delete(k); }
}

// ---------- generated room illustrations ----------
const WALLS = ["#EDE3D6", "#E3E8EA", "#F0E4DC", "#DCE5D8", "#EEE8DD", "#D8E0E9", "#F3EDE4", "#E6DCEB"];
const FLOORS = ["#C49A6C", "#A97B50", "#D8B88A", "#8E6A4A", "#BFA283", "#9C8266"];
const ACCENTS = ["#2F5D62", "#D98E73", "#7A8FB8", "#E3B448", "#5E7D5A", "#B85C5C", "#3E4A61", "#C7A27C"];

function roomSVG(kind, seed) {
  const r = rng(seed * 7919 + kind.length);
  const pick = a => a[Math.floor(r() * a.length)];
  const wall = pick(WALLS), floor = pick(FLOORS), acc = pick(ACCENTS), acc2 = pick(ACCENTS.filter(a => a !== acc));
  const H = 420, wx = 70 + r() * 420; // horizon and window x
  const plank = Array.from({ length: 9 }, (_, i) => `<line x1="${-200 + i * 150}" y1="600" x2="${220 + i * 50}" y2="${H}" stroke="#000" stroke-opacity=".07" stroke-width="2"/>`).join("");
  const room = (w = wall) => `<rect width="800" height="600" fill="${w}"/>
    <polygon points="0,${H} 800,${H} 800,600 0,600" fill="${floor}"/>${plank}
    <rect y="${H - 10}" width="800" height="12" fill="#fff" fill-opacity=".55"/>`;
  const win = (x, sea = false) => `<g><rect x="${x}" y="70" width="210" height="230" rx="6" fill="#fff"/>
    <rect x="${x + 12}" y="82" width="186" height="206" fill="url(#sky)"/>
    ${sea ? `<rect x="${x + 12}" y="220" width="186" height="68" fill="#5C9CC4"/><rect x="${x + 12}" y="218" width="186" height="4" fill="#9CC7E0"/>` :
      `<path d="M${x + 12} 288 L${x + 12} 240 Q${x + 60} 200 ${x + 110} 236 Q${x + 150} 210 ${x + 198} 232 L${x + 198} 288Z" fill="#9CB89A"/>`}
    <rect x="${x + 102}" y="82" width="6" height="206" fill="#fff"/><rect x="${x}" y="296" width="210" height="10" rx="3" fill="#fff"/>
    <rect x="${x - 26}" y="58" width="40" height="${H - 70}" rx="8" fill="${acc2}" fill-opacity=".85"/></g>`;
  const plant = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-22 0 L22 0 L16 44 L-16 44Z" fill="#C9744F"/>
    <ellipse cx="-14" cy="-24" rx="14" ry="30" fill="#4F7A4A" transform="rotate(-25 -14 -24)"/><ellipse cx="14" cy="-26" rx="14" ry="32" fill="#5E8C55" transform="rotate(22 14 -26)"/>
    <ellipse cx="0" cy="-38" rx="12" ry="34" fill="#6B9A5E"/></g>`;
  const frame = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#3a3a3a" stroke-width="5"/>
    <circle cx="${x + w * .35}" cy="${y + h * .4}" r="${Math.min(w, h) * .18}" fill="${acc}"/><path d="M${x + 6} ${y + h - 6} L${x + w * .5} ${y + h * .5} L${x + w - 6} ${y + h - 6}Z" fill="${acc2}"/>`;
  const lamp = (x, y) => `<rect x="${x - 3}" y="${y}" width="6" height="${600 - 60 - y}" fill="#333"/><path d="M${x - 34} ${y} L${x + 34} ${y} L${x + 22} ${y - 44} L${x - 22} ${y - 44}Z" fill="#F4E3B8"/>
    <ellipse cx="${x}" cy="${y + 40}" rx="90" ry="60" fill="#FFE9A8" fill-opacity=".18"/>`;
  const bed = (x, w = 380) => `<g><rect x="${x}" y="250" width="${w}" height="190" rx="14" fill="#7B5B43"/>
    <rect x="${x - 10}" y="370" width="${w + 20}" height="110" rx="10" fill="#fff"/>
    <rect x="${x - 10}" y="400" width="${w + 20}" height="110" rx="12" fill="${acc}"/>
    <path d="M${x - 10} 430 Q${x + w / 2} 410 ${x + w + 10} 430" stroke="#fff" stroke-opacity=".25" stroke-width="6" fill="none"/>
    <rect x="${x + 24}" y="330" width="${w / 2 - 40}" height="60" rx="18" fill="#F7F3EC"/><rect x="${x + w / 2 + 16}" y="330" width="${w / 2 - 40}" height="60" rx="18" fill="#F7F3EC"/>
    <rect x="${x - 10}" y="505" width="14" height="30" fill="#5a4030"/><rect x="${x + w - 4}" y="505" width="14" height="30" fill="#5a4030"/></g>`;
  const desk = (x) => `<g><rect x="${x}" y="360" width="260" height="14" fill="#8C6A4F"/><rect x="${x + 10}" y="374" width="10" height="150" fill="#6d5140"/><rect x="${x + 240}" y="374" width="10" height="150" fill="#6d5140"/>
    <rect x="${x + 70}" y="298" width="110" height="64" rx="4" fill="#2b2f36"/><rect x="${x + 76}" y="304" width="98" height="52" fill="#7DA7D9"/><rect x="${x + 110}" y="362" width="30" height="4" fill="#2b2f36"/>
    <rect x="${x + 190}" y="330" width="16" height="32" fill="${acc2}"/><rect x="${x + 208}" y="324" width="14" height="38" fill="${acc}"/><rect x="${x + 224}" y="334" width="12" height="28" fill="#E3B448"/>
    <path d="M${x + 90} 540 L${x + 90} 440 Q${x + 90} 410 ${x + 130} 410 L${x + 160} 410 Q${x + 190} 410 ${x + 190} 440 L${x + 190} 470 L${x + 90} 470" fill="${acc}" fill-opacity=".9"/></g>`;
  const sofa = (x) => `<g><rect x="${x}" y="330" width="360" height="110" rx="26" fill="${acc}"/><rect x="${x - 22}" y="370" width="60" height="130" rx="22" fill="${acc}"/>
    <rect x="${x + 322}" y="370" width="60" height="130" rx="22" fill="${acc}"/><rect x="${x + 20}" y="410" width="320" height="80" rx="16" fill="${acc}" style="filter:brightness(1.1)"/>
    <rect x="${x + 20}" y="410" width="320" height="80" rx="16" fill="#fff" fill-opacity=".12"/>
    <rect x="${x + 40}" y="350" width="80" height="70" rx="18" fill="${acc2}"/><rect x="${x + 250}" y="352" width="76" height="66" rx="18" fill="#F7F3EC"/></g>`;
  const rug = `<ellipse cx="420" cy="555" rx="300" ry="40" fill="${acc2}" fill-opacity=".45"/>`;
  const defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8EC5EA"/><stop offset="1" stop-color="#DDEFF8"/></linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  let body = "";
  switch (kind) {
    case "bedroom": case "bedroom2": {
      const bx = kind === "bedroom2" ? 60 : 300 + r() * 60;
      body = room() + win(kind === "bedroom2" ? 520 : 40, r() < .3) + frame(kind === "bedroom2" ? 120 : 380 + r() * 40, 130, 110, 80) + bed(bx, kind === "bedroom2" ? 300 : 380)
        + `<rect x="${bx - 90}" y="390" width="70" height="90" rx="6" fill="#EFE7DA"/>` + lamp(bx - 55, 360) + plant(740, 520, .9);
      break; }
    case "living":
      body = room() + win(wx > 380 ? 520 : 40, r() < .35) + rug + sofa(wx > 380 ? 90 : 350) + frame(wx > 380 ? 180 : 450, 150, 150, 100)
        + `<rect x="${wx > 380 ? 180 : 430}" y="495" width="190" height="16" rx="6" fill="#6d5140"/><rect x="${wx > 380 ? 200 : 450}" y="511" width="8" height="40" fill="#6d5140"/><rect x="${wx > 380 ? 342 : 592}" y="511" width="8" height="40" fill="#6d5140"/>`
        + plant(wx > 380 ? 40 : 750, 520) + lamp(wx > 380 ? 480 : 300, 300);
      break;
    case "kitchen": {
      const cab = pick(["#FFFFFF", "#3E4A61", "#5E7D5A", "#D9C7B0"]);
      body = room() + `<rect x="0" y="210" width="800" height="100" fill="#fff" fill-opacity=".6"/>`
        + Array.from({ length: 8 }, (_, i) => `<line x1="${i * 100}" y1="210" x2="${i * 100}" y2="310" stroke="#000" stroke-opacity=".06"/>`).join("")
        + Array.from({ length: 4 }, (_, i) => `<rect x="${40 + i * 130}" y="60" width="120" height="140" rx="4" fill="${cab}" stroke="#000" stroke-opacity=".12"/><rect x="${90 + i * 130}" y="175" width="20" height="5" rx="2" fill="#888"/>`).join("")
        + `<rect x="30" y="310" width="540" height="18" fill="#E9E4DC"/>` + Array.from({ length: 4 }, (_, i) => `<rect x="${40 + i * 130}" y="328" width="120" height="170" rx="4" fill="${cab}" stroke="#000" stroke-opacity=".12"/><rect x="${90 + i * 130}" y="340" width="20" height="5" rx="2" fill="#888"/>`).join("")
        + `<rect x="300" y="300" width="100" height="10" fill="#333"/><circle cx="325" cy="305" r="4" fill="#666"/><circle cx="375" cy="305" r="4" fill="#666"/>`
        + `<rect x="600" y="100" width="150" height="400" rx="12" fill="#E8ECEF" stroke="#000" stroke-opacity=".1"/><rect x="600" y="250" width="150" height="4" fill="#000" fill-opacity=".1"/><rect x="615" y="130" width="6" height="80" rx="3" fill="#aaa"/><rect x="615" y="270" width="6" height="100" rx="3" fill="#aaa"/>`
        + `<path d="M120 300 q10 -40 30 -10 q10 -30 20 10Z" fill="#6B9A5E"/><rect x="200" y="285" width="26" height="25" rx="4" fill="${acc}"/><rect x="235" y="275" width="16" height="35" rx="4" fill="${acc2}"/>`;
      break; }
    case "bath": {
      const tile = pick(["#FFFFFF", "#DDE8EC", "#E9E2D6", "#D6E3D4"]);
      body = `<rect width="800" height="600" fill="${tile}"/>` + Array.from({ length: 16 }, (_, i) => `<line x1="${i * 55}" y1="0" x2="${i * 55}" y2="600" stroke="#000" stroke-opacity=".06"/><line x1="0" y1="${i * 55}" x2="800" y2="${i * 55}" stroke="#000" stroke-opacity=".06"/>`).join("")
        + `<rect x="60" y="360" width="380" height="140" rx="30" fill="#fff" stroke="#000" stroke-opacity=".08" stroke-width="3"/><rect x="80" y="370" width="340" height="30" rx="12" fill="#CFE6F1"/>
        <rect x="380" y="200" width="8" height="170" fill="#bbb"/><path d="M340 200 L400 200" stroke="#bbb" stroke-width="8" stroke-linecap="round"/><circle cx="340" cy="210" r="16" fill="#ccc"/>
        <rect x="540" y="110" width="160" height="190" rx="80" fill="#DDEFF7" stroke="#fff" stroke-width="10"/>
        <rect x="520" y="330" width="200" height="30" rx="8" fill="#fff"/><rect x="540" y="360" width="160" height="140" fill="${acc}" fill-opacity=".85"/>
        <rect x="600" y="316" width="8" height="18" fill="#aaa"/><rect x="140" y="130" width="70" height="170" rx="6" fill="${acc2}"/>` + plant(740, 520, .7);
      break; }
    case "balcony":
      body = `<rect width="800" height="600" fill="url(#sky)"/><rect y="250" width="800" height="200" fill="#5C9CC4"/><rect y="246" width="800" height="6" fill="#A6D0E6"/>
        <path d="M0 260 Q120 220 260 250 L260 300 L0 300Z" fill="#7FA37A" fill-opacity=".8"/>
        <polygon points="0,440 800,440 800,600 0,600" fill="${floor}"/>` + plank
        + Array.from({ length: 21 }, (_, i) => `<rect x="${i * 40}" y="330" width="6" height="120" fill="#fff" fill-opacity=".9"/>`).join("") + `<rect y="322" width="800" height="12" fill="#fff"/>`
        + `<g><rect x="280" y="440" width="120" height="12" rx="4" fill="#7B5B43"/><rect x="336" y="452" width="8" height="90" fill="#7B5B43"/>
          <path d="M150 560 L150 470 Q150 440 180 440 L230 440 L230 560" fill="${acc}"/><path d="M450 560 L450 470 Q450 440 480 440 L530 440 L530 560" fill="${acc}"/>
          <rect x="310" y="410" width="18" height="30" rx="4" fill="#fff"/><rect x="340" y="420" width="30" height="20" rx="3" fill="${acc2}"/></g>` + plant(680, 510) + plant(90, 520, .8);
      break;
    case "studio":
      body = room() + win(460, r() < .3) + bed(40, 300) + `<rect x="520" y="330" width="240" height="16" fill="#E9E4DC"/><rect x="520" y="346" width="240" height="170" fill="${pick(["#FFFFFF", "#D9C7B0", "#3E4A61"])}" stroke="#000" stroke-opacity=".1"/>
        <rect x="560" y="320" width="70" height="10" fill="#333"/>` + frame(380, 140, 90, 110) + plant(470, 525, .8);
      break;
    case "desk":
      body = room() + win(480, false) + desk(120) + `<rect x="60" y="120" width="300" height="10" fill="#8C6A4F"/>`
        + Array.from({ length: 9 }, (_, i) => `<rect x="${70 + i * 22}" y="${80 + (i % 3) * 6}" width="18" height="${40 - (i % 3) * 6}" fill="${[acc, acc2, "#E3B448", "#7A8FB8"][i % 4]}"/>`).join("") + plant(700, 520);
      break;
    case "yard":
      body = `<rect width="800" height="600" fill="url(#sky)"/><rect y="330" width="800" height="270" fill="#8DB36F"/>
        <rect x="420" y="120" width="380" height="260" fill="${wall}"/><polygon points="400,130 610,40 820,130" fill="#B4553E"/><rect x="520" y="220" width="90" height="100" fill="#DDEFF8" stroke="#fff" stroke-width="8"/><rect x="660" y="250" width="70" height="130" fill="#7B5B43"/>`
        + Array.from({ length: 14 }, (_, i) => `<rect x="${i * 30}" y="300" width="18" height="90" rx="4" fill="#E9DCC6"/>`).join("") + `<rect y="320" width="420" height="10" fill="#E9DCC6"/>`
        + `<rect x="170" y="200" width="22" height="200" fill="#6d5140"/><circle cx="180" cy="180" r="90" fill="#5E8C55"/><circle cx="130" cy="210" r="60" fill="#6B9A5E"/><circle cx="240" cy="220" r="55" fill="#4F7A4A"/>
          <rect x="260" y="450" width="200" height="14" rx="4" fill="#fff"/><rect x="280" y="464" width="8" height="70" fill="#fff"/><rect x="432" y="464" width="8" height="70" fill="#fff"/>
          <circle cx="360" cy="330" r="80" fill="${acc}" fill-opacity=".0"/><path d="M290 450 L360 330 L430 450" fill="${acc}" fill-opacity=".9"/><rect x="357" y="330" width="6" height="120" fill="#555"/>`;
      break;
    default:
      body = room();
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${defs}${body}<rect width="800" height="600" fill="url(#light)"/></svg>`;
}
