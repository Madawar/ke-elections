# Kenya Electoral Map: plan (DRAFT, awaiting review)

Status: draft for the owner's review, 2026-11-26. Nothing is built yet.

## What it is
- A public, phone-first web map of Kenya's 47 counties, 290 constituencies and 1,450 wards.
- It shows current office holders and each party's 2027 nominees for every seat.
- Logged-in editors submit nominations, verifiers approve them, and the public sees only
  approved data.
- Private workspaces hold campaign regions, pins and notes.

## Decisions (from the brief)
- **Backend:** Laravel 13 (latest stable, v13.44), **MySQL 8.4**, and Filament 5 for the admin
  panel.
- **Map:** MapLibre GL JS 6.19.
  - It is ESM-only and needs WebGL2, so phones without WebGL2 get a list view instead.
  - There are no API keys.
- **Boundaries:** static files in the repo, never in the database.
- **Joins:** always on IEBC codes, never on names.
- **Real people:**
  - Office holders and nominees are never invented.
  - Sample data is clearly labelled.
  - Real data arrives by CSV import, validated against unit codes.
- **Delivery:** four phases, stopping for review after each.

## Calls I'm making (correct any of these)
1. **Front end:**
   - Blade, Alpine and Vite, with the map as a plain ES module talking to a small JSON API.
   - Filament is used only for the admin panel.
   - I'm not using Livewire or Inertia on the map page, because of bundle size and the risk
     of re-renders breaking the map.
2. **Boundaries:** IEBC 2012 geometry, patched and rebuilt from wards. See
   `docs/boundary-quality-report.md`.
   - Output is plain GeoJSON:
     - Counties, constituencies and provinces load up front.
     - Wards (about 220 KB gzipped) load lazily on drill-down.
   - PMTiles isn't needed at this size.
3. **PWA:**
   - A web app manifest and a Workbox service worker (vite-plugin-pwa).
   - The service worker precaches the app shell, the search index and the boundary files.
   - API calls use stale-while-revalidate.
   - An offline banner shows when the connection drops.
   - No offline basemap tiles, because tile providers' terms forbid or cap them.
4. **Phone UI:**
   - A bottom sheet with three heights (peek, half, full) that you drag by its handle only.
     Above about 768px it becomes a side panel.
   - Tap selects a unit, and hover is used only on devices that support it.
   - The legend is a chip, and filters plus the colour-by selector share one "Filters" sheet.
   - Every unit has a shareable link.
   - A list/table view doubles as the accessible view and the no-WebGL2 fallback.
5. **Colours:**
   - Party colours are set by an admin. ORPP describes colours only in words ("Lilac, White and
     Purple"), so there are no hex values to import.
   - Choropleths use a colour-blind-safe palette for the top parties, with everything else as
     "Other".
   - Status and gaps are shown with hatching as well as colour.
6. **Basemap:**
   - Off by default: boundaries plus town labels.
   - It can be toggled to OpenFreeMap (OSM data, no key), with OSM attribution.
   - The OSM Foundation's own tile servers are never used.
7. **Towns layer:** an OpenStreetMap `place=city|town` extract (ODbL), committed as a static
   file.
8. **Reference data I'd seed, since none of it is about invented people:**
   - **Units:** from Kenya Gazette Notice 13771 of Aug 2026, the 2027 ward schedule.
   - **Parties:** the ORPP register of fully registered parties as at Oct 2026 (107 parties),
     with an alias table for renames such as WDM-K → Wiper Patriotic Front.
9. **Data model additions to the brief:**
   - `units.province` is derived for counties.
   - A `party_aliases` table records renames.
   - Audit uses an append-only `audits` table of old and new JSON per change, with rollback
     implemented as "apply the inverse change", which is itself audited.

## Phases
1. **Boundary pipeline and static map:**
   - A pipeline script (Node and mapshaper) builds the boundary files, and the quality report
     runs as a CI check.
   - The map page offers zoom drill-down, hover/tap highlight, a click panel showing the unit
     and its parents, search, and the PWA shell.
2. **Database and public data:**
   - Migrations, seeders (units, parties, labelled sample holders and nominations) and CSV
     import with per-row validation errors.
   - A public API serving approved data only, plus filters, colour-by and the gaps view.
3. **Accounts and approval:**
   - Login with the admin, verifier, editor and viewer roles. Editors are limited to their
     assigned counties.
   - The submit → approve/reject (with reason) workflow, the audit log and rollback, all in
     Filament.
4. **Workspaces:** campaign regions, pins and notes, private to each workspace, shown as map
   overlays.

**Tests:** Pest covers CSV import validation, the approval workflow, role scoping, the public
API returning approved records only, and the pipeline's code-completeness check.

## Still open
- Who the primary users are. This decides public branding, neutrality and how workspaces are
  shared.
- IEBC/ORPP reuse terms aren't stated. Attribution goes in the README.
