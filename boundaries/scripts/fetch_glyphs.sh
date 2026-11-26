#!/usr/bin/env bash
# Self-hosted MapLibre label glyphs (Noto Sans, SIL OFL) from protomaps/basemaps-assets.
set -euo pipefail
cd "$(dirname "$0")/../../public"
base=https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts
for font in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  mkdir -p "glyphs/$font"
  for range in 0-255 256-511 8192-8447; do
    out="glyphs/$font/$range.pbf"
    [ -s "$out" ] || curl -fsSL --retry 5 -o "$out" "$base/${font// /%20}/$range.pbf"
  done
done
echo "glyphs ready in $(pwd)/glyphs"
