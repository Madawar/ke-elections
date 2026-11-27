# Kenya Electoral Map: design

Status: approach agreed with the owner on 2026-11-26. Phase 1 is approved to build.

## What it is and who it's for
- A **neutral, public** web map of Kenya's 47 counties, 290 constituencies and 1,450 wards,
  for general use.
- It answers questions such as "how many MPs and MCAs does each party hold right now?" and,
  as 2027 approaches, "who is each party fielding where?"
- Later it will show *incoming vs outgoing* holders, comparing the 2022 holder with the 2027
  nominees and winners.
- Logged-in editors submit nominations, verifiers approve them, and the public sees only
  approved data.
- Private workspaces hold campaign regions, pins and notes.

**Neutrality** (anti-goals: looking partisan, or spreading wrong numbers):
- No party branding in the interface.
- Every party is treated the same in ordering, colour and copy.
- Every number shows its source and an "as of" date.
- Sample data is always watermarked, including in image exports.

## Decisions
| Area | Decision | Decided by |
|---|---|---|
| Backend | Laravel 13 (v13.44), PHP 8.4 or later, **MySQL 8.4**. Filament 5 for the admin panel. | Owner |
| Dev environment | **Laravel Sail** (Docker) with a MySQL service. Node and npm run inside the Sail container. | Owner |
| Front end | **Vue 3.5 + Inertia 3 + TypeScript**, using the Laravel Vue starter kit (Tailwind 4, shadcn-vue/Reka UI, Lucide icons) | Owner: Vue and Inertia; the kit is my call |
| Map | MapLibre GL JS 6.19 (ESM, WebGL2), loaded dynamically after first paint. No API keys. | Owner and me |
| PWA | Installable: manifest plus a Workbox service worker (vite-plugin-pwa). It precaches the app shell, boundaries and search index, uses stale-while-revalidate for the API, and shows an offline banner. | Owner |
| Boundaries | Static GeoJSON in the repo, built by a repeatable pipeline. See the "Boundaries" section. | Owner and me |
| Joins | Always on IEBC codes, never on names | Owner |
| Real people | Never invented. Sample data is clearly labelled, and real data comes in by CSV import validated against codes. | Owner |
| Social exports | PNG "cards" in social sizes, built in the browser. See the "Infographic exports" section. | Owner asked; design is mine |

**Front-end options rejected:**
- **Ionic Vue:** its own navigation stack conflicts with Inertia.
- **Quasar:** has its own CLI and build, which fight Laravel's Vite setup.
- **Vuetify and PrimeVue:** heavier and desktop-first.
- **Konsta:** an imitation of native iOS/Material look, with a smaller ecosystem.
- **Blade + Alpine** (my earlier pick): replaced at the owner's request.

## Boundaries
Source assessment is in `docs/boundary-quality-report.md`.
- **Base:** IEBC 2012 ward geometry from mikelmaron/kenya-election-data (`data/wards.geojson`).
- **Names and parent codes:** from Kenya Gazette Notice 13771 (Aug 2026), which is
  `data/reference/iebc_wards_2027_gn13771.csv`.
- **13 missing wards:** taken from the American Red Cross HDX layer (CC BY 4.0), using a
  reviewed crosswalk file of Red Cross ID → IEBC code. Each patch is erased from whatever IEBC
  polygon had swallowed it.
- **Upper layers:** constituencies, counties and the 8 former provinces are built by
  dissolving the cleaned, simplified wards, so every unit nests exactly inside its parent.
- **The build fails** if any code in 1–1450, 1–290, 1–47 or 1–8 is missing, duplicated, out of
  range or empty.
- **Build report:** every run writes `boundaries/build-report.md`.
- **Towns layer:** an OpenStreetMap `place=city|town` extract (ODbL), committed as GeoJSON.
- **Label fonts:** self-hosted glyphs (Noto Sans, OFL) from protomaps/basemaps-assets.
- **Basemap:** off by default. It can be switched to OpenFreeMap "positron", with attribution.

## Phone UI
- **Layout:**
  - A full-screen map with a search bar on top.
  - A non-modal bottom sheet (peek, half or full) that you drag by its handle. Above 768px it
    becomes a left side panel.
  - A legend chip, and one "Filters" sheet with an active-count badge.
- **Interaction:**
  - Tap selects a unit and drills down a level.
  - Hover tooltips appear only on devices that support hover (`(hover: hover)`).
  - Every unit has a deep link (`/county/47`, `/constituency/288`, `/ward/1438`).
  - Deep links are server-rendered with `<title>` and Open Graph tags, so WhatsApp previews
    work.
- **Accessibility:**
  - A list view (County → Constituency → Ward) is the accessible view and the no-WebGL2
    fallback.
  - The selected unit is announced in an `aria-live` region.
  - Touch targets are at least 44px.
- **Colour:**
  - A colour-blind-safe palette (Okabe-Ito) for categories, and everything else in grey as
    "Other".
  - Status and gaps are shown with hatching as well as colour.
  - Party display colours are set by an admin, because ORPP describes colours only in words.

## Infographic exports
- **How cards are made:**
  - Built in the browser, so nothing is installed on the server and it works offline.
  - An off-screen MapLibre map is rendered at the exact pixel size of the card, fitted to the
    unit, and captured on the map's `idle` event.
  - The card's layout is an SVG Vue component: title, breadcrumb, legend, stats and footer.
  - The map image is embedded in that SVG, then rasterised to a canvas and saved as PNG, with
    fonts embedded as data URIs.
  - The same SVG components (for example the seat hemicycle) are also used on screen.
- **Sizes:**

  | Format | Pixels |
  |---|---|
  | Square | 1080×1080 |
  | Portrait | 1080×1350 |
  | Story / WhatsApp status | 1080×1920 |
  | Landscape / link card | 1200×630 |

- **Sharing:** the user can download the PNG, or on phones use the Web Share API with
  `files` to send it straight to WhatsApp or X.
- **Every card's footer shows:**
  - The source.
  - "Approved data as of `<date>`".
  - The site URL and the unit's deep link.
  - Boundary attribution, plus OSM attribution when the basemap is on.
  - A diagonal "SAMPLE DATA" watermark whenever sample records are shown.
- **Which cards ship when:**

  | Phase | Cards |
  |---|---|
  | 1 | "Unit locator" card: where a unit is, its parents, its seats |
  | 2 | "In power now" card (seat hemicycle and party bars per seat type, national or per unit) and "Nominees for `<seat>`" card |
  | Later | "Incoming vs outgoing" card |

- **Later still:** per-unit Open Graph images generated on the server. Phase 1 uses one static
  Open Graph image.

## Data model (phases 2–4)
The brief's tables are kept, with these changes:
- **`office_holders` stores terms:** `started_on` and a nullable `ended_on`. "Current" means
  `ended_on IS NULL`. Keeping history is what makes the incoming/outgoing view possible.
- **`party_aliases`** records renames such as WDM-K → Wiper Patriotic Front, with an
  effective date.
- **`audits`** is append-only, storing the old and new JSON for every change. Rollback applies
  the inverse change, and the rollback is itself audited.
- **Units** are seeded from the gazette CSV. **Parties** are seeded from the ORPP register
  (107 parties as at October 2026).
- **In-power counts** are computed from current terms per seat type, plus nominated members.

## Admin data review table (Phase 2)

The owner asked for this on 2026-11-26. It is a Filament admin table where admins can check
every office holder and fix questionable records themselves.

- **Who's in it:** one row per seat holder:
  - 47 Governors, 47 Senators and 47 Woman Representatives.
  - 290 MPs and 1,450 MCAs.
  - Nominated MPs, Senators and MCAs.
  - Past terms are reachable through a filter.
- **Columns:**
  - The seat and the unit, shown as its code, name and parents (for example
    "Ward 1448 Ngei, Mathare, Nairobi City").
  - Holder name, party (with alias awareness) and in office since/until.
  - How they got the seat: elected, by-election or nominated.
  - Source: the gazette notice number and a link.
  - Review state and last edited by/at.
- **Finding records quickly:**
  - Search by name, unit or code.
  - Filter by seat, county, constituency, party, review state, "no source", "no holder" and
    "changed since import".
  - Sort any column.
  - Every filter is reflected in the URL, so a view can be shared.
- **Fixing records:**
  - Inline edit for the common fields, and a full edit form for the rest.
  - Bulk actions: mark verified, flag for review, and set the source.
  - Each row has a "flag as questionable" toggle with a note, and its own filter.
- **Data checks view**, shown as tabs with counts:
  - Seats with no current holder.
  - Holders without a source.
  - Parties not in the ORPP register.
  - More than one current holder for a seat.
  - Units whose codes don't exist.
  - Records changed by hand since import.
- **Import and export:**
  - CSV import with per-row validation against unit codes, previewed before saving.
  - CSV export of the filtered view.
- **Safety:**
  - Admin edits apply immediately but are always audited: old and new value, who, when and
    why. Any change can be rolled back.
  - That needs the audit log, which therefore moves forward from Phase 3 into Phase 2 for
    office holders.
  - Editors' changes still go through verification (Phase 3).
  - The public map shows only verified records, with their source and "as of" date.

## Party pages, candidate pages and nominations (when 2027 nominations open)

The owner asked for this on 2026-11-26. Build now in ways that make it easy later.

- **Party page** at `/party/<abbrev>`, for example `/party/uda`:
  - Name, renames and aliases, the 2022 coalition, and its ORPP registration with a source.
  - Seats held now per seat type, as bars with percentages.
  - Its **2027 nominations per seat**, listed by county → constituency → ward.
  - Each nomination shows its status (rumoured, announced, certificate issued, IEBC cleared) and
    its source.
  - **Gaps:** units where the party has no nominee for a chosen seat.
  - A map view highlighting where it holds seats and where it has nominees.
- **Candidate page** at `/candidate/<id>`:
  - Name exactly as in the source, party, seat and unit (with parents), nomination status and its
    history with dates.
  - Sources: links and uploaded documents.
  - Whether they're an incumbent, linked to their `office_holders` record if so.
  - Only approved data is shown publicly, and nothing is invented.
- **Unit pages and cards** list every party's nominee per seat, beside the current holder:
  "incoming vs outgoing".
- **Hooks to keep while building now:**
  - Legend party rows and party names in panels link to the party page once it exists.
  - People search covers approved nominees as well as holders, each with a status label, for
    example "UDA nominee for MP, Mathare (announced)".
  - Party highlight works for "parties with a nominee" as well as "parties holding the seat".
  - Share cards come in a "Nominees for <seat> in <unit>" form.
  - Everything joins on IEBC codes and party keys, never on names.
- **Signed-in public users** can follow a party or candidate and get updates when a nomination
  changes status.

## Phases (owner reviews after each)
1. **Boundary pipeline and map:**
   - Sail, the starter kit, the boundary pipeline and the map page.
   - Drill-down, hover/tap highlight, the panel, search, deep links, the list view, the PWA,
     and the locator export card.
2. **Database and public data:**
   - Migrations, seeders (units, parties, labelled sample holders and nominations) and CSV
     import with per-row errors.
   - A public API serving approved data only.
   - Filters, colour-by and the gaps view.
   - The "In power now" summary and card.
   - The admin data review table for office holders (see "Admin data review table"), with
     the audit log and rollback for those records.
3. **Accounts and approval:**
   - Roles, editors scoped to their counties, and the submit → verify workflow.
   - The audit log and rollback, in Filament.
4. **Workspaces:** campaign regions, pins and notes.

Later: the incoming/outgoing view, and server-side Open Graph images.

## Left to the builder
- Exact zoom thresholds, colours and spacing, within the limits set in the plan.
- Internal component breakdown.
