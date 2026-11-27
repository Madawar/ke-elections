# Share formats branch (`feature/share-formats`): progress log

Tasks of `2026-11-27-share-formats.md`. This file is the running log: what is done (with commits),
every ruling made on the way, parked minor findings and what is next. A later session can resume
from here.

## Status

| Task | What | State | Commit |
|---|---|---|---|
| A | The card system takes more kinds of card: one registry, sizes per card, any number of map slots, a map spec's own colouring, the "Card" choice as a list, fixed headlines | done | `fe2d018` |
| B | "By the numbers" (mock-up 6), square and story, offered with nothing focused | done | see `git log` (`feat(export): "By the numbers" card…`) |
| Review fixes | Slot images reach the card, one component per registry entry, a map-less card credits only the codes, skipped maps leave the cache, no other card's map while one's own is drawing, small numbers-card fixes | done | see `git log` (`fix(export): …`) |
| C | "Top 10 counties for a group" (mock-up 8), square and story, from the national seat view (MP/MCA, one group highlighted) and the party profile | done | see `git log` (`feat(export): "Top 10 counties"…`) |
| D | "Kenya, five ways" (mock-up 5) | not started | |
| E | "Who represents this ward" (mock-up 1) | not started | |

### Task A: what did not change

Before the refactor, the registry's helpers (headline, dialog copy, both captions, the layout in
all four sizes, the file name and the card in the other theme) were written out for a seat view
for all of Kenya, a seat view for Nairobi City, a party card and a county leaders card, and again
after it: the two dumps were identical byte for byte. The PNGs downloaded from the running app for
`/?seat=mca` ("This view", square), `/county/47?seat=county_seats` (leaders, square) and
`/party/uda` (party card, square) were also byte-identical before and after.

### Task B: how it was checked

Downloaded from the running app (`/?seat=mca`, "Share this view", "By the numbers") in square and
story, light and dark, and looked at beside mock-up 6. The square card follows the mock-up row
for row. The seat view, leaders card and party card PNGs were downloaded again after Task B and
are still byte-identical to the ones taken before Task A.

### Review fixes: how they were checked

Each fault has a test that fails without its fix (checked by undoing each fix in turn):
`ShareViewDialogCards.test.ts` draws the mocked three-slot card with a stub that shows one image
per slot key (slot images reach the preview); "draws the maps a card skipped once more…" (skipped
maps leave the cache, and the preview is cleared once); "never shows another card’s map…" (two
cards with the same slot key and box: unfinished maps clear the preview, and the card is part of
the cache key). `ShareViewDialog.test.ts` checks that no card gets a dialog prop as an attribute.
The seat view, leaders card and party card PNGs (square) are byte-identical before and after; the
numbers card changed in its footer only (the codes credit), which frees room the rows now use.

### Task C: how it was checked

Downloaded from the running app in square and story, light and dark: independents on MCA seats
(`/?seat=mca&parties=ind`, "Share this view", "Top 10 counties") and UDA on MP seats
(`/?seat=mp&parties=uda`), plus UDA's MCA card from its profile (`/party/uda`, "Share"). Looked
at beside mock-up 8. Fixed on the way: a lone "seats" on the headline's second line (the last two
lines are now rebalanced, tested), small row type on the story (its rows sit a little closer),
short bars beside "of 12 constituencies" (the bars keep at least 28% of the rows' width), a note
wrapped in the rows' column under an empty map column (it takes the full width there), and a
faint lowest shade on the dark map. The seat view, leaders and party PNGs are still
byte-identical.

After the owner's look at Task C: the map is back to the plan (flat group colour, no key, a halo
on the county lines), the rows no longer shrink for a long "of N constituencies", and the story's
map is centred with its caption under it (see the rulings). Downloaded again in the eight
combinations and looked at; the seat view, leaders and party PNGs are still byte-identical.

## Rulings

Each one: what was decided, why, and what it costs if it is wrong.

- **Ruling: the dialog keeps its `view` prop beside the new `cards`** — `view` is the card it
  opens on and is always `cards[0].view` (Map.vue passes both); three page tests mock the dialog
  and read `view`, and the dialog still works when given a view alone — cost if wrong: one prop
  that could be derived.
- **Ruling: the registry stays in `lib/export/shareView.ts`, with no `cards.ts`** — the file was
  small and every caller already imports from it — cost if wrong: a file move.
- **Ruling: the three existing layouts are unchanged; the registry names their one map slot
  ("map") from the layout's `map` box** — changing three layouts' return types to carry slots
  would have touched the video and the layout tests for no visible gain. A new kind says which
  slots its layout places in its own registry entry — cost if wrong: a field on three layouts.
- **Ruling: the "Card" choice's keys are `view`, `leaders` and `partyCard`** (and one per new
  kind), from the registry, and `shareCards([...])` drops what is not on offer (null or false), so
  Map.vue adds a card with one line — cost if wrong: none.
- **Ruling: `mapBoxOf` is replaced by `mapSlotsOf`** — the dialog was its only user — cost if
  wrong: none.
- **Ruling: the map cache key is card, size, theme, slot and box** — the plan says card, size,
  theme and box; two slots of one card can have the same box size — cost if wrong: none.
- **Ruling: the preview shows each map as it is drawn, and the PNG waits for all of them** — the
  plan only asks that no PNG be made before every slot is drawn — cost if wrong: none.
- **Ruling: the size picker has two columns when a card comes in two sizes** (four as before
  otherwise) — four columns with two filled looked broken — cost if wrong: one class.
- **Ruling: the fixed-headline line reads "This card’s headline is fixed, so it stays neutral."
  with a typographic apostrophe**, as the dialog's other text does — cost if wrong: one character.
- **Ruling: the dialog's tests for several maps, fewer sizes and a fixed headline replace the
  registry's answers for the leaders card** (`tests/js/export/ShareViewDialogCards.test.ts`) — no
  kind built in Task A has them, and the dialog only asks the registry — cost if wrong: the later
  kinds add their own dialog tests as well.

- **Ruling: "By the numbers" says "Ties are listed by party abbreviation." only when a tie for
  third place decided who is listed** (the global rule: say so where a tie decides who is
  listed); a tie inside the top three only orders them — cost if wrong: one condition
  (`tieAtCut` in `lib/export/numbersCard.ts`).
- **Ruling: "Most held" is `seatLegend`'s first three, party by party**, so a party without a
  colour of its own can be listed (with the grey chip), as it is in the legend's counts — cost if
  wrong: filter on `hasOwnColour` in `numbersCard.ts`.
- **Ruling: the card's sources are every holder it counts: the five seats and the nominated
  members its note counts** — the plan says "all five seats' holders"; the nominated count is a
  number on the card too, so its sources are named — cost if wrong: one line in
  `numbersCardView`.
- **Ruling: a seat "has no approved holder" when no holder of that seat with a party has its
  code** (independents have the party IND); the bar's no-data part is that count, so the bar,
  `seatLegend` and the note agree. Superseded the earlier "any party or none" (review fix). It
  changes no real number: `/data/seats.json` gives every holder a party (none is IND) — cost if
  wrong: one filter in `numbersCard.ts`.
- **Ruling: singular wordings** — "1 seat has no approved holder yet"; the nominated members are
  named by what the data has: "nominated MPs", "nominated senators" or "nominated MPs and
  senators" ("1 nominated MP", "1 nominated senator") — cost if wrong: strings in `numbersNote`.
- **Ruling: the headline can be edited** (the plan fixes only the top-10 headline) — cost if
  wrong: `editableHeadline: false` on the entry.
- **Ruling: the dialog copy is "Share by the numbers" / "Every elected seat below the President
  and who holds them now, sized for Instagram or stories."; the file is
  `kenya-electoral-map-numbers-<size>.png`; the caption gives one line per seat, "Governors: 47
  seats. Most held: UDA 20, ODM 15, WDM-K 3.", then the note** — cost if wrong: strings.
- **Ruling: the story card keeps the square card's row structure** (number column, then the
  words). Its column of words is narrower than the "Most held:" line, so when any row's line
  does not fit, every row puts its three groups on the line under "Most held:", the same in
  each row; the type is not made smaller than 88% for a cleaner break, and the number column
  takes at most 30% of the width — cost if wrong: `MIN_SCALE` and `NUMBER_COLUMN` in
  `numbersLayout.ts`.
- **Ruling: the big numbers are weight 800 at the card's usual width, not the headline's wider
  face** — their column is measured with the card's text metrics, which assume that width —
  cost if wrong: the number column would need a wider measure.
- **Ruling: the X captions of all four kinds share one helper (`xCaption`)** — it was the same
  code three times; the existing caption tests pass unchanged — cost if wrong: none.
- **Ruling: `spread` in `viewMix.ts` is exported** so the card's thin bars use the same part
  widths as the seat mix bar — cost if wrong: none.

- **Ruling: the card's component is a field of its registry entry (`component`, read with
  `componentOf`), in `lib/export/shareView.ts` itself** — no card component imports
  `shareView.ts`, so there is no import cycle, and the pure-TS tests that import the registry
  load the SFCs through Vitest's Vue plugin without trouble; one entry is then the whole of a new
  card. The dialog gives every card the same props (`CardProps`), and each card declares them all
  (the numbers card declares the four map props and ignores them) — cost if wrong: move the four
  imports to a sibling module.
- **Ruling: the credits are split into `BOUNDARIES_CREDIT`, `CODES_CREDIT` and `TOWNS_CREDIT`**,
  and `ATTRIBUTION` is the three joined with "; " (byte-identical, tested). A card with no map
  credits `CODES_CREDIT` alone: its counts are joined on the gazetted codes; it draws no boundary
  and no town — cost if wrong: the numbers card passes `ATTRIBUTION` again.
- **Ruling: a skipped map leaves the cache only if the cache still holds that same drawing**, and
  a map counts as finished only then too, so a later drawing of the same key is never forgotten
  by an older one's skip — cost if wrong: none.

- ~~**Ruling: the top-10 map is a neutral count scale, not the group's colour**~~ **Superseded**
  (owner's eye, after Task C): the ink count scale and its two-ended key came from a brief that was
  a mistake. On the dark card the strongest shade was near-white, so the map no longer read as the
  same thing as the bars. Now as the plan and mock-up 8 have it:
- **Ruling: the top-10 map fills the listed counties flat in the group's data colour (the bars'
  colour), the rest in the no-data colour, captioned "The 10 counties shaded", with no key** —
  map and bars read as one thing — cost if wrong: `topCountiesColouring` in `topCountiesCard.ts`.
- **Ruling: the top-10 map's county lines are drawn over a 3.2px halo in the card's land colour**
  (`ViewMapSpec.haloCountyLines`, only this map sets it). Without it the line between two listed
  counties all but vanished: #E8EEF0 on the independents' #E4C6D2 (dark) and navy on #4E3F4B
  (light). With it Kitui and Makueni stay apart in both themes (looked at, zoomed) — cost if
  wrong: one layer in `viewStyle`.
- **Ruling: the top-10 rows take their type size and height from the room alone** (up to 1.08 of
  the row label size and 2.1 × that size per row, about the mock-up's rows); a long right-hand
  column ("of 12 constituencies") first narrows its own type (to 75%, not below the card's small
  text), then the bars' track (to 20% of the rows' width), never the rows. On the square the room
  is taken with the note at the full width, as it is drawn under the map's caption. The MP and MCA
  square cards now both have 27px rows 57px high (UDA/MP was 22px and 47px) — cost if wrong:
  `OF_MIN`, `BAR_FLOOR`, `ROW_MAX` in `topCountiesLayout.ts`.
- **Ruling: the top-10 story's map is centred in the content width (72 to 960) under the rows and
  note, with its caption centred directly under it, as tall as the room before the footer** —
  the height is not there for it to be larger without smaller rows: between the note (baseline
  906) and the footer (1339) there are 433px; less the gap (22), the caption (38) and the space
  under the note, the map is 280 × 341, against 311 × 379 before (when the caption sat beside it).
  A map about 440 tall would need about 100px from the rows (row pitch 51 to about 41 on the MP
  story). The rows were left as they are, as asked; the owner decides — cost if wrong:
  `STORY_MAP_MIN` in `topCountiesLayout.ts`.
- **Ruling: the map spec is seat `governor`, no focus, no highlight, with the card's colouring**
  (`mode: { kind: 'seat', seat: 'governor' }`), so the county fills are what is coloured and no
  ward lines are drawn; said in `ViewMapSpec.colouring`'s doc comment — cost if wrong: one spec.
- **Ruling: the scope line is the plan's two sentences on one line when they fit at 86% of the
  scope size; otherwise the first is the scope line and "The 10 counties with the most:" a line
  of its own above the rows** (the story for independents) — the title block's scope line is one
  line and would otherwise be cut — cost if wrong: one threshold.
- **Ruling: wordings the plan leaves open** — one county: "The one county with any:", "The one
  county shaded"; none: "No county has any." (nothing listed) and "No county shaded" (no key);
  one seat held: "1 of 290 MPs nationally is UDA." / "is an independent."; "of 1 ward" in the
  singular; the key reads "4 seats" / "1 seat" — cost if wrong: strings in `topCountiesCard.ts`.
- **Ruling: rank is the place in the list (1 to 10), so tied counties have consecutive ranks
  ordered by code**, as in the mock-up; the note says ties go by county code whenever two listed
  counties tie or the tenth ties with one left out — cost if wrong: `rank` in
  `topCountiesCardView`.
- **Ruling: the card's sources are the group's holders of that seat** (the counts on the card);
  with none, the seat's holders. "Of 1,450" and "of 40 wards" come from the unit index — cost if
  wrong: one line.
- **Ruling: the national seat view offers the card only when the highlighted group holds any of
  that seat** (the profile's rule, "when the party holds any", applied to both entry points); the
  card itself still handles none (tested) — cost if wrong: one condition in `topCountiesOf`
  (`Map.vue`).
- **Ruling: from the party profile, only across Kenya** — a profile scoped to a county or a
  constituency offers the party card alone, as the ranking is national — cost if wrong: one
  condition in `shareParty`.
- **Ruling: the strip draws the ranked seat's lid deeper** (MP or MCA), as the seat views do —
  checked: `viewLayout` calls `strip(w, spec.stripH, view.seat)`, so "This view" draws its seat's
  lid deeper too; kept — cost if wrong: one argument.
- **Ruling: the dialog copy is "Share top 10 counties" / "The counties where <group> hold(s) the
  most <seat> seats, sized for Instagram or stories."; the file is
  `kenya-electoral-map-top-counties-<group>-<seat>-<size>.png`; the Instagram caption gives the
  scope, one line per county ("1. Kitui: 9 of 40 wards"), the note, the source** — cost if wrong:
  strings.
- **Ruling: `topCounties(data, index, { seat, group, limit? })` in `lib/party.ts` is the one
  ranking; the profile asks it for MCA seats, five at most**; its `value` says "of N
  constituencies" for MPs — cost if wrong: none.
- **Ruling: a two-line headline whose last line would be one word is rebalanced** (the same words
  and size, broken where the two lines are most even), here only, as this headline is fixed and
  cannot be reworded by the person — cost if wrong: `balanced` in `topCountiesLayout.ts`.

## Parked minor findings

- The dialog tests store the size as `JSON.stringify('square')`, which `useStorage` (a string
  default, stored raw) reads as unknown and replaces with the default, so those tests never
  exercised a stored size. The new size tests store it raw. Left as it was in the old tests.

- The page test for the national card list (`tests/js/map/countySeatsPage.test.ts`, "This
  view|By the numbers") and the dialog test for the numbers card were written just after the
  wiring in `Map.vue` and the dialog, not before; the card's own tests were written first.
- The leaders layout keeps its own copy of the bar-spreading arithmetic; it could use `spread`
  too.
- On the top-10 story the map is 280 × 341 (see the ruling): a bigger map would mean smaller
  rows.
- `npm run check` (vp check) reports formatting issues in 118 files across the repository,
  as it did before this branch; not fixed here.

## What is next

Task D: "Kenya, five ways" (mock-up 5): five map slots (one per seat) and one shared key, square
and story, offered as "Five seats" in the national view's "Card" choice (between "This view" and
"By the numbers"). The registry entry's `component` and `maps` now carry everything a new card
needs; the dialog hands every card `mapImages` by slot key.
