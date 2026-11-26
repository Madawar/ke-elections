# Boundary build report

Written by `npm run boundaries:build` on every run. Do not edit by hand.

## Result

| Layer | Features |
|---|---|
| Provinces | 8 |
| Counties | 47 |
| Constituencies | 290 |
| Wards | 1450 |

All codes are present exactly once and no polygon is empty. Names and parent codes come from the gazette. Wards were simplified with `-simplify 2% keep-shapes`, then the constituencies, counties and provinces were dissolved from those simplified wards, so every layer shares the same lines.

## Patched wards (13)

IEBC has no polygon for these codes. Each takes the polygon of the reviewed Red Cross ward in `boundaries/overrides/ward_patches.csv`, cut out of whatever IEBC polygon covered it.

| Code | Ward | Red Cross uid |
|---|---|---|
| 50 | Kasemeni | aom47Uzq1RZ |
| 210 | Shimbir Fatuma | Z9zNkBFLY9r |
| 287 | Abothuguchi West | ZVoIw8oAOWZ |
| 571 | Gatongora | B1GDVDYIGwK |
| 572 | Kahawa Sukari | Lc6GluslY9h |
| 573 | Kahawa Wendani | w3MNsmpJJHX |
| 575 | Mwiki | KoIp1GKz0UI |
| 576 | Mwihoko | dnLaU3RrCnp |
| 640 | Lokori/Kochodin | AY46zJ3BT9H |
| 676 | Kapomboi | zkVfk8cWPc2 |
| 734 | Embobut / Embulot | u6ONpoWIV0d |
| 735 | Lelan | qsljIZxApCc |
| 1448 | Ngei | tsmsPb6qMFa |

## Dropped features (1)

| Code in source | Name in source | Reason |
|---|---|---|
| 0 | PTOYO/NAKWIJIT | no valid ward code |

## Merged duplicate codes (6)

Each code appeared on more than one IEBC polygon. The pieces were dissolved into one feature.

| Code | Ward | Pieces |
|---|---|---|
| 224 | Golbo | 2 |
| 280 | Nyaki East | 2 |
| 289 | Kibirichia | 2 |
| 398 | Kalama | 2 |
| 678 | Keiyo | 2 |
| 1230 | West Karachuonyo | 2 |

## Corrections from the gazette

19 wards had a parent (constituency or county) that differs from the gazette, in 25 fields (7 of them a source county code of 0, meaning unset), and 36 had a name that differs. All were replaced with the gazette values.

The data quality report counted 19 parent and 24 name differences on the per-ward source files. This build reads the combined `data/wards.geojson`, whose names differ in 12 more places. Most are the same ward in different spelling or case, but a few carry another ward's name (for example 97, 245 and 1283, whose polygons do match the gazette ward), and wards 212 to 216 in Mandera are listed in a different order from both the gazette and the Red Cross layer, so those five polygons need a manual check against a map.

### Parent corrections

| Ward code | Ward | Field | Source | Gazette |
|---|---|---|---|---|
| 85 | Sabaki | constituency_code | 16 | 17 |
| 96 | Chewele | county_code | 0 | 4 |
| 105 | Mkomani | constituency_code | 5 | 22 |
| 105 | Mkomani | county_code | 0 | 5 |
| 106 | Hindi | constituency_code | 5 | 22 |
| 106 | Hindi | county_code | 0 | 5 |
| 107 | Mkunumbi | constituency_code | 5 | 22 |
| 107 | Mkunumbi | county_code | 0 | 5 |
| 108 | Hongwe | constituency_code | 5 | 22 |
| 108 | Hongwe | county_code | 0 | 5 |
| 109 | Witu | constituency_code | 5 | 22 |
| 109 | Witu | county_code | 0 | 5 |
| 110 | Bahari | constituency_code | 5 | 22 |
| 110 | Bahari | county_code | 0 | 5 |
| 217 | Fino | constituency_code | 43 | 44 |
| 317 | Gaturi North | constituency_code | 63 | 64 |
| 339 | Kiomo/Kyethani | constituency_code | 69 | 68 |
| 357 | Mulango | constituency_code | 71 | 72 |
| 821 | Umande | constituency_code | 165 | 164 |
| 871 | London | constituency_code | 176 | 175 |
| 898 | Ildamat | constituency_code | 181 | 180 |
| 1189 | Nyalenda 'A' | constituency_code | 240 | 238 |
| 1372 | Kawangware | constituency_code | 276 | 275 |
| 1375 | Kabiro | constituency_code | 276 | 275 |
| 1385 | Nyayo Highrise | constituency_code | 278 | 277 |

### Name corrections

| Ward code | Source name | Gazette name |
|---|---|---|
| 97 | BURA | Hirimani |
| 122 | BURA(MWATATE) | Bura |
| 126 | SAGALA | Sagalla |
| 178 | ADEMASAJIDE | Adamasajide |
| 205 | RHAMU DIMTU | Rhamu-Dimtu |
| 206 | WARGUDUD | Wargadud |
| 212 | BULLA MPYA | Township |
| 213 | KHALALIO | Neboi |
| 214 | NEBOI | Khalalio |
| 215 | TOWNSHIP | Libehia |
| 216 | LIBEHIA | Sala |
| 219 | WARANKARA | Waranqara |
| 223 | HEILU/MANYATTA | Heillu/Manyatta |
| 239 | LOGOLOGO | Logo Logo |
| 245 | 673 | Ngare Mara |
| 247 | OLDONYIRO | Oldo/Nyiro |
| 248 | GARBA TULLA | Garbatulla |
| 406 | MAKUTANO/MWALA | Makutano/ Mwala |
| 414 | KISAU-KITETA | Kiteta/Kisau |
| 415 | WAIA/KAKO | Waia-Kako |
| 462 | LESHAU PONDO | Leshau/Pondo |
| 614 | KAIKOR/KAALENG | Kaaleng/Kaikor |
| 625 | KANGATOTHA | Kang'atotha |
| 665 | PORRO | Poro |
| 796 | EWALEL CHAPCHAP | Ewalel/Chapchap |
| 824 | MUKOGONDO WEST | Mugogodo West |
| 825 | MUKOGONDO EAST | Mugogodo East |
| 1084 | ` | Lwandanyi |
| 1134 | BUKHAYO NORTH/WALATSI | Bukhayo North/Waltsi |
| 1175 | YIMBO WEST | West Yimbo |
| 1260 | RUMA-KAKSINGIRI EAST | Ruma-Kaksingri |
| 1283 | KACHIEN'G | Kanyasa |
| 1376 | MUTUINI | Mutu-Ini |
| 1383 | MUGUMO-INI | Mugumu-Ini |
| 1390 | SARANG'OMBE | Sarangombe |
| 1396 | CLAYCITY | Clay City |

## Cleaning

Run with `-clean gap-fill-area=400km2`. Mapshaper said:

- [dissolve] Dissolved 1,443 features into 1,437 features
- [dissolve] Dissolved 13 features into 13 features
- [clean] Removed 10,241 of 10,241 slivers using 400+ sqkm variable threshold
- [clean] Retained 1,450 of 1,450 features

Gap threshold: with mapshaper's default, 434 gaps totalling about 1,324 km² stayed inside the country. They are land that no ward covers, so the map would show holes and a tap there would select nothing. The largest is about 309 km², so a threshold of 400 km² fills every one into the neighbouring ward that shares most boundary with it. Overlaps need no tuning: the default already leaves none.

| Stage | Sum of ward areas (km²) | Area of union (km²) | Overlap (km²) | Holes inside the country | Hole area (km²) |
|---|---|---|---|---|---|
| After assembly (full detail) | 594,077.86 | 594,077.86 | 0 | 1 | 0.02 |
| After simplification | 594,039.75 | 594,039.75 | 0 | 0 | 0 |

## Checks on the real data

Ward count: 1,450 of 1,450.

The five Ruiru patches (571, 572, 573, 575, 576) and 574 Kiuu, which IEBC had swallowed them into, all exist and have area:

| Code | Ward | Area (km²) |
|---|---|---|
| 571 | Gatongora | 113.39 |
| 572 | Kahawa Sukari | 4.44 |
| 573 | Kahawa Wendani | 1.14 |
| 574 | Kiuu | 13.84 |
| 575 | Mwiki | 1.49 |
| 576 | Mwihoko | 25.87 |

Pairwise overlap among these six wards (15 pairs): none.

## Output files

| File | Raw (KB) | Gzipped (KB) | Gzip budget (KB) |
|---|---|---|---|
| constituencies.geojson | 414.1 | 105.0 | 180 |
| counties.geojson | 164.6 | 47.2 | 120 |
| labels.geojson | 264.6 | 32.8 |  |
| provinces.geojson | 81.7 | 24.8 |  |
| units.json | 145.1 | 41.7 | 60 |
| wards.geojson | 1009.3 | 221.9 | 300 |
