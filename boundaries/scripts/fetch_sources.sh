#!/usr/bin/env bash
# Download the raw boundary sources into boundaries/raw/ (gitignored).
# Each source goes in its own directory; nothing in them is executed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw && cd raw

fetch() { # url dest
  [ -s "$2" ] || curl -fSL --retry 5 --http1.1 -o "$2" "$1"
}

# 1. IEBC 2012 delimitation, scraped from vote.iebc.or.ke in 2013 (github.com/mikelmaron/kenya-election-data)
mkdir -p mikelmaron
fetch https://codeload.github.com/mikelmaron/kenya-election-data/tar.gz/refs/heads/master mikelmaron.tar.gz
[ -f mikelmaron/data/counties.geojson ] || tar -xzf mikelmaron.tar.gz -C mikelmaron --strip-components=1 \
  kenya-election-data-master/data kenya-election-data-master/README.md

# 2. HDX "Administrative Wards in Kenya 1450" (American Red Cross, CC BY 4.0)
mkdir -p hdx_arc_wards
fetch "https://data.humdata.org/dataset/e8d06ae7-740b-4491-8749-43f81700cf41/resource/858129b2-7197-4ffe-b34f-c2091b307b2c/download/kenya_wards.zip" hdx_arc_wards/kenya_wards.zip
unzip -oq hdx_arc_wards/kenya_wards.zip -d hdx_arc_wards/kenya_wards

# 3. HDX "Kenya Admin Boundaries - Election" (IEBC copy; used for cross-checking only)
mkdir -p hdx_iebc
for f in counties:0d7c191e-35b4-42cd-9df6-bb3b9add3467 constituencies:8c78dafe-f9f4-4dd3-b6be-a4e57ea7ac22; do
  name=${f%%:*}; id=${f##*:}
  fetch "https://data.humdata.org/dataset/4da920dc-c1dc-4889-b06c-66ecb65e2b94/resource/$id/download/$name.zip" "hdx_iebc/$name.zip"
  unzip -oq "hdx_iebc/$name.zip" -d "hdx_iebc/$name"
done
echo "sources ready in $(pwd)"
