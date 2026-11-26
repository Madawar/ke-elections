# Roadmap and open decisions

Last updated 2026-11-26, when `feature/people-search-focus` was finished into `develop`. This is
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

## Queue, in order (owner priorities as of 2026-11-26)
1. **Social export: still infographics.** Plan: `2026-11-26-social-export.md`, Task 1. Branch
   `feature/social-export`.
   - Covers the party views first. The owner said "focus on infographics."
   - The numeric (census and voters) views are added once the pocketbook data lands.
2. **Voter guide, "How elections work".** English first, then a reviewed Kiswahili version.
   - Built on the infographic card system, so each section can export as a carousel or story.
   - Draft content, for the **owner to review before the build**, is in
     `docs/research/voter-guide/` (`guide-en.md`, `slides-en.md`, `facts.csv`: 128 facts, 118
     verified, 7 partial, 3 unverified).
3. **Task 3B map controls.** The spec is in `2026-11-26-people-search-focus.md`, Task 3, items
   (b), (c) and (g). It goes on its own branch:
   - (b) Seat chips on top of the map; the owner chose this placement.
   - (g) A back button, the browser and phone back gesture, and the new outside-tap rule (no-op,
     or select a neighbour when surroundings are shown), with a hint card.
   - (c) Onboarding tips.
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
- Past results work (step 4): yes or no, and in that order?
- None-mode inner borders inside a focused unit are now heavier (plan item (e)). Is that OK, given
  the owner liked "boundaries only"?

## Data fixes found by the by-election research (`docs/research/by-elections/`)
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
