# Prompts for Claude Code cloud sessions (Phase 1)

Paste one prompt per session at claude.ai/code. Use repo `Madawar/ke-elections` and the
"Elections App" environment.

Git flow: every session starts from `develop` and creates its own `feature/<slug>` branch. When
it's done, it pushes the branch and opens a PR into `develop`. Merge each PR before running the
next prompt, because each task builds on the last. Sessions don't share memory, so
each prompt points at the files that carry state:
- `CLAUDE.md`
- The plan
- `docs/superpowers/plans/2026-11-26-phase-1-progress.md`

Run the prompts in order, one at a time, and let each one finish and push before starting the
next.

---

## 0. Verify the cloud environment (run first)

```
Repo ke-elections. Read CLAUDE.md and docs/superpowers/plans/2026-11-26-phase-1-progress.md first.

1. git fetch origin && git checkout develop && git pull --ff-only, then
   git checkout -b feature/cloud-env-check
2. The SessionStart hook should already have run session-start.sh at startup; look for
   [session-start] lines. If it didn't, run:
   CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh
   It installs composer/npm deps, writes .env (DB_HOST=127.0.0.1), starts MySQL, creates the
   electoral_map and testing databases, migrates, and builds assets. It can take several
   minutes. Run it in the background and wait for it rather than letting a 2-minute timeout
   kill it.
3. Run php artisan test and npm run test:js.
4. If anything fails because of the environment (a missing PHP extension, MySQL auth, a blocked
   domain, a timeout), fix scripts/cloud/session-start.sh or docs/cloud-setup.md. Don't change
   app code.
   - For something only the environment's setup script can fix, put the exact change in
     docs/cloud-setup.md under "Not verified yet", and tell me to paste it into the environment
     settings.
   - For a blocked domain, give me the exact domain to allow.
5. Commit any fix as "chore(cloud): …", push feature/cloud-env-check and open a PR into
   develop. If nothing needed fixing, don't push and don't open a PR.
6. Report: PHP and MySQL versions, each [session-start] line, test pass/fail counts, any blocked
   domains, and a verdict of READY or NOT READY.
```

## 1. Task 4b: evidence-based ward corrections

```
Repo ke-elections. Git flow: git fetch origin && git checkout develop && git pull --ff-only, then
git checkout -b feature/ward-corrections. Never commit to main or develop.
- Read CLAUDE.md and docs/superpowers/plans/2026-11-26-phase-1-progress.md.
- In docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md, read "Global Constraints"
  and "Task 4b: Evidence-based ward corrections". That task text is your requirements.
- Read docs/boundary-quality-report.md and boundaries/build-report.md for background.

Setup: if no [session-start] lines appeared at startup, run
CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh and wait for it.
Then run npm run boundaries:fetch. The raw sources are not in git.
- The fetch needs codeload.github.com and data.humdata.org.
- If they're blocked, stop and tell me which domain to allow.

Process:
- If the superpowers skills are available, use superpowers:test-driven-development, and when
  done, superpowers:requesting-code-review.
- Otherwise: write the failing tests first and run them (RED), implement, then run them (GREEN).
  Then spawn one fresh general-purpose subagent to review the diff against the task text, and
  fix its Critical and Important findings.

Rules:
- Join on IEBC codes only. Names are used only to gather evidence, never to join app data.
- Replace a ward's polygon only when two independent signals agree, per the task text.
- List every replacement and every still-uncertain ward in boundaries/build-report.md.
- Check the Mandera wards 211–217 as a group. The Task 4 review suspects a code shift that also
  changes the outlines of the Mandera East and Lafey constituencies.
- Rebuild with npm run boundaries:build. npm run test:js must pass, and the size budgets and
  nesting must hold.

Commit "fix(boundaries): evidence-based ward corrections from Red Cross and polling stations"
then push feature/ward-corrections and open a PR into develop.

Update the Task 4b row in docs/superpowers/plans/2026-11-26-phase-1-progress.md with the
commits and outcome, then commit and push that too.

Report: the replacements made (codes, names and evidence), the wards still uncertain, test
results, and output sizes.
```

## 2. Task 5: towns layer and self-hosted label glyphs

```
Repo ke-elections. Git flow: git fetch origin && git checkout develop && git pull --ff-only, then
git checkout -b feature/towns-glyphs. Never commit to main or develop.
- Read CLAUDE.md and docs/superpowers/plans/2026-11-26-phase-1-progress.md.
- Your requirements are "Global Constraints" and "Task 5" in
  docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md.
- The labels must support the owner's zoom, label and division requirements in that plan's
  Global Constraints.

Setup:
- Run session-start.sh as in CLAUDE.md, then npm run boundaries:fetch.
- The fetch needs overpass-api.de and raw.githubusercontent.com. If either is blocked, stop and
  name the domain.

Process:
- Write the failing tests first and run them (RED), implement, then run them (GREEN).
- Then get one fresh subagent review against the task text, and fix its Critical and Important
  findings.

Commit with the plan's commit message, push feature/towns-glyphs and open a PR into develop. Update the progress note
row for Task 5.
```

## 3. Task 6: unit directory, routes and server-rendered meta tags

```
Repo ke-elections. Git flow: git fetch origin && git checkout develop && git pull --ff-only, then
git checkout -b feature/unit-routes. Never commit to main or develop.
- Read CLAUDE.md and docs/superpowers/plans/2026-11-26-phase-1-progress.md.
- Your requirements are "Global Constraints" and "Task 6" in
  docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md.
- Also fix the parked Task 1 minor: raise composer.json php to ^8.4.

Setup: run session-start.sh and wait for it. You need PHP 8.4 and MySQL; public/boundaries/ is
already committed.

Process:
- Pest tests first (RED), implement, then run them (GREEN).
- php artisan test and npm run test:js must both pass.
- Then get one fresh subagent review against the task text, and fix its Critical and Important
  findings.

Commit with the plan's commit message, push feature/unit-routes and open a PR into develop. Update the progress note row for Task 6.
```

## 4. Continue the rest of Phase 1 (6b to 11)

```
Repo ke-elections. Git flow: git fetch origin && git checkout develop && git pull --ff-only, then
git checkout -b feature/phase-1-ui. Never commit to main or develop.
- Read CLAUDE.md, docs/superpowers/plans/2026-11-26-phase-1-progress.md and the whole of
  docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md, including Global Constraints,
  the visual direction, the "no AI look" rules, and the zoom, label and division requirements.
- Start with the first task not marked complete in the progress note. Do the tasks in order,
  one at a time.

Setup: run session-start.sh and wait for it.

Process for each task:
- If superpowers skills are available, use superpowers:subagent-driven-development.
- Otherwise:
  - Implement with failing tests first (RED), then make them pass (GREEN).
  - Spawn one fresh subagent to review the task's diff against the task text.
  - Fix its Critical and Important findings.
  - Commit with the plan's message.
  - Update the task's row in the progress note.
  - Push feature/phase-1-ui.

Task 6b:
- Mockups: https://claude.ai/artifact/FQP7fsRPSAr7SgiWiE9BTx
- Direction A "Ballot box", with B "Tally night" as dark mode. The values are in the progress
  note.

Task 11:
- Run the browser check at 390×844 and on desktop.
- Then open a PR from feature/phase-1-ui into develop.
- Never commit to main or develop, and never merge.

Stop and tell me if a task needs a decision only I can make.
```

---

## Leaders branch (v0.3.0): map-controls plan, Tasks 5 and 6

```
Repo Madawar/ke-elections, environment "Elections App". Build Tasks 5 and 6 of the map-controls
plan on the existing branch feature/leaders. Don't merge into develop or main, don't tag, and
don't release: push the branch only. The release is done afterwards from another session.

Setup
1. git fetch origin && git checkout feature/leaders && git pull --ff-only.
   The branch is develop at v0.2.0 plus roadmap notes.
2. If no [session-start] lines appeared at startup, run
   CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh
   in the background and wait for it. Then run php artisan db:seed --force.
   Check: php artisan test and npm run test:js both pass before you change anything.

Read first. These carry all the state; you have no other memory.
- CLAUDE.md. Its rules are non-negotiable:
  - IEBC codes, never names.
  - Never invent office holders.
  - Neutral: every number shows its source and "as of" date.
  - No AI-looking UI.
  - IEBC ballot colours, Archivo type.
- docs/superpowers/plans/2026-11-27-map-controls.md. Tasks 1–4 are already shipped (v0.2.0).
  Your requirements are:
  - "Global Constraints" and "Review Focus"
  - "Task 5: County leadership card, and the striped "County seats" map view"
  - "Task 6: MP outlines over MCA wards"
  - "Additions from the owner on 2026-11-27 (binding on Tasks 5 and 6)"
  - "Additions to Task 5's export cards"
  - "Addition to Task 5: the "Leaders here" strip in the legend box"
  When two sections disagree, the later owner addition wins.
- docs/superpowers/plans/roadmap.md, the "Parked minor findings" section. Fix one only if you are
  already editing that code.
- Existing code to reuse, not duplicate:
  - Seat-mode rule: resources/js/lib/map/seatMode.ts, and chooseMode/selectUnit in Map.vue.
  - Legend counts: lib/legend.ts buildLegend and lib/seats.ts legendScope.
  - Export system: lib/export/* (viewLayout sizes and story safe zones, ViewCard,
    ShareViewDialog, shareView.ts, caption.ts).
  - Party profile: lib/party.ts.
  - History: lib/map/history.ts.

Order of work, committing and pushing after each step:
- Task 5a: resources/js/lib/leaders.ts with leadersFor(unit, seats), plus tests. Then use it in
  three places, so the list is built once:
  - the panel's "Who represents <unit>" section
  - the legend box's "Leaders here" strip
  - the leaders strip on MCA cards
- Task 5b:
  - Bigger card maps: about 15% on all cards, about 25% on MCA cards.
  - The "Leaders of <unit>" and "County leaders in <county>" cards in all four sizes.
- Task 5c: the striped "County seats" chip and map mode. Use fill-pattern images generated at
  runtime, in fixed stripe order Governor, Senator, Woman Rep. Add its legend.
- Task 6:
  - MP party-colour outlines over MCA ward fills, from constituency zoom down.
  - "MP: <ABBREV>" badges.
  - A two-section legend.
  - The MP block on constituency MCA cards.
  - MCA names as a second ward-label line, only where they fit. If they look cluttered in
    Nairobi, fall back to showing names on the selected ward only, and say so.

How to work
- TDD: write the failing test, see it fail, then make it pass.
- If the superpowers plugin is available, use superpowers:subagent-driven-development:
  - An implementer and a task reviewer for each task.
  - A final whole-branch review on the most capable model.
  Otherwise, implement each task yourself, then dispatch one fresh review subagent per task. Give
  it the requirement sections, the diff and the screenshots, and fix its Critical and Important
  findings.
- When something is ambiguous, decide and keep going. Log each decision in
  docs/superpowers/plans/2026-11-27-leaders-progress.md as
  "Ruling: <what> — <why> — <cost if wrong>".
- Keep that same file as a running log, so a later session can resume:
  - which tasks are done, with their commits
  - parked minor findings
  - what's next
- After each task, run the checks: php artisan test, npm run test:js, npm run types:check,
  npm run build. Run the full JS suite against a fresh build. Known flake: colourSync and
  partyPage tests can time out under parallel load, so re-run once before investigating.

Visual checks (important, the owner judges by eye)
- Try npx -y playwright@1.65.1 install --with-deps chromium, then screenshot http://127.0.0.1:8000
  (run php artisan serve). Check 390×844 and 1440×900, light and dark, at these places:
  - Mathare focused in MCA view, and the ward Ngei
  - Nairobi City
  - Kilifi
  - the national "County seats" view
  - county leaders cards (square and story)
  - a constituency MCA card
- Look at every screenshot and fix what's wrong. Don't commit screenshots.
- If the browser download is blocked, skip visuals, say so, and list the exact places to check.

Finish
- Push feature/leaders.
- Report:
  - what was built, per task, with commits
  - test counts
  - every Ruling you made, with its cost if wrong
  - parked minors
  - whether visuals were checked
  - what's left
```
