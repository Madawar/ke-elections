# Share formats, first four: implementation plan

**Goal:** four new share cards, from the mock-ups the owner approved on 2026-11-27 ("I loved
all"), built on the card system that "Share this view", the party card and the leaders cards
already use.

| Mock-up | Card | Sizes | Map images |
|---|---|---|---|
| 6 | By the numbers | Square, story | none |
| 8 | Top 10 counties for a group | Square, story | 1 |
| 5 | Kenya, five ways | Square, story | 5 |
| 1 | Who represents this ward | Portrait, story | 3 |

Mock-ups (light, one size each): https://claude.ai/artifact/MGTqRFYdds6L2ZTqriusnj. In a cloud
session they are copied to the scratchpad `mockups/` folder as `f8-numbers-square-light.png`,
`f6-top10-square-light.png`, `f2-five-square-light.png` and `f1-ballot-portrait-light.png`. The
file names carry the mock-up author's own numbering, not the ranking above.

**Branch:** `feature/share-formats`, from `develop` at v0.3.0. Push the branch only: no merge, no
tag, no PR unless the owner asks.

**Progress log:** `2026-11-27-share-formats-progress.md`, in the same form as
`2026-11-27-leaders-progress.md`: status with commits, every ruling as "Ruling: what — why — cost
if wrong", parked minors, what is next.

## Global constraints

- `CLAUDE.md` rules are not negotiable:
  - Join on IEBC codes, never on names.
  - Never invent office holders. Test fixtures use placeholder names
    (`tests/js/leadersFixtures.ts`, `tests/js/export/viewFixtures.ts`, `mixFixtures.ts`).
  - Every number shows its source and "as of" date.
  - No AI look: no gradients, glows or emoji, no ALL-CAPS eyebrows, no "A · B · C" strings, no "→".
  - Ballot colours for seats, Archivo type.
- **Neutrality rules from the mock-ups:**
  - Order by seat, count, date or code. Break ties by code (parties: by abbreviation), and say so
    on the card where a tie decides who is listed.
  - The group in the top-10 card is always the user's pick, and its headline is a fixed template.
  - Seat colours are for edges and strips only, never for a fill that could be read as a party.
- **Reuse, do not duplicate:**
  - Counts: `seatLegend`, `buildLegend`, `legendScope`, `seatSources` (`lib/seats.ts`,
    `lib/legend.ts`). A card's numbers must equal the legend's for the same seat and scope.
  - People: `leadersFor` (`lib/leaders.ts`).
  - Card frame: `cardFrame`, `titleBlock`, `strip`, `box`, `SPECS` (`lib/export/viewLayout.ts`),
    `footerBlock` and `CardFooter.vue`, `SampleWatermark.vue`, `text.ts` (`textWidth`,
    `wrapText`, `fitFontSize`).
  - Maps: `renderViewMap`, `viewStyle`, `viewColouring` (`lib/export/viewMap.ts`).
  - Sources: `sourceLine`, `sourceParts`, `formatAsOf` (`lib/export/format.ts`).
- **Layout is data:** every box and every line of text is placed by a layout function in
  `lib/export/`, and the card component only draws what it returns. Layout tests check that
  nothing overlaps, nothing leaves the card, no text is cut (no "…" in a name or a number), and
  that story cards keep text out of the bottom 400px and the right 120px.
- **Names are never cut.** Shrink a little, then wrap.
- **No new buttons on the map.** The cards are reached through the share dialog's "Card" choice
  and the existing share buttons (see "Where each card is reached").
- **No new routes.** Each card's link is an existing deep link (see each task).
- TDD: write the failing test, see it fail, make it pass. After each task: `php artisan test`,
  `npm run test:js`, `npm run types:check`, `npm run build`.

## Task A: the card system takes more kinds of card

Today `lib/export/shareView.ts` switches on `isPartyCard` / `isLeadersCard`, the dialog renders one
map image per card, every card has all four sizes, and the "Card" choice is two fixed options.

**Requirements:**
- **One registry of card kinds** in `lib/export/shareView.ts` (or a new `cards.ts` it re-exports
  from). For each `kind`: its headline, caption, layout, dialog copy, the same card in another
  theme, its file name, the sizes it comes in, whether its headline can be edited, and the map
  images it needs. The existing kinds (`party` = seat view, `partyCard`, `leaders`) move into it
  with no change in behaviour; the exported helpers the dialog and tests use keep working.
- **Sizes per card:** `sizesOf(view)`. The dialog lists only those. The person's stored size
  (`km.viewSize`) is used when the card has it; otherwise the first of the card's sizes is shown,
  and the stored choice is not overwritten.
- **Any number of map images:** a layout names its maps as slots, `{ key, box, spec }`, where
  `spec` is what `renderViewMap` takes. One-map cards have the one slot `map`. The dialog draws
  the slots one at a time (as it queues maps today), caches each by card, size, theme and box,
  and hands the card `mapImages` (by key) as well as `mapImage` (the `map` slot). No PNG is made
  until every slot is drawn; a failed slot is the same error as a failed map today.
- **A map spec can carry its own colouring:** `ViewMapSpec.colouring?: Colouring`, used as it is
  instead of the seat colouring (for locators and the top-10 map).
- **The "Card" choice is a list:** the dialog takes `cards: { key, label, view }[]` (the first is
  the card it opens on) in place of `leaders`. `Map.vue` builds the list (see below). One card:
  no choice shown. Switching card resets the headline at once (as today) and keeps each card's
  maps apart in the cache.
- **A headline that cannot be edited:** for such a card the dialog shows the headline as text with
  one line under it, "This card's headline is fixed, so it stays neutral.", and no input.
- **Tests:** the registry's helpers for the three existing kinds give what they gave before;
  sizes filter and the stored size rule; several slots are all drawn before the PNG, in order,
  and cached apart per card; a failed slot; the card list in the dialog; the fixed headline.

## Task B: "By the numbers" (mock-up 6)

No map, so it reads at thumbnail size. Square and story.

- **Headline:** "1,881 elected seats below the President". The number is the sum of the seats:
  counties × 3, constituencies and wards from the unit index. Scope line: "Who holds them now,
  seat by seat".
- **Five rows,** in ballot order (Governor, Senator, Woman Rep, MP, MCA). Each row:
  - The seat's ballot colour as a bar at the left edge.
  - The number of seats, large, right-aligned in its column (47, 47, 47, 290, 1,450).
  - The seat's plural name, bold: "Governors", "Senators", "Woman Reps", "MPs", "MCAs".
  - "Most held:" then the three groups holding the most, each a chip and "UDA 20". From
    `seatLegend`; ties by abbreviation. Independents read "Independent".
  - A thin mix bar across the row: the legend's rows in the legend's order (`buildLegend`: own
    colour by count, "Other parties" last), with a gap between parts. Seats with no approved
    holder are a last part in the no-data colour.
- **Note under the rows:** "The President is elected on a sixth ballot." Then, when the data has
  them, "Parliament also has N nominated MPs and senators in office." (N = holders with seat
  `nominated_mp` or `nominated_senator`.) Then, when any seat has no approved holder, "N seats
  have no approved holder yet."
- **Footer:** the usual one: source (all five seats' holders), "Data as of", link. Link: `/`.
- **Files:** `lib/export/numbersCard.ts` (`numbersCardView({ seats, index, theme })`,
  `numbersHeadline`), `lib/export/numbersLayout.ts`, `components/export/NumbersCard.vue`, tests.
- **Tests:** the counts and "most held" equal `seatLegend` for each seat; the total; ties; a
  vacancy; the nominated sentence present and absent; layout in both sizes (no overlap, on the
  card, nothing cut, story safe zones); the component; the caption (Instagram lists the five
  rows; X stays within 280).

## Task C: "Top 10 counties for a group" (mock-up 8)

A ranked bar chart for the party or group the user picked. Square and story.

- **Input:** a seat, MP or MCA (a county has one Governor, Senator and Woman Rep, so those have
  no ranking), and one group: a party abbreviation or `IND`.
- **Headline, a fixed template that the user cannot edit:**
  - "Where independents hold the most MCA seats" for `IND`.
  - "Where <ABBREV> holds the most MCA seats" for a party ("MP seats" for MPs).
- **Scope line:** "114 of 1,450 MCAs nationally are independents. The 10 counties with the most:"
  (a party: "523 of 1,450 MCAs nationally are UDA. …"). With fewer than ten counties: "The N
  counties with any:".
- **Rows:** rank, county name (bold), a bar in the group's data colour on one scale from zero,
  the count (bold), "of 40 wards" ("of 6 constituencies" for MPs). Most first; ties by IEBC
  county code. Counties with none are left out. Counted per county with `legendScope` and
  `seatLegend`, as `topCounties` in `lib/party.ts` does today: generalise that function (seat,
  group, how many) and have the party profile use the general one.
- **Note under the rows** when the tenth place is tied with counties left out: "One more county
  also has 4." or "3 more counties also have 4." Then, whenever a tie decided an order or a cut:
  "Ties are listed by IEBC county code."
- **A small map of Kenya** beside the rows (under them on a story) with the listed counties
  filled in the group's colour and the rest in the no-data colour, captioned "The 10 counties
  shaded" (the real number).
- **Footer:** the usual one. Link: `/?seat=mca&parties=ind` (the existing deep link, which opens
  the national map with that group highlighted).
- **Files:** `lib/export/topCountiesCard.ts`, `topCountiesLayout.ts`,
  `components/export/TopCountiesCard.vue`, tests.
- **Tests:** ranking, ties by code, the cut-off note (none, one more, several more), fewer than
  ten, no county at all (the card says so and lists nothing: nothing is invented), the counts
  equal the legend's per county, the headline template for a party and for independents, the
  headline is not editable, layout and component as in Task B, the map's colouring (listed codes
  in the group colour, by code), the link.

## Task D: "Kenya, five ways" (mock-up 5)

The same map five times, once per elected seat, with one shared key. Square and story.

- **Headline:** "Kenya's five elected seats, by party". Scope line: "Who holds each seat now,
  from 47 counties to 1,450 wards" (the numbers from the unit index).
- **Six cells:** five maps and the key. Square: three across, two down. Story: two across, three
  down. Each map cell: a rule in the seat's ballot colour across its top, "Governors" bold and
  "47 seats" beside it, then the map of Kenya coloured by that seat (`renderViewMap` with that
  seat, nothing focused, nothing highlighted).
- **The key cell:** a grey rule, "Party colours", then every party that has a colour of its own
  on any of the five maps, plus "Independent" in its place by count and "Other parties" last.
  Order: seats held across all five, most first; ties by abbreviation. Two columns. Under it:
  "Parties in order of seats held across all five".
- **Footer:** the usual one (source: all five seats' holders). Link: `/`.
- **Files:** `lib/export/fiveSeatsCard.ts`, `fiveSeatsLayout.ts`,
  `components/export/FiveSeatsCard.vue`, tests.
- **Tests:** the key's order and members (every colour on any map is named; nothing named that is
  on no map); the five slots, their seats and order; layout in both sizes; the component draws
  five images from `mapImages`; the caption.

## Task E: "Who represents this ward" (mock-up 1)

Five "ballot papers" for one ward. Portrait and story. It replaces the ward's "Leaders of <ward>"
card (a county and a constituency keep theirs).

- **Headline:** "Who represents <ward> ward". Scope line: "<ward> ward is in <constituency>
  constituency, <county> County" (the longest wording that fits, as the leaders card does).
- **Three papers,** each a white (surface) panel with a hairline border:
  1. The county's three seats, Governor, Senator, Woman Rep, one under another with a hairline
     between them, and one small map of the county with the ward marked.
  2. The MP, with a small map of the county with the constituency filled.
  3. The MCA, with a small map of the constituency with the ward filled.
- **Each seat on a paper:** the ballot colour as the paper's left edge for that seat; the seat
  (bold) and the place ("Kakamega County", "Shinyalu constituency", "Isukha West ward"); the
  name, large and bold, exactly as the data spells it; the party's chip, "ODM, Orange Democratic
  Movement" ("Independent" alone for an independent); "Elected in August 2022" ("By-election in
  November 2025", "Succeeded in …", from `basis` and `started_on`).
- **Order:** Governor, Senator, Woman Rep, MP, MCA: ballot order, as the strip at the top of
  every card. The rows are `leadersFor(ward)`, regrouped by the level each seat is held at.
- **A seat with no approved holder** keeps its place and reads "No approved data yet".
- **Locator maps:** the marked ward or constituency is filled in the ink colour and the rest in
  the no-data colour, with the unit's outline. Not the seat's ballot colour (the mock-up used
  green and beige; a green fill beside a party chip reads as a party).
- **Footer:** the usual one (source: the five rows' sources). Link: `/ward/<code>`.
- **Files:** `lib/export/ballotsCard.ts`, `ballotsLayout.ts`,
  `components/export/BallotsCard.vue`, tests.
- **Tests:** the five seats in ballot order whatever the data's order; the three slots and what
  each shows (codes, not names); vacancy rows; names verbatim and never cut (long names, long
  party names, in both sizes); layout and component as in Task B; the caption; the link.

## Where each card is reached

- **All of Kenya, any seat view** ("Share this view" in the legend or the panel): the "Card"
  choice lists "This view", "Five seats", "By the numbers", and "Top 10 counties" when the seat
  is MP or MCA and the highlight is exactly one party or the independents.
- **A party's profile** ("Share" there, all of Kenya): "Party card" and "Top 10 counties" (MCA
  seats), when the party holds any.
- **A county or a constituency:** as in v0.3.0 ("This view" and its leaders card).
- **A ward:** "Share leaders" in the panel opens "Who represents this ward"; "Share this view"
  lists "This view" and "Who represents".

## Review focus

1. A card's numbers equal the legend's and the panel's for the same seat and scope, from the same
   functions.
2. Nothing a user can pick makes a card that reads as partisan: fixed order rules, the fixed
   top-10 headline, ties said on the card.
3. No holder is ever shown that the data does not have; a missing one is said.
4. Every card has its source, its "as of" date and a link that opens what the card shows.
5. Existing cards are unchanged by Task A (compare a seat view, a party card and a leaders card
   before and after).
6. Text is never cut, and story cards keep their safe zones.

## Visual check

Playwright with the Chromium already in the cloud environment (do not install another). Build
first (`npm run build`), run `php artisan serve`, and download each card from the share dialog in
each of its sizes, light and dark. Look at every image beside its mock-up. Places: all of Kenya
(numbers, five seats, top 10 for independents on MCA seats and for a party on MP seats), and the
wards Isukha West (1046, the mock-up's) and Ngei (1448). Do not commit screenshots.
