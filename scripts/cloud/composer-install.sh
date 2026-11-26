#!/bin/bash
# composer install for cloud sessions, where the GitHub proxy refuses api.github.com and
# codeload.github.com downloads for repos outside the session's scope (HTTP 403) but allows
# public git clones. Packages with a git source are installed from source; dist-only packages
# (phpstan/phpstan) are zipped from a git clone of the locked commit and installed from a
# patched copy of the lock file (composer.cloud.json / composer.cloud.lock, gitignored).
set -euo pipefail
cd "$(dirname "$0")/../.."

export COMPOSER_ALLOW_SUPERUSER=1 GIT_TERMINAL_PROMPT=0 COMPOSER_MAX_PARALLEL_HTTP=4
cache="${XDG_CACHE_HOME:-$HOME/.cache}/ke-elections/dist"
mkdir -p "$cache"

php -r '
$lock = json_decode(file_get_contents("composer.lock"), true);
$cache = $argv[1];
foreach (["packages", "packages-dev"] as $group) {
    foreach ($lock[$group] ?? [] as $i => $p) {
        $url = $p["dist"]["url"] ?? "";
        if (isset($p["source"]) || !preg_match("#^https://api\.github\.com/repos/([^/]+/[^/]+)/zipball/([0-9a-f]{40})$#", $url, $m)) continue;
        [$all, $repo, $ref] = $m;
        $zip = "$cache/" . str_replace("/", "-", $repo) . "-$ref.zip";
        if (!is_file($zip)) {
            $dir = "$cache/clone-" . str_replace("/", "-", $repo);
            passthru("rm -rf " . escapeshellarg($dir));
            passthru(sprintf("git init -q %1\$s && git -C %1\$s fetch -q --depth 1 https://github.com/%2\$s.git %3\$s && git -C %1\$s archive --format=zip --prefix=pkg/ -o %4\$s %3\$s", escapeshellarg($dir), $repo, $ref, escapeshellarg($zip)), $rc);
            passthru("rm -rf " . escapeshellarg($dir));
            if ($rc !== 0) { fwrite(STDERR, "could not fetch $repo@$ref\n"); exit(1); }
        }
        $lock[$group][$i]["dist"]["url"] = "file://" . $zip;
        fwrite(STDERR, "[composer-install] {$p["name"]}: dist from git ($ref)\n");
    }
}
file_put_contents("composer.cloud.lock", json_encode($lock, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
' "$cache"
cp composer.json composer.cloud.json
COMPOSER=composer.cloud.json composer install --no-interaction --prefer-source --no-progress
