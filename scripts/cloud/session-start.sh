#!/bin/bash
# SessionStart hook (see .claude/settings.json). Does nothing outside Claude Code
# cloud sessions; there, it gets the app ready to test without Docker/Sail:
# installs dependencies, writes .env, starts MySQL and creates the databases.
# Safe to run more than once.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

log() { echo "[session-start] $*"; }

# .env: same values as Sail, but MySQL runs locally instead of in a container.
if [ ! -f .env ]; then
  cp .env.example .env
  log "created .env from .env.example"
fi
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env

# MySQL: background services are not cached between sessions, so start it each time.
if command -v mysqld >/dev/null 2>&1; then
  (service mysql start || mysqld_safe --daemonize) >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do mysqladmin ping --silent 2>/dev/null && break; sleep 1; done
  MYSQL_ROOT="mysql -uroot"; [ "$(id -u)" = 0 ] || MYSQL_ROOT="sudo mysql -uroot"
  $MYSQL_ROOT <<'SQL'
CREATE DATABASE IF NOT EXISTS electoral_map;
CREATE DATABASE IF NOT EXISTS testing;
CREATE USER IF NOT EXISTS 'sail'@'127.0.0.1' IDENTIFIED BY 'password';
CREATE USER IF NOT EXISTS 'sail'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON electoral_map.* TO 'sail'@'127.0.0.1', 'sail'@'localhost';
GRANT ALL PRIVILEGES ON testing.* TO 'sail'@'127.0.0.1', 'sail'@'localhost';
FLUSH PRIVILEGES;
SQL
  log "MySQL ready (databases electoral_map, testing)"
else
  log "mysqld not found: paste scripts/cloud/environment-setup.sh into the environment's setup script"
fi

composer install --no-interaction --prefer-dist --no-progress
npm ci --no-audit --no-fund

grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
php artisan migrate --force --no-interaction

# PHP feature tests render the Vite manifest, so build assets once per session.
npm run build >/dev/null
log "ready: php artisan test, npm run test:js"
