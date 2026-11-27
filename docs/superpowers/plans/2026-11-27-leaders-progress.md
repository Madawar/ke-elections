# Leaders branch (`feature/leaders`): progress log

Tasks 5 and 6 of `2026-11-27-map-controls.md`, with the owner's additions of 2026-11-27. This file
is the running log: what is done (with commits), every ruling made on the way, parked minor
findings and what is next. A later session can resume from here.

**Rules for this branch:** push `feature/leaders` only. No merge into `develop` or `main`, no tag,
no release. The release is done afterwards from another session.

## Status

| Step | What | State | Commit |
|---|---|---|---|
| 5a | `leadersFor()` in `lib/leaders.ts`; the panel's "Who represents"; the legend's "Leaders here" strip | done | see `git log` (`feat(leaders): who represents a unit…`) |
| 5a | The leaders strip on MCA cards | in progress | |
| 5b | Bigger card maps; "Leaders of <unit>" and "County leaders in <county>" cards | not started | |
| 5c | Striped "County seats" chip, map mode and legend | not started | |
| 6 | MP outlines over MCA wards, badges, two-section legend, MP block on cards, MCA names on wards | not started | |

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

## Parked minor findings

- The legend box exists only while a colouring is on, so with "None" chosen there is no "Leaders
  here" strip. The panel still lists the leaders.
- A fresh visitor who opens a ward or a constituency from Kenya with "None" chosen keeps "None"
  (`modeForFocus` only switches a mode that does not fit). The plan's "MCA is the default inside a
  constituency" holds only when the mode in use is a county seat.

## Parked minors from the roadmap fixed on the way

- None yet.

## What is next

- Finish 5a's card strip, then 5b, 5c and Task 6, in that order.
