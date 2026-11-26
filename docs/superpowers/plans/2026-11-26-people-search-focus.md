# People Search and Focus Mode: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. Search finds politicians by name as well as places.
2. Selecting a county, constituency or ward shows only that unit: nothing outside it is drawn.

**Architecture:** both features are client-side, built on data the page already loads.
- People search reads `SeatsData.holders` from `/data/seats.json`.
- Focus mode is a set of MapLibre filters built from IEBC codes, using the `UnitIndex`
  parent/child relations and the code properties already on every feature:
  - Wards: `code`, `constituency_code`, `county_code`.
  - Towns: `ward_code`, `constituency_code`, `county_code`.
  - Stations: `ward_code`.
  - Labels: `level`, `code`.
- There is no geometry clipping and no new boundary files.

**Tech stack:** Vue 3.5 + TypeScript, MapLibre GL JS 6, Vitest + @vue/test-utils + happy-dom.

**Spec:** owner request (2026-11-26):
- "Can we get to search by politician name too?"
- "When I click a county or area is it possible to dim out completely every other section of
  map… to have only that part."

The project rules are in `CLAUDE.md`.

## Global Constraints

- Join on IEBC codes only. Names are for display and search only.
- Show only current holders: those in `SeatsData.holders`, which are already current. Never invent
  or alter people. Show names exactly as the data spells them.
- Follow the visual and copy rules in `CLAUDE.md`:
  - Ballot box tokens.
  - No AI look: no ALL-CAPS labels, no "A · B · C" strings, no "→" on links, no emoji.
  - Plain sentence-case copy.
  - Touch targets of at least 44px.
- Accessibility: keep the ARIA listbox pattern in `SearchBox.vue`. Keyboard-only use must work.
- Git: branch `feature/people-search-focus` (git flow). Commit after each task. The PR goes into
  `develop`.

## Review Focus

1. Two holders with the same name in different units must both appear, told apart by their area
   line. Tested in Task 1.
2. Picking a nominated member, who has no unit, must not crash the map or leave it blank. Tested
   in Task 1.
3. While a ward is focused, zooming out with a pinch must never show other units and must never
   leave the map empty. The panel and the filters stay consistent. Checked in Task 2's browser
   step.
4. Switching the colouring mode, toggling the basemap or changing theme while focused must keep
   the focus filters. Restyling must not drop them. Tested in Task 2.
5. A deep link straight to `/ward/1448` opens already focused. Checked in Task 2's browser step.

---

### Task 1: People search

**Files:**
- Modify: `resources/js/lib/search.ts`, `resources/js/components/map/SearchBox.vue`,
  `resources/js/pages/Map.vue` and `resources/js/components/map/UnitPanel.vue`
- Test: `tests/js/search.test.ts` (extend it) and a new `tests/js/components/SearchBox.test.ts`

**Interfaces:**
- Consumes:
  - `normalise(s)` and `searchUnits(index, query, limit)` from `search.ts`.
  - `Holder` and `SeatsData` from `lib/seats.ts`. A `Holder` has `seat`, `level`, `code`, `name`,
    `party`, `basis`, `started_on` and `source_url`.
  - `UnitIndex.get/ancestors` from `lib/units.ts`.
- Produces:
  - `searchPeople(holders: Holder[], index: UnitIndex, query: string, limit = 6): PersonResult[]`,
    where `PersonResult = { holder: Holder; unit?: Unit; ancestors: Unit[] }`. `unit` is absent
    for nominated members.
  - `describePerson(r: PersonResult, partyName?: (abbrev: string) => string | undefined): string`
    returns the second line of a person row.
  - A `SearchBox` emit `pickPerson(r: PersonResult)` alongside the existing `pick`.
  - A `UnitPanel` prop `highlightSeat?: string`, matching the holder's `seat`.

**Matching:**
- Every normalised query token must prefix-match a token of the normalised holder name, in any
  order.
- Rank 0 is an exact full name, rank 1 a name that starts with the query, rank 2 everything else.
- Ties break by seat order: `governor`, `senator`, `woman_rep`, `mp`, `mca`, `nominated_senator`,
  `nominated_mp`, `nominated_mca`. Then by name.

**Second-line copy**, with seat titles as in `seatsFor`:

| Holder | Second line | Example |
|---|---|---|
| County seat | `"<Seat title>, <county> County (<PARTY>)"` | `"Governor, Mombasa County (ODM)"` |
| MP | `"MP, <constituency>, <county> (<PARTY>)"` | `"MP, Mathare, Nairobi City (ODM)"` |
| MCA | `"MCA, <ward> ward, <constituency>, <county> (<PARTY>)"` | `"MCA, Port Reitz ward, Changamwe, Mombasa (ODM)"` |
| Nominated | `"Nominated MP (<PARTY>)"`, `"Nominated Senator (<PARTY>)"` or `"Nominated MCA, <county> (<PARTY>)"` | |

When `party` is null, leave out the parenthesis.

**SearchBox layout:**
- Two groups with visible headings, `Places` and `People` (sentence case).
- At most 6 of each. If one group is empty, the other can use up to 8.
- One ARIA listbox across both groups: the group headings are `role="presentation"` and each row
  is an option.
- Arrow keys move across both groups, Enter picks, Escape closes.

**Picking a person:**
- Picking someone with a unit does the same thing as picking that unit. It also sets
  `highlightSeat`, so the matching seat row in `UnitPanel` gets a visible highlight using the
  seat-colour lid plus an ink outline, and is scrolled into view.
- Picking a nominated member clears the selection. That shows the national overview, with the
  person's party group highlighted. Use the existing `NationalOverview` emphasis if there is one;
  otherwise add a `highlightParty?: string` prop.

- [ ] **Step 1:** Write failing tests in `search.test.ts`. Build a small `SeatsData` fixture with
  real unit codes and synthetic people clearly named like "Test Person One". Real names aren't
  needed; this avoids putting real people in fixtures.
  - `searchPeople(…, 'one person test')` finds "Test Person One", so order doesn't matter.
  - Diacritics and apostrophes are ignored.
  - Two people with the same name in different wards both come back, and `describePerson`
    gives different area lines.
  - A nominated member has no `unit`, and the description is `"Nominated MP (ODM)"`.
  - Results respect the limit.
  - An empty query returns `[]`.
  - The existing `searchUnits` tests still pass.
- [ ] **Step 2:** Write `SearchBox.test.ts`:
  - Typing shows the "Places" and "People" headings.
  - ArrowDown moves from the last place to the first person.
  - Enter on a person emits `pickPerson`.
  - With no place matches, up to 8 people show.
- [ ] **Step 3:** Run `npm run test:js -- tests/js/search.test.ts tests/js/components/SearchBox.test.ts`.
  Expected: FAIL.
- [ ] **Step 4:** Implement it in `search.ts`, `SearchBox.vue`, `Map.vue` and `UnitPanel.vue`.
- [ ] **Step 5:** Run the same command, then the full `npm run test:js` and `npm run build`.
  Expected: all PASS.
- [ ] **Step 6:** Commit: `feat(search): find politicians by name`.

### Task 2: Focus mode, showing only the selected unit

**Files:**
- Create: `resources/js/lib/map/focus.ts`
- Modify: `resources/js/composables/useMap.ts`, `resources/js/pages/Map.vue`,
  `resources/js/components/map/UnitPanel.vue`, and `resources/js/lib/export/*` (whichever module
  renders the map image for share cards)
- Test: `tests/js/map/focus.test.ts`, plus an extension of `tests/js/map/useMap.test.ts`

**Interfaces:**
- Consumes:
  - `UnitIndex.children/get` from `lib/units.ts`.
  - The layer ids from `buildStyle` in `lib/map/style.ts`, and from `lib/map/overlays.ts`
    (`towns`, `towns-dot`, `stations-dot`, `stations-label`).
- Produces:
  - `focusFilters(sel: { level: 'county'|'constituency'|'ward'; code: number } | null, index: UnitIndex): Record<string, FilterSpecification | null>`.
  - It returns one entry for every fill, line, selected-outline, label and overlay layer in the
    built style. `null` means "remove the focus filter, restore the layer's base filter".
  - `useMap` gains `setFocus(sel | null)` and `setShowSurroundings(on: boolean)`.

**Filter rules:**
- Combine every filter with the layer's existing base filter using `['all', base, focus]`, so
  existing filters, such as the selected-outline filter, keep working.
- **Selected county C:**
  - The county layers keep `code == C`.
  - Constituency layers keep `county_code == C`.
  - Ward layers keep `county_code == C`.
  - Labels keep county C, its constituencies and its wards. Use
    `['in', ['get','code'], ['literal', codes]]` per `level`, built from `UnitIndex.children`.
  - Towns keep `county_code == C`, and stations keep `ward_code` in C's wards.
  - The province layers are hidden.
- **Selected constituency K:** constituency layers keep `code == K`, ward layers keep
  `constituency_code == K`, and county and province layers are hidden. Labels, towns and stations
  are filtered the same way as for a county.
- **Selected ward W:** only ward W, its label, towns with `ward_code == W` and stations with
  `ward_code == W`.
- **"Hidden"** means a filter that matches nothing: `['==', ['get','code'], -1]`. Use that, not
  layout visibility, so restyling can't bring the layers back.
- **"Show surroundings" on:** don't hide anything outside. Instead set the fill opacity outside
  the unit to 0.15 with no labels outside, using `case` expressions on the same code tests.
  - Default off.
  - Remember it in `localStorage` key `kem.showSurroundings`, with try/catch.
- **Restyling:** `setColorMode`, `setBasemap` and theme changes must re-apply the current focus
  after restyling.

**Leaving focus:**
- Tapping outside the focused unit, the zoom-out control or a breadcrumb steps up one level:
  ward → constituency → county → none. It then recomputes the filters.
- Clearing the selection removes all focus filters.
- Pinch-zooming out below the unit's level keeps the focus. The map shows the unit smaller, never
  blank.

**Camera:** fit the unit's bounds with the existing sheet or side-panel padding.

**Share images:** the map image is rendered with the same focus filters and the same "Show
surroundings" state.

- [ ] **Step 1:** Write failing `focus.test.ts` against the real `public/boundaries/units.json`
  and the real style from `buildStyle`:
  - `focusFilters(null, …)` returns `null` for every layer.
  - Selecting county 47 matches exactly 17 constituencies and 85 wards when evaluated with
    `featureFilter` from `@maplibre/maplibre-gl-style-spec`, or a small evaluator over the
    committed GeoJSON.
  - Selecting ward 1448 matches exactly one ward feature and none from any other ward.
  - Province layers are hidden for any selection.
  - The keys equal the set of filterable layer ids in the built style, so no layer is forgotten.
- [ ] **Step 2:** Extend `useMap.test.ts`. With the existing MapLibre mock:
  - `setFocus` calls `setFilter` on every layer.
  - `setColorMode` while focused re-applies the filters.
  - `setFocus(null)` restores the base filters.
- [ ] **Step 3:** Run `npm run test:js -- tests/js/map`. Expected: FAIL.
- [ ] **Step 4:** Implement `focus.ts`, the `useMap` wiring, the leaving-focus behaviour, the
  `UnitPanel` "Show surroundings" switch (a real `<button role="switch" aria-checked>` with a
  visible label), and the share-image focus.
- [ ] **Step 5:** Run `npm run test:js` (all) and `npm run build`. Expected: PASS.
- [ ] **Step 6:** Browser check at 390×844 and at desktop width, with
  `./vendor/bin/sail npm run build` and http://localhost:8080:
  - Select Nairobi City: nothing outside it is drawn.
  - Then Mathare, then Ngei: each shows only itself and what's inside it.
  - Zoom out with the control back to all of Kenya.
  - Toggle "Show surroundings".
  - Open `/ward/1448` directly.
  - Search a person and pick them.
- [ ] **Step 7:** Commit: `feat(map): show only the selected unit`.
