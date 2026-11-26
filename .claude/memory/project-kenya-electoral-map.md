---
name: project-kenya-electoral-map
description: "Kenya Electoral Map project — phased build, superpowers workflow, public GitHub repo, PWA, MySQL"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f38e2e5-9da1-4339-9991-26ef9121ad29
  modified: 2026-11-26T11:21:54.826Z
---

Building "Kenya Electoral Map" (Laravel + MySQL + Filament + MapLibre, PWA) in 4 phases, stopping for user review after each. Repo: github.com/Madawar/ke-elections (public; git flow: main=releases, develop=integration/default branch, feature/* → PR into develop). An older copy Madawar/kenya-electoral-map holds the first commit; owner not yet asked about deleting it. Frontend: Vue + Inertia (Laravel Vue starter kit), visual direction A "Ballot box" (IEBC ballot-paper seat colours, Archivo), and the UI must not look AI-generated.

**Why:** user asked for phased review, the superpowers plugin workflow ("also use superpowers plugin for this"), MySQL, a PWA, and a public repo.

**How to apply:** use superpowers skills (brainstorming → writing-plans → TDD etc.); don't start a phase without approval; plan lives at docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md. Raw boundary downloads in boundaries/raw/ are gitignored; the mikelmaron git clone fails over HTTP/2, so fetch via the codeload tarball.
