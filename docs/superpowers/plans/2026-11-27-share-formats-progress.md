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
| Top-10 fixes | The map in the bars' colour (no count scale, no key), rows that keep their size, the story's map centred under the rows | done | see `git log` (`fix(export): top-10 map…`) |
| D | "Kenya, five ways" (mock-up 5), square and story, offered as "Five seats" with nothing focused | done | see `git log` (`feat(export): "Kenya, five ways"…`) |
| Review fixes 2 | Top-10: ties by code tested against an index out of code order, "with any" when the list is complete, singular wordings tested, the name column gives way before the rows shrink. Five seats: the story three across, the key inside its width, one title gap, the caption's key line. National "County seats" shares the national cards; closing the dialog stops its queued maps | done | see `git log` (`fix(export): …` after `1e439f9`) |
| E | "Who represents this ward" (mock-up 1), portrait and story, three locator maps (a frame with a marked unit, new in the map renderer), replacing the ward's leaders card | done | see `git log` (`feat(export): "Who represents this ward"…`) |

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

### Task D: how it was checked

Downloaded from the running app (`/?seat=mca`, "Share this view", "Five seats") in square and
story, light and dark, and looked at beside mock-up 5. The square follows the mock-up cell for
cell; its maps are 242 × 294, all five one size and lined up. The story's maps are 171 × 208 (see
the ruling). The five maps and the PNG were ready about 2.7 seconds after choosing the card, in
each size (headless Chromium, software GL). The seat view, leaders and party PNGs are still
byte-identical to the ones taken before this round.

### Review fixes 2 and Task E: how they were checked

Each Part 1 item has a test that fails without its fix: the reversed-index tie test failed with
`|| a.code - b.code` removed from `topCounties`; the "with any", key-inside-its-width, MP long-names
row size, County seats share and close-mid-draw tests each failed before their change. The
five-seats story was downloaded again (light and dark) and looked at: maps 242 × 294, the key in
four columns under the grid, the titles with one gap.

Task E was downloaded from the running app for Isukha West (`/ward/1046`) and Ngei
(`/ward/1448`), portrait and story, light and dark ("Share leaders" in the ward's panel), and
looked at beside mock-up 1, with the three locator maps of each zoomed in both themes. Isukha West
is found in Kakamega without help; Ngei in Nairobi City is under the least visible size and gets
its ring; Mathare in Nairobi City and the wards in their constituencies read as ink fills. The
dialog opens the card on portrait when the stored size is square (a card without square), and the
stored size is not overwritten. The seat view, leaders and party PNGs (square) are byte-identical
before the first change of this round and after the last.

The top-10 halo (owner's question G): at 3.2px it ate most of Nairobi City (listed for ODM on MP
seats); at 2.2px Nairobi's fill shows, and Kitui and Makueni (independents, MCA) still stay apart
in both themes. Mombasa is about 4px across on the square map: its county line alone covers it,
with or without the halo, so it shows no fill (see the ruling).

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
- **Ruling: the scope says "The 10 counties with any:" when the list holds every county the group
  has any in** (exactly ten), and "with the most:" only when counties were left out — "with the
  most" would suggest a cut that did not happen — cost if wrong: one condition in
  `topCountiesScope`.
- **Ruling: on a long right-hand column the name column gives way before the rows shrink**: after
  the "of" column narrows (OF_MIN) and the bars' track reaches BAR_FLOOR (20%), the name column
  narrows to the widest name at NAME_SHRINK (0.82, where `nameLines` already lets a name shrink or
  wrap), and the track may go to BAR_LAST (16%). An MP card listing Nairobi City ("of 17
  constituencies"), Elgeyo/Marakwet, Tharaka - Nithi and Trans Nzoia now keeps the MCA card's 27px
  rows, 57 high, on the square (it had 22px rows, 46 high); "Elgeyo/Marakwet", with no space to
  break at, is drawn at 22px — cost if wrong: `BAR_LAST`, `NAME_SHRINK` in `topCountiesLayout.ts`.
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

- **Ruling: the five-seats key is built from each seat's legend (`buildLegend`, all of Kenya)**:
  every own-colour row of any of the five, with its seats added up over the five, most first,
  ties by abbreviation (independents by "IND"), then "Other parties" when any legend has that row,
  then "No approved holder yet" in the no-data colour when any seat has none (the maps draw those
  seats in that colour, so the key names it) — tested both ways: every colour on the five maps is
  named, and nothing is named that no map shows — cost if wrong: `groups` in `fiveSeatsCard.ts`.
- **Ruling: the key holds at most 14 entries (two columns of seven); past that the parties with the
  fewest seats are folded into "Other parties" on the maps as well (`ViewMapSpec.fold` draws them
  in the Other grey), never the independents, and the line under the key adds "The N with the
  fewest are drawn as Other parties."** The real data has 12 entries, so nothing is folded today.
  The key's type is never below the card's small text (`callout.sub`); when the key needs more
  height than a map cell (the story), its row is made taller and every map a little smaller, all
  five still one size — cost if wrong: `KEY_MAX` in `fiveSeatsCard.ts`.
- **Ruling: the five maps draw no ward lines** (`ViewMapSpec.wardLines: false`) — at these sizes
  (about zoom 5) the ward lines would not be drawn anyway (they start at zoom 8.6), so this only
  says it; county lines are kept. Looked at, zoomed: the MCA map reads as its fills, with the grey
  that is really "Other parties" — cost if wrong: one field.
- **Ruling: the five County-seat maps are plain party fills per seat**, the seat view's own
  colouring (`viewColouring` of that seat with nothing highlighted; tested equal), not the striped
  "County seats" mode — cost if wrong: none.
- **Ruling: the headline is editable** (the plan fixes only the top-10 headline), with "Kenya’s
  five elected seats, by party" as the default. It goes on one line when it fits there at 84% of
  the usual size or more (the square: 50px), as in the mock-up; otherwise the usual two lines with
  no word alone on the last (the story) — `balanced` moved from the top-10 layout to `viewLayout`
  for this — cost if wrong: `ONE_LINE` in `fiveSeatsLayout.ts`.
- ~~**Ruling: the story keeps the plan's two across, three down**, and its maps are 171 × 208~~
  **Superseded** (owner's eye, after Task D): the plan's "two across, three down" was wrong for the
  story's shape; most of each cell was empty. Now:
- **Ruling: the story is three across, two down, as the square** (Governors, Senators, Woman Reps /
  MPs, MCAs). The key goes in the sixth cell only when its entries fit there in two columns at the
  card's small text with nothing past the cell's edge; on the story they do not (a cell is 272
  wide; "Independent" and "FORD-K" side by side at 26px need about 338), so the sixth cell is left
  empty, nothing is centred, and the key runs across the full width under the grid in four
  columns (three if four do not fit). Measured with the real data: the story's maps were 171 × 208
  and are now 242 × 294 (41% wider, 1.99 times the area), the same size as the square's. Not the
  270–280 wide hoped for: two rows of maps, their titles, the key (title line and three rows) and
  the safe zones leave 294 of height, and the map is as wide as that height allows — cost if
  wrong: `GRID` and `acrossColumns` in `fiveSeatsLayout.ts`.
- **Ruling: on the full-width key, its note sits at the right of the "Party colours" line** (muted,
  right-aligned) when it fits there; otherwise under the entries as before. It saves a line of
  height for the maps — cost if wrong: about 40px of map height (`noteAbove`).
- **Ruling: the five titles are one type size, the largest at which each fits its cell** (25px on
  the story's narrower cells, 23px on the square as before). Each is drawn as one `<text>` with two
  `<tspan>`s, the count `dx` = 0.3 × size after the name, so the browser sets the gap from the real
  name: "Woman Reps 47 seats" has the same gap as the others (the measure over-estimated that bold
  run). The layout keeps the count's estimated x for its checks — cost if wrong: `titleGapAt`.
- **Ruling: "Other parties" goes on a line of its own under the key's two columns (as "No approved
  holder yet" does) when that is what lets the columns fit in the cell.** On the square with the
  real data "Other parties" ended about 7px past the cell (into the right margin, past the
  footer's edge); now the second column holds only abbreviations. A test checks every key label
  and the note end inside the key's width, in every case and size — cost if wrong: one more line
  in the square's key (it still fits its cell).
- **Ruling: `KEY_MAX` (14) counts the party entries only**; "No approved holder yet" is one more
  line. Tested with folded parties and a vacancy together — cost if wrong: a doc comment.
- **Ruling: the five-seats caption's key line** lists the party colours (not "No approved holder
  yet"), then "The N with the fewest are drawn as Other parties." when parties are folded, then
  "No approved holder yet for N seats." ("1 seat") when any seat has none — cost if wrong: strings
  in `fiveSeatsKeyLine` (`caption.ts`).
- **Ruling: the key's note is broken into even lines** ("Parties in order of seats" / "held
  across all five") so no word sits alone — cost if wrong: `evenLines`.
- **Ruling: the dialog copy is "Share five seats" / "All five elected seats on one card, each map
  coloured by party, sized for Instagram or stories."; the file is
  `kenya-electoral-map-five-seats-<size>.png`; the Instagram caption gives the scope, one line per
  seat as "By the numbers" writes it, "Party colours, in order of seats held across all five:
  UDA, ODM, …", the source; X is the shared `xCaption`; the slot keys are the seat keys** — cost if
  wrong: strings.
- **Ruling: the card's sources are the five seats' holders** (as the plan says; no nominated
  members are counted here) — cost if wrong: one line.

- **Ruling: the national "County seats" (striped) view can be shared: "Share this view" offers
  "Five seats" and "By the numbers"**, opening on "Five seats"; there is no "This view" of the
  stripes (no card draws them). A focused county still shares its leaders card; inside a
  constituency the view gives way to MCA as before. The plan's "All of Kenya, any seat view"
  asked for it; before, the button was not shown there — cost if wrong: `canShareView` and
  `shareView` in `Map.vue`.
- **Ruling: closing the dialog while maps are queued drops them**: `wanted` is emptied on close,
  so the queued slots are skipped rather than drawn (up to four for "Five seats"), and a quick
  reopen does not wait behind them — cost if wrong: none.

- **Ruling: the ward card's locators are a new, optional `ViewMapSpec.mark`** (`{ level, code }`;
  the frame stays the spec's `focus`): the marked unit is filled in the theme's ink and every other
  unit of its level in the no-data colour, it is outlined (the renderer's "selected" line) in place
  of the frame, and nothing outside the frame is drawn, as on any focused card map. `seat` is the
  seat held at the mark's level (`mca` for a ward, `mp` for a constituency); ward lines are off
  (`wardLines: false`), so the county frames show their constituency lines. `onSurface` draws the
  map on the paper's surface colour. Existing specs are unchanged (byte-identical PNGs, and a test
  that a spec without a mark gives the same style with or without a box) — cost if wrong: the
  `mark` branch in `viewColouring` and `renderViewMap`.
- **Ruling: a marked unit drawn smaller than 10px across (`MARK_MIN_PX`) gets an ink ring** (radius
  8, 2px) around the middle of its bounding box, as the last layer: Ngei in Nairobi City on the
  portrait card. The size is worked out from the frame and the box as `renderViewMap` fits them
  (`markRing`, tested) — cost if wrong: a ring on a unit that would have been found anyway, or none
  where it is needed.
- **Ruling: the ward card's headline is editable, as the leaders card it replaces**, default "Who
  represents <ward> ward"; on two lines the default breaks after "Who represents" so the ward's name
  stays whole when it fits (an edited headline is laid out as it is) — cost if wrong:
  `editableHeadline` and `placeWhole`.
- **Ruling: the scope line is the longest of "<ward> ward is in <constituency> constituency,
  <county> County", "In <constituency> constituency, <county> County", "In <county> County" that
  fits at 80% of the scope size** — cost if wrong: strings in `ballotsScopeLines`.
- **Ruling: "Elected in August 2022" is `basisLabel` (moved from `UnitPanel.vue` to
  `lib/leaders.ts`, so the panel and the card share it) and the month of `started_on`**; with no date
  it is the word alone. The leaders card's "In office since …" is a different line and was left as
  it is — cost if wrong: `holderSince` in `ballotsCard.ts`.
- **Ruling: the party line is "<ABBREV>, <registered name>" with the abbreviation in ink**
  ("Independent" alone; the abbreviation alone when the data has no other name); a holder whose
  record names no party has no chip and no party line — cost if wrong: `rowOf`.
- **Ruling: one type scale for every seat on the card**, the largest (from 1.12 down to 0.8) at
  which the three papers fit between the scope line and the footer; no word below the footer's
  text size. A name steps down to 85% of the name size (`NAME_FLOOR`), then wraps onto more lines,
  and its seat's block and paper grow; it is never cut. The room left over pads every seat alike,
  up to 1.5 × the seat-label size, so the papers are evenly padded (tested) — cost if wrong:
  `SCALES`, `PAD_MAX` in `ballotsLayout.ts`.
- **Ruling: each paper's map sits in a right-hand column a quarter of the paper wide, in its
  frame's shape, centred on the paper's height**; a hairline between the county's three seats runs
  across the words' column only, as in the mock-up — cost if wrong: `MAP_COL`.
- **Ruling: the strip has no deeper lid** (the card is about all five seats, as "Five seats") —
  cost if wrong: one argument.
- **Ruling: dialog copy "Share who represents this ward" / "The five elected seats of <ward> ward
  and who holds them, with sources, sized for Instagram or stories."; label "Who represents"; file
  `kenya-electoral-map-ward-<code>-who-represents-<size>.png`; the Instagram caption gives where the
  ward is and one line per seat, "Governor (Kakamega County): <name> (ODM, Orange Democratic
  Movement). Elected in August 2022." (a vacancy: "…: no approved data yet."); X is the shared
  `xCaption`** — cost if wrong: strings.
- **Ruling: the card's sources are the five rows' sources** (`leaderSources` of `leadersFor(ward)`) —
  cost if wrong: one line.
- **Ruling: on a ward, `leadersOf` in `Map.vue` gives the ward card**, so both "Share leaders" and
  "Share this view" ("This view", "Who represents") reach it from the one place; a county and a
  constituency still get their leaders card (page tests). Nothing of the leaders card was removed:
  `leadersCardView` still makes a ward's card when asked directly (its tests stay), it is only no
  longer offered — cost if wrong: one branch.
- **Ruling: the top-10 map's county halo is 2.2px, not 3.2px**: at 3.2 it covered most of Nairobi
  City's fill; Kitui and Makueni stay apart at 2.2 in both themes (looked at, zoomed). Mombasa, about
  4px across on the square, shows no fill under its own county line at either width; a ring like
  the ward card's would be the fix if the owner wants it — cost if wrong: `COUNTY_HALO_WIDTH`.

## Parked minor findings

- Task E: the map-mark tests (`viewMapMark.test.ts`) and the ward card's tests were written first
  but first run only against missing modules (import errors), not against wrong code; the
  headline's "keep the ward's name whole" rule was written just before its test (the story PNG had
  shown "Isukha / West ward"). The page tests for the ward's entry points failed first as they
  should.
- The ward card's MP and MCA maps are small on the story (about 120 px tall): the papers' height
  comes from their words, and the map fits the paper.
- `leadersCardView` can still make a ward's "Leaders of <ward>" card (its tests use one); nothing
  offers it any more.

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

- Task D's tests were all written before its code, but run against it only once the modules
  existed (the first run would have failed on the missing imports).
- ~~On the national "County seats" view with nothing focused, "Share this view" goes the
  leaders-card way~~: it was not offered there at all (`canShareView` was false). Now it offers
  "Five seats" and "By the numbers" (see the ruling).

## What is next

All five tasks are done: a final review of the branch (the plan's "Review focus"), then the owner's
look. Open for the owner: the top-10 story map's size, the five-seats story (now three across, maps
242 × 294), and whether a listed county as small as Mombasa should get a ring on the top-10 map.
