import { DISTRICTS, COAST } from "./data/places.js";

export const PRIVACY_RADIUS_M = 100;
const EARTH_M = 6371000;
const rad = d => d * Math.PI / 180;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

// Move a point by (north, east) metres.
export function offsetM(p, north, east) {
  return {
    lat: p.lat + (north / EARTH_M) * 180 / Math.PI,
    lng: p.lng + (east / (EARTH_M * Math.cos(rad(p.lat)))) * 180 / Math.PI,
  };
}

// Public centre of the privacy circle. The true point lies uniformly inside the circle,
// so the centre alone never reveals the building. Computed once when the address is saved;
// recomputing it on every view would let someone average the centres back to the address.
export function approximate(exact, rand = Math.random, radius = PRIVACY_RADIUS_M) {
  const r = radius * 0.85 * Math.sqrt(rand());
  const t = 2 * Math.PI * rand();
  const c = offsetM(exact, r * Math.cos(t), r * Math.sin(t));
  return { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) };
}

// Door-to-door estimate: the faster of walking and city bus (walk + wait, then road distance
// at average bus speed). A placeholder until real transit routing (GTFS) exists for Varna.
export function commuteMin(a, b) {
  const km = distanceM(a, b) / 1000;
  const walk = km * 1.25 / 5 * 60;
  const bus = 9 + km * 1.2 / 22 * 60;
  return Math.max(2, Math.round(Math.min(walk, bus)));
}

// Closest of several universities by travel time.
export function nearestUni(p, unis) {
  let best = null;
  for (const u of unis) { const m = commuteMin(p, u); if (!best || m < best.min) best = { uni: u, min: m }; }
  return best;
}

export function nearestDistrict(p) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) { const m = distanceM(p, d); if (m < bd) { bd = m; best = d; } }
  return best.name;
}

export function seaDistanceM(p) {
  return Math.min(...COAST.map(([lat, lng]) => distanceM(p, { lat, lng })));
}

// Address search, limited to Varna. Nominatim's usage policy allows light prototype use only;
// production needs its own geocoder or a paid provider.
export async function geocode(q, signal) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({ q: q + ", Варна", format: "json", limit: "5", countrycodes: "bg",
    viewbox: "27.80,43.30,28.10,43.12", bounded: "1", "accept-language": "bg" });
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error("geocode " + r.status);
  return (await r.json()).map(x => ({ label: x.display_name.split(", България")[0], lat: +x.lat, lng: +x.lon }));
}
