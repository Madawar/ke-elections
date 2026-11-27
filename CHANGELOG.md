# Changelog

## 0.3.0, 27 November 2026

### Who represents a place
- **"Who represents" in the panel:** a ward lists its MCA, its MP, then the county's Governor,
  Senator and Woman Rep; a constituency starts at its MP; a county shows its three. Seats held
  above the place say where, such as "Nairobi City, county-wide".
- **MCAs of a constituency:** one line of party counts that opens the list of wards. A name takes
  you to its ward, and each one links to its source.
- **"Leaders here" in the legend:** the same people, at the top of the legend box. It follows the
  place you are looking at and folds to one line. A name points at that person in the panel.
- **No approved holder:** the seat keeps its row and says "No approved data yet".

### County seats
- **A seventh chip, "County seats":** every county is striped by the parties of its Governor,
  Senator and Woman Rep, always in that order. One party for all three gives a solid fill.
- **Its legend** counts the county seats each party holds across all three, and tapping a party
  fades the other parties' stripes.

### MPs and MCAs together
- **MP outlines:** in the MCA view each constituency is outlined in its MP's party colour, over the
  ward colours, with "MP: ODM" under the constituency's name.
- **Two lists in the legend:** "MPs (outline)" and "MCAs (fill)", each with its own counts and its
  own highlight.
- **"Show MPs as outlines"** in Map settings turns the outlines off.
- **MCA names on the map:** the selected ward's label names its MCA, and so does the tooltip of a
  ward under the pointer.

### Sharing
- **Leaders cards:** "County leaders in <county>" with the striped map, and "Leaders of <place>"
  for a constituency or a ward, in all four sizes. Use "Share leaders" in the panel, or the "Card"
  choice in the share dialog.
- **Leaders on MCA cards:** a county's or constituency's MCA card names the Governor, Senator and
  Woman Rep, and a constituency's starts with its MP. A county's card counts its MPs by party.
- **Bigger maps:** about a quarter bigger on MCA cards for a county or a constituency and about
  15% on the other "Share this view" cards, where the card has the room. Long lists shorten to
  "and N more". A small urban constituency now fills its space on the card.

### Fixes
- **Seat chips at 1280 to 1535px wide:** they sit under the search bar, so none scrolls out of
  view.
- **Legend:** it no longer runs under the chips and the Back button, and its source line names
  every source behind what the box shows.

## 0.2.0, 27 November 2026

### Map controls
- **Seat chips:** None, Governor, Senator, Woman Rep, MP and MCA sit on the map, under the search
  bar on phones and beside it on desktop.
- **Seat view follows the level:**
  - Inside a constituency the map switches to MCA, so its wards are coloured.
  - The county-wide seats (Governor, Senator, Woman Rep) show as "County-wide", and tapping one
    takes you back to the county.
- **One tap per level:** each tap goes one level deeper, from county to constituency to ward,
  whatever the zoom.
- **Back:**
  - A Back button that names where it goes.
  - The browser and phone back gesture step out one level. Back from all of Kenya leaves the site.
- **Outside taps:**
  - A tap outside the selected area does nothing, and a short hint offers "Back" or "Show
    surroundings".
  - With surroundings shown, a tap picks the neighbouring area.

### Parties
- **Party profiles:** open one from the legend, a seat or search. It shows the Governor, Senator,
  Woman Rep, MP and MCA seats held, for all of Kenya or for the county or constituency you are in.
  Each seat has a "Show on map" button.
- **Party card:** a shareable card in four sizes. Each party has its own link, such as `/party/uda`.

### Help
- **First-visit tour:** six steps covering search, tapping the map, seat chips, the legend, your
  location and sharing.
- **One-time tips** at the moment they help.
- **"How to use this map"** in About.

### Fixes
- **Bottom sheet:** the List, About and Done buttons in its header now respond to taps on phones,
  and a click on its handle resizes the sheet.
- **Saved seat view:** your choice is only remembered when you make it yourself.

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
