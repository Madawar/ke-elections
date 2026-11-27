# Roadmap and open decisions

Last updated 2026-11-27, when v0.4.0 (`feature/share-formats`, the first four share formats) was
released. This is
the committed record of what comes next. Local execution ledgers are gitignored and deleted when
a feature finishes.

## Done on develop
- **Phase 1 data and map:** boundaries, units, the 2022 office holders, the map, the PWA and share
  images. See `2026-11-26-phase-1-progress.md`.
- **People search and focus mode**
  (`docs/superpowers/plans/2026-11-26-people-search-focus.md`, Tasks 1, 2 and 3A):
  - Search politicians by name.
  - Selecting a unit shows only that unit, with "Show surroundings", centring, and zoom-out that
    steps up a level.
  - Cased borders and border hierarchy in colour views.
  - A bar-chart legend with percentages, scoped to the selection.
  - Multi-select party highlight.
- **Social export of party views**
  (`docs/superpowers/plans/2026-11-26-social-export.md`, Tasks 1, 1b and 1c):
  - "Share this view" cards in square, portrait, story and X sizes, with captions, the share
    sheet and compact deep links (`?seat=&parties=`, `parties=other`).
  - Independents as their own group everywhere. "Other parties" means uncoloured parties only,
    and every coloured party gets a legend row.
  - Seat-mix bars, per-constituency mix rows, and a "who holds what" list. Single-seat cards show
    the holder.

- **Releases:** v0.1.0 and v0.1.1 (worker fix) on 27 Nov 2026, live at https://ke-elections.madawar.app
  (Forge, deployed from `main`).
- **Map controls** (`2026-11-27-map-controls.md`, Tasks 1–4, v0.2.0):
  - Seat chips on the map, and one-tap drill-down.
  - Seat view follows the focus level.
  - Back button and phone back, with the outside-tap hint.
  - Party profiles scoped to a county or constituency, with a party card.
  - Onboarding tour and tips.
- **Leaders and MP outlines** (`2026-11-27-map-controls.md`, Tasks 5–6 with the owner's additions,
  v0.3.0). Rulings, review outcomes and parked minors are in `2026-11-27-leaders-progress.md`.
  - "Who represents <unit>" in the panel and "Leaders here" in the legend, both from
    `leadersFor()` in `lib/leaders.ts`.
  - The striped "County seats" view.
  - MP outlines over MCA wards, with "MP: <ABBREV>" under constituency names and two lists in
    the legend.
  - Leaders cards for a county, a constituency and a ward; a leaders strip and bigger maps on
    the "Share this view" cards.
- **Share formats 1, 5, 6 and 8** (`2026-11-27-share-formats.md`, v0.4.0). Rulings, review
  outcomes and parked minors are in `2026-11-27-share-formats-progress.md`.
  - One registry of card kinds in `lib/export/shareView.ts`: a new card is one entry (its
    component, sizes, map slots, headline rule, caption). The dialog's "Card" choice lists what
    the place offers.
  - "By the numbers" (square, story) and "Kenya, five ways" (square, story) from any national
    seat view, including "County seats".
  - "Top 10 counties" for one party or the independents on MP or MCA seats (square, story), from
    the national view with that group highlighted, or from the party's profile.
  - "Who represents this ward" (portrait, story): five ballot papers with three locator maps. It
    replaces the ward's "Leaders of <ward>" card.

## Queue, in order (owner priorities as of 2026-11-27)
1. **All eight share formats.** The owner said, 2026-11-27: "I loved all."
   - **Done in v0.4.0:** formats 1, 5, 6 and 8 (`2026-11-27-share-formats.md`).
   - **Next:** 4 (equal-size county tiles), 7 (side by side), 3 (county carousel, slides 1–4).
   - **Mock-ups:** https://claude.ai/artifact/MGTqRFYdds6L2ZTqriusnj
   - **Order:**
     - After the leaders branch, because format 1 reuses `leadersFor()`: 1 (who represents this
       ward), 5 (Kenya, five ways), 6 (by the numbers), 8 (top 10 counties for a chosen group).
     - Then: 4 (equal-size county tiles; check the tile layout by hand), 7 (side by side; needs a
       "compare with" picker), 3 (county carousel, slides 1–4).
     - With the by-election history work in the pocketbook phase: 2 (what changed since 2022) and
       carousel slide 5. Both need a terms/changes endpoint.
   - **Neutrality rules from the mock-ups:**
     - Order by seat, count, date or code. Break ties by code, and say so on the card.
     - The group in the top-10 format is always the user's pick, and its headline is a template.
     - Write "was" and "now" as words.
     - Use seat colours only for edges and strips.
- ~~Social export: still infographics~~ **Done.** The numeric (census and voters) views are
   added once the pocketbook data lands.
2. **Voter guide, "How elections work".** English first, then a reviewed Kiswahili version.
   - Built on the infographic card system, so each section can export as a carousel or story.
   - Draft content, for the **owner to review before the build**, is in
     `docs/research/voter-guide/` (`guide-en.md`, `slides-en.md`, `facts.csv`: 128 facts, 118
     verified, 7 partial, 3 unverified).
- ~~Task 3B map controls~~ **Done in v0.2.0.** The spec is in `2026-11-26-people-search-focus.md`, Task 3, items
   (b), (c) and (g). It goes on its own branch:
   - (b) Seat chips on top of the map; the owner chose this placement.
   - (g) A back button, the browser and phone back gesture, and the new outside-tap rule (no-op,
     or select a neighbour when surroundings are shown), with a hint card.
   - (c) Onboarding tips.
   - **Drill-down tapping.** The owner noted on 2026-11-26 that "selecting Machakos, I end up
     clicking constituencies".
     - A tap picks the level from the current focus, not from the zoom:
       - With nothing focused, a tap selects the **county** under the finger, at any zoom.
       - With a county focused, a tap inside it selects that **constituency**.
       - With a constituency focused, a tap inside it selects that **ward**.
       - With a ward focused, a tap inside it does nothing.
     - This replaces the zoom-based level picking in `useMap`'s click handler.
     - Stepping up stays as it is: the back button, browser and phone back, zoom-out, and
       breadcrumbs.
     - Hover tooltips follow the same rule, so they name the unit a tap would select.
     - Update the onboarding tip and the outside-tap hint wording to match, e.g. "Tap a county,
       then tap again to go deeper."
     - Tests: unit-test `tapTarget(focus, featuresUnderPoint)` for each case.
4. **Pocketbook data.**
   - KNBS 2019 census at county level (population, households, area, density). Ward and
     constituency figures only from an official KNBS table, never derived from sub-counties.
   - IEBC 2022 registered voters per ward, which roll up exactly.
   - Unit areas.
   - The IEBC 2027 calendar.
   - New "Population" and "Registered voters" colour views.
   - Pocketbook cards per level.
   - The **by-election model and data fixes** (below).
   - **Past results, pending the owner's yes:**
     - 2022 presidential totals per constituency from Form 34B, reconciled to Form 34C.
     - Turnout.
     - 2013 ward-level presidential results from the data we have.
     - Other seats later, through the admin table.
   - **"Who does what":** one diagram per seat, built once and used in three places. The owner
     said "I don't want the UI to get bloated. It's at the sweet spot now."
     - **The seats:** Governor, **Senator**, Woman Rep, MP and MCA. The owner asked for Senators
       not to be forgotten.
     - **Each diagram shows:**
       - Who does the work, who checks them, and what the seat can't do.
       - Real holders for the place.
       - Ballot-colour boxes, and arrows labelled with what they mean ("approves budget",
         "oversees", "decides removal").
       - A Constitution-first citation and an "as of" date.
     - **Place 1, the map:** only a text link, "What this seat does", under each holder in the unit
       panel. It opens the diagram in the bottom sheet. No new chips, layers or buttons.
     - **Place 2, the pocketbook:** a "Who does what" page with "pick a problem" and "pick a seat"
       views, using the same diagrams.
     - **Place 3, export:** a share card with the same diagram, for example "Your MCA vs your
       Governor".
     - **Research:** `docs/research/roles/` (104 facts, 75 verified).
     - **Before release, check by hand:** the 6 unverified facts, the NG-CDF judgments
       (Kenya Law blocked automated reading), the Supreme Court ruling of 25 Sep 2026
       ([2026] KESC 62), and the current editions of the Acts.
     - **Mzalendo:** links only, through a reviewed `data/sources/links/mzalendo.csv` keyed by
       codes. That's about 1 day of checking, for 399 of 416 rows matched. There's no licence to
       reuse its numbers, and no attendance data exists to show.
5. **Numeric-view infographics:** census and voters, with a top-10 bar chart.
6. **Animated video export.** Plan: `2026-11-26-social-export.md`, Task 2. The spike proved:
   - **Use WebCodecs `VideoEncoder`** (H.264 `avc1.640028`, 1080×1920, 30 fps, timestamps from
     the frame index, a faststart MP4). It gave exactly 210 frames, 7.0 s and 2.1 MB with sharp
     text.
   - MediaRecorder dropped to about 21 fps with uneven timing, so it's a fallback only.
   - Check `mp4-muxer` against Mediabunny.
   - Ward lines need to be at least 1–1.5 px in video.
   - Keep text out of the TikTok and Reels UI zones: about the bottom 400 px and the right 120 px.
   - Independent must not share Other's grey.
   - Centre the map.
7. **Docker setup like `../salon-app`:**
   - A published, trimmed PHP 8.5 runtime under `docker/8.5` with its own image name
     (`ke-elections/app`). Salon also tags `sail-8.5/app`.
   - Containers for Vite HMR, MySQL 8.4 with a memory cap, Redis with a queue worker and the
     scheduler, Mailpit, and Playwright.
   - No fixed container names, and ports offset so both projects can run at once.
8. **Admin backend:** Filament at `/admin`, the office-holder review table, data-check tabs,
   CSV import and export, and audit with rollback. See the spec section "Admin data review table".
   The owner registers and is then made admin.
9. **Social login and public accounts:**
   - Socialite with Google, Facebook and X, plus email.
   - Signed-in public users can follow places and people and suggest corrections, which go to a
     verifier queue.
   - Sanctum later, if a mobile API is needed. Passport isn't needed.
10. **Party and candidate pages** when 2027 nominations open. See the spec section "Party pages,
    candidate pages and nominations". Look at Kiongozi Online first.
11. **Optional:** one-tap coalition buttons (Kenya Kwanza, Azimio) in the party highlight.

## Owner answers (2026-11-26)
- **Pocketbook context trigger:** the **middle of the screen**. The context is the unit under the
  centre of the visible map at the current zoom level, updated on `moveend`. A tap still focuses.
- **The by-elections the owner meant:** **Ol Kalou** (Jubilee to DCP, 16 Jul 2026) and
  **Mbeere**: Mbeere North MP (DP to UDA, 27 Nov 2025) and its wards Muminji and Evurore (to UDA,
  26 Feb 2026). All are in the data, and they're the reference cases for "changed hands since
  2022".

## Open questions for the owner
- **Share formats (v0.4.0), to judge by eye:**
  - The top-10 story map is small (280 × 341); a bigger one means smaller rows.
  - The five-ways story is three maps across with the sixth cell empty and the key under the
    grid (the plan said two across; those maps were 171 × 208).
  - The ward card's MP and MCA maps are small on the story (about 120 px tall).
  - A listed county as small as Mombasa barely shows on the top-10 map. Give it a ring?
  - The ward card's locator marks are ink, not the seat's ballot colour as in the mock-up, so a
    green or beige fill cannot read as a party.
- **"Towns: © OpenStreetMap contributors" on cards:** every card with a map prints it, but card
  maps draw no town labels. Dropping it changes the footer of every map card.
- **Leaders strip on other cards:** only MCA cards for a county or a constituency carry it. Should
  Governor, Senator, Woman Rep and MP cards carry it too? (`cardLeaders` in
  `lib/export/viewState.ts`; see the ruling in `2026-11-27-leaders-progress.md`.)
- Past results work (step 4): yes or no, and in that order?
- None-mode inner borders inside a focused unit are now heavier (plan item (e)). Is that OK, given
  the owner liked "boundaries only"?

## Data fixes found by the by-election research
- **Mathira MP's name:** our data has "Eric Mwangi Kahugu", but Parliament's list has "Meangi". Check
  the gazette before changing it. (`docs/research/by-elections/`)
- **Migwani ward 338** is shown as held but has been **vacant since 6 Aug 2026** (GN 15266). Its
  17 Nov poll was suspended by a court, and no new date has been gazetted.
- **David Ndakwa overlaps two seats:** Malava MP from 2025-11-27 and West Kabras MCA until
  2026-02-26. Fix the end date.
- **Outgoing holders' `ended_on` equals the poll date,** which hides the vacancy. Use the real
  vacancy dates, for example Porro 28 Dec 2025 and Endo 27 Jan 2026, plus an "upper bound" flag.
- **GN 11216 and GN 15266** are missing from `data/sources/raw_mca/sources.csv`. The Elgeyo
  Marakwet senator note should cite GN 143.
- **Proposed model:**
  - `office_holders` gains `end_reason` and `ended_on_is_upper_bound`.
  - A new `by_elections` table: vacancy date and cause, status, poll date, gazette refs, and
    links to the outgoing and incoming terms.
  - `nominations.by_election_id`.
- **Rule:** under Art. 101(4)–(5) there's no parliamentary by-election in the 3 months before
  10 Aug 2027.

## Corrections from the voter-guide research
- The 28-day petition window for seats other than President counts from **IEBC's declaration**,
  not from gazettement (Art. 87(2), Elections Act s.76(1)(a)).
- Nomination windows and campaign start dates differ by seat; see `facts.csv`.
- The Senate notice says "Saturday, 25th June", but 25 Jun 2027 is a Friday.

## Parked minor findings (fix when touching the code)
- **Share formats (v0.4.0):** see "Parked minor findings" in
  `2026-11-27-share-formats-progress.md`.
- **Leaders and MP outlines (v0.3.0):** see "Parked minor findings" in
  `2026-11-27-leaders-progress.md`. Also left from that branch: bigger maps on the party card and
  the "Share image" card.
- **Map controls (v0.2.0).** The final review decided these can wait:
  - **Seat chips:**
    - The Map button's badge counts the chip choice.
    - Muted chips use `role=radio`; consider `role=button`.
    - Party highlights pruned by an automatic seat switch aren't restored when stepping out.
    - Phones show "None" off-screen when MP or MCA is active.
    - There's no contrast test for faded chips.
  - **Hover:** runs 3 `queryRenderedFeatures` calls per mousemove. Query only the focus level and
    the next one.
  - **History:**
    - The pending-pop queue isn't keyed to a path.
    - A zoom that jumps two levels leaves a duplicate entry.
    - After a reload, the app's Back button pushes an entry instead of going back.
    - The popstate gate has no listener-order guard test against an Inertia upgrade.
    - A swallowed popstate drops the query string.
  - **Outside-tap hint:** inside taps and pans don't dismiss it.
  - **Party profile:**
    - Zooming out closes the profile.
    - "Show on map" closes it on desktop.
    - The tab title drops the scope after `router.replace`.
    - A ward `?in=` isn't resolved to its constituency.
    - The vacancy wording ("Not held by X" for a vacant seat) needs fixing when the by-election
      model lands.
    - The percentage for "Total elected seats" at county scope is dominated by MCAs.
    - Add a `coalition_source_url` data column; until then only Azimio and Kenya Kwanza show.
  - **Party card:** the empty bands in square and portrait sizes.
  - **Legend:** at 320 px, windows 1100–1199 px wide lose the focused unit's clearance.
  - **Onboarding:**
    - Tips steal focus.
    - The legend fallback should use the "below" side.
    - The docked phone tip has no pointer.
    - `goto()` races on a double Next.
    - The location guard is a source-text test.
  - **Tests:**
    - Flaky `vi.waitFor` timeouts in the colourSync and partyPage tests under parallel load.
    - The no-WebGL test relies on a `__noWebGL` mock global.
  - **Ops:**
    - Production `APP_URL` should be `https://`.
    - The unused MySQL user `ke_elections` on the server should be removed.
- **Social export:**
  - A scoped deep link with `parties=other` expands against the national uncoloured set, so a
    county link can highlight a small party from outside that county. Expand it within the link's
    unit scope instead.
  - In the light theme, the faded grey is close to Other grey when Other parties is highlighted.
  - The national MCA square card drops its callouts (12 rows).
  - Story maps are smaller because of the TikTok and Reels safe zone.
  - The holder block's "Source" repeats the footer.
  - The Mathare MP square leaves empty space around a small map.
  - Unit row counts ("N wards") count only held seats. They need to become vacancy-aware with the
    by-election model.
  - The hemicycle legend sorts "Other parties" above Independent.
  - In dark tritan vision, the gap between Independent and UDA is ΔE 4.9.
  - The selected-unit outline is faint over the Independent colour.
  - `ShareViewDialog`'s restore through `applySharedView` isn't tested end to end.
- **Search:** picking the same person twice doesn't re-scroll.
- **Nominated picks:** a pick with a null party shows no message.
- **Accessibility:** the "Show surroundings" switch's hint should use `aria-describedby`.
- **Performance and cleanup:**
  - The style is built twice per focus change.
  - The search cache needs a comment.
  - `ownMove` isn't re-armed on an interrupted move.
  - Tap-drag and double-click zoom aren't centre-anchored.
  - `setPadding` only takes effect on the next camera move.
- **Labels and borders:**
  - Duplicate constituency and ward labels around zoom 10 in Nairobi.
  - Thin ward lines between same-coloured wards inside a focus.
  - A focused ward's interior is darker than a focused constituency's (the selected tint).
- **Legend:**
  - The percent denominator excludes vacant seats.
  - It floats mid-screen on phones when the sheet is low.
- **Data loading:** a failed ward load stays silent, though it degrades gracefully to the parent
  constituency.
- **Formatting:** `vp check` reports unformatted files in 44 existing paths.
