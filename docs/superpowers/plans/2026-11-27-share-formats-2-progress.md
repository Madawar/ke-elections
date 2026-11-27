# Share formats, the next three (`feature/share-formats-2`): progress log

Tasks of `2026-11-27-share-formats-2.md`. This file is the running log: what is done (with
commits), every ruling made on the way, parked minor findings and what is next. A later session can
resume from here.

## Status

| Task | What | State | Commit |
|---|---|---|---|
| F | "Every county the same size" (county tiles, mock-up 4), portrait and story, from the national Governor, Senator and Woman Rep views | done | `0c28c80` (grid), `9f9be59` (card), `ce9535b` (entry point, sweep), `37f241b` (key columns), `df5cb78` (log), `4e51799` (Mount Kenya tiles back), `7beca8d` (review fixes: vacant tiles outlined, link test, notes) |
| G1 | The dialog's general ability: a card may carry one choice of its own | done | `ec2037e` |
| G2 | "Side by side" (mock-up 7), X and story, from a county on the MP or MCA view | done | `7cb9db1` |
| H1 | The dialog's general ability: a card may be a series | done | `e6549cd` |
| G review | Side by side and the choice: a vacant Woman Rep inside its column, bar proportions, dialog robustness | done | `ebfc563` |
| H2 | The county carousel (mock-up 3), portrait and story | done | `d5310c2` |
| Final review | One link per series, the carousel on County seats, keyboard focus in the stepper, small fixes, missing tests | done | `081ab8a` |

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

Four tiles moved (eight at first; the Mount Kenya four went back, see move 3); the grid keeps the
mock-up's eight columns and nine rows, its silhouette but for two cells, and the empty bottom-left corner. Internal gaps (empty cells between the first and
last tile of a row or column) went from 13 to 12: no hole was added.

1. **Turkana one column right (2,0 to 3,0), Baringo up into Elgeyo/Marakwet's cell and
   Elgeyo/Marakwet down into Baringo's** (a swap). Turkana now touches Marsabit, Samburu, Baringo
   and West Pokot: three pairs fewer (Marsabit–Turkana, Turkana–Samburu, Turkana–Baringo; the swap
   is what brings Baringo next to Turkana). Turkana is still the top of the west; Elgeyo/Marakwet
   and Baringo are at about the same latitude, so the swap barely changes the shape.
2. **Garissa one row down (7,4 to 7,5).** It now touches Tana River and Lamu (two pairs fewer); it
   was already apart from Wajir and Isiolo, and stays on the east edge.
3. ~~**Around Mount Kenya, Murang'a, Kirinyaga, Embu and Tharaka - Nithi turned**~~ **Undone**
   (owner's eye, after Task F; see the ruling): the turn saved one pair but put Kirinyaga above
   Tharaka - Nithi and Embu west of it. The four are back where the mock-up had them: Kirinyaga
   4,4, Tharaka - Nithi 5,4, Murang'a 4,5, Embu 5,5.

Tried and not taken: a search that moved tiles freely found 19 to 22, but only by putting Nairobi
City under Kajiado, West Pokot above Turkana, Mombasa west of Kwale or a hole in the middle of the
grid; and swaps that only traded one pair for another (Nakuru with Nyandarua, Migori with Kisii).

### The final grid: 24 pairs apart

| Row | Columns 0 to 7 |
|---|---|
| 0 | –, –, –, Turkana, Marsabit, –, –, Mandera |
| 1 | –, Trans Nzoia, West Pokot, Baringo, Samburu, –, Wajir, – |
| 2 | Bungoma, Kakamega, Uasin Gishu, Elgeyo/Marakwet, Laikipia, Isiolo, –, – |
| 3 | Busia, Vihiga, Nandi, Nyandarua, Nyeri, Meru, –, – |
| 4 | Siaya, Kisumu, Kericho, Nakuru, Kirinyaga, Tharaka - Nithi, –, – |
| 5 | Homa Bay, Nyamira, Bomet, Kiambu, Murang'a, Embu, –, Garissa |
| 6 | Migori, Kisii, Narok, Nairobi City, Machakos, Kitui, Tana River, Lamu |
| 7 | –, –, –, Kajiado, Makueni, Taita Taveta, Kilifi, – |
| 8 | –, –, –, –, –, Kwale, Mombasa, – |

(The table in `lib/export/countyTiles.ts` is written with IEBC codes.)

Pairs still apart (24): Tana River–Isiolo, Taita Taveta–Kajiado, Garissa–Wajir, Garissa–Isiolo,
Wajir–Marsabit, Marsabit–Isiolo, Meru–Embu, Meru–Kitui, Tharaka - Nithi–Kitui, Machakos–Kirinyaga,
Nyandarua–Murang'a, Nyandarua–Kiambu, Nyeri–Murang'a, Kiambu–Kajiado, Trans Nzoia–Elgeyo/Marakwet,
Uasin Gishu–Kericho, Baringo–Nakuru, Baringo–Kericho, Laikipia–Nakuru, Nakuru–Narok,
Nakuru–Kajiado, Narok–Migori, Kericho–Homa Bay, Kakamega–Siaya.

Most of what is left is the shape itself: the north-east is four large counties (Wajir, Garissa,
Tana River, Isiolo) that a grid of equal tiles cannot keep all touching while Garissa stays at its
latitude, and Nakuru has eight neighbours on every side. The test (`tests/js/export/countyTiles.test.ts`)
checks all 47 codes once, no shared cell, the shape (top row, lake columns, coast, Nairobi City),
the empty corner, the Mount Kenya four in the mock-up's cells, the mock-up's 29 and at most 24
now.

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

## Task G1: a card's own choice in the dialog

A `cards` entry may carry `choice` (`CardChoice` in `lib/export/shareView.ts`):

```ts
{
    key: 'versus', label: 'Side by side', view,            // the view for `choice.value`
    choice: {
        label: 'Compare with',
        options: [{ value: '1', label: 'Mombasa' }, ...], // shown in this order
        value: '1',                                       // the pick the card opens on
        make: (value) => ShareableView,                   // the card for another pick
        remember: (value) => void,                        // optional: called on every change
    },
}
```

While that card is picked, the dialog shows a labelled native `<select>` (`#view-card-choice`,
`h-11`, the dialog's focus outline) under the "Card" choice, also when the card is alone in the
list. A change keeps the pick for that card, shows `make(value)` in place of `view`, resets the
headline to the new view's own and builds again (maps redraw); `remember(value)` is called. The
dialog never looks inside a value. Tests: `tests/js/export/ShareViewDialogChoice.test.ts`, with a
mocked card whose two picks have the same slot key and box (the select only for a card with a
choice; label, order, keyboard focus, 44px; the rebuilt preview, headline and caption; the cache
keeping the picks apart; a change of pick mid-draw never showing the other pick's map; the pick kept
while another card is looked at and reset when the page hands new cards; no `remember`).


Each one: what was decided, why, and what it costs if it is wrong.

- **Ruling: a pair that meets at a single point is not a neighbour** — such a pair shares no
  border to keep together on a tile map; the four are listed in the data under `touching` — cost
  if wrong: four more pairs to check (two are already next to each other).
- **Ruling: neighbours are computed from the GeoJSON's exact shared segments, with no tolerance** —
  every layer is dissolved from one set of simplified wards, so shared borders share their
  vertices; the test computes them again from the committed file — cost if wrong: a pair whose
  border was simplified apart would be missed (none is expected while the layers are derived as
  they are).
- **Ruling: Murang'a, Kirinyaga, Embu and Tharaka - Nithi stay where the mock-up had them**
  (Kirinyaga and Tharaka - Nithi on row 4, Murang'a and Embu under them on row 5). Supersedes the
  turn in move 3. The turn put Kirinyaga above Tharaka - Nithi and Embu west of it, which reads
  wrong to anyone who knows the Mount Kenya counties; the mock-up's order (Meru, Tharaka - Nithi,
  Embu going south; Nyeri, Kirinyaga, Murang'a going south) is the familiar one, and shape outranks
  the pair count. The other moves (Turkana, Baringo and Elgeyo/Marakwet, Garissa) stay. Tested — cost
  if wrong: one pair more apart (24, not 23).
- **Ruling: a shared border across water counts** (the county polygons include the lake, so
  Siaya and Homa Bay share about 70 km of border, all of it across Lake Victoria) — cost if wrong:
  Siaya–Homa Bay would drop out of the list (they are next to each other anyway).
- **Ruling: the pair count is taken as computed, though four neighbour pairs share under 1.5 km of
  border where several counties meet** (Machakos–Kirinyaga 0.2 km, Meru–Embu 0.3 km, Tharaka -
  Nithi–Kirinyaga 0.4 km, Meru–Kirinyaga 1.2 km), so the count is sensitive to simplification
  there; and Embu–Nyeri, Tharaka - Nithi–Nyeri and Embu–Murang'a come within 140–280 m of each
  other without sharing a segment and are not counted — cost if wrong: a pair or two more or fewer
  in the count after a boundary rebuild (the neighbours test shows it).
- **Ruling: a no-data tile and the key's "No approved holder yet" chip are outlined in the theme's
  hairline** (`outlined` on the tile and the key entry in `tilesLayout`, drawn by `TilesCard.vue`; a
  2px line on a tile, the five-seats key's 1px on the chip) — the no-data fill is 1.09:1 against the
  light card and 1.33:1 on the dark one, so a vacant county read as a hole in the grid with a name
  floating in it. Tested with a vacancy in both themes and looked at (three vacant coast counties,
  light and dark) — cost if wrong: one stroke.
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

- **Ruling: the remembered pick lives with the page, not the dialog** — the dialog only calls
  `choice.remember?.(value)`, and the page passes the starting `value` (and its `view`); the dialog
  knows no storage key and nothing about what a value means — cost if wrong: one callback.
- **Ruling: the map cache key of a card with a choice is `<card key>=<pick>|size|theme|slot|box`**;
  a card without a choice keeps `<card key>|…` as before. The card key alone is no longer enough:
  two picks of one card can have the same slot key and box (both halves of "Side by side" are one
  box size) — cost if wrong: none.
- **Ruling: the pick is kept per card while the dialog stays open with the same cards** (switching
  to another card and back finds it again), and starts from the card's `value` when the page hands
  new cards; theme and size stay as the person set them when the pick changes — cost if wrong: one
  reset in the props watcher.
- **Ruling: `make` is not called for the card's own `value`**: its view is the entry's `view`, so the
  page builds that one once — cost if wrong: none.

- **Ruling: "Side by side" on the story stands each county's map at the right of its half, as tall
  as the half (42% of the width), with the words in the column beside it** — the plan only says the
  second county is under the first; with the map under the words, as on X, it would be about 200px
  tall in an 888px-wide box. The words may grow to 1.3 of their base size to fill the half — cost if
  wrong: `STORY_MAP` and the story's `SCALES` in `versusLayout.ts`.
- **Ruling: one type scale for both halves, the largest at which the rows fit** (X: the map keeps at
  least 40% of the half's height; story: the words fit the half), every row as tall as the taller
  half's, and the county names alone may shrink further so no word of either is wider than its
  column; nothing below the footer's small text — cost if wrong: `X_MAP_MIN`, `SCALES`.
- **Ruling: the headline goes on one line when it fits at 80% of the size or more, else on two
  broken before " and "**, both lines at the largest size that fits; never cut — cost if wrong:
  `ONE_LINE` in `versusLayout.ts`.
- **Ruling: the key is the legend's rows for that county and seat (own colours by count, ties by
  abbreviation, "Other parties" last), then "No approved holder yet N" in the no-data colour when a
  seat in the county has no holder with a party**; the bar's parts are the same entries in the same
  order (no folding of small parties, unlike the seat view's mix bar, so bar, key and legend agree
  entry for entry); a count is printed in a part only when it fits with padding — cost if wrong:
  `half` in `versusCard.ts`.
- **Ruling: a county seat whose holder has no party reads "No approved data yet"** on the leaders
  line, as a vacancy does (no name is shown, so a holder without a party would show nothing); no
  holder in the data lacks a party. It cannot be reached today: the server exports a holder with
  no party as IND, so the card shows "Independent". If it ever could be reached, "Party not
  recorded" would be the honest wording, not "No approved data yet" (there is a holder) — cost if
  wrong: one condition.
- **Ruling: the remembered pick is `km.versusWith` in `localStorage` (the code), read and written
  with try/catch in `versusCard.ts`**; the page passes it as the starting value through
  `versusCard(...)`, and the dialog calls `remember` — cost if wrong: one key.
- **Ruling: map slots are `a` (lower code) and `b`; the spec is the county in focus on that seat,
  nothing highlighted, `outline: false`, the seat's usual ward lines** — cost if wrong: none.
- **Ruling: the X caption gives the headline, both counties' counts in card order, the source (two
  sites, else one), the link and the tags, naming fewer parties per county ("and 3 more") until it is
  within 280; Instagram adds the scope, each county's seat count and its three county seats'
  parties** — cost if wrong: strings in `versusCaption`.
- **Ruling: dialog copy "Share side by side" / "Two counties’ MCA seats on one card, each with its
  map, sized for X or stories."; label "Side by side"; the choice "Compare with"** — cost if wrong:
  strings.
- **Ruling: "Side by side" is added after the cards the page offered there before**, so a county on
  MP or MCA lists "This view|County leaders|Side by side" (Carousel comes after it in Task H) —
  cost if wrong: one `concat` in `Map.vue`.

## Task H1: a card can be a series

A `cards` entry may carry `slides` (`seriesCard(key, label, slides)` in `lib/export/shareView.ts`):

```ts
{ key: 'carousel', label: 'Carousel', view: slides[0], slides: [cover, leaders, mpView, mcaView] }
```

While it is picked the dialog shows a "Slide" group under the "Card" choice: "Previous" and "Next"
buttons (accessible names "Previous slide", "Next slide", chevron icons from `@lucide/vue`, 44px,
marked `aria-disabled` at the ends, see the final review) with "2 of 4" between them. The preview is the current slide; the sizes on
offer are those every slide has, in the first slide's order (the stored-size rule unchanged); the
headline is the slide's own and fixed (the usual fixed-headline line); the caption and the dialog's
title and description are the first slide's. The map cache key is `<card>#<slide>|size|theme|slot|box`,
so slides with the same slot and box are kept apart, and stepping mid-draw never shows another
slide's map (the same token and `wanted` logic as the choice). Every slide gets `page` ("2 of 4"),
one of the uniform `CardProps`, which each card component declares and passes to `CardFooter`.

Saving: the dialog already shared one file with the Web Share API (`shareOrDownload`) where the
device can share files, and downloaded otherwise. For a series: "Download PNG" saves the current
slide as `<its own file name>-2-of-4.png`; "Download all 4" steps the preview through every slide,
showing "Drawing 2 of 4…", waits for each to be built, then saves the four files one after another
(250 ms apart), and ends with "Saved 4 images. If your browser saved only some, step to each slide
and use Download PNG." Where the device shares files, "Share all 4" (in place of "Share") makes the
four and shares them in one `navigator.share({ files })` call (`shareFiles` in `share.ts`); when the
browser refuses because the tap is too long ago (`NotAllowedError`, the images took a while), it
says "The 4 images are ready. Tap Share all 4 again to send them." and the second tap shares the
images it keeps; where the device cannot share four files, it saves them instead. Closing the
dialog stops a run; a slide that fails gives the usual error, stays on that slide, and saves
nothing. While a run is on, the card, size and colour choices and the stepper are disabled. Not
tried on a real phone: Chrome on Android asks once before it allows several downloads from a site,
and iOS Safari may keep only the first; the message covers both.

Tests: `ShareViewDialogSeries.test.ts` (mocked slides of two kinds; stepper, ends, keyboard, 44px,
no arrow characters; sizes intersection; page text on every slide and none outside; fixed headline;
cache separation; stepping mid-draw; caption; Download PNG name; Download all: four files in order,
"Drawing n of 4", back on the slide the person was on; stops on close; a failed slide; Share all in
one call; the real carousel's four names), `footerPage.test.ts` (the footer with and without page
text at every size, long links, the fallbacks, every card declaring `page`).

## Task H2: the county carousel

`lib/export/coverCard.ts`, `coverLayout.ts`, `components/export/CoverCard.vue`, the `cover` registry
entry, `coverCaption`, and `carouselCard` in `shareView.ts`. Slides: the cover, `leadersCardView` for
the county, `snapshotView` for the county on MP and on MCA. `Map.vue` adds `carouselCard(...)` last
for a county in focus on any seat view that offers "Share this view": Governor, Senator, Woman Rep
("This view|County leaders|Carousel"), MP and MCA ("This view|County leaders|Side by side|Carousel"),
and, since the final review, County seats ("County leaders|Carousel", opening on the leaders card). No
place reaches five entries: at 390px wide the four sit in two rows of two, each 175×44
(`carousel-dialog-phone.png`).

Checked: the cover's layout and component (`carousel.test.ts`), slides 2 to 4 equal to the views and
layouts made outside the series and drawn to the same markup once the page text is taken out, the
page tests (present on a county for the five seat views; absent for all of Kenya on every view, a
constituency, a ward, County seats on a county; a party profile within a county still offers its
party card alone, `partyPage.test.ts`), and the sweep (`carouselSweep.test.ts`): every county's cover
and every slide's footer with its page text, portrait and story, light and dark, a local and a long
site address; nothing cut or overlapping, the map as large as its room, story zones kept, the
footer no taller, and every slide's words starting at the same top and left. The sweep was shown to
fail (a note pushed into the footer is reported for every county).

Downloaded with "Download all 4" from the running app for Kakamega (37) and Nairobi City (47),
portrait light and dark and story light, and looked at beside mock-up 3. The cover follows the
mock-up line for line (kicker, two-line headline, one-line scope on portrait, the map, the note);
on the story the scope wraps to two lines. Fixed after looking: the page text sat far from the link
(its place was computed from an estimate of the link's width); it is now drawn in the link's own
text element. On the story, the leaders slide (long link) and Nairobi City's MCA slide had no
brand: fixed in the final review (one link per series). The older PNGs (`/?seat=mca`, `/county/47?seat=county_seats`, `/party/uda`
square, `/county/37?seat=mca` portrait) are byte-identical before the first change and after the
last.

## Rulings for Task H

- **Ruling: a series entry also carries `view` (its first slide)** — the page's `ShareCard[]` and
  the dialog's `view` prop keep one type, and the dialog opens a series on its cover — cost if
  wrong: one field.
- ~~**Ruling: the page text is muted, regular weight, at the link's size, on the link's line; the
  link keeps its size: after the brand where the three fit; else right after the link, which starts
  the line …; only where even that is too narrow does the link shrink (the page text then stands
  apart at the start)**~~ **Superseded** by "a series has one link" (final review): each slide kept
  its own link, so the footers of one series differed slide to slide (the brand dropped and the link
  jumping to the left on Nairobi City's story slides 2 and 4; with
  `https://kenya-electoral-map.example.org` slides 3 and 4 lost the brand on portrait in all 47
  counties though the same cards keep it outside the series; the link's size could differ too). Its
  claim "With the real links, portrait always fits all three" was wrong: it held for
  `localhost:8080` only, not for a production-length host.
- **Ruling: a series has one link, and its footer is the same on every slide** (final review). The
  dialog gives every slide of any series the series' link, its first slide's (the carousel's
  `/county/<code>`), in place of its own, and the widest page text of the series (`widestPlace`,
  "4 of 4", the later one on a tie) as `pageWidest`, one of the uniform card props. `footerBlock`
  then puts the page text (muted, regular, at the link's size) just before the link, which is
  right-aligned at the footer's right edge on every slide; the brand at the left when brand, page
  text and link fit, measured with `pageWidest`, so it is on every slide or on none; else no brand
  and the two stay right-aligned; only where page text and link alone do not fit does the link
  shrink (to its floor, then without its query), alike on every slide. The cover's link is the
  shortest of the four, so a slide has at least the room the stand-alone MP or MCA card has: tested
  over 47 counties, portrait and story, `http://localhost:8080`,
  `https://kenya-electoral-map.example.org` and a 45-character host (`seriesFooter.test.ts`): within
  a series every slide shows the brand alike, the link at one size, page text and link at the same
  x; with the first two hosts the brand is kept wherever the stand-alone seat-view card keeps it. A
  card outside a series is unchanged (own link, own footer path; the older PNGs byte-identical). The
  caption still uses the first slide's link — cost if wrong: a slide's footer names the county page,
  not its own seat view (`?seat=mp`), so a reader who types the link from slide 3 lands on the
  county's default view; the caption already said the same link.
- **Ruling: the page text is drawn in the link's text element (a `tspan` with `dx`), just before the
  link** — the layout's estimate of the link's width is wider than the drawn link, so a separate
  element left a gap of about 60px; the cards outside a series have no extra node. With the link
  always right-aligned, the "after the link" and "apart" placements are gone — cost if wrong: markup
  only. (The page text's left edge moves by 1–2px between "1 of 4" and the others, the "1" being
  narrower; its right end and the link do not move.)
- **Ruling: the series' sizes are the intersection, in the first slide's order** (portrait, story
  for the carousel) — cost if wrong: none.
- **Ruling: "Download PNG" in a series names the file with its place too** (`…-2-of-4.png`), like
  "Download all" — cost if wrong: one string.
- **Ruling: "Download all" renders every slide first and saves only when all four were made**, so a
  failure saves nothing and claims nothing — cost if wrong: on a failure the person has no partial
  set (they can still step and download each).
- **Ruling: the dialog copy for a series is the first slide's: "Share the county carousel" / "Four
  slides on who holds Kakamega’s 75 elected seats, sized for Instagram or stories."; label
  "Carousel"** — cost if wrong: strings.
- **Ruling: the cover's sources are the county's MCA holders alone** — the map is the only thing on
  it that a holder decides; the scope line counts seats from the unit index (IEBC codes, credited in
  the attribution's "Codes" line) and names no holder, so the three county seats' and the MPs'
  sources belong on slides 2 to 4, which show them — cost if wrong: two more source lists.
- **Ruling: slides 3 and 4 have nothing highlighted, and the person's map settings (surroundings,
  MP outlines)**, as "This view" has them with no party picked — the carousel is about the whole
  county, so a highlight on screen does not carry into it — cost if wrong: two arguments.
- **Ruling: the cover's strip has no deeper lid** (like the leaders card); the seat slides keep
  theirs, as outside the series. Every slide's words start at the same top and left (tested) — cost
  if wrong: one argument.
- **Ruling: the cover's map is centred in the room left, with the note under it, the two together in
  the middle of that room**; on a wide county (Nairobi City on the story) that leaves room above and
  below — cost if wrong: one offset.
- **Ruling: the cover's headline is fixed and the cover is never offered alone** — cost if wrong:
  none.
- **Ruling: the cover's file name is `kenya-electoral-map-county-<code>-cover-<size>.png`**; the
  slides keep their own kinds' names — cost if wrong: one string.
- **Ruling: the carousel's caption (the cover's) is the headline, the scope line, the county's MCAs
  by party ("MCAs by party: ODM 27, ANC 11, …"), the source, the link and the tags; X gets the shared
  `xCaption`** — cost if wrong: strings.
- **Ruling (review of G): a "Side by side" scale fits only when the widest key entry and the widest
  county-seat item fit the words' column** — cost if wrong: smaller type on the story for a county
  with a vacant Woman Rep. With a vacant Woman Rep, and with none of the three county seats held,
  every pair of counties (1,081 × 2 seats × 2 sizes) lays out clean (run once, not committed; the
  committed sweep has both cases).

## The final review of the branch, and its fixes

The final review found no wrong data. Fixed in `081ab8a`, each test first and seen to fail for the
right reason unless said:

1. **One link per series** (the ruling above). Tests: `footerPage.test.ts` (rewritten for the new
   rule: right-aligned link, brand dropped not moved, the widest page text deciding for every slide,
   the shrink alike on every slide), `seriesFooter.test.ts` (the 47-county sweep), a dialog test that
   every slide's preview shows `<n> of 4` + the first slide's link at one x and size, and one that a
   card outside a series keeps its own link. Downloaded with "Download all 4": Nairobi City story and
   Kakamega portrait, light; the four footers have the brand, the page text and the link at the same
   pixels (measured), apart from the "1" above.
2. **The carousel on County seats with a county in focus**: "Share this view" there offers
   "County leaders|Carousel", opening on the leaders card (`carouselOf` in `Map.vue`, shared with the
   seat views). "Share leaders" in the panel still offers the leaders card alone. Page tests updated.
3. **Keyboard focus**: "Previous slide", "Next slide" and "Download all N" use `aria-disabled` (with
   the disabled look through `aria-disabled:` classes) and a guard in their handlers, not
   `disabled`, so the focused button keeps the focus at the last slide and while the run is on; a
   further press does nothing. During "Download all" the slide's place ("2 of 4", `role="status"`)
   is `aria-live="off"`, so only "Drawing 2 of 4…" is read out. Tests: the stepper's attributes, focus
   after stepping to the last slide and a further press, focus on "Download all 4" during and after
   the run, a second press and the stepper doing nothing mid-run (progress never goes back to slide
   1), one live region speaking. In happy-dom a `disabled` button keeps `document.activeElement`, so
   the focus checks alone would not catch the attribute; the tests also check `disabled` is false.
   In Chromium: three Enter presses on "Next slide" end on "4 of 4" with the focus on "Next slide";
   the focus stays on "Download all 4" for the whole run.
4. **Small ones**: the cover keeps "Swipe for each." together (`COVER_SWIPE`; the rest wrapped, the
   sentence on the last line where it fits, else on its own), tested on Nairobi City's story and
   every county in both sizes; the series' buttons put the primary first (see the ruling); the unused
   `VERSUS_SEATS`, `VERSUS_SIZES` and `versusSpecOf` are removed; `npm run boundaries:rebuild` ends
   with `boundaries:neighbours` (`node boundaries/pipeline/neighbours.mjs`, run from the repo root:
   it rewrites `countyNeighbours.json` identically today), and `CLAUDE.md` says so.
5. **Missing tests** (the code was right; each test below was shown to fail under the mutation
   named): closing the dialog while the files are saved saves nothing more (the `saveEach` guard);
   closing and opening it again while the slides are drawn saves nothing (the guard after
   `settled()` in `makeAll`); a second "Download all" in the same size and colours reuses the
   images (reuse removed); after a change of size, or of colours, they are made again (the reuse key
   reduced to the card); a blocked share says "Tap Share all 4 again" and the second tap shares the
   same files without drawing again; an unavailable share saves the four files; the cover's source
   line names the MCA holders' sources only, with a fixture whose seats cite different sites (MP or
   governor sources added); a key entry that does not fit the words' column steps the "Side by side"
   type down (the key widths removed from `widest`). No real abbreviation is wide enough to bind
   there (the widest real key entry, "No approved holder yet 85", ends 70px inside the column at the
   largest story scale), so the case labels a party with the longest real party name, "National
   Ordinary People Empowerment Union".

- **Ruling: the carousel is offered on County seats for a county, after its leaders card, which the
  dialog opens on** — the plan says a county's "Share this view" offers the carousel on any seat view
  where it is offered; County seats has no "This view", so the leaders card stays first — cost if
  wrong: one list.
- **Ruling: in a series the primary action comes first; four buttons sit two by two, three put the
  primary across the row on a phone with the other two under it, and sit three across from md up** —
  without file sharing: "Download all 4", then "Download PNG" and "Copy caption"; with it: "Share all
  4", "Download PNG", "Download all 4", "Copy caption" (two rows of two). Looked at, at 390px wide: a
  3-across row does not fit ("Download all 4" needs about 130px of the 114 each would get), so the
  primary goes full width; no button sits alone otherwise. The order is the DOM order, so the tab
  order follows it — cost if wrong: one list (`seriesActions`).
- **Ruling: the stepper and "Download all" are marked `aria-disabled`, not disabled; "Download PNG"
  and "Share all" keep `disabled` while a run is on** — the focus is never on those during a run —
  cost if wrong: two attributes.
- **Ruling: the slide's place is silenced (`aria-live="off"`) while "Download all" runs**, rather
  than the progress line, which says more ("Drawing 2 of 4…") — cost if wrong: one attribute.
- **Ruling: the scope line keeps its last sentence whole ("Swipe for each.")**, on the last line where
  it fits, else on a line of its own (Nairobi City's story: "… 17 MPs and 85 MCAs." / "Swipe for
  each.") — cost if wrong: `COVER_SWIPE` in `coverLayout`.

Existing tests changed in the final review, and why: `footerPage.test.ts` (the old rule's "right
after the link" and "apart at the start" cases replaced by the new rule; the uniform-props check also
asks for `pageWidest`), `carousel.test.ts` ("slides 2 to 4 … apart from the page text" now gives the
slides the series' link as the dialog does and compares the cards apart from the footer's link line:
brand, page text and link), `ShareViewDialogSeries.test.ts` (the stepper's ends are `aria-disabled`,
not `disabled`; every mounted dialog is unmounted after its test, so a run of one test cannot reach
the next), `countySeatsPage.test.ts` (County seats on a county lists "County leaders|Carousel"; the
"no Carousel on County seats" expectation removed).

The older PNGs (`/?seat=mca`, `/county/47?seat=county_seats`, `/party/uda` square,
`/county/37?seat=mca` portrait) are byte-identical before the first change and after the last.

## Parked minor findings

- The card's own tests (`tilesCard.test.ts`, `tilesLayout.test.ts`) first failed on the missing
  modules, not against wrong code; the grid test and the page test failed for the right reason
  first (29 > 23; the card absent from the list).
- Task G2's code (`versusCard.ts`, `versusLayout.ts`, the component, the registry entry) was written
  before its tests; the tests were then written against the plan and the mock-up and passed on their
  first run, apart from two wrong expectations in the tests themselves. The checks were shown to
  fail: a half moved by 4px is reported as out of line (tested), and the sweep reported the cut
  "Elgeyo/Marakwet" before the name fix. The page test for the entry point failed first, as it
  should, and G1's dialog tests failed first on the missing select.
- Existing tests changed in G2: `countySeatsPage.test.ts`, "offers County leaders … whatever the seat
  mode" now covers the Governor view only (MP and MCA moved to the new "Side by side" test, which
  expects "This view|County leaders|Side by side"), and the top-10 test's county case on
  `?seat=mca&parties=ind` now expects "Side by side" too.
- On the story, Kakamega against Vihiga stays at scale 1 (Kakamega's key takes four lines in the
  narrower column), so its words are smaller than Mombasa against Nairobi City's.
- One existing test changed: `countySeatsPage.test.ts`, `?seat=governor&parties=uda` now lists
  "This view|County tiles|Five seats|By the numbers" (the plan adds the card there); its mocked
  dialog also reports the tiles card's seat.
- The story leaves about 80px empty between the grid and the footer (the grid is width-bound).
- With 40 or more parties that have colours of their own, the tiles key goes under the grid, the
  tile name size reaches its floor and long names leave their tiles; the data has 10 such parties,
  and up to 30 lay out clean. Not fixed.
- The tiles card's link is now also fed through `parseViewQuery` in a test (it opens that seat with
  nothing highlighted); it passed at once, as the link was already right.
- ~~The neighbour data is not rebuilt by `npm run boundaries:rebuild`~~: it is, since the final
  review (`boundaries:neighbours` ends the chain).

- Task H: the cover's tests and code were written in one go: `coverCard.test.ts` and
  `carousel.test.ts` were written first but not run before `coverCard.ts` and `coverLayout.ts`
  existed, so their first failure was not seen. H1's dialog and footer tests, the page tests and the
  review fixes' tests were seen to fail first for the right reason; the sweep and the bar-proportion
  test were checked against a deliberate fault.
- Existing tests changed in H: `countySeatsPage.test.ts` (five expectations gain "|Carousel"; the
  "County leaders … whatever the seat mode" test covers Governor, MP and MCA again), `versusSweep.test.ts`
  (the worst case vacates the Woman Rep, plus a case with no county seats held).
- ~~On the story the cover's scope line wraps ("… Swipe" / "for each.")~~: fixed in the final review.
- In a series on a phone the footer of the dialog has two rows of buttons, so the preview starts
  lower. ~~"Copy caption" sits alone on the second row~~: fixed (the primary is across the row).
- Parked after the final review:
  - "This view" on MP and carousel slide 3 draw the same map twice (separate cache keys).
  - `countyNeighbours.json` lives under `lib/export` though only tests import it.
  - "Download all" (several downloads) and "Share all 4" are untested on real phones (only with a
    mocked `navigator.share` and in desktop Chromium).
  - The seat slides keep their deeper strip lid, the cover and leaders slides do not.
  - The leaders card's editable headline shows the numbers hint ("Keep it to the numbers, …") though
    its headline has no numbers (seen in the County seats screenshot; older than this branch).

## What is next

The owner's review of the branch (the carousel above all), then a PR from `feature/share-formats-2`
into `develop`.
