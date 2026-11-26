# Visual direction

Owner choice (2026-11-26): **A "Ballot box"** for light mode and **B "Tally night"** for dark.
Mockups: https://claude.ai/artifact/FQP7fsRPSAr7SgiWiE9BTx

Tokens live in `resources/js/lib/map/theme.ts` (the map needs literal colours) and are mirrored
as CSS custom properties in `resources/css/map-theme.css`. Components use the tokens, never
hard-coded colours or fonts.

| Token | Light | Dark |
|---|---|---|
| Ground (page, land) | `#EEF1EF` | `#0F2430` |
| Surface (panels) | `#FFFFFF` | `#16303F` |
| Ink | `#13233A` | `#E8EEF0` |
| Muted text | `#4C5B6B` | `#9DB0BA` |
| Hairlines | `#D5DCD8` | `#284555` |
| Selected outline | Ink | `#F2C230` |

Seat colours (IEBC ballot papers and box lids): Governor `#3E8FD0`, Senator `#F2C230`,
Woman Rep `#7A4FA0`, MP `#2E8B57`, MCA `#C8A97E`, President white. They appear as the thin
"ballot lid" strip on each seat row and on the seat chips: the one bold spend in the UI.

Party colours: an admin sets a display colour per party (`data/sources/party_colours.csv`).
Parties without one take the Okabe-Ito palette in order of seats held; everything past the
palette is grey "Other". Seats with no approved holder are a pale neutral, never a party colour.

Type: Archivo variable (width axis at 92 for UI, 100 for headings). Map labels use the
self-hosted Noto Sans glyphs (`public/glyphs/`).

Shape: 6px radius on controls, 12px on the sheet; one shadow for floating things (sheet,
popovers), none on rows. Motion: 180ms ease-out for the sheet; map camera eases at 600ms.

Map lines per level (width interpolates with zoom):

| Line | Colour | Width (zoom 5 → 12) | From zoom |
|---|---|---|---|
| Country outline | Ink | 1.6 → 3 | always |
| County | County line | 1 → 2.6 | always |
| Constituency | Constituency line | 0.4 → 1.6 | 6.3 (fades in) |
| Ward | Ward line | 0.3 → 1 | 8.8 (fades in) |
| Selected | Selected | 2.5 → 4 | always, on top |
