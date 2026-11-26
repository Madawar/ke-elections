# Boundary data quality report

Generated 2026-11-26 by `boundaries/scripts/recon/quality_report.py` and
`diagnose_wards.py`, from sources fetched by `boundaries/scripts/fetch_sources.sh`.
The reference list of codes is `data/reference/iebc_wards_2027_gn13771.csv`: all
1,450 wards with their codes and parent codes, extracted from Kenya Gazette Notice
13771 of 26 Aug 2026, the IEBC ward schedule for the 2027 elections.

## Are 2012-era boundaries still valid for 2027?

**Yes.** The constituency and ward boundaries in force today are still those of the 2012 IEBC
delimitation:

- In January 2026 IEBC deferred the next boundary review until after the August 2027
  election.
- The August 2026 gazette schedules for 2027 still list 290 constituencies and 1,450 wards.
- In those schedules, county codes run 1–47, constituency codes 1–290 and ward codes 1–1,450.
- The 2013 geometry carries the same codes as the 2026 gazette. Apart from 24 spelling
  differences, every code-to-name pair matches.

The *lines* are therefore still current. The real problem with the 2013 copy is that it was
scraped from IEBC with defects, described below.

## Sources assessed

| Source | What it is | Licence | Codes? |
|---|---|---|---|
| **A. mikelmaron/kenya-election-data** (2013) | IEBC 2012 boundaries scraped from `vote.iebc.or.ke` and `api.iebc.or.ke`, as GeoJSON | No licence file. The data is IEBC's, so attribute IEBC and the repo. | **Yes**: county, constituency and ward (`COUNTY_ASS`) |
| **B. HDX "Kenya Admin Boundaries – Election"** | The same IEBC 2012 shapefiles (counties, constituencies, wards) | HDX "Other" (legacy HR.info terms); source IEBC | Yes. Same lineage and same defects as A, so it adds nothing. |
| **C. HDX "Administrative Wards in Kenya 1450"** (American Red Cross, 2016) | 1,450 wards. Topology cleaned in more than 20 counties and checked with county teams. Built from NLC/IEBC/SoK data. | **CC BY 4.0** | **No.** It has only DHIS2 health-system IDs, 302 "sub-county" names, and ward names. |
| D. HDX "kenya-admin-level-3-wards" (FAO) | 1,425 wards with no projection file | CC BY | No IEBC codes. Rejected. |

## Findings: source A (IEBC 2012 lineage)

### Counties (48 features)
- All 47 codes are present, and every polygon is valid.
- One unlabelled sliver has code 0 (0.1 km², near Kisumu). It will be dropped and reported.
- 82 small overlaps between neighbouring counties total about 20 km². The largest is 1.2 km².
- Two names differ from the gazette ("NAIROBI" vs "Nairobi City", "ELEGEYO-MARAKWET").

### Constituencies (295 features)
- All 290 codes are present, plus 5 slivers coded 0.
- Constituency 148, Marakwet East, is tagged as county 24 (West Pokot). Both the gazette and
  its own wards say county 28.
- Three names differ from the gazette, including Mbita → Suba North, Suba → Suba South and a
  "WEBUTE WEST" typo.
- Topology: 329 overlaps totalling 49 km², and 831 gap slivers totalling 181 km².

### Wards (1,444 features with codes)
**13 ward codes have no polygon:**

| Code | Ward | Where it went in the IEBC data |
|---|---|---|
| 50 | Kasemeni (Kinango, Kwale) | Missing entirely; leaves a hole |
| 210 | Shimbir Fatuma (Mandera South) | Missing; leaves a hole of about 1,386 km² |
| 287 | Abothuguchi West (Central Imenti) | Missing; split between neighbours |
| 571, 572, 573, 575, 576 | Gatongora, Kahawa Sukari, Kahawa Wendani, Mwiki, Mwihoko (Ruiru) | **Merged into one polygon coded 574 (Kiuu)** |
| 640 | Lokori/Kochodin (Turkana East) | Missing; leaves a hole of about 3,223 km² |
| 676 | Kapomboi (Kwanza, Trans Nzoia) | Missing; leaves a hole |
| 734 | Embobut/Embulot (Marakwet East) | Mostly inside polygon 732 (Sambirir) |
| 735 | Lelan (Marakwet West) | Missing; leaves a hole |
| 1448 | Ngei (Mathare, Nairobi) | Mostly inside 1447 (Huruma) |

**Other ward problems:**
- **Duplicate codes:**
  - Codes 224, 280, 289, 398, 678 and 1230 each appear twice.
  - Two of these are exact copies.
  - The others appear to be a ward stored as two pieces. The pipeline will check that no
    neighbour is missing before merging them into one multipolygon.
  - One piece of 224 is empty.
- **Invalid geometry:** 5 polygons have self-intersections: 53, 60, 62, 102 and 107. These are
  fixable.
- **Wrong parent constituency:** 19 wards differ from the gazette. For example, Lamu wards
  105–110 are tagged as Likoni (5) instead of Lamu West (22).
- **Layers don't nest:** 336 wards lie more than 10% outside their own constituency polygon,
  because the ward and constituency layers were digitised separately.
- **Ward topology:** 367 overlapping pairs total 804 km², and the gaps add up to 10,746 km².
  Of the gaps, about 6,700 km² is land that source C covers, mostly where wards are missing.
  The rest is sea or lake water that the county polygons include.
- **Names:** 24 spellings differ from the gazette. One ward is named "`" (backtick); the gazette
  calls it Lwandanyi.

## Findings: source C (Red Cross 1,450)

- All 1,450 polygons are present, with **no overlaps** between wards and 10 invalid rings.
- Its outline differs from IEBC's: there are 15,710 km² of gaps against IEBC's county
  outline, which includes lakes and sea.
- I matched each ward against the IEBC wards by shape (diagnostic only; nothing is joined this
  way):

| Match quality | Wards |
|---|---|
| Shape overlap ≥ 0.8 and name agrees | 884 |
| Name agrees but shape overlap < 0.8 (lines drawn differently) | 463 |
| Shape matches but name differs | 24 |
| Neither matches well | 79 |

- Using C as the base layer would mean reviewing about 566 ward-to-code assignments by hand.

## Recommendation

1. **Base layer:** use source A wards, with codes taken from the data itself.
2. **Names and parents:** take every name and parent code from the gazette list, never from
   the geometry's attributes.
3. **Fix the geometry:**
   - Repair invalid rings.
   - Merge duplicate pieces.
   - Run `mapshaper -clean` to resolve the overlaps and slivers.
4. **Patch the 13 missing wards from source C:**
   - Cut each one out of the IEBC polygon that swallowed it.
   - Record the mapping in a reviewed crosswalk file (`boundaries/overrides/ward_patches.csv`)
     that links each Red Cross polygon's ID to an IEBC code. Each entry is checked by hand
     once; the pipeline never joins on names.
5. **Derive the upper layers:**
   - Build constituencies, counties and the 8 former provinces **by dissolving wards**, using
     the gazette's parent codes.
   - This guarantees that every unit nests exactly inside its parent.
   - The original constituency and county files are used only for cross-checks.
6. **Fail the build loudly:** the pipeline stops if any of codes 1–1,450, 1–290 or 1–47 is
   missing, duplicated or out of range, and writes this report on every run.

**Size check:** all 1,450 wards simplified to 2% come to about 0.97 MB raw and **about
220 KB gzipped**. Plain GeoJSON is enough, and PMTiles isn't needed.
