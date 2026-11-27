# Changelog

## 0.1.1, 27 November 2026

- **Fix:** the map stayed blank on servers that send `.mjs` files with the wrong type. MapLibre's
  worker is now built as a `.js` file.

## 0.1.0, 27 November 2026

The first public release of Kenya Electoral Map: a neutral, phone-first map of Kenya's 47 counties,
290 constituencies and 1,450 wards, with the people who hold each elected seat now.

### Map
- **Boundaries:** IEBC 2012 delimitation, with codes from Kenya Gazette Notice 13771 (2026).
  Thirteen ward polygons come from the American Red Cross (HDX). Former provinces and towns from
  OpenStreetMap are also shown.
- **Colour views:** the map can be coloured by Governor, Senator, Woman Rep, MP or MCA, using the
  IEBC ballot colours for each seat. Borders stay readable in every colour view.
- **Focus mode:** selecting a county, constituency or ward shows only that area, with an option to
  show the surroundings. Zooming out steps up one level at a time.
- **Search:** find a place or a politician by name.
- **Legend:** bar charts with percentages for the selected area, and a party highlight that can
  pick several parties at once.

### Data
- **Office holders:** everyone elected in 2022, updated for by-elections and other changes since,
  up to 16 July 2026. Each holder carries their source: IEBC gazette notices and parliament.go.ke,
  with news reports where those are cited.
- **Independents:** shown as their own group everywhere.

### Sharing
- **Share this view:** images in square, portrait, story and X sizes, each with a caption, the
  source, the "as of" date and a link back to the same view.

### Installing
- **Phone app:** the site installs as an app on phones, and the boundary files are cached for
  offline use.
