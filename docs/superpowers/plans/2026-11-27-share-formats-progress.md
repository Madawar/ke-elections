# Share formats branch (`feature/share-formats`): progress log

Tasks of `2026-11-27-share-formats.md`. This file is the running log: what is done (with commits),
every ruling made on the way, parked minor findings and what is next. A later session can resume
from here.

## Status

| Task | What | State | Commit |
|---|---|---|---|
| A | The card system takes more kinds of card: one registry, sizes per card, any number of map slots, a map spec's own colouring, the "Card" choice as a list, fixed headlines | done | see `git log` (`feat(export): one registry of card kinds…`) |
| B | "By the numbers" (mock-up 6), square and story, offered with nothing focused | not started | |
| C | "Top 10 counties for a group" (mock-up 8) | not started | |
| D | "Kenya, five ways" (mock-up 5) | not started | |
| E | "Who represents this ward" (mock-up 1) | not started | |

### Task A: what did not change

Before the refactor, the registry's helpers (headline, dialog copy, both captions, the layout in
all four sizes, the file name and the card in the other theme) were written out for a seat view
for all of Kenya, a seat view for Nairobi City, a party card and a county leaders card, and again
after it: the two dumps were identical byte for byte. The PNGs downloaded from the running app for
`/?seat=mca` ("This view", square), `/county/47?seat=county_seats` (leaders, square) and
`/party/uda` (party card, square) were also byte-identical before and after.

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

## Parked minor findings

- The dialog tests store the size as `JSON.stringify('square')`, which `useStorage` (a string
  default, stored raw) reads as unknown and replaces with the default, so those tests never
  exercised a stored size. The new size tests store it raw. Left as it was in the old tests.

## What is next

Task B: "By the numbers".
