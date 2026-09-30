# "делим" — student flatmate & room finder (Varna, BG)

The user (Petar Zakov) writes in Bulgarian; reply in Bulgarian unless told otherwise. He prefers terse, direct answers. The UI language is Bulgarian. "делим" is a working name only.

## Status
- Working client-side prototype (v0.2): `index.html` + `css/` + `js/`, vanilla ES modules, no build step. Data lives in the browser (localStorage + IndexedDB for photos) and is seeded with demo data on first load.
- Run: `npm start` (python http.server on :8080). Test: `npm test` (node:test, no dependencies). ES modules do not load from `file://`.
- `delim-mockup.html` is the original single-file mockup, kept only as a reference for the first UX.
- Still no backend, auth or hosting decision. `js/store.js` is the only data layer; replace it with API calls when a backend exists.

## Code map
- `js/data/places.js` real universities (OSM coordinates, student e-mail domains to confirm) and district centroids.
- `js/data/seed.js` deterministic demo data (≈40 students/landlords, 36 listings, reviews). Listing `l1` is the canonical case.
- `js/logic.js` pure logic: per-person price, compatibility, search/filters/categories, ratings, formatting. Tested.
- `js/geo.js` distance, 100 m privacy circle, commute estimate, Nominatim geocoding.
- `js/store.js` persistence and all mutations; `js/photos.js` uploads (IndexedDB) and generated room illustrations for seed listings.
- `js/views/*` screens: explore (search + map), listing, profile/edit, people (seekers), inbox, host (my listings + 8-step wizard).

## Decisions taken in the prototype
- Exact address is stored privately. Everyone else sees a 100 m circle whose centre is offset randomly **once** at save time (recomputing per view would let people average it back). The address unlocks only for the owner or after both sides agree to share phones in chat. The street address is excluded from search for the same reason.
- Commute = faster of walking and bus (9 min walk/wait + road distance at 22 km/h). Placeholder until real GTFS data.
- Map tiles: OpenStreetMap standard tiles, CSS-muted to look like Airbnb. OK for a prototype only; production needs a keyed provider. CARTO now requires an API key.
- Visual identity is deliberately our own, not Airbnb's (the user asked to avoid trade-dress risk): no coral red, no segmented search pill, no icon category row, no 1+4 photo grid, no "Guest favourite" laurels, no copied section titles. Keep it that way.
- Demo-only shortcuts, all labelled in the UI: auto-reply in chat, auto-accept of phone sharing, e-mail code shown in a toast, anyone can write a review, "Влез като" user switcher.

## Canonical test case
A student has a 2-bedroom flat. His flatmate graduated, so one bedroom is free. Rent is €600 total and utilities average ~€65/month, split equally. Male seeking male. He needs the flat for 2 more years.
→ The listing shows **€333/person/month incl. utilities** (600/2 + 65/2 = 332.5, rounded).

## Product decisions (defaults, not final)
1. **Two listing types:** `room` (a student with a free room seeks a flatmate; the main case) and `whole` (a landlord or agency lists a whole flat; students apply alone or as a group).
2. **Price is always per person, including utilities.** Users enter totals and the system computes the share. Pins and list rows show this number.
3. **Airbnb-style map.** Pins are labelled with the per-person price. Pins with ≥80% compatibility are highlighted.
4. **Commute time to a selected university**, not km distance. Varna universities: ИУ, МУ, ТУ, ВСУ, ВВМУ, ВУМ. Production needs real transit routing.
5. **Compatibility quiz:** gender, smoking at home, sleep (early/late), cleanliness 1–3, guests 1–3. The score starts at 100. Penalties: smoking mismatch −25, sleep mismatch −15, −12 per cleanliness step, −9 per guests step. The floor is 20. The UI shows the reasons as ✓/! lines. The weights are placeholders.
6. **Filters:** listing type, gender (listing pref m/f/any vs user gender), max price per person, max commute minutes, min duration.
7. **Trust & safety:**
   - verification by university email domain (@ue-varna.bg, @mu-varna.bg, …);
   - in-platform chat, with phones hidden until both sides accept;
   - reviews from former flatmates;
   - a "Хазяинът е съгласен" badge (subletting without landlord consent is a real contractual risk for the tenant in BG; the user has a law degree and should review the legal copy);
   - a downloadable flatmate agreement template.
8. **Go-to-market:** the real competitor is Facebook groups ("Квартири Варна" etc.). Launch in Varna only and seed listings manually.
9. **Monetization:** free for students; landlords and agencies pay for promoted listings. Demand is seasonal and peaks in Aug–Sep.

## Data model (original sketch; the prototype's real shape is in js/data/seed.js)
```
Listing {
  id, type: "room" | "whole", title, district, lat/lng (mockup: x/y on schematic SVG),
  rent_total, occupants, utilities_avg, gender_pref: "m" | "f" | "any",
  min_months, available_from,
  host?: { name, initials, info, smoke 0|1, sleep "early"|"late", clean 1-3, guests 1-3 },
  agency?: string,
  landlord_consent: bool, verified_student: bool
}
UserProfile { gender, smoke, sleep, clean, guests, university }
price_per_person = round(rent_total/occupants + utilities_avg/occupants)
```

## Visual direction
"Split the bill": cool paper background `#F3F6F4`, ink `#16232E` outlines, highlighter yellow `#FFD83D` marks on money and the logo, marine `#1F5FA8` for maps/universities. Signature pieces: price tags with a pointer on the map, per-person price as a highlighted mark on cards, the listing's split shown as a receipt with a torn edge, the profile as a student ID card with a "Потвърден" stamp, a numbered step list in the listing wizard. Light theme only. Fonts: Unbounded (headings, prices) and Manrope (UI). Icons: lucide-static (ISC), inlined in `js/icons.js`. Leaflet 1.9.4 is vendored in `vendor/leaflet`.

## Open questions
- Real transit data, tile provider and geocoder with API keys.
- Legal copy (subletting warning, flatmate agreement template in `js/views/listing.js`) needs the user's review.
- Backend stack, hosting, auth, database.
- Whether this connects to the user's property-management business or stays separate.
- Final name and domain.
- GDPR handling for student verification and chat data.
