# Phase 1 progress and handoff

This note lets any session, local or cloud, continue Phase 1 without the local execution
ledger. That ledger is `.superpowers/sdd/…/progress.md`, which is gitignored and exists only on
the owner's machine.

- Plan: `docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md`
- Spec: `docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`
- Branches (git flow): Tasks 1–4 were merged into `develop` from `feature/phase-1-map`, which has
  since been deleted. Each remaining task, or group of tasks, starts a `feature/<slug>` branch from
  `develop` and goes back through a PR into `develop`.

## How to continue
1. Branch from `develop`. In a cloud session the SessionStart hook runs
   `scripts/cloud/session-start.sh` at startup. If no `[session-start]` lines appeared, run it by hand:
   `CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh`.
2. Use the superpowers `subagent-driven-development` skill against the plan, starting at the
   first task not marked complete below. It gives each task a fresh implementer, then a
   spec-and-quality review.
3. Keep the rules in `CLAUDE.md`. In particular: codes only, never invent people, git flow,
   and no AI-looking UI.

## Status
| Task | State | Commits |
|---|---|---|
| 1 Scaffold (Laravel 13 + Vue/Inertia kit, Sail, MySQL, Pest, Vitest, CI) | Complete, review clean | `a54a5ca` |
| 2 Gazette loader, provinces, code validation | Complete, review clean | `587a887` |
| 3 Ward assembly with 13 Red Cross fills | Complete, review clean | `3fd0506` |
| 4 Derived layers, outputs, build report | Complete. Review needed fixes; fix round 1 was re-reviewed clean | `3af9490`, `4a2d9d0`, `216cf8a` |
| 4b Evidence-based ward corrections | Complete, self-reviewed (no subagent tool in that session). 38 `mode=replace` rows, each passing the two-signal rule or tied by geometry to a cluster that does (Mandera East 212–215, Murera/Theta, Marachi East/North, Karachuonyo 1230/1231/1236, Mwanganthia/Abothuguchi Central, Mogotio/Lembus, Kitengela/Oloosirkon). The 94 reference points are OSM towns named after their ward, at least 100 m from either layer's lines (`boundaries/scripts/reference_points.mjs`). 82 wards are "still uncertain" in the build report. Kitengela is marginal: only the brief's point supports it. A failing build now writes no outputs, and `manifest.json` keeps `towns.geojson` | `455613f` + follow-up |
| 5 Towns and glyphs | Complete. Towns from the HOT OSM export on HDX (Overpass is unreachable from cloud sessions), each tagged with its ward | `b7f1381` |
| 6 Unit directory, routes, meta tags | Complete. `og-default.png` rendered from the map | `8cfd425` |
| 6b Visual direction tokens | Complete (`docs/design/visual-direction.md`) | `e4ce241` |
| 7 Map core | Complete, with owner changes: `MapView` is a reusable component with an overlay registry (`lib/map/overlays.ts`); the ward source is always in the style but loads lazily | `e4ce241` |
| 8 Panel, sheet, search, list, legend, About | Complete | `e4ce241` |
| Owner request: real 2022 office holders, party colouring, seating charts | Pulled forward from Phase 2. Importer `data:import`, sourced CSVs under `data/sources/`, `/data/seats.json`, colour by any seat's party, National Assembly and Senate charts | `5d6f9f3`, `4af8420`, `e4ce241` |
| 9 Export cards | Not started | — |
| 10 PWA | Not started | — |
| 11 Docs and verification | Partly: browser check at 390×844 and 1280×800 done by Playwright; PR open | — |

Infra outside the plan, requested by the owner: `962f7bd` (CLAUDE.md, `.claude/`, cloud
scripts) and `fdec2ff` (owner additions to the plan).

## Decisions made during execution (binding)
- **R1:** `assembleWards({ iebc, arc, patches, gazette, expected = 1450 })`.
- **R2:** `useMap` has no `exportView`. Task 9 calls `renderMapImage({ style: buildStyle(…) })`.
- **R3 (visual direction):**
  - The owner picked **A "Ballot box"**: seat colours are the IEBC ballot colours (Governor
    `#3E8FD0`, Senator `#F2C230`, Woman Rep `#7A4FA0`, MP `#2E8B57`, MCA `#C8A97E`), Archivo
    type, ground `#EEF1EF`, ink `#13233A`.
  - Dark mode is **B "Tally night"** (`#0F2430` / `#16303F`).
  - Mockups: https://claude.ai/artifact/FQP7fsRPSAr7SgiWiE9BTx
  - Throwaway interactive preview: https://claude.ai/artifact/P6LU6gRYzs7VdvNn838G2q
  - The owner liked the preview. Its known gaps were the 13 missing wards and weak zoom, label
    and division handling, which are now requirements.
- **R4:** `parsePatches(csv)[11]` is `{iebcCode: 735, arcUid: 'qsljIZxApCc'}`.
- **R5:** the build report states actual correction counts, which differ from the plan's
  estimates.
- **R6:** `pwa-build.test.ts` fails loudly if `public/sw.js` is missing. CI builds before
  running the JS tests.
- **Task 4 data choices:**
  - mapshaper `-dissolve` replaces the deprecated `-dissolve2`.
  - Simplification is tiered by ward size: under 1 km² keeps 60%, under 5 km² 30%, under 20 km²
    8%, under 60 km² 4%, and everything else 2%, with keep-shapes. Every ward stays within ±20%
    of its full-detail area; the worst is −4.7%.
  - The build fails if any ward changes by more than ±35%.
  - Gzipped wards are 279 of 300 KB, so only about 21 KB of headroom is left.
  - `-clean gap-fill-area=400km2` fills 434 interior gaps of about 1,324 km² in total. This is
    recorded in `wards.mjs` and the build report.
  - Label points exist for all four levels, with `rank` set to province 0, county 1,
    constituency 2 and ward 3.
- **Regions:**
  - Phase 1 ships the 8 former provinces only.
  - Phase 2 adds "region sets" in a sourced, reviewed CSV: media sub-regions (labelled
    informal) and county economic blocs (a county may be in several).
  - Custom campaign regions come in Phase 4.
- **Office holders (Phase 2):**
  - Import from IEBC gazette notices, which carry codes. The 2022 declarations are GN
    9949/9950/9951/9955/9956 and corrigenda GN 10533–10535. Nominated members are GN
    10537/10712, then 11259, 10083 and 15172. By-elections since 2022 come on top.
  - Show the party a holder was elected on, not informal alignment.

- **Admin data review table (Phase 2, owner request):** a Filament table of every Governor,
  Senator, Woman Rep, MP, MCA and nominated member, with search, filters, inline and bulk
  edit, a "questionable" flag, data-check tabs, CSV import and export, and audited rollback.
  See the spec section "Admin data review table".

## Parked minor review findings (fix when touching the code)
- **Task 4:**
  - A failing build still writes the outputs and report before exiting.
  - The report prose has hard-coded numbers.
  - The gap-fill effect isn't recorded per ward. For example, a 309 km² gap in West Pokot went
    to 657 Chepareria and its neighbours. Gaps over 50 km² should be flagged.
  - Concurrent `runMapshaper` calls corrupt the logging capture.
  - `units.json` parents are only spot-checked.
  - Rounding silently drops collapsed parts.
  - The nesting tests check label points only.
- **Task 1:**
  - `composer.json` has `php: ^8.3`. Raise it to `^8.4`.
  - The kit's composer scripts assume sqlite and PHPStan.
  - The kit's `ExampleTest` duplicates `HomeTest`.
  - `.npmrc` sets `ignore-scripts=true`.
  - CI's Node version floats on 22.
- **Task 2:**
  - A missing CSV column gives an unclear `TypeError`.
  - An unterminated quote is accepted.
  - A whitespace-only line becomes a row.
  - An exact duplicate ward row is accepted.
  - Bad input puts `NaN` into `validateCodes` output.
  - One test uses a bare `toThrow`, and there's no test for a duplicate county.
- **Task 3:**
  - There's no fixture with a straddling or multi-patch case.
  - The mapshaper log capture isn't safe if calls overlap.
  - Source attributes come from the first piece only, and `Number('')` becomes 0.
  - The parent-correction branches have no tests.

## Cloud environment notes
- **Environment:** "Elections App" (`env_01StAectAimqiN9aWCso1VPu`). Its setup script is
  `scripts/cloud/environment-setup.sh` and is confirmed working: PHP 8.4.28 and MySQL 8.0.46.
- **Verified 2026-11-26:** `scripts/cloud/session-start.sh` completes (composer installs from git
  because the GitHub proxy refuses zip downloads; see `docs/cloud-setup.md`), and both test
  suites pass.
- **The SessionStart hook:** it lives in `.claude/settings.json`, which is on `develop`, so new
  cloud sessions run `scripts/cloud/session-start.sh` at startup.
- **Raw boundary sources** (`boundaries/raw/`, about 120 MB) aren't in git. Fetch them with
  `npm run boundaries:fetch` before Task 4b or 5. That needs `codeload.github.com` and
  `data.humdata.org` in the network allowlist, and `overpass-api.de` and
  `raw.githubusercontent.com` for Task 5. See `docs/cloud-setup.md`.
