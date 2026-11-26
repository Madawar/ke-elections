# Running ke-elections in Claude Code cloud sessions

Claude Code on the web (claude.ai/code) runs each session on a fresh Ubuntu 24.04 machine
with a clone of this repo. That machine has PHP 8.3, Node 22, Composer and Docker, but no
MySQL. Our app needs PHP 8.4 and MySQL, so this repo sets up both pieces it can:

| Piece | Where it lives | When it runs |
|---|---|---|
| Machine setup (PHP 8.4, MySQL server) | `scripts/cloud/environment-setup.sh`, pasted into the environment settings | Once, then cached |
| Session setup (packages, `.env`, start MySQL, databases, build) | `scripts/cloud/session-start.sh`, run by the SessionStart hook in `.claude/settings.json` | Every session start or resume; only when `CLAUDE_CODE_REMOTE=true` |

The hook does nothing on your own machine, where Sail is used instead.

## One-time setup at claude.ai/code

1. Open claude.ai/code, connect the GitHub repo `Madawar/ke-elections`, and create (or edit)
   its environment.
2. **Setup script**: paste the whole of `scripts/cloud/environment-setup.sh`.
3. **Network access**: see the next section.
4. **Environment variables**: none are needed. The session script writes `.env` from
   `.env.example`. Never put secrets in environment variables, because everyone who uses the
   environment can read them.
5. Start a session and ask Claude to run `php artisan test && npm run test:js`. The first run
   is slower while the setup script result is cached.

## Network access

Choose **Limited** with **Allow package managers** turned on. That default allowlist already
covers what installs need: npm, Packagist, Ubuntu archives, `ppa.launchpad.net`, Docker Hub
and GitHub.

If your environment lets you add allowed domains, add these. If it doesn't, use **Full**
access instead.

| Domain | Needed for |
|---|---|
| `api.launchpad.net`, `keyserver.ubuntu.com` | Signing key for the PHP 8.4 PPA in the setup script |
| `fonts.bunny.net` | Starter-kit fonts pulled during `npm run build` |
| `codeload.github.com` | Boundary source download (`boundaries/scripts/fetch_sources.sh`) |
| `data.humdata.org` | Red Cross ward layer (boundary rebuilds only) |
| `overpass-api.de` | OpenStreetMap towns layer (boundary rebuilds only) |
| `raw.githubusercontent.com` | Self-hosted label glyphs (`boundaries/scripts/fetch_glyphs.sh`) |
| `www.iebc.or.ke`, `orpp.or.ke` | Re-downloading gazette notices and the party register (data work only) |

Everyday coding and tests need only the first two rows. The rest matter only when a session
rebuilds boundaries or refreshes reference data.

## Limits worth knowing
- Machines have about 4 vCPU, 16 GB RAM and 30 GB disk. Idle sessions pause, and background
  processes (MySQL) stop. The hook restarts MySQL on resume.
- Commands time out after 2 minutes by default. The hook itself is allowed 10 minutes.
- Cloud MySQL is Ubuntu's 8.0 package; local Sail and CI use 8.4. Keep migrations to features
  both versions support.

## Not verified yet
These come from the docs or from reasoning, and haven't been confirmed on a real cloud
session:
- Whether the PPA key fetch works under Limited access without the extra domains.
- Whether the Docker daemon is running at session start. The scripts don't depend on it.
- Whether a dev server port can be opened from a browser.

Docs: https://code.claude.com/docs/en/cloud-environments.md and
https://code.claude.com/docs/en/claude-code-on-the-web.md
