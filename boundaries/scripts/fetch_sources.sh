#!/usr/bin/env bash
# Download the raw boundary sources into boundaries/raw/ (gitignored).
# Each source goes in its own directory; nothing in them is executed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw && cd raw

fetch() { # url dest
  [ -s "$2" ] || curl -fSL --retry 5 --http1.1 -o "$2" "$1"
}

# 1. IEBC 2012 delimitation, scraped from vote.iebc.or.ke in 2013 (github.com/mikelmaron/kenya-election-data).
#    data/ holds the boundaries; output/pollingstations.shp the 2013 polling stations (Task 4b evidence).
#    Cloud sessions get HTTP 403 from codeload.github.com, so fall back to a shallow git clone.
if [ ! -f mikelmaron/data/wards.geojson ] || [ ! -f mikelmaron/output/pollingstations.shp ]; then
  rm -rf mikelmaron
  if curl -fsSL --retry 3 --http1.1 -o mikelmaron.tar.gz https://codeload.github.com/mikelmaron/kenya-election-data/tar.gz/refs/heads/master; then
    mkdir -p mikelmaron && tar -xzf mikelmaron.tar.gz -C mikelmaron --strip-components=1 \
      kenya-election-data-master/data kenya-election-data-master/output kenya-election-data-master/README.md
  else
    rm -f mikelmaron.tar.gz
    git -c http.version=HTTP/1.1 clone -q --depth 1 https://github.com/mikelmaron/kenya-election-data.git mikelmaron
    rm -rf mikelmaron/.git
  fi
fi

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

# 4. OSM populated places (HOT export on HDX, ODbL); Overpass resets connections from cloud sessions.
mkdir -p osm
fetch https://production-raw-data-api.s3.amazonaws.com/ISO3/KEN/populated_places/hotosm_ken_populated_places_osm_geojson.zip osm/hotosm_ken_populated_places_osm_geojson.zip
unzip -oq osm/hotosm_ken_populated_places_osm_geojson.zip -d osm/places

echo "sources ready in $(pwd)"
