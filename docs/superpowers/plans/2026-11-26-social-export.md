# Social Export of the Current View: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn whatever the user has filtered on the map into a polished, neutral social post:
still images for Instagram, stories and X, and a short animated MP4 for TikTok and Reels.

**What the owner asked for (2026-11-26):**
- "I need a cool way of exporting such data for Instagram, TikTok, Twitter infographics… when a
  user filters."
- The owner chose to include animated video.

**Architecture:**
- Everything runs in the browser and reuses the existing export stack in `resources/js/lib/export/`
  (`renderMapImage`, SVG card templates, rasterising, `shareOrDownload`).
- The card is built from a `ViewState` snapshot of the current filters:
  - seat mode;
  - the highlighted party set;
  - the focused unit and its ancestors;
  - whether "Show surroundings" is on;
  - the theme;
  - the legend rows with counts and percentages, scoped as on screen.
- **Video:**
  - Frames are drawn to a canvas and recorded with `MediaRecorder`, preferring
    `video/mp4;codecs=avc1`, then `video/webm;codecs=vp9`, then `video/webm`.
  - There's no ffmpeg.wasm, to keep the bundle small.

**Spec:**
- `docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md` (infographic exports,
  neutrality).
- The owner messages quoted above.

**Branch:** `feature/social-export`, started from `develop` with git flow after
`feature/people-search-focus` **and the pocketbook data feature** are finished. The owner wants
exports to cover census and voter data too. Finish with `git flow feature finish`. No PR.

## Numeric views (census and registered voters)
The owner asked on 2026-11-26 for exports to cover "census data etc." These views come from the
pocketbook data feature, which runs first:
- **Population** (KNBS census 2019, county level).
- **Registered voters** (IEBC 2022 register, every level).

For these views:
- **`ViewState`** carries the metric, its source and year, and the class bins.
- **`ViewCard`** layout:
  - The sequential map.
  - A top-10 units bar chart for the current scope, with each value and its % of the scope total.
  - The class legend.
  - Headline examples: "Registered voters across Kenya: 22.1 million (IEBC 2022)" and
    "Population, Nairobi City: <n> (KNBS census 2019)".
- **The video:** bars grow and the map shades by value class, lowest to highest, instead of
  party by party.
- **Tests:** `headlineFor` and `ViewCard` get one case per numeric metric.

## Global Constraints
- **Neutrality:**
  - No party logos. Party colours appear only as data.
  - The headline comes from the numbers, for example "MCA seats across Kenya: UDA 523, ODM 312".
    No adjectives such as "dominates" or "sweeps".
  - Every card shows its source, "as of" date and site URL.
  - A diagonal "Sample data" watermark appears whenever sample records are shown.
- Show people's names exactly as the data spells them.
- **Look:** Ballot box tokens; dark or light follows the app theme, or the user picks it in the
  dialog. The no-AI-look rules apply: no gradients, glows or emoji, sentence case.
- **Fonts:** self-hosted woff2 fonts embedded in the rasterised SVG (as the existing export does).
- **Sizes**, in pixels:

  | Key | Use | Size |
  |---|---|---|
  | `square` | Instagram post | 1080×1080 |
  | `portrait` | Instagram post | 1080×1350 |
  | `story` | Stories, TikTok and Reels | 1080×1920 |
  | `x` | X / Twitter | 1600×900 |

- **Video:** 1080×1920 at 30 fps, 7 s ± 1 s, under 15 MB.
  - The file name follows the image pattern with a `.mp4` or `.webm` extension.
  - If only WebM is available, tell the user plainly: "This browser saves video as WebM.
    Instagram needs MP4. Try Chrome or Safari on your phone."

---

### Task 1: "Share this view" still images

**Files:**
- Create:
  - `resources/js/lib/export/viewState.ts`: `snapshotView(...)` returns `ViewState`, and
    `headlineFor(view)` returns a string.
  - `resources/js/components/export/ViewCard.vue`: an SVG card in all four layouts.
  - `resources/js/components/export/ShareViewDialog.vue`
  - `resources/js/lib/export/caption.ts`: `captionFor(view, url)` returns a string.
- Modify: `Legend.vue`, to add a "Share this view" button that shows whenever a seat mode is on,
  and stands out when parties are highlighted or a unit is focused. Also modify `Map.vue`.
- Tests:
  - `tests/js/export/viewState.test.ts`
  - `tests/js/export/ViewCard.test.ts`
  - `tests/js/export/caption.test.ts`

**Card content**, top to bottom, arranged per size:
- The ballot-lid strip.
- The headline, editable in the dialog.
- A one-line scope, for example "Across Kenya" or "In Nairobi City", plus "Highlighting UDA,
  ODM" when parties are highlighted.
- The map image, rendered off-screen at the card's map box size with the same filters: colour
  mode, highlight set, focus and surroundings.
- The bar chart: the same rows as the legend, with counts and percentages, and highlighted rows
  emphasised.
- Up to two big-number callouts for the highlighted parties, or the top two parties when none
  are highlighted.
- The footer: source, "as of" date and the deep link URL for the view.
- **Story and X layouts** get the map larger, with the chart beside it on X and below it on
  stories.

**Caption:**
- The headline, then one line per highlighted party (or the top three) with counts and
  percentages, then the source with its "as of" date, then the link, then
  `#Kenya2027 #KenyaDecides`.
- Under 2,200 characters for Instagram and TikTok. The X variant is under 280 characters.
- The "Copy caption" button copies it, with a fallback to selecting the text.

**Dialog:**
- A size picker, a light/dark toggle, an editable headline and a live preview.
- **Share:** uses `navigator.share` with the file plus caption text where `canShare({files})`
  allows. **Download PNG** is the other option, along with **Copy caption**.

**Deep link:** the view's URL encodes the seat mode, highlight set and focused unit. Use the
existing unit path plus `?seat=mca&parties=uda,odm`, so a shared link reopens the same view.
`Map.vue` must read these on load.

- [ ] **Step 1:** Write failing tests:
  - `headlineFor`:
    - With the MCA seat mode, no focus and UDA plus ODM highlighted, it returns
      "MCA seats across Kenya: UDA 523, ODM 312", using fixture counts.
    - With Nairobi focused and nothing highlighted, the headline names the top party in Nairobi.
  - `captionFor` stays within the length limits and contains the source and the URL.
  - `ViewCard` renders each of the four sizes with the right `viewBox`. The watermark shows
    only for sample data. Highlighted rows are emphasised.
  - Reading the deep-link query restores the seat mode and parties.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright in Docker:
  - Export all four sizes for MCA mode with UDA and ODM highlighted nationally, and for MP mode
    with Nairobi City focused, in both dark and light.
  - Open the PNGs and check that text is legible at phone size and nothing overlaps or gets cut
    off.
- [ ] **Step 6:** Commit: `feat(export): share the current map view as social images`.

### Task 1b: Independents as their own group, everywhere

The owner decided this on 2026-11-26: "Yes, separate everywhere". Today, holders with party
`IND` (Independent) are folded into the grey "Other and independent" group on the map, in the
legend, in the seating charts and on cards.

From now on, Independents always have their own group and row, everywhere. That group is never
folded into Other, and "Other" means only the small parties with no colour of their own.

**Files:**
- Modify:
  - `resources/js/lib/legend.ts`: `buildLegend` and `buildProvinceLegend`, Other folding, labels.
  - `resources/js/lib/seats.ts`: party colours, chamber groups, `chamberHighlight`.
  - `resources/js/lib/map/colouring.ts`: `seatColouring`.
  - `resources/js/lib/map/theme.ts`: a new `independent` token for light and dark.
  - `resources/js/components/map/NationalOverview.vue` and `Hemicycle.vue`, if their grouping
    labels change.
  - `resources/js/lib/export/*`: cards and captions follow automatically through `buildLegend`.
    Check them.
- Tests: `tests/js/legend.test.ts`, `tests/js/seats.test.ts`, `tests/js/map/style.test.ts`,
  `tests/js/export/*` and `tests/js/components/NationalOverview.test.ts`.

**Rules:**
- **Colour:** a new theme token `independent`.
  - It's a neutral colour that isn't a party colour: a warm slate, for example.
  - It must be visibly distinct from `OTHER` grey, `faded` and `noData`, with 3:1 contrast
    against the ground and the land fill in both themes.
  - Check it against the party palette for colour-blind safety, loading the `dataviz` skill for
    guidance.
- **Legend rows:**
  - "Independent" is a normal row, sorted by count like any party.
  - The grouped row is renamed "**Other parties**" and covers only uncoloured parties.
  - Its member count stays available, for example "Other parties (43)" in accessible text.
- **Map:** independent-held units take the `independent` colour, including colour by ancestor
  and the party highlight. "Independent" can be highlighted like any party.
- **Seating charts** (`NationalOverview`): Independents get their own group and colour, and
  "Other parties and independents" becomes "Other parties".
- **Cards and captions** follow through `buildLegend`. Nothing is special-cased in export code.
- **Deep links:** `parties=ind` works.

- [ ] **Step 1:** Write failing tests:
  - MCA national gives an "Independent 114 (8%)" row and "Other parties 257 (18%)", using the
    real `seats.json` fixtures or the existing test data.
  - The theme token `independent` differs from `OTHER`, `faded` and `noData` in both themes.
  - `seatColouring` maps an IND-held unit to `independent`.
  - Highlighting "Independent" keeps only IND units coloured.
  - The `NationalOverview` groups include Independents separately.
  - A card snapshot's rows equal `buildLegend`'s rows.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright: screen legend plus map in MCA mode nationally (light and dark), the
  seating charts, and a square card. Look at them.
- [ ] **Step 6:** Commit: `feat(map): independents as their own group everywhere`.

### Task 2: Animated video for TikTok, Reels and stories

**Files:**
- Create: `resources/js/lib/export/video.ts`, `resources/js/lib/export/timeline.ts` and
  `resources/js/components/export/VideoPreview.vue`
- Modify: `ShareViewDialog.vue` gains a "Video" option, available only for `story` size.
- Tests: `tests/js/export/timeline.test.ts` and `tests/js/export/video.test.ts`, with
  `MediaRecorder` mocked.

**Storyboard** (7 s, 1080×1920, 30 fps), a pure timeline from time to frame state:

| Time | What happens |
|---|---|
| 0–0.8 s | The ballot strip, headline and scope fade in. The map is neutral grey with boundaries. |
| 0.8–3.8 s | Parties colour in one at a time, largest first, about 0.4 s each with ease-out. The matching bar grows and its count ticks up at the same time. |
| 3.8–5.5 s | The big-number callouts land. The highlighted parties pulse once with a scale of 1.0, then 1.03, then 1.0. No glow. |
| 5.5–7 s | The footer, source and URL hold still. |

- With reduced motion, the dialog offers the still image instead.

**Rendering:**
- Precompute the map frames instead of driving a live map per frame. Render one coloured map
  image per stage: neutral, then cumulative parties. Use the existing off-screen
  `renderMapImage`, then cross-fade those images on the canvas.
- Bars, counts and text are drawn on the canvas from the same layout as `ViewCard` (shared
  layout module).

**Recording:**
- Use `canvas.captureStream(30)` and `MediaRecorder` with the best supported MIME type.
- Drive frames with `requestAnimationFrame`, but advance the timeline by recorded frame count so
  the timing holds.
- Show progress and a Cancel button.
- Output: preview, then Share (`navigator.share` with the file) or Download, plus Copy caption.

- [ ] **Step 1:** Write failing tests:
  - `timeline(t)` gives the right party set and bar lengths at t = 0, 1, 2.5, 4 and 6.9.
  - MIME selection prefers mp4, then webm vp9, then webm.
  - The recorder stops at 7 s and returns a Blob with the chosen type.
  - Cancel aborts cleanly.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:js`, `types:check` and the Sail build. Expected: PASS.
- [ ] **Step 5:** Playwright in Docker (Chromium):
  - Record the MCA UDA plus ODM video.
  - Save it, check its duration with `ffprobe` from the container if available (otherwise check
    the size and type), and extract frames at 1 s, 3 s and 6 s to look at.
- [ ] **Step 6:** Commit: `feat(export): animated video for TikTok, Reels and stories`.
