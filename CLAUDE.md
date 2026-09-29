# "делим" — student flatmate & room finder (Varna, BG)

The user (Petar Zakov) writes in Bulgarian; reply in Bulgarian unless told otherwise. He prefers terse, direct answers. The UI language is Bulgarian. "делим" is a working name only.

## Status
- Concept agreed at a high level. No stack, backend or business decisions made yet.
- `delim-mockup.html` is a clickable single-file prototype. Use it as the UX reference and as the source of copy and demo data. It is not production code.

## Canonical test case
A student has a 2-bedroom flat. His flatmate graduated, so one bedroom is free. Rent is €600 total and utilities average ~€65/month, split equally. Male seeking male. He needs the flat for 2 more years.
→ The listing shows **€333/person/month incl. utilities** (600/2 + 65/2 = 332.5, rounded).

## Product decisions (defaults, not final)
1. **Two listing types:** `room` (a student with a free room seeks a flatmate; the main case) and `whole` (a landlord or agency lists a whole flat; students apply alone or as a group).
2. **Price is always per person, including utilities.** Users enter totals and the system computes the share. Pins and list rows show this number.
3. **Airbnb-style map.** Pins are labelled with the per-person price. Pins with ≥80% compatibility are highlighted.
4. **Commute time to a selected university**, not km distance. Varna universities: ИУ, МУ, ТУ, ВСУ (ВВМУ also appears in the data). The mockup uses a fake formula (`dist*0.08 + 6 min`). Production needs real transit routing.
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

## Data model (as in the mockup; extend as needed)
```
Listing {
  id, type: "room" | "whole", title, district, lat/lng (mockup: x/y on schematic SVG),
  rent_total, occupants, utilities_avg, gender_pref: "m" | "f" | "any",   // mockup uses "a"
  min_months, available_from,
  host?: { name, initials, info, smoke 0|1, sleep "early"|"late", clean 1-3, guests 1-3 },
  agency?: string,
  landlord_consent: bool, verified_student: bool
}
UserProfile { gender, smoke, sleep, clean, guests, university }
price_per_person = round(rent_total/occupants + utilities_avg/occupants)
```

## Visual direction
Vanilla JS, no dependencies. Fonts are Unbounded (display) and Manrope (body). Light and dark tokens. Highlighter-yellow accent `#FFD83D` with ink `#16232E` on a cool paper background `#F3F6F4`.

## Open questions
- Tech stack, hosting, maps provider (Mapbox / Google / OSM), auth, database.
- A real transit data source for Varna commute times.
- Whether this connects to the user's property-management business or stays separate.
- Final name and domain.
- GDPR handling for student verification and chat data.
