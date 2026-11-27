#!/bin/bash
# Claude Code cloud environment setup script for ke-elections.
#
# Paste this whole file into the "Setup script" box of the environment at
# claude.ai/code (Environment settings). It runs once as root on Ubuntu 24.04
# before Claude starts, and the result is cached. Keep it under ~5 minutes.
# It runs before the environment's variables are set, so nothing here reads them.
#
# What it adds to the default image (which has PHP 8.3, Node 22, Docker, no MySQL):
#   - PHP 8.4 with the extensions Laravel 13 needs (ondrej/php PPA)
#   - MySQL server (Ubuntu's package, 8.0; production/dev use 8.4 via Sail)
# Per-session work (composer/npm install, .env, starting MySQL) lives in
# scripts/cloud/session-start.sh, run by the SessionStart hook in .claude/settings.json.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq software-properties-common ca-certificates

add-apt-repository -y ppa:ondrej/php
apt-get update -qq
apt-get install -y -qq \
  php8.4-cli php8.4-mbstring php8.4-xml php8.4-curl php8.4-mysql php8.4-sqlite3 \
  php8.4-zip php8.4-bcmath php8.4-intl php8.4-gd php8.4-readline
update-alternatives --set php /usr/bin/php8.4

apt-get install -y -qq mysql-server

php -v | head -1
mysqld --version
