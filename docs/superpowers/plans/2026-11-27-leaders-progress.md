# Leaders branch (`feature/leaders`): progress log

Tasks 5 and 6 of `2026-11-27-map-controls.md`, with the owner's additions of 2026-11-27. This file
is the running log: what is done (with commits), every ruling made on the way, parked minor
findings and what is next. A later session can resume from here.

**Rules for this branch:** push `feature/leaders` only. No merge into `develop` or `main`, no tag,
no release. The release is done afterwards from another session.

## Status

| Step | What | State | Commit |
|---|---|---|---|
| 5a | `leadersFor()` in `lib/leaders.ts`; the panel's "Who represents"; the legend's "Leaders here" strip | done | `65333b4` |
| 5a | The leaders strip on MCA cards (`lib/export/leadersStrip.ts`, `cardLeaders`) | done | see `git log` (`feat(export): leaders strip on MCA cards…`) |
| 5b | Bigger card maps on the "Share this view" cards | done | same commit |
| 5b | "Leaders of <unit>" and "County leaders in <county>" cards | not started | |
| 5c | Striped "County seats" chip, map mode and legend | not started | |
| 6 | MP outlines over MCA wards, badges, two-section legend, MP block on cards, MCA names on wards | not started | |

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
  wards"; Nairobi City lists 9 of 17 constituencies on square, 13 on portrait, 14 on story, 6 on
  X (it listed all 17 on portrait and story before). The dialog's hint says how many a size lists
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

## Parked minor findings

- The legend box exists only while a colouring is on, so with "None" chosen there is no "Leaders
  here" strip. The panel still lists the leaders.
- A fresh visitor who opens a ward or a constituency from Kenya with "None" chosen keeps "None"
  (`modeForFocus` only switches a mode that does not fit). The plan's "MCA is the default inside a
  constituency" holds only when the mode in use is a county seat.

## Parked minors from the roadmap fixed on the way

- **"The Mathare MP square leaves empty space around a small map"** (social export): fixed. The
  card map stopped zooming at 13, so a small urban constituency was drawn at about half its box.
  It may now zoom to 16 (`VIEW_MAP_MAX_ZOOM` in `lib/export/viewMap.ts`).
- **Legend height** (not on the list, found here): the open legend ran under the seat chips and
  the back button once the strip made it taller. It is now capped under them.

## What is next

- 5b's leaders cards, then 5c and Task 6, in that order.
- Bigger maps on the party card and the "Share image" card (see the ruling).
