# Leaders branch (`feature/leaders`): progress log

Tasks 5 and 6 of `2026-11-27-map-controls.md`, with the owner's additions of 2026-11-27. This file
is the running log: what is done (with commits), every ruling made on the way, parked minor
findings and what is next. A later session can resume from here.

**Released as v0.3.0 on 27 November 2026.** The branch was built under "push `feature/leaders`
only"; the owner then asked for the release in the same session.

## Status

| Step | What | State | Commit |
|---|---|---|---|
| 5a | `leadersFor()` in `lib/leaders.ts`; the panel's "Who represents"; the legend's "Leaders here" strip | done | `65333b4` |
| 5a | The leaders strip on MCA cards (`lib/export/leadersStrip.ts`, `cardLeaders`) | done | see `git log` (`feat(export): leaders strip on MCA cards…`) |
| 5b | Bigger card maps on the "Share this view" cards | done | same commit |
| 5b | "Leaders of <unit>" and "County leaders in <county>" cards, in all four sizes | done | see `git log` (`feat(map): county leaders card and striped county seats view`) |
| 5c | Striped "County seats" chip, map mode and legend | done | same commit |
| 6 | MP outlines over MCA wards, "MP: <ABBREV>" badges, the two-list legend, the MP block and MPs line on MCA cards, the MCA's name on the selected ward | done | `71f969a`, then the review fixes `46e2715` and the final review's (see `git log`: `fix(leaders): final review…`) |

### Reviews

Each task had one fresh review subagent (Opus 5.5), given the requirement sections, the diff and
the screenshots. Neither found a Critical defect.

- **Task 5 (commits `65333b4`, `a7a5ed3`, `3178ac6`).** Important findings, all fixed: the panel's
  MCA counts and ward list had no sources; the legend box named "IEBC gazette notices" as the
  source even when a leader in its strip came from another site; the strip's 44px name targets
  overlapped; the map side of the County seats view had no test. Minors fixed: names cut in the
  strip, "IND" instead of "Independent" there, a holder with no party drawn as a vacancy in the
  stripes, the other card's headline showing for a moment after switching card in the dialog.
  One finding is a question for the owner: see the ruling "only MCA cards … get the leaders strip".
- **Final review of the whole branch (at `46e2715`).** One Important finding, fixed: the thin
  outline also applied inside a focused constituency, where it was barely readable, and a
  focused county's own outline hid the bands along its border. Minors fixed: the MPs line could
  split a party from its count when it wrapped; the dialog could still show the other card's
  headline if the person had just typed; the map settings badge did not count an outline
  highlight; the ward list's source links were small touch targets. It found no rule breach: no
  join on names, no real person's name in code or tests, every number with its source and date.
- **Task 6 (commit `71f969a`).** Important findings, all fixed: the outline band crossed narrow
  constituencies into their neighbours with a whole county in view (Nairobi City); the badges
  outlived and outshone the constituency names; the "MPs (outline)" list showed for all of Kenya
  zoomed out, where no outline is drawn; a county card's MPs line could cost a leader row and
  then not print, leaving the outlines on its map without a key. Minors fixed: the outlines'
  highlight was remembered across visits, MP sources were missing from the card footer, the two
  legend lists were not labelled for assistive technology, the name line was weak over a fill.

### How much bigger the card maps are (5b)

Measured as the height the shape is drawn at, against v0.2.0, with the test fixtures
(`tests/js/export/mapGrowth.test.ts` holds the v0.2.0 boxes).

| Card | Square | Portrait | Story | X |
|---|---|---|---|---|
| MCA, county (Nairobi City) | +25% | +25% | +25% | +25% |
| MCA, constituency (Mathare, a wide shape) | +20% | already the full width | already the full width | +12% |
| MCA, all of Kenya | +12% | +10% | +16% | +4% |
| MP, county (Nairobi City) | +15% | +15% | +15% | +15% |
| Governor, county (one seat) | +19% | +8% | already the full width | +15% |

On top of that, a small urban constituency now fills its box (see the ruling on the card map's
zoom): Mathare's shape is about 80% wider on a story than at v0.2.0.

## Rulings

Each one: what was decided, why, and what it costs if it is wrong.

- **Ruling: `leadersFor(unit, seats, index)` takes the unit index as a third argument** — the plan
  writes `leadersFor(unit, seats)`, but the rows above a unit (a ward's MP, a constituency's
  county) can only be found through parent codes, which live in the index — cost if wrong: none
  for the owner; it is a signature.
- **Ruling: for Kenya, `leadersFor(null, …)` returns rows only when the data has holders with seat
  `president` or `deputy_president` at level `national`** — `seats.json` has no such seat today, so
  the strip is absent at national level, as the plan says; nothing is invented — cost if wrong:
  when the President is imported under other seat keys, two strings in `lib/leaders.ts` change.
- **Ruling: the panel's old "Seats" section is replaced by "Who represents <unit>" at every level**
  (a county lists its own three seats under the new heading) — one section built from one
  function, instead of two that could disagree — cost if wrong: the heading wording on county
  panels; one line.
- **Ruling: rows held above the unit say where: "(Nairobi City, county-wide)" for the county's
  three, and "(Mathare constituency)" for a ward's MP** — the plan gives the county wording only;
  the MP row needed the same kind of label — cost if wrong: one string.
- **Ruling: a constituency's MCA summary also counts wards with no holder: "MCAs (6): ODM 3, UDA 2,
  no approved data yet 1"** — the number in brackets is the number of wards, so the parts must add
  up to it; a vacancy is said, not hidden — cost if wrong: one string.
- **Ruling: in the MCA list, a ward with no MCA still has a link ("No approved data yet") that
  focuses the ward** — otherwise that ward could not be reached from the list — cost if wrong:
  trivial.
- **Ruling: pressing a name in "Leaders here" highlights that person's row in the panel and opens
  the sheet on a phone; it does not select the holder's unit** — the plan says both "the same
  action as picking them in search" and "the focus doesn't change"; picking a Governor in search
  would move the focus to the county, so the second sentence wins. The panel now lists every
  leader of the focused unit, so the row is there to point at — cost if wrong: one handler in
  `Map.vue` (`onPickLeader`) would call `onPickPerson` instead.
- **Ruling: the single-holder omission is applied literally** — at a ward in MCA mode the legend's
  one bar is that ward's MCA seat, so the strip leaves the MCA row out and starts at the MP. The
  bar shows the party, not the name; the name is one tap away in the panel — cost if wrong: remove
  the `omit` argument in `Map.vue` (`leadersHere`) and the strip always starts with the unit's own
  seat.
- **Ruling: the strip's collapsed state is stored under `kem.leadersOpen`** (with try/catch; the
  default is open on desktop, one line on a phone) — cost if wrong: none.
- **Ruling: the Deputy President takes the President's ballot colour** — they are elected on one
  ballot — cost if wrong: one line (`leaderColour`), and no such row exists today.

- **Ruling: only MCA cards for a county or a constituency get the leaders strip** — the plan says
  "every MCA card scoped to a county or a constituency". Its "no duplication" rule (a Governor
  card leaves the Governor out) is built into `cardLeaders` but has no visible effect, because
  no Governor, Senator or Woman Rep card has a strip — cost if wrong: one condition in
  `cardLeaders` (`lib/export/viewState.ts`).
- **Ruling: the strip's MP row is Task 6's "MP block"** — Task 6 asks for "MP: name, party, since"
  above the ward rows of a constituency MCA card, and the later addition says the strip starts
  with the MP. One row serves both (it adds "since 2022"), so the MP is not on the card twice —
  cost if wrong: add a second, larger block; the strip stays.
- **Ruling: where the strip sits** — always directly above the seat mix bar: under a full-width
  map, or under the headline-and-map block when the map sits beside the headline. On X it goes
  under the map when the shape leaves room there (a wide unit), else at the top of the column of
  words — cost if wrong: layout only (`withMixRows` and the X branch of `viewLayout`).
- **Ruling: the strip's columns** — two columns on square and portrait, one on story and X. In
  two columns a constituency's MP keeps a line of its own (with "since") on portrait; on the
  square card, the shortest of room, it shares the columns and drops "since" when it does not fit.
  A name too long for half the width puts the whole strip in one column; names are never cut —
  cost if wrong: `SPECS[size].leaders`.
- **Ruling: the map grows first, then the rows shorten, but never below 3 rows on square and X, 6
  on portrait and 8 on story** — the plan says to take room from padding and gaps, "then trim the
  mix rows"; it gives no floor. The taller cards keep more rows so a constituency's wards (4 to 8)
  stay listed there. Effect: the square card for a wide constituency lists 3 wards and "and N more
  wards"; Nairobi City lists 8 of 17 constituencies on square, 13 on portrait, 13 on story, 6 on
  X with MP outlines on (the default, which adds the MPs line), and 9, 14, 14, 6 with them off
  (it listed all 17 on portrait and story before). The dialog's hint says how many a size lists
  — cost if wrong: `SPECS[size].minRows`, or the growth constants `MAP_GROWTH` and
  `MCA_MAP_GROWTH`.
- **Ruling: "about 15%" and "about 25%" are met only where the card has the room** — see the
  table above. The headline and footer may not shrink, so on some cards padding and gaps give
  8% to 12%. A shape already drawn across the full width cannot grow at all — cost if wrong:
  none hidden; the numbers are in the table.
- **Ruling: beside a wider map the headline takes a third line before it shrinks** — the plan
  forbids shrinking the headline. If it cannot keep its size and break cleanly (never inside a
  "party count" pair), the map grows by half as much, or not at all — cost if wrong: none.
- **Ruling: on X the map grows sideways** — it already ran the full height. A wide unit's column
  widens (the words' column narrows); a tall shape such as Kenya gains only the padding (4%) —
  cost if wrong: none hidden.
- **Ruling: the party card and the older "Share image" card keep their maps as they were** —
  both have their own layouts (`partyLayout.ts`, `layout.ts`); the owner was looking at the
  "Share this view" card. This is the one part of "about 15% on all cards" not done — cost if
  wrong: the same padding-and-gaps change in two more files; listed under "What is next".

- **Ruling: the leaders card lives in `lib/export/leadersCard.ts` and `leadersLayout.ts`, not in
  `countyLeaders.ts`** — the plan names `countyLeaders.ts`, but the later addition makes the county
  card "the county version of the same card", so one view model covers county, constituency and
  ward. `countyLeaders(seats, index, code)` is still exported, and is `leadersFor` — cost if
  wrong: a file name.
- **Ruling: `stripePattern(colours, size)` takes no theme** — the plan writes
  `stripePattern(colours[], theme, size)`, but the colours passed in are already the theme's (the
  party colours, the no-data and faded tokens), so a new theme is simply new colours and a new
  id. It returns raw RGBA pixels (`{ width, height, data }`), which MapLibre's `addImage` takes
  and which can be made without a canvas — cost if wrong: none.
- **Ruling: pattern images are made from their id** — `patternId` spells the three colours, so
  the visible map and the export map each make an image when the style asks for it
  (`styleimagemissing`) and neither keeps a list. The visible map also adds them before it sets
  the paint; the export map adds them as soon as its style is in (a tile laid out before its
  pattern exists stays empty: seen in the first export) — cost if wrong: none.
- **Ruling: stripes are 6px wide along the map (an 18px tile at pixel ratio 2, about 4px across
  the stripe), finer than first drawn** — at
  phone size the smallest counties must still show all three stripes; MapLibre scales a pattern
  up to 2x between zoom levels — cost if wrong: `STRIPE_SIZE`.
- **Ruling: "County seats" is the seventh and last chip, with the three county ballot colours as
  a small mark and the ink face when active** — it has no ballot colour of its own, and a striped
  chip face would need a gradient, which the UI rules forbid — cost if wrong: its place in
  `CHIPS` and its face class.
- **Ruling: the chips sit beside the search bar from 1536px (Tailwind 2xl), not 1280px** — seven
  chips need about 640px beside the panel and the search bar; at 1440 the row overflowed and
  scrolled "None" out of view. Between 1280 and 1535 they now sit under the search bar, as on
  smaller screens — cost if wrong: `CHIPS_BESIDE_SEARCH` and three classes in `Map.vue`.
- **Ruling: "County seats" has no share card for all of Kenya** — the plan specifies the county
  leaders card and the striped map, not a national striped card. With Kenya in view the legend
  has no "Share this view"; with a county focused it opens that county's leaders card — cost if
  wrong: a national card is a new layout (not built).
- **Ruling: the deep link `?seat=county_seats` opens the striped view**, and is the link printed
  on a county leaders card — cost if wrong: none.
- **Ruling: how the leaders card is reached** — (1) "Share leaders" beside "Who represents" in
  the panel, at every level and with any colouring, even none; (2) in the share dialog, a "Card"
  choice, "This view" or "County leaders" ("Leaders" for a constituency or a ward), whenever a
  unit is focused; (3) "Share this view" in the County seats view of a county — cost if wrong:
  the button's wording or place.
- **Ruling: leader blocks are rows, and the map sits beside them when that keeps the type
  bigger** — on a square card three to five rows under a full-width map came out too small to
  read, so the layout prefers the arrangement with the larger type and more detail, then the
  larger map. The unit's own seat always says since when and gives its source; the rows held
  above it drop that line when the room is short (their sources are in the footer) — cost if
  wrong: the chooser in `leadersLayout`.
- **Ruling: the line under a leaders headline is the longest wording that fits** ("Ward in
  Mathare constituency, Nairobi City County", then "Ward in Nairobi City County", then "Ward") —
  so it is never cut — cost if wrong: wording.
- **Ruling: a constituency's leaders card ends with "MCAs in 6 wards: ODM 3, UDA 3" over one
  bar**, with a no-data part for wards without an approved MCA — the plan asks for "an MCA mix
  bar with 'of N wards'" — cost if wrong: wording.

- **Ruling: MCA names show on the selected ward only, and in a ward's hover tooltip** — the
  plan's first rule (every ward large enough on screen, from zoom 11.5 or inside a focused
  constituency) was built and looked at. In Mathare a small ward carried a three-line label
  across its neighbours and the MP outline, and the unit directory has only bounding boxes to
  judge "large enough" by, which a long thin ward passes. So the plan's own fallback applies.
  Rural constituencies fit below the zoom where ward labels start (9.1), so they would not have
  shown names either — cost if wrong: the size rule is in git history (`71f969a^..71f969a`,
  `lib/map/wardLabels.ts`); it needs ward areas, not bounding boxes, to be safe.
- **Ruling: the outlines have their own highlight** — the plan says both "the party highlight
  applies to both layers" and "each section's rows toggle the highlight for its own layer". Each
  list highlights its own layer; "Show all" clears both. The outlines' highlight lasts while the
  MCA view does: it is not stored, and is not in the share link (a card made while it is on does
  carry it) — cost if wrong: one shared list instead of two in `Map.vue`.
- **Ruling: the outline is 4 to 5px from zoom 12, and a thin line (1 to 2px between half-pixel
  ink edges) further out** — the plan's 4 to 5px, drawn inside every constituency with a whole
  county in view, crossed narrow constituencies into their neighbours in Nairobi City and buried
  the ward fills. Inside a focused constituency only that one outline is drawn, so it keeps 2.5
  to 3.5px at the low zooms a rural constituency fits at — cost if wrong: `OUTLINE_WIDTH`,
  `OUTLINE_EDGE` and their `_ALONE` versions in `lib/map/style.ts`.
- **Ruling: in the MCA view a focused county's own ink outline sits just outside its border** —
  centred on the border, as in every other view, it covered the thin MP bands of the
  constituencies along the county's edge — cost if wrong: one paint property
  (`line-offset` on `counties-selected`).
- **Ruling: the band is drawn inside each constituency (`line-offset`)** — so on a shared border
  each neighbour shows its own MP's colour on its own side. Inside a focused constituency it
  starts clear of that constituency's own ink outline, which would otherwise cover it — cost if
  wrong: none.
- **Ruling: the badge is the second line of the constituency's own label** ("Westlands", then
  "MP: ODM"), tried first; where the two lines do not fit, the plain name still shows. It comes
  and goes with the names (zoom 6.6 to 10.3). A focused constituency keeps this label at any
  zoom, so its outline is always named. A separate floating badge was built first: it outlived
  the names and read like a ward label. One consequence: a focused county that fits above zoom
  10.3 (Mombasa; Nairobi City on a large screen) shows neither its constituencies' names nor
  their badges, as it showed no names before; its outlines are then named by the legend's list
  only — cost if wrong: `seatLabelLayers` in `lib/map/style.ts` (the label's `maxzoom`).
- **Ruling: no outline, badge or "MPs (outline)" list while a ward is focused, or for all of
  Kenya zoomed out past zoom 6.4** — a focused ward has no constituency around it on screen; at
  national zoom the outlines are not drawn, so the legend does not list them — cost if wrong:
  `outlinesOn` and `outlinesInView` in `Map.vue`.
- **Ruling: a county's MCA card always prints its MPs line when its map has outlines** — it is
  the outlines' key, so it wraps between its "party count" pairs onto as many lines as it needs
  and is never dropped; when rows and line together do not fit, the leader rows shorten ("+1
  more at <link>"), not the line —
  cost if wrong: `leadersStrip`.
- **Ruling: the legend box's source line names the sources of everything in the box** — the seats
  it counts, the leaders in its strip and the MPs of its outline list (IEBC gazette notices, then
  any other site by name), instead of the fixed "IEBC gazette notices" it had since v0.2.0 —
  cost if wrong: none; it is more accurate.
- **Ruling: "Show MPs as outlines" is stored under `kem.mpOutlines`** (on unless switched off) —
  cost if wrong: none.

## Parked minor findings

- **For the owner to confirm:** only MCA cards carry the leaders strip (see the ruling). The
  plan's "no duplication" sentence suggests Governor, Senator, Woman Rep and MP cards for a
  county or a constituency might be meant to carry it too. `cardLeaders` already leaves the
  card's own seat out, so it is one condition to change.
- The legend box exists only while a colouring is on, so with "None" chosen there is no "Leaders
  here" strip. The panel still lists the leaders.
- Labels over the stripes of a focused county are harder to read than over a flat fill (the
  label halo is the land colour). A darker halo in the County seats view would help.
- The "Share image" (locator) card and the party card do not know the County seats view or the
  MP outlines: they draw their maps as before.
- A fresh visitor who opens a ward or a constituency from Kenya with "None" chosen keeps "None"
  (`modeForFocus` only switches a mode that does not fit). The plan's "MCA is the default inside a
  constituency" holds only when the mode in use is a county seat.
- A holder whose record names no party is drawn in the Other grey in the County seats stripes,
  but no legend row counts them and the single-seat views still draw them as no data. The
  importer requires a party, so no such record exists today.
- `leadersStrip` does not check its shortened form (two rows, "+N more" and the MPs line)
  against the room it was given. No real county in any size came near it.
- The outline band is a `line-offset` of the constituency ring. In a constituency only a few
  pixels across the two sides can still meet. A precomputed inner ring per constituency (a
  mapshaper step in the boundary pipeline) would remove that for good.
- The outlines' highlight is not in the share link (`?parties=` carries the fills' only).
- The strip's short form keeps the first two rows: for a county, Governor and Senator, as the
  plan says; for a constituency, MP and Governor ("+2 more").
- `fitBlocks` in `leadersLayout.ts` returns its smallest attempt if nothing fits. The fixtures,
  with long names and five rows, all fit; nothing guards a case that does not.
- The square county leaders card puts the map beside the rows (for the type's sake), so a wide
  county is drawn smaller there than on the other sizes.
- The legend's heading stays "MCA seats in <unit> by party" while the box also lists MPs.
- Stripes are 6px wide along the map (about 4px across the stripe) at a whole zoom, and up to
  twice that between zooms. (The ruling above says "9px bands": that was the first size.)

## Parked minors from the roadmap fixed on the way

- **"The Mathare MP square leaves empty space around a small map"** (social export): fixed. The
  card map stopped zooming at 13, so a small urban constituency was drawn at about half its box.
  It may now zoom to 16 (`VIEW_MAP_MAX_ZOOM` in `lib/export/viewMap.ts`).
- **Seat chips: "Phones show 'None' off-screen when MP or MCA is active"**: not fixed, and now
  true of 1280 to 1535px desktops no longer (the chips moved under the search bar there).
- **Legend height** (not on the list, found here): the open legend ran under the seat chips and
  the back button once the strip made it taller. It is now capped under them.

## What is next

- The owner's answer on the leaders strip for non-MCA cards (first parked finding).
- Bigger maps on the party card and the "Share image" card (see the ruling).
- The parked minors above, when their code is next touched.
