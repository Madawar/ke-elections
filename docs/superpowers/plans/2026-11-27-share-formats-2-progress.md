# Share formats, the next three (`feature/share-formats-2`): progress log

Tasks of `2026-11-27-share-formats-2.md`. This file is the running log: what is done (with
commits), every ruling made on the way, parked minor findings and what is next. A later session can
resume from here.

## Status

| Task | What | State | Commit |
|---|---|---|---|
| F | "Every county the same size" (county tiles, mock-up 4), portrait and story, from the national Governor, Senator and Woman Rep views | in progress | grid: the commit that adds this file |
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

## Parked minor findings

## What is next

Task F: the card (`tilesCard.ts`, `tilesLayout.ts`, `TilesCard.vue`), its entry point in `Map.vue`
and the sweep.
