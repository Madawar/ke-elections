# Kenya Electoral Map (ke-elections)

A neutral, public, phone-first map of Kenya's 47 counties, 290 constituencies and 1,450 wards,
with verified party-nomination tracking for the August 2027 general election.

- Design: `docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`
- Current plan (Phase 1): `docs/superpowers/plans/2026-11-26-phase-1-boundaries-and-map.md`
- Boundary data findings: `docs/boundary-quality-report.md`
- Cloud sessions: `docs/cloud-setup.md`

## Stack
Laravel 13 (PHP 8.4), MySQL 8.4, Filament 5 (admin only), Inertia 3 + Vue 3.5 + TypeScript,
Tailwind 4, shadcn-vue/Reka UI, MapLibre GL JS 6, vite-plugin-pwa. Boundary pipeline in Node
(`boundaries/pipeline/*.mjs`, mapshaper). Tests: Pest (PHP, against MySQL `testing`) and
Vitest (`tests/js/**`).

## Setup
First run on a machine with Docker (from the repo root):
```bash
docker run --rm -v "$PWD":/app -w /app composer:2 composer install --ignore-platform-reqs
cp -n .env.example .env
./vendor/bin/sail up -d
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan migrate:fresh --seed   # units, parties and every 2022 office holder, via data:import
./vendor/bin/sail npm ci
./vendor/bin/sail npm run build
```
Then open http://localhost:8080. After pulling, rerun what changed: `sail composer install` (composer.lock),
`sail npm ci` (package-lock.json), `sail npm run build` (any frontend change; `public/build` is
not committed) and `sail artisan migrate:fresh --seed` (migrations or `data/sources/`).
`public/boundaries/` is committed, so the map needs no boundary rebuild.

Rebuilding boundaries: `npm run boundaries:fetch`, then `npm run boundaries:rebuild` (build, towns,
stations, in that order), then `npm run build`. The service worker precaches `public/boundaries/`
at build time, so a boundary change only reaches installed apps after a fresh `npm run build`.

Cloud sessions: the SessionStart hook runs `scripts/cloud/session-start.sh` (deps, `.env`, MySQL,
migrations, build). Seed with `php artisan db:seed --force`, then `php artisan serve` for a local
server. See `docs/cloud-setup.md`.

## Commands
Local (Docker):
- `./vendor/bin/sail up -d` — app at http://localhost:8080
- `./vendor/bin/sail npm run build` then `./vendor/bin/sail artisan test` and `./vendor/bin/sail npm run test:js`
- `npm run boundaries:fetch` / `npm run boundaries:build` — rebuild `public/boundaries/` from raw sources

Cloud session (no Docker; `scripts/cloud/session-start.sh` has already installed deps,
started MySQL and built assets): `php artisan test`, `npm run test:js`.

Data: `php artisan data:import {parties|holders|nominations} <file.csv> [--dry-run]`; formats and
rules in `docs/data-import.md`, sources in `data/sources/README.md`.

## Rules that are not negotiable
- Join everything on IEBC codes (county 1–47, constituency 1–290, ward 1–1450), never on names.
  Names and parent codes come only from `data/reference/iebc_wards_2027_gn13771.csv`.
- Never invent real office holders or nominees. Sample data is labelled as sample everywhere,
  including image exports. Real data only via validated CSV import from cited sources.
- Geometry lives in static files under `public/boundaries/`, never in the database.
- Neutral: no party branding in the UI; every number shows its source and an "as of" date.
- The UI must not look AI-generated: no gradients/glows/emoji/sparkles, no identical
  soft-shadow cards, no ALL-CAPS eyebrows, no "A · B · C" meta strings, no "→" on links.
  Visual direction "Ballot box": seat colours are the IEBC ballot colours (Governor blue,
  Senator yellow, Woman Rep purple, MP green, MCA beige), Archivo type.
- Git flow: `main` = releases, `develop` = integration (default branch), work on `feature/*`
  and open PRs into `develop`. Never commit to `main` or `develop` directly.
- `boundaries/raw/` is downloaded data (gitignored); fetch it with `boundaries/scripts/fetch_sources.sh`.

## Project memory
Durable decisions and context are kept in `.claude/memory/` (also linked as this project's
Claude Code memory on the owner's machine):

@.claude/memory/MEMORY.md
@.claude/memory/project-kenya-electoral-map.md
