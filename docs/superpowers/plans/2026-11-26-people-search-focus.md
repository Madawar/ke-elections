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

### Task 3: Map polish (clear borders in colour views, floating seat chips, onboarding, scoped legend)

The owner added these on 2026-11-26, after trying Tasks 1–2:
- "On the map, boundaries only is good. On the other colours there's the issue." Borders get lost
  against party fills.
- "Why can't the filters for governor, senator, MP float on the map?"
- "Can we have small popups that onboard the user?"

The controller's look at the Task 2 screenshots found two more:
- The legend shows national totals while a unit is focused.
- Constituency and ward borders look the same inside a focused county.

**Files:**
- Modify: `resources/js/lib/map/style.ts` (line casing and the border hierarchy in colour modes),
  `resources/js/lib/map/colouring.ts`, `resources/js/components/map/Legend.vue`,
  `resources/js/components/map/LayersPanel.vue`, `resources/js/components/map/AboutSheet.vue`
  and `resources/js/pages/Map.vue`
- Create: `resources/js/components/map/SeatChips.vue`, `resources/js/components/map/Onboarding.vue`
  and `resources/js/lib/onboarding.ts`
- Test: `tests/js/map/style.test.ts` (extend), `tests/js/components/SeatChips.test.ts`,
  `tests/js/components/Onboarding.test.ts`, and `tests/js/seats.test.ts` (extend, for the scoped
  legend counts)

**Requirements:**

**(a) Borders that read in every colour view:**
- Every boundary line is drawn twice: a light casing underneath (the ground colour, about 1.5×
  the width) and the line on top.
- Line colours:
  - County: the ink token.
  - Constituency: a dark neutral.
  - Ward: a mid neutral.
- Boundaries are never party-coloured.
- Party fills use opacity 0.8, so lines and labels stay legible.
- The "boundaries only" view looks exactly as it does today.

**(e) Border hierarchy inside a focused county:**
- Constituency lines are visibly heavier than ward lines: at least 1.6× the width and darker.
- The focused unit's outline (ink, thickest) stays on top of everything.

**(b) Floating seat chips:**
- One horizontal row under the search bar (desktop: beside it) with the chips None, Governor,
  Senator, Woman Rep, MP and MCA.
- The active chip is filled with that seat's ballot colour token, with legible text.
- The row is a single line that scrolls sideways (no wrapping), with scroll-snap and no visible
  scrollbar on touch.
- Chips are at least 44px tall to tap; the visual height can be smaller.
- The row hides when the bottom sheet is at `full`.
- The chips drive the same colour mode that `LayersPanel` sets today, and the two stay in sync.
  `LayersPanel` keeps the other options: basemap, towns and stations.
- Accessibility: a radiogroup with `aria-checked`, and arrow keys move between chips.

**(d) Legend counts follow the focus:**
- While a unit is focused, legend counts cover only the seats inside that unit. For example,
  Nairobi City with MP colours shows 17 MP seats.
- The heading says so, for example "MP seats in Nairobi City by party".
- Unfocused, the legend shows national totals as today.

**(f) Colour mode coarser than the focus:** taken from Task 2's review if it is raised there;
otherwise build it here.
- When the active seat's level is coarser than the focused unit's level (for example Governor
  colours while a constituency or ward is focused), colour the visible features inside the unit
  by their ancestor's holder.
- Use a `match` on `county_code` or `constituency_code`, so the unit never shows uncoloured
  under an active colour mode.

**(c) Onboarding:**
- Show on the first visit, after the map loads, and only when the map is supported. There are
  four small popovers, each with a pointer to a real control:
  1. Search: "Find any county, constituency, ward, or politician by name."
  2. Locate: "See the ward you're in."
  3. Seat chips: "Colour the map by the party holding each seat."
  4. The map: "Tap an area to see who represents it. Zoom out or tap outside to step back."
- Each popover has **Next** (**Done** on the last) and **Skip**, and shows its step as "1 of 4".
- The popovers are non-modal: the map stays usable, Escape closes the tour, and focus moves to
  the popover's first button.
- Store `kem.onboarded.v1` in `localStorage`, with try/catch. If storage fails, show the tour at
  most once per page load.
- The About sheet gets a "Show tips again" link.
- With reduced motion, use no animation; otherwise a short fade only.
- Copy rules from `CLAUDE.md`: sentence case, no emoji, no "→".

- [ ] **Step 1:** Write failing tests:
  - `style.test.ts`: every boundary line layer has a casing layer below it, no line colour
    expression refers to party colours, the constituency line width is at least 1.6× the ward
    line width at zoom 9 and 11, and fill opacity is 0.8 in seat modes.
  - `seats.test.ts`: scoped legend counts for county 47 with MP colours total 17.
  - `SeatChips.test.ts`: renders 6 chips, the selected chip has `aria-checked=true`, ArrowRight
    moves the selection, and the `update` event fires.
  - `Onboarding.test.ts`:
    - It shows step 1 when `localStorage` is empty.
    - Next moves to the next step, and Skip sets `kem.onboarded.v1`.
    - It doesn't show when the flag is set.
    - "Show tips again" restarts the tour.
- [ ] **Step 2:** Run `npm run test:js -- tests/js/map/style.test.ts tests/js/seats.test.ts tests/js/components/SeatChips.test.ts tests/js/components/Onboarding.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full `npm run test:js`, `npm run types:check` and the Sail build.
  Expected: PASS.
- [ ] **Step 5:** Playwright in Docker, at 390×844 and 1440×900. Screenshot each colour mode
  (None, Governor, Senator, Woman Rep, MP, MCA):
  - With Kenya unfocused, with Nairobi City focused, and with Mathare focused.
  - Also the onboarding steps 1–4, and the chip row with the sheet at half and full.
  - Look at them, and fix any border or label that doesn't read against its fill.
- [ ] **Step 6:** Commit: `feat(map): clear borders in colour views, seat chips, onboarding`.
