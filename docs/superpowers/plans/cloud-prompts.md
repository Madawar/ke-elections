# Prompts for Claude Code cloud sessions (Phase 1)

Paste one prompt per session at claude.ai/code. Use repo `Madawar/ke-elections` and the
"Elections App" environment.

Every session works on `feature/phase-1-map` and pushes there. Sessions don't share memory, so
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

1. git fetch origin && git checkout feature/phase-1-map && git pull --ff-only
2. Run: CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh
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
5. Commit any fix as "chore(cloud): …" and push to feature/phase-1-map.
6. Report: PHP and MySQL versions, each [session-start] line, test pass/fail counts, any blocked
   domains, and a verdict of READY or NOT READY.
```

## 1. Task 4b: evidence-based ward corrections

```
Repo ke-elections, branch feature/phase-1-map (fetch, check it out, git pull --ff-only).
- Read CLAUDE.md and docs/superpowers/plans/2026-11-26-phase-1-progress.md.
- In docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md, read "Global Constraints"
  and "Task 4b: Evidence-based ward corrections". That task text is your requirements.
- Read docs/boundary-quality-report.md and boundaries/build-report.md for background.

Setup: CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD bash scripts/cloud/session-start.sh (wait
for it), then npm run boundaries:fetch. The raw sources are not in git.
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
and push to feature/phase-1-map.

Update the Task 4b row in docs/superpowers/plans/2026-11-26-phase-1-progress.md with the
commits and outcome, then commit and push that too.

Report: the replacements made (codes, names and evidence), the wards still uncertain, test
results, and output sizes.
```

## 2. Task 5: towns layer and self-hosted label glyphs

```
Repo ke-elections, branch feature/phase-1-map (fetch, check it out, git pull --ff-only).
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

Commit with the plan's commit message and push to feature/phase-1-map. Update the progress note
row for Task 5.
```

## 3. Task 6: unit directory, routes and server-rendered meta tags

```
Repo ke-elections, branch feature/phase-1-map (fetch, check it out, git pull --ff-only).
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

Commit with the plan's commit message and push. Update the progress note row for Task 6.
```

## 4. Continue the rest of Phase 1 (6b to 11)

```
Repo ke-elections, branch feature/phase-1-map (fetch, check it out, git pull --ff-only).
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
  - Push.

Task 6b:
- Mockups: https://claude.ai/artifact/FQP7fsRPSAr7SgiWiE9BTx
- Direction A "Ballot box", with B "Tally night" as dark mode. The values are in the progress
  note.

Task 11:
- Run the browser check at 390×844 and on desktop.
- Then open a PR from feature/phase-1-map into develop.
- Never commit to main or develop, and never merge.

Stop and tell me if a task needs a decision only I can make.
```
