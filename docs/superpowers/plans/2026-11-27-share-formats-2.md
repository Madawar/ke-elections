# Share formats, the next three: implementation plan

**Goal:** three more share cards from the mock-ups the owner approved on 2026-11-27, on the card
registry that v0.4.0 added (`lib/export/shareView.ts`: one entry per kind of card).

| Mock-up | Card | Sizes | Map images |
|---|---|---|---|
| 4 | Every county the same size (county tiles) | Portrait, story | none |
| 7 | Side by side (two counties) | X, story | 2 |
| 3 | Swipe through a county (carousel, slides 1 to 4) | Portrait, story | 1 on the cover |

Mock-ups (light, one size each): https://claude.ai/artifact/MGTqRFYdds6L2ZTqriusnj. In a cloud
session they are copied to the scratchpad `mockups/` folder as `f3-tiles-portrait-light.png`,
`f7-versus-x-light.png` and `f4-carousel-1-portrait-light.png` (the file names carry the mock-up
author's own numbering).

**Branch:** `feature/share-formats-2`, from `develop` at v0.4.0. Push the branch only: no merge,
no tag, no PR unless the owner asks.

**Progress log:** `2026-11-27-share-formats-2-progress.md`, in the form of
`2026-11-27-share-formats-progress.md`: status with commits, every ruling as "Ruling: what — why —
cost if wrong", parked minors, what is next.

## Global constraints

Everything under "Global constraints" in `2026-11-27-share-formats.md` applies unchanged: the
`CLAUDE.md` rules, the neutrality rules, reuse of the counting, people, frame, map and source
functions, layout as data, names never cut, no new buttons on the map, no new routes, TDD and the
four checks after each task. In addition, from what v0.4.0 taught:

- **A new card is one registry entry** (component, sizes, map slots, headline rule, caption,
  copy, file name). If a card needs the dialog to change, the change is a general ability of the
  dialog that the registry describes, never a branch on the card's kind.
- **A card credits only what it draws:** `CODES_CREDIT` alone for a card with no map
  (`lib/map/theme.ts`), the full attribution for a card with one.
- **Fixtures are short; the real data is not.** Each card gets a committed sweep over the real
  unit index (`ballotsSweep.test.ts` is the model): every unit the card can be made for, each of
  its sizes, placeholder holders with worst-case name lengths and the longest real party name;
  nothing cut, nothing overlapping, nothing past the footer, story safe zones kept (bottom 400,
  right 120).
- **The older cards do not change.** The square PNGs of `/?seat=mca` ("This view"),
  `/county/47?seat=county_seats` (leaders), `/party/uda` (party card), and the numbers, five-seats
  and top-10 cards are byte-identical before and after each task, except where a task says a card
  changes.

## Task F: county tiles (mock-up 4)

47 equal tiles, one per county, laid out roughly like the map, coloured by the party of the
county's Governor, Senator or Woman Rep. Portrait and story. No map image: the tiles are drawn.

- **Seats:** Governor, Senator, Woman Rep (one holder per county). Not MP or MCA.
- **Headline, editable:** "Governors by party" ("Senators by party", "Woman Reps by party").
  Scope line: "Every county drawn the same size, so small ones count too".
- **The tile grid is data, keyed by IEBC county code:** `lib/export/countyTiles.ts`, a table of
  code to column and row. Start from the mock-up's arrangement (eight columns, nine rows):

  | Row | Columns 0 to 7 |
  |---|---|
  | 0 | –, –, Turkana, –, Marsabit, –, –, Mandera |
  | 1 | –, Trans Nzoia, West Pokot, Elgeyo/Marakwet, Samburu, –, Wajir, – |
  | 2 | Bungoma, Kakamega, Uasin Gishu, Baringo, Laikipia, Isiolo, –, – |
  | 3 | Busia, Vihiga, Nandi, Nyandarua, Nyeri, Meru, –, – |
  | 4 | Siaya, Kisumu, Kericho, Nakuru, Kirinyaga, Tharaka-Nithi, –, Garissa |
  | 5 | Homa Bay, Nyamira, Bomet, Kiambu, Murang'a, Embu, –, – |
  | 6 | Migori, Kisii, Narok, Nairobi City, Machakos, Kitui, Tana River, Lamu |
  | 7 | –, –, –, Kajiado, Makueni, Taita Taveta, Kilifi, – |
  | 8 | –, –, –, –, –, Kwale, Mombasa, – |

  The table is written with codes; the names above are for the reader.
- **The check by hand, made repeatable:** compute which counties really share a border from the
  committed county boundaries (`public/boundaries/`), and for a grid list every pair of
  neighbours whose tiles are more than one cell apart (in any direction, diagonals count as
  one). Report the list for the mock-up's grid, then improve the grid by moving tiles where
  that removes pairs without breaking the overall shape (north at the top, the lake counties on
  the left, the coast at the bottom right, Nairobi near the middle). Known weak spots to look
  at: Nakuru sits under Nyandarua though it borders Baringo; Narok is far from Nakuru and
  Bomet. Record the final list of pairs still apart in the progress log, and commit a test that
  the grid has all 47 codes once, no shared cell, and no more separated pairs than the recorded
  number. The script that computes neighbours can live under `boundaries/pipeline/` or in the
  test; the neighbour list itself may be committed as data keyed by code.
- **A tile:** the party's colour (the theme's, as the legend gives it), the county's name in the
  top-left, bold, in whichever of the card's ink and white reads better on that fill (compute
  the contrast, do not list parties), wrapped, never cut and never abbreviated. A county with no
  approved holder is the no-data colour.
- **Key:** the legend's rows for that seat across Kenya (`buildLegend`), counts beside each,
  in two columns, placed in the grid's empty bottom-left corner as in the mock-up when it fits
  there and under the grid otherwise. "No approved holder yet N" only when N is above zero.
- **Highlights are ignored:** the card always shows every party, whatever is highlighted on
  screen.
- **Footer:** `CODES_CREDIT` only. Source: that seat's holders. Link: `/?seat=governor` (the
  existing deep link; the mock-up's `view=tiles` does not exist).
- **Where:** all of Kenya on the Governor, Senator or Woman Rep view: the "Card" choice lists
  "This view", "County tiles", "Five seats", "By the numbers".
- **Files:** `lib/export/countyTiles.ts`, `tilesCard.ts`, `tilesLayout.ts`,
  `components/export/TilesCard.vue`, tests.
- **Tests:** the grid test above; each tile's colour equals the map's fill for that county and
  seat, by code, in both themes; the key equals the legend; a vacancy; text contrast on a light
  and a dark fill; layout and component as the other cards; the sweep (three seats, both sizes);
  the caption; the link; the entry point, and that it is absent on MP, MCA, County seats and with
  a unit focused.

## Task G: a card can ask one question, and "Side by side" (mock-up 7)

### G1: the dialog's general ability

A card in the dialog's list may carry one choice of its own, described as data:

```ts
{ key, label, view, choice?: { label: string; options: { value: string; label: string }[];
                                value: string; make(value: string): ShareableView } }
```

The dialog shows a labelled native `<select>` under the "Card" choice while that card is
picked, and replaces the card's view with `make(value)` when it changes (maps redraw, the
headline resets). The dialog knows nothing about what the choice means. Tests with a mocked
card: the select appears only for a card that has a choice, changing it rebuilds the preview
with the new view, the cache keeps the two views' maps apart, and keyboard and label work.

### G2: "Side by side"

Two counties on the same seat. X (1600 × 900) and story.

- **Seats:** MP or MCA.
- **Which two:** the county in focus and one the user picks with "Compare with" (the choice
  above): every other county, listed by name in alphabetical order. The pick is remembered per
  viewer (`localStorage`, wrapped in try/catch). With nothing remembered, the default is the
  county with the next IEBC code (after 47 comes 1).
- **Order on the card:** by IEBC county code, lower first, whichever one was in focus.
- **Headline, a fixed template:** "MCA seats: Mombasa and Nairobi City" ("MP seats: …"). Scope
  line: "Maps are not to the same scale." (The mock-up's "Kenya's two largest cities." is an
  editorial line and is not generated.)
- **Each half:** the county's name; "85 wards in 17 constituencies" ("17 constituencies" for
  MPs), from the unit index; the mix bar for that seat in that county with the count inside each
  part wide enough to hold it; the key, most seats first, ties by abbreviation, as the legend;
  the county's map coloured by that seat (`renderViewMap`, county in focus, nothing highlighted,
  no MP outlines); and a line for the three county seats, "Governor", "Senator", "Woman Rep",
  each with its ballot-colour tick and the holder's party chip and abbreviation ("No approved
  data yet" for a vacancy), from `leadersFor(county)`. No names on this card.
- **The two halves line up:** names, bars, keys, maps and leaders lines start at the same
  heights; the two map boxes are the same size. On the story the second county is under the
  first.
- **Footer:** the full attribution. Sources: both counties' holders of that seat and of the
  three county seats. Link: `/?seat=mca` (the national map on that seat; there is no route for a
  comparison, and none is added).
- **Where:** a county in focus on the MP or MCA view: the "Card" choice adds "Side by side".
- **Files:** `lib/export/versusCard.ts`, `versusLayout.ts`, `components/export/VersusCard.vue`,
  tests.
- **Tests:** order by code whichever is in focus; the default pick and the remembered pick;
  each half's counts equal the legend's for that county; the two slots and their specs by code;
  alignment of the halves; a county whose name is long ("Elgeyo/Marakwet", "Tharaka - Nithi");
  the sweep (every county against its default pick and against the longest-named county, both
  seats, both sizes); the caption; the link; the entry point and where it is absent.

## Task H: a card can be a series, and the county carousel (mock-up 3)

### H1: the dialog's general ability

A card in the dialog's list may be a series: `{ key, label, slides: ShareableView[] }`, each
slide a view of any registered kind.

- A "Slide" stepper (previous, next, "2 of 4", with 44px targets) steps through the slides;
  the preview shows the current one.
- The sizes on offer are those every slide has.
- Every slide's footer shows "2 of 4" beside the link (`CardFooter` gets an optional `page`
  text; the registry passes it through the uniform props; cards outside a series are unchanged).
- Headlines are the slides' defaults and are not editable in a series; the dialog says so with
  the fixed-headline line.
- "Download PNG" saves the current slide; "Download all 4" renders and saves each in turn,
  named `…-1-of-4.png`. If the dialog already shares files with the Web Share API, a series
  shares all its files in one call.
- The caption is the first slide's.

### H2: the county carousel

Four portrait (or story) slides for one county:

1. **Cover (new kind):** the county's name small above the headline as plain text (not caps);
   headline "Who holds Kakamega's 75 elected seats" (the number is 3 + its constituencies + its
   wards, from the unit index); scope "1 governor, 1 senator, 1 woman rep, 12 MPs and 60 MCAs.
   Swipe for each."; the county's ward map coloured by the MCA's party; under it "Wards
   coloured by the MCA's party". The cover has no key: slide 4 carries it.
2. **County seats:** the existing "County leaders in <county>" card, as it is.
3. **MPs:** the existing "This view" card for the county on the MP seat, as it is.
4. **MCAs:** the existing "This view" card for the county on the MCA seat, as it is.

Slide 5 (what changed, and sources) waits for the by-election history work.

- **Where:** a county in focus, from "Share this view" on any seat view: the "Card" choice adds
  "Carousel".
- **Link on the cover:** `/county/<code>`.
- **Files:** `lib/export/coverCard.ts`, `coverLayout.ts`, `components/export/CoverCard.vue`,
  tests.
- **Tests:** the cover's numbers from the index; the four slides, their kinds and order; the
  page text on each; sizes; "Download all" makes four files with the right names; the sweep
  (every county's cover, both sizes); slides 2 to 4 inside the series are byte-for-byte the
  cards they are outside it, apart from the page text.

## Where each card is reached, after this plan

- **All of Kenya, Governor, Senator or Woman Rep view:** "This view", "County tiles", "Five
  seats", "By the numbers".
- **All of Kenya, MP or MCA view:** as in v0.4.0.
- **A county, MP or MCA view:** "This view", its leaders card, "Side by side", "Carousel".
- **A county, any other seat view where "Share this view" is offered:** what v0.4.0 offers, plus
  "Carousel".
- **A constituency, a ward, a party profile:** as in v0.4.0.

If a list reaches five cards, the "Card" choice must still fit at 390px wide: check it, and log
what was done.

## Review focus

The six points of `2026-11-27-share-formats.md`, and:

7. The tile grid: every county once, by code, and the recorded neighbour pairs.
8. "Side by side" cannot be steered: fixed headline, order by code, the same parts in the same
   places for both counties.
9. The dialog's two new abilities are general: no branch on a card's kind.

## Visual check

As in the first plan. Places: all of Kenya on the Governor and the Woman Rep views (tiles);
Nairobi City (47) against Mombasa (1) and Kakamega (37) against its default pick on MCA, and one
pair on MP (side by side); Kakamega (37) and Nairobi City (47) (carousel, all four slides).
Each card in each of its sizes, light and dark, beside its mock-up. Do not commit screenshots.
