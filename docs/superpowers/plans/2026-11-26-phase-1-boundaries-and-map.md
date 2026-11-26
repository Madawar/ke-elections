# Phase 1: Boundary Pipeline and Map, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, phone-first, installable map of all 47 counties, 290 constituencies and
1,450 wards. Every unit is clickable and joined on IEBC codes. The map runs on Laravel Sail
with Vue and Inertia, and can export a social "locator" image.

**Architecture:**
- A Node pipeline (mapshaper) turns the raw IEBC and Red Cross boundary files into committed
  GeoJSON under `public/boundaries/`. It fails on any code error and writes a build report.
- Laravel serves one Inertia page, `Map`, at `/` and at `/{level}/{code}`, with server-rendered
  meta tags. `UnitDirectory` reads the pipeline's `units.json` to provide them.
- The Vue client loads MapLibre lazily and drives highlight with feature-state.
- It uses a custom bottom sheet. The list view is the fallback when MapLibre can't run.

**Tech Stack:**
- Laravel 13 and Sail (MySQL 8.4).
- Inertia 3, Vue 3.5 + TypeScript, Tailwind 4, shadcn-vue/Reka UI.
- MapLibre GL JS 6.19, mapshaper 0.8.
- vite-plugin-pwa 2.
- Pest for PHP tests; Vitest, @vue/test-utils and happy-dom for JS tests; @turf/turf in tests
  only.

**Spec:**
- `docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`
- `docs/boundary-quality-report.md`

## Global Constraints

- **Versions:**
  - PHP 8.4 or later (Sail runtime), Laravel 13.x, MySQL 8.4.
  - `maplibre-gl@^6.19`, which is ESM-only: use named or namespace imports and call
    `setWorkerUrl` once.
  - `vite-plugin-pwa@^2`.
- **No API keys:**
  - Never request tiles from `tile.openstreetmap.org`.
  - The optional basemap is OpenFreeMap `https://tiles.openfreemap.org/styles/positron`.
- **Codes:**
  - Join everything on IEBC codes, never on names.
  - Names and parent codes come only from `data/reference/iebc_wards_2027_gn13771.csv`.
- **Geometry** lives only in static files and never in the database.
- **No invented people:**
  - Phase 1 shows no office holders or nominees.
  - Seat rows read "No approved data yet".
- **Neutral copy:** no party names or colours anywhere in Phase 1.
- **Feature properties:**
  - Every feature has an integer `code`.
  - Parent properties are `province_code`, `county_code` and `constituency_code`.
  - The levels are `province`, `county`, `constituency` and `ward`.
- **Gzipped size budgets:**

  | File | Budget |
  |---|---|
  | `counties.geojson` | ≤ 120 KB |
  | `constituencies.geojson` | ≤ 180 KB |
  | `wards.geojson` | ≤ 300 KB |
  | `units.json` | ≤ 60 KB |
  | Initial JS, excluding the MapLibre chunk | ≤ 200 KB |

- **Touch targets** are at least 44px.
- **Phone breakpoint:** below 768px the panel is a bottom sheet; above, a side panel.
- **Attribution:** this exact text is shown in the About sheet and on every export:
  `Boundaries: IEBC 2012 delimitation (via mikelmaron/kenya-election-data) · 13 wards: American Red Cross (HDX), CC BY 4.0 · Codes: Kenya Gazette Notice 13771 (2026) · Towns: © OpenStreetMap contributors`.
- **Git:** work on branch `feature/phase-1-map` (git flow). Commit after each task.

### Added by the owner during execution (2026-11-26)
- **Git flow:** `main` holds releases only, and `develop` is where work comes together.
  - Phase work happens on `feature/phase-1-map`, branched from `develop`.
  - Never commit to `main` or `develop` directly.
  - The remote is `github.com/Madawar/ke-elections`, and its default branch is `develop`.
  - Pull requests go from `feature/*` into `develop`.
- **Visual direction A, "Ballot box":**
  - Light ground `#EEF1EF`, surface `#FFFFFF`, ink `#13233A`, muted text `#4C5B6B`, hairlines `#D5DCD8`.
  - Seat colours are the IEBC ballot-paper and box-lid colours: Governor `#3E8FD0`, Senator
    `#F2C230`, Woman Rep `#7A4FA0`, MP `#2E8B57`, MCA `#C8A97E`, President white.
  - Type is Archivo (variable width) only.
  - Dark mode follows direction B, "Tally night": ground `#0F2430`, surface `#16303F`.
  - Mockups: https://claude.ai/artifact/FQP7fsRPSAr7SgiWiE9BTx
- **The UI must not look AI-generated:**
  - No gradient washes, glows, emoji or sparkle icons.
  - No identical rounded cards with the same soft shadow everywhere.
  - No ALL-CAPS eyebrow labels and no "A · B · C" middle-dot meta strings.
  - No "→" tacked onto links, no monospace for data labels, no fade-in-on-scroll.
  - Copy is plain sentence case and specific, never marketing or chatty.
  - Spend boldness in one place: the map and the ballot-lid colour strip.

### Owner feedback on the preview map (2026-11-26): zooms, labels, divisions (binding on Tasks 7–8)
- **Zoom transitions are smooth, not hard cuts.**
  - Don't switch levels with bare `minzoom`/`maxzoom`. Cross-fade over about 0.6 zoom
    either side of each threshold (7 and 9.5): the outgoing level's fill opacity
    interpolates down while the incoming level's interpolates up.
  - Child boundary lines start faintly before their fills take over, so people can see the
    next level coming.
- **Zooming out works as well as zooming in.**
  - A visible "zoom out" control steps back up one level (ward → constituency → county →
    all of Kenya). Breadcrumb links do the same.
  - Keep `maxBounds` around Kenya so the map can't be lost off-screen.
  - When zooming out past a threshold, keep the selected unit's outline, and move the panel
    to the selected unit's ancestor at that level, or leave it unchanged. It must never be
    blank.
  - Double-tap zoom stays on. Pinch-out is never blocked.
- **Labels at every level, with collisions handled:**

  | Level | Shown from zoom | Style |
  |---|---|---|
  | County | Up to about 7.5, then fades | Medium weight |
  | Constituency | About 6.8 to 10 | Regular |
  | Ward | About 9.3 and up | Smaller |

  - These are MapLibre symbol layers using the self-hosted glyphs, placed at the label
    points from `labels.geojson`.
  - `text-allow-overlap` is off, `text-padding` is set, and sort keys favour bigger units.
  - At each level the selected unit's label wins, and the labels of its parent stay
    visible faintly.
  - Towns appear only where they don't collide with unit labels.
  - Labels never cover the bottom sheet's safe area: use map padding.
- **Divisions read as a hierarchy at every zoom:**
  - County borders: the thickest and darkest at all zooms.
  - Constituency borders: medium weight, from about 6.5.
  - Ward borders: the thinnest, from about 9.
  - Widths interpolate with zoom.
  - The coast and the outline of Kenya read clearly against the ground.
  - The selected unit gets a strong ink outline above every other line.
- **Tests (Task 7):**
  - Pure-function tests for the opacity and visibility ramps, e.g.
    `levelOpacity(level, zoom)` is 1 inside a level's band, 0 well outside it, and in
    between across the fade.
  - A test for `zoomOutTarget(selection)`, which returns the parent level's unit and its
    bounds.
- **Browser check (Task 11):** step from ward up to the whole of Kenya with the control and
  with pinch-out, at 390×844, and check labels for collisions at zooms 5, 7, 9 and 11.

## Review Focus

1. **Repeated ward names:** Huruma (713 and 1447), Lelan (659 and 735) and Mwiki. Search
   results and page titles must show the parent so people can tell them apart. Tested in
   Task 8 (`search` tests) and Task 6 (title test).
2. **Bad deep links:** `/ward/0`, `/ward/1451`, `/county/48` and `/ward/abc` must give a 404
   page, not a blank map. Tested in Task 6.
3. **Punctuation in names:** `Cherang'any/Chebororwa` (737) and `Embobut / Embulot` (734) must
   be HTML-escaped in titles and findable without the punctuation. Tested in Tasks 6 and 8.
4. **Phones without WebGL2** (MapLibre 6 throws on them) must get the list view, not a blank
   screen. Tested in Task 7 (`useMap` unsupported test).
5. **Repeat visits offline** must still show the boundaries. Tested in Task 10 (the precache
   manifest test).

---

### Task 1: Scaffold the app with Sail, MySQL, the test runners and CI

**Files:**
- Create: the Laravel Vue starter kit at the repo root, `compose.yaml`, `vitest.config.ts` and
  `.github/workflows/ci.yml`.
- Modify: `.gitignore` (merge in the kit's entries and keep `boundaries/raw/`), `README.md`
  (add a "Development" section), `.env.example` and `phpunit.xml`.
- Test: `tests/Feature/HomeTest.php`

- [ ] **Step 1:** Create branch `phase-1-map`.
- [ ] **Step 2:** Install the kit into a temporary directory and move it into the repo root,
  keeping the existing `docs/`, `boundaries/`, `data/` and `README.md`:

  `composer global require laravel/installer && laravel new /tmp/kem --vue --pest --database=mysql --no-interaction`
- [ ] **Step 3:** Run `php artisan sail:install --with=mysql`, then set up `.env.example`:
  - `APP_NAME="Kenya Electoral Map"`
  - `APP_PORT=8080`
  - `DB_HOST=mysql`
  - `DB_DATABASE=electoral_map`
  - `DB_USERNAME=sail`
  - `DB_PASSWORD=password`

  In `phpunit.xml`, set `DB_CONNECTION=mysql` and `DB_DATABASE=testing`. Sail creates the
  `testing` database.
- [ ] **Step 4:** Add Vitest with happy-dom, @vue/test-utils and @turf/turf as dev
  dependencies:
  - `vitest.config.ts` includes `tests/js/**/*.test.{ts,mjs}`.
  - Add the npm scripts `"test:js": "vitest run --passWithNoTests"`,
    `"boundaries:fetch": "bash boundaries/scripts/fetch_sources.sh"` and
    `"boundaries:build": "node boundaries/pipeline/build.mjs"`.
- [ ] **Step 5:** Write `tests/Feature/HomeTest.php`: `get('/')->assertOk()`.
- [ ] **Step 6:** Run `./vendor/bin/sail up -d && ./vendor/bin/sail artisan test && ./vendor/bin/sail npm run test:js`.
  Expected: PASS.
- [ ] **Step 7:** Write the CI workflow `ci.yml`:
  - Runs on push and pull requests.
  - Uses PHP 8.4, with a `mysql:8.4` service providing a `testing` database.
  - Runs `composer install`, `npm ci`, `npm run build`, `php artisan test` and
    `npm run test:js`.
- [ ] **Step 8:** Add "Development" to the README: clone, `cp .env.example .env`, install
  dependencies with the `laravelsail/php84-composer` Docker image, `sail up -d`,
  `sail artisan key:generate`, `sail npm ci` and `sail npm run dev`. Then commit:
  `chore: scaffold Laravel 13 + Vue/Inertia starter kit with Sail and MySQL`.

### Task 2: Pipeline foundations (gazette, provinces, code validation)

**Files:**
- Create: `boundaries/pipeline/gazette.mjs`, `boundaries/pipeline/validate.mjs` and
  `boundaries/overrides/provinces.csv`
- Test: `tests/js/boundaries/gazette.test.mjs` and `tests/js/boundaries/validate.test.mjs`

**Interfaces:**
- Produces:
  - `loadGazette(csvText: string)` returns
    `{ wards: Map<number,{code,name,constituencyCode,countyCode}>, constituencies: Map<number,{code,name,countyCode}>, counties: Map<number,{code,name}> }`.
    It throws on a non-integer code or a conflicting parent.
  - `loadProvinces(csvText: string)` returns `Map<countyCode:number, {code:number,name:string}>`.
  - `validateCodes(features, { key: string, expected: number })` returns
    `{ ok: boolean, missing: number[], duplicates: number[], outOfRange: number[], empty: number[] }`.
- `provinces.csv` has the columns `county_code,province_code,province_name`:

  | Province | Code | County codes |
  |---|---|---|
  | Coast | 1 | 1–6 |
  | North Eastern | 2 | 7–9 |
  | Eastern | 3 | 10–17 |
  | Central | 4 | 18–22 |
  | Rift Valley | 5 | 23–36 |
  | Western | 6 | 37–40 |
  | Nyanza | 7 | 41–46 |
  | Nairobi | 8 | 47 |

- [ ] **Step 1: Write the failing tests.**
  - `loadGazette` on the real CSV:
    - The maps hold 1450 wards, 290 constituencies and 47 counties.
    - `wards.get(735)` deep-equals `{code:735,name:'Lelan',constituencyCode:148,countyCode:28}`.
    - `wards.get(1448).name === 'Ngei'`.
    - `constituencies.get(148).countyCode === 28`.
  - It throws on the text `"county_code,...\nx,..."`.
  - `loadProvinces`:
    - The map has 47 entries and 8 distinct province codes.
    - County 47 maps to `{code:8,name:'Nairobi'}`, county 7 to `{code:2,name:'North Eastern'}`
      and county 1 to `{code:1,name:'Coast'}`.
  - `validateCodes`:
    - Codes `[1,2,2,4]` with `expected:4` give `missing:[3]`, `duplicates:[2]` and `ok:false`.
    - Code `0` gives `outOfRange:[0]`.
    - A feature with `geometry:null` gives `empty:[code]`.
    - Codes `[1,2,3,4]` give `ok:true`.
- [ ] **Step 2:** Run `npm run test:js -- tests/js/boundaries`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement both modules and `provinces.csv`. Parse with a small CSV reader
  that handles quoted fields.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(boundaries): gazette loader, province map and code validation`.

### Task 3: Ward assembly (IEBC base, Red Cross patches, cleaning)

**Files:**
- Create: `boundaries/pipeline/wards.mjs` and `boundaries/overrides/ward_patches.csv`
- Test: `tests/js/boundaries/wards.test.mjs`, plus `tests/js/boundaries/fixtures/{iebc,arc}.geojson`

**Interfaces:**
- Consumes: `loadGazette` and `validateCodes` (Task 2).
- Produces: `assembleWards({ iebc, arc, patches, gazette })` returns
  `Promise<{ wards: FeatureCollection, log: {step:string, detail:object}[] }>`.
  - `iebc` and `arc` are GeoJSON FeatureCollections. The IEBC code is in `COUNTY_ASS`, and the
    Red Cross ID is in `uid`.
  - `patches` is `{iebcCode:number, arcUid:string}[]`.
  - Output properties are exactly `{code,name,constituency_code,county_code}`. Names and
    parents come from the gazette.
  - It throws with the validation result unless `validateCodes(..., {key:'code', expected:1450})`
    is ok. In fixture tests, `expected` is passed in.
- `parsePatches(csvText)` returns `{iebcCode, arcUid}[]`.

`ward_patches.csv` has the columns `iebc_code,arc_uid,arc_name,arc_county,gazette_name`. These
rows were each verified by name, county and location:

```
50,aom47Uzq1RZ,Kasemeni Ward,Kwale,Kasemeni
210,Z9zNkBFLY9r,SHAMBIR FATUMA,MANDERA,Shimbir Fatuma
287,ZVoIw8oAOWZ,Abothuguchi west Ward,MERU,Abothuguchi West
571,B1GDVDYIGwK,Gatongora Ward,Kiambu,Gatongora
572,Lc6GluslY9h,Kahawa/sukari Ward,Kiambu,Kahawa Sukari
573,w3MNsmpJJHX,Kahawa Wendani Ward,Kiambu,Kahawa Wendani
575,KoIp1GKz0UI,Mwiki Ward,Kiambu,Mwiki
576,dnLaU3RrCnp,Mwihoko Ward,Kiambu,Mwihoko
640,AY46zJ3BT9H,Lokori/kochodin Ward,TURKANA,Lokori/Kochodin
676,zkVfk8cWPc2,Kapomboi Ward,TRANS NZOIA,Kapomboi
734,u6ONpoWIV0d,Embobut/Embulot Ward,ELGEYO-MARAKWET,Embobut / Embulot
735,qsljIZxApCc,Lelan Ward,ELGEYO-MARAKWET,Lelan
1448,tsmsPb6qMFa,Ngei Ward,Nairobi,Ngei
```

**How `assembleWards` works:**
1. Drop features whose code is `≤0` or whose geometry is empty, and log each one.
2. Merge pieces that share a code (mapshaper `-dissolve2 COUNTY_ASS`) and log the merges.
3. Throw if a patch's code already exists in the IEBC data, or if its `arcUid` isn't found.
4. Erase the patch polygons from the IEBC layer (`-erase`), then merge the layers.
5. Run `-clean` (gap-fill and snapping) and log mapshaper's messages.
6. Join gazette attributes by code, and log every name or parent that differs from the source
   attributes.

All of this is run through `mapshaper.applyCommands`, in memory.

- [ ] **Step 1: Write the failing tests** against the fixtures:
  - The IEBC fixture has a square for code 1, a rectangle for code 2 that swallows code 3's
    area, a code-0 sliver, and two pieces with code 1.
  - The Red Cross fixture has uid `X3` covering code 3's area.
  - Tests:
    - The output codes are `[1,2,3]`.
    - Code 2's area is smaller than its input area.
    - The overlap between any two outputs is below 1e-9 (turf intersect area).
    - The log has a `dropped` entry for code 0 and a `merged` entry for code 1.
  - A patch with an unknown uid throws `/arc uid X9 not found/`.
  - A patch for an existing code throws `/already present/`.
  - `parsePatches` on the real CSV returns 13 rows, and row 12 is `{iebcCode:735, arcUid:'qsljIZxApCc'}`.
- [ ] **Step 2:** Run `npm run test:js -- tests/js/boundaries/wards.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `wards.mjs` and `parsePatches`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(boundaries): assemble 1,450 wards with reviewed Red Cross patches`.

### Task 4: Derive the layers, simplify, write the outputs and the build report

**Files:**
- Create:
  - `boundaries/pipeline/derive.mjs`, `boundaries/pipeline/outputs.mjs`,
    `boundaries/pipeline/report.mjs` and `boundaries/pipeline/build.mjs`
  - The generated `public/boundaries/{provinces,counties,constituencies,wards,labels}.geojson`,
    `public/boundaries/units.json`, `public/boundaries/manifest.json` and
    `boundaries/build-report.md`
- Test: `tests/js/boundaries/outputs.test.mjs`, which runs against the committed outputs

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - `deriveLayers(wards, gazette, provinces)` returns
    `Promise<{ constituencies, counties, provinces }>`. Each is a dissolve of the simplified
    wards on the gazette parent code:
    - Constituencies: `{code,name,county_code}`.
    - Counties: `{code,name,province_code}`.
    - Provinces: `{code,name}`.
  - `buildUnitsIndex(layers)` returns `Unit[]`, where
    `Unit = { l: 'province'|'county'|'constituency'|'ward', c: number, n: string, p: number|null, b: [number,number,number,number] }`:
    - `p` is the code of the immediate parent (province for a county), or `null` for a
      province.
    - `b` is the bounding box, rounded to 4 decimal places.
  - `labelPoints(layers)` returns a FeatureCollection of points `{level,code,name}`, placed at
    each polygon's inner point (mapshaper `-points inner`).
  - `writeOutputs(dir, files)` writes the files at 5-decimal precision and writes
    `manifest.json` as `{ "<file>": "<first 8 hex chars of sha256>" }`.
  - `renderReport(log, stats)` returns Markdown.
- `build.mjs`:
  - Reads `boundaries/raw/mikelmaron/data/wards.geojson`, the Red Cross shapefile, the gazette,
    `provinces.csv` and `ward_patches.csv`.
  - Simplifies the wards with `-simplify 2% keep-shapes` **before** dissolving, so all layers
    share the same lines.
  - Writes the outputs and the report.
  - Exits non-zero if any validation fails.

- [ ] **Step 1: Write the failing `outputs.test.mjs`:**
  - **Counts:** each file has unique `code`s covering exactly 1..N, with N = 8, 47, 290 and
    1450.
  - **Parents:**
    - Every ward's `constituency_code` and `county_code` equal the gazette's.
    - Every constituency's `county_code` equals the gazette's.
    - Every county's `province_code` equals `provinces.csv`.
  - **Geometry:**
    - Every feature has an area above 0.
    - Every ward's inner label point is inside its constituency polygon, and every
      constituency's is inside its county (turf `booleanPointInPolygon`).
  - **Units index:** `units.json` has 1795 entries, and every `b` is inside
    `[33.5,-5.0,42.5,5.5]`.
  - **Manifest:** its hashes match the file contents.
  - **Sizes:** the gzipped sizes are within the budgets in Global Constraints.
- [ ] **Step 2:** Run `npm run test:js -- tests/js/boundaries/outputs.test.mjs`. Expected:
  FAIL (no outputs).
- [ ] **Step 3:** Implement the four modules.
- [ ] **Step 4:** Run `npm run boundaries:fetch && npm run boundaries:build`. Expected: exit 0
  and a printed summary of 8 / 47 / 290 / 1450.
- [ ] **Step 5:** Read `boundaries/build-report.md`. It must list:
  - The 13 patches.
  - The dropped slivers.
  - The merged duplicate codes 224, 280, 289, 398, 678 and 1230.
  - The 19 parent corrections and 24 name corrections from the gazette.
- [ ] **Step 6:** Run the outputs test. Expected: PASS.
- [ ] **Step 7:** Commit the code, the outputs and the report:
  `feat(boundaries): derive nested layers and web-ready outputs`.

### Task 5: Towns layer and self-hosted label glyphs

**Files:**
- Modify: `boundaries/scripts/fetch_sources.sh`. Add an Overpass POST to
  `https://overpass-api.de/api/interpreter` with this query, saving the result to
  `boundaries/raw/osm/towns.json`:

  `[out:json][timeout:60];area["ISO3166-1"="KE"][admin_level=2]->.a;node["place"~"^(city|town)$"](area.a);out;`
- Modify: `boundaries/pipeline/build.mjs`
- Create: `boundaries/pipeline/towns.mjs`, `boundaries/scripts/fetch_glyphs.sh`, the
  generated `public/boundaries/towns.geojson` and `public/glyphs/`
- Test: `tests/js/boundaries/towns.test.mjs`

**Interfaces:**
- `toTownsGeoJSON(overpassJson)` returns a FeatureCollection of points
  `{name, place:'city'|'town', population:number|null}`:
  - It drops elements without a name or outside `[33.5,-5.0,42.5,5.5]`.
  - It parses `population` as an integer, or `null` when it can't.
- `fetch_glyphs.sh` downloads `Noto Sans Regular` and `Noto Sans Medium`, ranges `0-255` and
  `256-511`, from `https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts/`
  into `public/glyphs/<fontstack>/<range>.pbf`.

- [ ] **Step 1: Write the failing tests:**
  - **Fixture:** three elements (one unnamed, one outside the bounding box, one valid with
    population `"12,000"`) give one feature with `population:12000`.
  - **Real output:**
    - `towns.geojson` has at least 50 features, at least one with `place:'city'`, and every
      coordinate inside the bounding box.
    - All 4 glyph files exist and are larger than 1 KB.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the module, call it from `build.mjs`, and run the fetch and build
  commands.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(boundaries): OSM towns layer and self-hosted glyphs`.

### Task 6: Unit directory, routes and server-rendered meta tags

**Files:**
- Create: `app/Support/UnitDirectory.php`, `app/Http/Controllers/MapController.php` and
  `resources/js/pages/Map.vue` (a placeholder shell that renders `unit?.name`)
- Modify: `routes/web.php` (replace the starter kit's `/` welcome route) and
  `resources/views/app.blade.php` (add the meta tags)
- Test: `tests/Unit/UnitDirectoryTest.php` and `tests/Feature/MapPageTest.php`

**Interfaces:**
- Consumes: `public/boundaries/units.json` (Task 4).
- `UnitDirectory`, registered as a singleton:
  - `__construct(string $path)`, bound to `public_path('boundaries/units.json')`.
  - `find(string $level, int $code): ?array` returns `{level, code, name, parentCode}`.
  - `ancestors(string $level, int $code): array` returns the nearest ancestor first, ending
    with the province.
  - `children(string $level, int $code): array`
- Routes:
  - `GET /` is named `map.home`.
  - `GET /{level}/{code}` is named `map.unit`, with `level` restricted to
    `county|constituency|ward` and `code` to `[0-9]+`. It aborts with 404 when the unit isn't
    found.
- Both routes call `Inertia::render('Map', ['unit' => ?{level,code,name,ancestors:[{level,code,name}]}])`
  with `->withViewData('meta', ['title'=>..., 'description'=>..., 'url'=>...])`.
- **Title:** `"{name} {Level} — Kenya Electoral Map"`, for example
  `Ngei Ward — Kenya Electoral Map`. On the home page it's just `Kenya Electoral Map`.
- **Description:** `"{name} ward, {constituency} constituency, {county} county. Seats, office holders and 2027 nominations."`,
  adjusted for each level.
- **Open Graph tags:** `og:title`, `og:description`, `og:url` and
  `og:image` = `/images/og-default.png`, a static 1200×630 image created in this task.

- [ ] **Step 1: Write the failing tests:**
  - **Unit test:**
    - `find('ward',1448)['name'] === 'Ngei'`.
    - `ancestors('ward',1448)` names are `['Mathare','Nairobi City','Nairobi']`.
    - `children('county',47)` has a count of 17.
    - `find('ward',1451) === null`.
  - **Feature tests:**
    - `/ward/1448` gives 200, contains `<title>Ngei Ward — Kenya Electoral Map</title>`, and
      has an `og:url` ending in `/ward/1448`. The Inertia component is `Map` with
      `unit.code` = 1448.
    - `/ward/713` and `/ward/1447` (both Huruma) have different descriptions, naming Turbo and
      Mathare respectively.
    - `/ward/737`'s `<title>` contains `Cherang&#039;any/Chebororwa`.
    - `/ward/0`, `/ward/1451`, `/county/48`, `/ward/abc` and `/province/1` each give 404.
    - `/` gives 200 with `<title>Kenya Electoral Map</title>`.
- [ ] **Step 2:** Run `sail artisan test --filter=Unit` (matching `UnitDirectoryTest` and
  `MapPageTest`). Expected: FAIL.
- [ ] **Step 3:** Implement the code.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: unit routes with server-rendered meta for share previews`.

### Task 6b: Visual direction (owner picks before any UI task)

**Files:**
- Create: `docs/design/visual-direction.md`, which records the chosen tokens:
  - Colour tokens for light and dark, including map fills and lines.
  - Type: a display face and a UI face, with sizes.
  - Radius, elevation and motion.
  - Map line weights per level.
- Modify: `resources/css/app.css`, setting Tailwind 4 `@theme` tokens from the doc.

- [ ] **Step 1:** Load the `frontend-design` skill.
- [ ] **Step 2:** Build 2–3 distinct directions as one clickable mockup artifact, each showing
  the phone map, the sheet at half height and the square export card. The look should be
  striking, fast and readable in sunlight, and must still meet the neutrality constraint.
- [ ] **Step 3:** The owner picks a direction or blends them. Record the choice in
  `visual-direction.md` and set the `@theme` tokens.
- [ ] **Step 4:** Commit: `design: visual direction and theme tokens`.

From here on, Tasks 7–10 use these tokens. Hard-coded colours or fonts in components count as
review failures.

### Task 7: Map core (MapLibre, drill-down, hover and select)

**Files:**
- Create:
  - `resources/js/lib/map/levels.ts`, `resources/js/lib/map/urls.ts`,
    `resources/js/lib/map/style.ts` and `resources/js/lib/map/webgl.ts`
  - `resources/js/composables/useMap.ts`
  - `resources/js/components/map/MapView.vue`
- Modify: `resources/js/pages/Map.vue`
- Test: `tests/js/map/levels.test.ts`, `tests/js/map/urls.test.ts`, `tests/js/map/style.test.ts`
  and `tests/js/map/useMap.test.ts`

**Interfaces:**
- `levels.ts`:
  - `type Level = 'province'|'county'|'constituency'|'ward'`
  - `CONSTITUENCY_MIN_ZOOM = 7` and `WARD_MIN_ZOOM = 9.5`
  - `levelForZoom(z): 'county'|'constituency'|'ward'`
  - `childLevel(l): Level|null`
- `urls.ts`:
  - `unitPath(level, code): string`
  - `parseUnitPath(path): {level, code}|null`, which only accepts `county`, `constituency`
    and `ward`.
- `style.ts`:
  - `buildStyle({ manifest }): StyleSpecification`:
    - Sources `provinces`, `counties` and `constituencies`, each with `promoteId:'code'` and a
      URL of `/boundaries/<f>.geojson?v=<hash>`.
    - Glyphs from `/glyphs/{fontstack}/{range}.pbf`.
    - Layer ids `<source>-fill`, `<source>-line` and `labels-<level>`, plus `towns`.
  - `wardLayers(manifest): {source, layers}`, added lazily.
  - `fillColor(mode: 'none'|'province', level, provinceOfCounty: Map<number,number>): ExpressionSpecification`
  - Fill opacity and outline width read feature-state `hover` and `selected`.
  - **Visibility:**

    | Layer | Fill visible from | Fill visible below | Lines visible |
    |---|---|---|---|
    | Counties | 0 | 7 | Always |
    | Constituencies | 7 | 9.5 | From zoom 7 |
    | Wards | 9.5 | — | From zoom 9.5 |

- `webgl.ts`: `supportsWebGL2(create = () => document.createElement('canvas')): boolean`
- `useMap(container: Ref<HTMLElement|null>, opts: { manifest, onSelect(u:{level,code}), onHover(u|null, point), onUnsupported() })`
  returns `{ select(level, code, {fit:boolean}), setPadding(bottom:number), setColorMode(mode), setBasemap(on:boolean), exportView(...) }`.
  - It imports `maplibre-gl` dynamically.
  - It calls `onUnsupported` when `supportsWebGL2()` is false or the `Map` constructor throws.
  - Hover is used only when `matchMedia('(hover: hover)')` matches.
  - A click picks the top feature at `levelForZoom(map.getZoom())`, selects it and fits to its
    bounds with padding.
  - The ward source loads the first time the zoom reaches `WARD_MIN_ZOOM - 0.5`, or on a ward
    deep link.
  - Selecting updates `history.pushState` with `unitPath`.
  - `setBasemap(true)` calls `setStyle(OPENFREEMAP_POSITRON, { transformStyle })`, keeping our
    sources and layers on top. `setBasemap(false)` restores `buildStyle`.

- [ ] **Step 1: Write the failing tests:**
  - `levelForZoom`: 6.9 gives `'county'`, 7 and 9.49 give `'constituency'`, 9.5 gives
    `'ward'`.
  - `childLevel`: `'county'` gives `'constituency'`, `'ward'` gives `null`.
  - `unitPath('ward',1448)` gives `'/ward/1448'`.
  - `parseUnitPath`:
    - `'/ward/1448'` gives `{level:'ward',code:1448}`.
    - `'/ward/abc'`, `'/province/1'` and `'/'` give `null`.
  - `buildStyle`:
    - Has no `wards` source.
    - Every source URL carries `?v=` and the manifest hash.
    - `glyphs === '/glyphs/{fontstack}/{range}.pbf'`.
    - `counties-fill` has `maxzoom: 7`.
  - `fillColor('province','ward',…)` is a `match` expression on `county_code` covering 47
    counties.
  - `useMap`:
    - With `supportsWebGL2` mocked to false, it calls `onUnsupported` once and never imports
      `maplibre-gl` (`vi.mock`).
    - With `Map` mocked to throw, it also calls `onUnsupported`.
- [ ] **Step 2:** Run `npm run test:js -- tests/js/map`. Expected: FAIL.
- [ ] **Step 3:** Implement the modules. `MapView.vue` mounts `useMap`, and `Map.vue`
  provides the full-screen layout.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Run `sail npm run dev` and open `http://localhost:8080`. Expected:
  - Counties are visible.
  - Zooming in drills down to constituencies, then wards.
  - Clicking highlights a unit and changes the URL.
- [ ] **Step 6:** Commit: `feat(map): MapLibre drill-down with feature-state hover and select`.

### Task 8: Panel, bottom sheet, search, list view, tooltip, legend and About sheet

**Files:**
- Create:
  - `resources/js/lib/units.ts` and `resources/js/lib/search.ts`
  - `resources/js/components/map/BottomSheet.vue`, `UnitPanel.vue`, `SearchBox.vue`,
    `UnitList.vue`, `HoverTooltip.vue`, `Legend.vue` and `AboutSheet.vue`
- Modify: `resources/js/pages/Map.vue`
- Test: `tests/js/units.test.ts`, `tests/js/search.test.ts` and `tests/js/components/BottomSheet.test.ts`

**Interfaces:**
- `units.ts`:
  - `class UnitIndex`:
    - `static async load(url)`
    - `get(level, code): Unit|undefined`
    - `ancestors(level, code): Unit[]`
    - `children(level, code): Unit[]`
    - `all(): Unit[]`
  - `seatsFor(level)`:

    | Level | Seats |
    |---|---|
    | County | `['Governor','Senator','Woman Representative']` |
    | Constituency | `['Member of the National Assembly']` |
    | Ward | `['Member of County Assembly']` |

- `search.ts`:
  - `normalise(s)` lower-cases, strips diacritics and apostrophes, and turns `/` and `-` into
    spaces.
  - `searchUnits(index, query, limit = 8)` returns `{unit, ancestors}[]`:
    - Every query token must prefix-match a token of the name.
    - Ranking is: exact name, then name prefix, then the rest. Ties go to the higher level
      (county before constituency before ward).
- `BottomSheet.vue`:
  - Props: `snap: 'peek'|'half'|'full'` (v-model).
  - Emits `height(px)`.
  - Snap heights: peek is 112px, half is `50dvh`, full is `calc(100dvh - 72px)`.
  - Dragging works only from the handle and header (`touch-action:none`). Content scrolls only
    at `full`.
  - The handle is a `<button>`: Enter cycles the snaps, and ArrowUp/ArrowDown move up or down.
  - It respects `env(safe-area-inset-bottom)`.
  - At 768px and above it renders as a 380px left side panel.
- `UnitPanel.vue` shows:
  - The name and level.
  - A breadcrumb of ancestor links.
  - A seat list, each seat reading "No approved data yet".
  - The children as links, with counts (for example "17 constituencies · 85 wards").
  - "Copy link" and "Share image" buttons (Task 9).
- `Map.vue`:
  - Adds an `aria-live="polite"` region that announces `Selected: {name} {level}, {ancestors}`.
  - Shows `UnitList` when `onUnsupported` fires, or when the "List" toggle is used.
  - `AboutSheet` shows the exact attribution string from Global Constraints.
  - The legend chip shows the colour modes `None` and `Former province`.

- [ ] **Step 1: Write the failing tests:**
  - `UnitIndex` on the real `units.json`:
    - `children('county',47).length === 17`.
    - `ancestors('ward',1448).map(u=>u.n)` equals `['Mathare','Nairobi City','Nairobi']`.
    - `seatsFor('ward')` equals `['Member of County Assembly']`.
  - Search:
    - `'huruma'` returns 2 wards, with first ancestors Turbo and Mathare.
    - `'cherangany'` finds ward 737.
    - `'embobut'` finds 734.
    - `'kisumu'` returns county 42 first.
    - An empty or whitespace query returns `[]`.
    - The number of results never exceeds the limit.
  - `BottomSheet`:
    - Pressing Enter on the handle moves the snap from peek to half to full and back to peek.
    - A `pointermove` on the content area doesn't change the snap.
    - It emits `height` when the snap changes.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the code, and connect the sheet height to `setPadding` so the
  selected unit stays visible above the sheet.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(map): bottom sheet panel, search, list view and legend`.

### Task 9: Social export of the "locator" card

**Files:**
- Create:
  - `resources/js/lib/export/sizes.ts`, `resources/js/lib/export/renderMapImage.ts`,
    `resources/js/lib/export/rasterize.ts` and `resources/js/lib/export/share.ts`
  - `resources/js/components/export/LocatorCard.vue` and `resources/js/components/export/ExportDialog.vue`
  - `public/fonts/NotoSans-{Regular,Bold}.woff2` (OFL)
- Test: `tests/js/export/sizes.test.ts`, `tests/js/export/share.test.ts` and `tests/js/export/LocatorCard.test.ts`

**Interfaces:**
- `sizes.ts`:
  - `CARD_SIZES = { square:{w:1080,h:1080}, portrait:{w:1080,h:1350}, story:{w:1080,h:1920}, landscape:{w:1200,h:630} } as const`
  - `exportFilename(level, code, size)` gives `kenya-electoral-map-<level>-<code>-<size>.png`
- `renderMapImage({ style, bounds, width, height, highlight:{level,code} })` returns
  `Promise<string>` (a PNG data URL):
  - It creates a hidden, fixed-size MapLibre map with `preserveDrawingBuffer:true` and
    `pixelRatio:1`.
  - It calls `fitBounds`, waits for `idle`, reads the canvas, then removes the map.
- `svgToPng(svg: SVGSVGElement, width, height, fontFaces: {family, url}[])` returns
  `Promise<Blob>`:
  - It fetches the fonts into data URIs and inlines `@font-face` into a `<style>` in the SVG.
  - It serialises the SVG, draws it with `Image` onto a canvas, and calls `canvas.toBlob`.
- `shareOrDownload(blob, filename, title)`: uses
  `navigator.share({files:[File], title})` when `navigator.canShare?.({files})`, and otherwise
  downloads through an `<a download>` link to an object URL.
- `LocatorCard.vue`:
  - Props: `{ size, unit, ancestors, seats, mapImage, sample:boolean, asOf:string, url:string }`.
  - Renders an `<svg viewBox="0 0 w h">` containing:
    - The title (unit name and level).
    - The breadcrumb.
    - The map image.
    - The seat list.
    - The footer: the attribution string, `asOf` and the URL.
    - When `sample` is set, a diagonal `SAMPLE DATA` watermark.
- `ExportDialog.vue`: a size picker, a live preview, and "Download" and "Share" buttons.

- [ ] **Step 1: Write the failing tests:**
  - `CARD_SIZES` deep-equals the values above.
  - `exportFilename('ward',1448,'square')` gives
    `'kenya-electoral-map-ward-1448-square.png'`.
  - `shareOrDownload`:
    - When `canShare` returns true, it calls `navigator.share` with a single `File` whose name
      is the filename.
    - Otherwise it clicks an anchor whose `download` is the filename.
  - `LocatorCard` in happy-dom:
    - The SVG's `viewBox` is `'0 0 1080 1350'` for portrait.
    - The text includes `Ngei`, `Mathare`, `Nairobi City`, the attribution string and
      `/ward/1448`.
    - `SAMPLE DATA` is absent when `sample:false` and present when `sample:true`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the code. The panel's "Share image" button opens `ExportDialog`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** In a browser at 390×844, export the square and story sizes for `/ward/1448`.
  Expected:
  - The PNGs have the exact pixel sizes.
  - The map shows the highlighted ward.
  - Text renders in Noto Sans.
- [ ] **Step 6:** Commit: `feat(export): social locator card in four sizes with share/download`.

### Task 10: PWA (manifest, service worker, offline banner)

**Files:**
- Modify: `vite.config.ts`, `resources/js/app.ts`, `resources/views/app.blade.php` and
  `.gitignore` (ignore `public/sw.js`, `public/workbox-*.js` and
  `public/manifest.webmanifest`)
- Create: `resources/icons/icon.svg`, `public/icons/{pwa-192,pwa-512,maskable-512,apple-touch-180}.png`
  and `resources/js/components/OfflineBanner.vue`
- Test: `tests/Feature/PwaTest.php` and `tests/js/pwa-build.test.ts`

**Interfaces:**
- `VitePWA` options:
  - `{ registerType:'autoUpdate', outDir:'public', filename:'sw.js', scope:'/', base:'/', buildBase:'/build/', manifestFilename:'manifest.webmanifest' }`
  - The manifest:
    - `name:'Kenya Electoral Map'`, `short_name:'Electoral Map'`.
    - `start_url:'/'`, `display:'standalone'`.
    - `theme_color` and `background_color` from the design tokens.
    - The icons 192, 512 and maskable 512.
  - `workbox`:
    - `{ globDirectory:'public', globPatterns:['build/**/*.{js,css,woff2}','boundaries/*.{geojson,json}','glyphs/**/*.pbf','fonts/*.woff2','icons/*.png'], navigateFallback:null, maximumFileSizeToCacheInBytes: 3_000_000 }`
    - `runtimeCaching`: navigations use `NetworkFirst` (cache `pages`,
      `networkTimeoutSeconds: 3`). `tiles.openfreemap.org` is `NetworkOnly`.
- `app.ts` registers the service worker through `virtual:pwa-register`.
- `OfflineBanner` shows "You're offline: showing saved map data" while `navigator.onLine` is
  false.

- [ ] **Step 1: Write the failing tests:**
  - **Pest:** `/` HTML contains `<link rel="manifest" href="/manifest.webmanifest">`,
    `<meta name="theme-color"` and `apple-touch-icon`.
  - **`pwa-build.test.ts`**, which runs after `npm run build` (as CI does):
    - `public/sw.js` exists.
    - Its precache list includes `boundaries/wards.geojson`, `boundaries/units.json` and a
      `glyphs/` entry.
    - `public/manifest.webmanifest` has icons of size 192 and 512, plus one with
      `purpose` including `maskable`.
- [ ] **Step 2:** Run `sail npm run build && sail artisan test --filter=Pwa && sail npm run test:js -- tests/js/pwa-build.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement the code and generate the icons from `icon.svg`
  (@vite-pwa/assets-generator).
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(pwa): installable app with offline boundaries`.

### Task 11: Docs and end-to-end verification

**Files:**
- Modify: `README.md`, adding:
  - **Setup with Sail.**
  - **Data sources and licences:** add the OSM ODbL, Noto Sans OFL and OpenFreeMap entries.
  - **Updating boundaries:** `boundaries:fetch`, then `boundaries:build`, then review
    `build-report.md`, then run the tests, then commit.
  - **Project status.**

- [ ] **Step 1:** Write the README sections.
- [ ] **Step 2:** Run the full suite:
  `sail artisan test && sail npm run build && sail npm run test:js`. Expected: all PASS.
- [ ] **Step 3: Browser check at a phone viewport (390×844) and on desktop:**
  - Tapping drills down from county to constituency to ward.
  - The sheet snaps correctly.
  - Search for "huruma" shows both wards with their parents.
  - `/ward/1448` loads selected.
  - The list view opens.
  - Reload offline (DevTools) and the map still shows boundaries.
  - Lighthouse PWA is installable.
- [ ] **Step 4:** Run `/code-review` on the branch and fix confirmed findings.
- [ ] **Step 5:** Commit and push branch `feature/phase-1-map` and open a PR into `develop` for the owner's review.
