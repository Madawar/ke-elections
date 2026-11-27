# Share formats, the next three (`feature/share-formats-2`): progress log

Tasks of `2026-11-27-share-formats-2.md`. This file is the running log: what is done (with
commits), every ruling made on the way, parked minor findings and what is next. A later session can
resume from here.

## Status

| Task | What | State | Commit |
|---|---|---|---|
| F | "Every county the same size" (county tiles, mock-up 4), portrait and story, from the national Governor, Senator and Woman Rep views | done | `0c28c80` (grid), `9f9be59` (card), `ce9535b` (entry point, sweep), `37f241b` (key columns), then the commit that updates this row (log) |
| G1 | The dialog's general ability: a card may carry one choice of its own | not started | |
| G2 | "Side by side" (mock-up 7), X and story | not started | |
| H1 | The dialog's general ability: a card may be a series | not started | |
| H2 | The county carousel (mock-up 3), portrait and story | not started | |

## Task F: the tile grid and its neighbours

### How neighbours are computed

`boundaries/pipeline/neighbours.mjs` reads the committed `public/boundaries/counties.geojson`
(GeoJSON, not TopoJSON). The counties are dissolved by mapshaper from one set of simplified wards
(`derive.mjs`), so two counties that share a border have the very same vertices along it. Two
counties are neighbours when a segment of their rings (two consecutive vertices, at the file's five
decimals) is the same in both. Pairs that only meet at a single vertex are listed apart under
`touching` and are **not** counted as neighbours. The result is committed as
`resources/js/lib/export/countyNeighbours.json`, keyed by code (116 neighbouring pairs; 4 pairs
touch at a point: Tana River–Meru, Isiolo–Kitui, Narok–Nyamira, Bomet–Kisii). A test
(`tests/js/boundaries/neighbours.test.mjs`) computes it again from the boundaries and checks it
equals the committed file, so a boundary change shows up. Rerun with
`node boundaries/pipeline/neighbours.mjs`.

### The mock-up's grid: 29 pairs apart

Real neighbours whose tiles are more than one cell apart (diagonals count as one), in the plan's
grid: Tana River–Garissa, Tana River–Isiolo, Lamu–Garissa, Taita Taveta–Kajiado, Garissa–Wajir,
Garissa–Isiolo, Wajir–Marsabit, Marsabit–Isiolo, Marsabit–Turkana, Meru–Embu, Meru–Kitui,
Tharaka - Nithi–Kitui, Machakos–Kirinyaga, Nyandarua–Murang'a, Nyandarua–Kiambu, Nyeri–Murang'a,
Kiambu–Kajiado, Turkana–Samburu, Turkana–Baringo, Trans Nzoia–Elgeyo/Marakwet, Uasin Gishu–Kericho,
Baringo–Nakuru, Baringo–Kericho, Laikipia–Nakuru, Nakuru–Narok, Nakuru–Kajiado, Narok–Migori,
Kericho–Homa Bay, Kakamega–Siaya.

### The moves, and why

Eight tiles moved; the grid keeps the mock-up's eight columns and nine rows, its silhouette but
for two cells, and the empty bottom-left corner. Internal gaps (empty cells between the first and
last tile of a row or column) went from 13 to 12: no hole was added.

1. **Turkana one column right (2,0 to 3,0), Baringo up into Elgeyo/Marakwet's cell and
   Elgeyo/Marakwet down into Baringo's** (a swap). Turkana now touches Marsabit, Samburu, Baringo
   and West Pokot: three pairs fewer (Marsabit–Turkana, Turkana–Samburu, Turkana–Baringo; the swap
   is what brings Baringo next to Turkana). Turkana is still the top of the west; Elgeyo/Marakwet
   and Baringo are at about the same latitude, so the swap barely changes the shape.
2. **Garissa one row down (7,4 to 7,5).** It now touches Tana River and Lamu (two pairs fewer); it
   was already apart from Wajir and Isiolo, and stays on the east edge.
3. **Around Mount Kenya, Murang'a, Kirinyaga, Embu and Tharaka - Nithi turned** (Murang'a 4,4,
   Kirinyaga 5,4, Embu 4,5, Tharaka - Nithi 5,5). Nyandarua–Murang'a, Nyeri–Murang'a and
   Tharaka - Nithi–Kitui come together; Meru–Tharaka - Nithi and Machakos–Murang'a go apart: one
   pair fewer. Murang'a stays west of Kirinyaga, as on the map.

Tried and not taken: a search that moved tiles freely found 19 to 22, but only by putting Nairobi
City under Kajiado, West Pokot above Turkana, Mombasa west of Kwale or a hole in the middle of the
grid; and swaps that only traded one pair for another (Nakuru with Nyandarua, Migori with Kisii).

### The final grid: 23 pairs apart

| Row | Columns 0 to 7 |
|---|---|
| 0 | –, –, –, Turkana, Marsabit, –, –, Mandera |
| 1 | –, Trans Nzoia, West Pokot, Baringo, Samburu, –, Wajir, – |
| 2 | Bungoma, Kakamega, Uasin Gishu, Elgeyo/Marakwet, Laikipia, Isiolo, –, – |
| 3 | Busia, Vihiga, Nandi, Nyandarua, Nyeri, Meru, –, – |
| 4 | Siaya, Kisumu, Kericho, Nakuru, Murang'a, Kirinyaga, –, – |
| 5 | Homa Bay, Nyamira, Bomet, Kiambu, Embu, Tharaka - Nithi, –, Garissa |
| 6 | Migori, Kisii, Narok, Nairobi City, Machakos, Kitui, Tana River, Lamu |
| 7 | –, –, –, Kajiado, Makueni, Taita Taveta, Kilifi, – |
| 8 | –, –, –, –, –, Kwale, Mombasa, – |

(The table in `lib/export/countyTiles.ts` is written with IEBC codes.)

Pairs still apart (23): Tana River–Isiolo, Taita Taveta–Kajiado, Garissa–Wajir, Garissa–Isiolo,
Wajir–Marsabit, Marsabit–Isiolo, Meru–Tharaka - Nithi, Meru–Embu, Meru–Kitui, Machakos–Kirinyaga,
Machakos–Murang'a, Nyandarua–Kiambu, Kiambu–Kajiado, Trans Nzoia–Elgeyo/Marakwet,
Uasin Gishu–Kericho, Baringo–Nakuru, Baringo–Kericho, Laikipia–Nakuru, Nakuru–Narok,
Nakuru–Kajiado, Narok–Migori, Kericho–Homa Bay, Kakamega–Siaya.

Most of what is left is the shape itself: the north-east is four large counties (Wajir, Garissa,
Tana River, Isiolo) that a grid of equal tiles cannot keep all touching while Garissa stays at its
latitude, and Nakuru has eight neighbours on every side. The test (`tests/js/export/countyTiles.test.ts`)
checks all 47 codes once, no shared cell, the shape (top row, lake columns, coast, Nairobi City),
the empty corner, the mock-up's 29 and at most 23 now.

## Task F: the card, and how it was checked

`lib/export/tilesCard.ts` (view, `tileInk`, `contrastRatio`), `tilesLayout.ts`,
`components/export/TilesCard.vue`, the `tiles` registry entry and `tilesCaption`. Tests:
`tilesCard.test.ts` (tile colours equal the map's `viewColouring` by code in both themes, with an
independent and a party with no colour of its own; the key equals `buildLegend`; vacancies; contrast
on light and dark fills in both themes; caption; registry), `tilesLayout.test.ts` (one pitch, names
whole and inside, one name size, the key's corner and under-the-grid cases, the component),
`tilesSweep.test.ts` (three seats × two sizes × two themes over the real county names; every county
KADU-ASILI, every county independent, every county a party with no colour, the twenty longest real
abbreviations with independents, no-colour and vacancies (a 23-entry key, under the grid), no holder
at all). The sweep was checked to fail: with the corner's room widened by 200px it reports the key on
Kajiado's tile. Page tests (`countySeatsPage.test.ts`): offered on the national Governor, Senator and
Woman Rep views as "This view|County tiles|Five seats|By the numbers", also with a party highlighted
(the card's tiles are the seat's, all 47); absent on MP, MCA, County seats and with a county or a
constituency focused.

Downloaded from the running app (`/?seat=governor`, `/?seat=woman_rep`, "Share this view", "County
tiles") in portrait and story, light and dark, and looked at beside mock-up 4. The portrait follows
the mock-up tile for tile in size (102px tiles, 5px gutters; the mock-up's are 99 and 5); names are
16px on portrait and 17px on story, dark on yellow, orange, teal and pale fills, white on blue, red,
the independents' dark slate and the dark no-data. The key sits in the empty corner in all eight, in
two columns of five ("Other parties" in the second column), 20–21px. The dialog at 390px wide shows
the four cards in two rows of two, and the facts hint under the headline. The square PNGs of
`/?seat=mca`, `/county/47?seat=county_seats` and `/party/uda` are byte-identical before the first
change and after the last.

Fixed on the way, after looking: with "Other parties" on a line of its own (chosen first because it
allowed a larger key), the key read as six entries then four; now the columns are kept whenever they
fit at some size, and the key's floor is the footer's small text.

## Rulings

Each one: what was decided, why, and what it costs if it is wrong.

- **Ruling: a pair that meets at a single point is not a neighbour** — such a pair shares no
  border to keep together on a tile map; the four are listed in the data under `touching` — cost
  if wrong: four more pairs to check (two are already next to each other).
- **Ruling: neighbours are computed from the GeoJSON's exact shared segments, with no tolerance** —
  every layer is dissolved from one set of simplified wards, so shared borders share their
  vertices; the test computes them again from the committed file — cost if wrong: a pair whose
  border was simplified apart would be missed (none is expected while the layers are derived as
  they are).
- **Ruling: the grid is kept as compact as the mock-up's, and its shape outranks the count** — 22
  or fewer pairs were possible only with Nairobi City under Kajiado, West Pokot above Turkana or a
  hole in the grid — cost if wrong: a few pairs more apart than a looser grid would have.

- **Ruling: the dark choice for the tile text is the card's ink on the light card and the card's
  ground colour (`land`, #0F2430) on the dark card**; the light choice is white in both — the plan
  says "the card's ink and white", but the dark card's ink (#E8EEF0) is nearly white, so on a yellow
  or orange fill neither would read (about 1.5:1). Whichever has the higher WCAG contrast with the
  fill wins (ties to the dark one) — cost if wrong: `tileInk` in `tilesCard.ts`.
- **Ruling: the key goes in an empty bottom-left corner found from the grid itself** (`emptyCorners`:
  for each number of bottom rows, how many leading columns are empty in all of them; today 3 × 2 and
  5 × 1), the larger corner first, at the card's small text (`callout.sub`) down to the footer's
  smallest (`footer.small`); with "Other parties" in its column at any of those sizes before trying
  it on a line of its own; otherwise under the grid at the card's small text, the tiles made smaller
  to make room. With the real data and the fixtures the key always fits the corner — cost if wrong:
  the order of the search in `tilesLayout`.
- **Ruling: the key's right edge keeps a tile's inner padding (8% of a tile) clear of the next tile**
  — cost if wrong: one margin.
- **Ruling: one name size for every tile, the largest from 16% of a tile down at which every name
  fits whole** (no floor stops it: a name is never cut; with the real names it is 16px on portrait,
  17px on story). Names break at spaces and after a slash or hyphen inside a word ("Elgeyo/"
  "Marakwet"); a hyphen standing alone stays with the word before it ("Tharaka -" "Nithi") — cost if
  wrong: `NAME`, `nameLines`.
- **Ruling: the grid is drawn from the left edge under the scope line, as in the mock-up**; on the
  portrait it is bound by the height (the room to its right is left empty, as the mock-up does), on
  the story by the width kept clear of the right-hand zone, which leaves about 80px between the grid
  and the footer — cost if wrong: one offset.
- **Ruling: the strip draws the card's seat lid deeper** (Governor, Senator or Woman Rep), as the seat
  views do; the mock-up drew all lids alike — cost if wrong: one argument.
- **Ruling: each tile carries its key group** (from the legend's `members`, so a party with no colour
  of its own is "other" and a county with no holder with a party is "none"), and the caption lists
  each key entry with its counties in IEBC code order ("UDA 20: Kwale, Kilifi, …."), so the image can
  be read in words; X gets the shared `xCaption` — cost if wrong: strings in `tilesCaption`.
- **Ruling: dialog copy "Share county tiles" / "Every county as one tile of the same size, coloured by
  the party of its governor, sized for Instagram or stories." (senator, woman rep); label "County
  tiles"; file `kenya-electoral-map-tiles-<seat>-<size>.png`; headline editable with the facts
  wording ("Keep it to the facts, so the image stays neutral.")** — cost if wrong: strings.
- **Ruling: the card's sources are that seat's holders; the link is `/?seat=<seat>` (`viewPath`)** —
  as the plan says — cost if wrong: none.
- **Ruling: a county "has no approved holder" when no holder of that seat with a party has its code**,
  as the numbers card and the legend count it — cost if wrong: one filter.

## Parked minor findings

- The card's own tests (`tilesCard.test.ts`, `tilesLayout.test.ts`) first failed on the missing
  modules, not against wrong code; the grid test and the page test failed for the right reason
  first (29 > 23; the card absent from the list).
- One existing test changed: `countySeatsPage.test.ts`, `?seat=governor&parties=uda` now lists
  "This view|County tiles|Five seats|By the numbers" (the plan adds the card there); its mocked
  dialog also reports the tiles card's seat.
- The story leaves about 80px empty between the grid and the footer (the grid is width-bound).
- The neighbour data is not rebuilt by `npm run boundaries:rebuild`; after a boundary change, rerun
  `node boundaries/pipeline/neighbours.mjs` (the test fails until then).

## What is next

Owner's look at Task F, then Task G1 (a card's own choice in the dialog).
