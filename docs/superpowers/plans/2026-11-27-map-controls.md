# Map Controls, Party Profiles and Onboarding: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.


> **Status (2026-11-27):** Tasks 1–4 shipped in v0.2.0. Tasks 5 and 6 are not built yet. Their
> owner additions are also still to build: the leaders card, the striped county view, bigger card
> maps, the MCA-card leaders strip, the "Leaders here" legend strip, MP outlines and MCA names on
> wards. All of this continues on a new branch from this plan. Task 5 should start with
> `leadersFor()`.

**Goal:**
- Switching seat types is one tap, on the map.
- Tapping drills down from county to constituency to ward.
- There's a clear way back: a back button, browser back and phone back.
- Party names open a party profile with all of the party's seats and a shareable card.
- First-time visitors get short tips.

**The owner's requests (2026-11-26 and 27):**
- "The filter by governor senator woman rep mp legend is still a bit hidden. Have a way to show it
  on the map."
- "On the parties in the legend, is it clickable to see total mp, governor, women rep, mca stats
  and also have exportables?"
- "The soft onboarding tips popups not done."
- Earlier:
  - "I end up clicking constituencies" when selecting Machakos (→ drill-down tapping, "one tap
    zoom is good").
  - "A back button for scrollback would be better" (→ the back button, keeping zoom-out
    stepping).
  - "Clicking out zooms out" (→ the outside-tap rule).
  - "Goad the user to use that" (→ the hint).

**Spec:**
- `docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`: phone UI, party pages,
  neutrality.
- `docs/superpowers/plans/2026-11-26-people-search-focus.md`, Task 3, items **(b)**, **(c)**
  and **(g)**. Those are the detailed requirements reused below.
- `docs/superpowers/plans/roadmap.md`, "drill-down tapping".

**Branch:** `feature/map-controls` (git flow). Finish with `git flow feature finish`. No PR.

## Global Constraints
- Follow `CLAUDE.md`:
  - Ballot box tokens only, and the no-AI-look rules.
  - Sentence case, and no "A · B · C" strings.
  - 44px touch targets.
  - Codes and party keys only for joins.
  - Names exactly as the data spells them.
  - Every number shows its source and "as of" date.
- **Reuse, don't duplicate:**
  - `lib/legend.ts`: `buildLegend`, `hasOwnColour`, `toggleParty`, `pruneParties`.
  - `lib/seats.ts`: `legendScope`, `chamberGroups`.
  - `lib/map/focus.ts`, `lib/map/camera.ts` and `lib/map/announce.ts`.
  - `useMap`: `setFocus`, `select`.
  - The export stack: `viewState`, `viewLayout`, `ViewCard`, `ShareViewDialog`, `caption`,
    `share`, `rasterize`.
- **Neutrality:**
  - Parties are listed by seat count or by code, never by preference.
  - Party profiles show only facts, with sources.
  - No party branding beyond the data colour.
- **Visual check:** Playwright via Docker. The host lacks Chromium libs. Use the Node project in
  the scratchpad `pw` folder, the image `mcr.microsoft.com/playwright:v1.65.1-noble` and
  swiftshader args. Check at 390×844 and at 1440×900, in light and dark.

## Review Focus
1. Chips and the legend never disagree about the active seat mode, including after a deep link,
   a back or forward navigation, or a theme change.
2. Drill-down tapping and the outside-tap rule must never select the wrong level.
   - A tap at a constituency boundary, inside a focused county, picks the constituency under the
     finger.
   - Hover tooltips name what a tap would select.
3. Browser and phone back walk the focus history correctly, never leave a blank map, and leave
   the site only from the home page with nothing focused.
4. Party profile counts equal the legend and seating-chart counts, for every seat type, from the
   same functions.
5. The onboarding tips never block the map, never reappear after Skip or Done, and point at
   controls that actually exist on that screen size.

---

### Task 1: Seat chips on the map, and drill-down tapping

**Requirements:**
- Item **(b) Floating seat chips** in
  `docs/superpowers/plans/2026-11-26-people-search-focus.md`, Task 3, verbatim. The chips are
  None, Governor, Senator, Woman Rep, MP and MCA.
  - They sit in one horizontal row under the search bar, beside it on desktop.
  - The active chip is filled with its ballot colour token.
  - The row scrolls sideways, has 44px targets and is a radiogroup that works with arrow keys.
  - It hides when the sheet is at full height.
  - The chips drive the same colour mode as `LayersPanel`, and the two stay in sync.
  - `LayersPanel` keeps only the basemap, towns and stations options.
  - **Make the chip row prominent:** it's visible on first load, with no extra tap.
- **Drill-down tapping**, from `docs/superpowers/plans/roadmap.md`:
  - A tap picks its level from the current focus, not from the zoom:
    - With nothing focused, it selects the county under the finger.
    - With a county focused, it selects the constituency inside it.
    - With a constituency focused, it selects the ward inside it.
    - With a ward focused, a tap inside it does nothing.
  - The camera fits the selection. The owner said "one tap zoom is good".
  - Hover tooltips name what a tap would select.
  - Add a pure function `tapTarget(focus, featuresUnderPoint)` and unit-test every case.
- **Files:**
  - Create `resources/js/components/map/SeatChips.vue` and
    `tests/js/components/SeatChips.test.ts`.
  - Modify `Map.vue`, `LayersPanel.vue`, `useMap.ts` (the click handler) and a new
    `resources/js/lib/map/tap.ts`. Add `tests/js/map/tap.test.ts`.

- [ ] **Step 1:** Write failing tests:
  - `SeatChips`: 6 chips, `aria-checked`, arrow keys, and emits.
  - `tapTarget`: all four focus states, plus a point outside the focus. That returns
    `'outside'`, and Task 2 handles it.
  - The chips and the legend stay in sync when the colour mode changes from `LayersPanel` or a
    deep link.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright at phone and desktop sizes, light and dark:
  - The chip row in each mode.
  - Machakos selected by one tap from the national view while zoomed to the constituency level.
  - Then one tap selects a constituency, then a ward.
- [ ] **Step 6:** Commit: `feat(map): seat chips on the map and drill-down tapping`.

### Task 2: Back button, browser and phone back, the outside-tap rule and the hint

**Requirements:**
- Item **(g)** in `docs/superpowers/plans/2026-11-26-people-search-focus.md`, Task 3,
  verbatim:
  - The floating **back button** names the parent ("Mathare", "Nairobi City", "All of Kenya")
    and steps up a level, re-fitting the map.
  - **History:**
    - User focus changes push a history entry. Zoom-driven step-ups replace the current entry.
    - `popstate` restores the focus.
    - Keep Inertia's history consistent.
  - **Outside taps:**
    - With surroundings off, a tap outside the focused unit does nothing.
    - With surroundings on, a tap on a visible neighbour selects it.
  - **The nudge hint card:** "You're viewing <unit>. Go back to see more, or show the
    surroundings to pick a neighbour."
    - It has the buttons **Back to <parent>** and **Show surroundings**.
    - It's shown at most 3 times (`localStorage` key `kem.outsideHint.count`) and never again
      once either control has been used.
- Fold in the parked accessibility item: the "Show surroundings" switch's hint uses
  `aria-describedby`.
- **Files:**
  - Create `resources/js/components/map/BackButton.vue`, `OutsideHint.vue` and
    `resources/js/lib/map/history.ts`.
  - Modify `Map.vue` and `useMap.ts`.
  - Tests: `BackButton.test.ts`, `OutsideHint.test.ts` and `tests/js/map/history.test.ts`.

- [ ] **Step 1:** Write failing tests:
  - `BackButton` is hidden when nothing is focused, its label names the parent, and a click
    emits a step-up.
  - History: a tap pushes an entry, a zoom step-up replaces it, and `popstate` restores the
    previous unit.
  - `OutsideHint` shows on an ignored outside tap, its buttons emit, and the show count and stop
    rules hold.
  - The outside-tap rule works in both surroundings states.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright:
  - The back button at each level, going from Ngei to Mathare to Nairobi City to Kenya.
  - `page.goBack()` steps through the same chain.
  - The outside-tap hint appears.
  - With surroundings on, a tap selects a neighbour.
- [ ] **Step 6:** Commit: `feat(map): back button, browser back and the outside-tap hint`.

### Task 3: Party profile and party card

**Requirements:**
- **Entry points:**
  - **Legend:** each party row keeps its highlight toggle. Add a separate 44px "Party details"
    icon button at the row's end, with the accessible name "<Party name>: all seats". The row's
    party name text can also open it, as long as the toggle and the details control remain two
    distinct targets.
  - Party names in `UnitPanel` seat rows and in `NationalOverview`.
  - **Search:** a third group, "Parties", matching the abbreviation, the name and former names
    from `data/sources/parties.csv` aliases.
- **Route:** `/party/{abbrev}`.
  - It's server-rendered with a `<title>` and Open Graph tags.
  - An unknown abbreviation returns 404.
  - Add a small `PartyDirectory` on the PHP side, or reuse the seats data the page already
    loads, and add Pest tests.
- **Profile content:**
  - It shows in the panel or sheet, like a unit.
  - **Header:** the party name, its abbreviation, a data-colour swatch, its 2022 coalition,
    former names, and its ORPP registration with a source.
  - **"Seats held now":** one row per seat type, "Governors 20 of 47 (43%)", with a bar:
    - Governor, Senator, Woman Rep, MP, MCA.
    - Nominated MPs and nominated Senators as their own rows.
    - Then total elected seats.
  - **Counts** come from the same functions as the legend and seating charts, using the national
    scope.
  - **Each seat row** has a "Show on map" button. It sets that seat mode, highlights this party
    and leaves the focus unchanged.
  - **Sources and "as of" date** are shown on the profile.
  - **An empty state** for a party with no seats: "No current seats", still showing its
    registration.
- **Party card export.** The four sizes use the existing card system, with a new card variant
  `party` reusing `viewLayout`:
  - The headline "<ABBREV> seats across Kenya".
  - The rows Governors, Senators, Woman Reps, MPs, MCAs and nominated seats, each with
    "n of N (p%)" and a bar in the party colour, plus a small map of where it holds MCA seats.
  - The footer with source, "as of" date and the `/party/{abbrev}` link.
  - A caption, and the share sheet as before.
- **Files:**
  - Create `resources/js/lib/party.ts` (`partyProfile(seats, abbrev)`),
    `resources/js/components/map/PartyPanel.vue`,
    `resources/js/components/export/PartyCard*` (or extend `ViewCard`), `PartyController` or
    routes, and tests.

- [ ] **Step 1:** Write failing tests:
  - `partyProfile` for UDA and ODM: the counts per seat type equal `buildLegend` with
    `legendScope` national for each seat, and the nominated counts equal `chamberGroups`.
  - Unknown parties get a 404 (Pest).
  - The search group "Parties" matches by abbreviation and by former name.
  - The party card renders in all four sizes without overlap, with source and URL present.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `php artisan test`, `npm run test:js`, `types:check` and the Sail build.
  Expected: PASS.
- [ ] **Step 5:** Playwright:
  - The UDA and ODM profiles on phone and desktop.
  - "Show on map" from the MP row.
  - The party card in square and story, light and dark.
  - A `/party/uda` deep link.
- [ ] **Step 6:** Commit: `feat(parties): party profile with all seats and a shareable party card`.

### Task 4: Onboarding tips

**Requirements:**
- Item **(c)** in `docs/superpowers/plans/2026-11-26-people-search-focus.md`, Task 3, verbatim,
  with the copy updated for what now exists:
  1. **Search:** "Find any county, constituency, ward, politician or party by name."
  2. **Seat chips:** "Colour the map by the party holding each seat."
  3. **Locate:** "See the ward you're in."
  4. **The map:** "Tap a county, then tap again to go deeper. Use Back to step out."
- **How the tips behave:**
  - They're small, non-modal popovers with pointers to the real controls, and "1 of 4" step
    text.
  - They have Next, Done and Skip buttons. Escape closes them, and focus moves into the popover.
  - `localStorage` key `kem.onboarded.v1`, with try/catch. If storage fails, show the tips at
    most once per page load.
  - The About sheet gets a "Show tips again" link.
  - With reduced motion, no animation; otherwise a short fade.
  - Each tip anchors to the control as it appears on that screen size, so on desktop the chips
    sit beside the search box.
  - Skip any tip whose control is absent. For example, without WebGL2 the list view replaces
    the map, so the map tip is skipped.
- **Files:**
  - Create `resources/js/components/map/Onboarding.vue`, `resources/js/lib/onboarding.ts` and
    `tests/js/components/Onboarding.test.ts`.
  - Modify `Map.vue` and `AboutSheet.vue`.

- [ ] **Step 1:** Write failing tests:
  - The tips show when storage is empty.
  - Next advances, and Skip and Done set the flag.
  - They don't show once the flag is set.
  - "Show tips again" restarts them.
  - A missing anchor skips that step.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright: tips 1–4 on phone and desktop, light and dark. Check that they're
  readable, their pointers are correct, and they don't cover the control they describe.
- [ ] **Step 6:** Commit: `feat(map): onboarding tips`.

### Task 5: County leadership card, and the striped "County seats" map view

The owner asked on 2026-11-27, looking at a single-seat Meru Governor card: "On the export we can
only export one seat by county. For sections that have 2 or 3 people ruling that area, can the
area be multi-shaded in colour?"

**Requirements:**
- **A "County leaders" card** in the existing card system, in all four sizes:
  - The headline "County leaders in <county>".
  - The county map filled with **diagonal stripes**: three equal stripe sets, one per seat
    (Governor, Senator, Woman Rep), each in the holder's party data colour.
    - If two or three holders share a party, that colour repeats, so the stripe shares show the
      balance.
    - If all three are from one party, the fill is solid.
    - If a seat has no holder, its stripe uses the no-data token.
  - **Three holder rows**, in the order Governor, Senator, Woman Rep. Each row has:
    - The seat's ballot-lid colour as a side bar.
    - The seat title.
    - The name exactly as the data spells it.
    - The party chip and party name.
    - "In office since <date>" and the row's own source.
  - The footer with source(s), the "as of" date and the deep link.
- **Entry:** the share dialog offers "County leaders" whenever a county is focused, whatever the
  seat mode. A constituency card can add "and its county's leaders" as an option. That option is
  in scope if it fits the layout; otherwise record it as deferred.
- **The map's "County seats" mode:**
  - A seventh seat chip, "County seats". Every county is filled with the same stripe pattern.
  - Use MapLibre `fill-pattern` with images generated at runtime: one canvas pattern per unique
    colour triple, added via `map.addImage`, keyed by a stable id.
  - Patterns are regenerated on theme change and reused for the export map.
  - **Legend:** list the parties present, with counts of the county seats they hold across all
    three seat types. Add a note: "Each county is striped by its Governor, Senator and Woman Rep."
  - The party highlight works on stripes: a non-selected party's stripes become the faded token.
- **Neutral and checked:**
  - Stripe order is always Governor, Senator, Woman Rep, never by party.
  - Names and sources are shown verbatim.
  - Joins use codes only.
- **Files:**
  - Create `resources/js/lib/map/stripes.ts`, with `stripePattern(colours[], theme, size)`
    returning `ImageData` and `patternId(colours)`.
  - Create `resources/js/lib/export/countyLeaders.ts`, with `countyLeaders(seats, countyCode)`.
  - Card layout and component changes, chip, legend and colouring changes, and tests.

- [ ] **Step 1:** Write failing tests:
  - `countyLeaders(47)` returns the three holders in order, with sources.
  - `patternId` is stable for the same colours and differs when the order differs. Stripe order
    is fixed by seat, not by colour.
  - Same-party counties give a solid pattern.
  - The legend counts in "County seats" mode sum to 141 (3 × 47) minus vacancies.
  - The card renders in all four sizes with three holder rows, no overlap, safe zones and source.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright:
  - "County seats" mode nationally, light and dark.
  - Meru, Nairobi City, and a county whose three leaders share one party: county-leaders cards in
    square and story.
  - Check the stripes are readable at phone size and the borders still read.
- [ ] **Step 6:** Commit: `feat(map): county leaders card and striped county seats view`.

### Task 6: MP outlines over MCA wards

The owner asked on 2026-11-27: "In ward and constituency zooming, differentiating between an MP
and MCA for the wards would be cool."

**Requirements:**
- **On the map, in MCA mode,** from the constituency zoom band and deeper (and in focus on a
  county or constituency):
  - Ward fills stay as the MCA's party colour.
  - Each constituency gets a **thick outline in its MP's party colour**: a 4–5 px party-colour
    line between two thin ink edges, so it reads even over wards of the same colour. It sits
    above the ward fills and the ward lines, and below labels and the focused unit's outline.
  - A small badge at the constituency label point: "MP: <ABBREV>". "MP: no data" if there's no
    holder.
  - The badges follow the label collision rules, so constituency names win where space is short.
  - The MP outline colour comes from the same holder data, keyed by constituency code.
  - The party highlight applies to both layers: a non-selected party's outlines and fills take
    the faded token.
  - A "Show MPs as outlines" switch in `LayersPanel`, on by default and remembered.
- **Legend in that mode:** two sections.
  - "MPs (outline)": counts and percentages of MP seats in the current scope.
  - "MCAs (fill)": counts and percentages of MCA seats in the scope.
  - Both come from `buildLegend` with the right seat key and scope.
  - Each section's rows toggle the highlight for its own layer.
- **Panel:** a ward's seat list shows its MCA and, under "Represented in Parliament by", the
  constituency's MP. The data is already available.
- **Export:**
  - Constituency cards in MCA mode get an "MP: name exactly as the data spells it, party, since"
    block above the ward rows.
  - The card map is drawn the same layered way.
  - County MCA cards show the MP outlines on their map, plus a compact "MPs: ODM 8, UDA 4, …" line
    built from `buildLegend`.
- **Tests:**
  - The outline colour expression maps each constituency code to its MP's party colour, and to
    faded when the party is not selected.
  - The legend sections' counts equal the separate MP and MCA legends for the same scope.
  - The badge text for a held seat and for no data.
  - The constituency card has the MP block, with no overlap and safe zones holding.
- **Playwright:**
  - Nairobi City focused in MCA mode, then Mathare focused, then a ward selected, on phone and
    desktop, light and dark.
  - The Mathare card in square and story.
  - Check that the outlines read against same-colour wards.
- [ ] **Step 1:** Write the failing tests above.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright as listed above. Look at the shots.
- [ ] **Step 6:** Commit: `feat(map): MP outlines over MCA wards, with both in the legend and cards`.

### Additions from the owner on 2026-11-27 (binding on Tasks 5 and 6)

**Task 5 grows into a "who represents it" team, on screen and in exports.** The owner said: "In
constituency, can you in export and screen show the team leading it? On the side it shows only
MP."
- **Panel for a focused constituency:** a section "Who represents <constituency>". It lists:
  - The MP.
  - The county-wide Governor, Senator and Woman Rep, labelled "(<county>, county-wide)".
  - The MCAs: a summary such as "MCAs (6): ODM 3, UDA 3" that expands to the list of wards and
    their MCAs. Each name is a link that focuses that ward.
- **Panel for a focused ward:** the MCA first, then the constituency's MP, then the county-wide
  three.
- **Row format:** each row has the seat's ballot-lid colour bar, the seat title, the name exactly
  as the data spells it, the party chip and name, and the source.
- **Rules:**
  - Nothing is invented. A seat with no holder shows "No approved data yet".
  - Order is fixed by seat: MP or MCA first, then Governor, Senator, Woman Rep. Never by party.
- **Export, "Leaders of <unit>" card,** in all four sizes:
  - **Constituency card:** the map (wards coloured by MCA), the MP block, the three county-wide
    rows, and an MCA mix bar with "of N wards".
  - **Ward card:** the MCA block, the MP, and the three county-wide rows.
  - The county leaders card from Task 5 is the county version of the same card.
  - Every card has its sources and "as of" date.

**Task 6 also puts MCA names on the map, without clutter.** The owner said: "For wards can they
be detailed and colour-code the wards, and if possible show the elected person on the map, if
possible and not ugly."
- Inside a focused constituency, wards are filled by their MCA's party. Task 1 makes MCA the
  default mode there.
- **Ward labels gain a second, smaller, muted line:** "<MCA name> (<ABBREV>)". For example,
  "Ngei" on the first line, then the holder's name exactly as in the data, followed by "(ODM)".
- **When the second line shows:**
  - Only from about zoom 11.5, or when the ward's constituency is focused.
  - Only when the ward is large enough on screen.
  - The MapLibre symbol layer uses `text-optional` or a separate symbol layer. The name line
    drops before the ward name does, never overlaps, and is never cut mid-word.
  - Long names wrap to a maximum of two lines; if that doesn't fit, the line isn't shown.
- **Fallback:** if Playwright shows dense constituencies (for example in Nairobi) cluttered at
  common zooms, show MCA names only for the selected or hovered ward, and record that in the
  report.
- **Tests:**
  - The label expression includes the name line only above the zoom threshold or when focused.
  - Names are verbatim from the data.
  - "no data" wards show only the ward name.
- **Playwright:** Mathare focused and Ngei selected, on phone and desktop, light and dark, plus a
  large rural constituency. Look at the shots to judge whether it's tidy.

**Additions to Task 5's export cards (owner, 2026-11-27).** The owner said: "The export card is
awesome. Maybe make the map a bit bigger, just a bit, at least for MCA level. Also on MCA level,
wouldn't it be good to show governor and senator."
- **A bigger map.**
  - Grow the map area on every card by about 15% of its current height, and on MCA cards (county
    and constituency scope) by about 25%.
  - Take the space from padding and the gaps between rows first, then trim the mix rows. A long
    ward list shows the top rows plus "and N more".
  - The headline, the footer with its source, "as of" date and link, and the story safe zones
    (bottom 400 px, right 120 px) must not shrink or move into the safe zones.
- **A "County leaders" strip on MCA cards.**
  - Every MCA card scoped to a county or a constituency gets a compact strip under the map.
  - Each row has a ballot-colour bar, the seat title, the name exactly as the data spells it, and
    the party abbreviation chip: Governor, Senator, then Woman Rep.
  - Woman Rep is the controller's call: it's the third county-wide seat, and it keeps the strip
    consistent with the county leaders card.
  - **Constituency scope:** the strip starts with that constituency's MP row.
  - **No duplication:** when the card is already a Governor, Senator or Woman Rep card, the strip
    leaves that seat out.
  - **Square size:** if three or four rows don't fit, put them in two columns. If they still don't
    fit, show Governor and Senator only, with "+1 more at <link>".
  - Rows with no holder read "No approved data yet". Sources go in the footer.
- **Tests:**
  - The map's height ratio grows as specified for MCA and other cards in all four sizes.
  - The strip's rows and their order for county and constituency scope.
  - Nothing overlaps and the safe zones hold, in all sizes, including Nairobi City with its 85
    wards and a single-ward constituency.

### Task 4 is expanded (owner, 2026-11-27): "onboarding is key"

The owner said: "Onboarding is key: on filtering etc., the location button use, the exports etc."
This replaces the four-tip list above. Keep the behaviour rules above: non-modal, Skip, Done,
Escape, focus handling, storage with try/catch, reduced motion, missing anchors skipped, and
"Show tips again".

**1. The first-visit tour.** At most 6 steps, each one short sentence plus an optional second
line. The steps are anchored to real controls:
1. **Search:** "Find any county, constituency, ward, politician or party by name."
2. **The map** (pointing at the map centre): "Tap a county, then tap again to go deeper. Use Back
   to step out."
3. **The seat chips:** "Colour the map by who holds each seat: Governor, Senator, Woman Rep, MP or
   MCA."
4. **The legend:** "Tap a party to show only its seats. Tap more than one to compare."
5. **Locate:** "See the ward you're in. Your location stays on your phone." Check the second
   sentence against the code before using it. It's true only if the location never leaves the
   device; if not, rewrite it truthfully.
6. **Share:** "Share what you see as an image for WhatsApp, Instagram, TikTok or X." It points at
   "Share this view", or at the legend's share button when no unit is selected.

**2. Contextual one-time tips.** Each tip shows once ever, after the tour is done or skipped, and
never during it. They're small, dismissible popovers or toasts. At most one tip per session
reaches the user.
- **The first time a unit is selected:** "Share this view makes an image of exactly this. Sources
  included." It points at the Share button.
- **The first party highlight in the legend:** "Showing only <party>. Tap again or Show all to
  clear."
- **The first time a county-wide chip is muted:** "Governor, Senator and Woman Rep cover the whole
  county. Tap one to go back to <county>."
- **The first time location is denied or fails:** a plain, non-blaming fix-it line, such as
  "Location is off for this site. You can still search for your ward."
- **The first time the share dialog opens:** "Pick a size: square for feeds, story for TikTok and
  Reels, wide for X."
- Storage key per tip: `kem.tip.<id>`, with the same try/catch rule as the tour.

**3. A help entry point.** The About sheet gets a "How to use this map" section with the same
steps as text, plus the "Show tips again" button. Everything works without tips, and the tips
never cover the control they describe.

**Tests (added to Task 4):**
- The tour has 6 steps in order, and a missing anchor skips its step.
- Each contextual tip fires on its trigger once only, never during the tour, at most one per
  session, and its storage failure path works.
- The locate tip's copy matches what the code actually does with location.

**Playwright:** check on phone and desktop, light and dark:
- The whole tour.
- Each contextual tip, triggered.
- The About help section.

**Addition to Task 5: the "Leaders here" strip in the legend box (owner, 2026-11-27).** Looking at
the "MCA seats in Magarini by party" legend, the owner said: "In this box can we show governor,
senator while at the lowest level, and as we move up it shows the higher electives."
- **Placement:** a compact strip at the top of the legend box, above the party bars, titled
  "Leaders here".
- **Rows by focus level.** Each row shows the ballot-colour bar, the seat, the name exactly as the
  data spells it, and the party abbreviation chip.

  | Focus | Rows |
  |---|---|
  | Ward | MCA (this ward), MP, Governor, Senator, Woman Rep |
  | Constituency | MP, Governor, Senator, Woman Rep |
  | County | Governor, Senator, Woman Rep |
  | Kenya | President and Deputy President, only once they're imported through the validated CSV path with a source. Until then, the strip is absent at national level. `seats.json` has no President seat today. |

- **Behaviour:**
  - Moving up drops the finer seats; moving down adds them. The rows follow the focus through tap,
    Back, zoom step-up and search.
  - The strip omits the row for the seat the legend is already counting when that scope has
    exactly one holder. For example, at a county in Governor mode, the legend's single bar already
    shows the Governor.
  - A row with no holder reads "No approved data yet".
  - Tapping a row's name opens that person in the panel. It's the same action as picking them in
    search, so the focus doesn't change.
- **Keeping the box lean:**
  - The rows are dense, at most 5 of them, and use 44px targets only on the tappable name.
  - The strip can collapse to one line, "Leaders here (5)". Remember that per viewer (localStorage
    with try/catch).
  - The default is expanded on desktop and collapsed on phones.
  - The legend box's max height and scrolling still hold. The strip must not push the share button
    out of reach.
- **One source of truth:** add `leadersFor(unit, seats)` in `resources/js/lib/leaders.ts`. The
  panel's "Who represents" section, the card leaders strip and this legend strip all use it. Don't
  build three versions.
- **Tests:**
  - `leadersFor` for a ward, a constituency, a county and Kenya, with rows in fixed order and the
    single-holder omission.
  - Vacancy rows.
  - The strip updates when the focus steps up.
  - The collapsed state is remembered.
- **Playwright:** Magarini in MCA mode, then a ward in it, then Kilifi, then Kenya, on phone and
  desktop.
