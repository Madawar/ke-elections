# Boundary build report

Written by `npm run boundaries:build` on every run. Do not edit by hand.

## Result

| Layer | Features |
|---|---|
| Provinces | 8 |
| Counties | 47 |
| Constituencies | 290 |
| Wards | 1450 |

All codes are present exactly once and no polygon is empty. Names and parent codes come from the gazette. Wards were simplified with `-simplify variable percentage='$.area < 1e6 ? "60%" : $.area < 5e6 ? "30%" : $.area < 20e6 ? "8%" : $.area < 60e6 ? "4%" : "2%"' keep-shapes` (small wards keep more detail than large ones, see below), then the constituencies, counties and provinces were dissolved from those simplified wards, so every layer shares the same lines.

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

## Replaced wards (36)

IEBC has a polygon for these codes, but filed under the wrong code or drawn in the wrong place. Each takes its Red Cross polygon (`mode=replace` in `boundaries/overrides/ward_patches.csv`), cut out of its neighbours like a patch. The removed IEBC polygon is re-filed under the patch that covers most of it, and only what no Red Cross ward covers (lake, sea or a border strip) is kept, so coasts, lake shores and borders keep their IEBC line. A Red Cross polygon that reaches past that line still adds its bulge (Faza and Moyale towns are outside every IEBC polygon).

A row is allowed only when two independent signals agree (the build fails otherwise):

- **Stations:** at least 5 of the ward's IEBC 2013 polling stations, at most 30% of them inside the IEBC polygon and at least 70% inside the Red Cross one.
- **Reference point:** a cited point from `boundaries/overrides/reference_points.csv` lies in the wrong code in the IEBC build and inside the Red Cross ward.
- **With its group:** a member of a cluster (a code shift or swap) with no signal of its own, allowed only when its old polygon went to a supported replacement or a supported replacement's old polygon went to it.

Station shares are of the stations matched to the ward. "IEBC" is the build with fills only, "built" this build at full detail. "Old polygon to" is where the removed IEBC polygon was re-filed. Every row's full reason is in `ward_patches.csv`; per-ward numbers for all 1,450 wards are in `boundaries/build/ward-evidence.csv`.

| Code | Ward | Red Cross uid | IEBC polygon was | Signals | Stations | Inside IEBC | Inside Red Cross | Inside built | Old polygon to |
|---|---|---|---|---|---|---|---|---|---|
| 4 | Changamwe | qyQg0b3mxEL | CHANGAMWE | stations | 5 | 20% | 80% | 80% | 4 |
| 56 | Watamu | FmnSathgx18 | WATAMU | reference point | 7 | 29% | 57% | 57% | 56 |
| 81 | Magarini | uI1MltAs8p3 | MAGARINI | stations | 14 | 14% | 93% | 93% | 81 |
| 212 | Township | dYhEFLJSRYl | BULLA MPYA | reference point | 0 |  |  |  | 215 |
| 213 | Neboi | UU5663WBF7t | KHALALIO | reference point | 0 |  |  |  | 214 |
| 214 | Khalalio | gVbkohpiw1f | NEBOI | reference point | 0 |  |  |  | 213 |
| 215 | Libehia | g1daXHb0Lz0 | TOWNSHIP | with its group (212) | 0 |  |  |  | 212 |
| 285 | Mwanganthia | FJJRq7O0QcB | MWANGANTHIA | stations | 14 | 0% | 79% | 79% | 287 |
| 286 | Abothuguchi Central | Ay0bToL5BTE | ABOTHUGUCHI CENTRAL | with its group (285) | 17 | 100% | 100% | 100% | 285 |
| 482 | Karatina Town | oCDeWaZZImt | KARATINA TOWN | reference point | 7 | 71% | 86% | 86% | 482 |
| 559 | Murera | OW3dhCE5nw8 | MURERA | with its group (560) | 4 | 75% | 75% | 75% | 559 |
| 560 | Theta | fxLikKorklY | THETA | stations | 5 | 0% | 100% | 100% | 559 |
| 561 | Juja | WsPnZQHN2CZ | JUJA | reference point | 4 | 100% | 100% | 100% | 561 |
| 593 | Nyadhuna | S5vdlHabZzv | NYADHUNA | stations | 6 | 17% | 100% | 100% | 593 |
| 613 | Lapur | sKV3BVTK2cJ | LAPUR | stations | 5 | 0% | 100% | 100% | 613 |
| 627 | Lodwar Township | v27o9CuZh11 | LODWAR TOWNSHIP | reference point | 7 | 71% | 100% | 100% | 627 |
| 651 | Suam | ieOIyNJbMxc | SUAM | stations | 5 | 20% | 80% | 80% | 651 |
| 687 | Machewa | GQFH01xLj74 | MACHEWA | stations | 7 | 29% | 86% | 86% | 687 |
| 793 | Kabarnet | Kn2aiEXbw5B | KABARNET | reference point | 26 | 62% | 89% | 89% | 793 |
| 802 | Mogotio | duv5obCpRzb | MOGOTIO | reference point | 24 | 50% | 100% | 100% | 802 |
| 805 | Lembus | KUL5AR13rwy | LEMBUS | stations | 10 | 0% | 70% | 75% | 802 |
| 829 | Molo | STQIvkltmOp | MOLO | reference point | 8 | 75% | 100% | 100% | 829 |
| 832 | Kihingo | rb2nGblpg8l | KIHINGO | stations | 5 | 0% | 80% | 80% | 832 |
| 900 | Suswa | iZN31WZZycN | SUSWA | reference point | 8 | 75% | 88% | 88% | 900 |
| 922 | Kitengela | L6v0cndEtYB | KITENGELA | reference point | 2 | 0% | 50% | 50% | 923 |
| 923 | Oloosirkon/Sholinke | oXm4Fpl0iEr | OLOOSIRKON/SHOLINKE | with its group (922) | 3 | 67% | 100% | 100% | 923 |
| 1068 | Luanda Township | ZD3ThdrdoTN | LUANDA TOWNSHIP | reference point | 4 | 50% | 100% | 100% | 1068 |
| 1145 | Marachi East | IS2J5mu8wNo | MARACHI EAST | with its group (1146) | 3 | 0% | 100% | 100% | 1146 |
| 1146 | Marachi North | uHObeeBxuHY | MARACHI NORTH | stations | 10 | 20% | 100% | 100% | 1145 |
| 1211 | Miwani | PoYQc8biHf3 | MIWANI | reference point | 9 | 44% | 100% | 100% | 1211 |
| 1230 | West Karachuonyo | DbwgMpyBfwd | WEST KARACHUONYO | with its group (1231) | 13 | 92% | 92% | 92% | 1230, 1231 |
| 1231 | North Karachuonyo | bR7hQLC29rl | NORTH KARACHUONYO | stations | 20 | 0% | 95% | 95% | 1236 |
| 1236 | Kendu Bay Town | bBfvGmNakj6 | KENDU BAY TOWN | reference point | 15 | 40% | 93% | 93% | 1236 |
| 1354 | Bosamaro | b3aaM8BOTDz | BOSAMARO | stations | 10 | 30% | 100% | 100% | 1354 |
| 1361 | Ekerenyo | QcYbNJ5Z88l | EKERENYO | stations | 9 | 11% | 78% | 78% | 1361 |
| 1432 | Harambee | T7AinNTWtXe | HARAMBEE | stations | 5 | 20% | 80% | 80% | 1432 |

### Polling-station matching

26,447 stations in `output/pollingstations.shp`. 10,052 are outside Kenya's bounding box (mostly at 0, 0) and dropped. 16,395 are matched to a gazette ward by exact normalised ward name inside their own constituency (2013 constituency names through an explicit alias table: Mbita is Suba North, Suba is Suba South); there is no fallback across constituencies. Unmatched: 0 by county, 0 by constituency, 0 by ward name:

None. (The 2013 names with no 2026 ward in their constituency, Mandera East's "Bulla Mpya" and Lafey's "Libehia", only have stations at 0, 0.)

A matched station counts for its ward only if its GPS falls inside the ward's own county; many 2013 coordinates belong to another county (Mandera East's Township, for one, lists 98 stations, scattered across the country or at 0, 0).

### Still uncertain (83)

Wards whose signals disagree with this build and that were not replaced: at least 3 stations with fewer than 50% of them inside the built polygon, a reference point outside its ward, or a ward that meets the rule but was left alone. Most are dense urban wards (Nairobi, Mombasa, Nakuru, Kisumu), where both layers agree poorly with the rough 2013 GPS.

| Code | Ward | Stations | Inside IEBC | Inside Red Cross | Inside built | Built polygon holding most | Why |
|---|---|---|---|---|---|---|---|
| 13 | Mtopanga | 3 | 33% | 100% | 33% | 10 | 33% of 3 stations inside the built polygon |
| 16 | Frere Town | 4 | 25% | 75% | 25% | 17 | 25% of 4 stations inside the built polygon |
| 23 | Bofu | 3 | 33% | 67% | 33% | 24 | 33% of 3 stations inside the built polygon |
| 29 | Shimanzi/Ganjoni | 4 | 25% |  | 25% | 30 | 25% of 4 stations inside the built polygon |
| 78 | Malindi Town | 3 | 33% | 100% | 33% | 79 | 33% of 3 stations inside the built polygon |
| 101 | Faza | 3 | 0% | 67% | 0% | 104 | 0% of 3 stations inside the built polygon |
| 158 | Sangailu | 3 | 33% | 100% | 33% | 152 | 33% of 3 stations inside the built polygon |
| 165 | Batalu | 3 | 0% | 100% | 0% | 164 | 0% of 3 stations inside the built polygon |
| 176 | Arbajahan | 4 | 25% | 50% | 25% | 183 | 25% of 4 stations inside the built polygon |
| 227 | Obbu | 3 | 33% | 33% | 33% | 222 | 33% of 3 stations inside the built polygon |
| 257 | Athiru Ruujine | 11 | 46% | 91% | 46% | 258 | 46% of 11 stations inside the built polygon |
| 266 | Athwana | 9 | 44% | 44% | 44% | 267 | 44% of 9 stations inside the built polygon |
| 315 | Kirimari | 10 | 30% | 30% | 30% | 314 | 30% of 10 stations inside the built polygon |
| 350 | Kisasi | 26 | 46% | 62% | 46% | 357 | 46% of 26 stations inside the built polygon |
| 351 | Mbitini | 15 | 40% | 60% | 40% | 350 | 40% of 15 stations inside the built polygon |
| 361 | Chuluni | 15 | 47% | 73% | 47% | 360 | 47% of 15 stations inside the built polygon |
| 374 | Muthesya | 15 | 40% | 60% | 40% | 375 | 40% of 15 stations inside the built polygon |
| 492 | Rware | 6 | 33% | 67% | 33% | 495 | 33% of 6 stations inside the built polygon |
| 538 | Nginda | 10 | 40% | 90% | 40% | 537 | 40% of 10 stations inside the built polygon |
| 564 | Township | 6 | 33% |  | 33% | 565 | 33% of 6 stations inside the built polygon |
| 566 | Hospital | 4 | 25% | 100% | 25% | 565 | 25% of 4 stations inside the built polygon |
| 574 | Kiuu | 3 | 33% | 33% | 33% | 575 | 33% of 3 stations inside the built polygon |
| 585 | Township | 6 | 33% |  | 33% | 564 | 33% of 6 stations inside the built polygon |
| 586 | Cianda | 3 | 33% | 33% | 33% | 578 | 33% of 3 stations inside the built polygon |
| 592 | Muguga | 4 | 25% | 100% | 25% | 591 | 25% of 4 stations inside the built polygon |
| 594 | Kabete | 3 | 33% | 100% | 33% | 591 | 33% of 3 stations inside the built polygon |
| 784 | Silale | 3 | 33% | 100% | 33% | 785 | 33% of 3 stations inside the built polygon |
| 819 | Thingithu | 5 | 40% | 60% | 40% | 818 | 40% of 5 stations inside the built polygon |
| 834 | Lare | 7 | 43% | 43% | 43% | 832 | 43% of 7 stations inside the built polygon |
| 836 | Biashara | 14 | 29% | 50% | 29% | 871 | 29% of 14 stations inside the built polygon |
| 838 | Lake View | 3 | 33% | 0% | 33% | 856 | 33% of 3 stations inside the built polygon |
| 845 | Elementaita | 14 | 36% | 79% | 36% | 846 | 36% of 14 stations inside the built polygon |
| 860 | Menengai West | 7 | 43% | 71% | 43% | 842 | 43% of 7 stations inside the built polygon |
| 876 | Biashara | 14 | 29% | 29% | 29% | 836 | 29% of 14 stations inside the built polygon |
| 877 | Kivumbini | 3 | 33% | 0% | 33% | 875 | 33% of 3 stations inside the built polygon |
| 879 | Menengai | 3 | 33% | 33% | 33% | 875 | 33% of 3 stations inside the built polygon |
| 887 | Ilkerin | 8 | 25% |  | 25% | 889 | 25% of 8 stations inside the built polygon |
| 906 | Sagamian | 4 | 25% | 100% | 25% | 905 | 25% of 4 stations inside the built polygon |
| 917 | Ildamat | 5 | 40% | 60% | 40% | 918 | 40% of 5 stations inside the built polygon |
| 930 | Mosiro | 4 | 0% | 25% | 0% | 929 | 0% of 4 stations inside the built polygon |
| 946 | Kapkugerwet | 3 | 33% | 33% | 33% | 947 | 33% of 3 stations inside the built polygon |
| 948 | Kipchimchim | 6 | 33% | 67% | 33% | 947 | 33% of 6 stations inside the built polygon |
| 1001 | Sinoko | 7 | 43% | 71% | 43% | 1000 | 43% of 7 stations inside the built polygon |
| 1009 | Butsotso East | 9 | 33% | 89% | 33% | 1012 | 33% of 9 stations inside the built polygon |
| 1012 | Sheywe | 8 | 38% | 25% | 38% | 1014 | 38% of 8 stations inside the built polygon |
| 1013 | Mahiakalo | 3 | 33% | 67% | 33% | 1042 | 33% of 3 stations inside the built polygon |
| 1056 | West Sabatia | 11 | 36% | 91% | 36% | 1057 | 36% of 11 stations inside the built polygon |
| 1098 | Township | 7 | 43% | 57% | 43% | 1100 | 43% of 7 stations inside the built polygon |
| 1099 | Khalaba | 4 | 25% | 25% | 25% | 1086 | 25% of 4 stations inside the built polygon |
| 1121 | Malaba Central | 5 | 40% | 100% | 40% | 1126 | 40% of 5 stations inside the built polygon |
| 1197 | Migosi | 3 | 0% | 100% | 0% | 1200 | 0% of 3 stations inside the built polygon |
| 1200 | Kondele | 3 | 33% | 100% | 33% | 1188 | 33% of 3 stations inside the built polygon |
| 1207 | Awasi/Onjiko | 14 | 29% | 36% | 29% | 1208 | 29% of 14 stations inside the built polygon |
| 1225 | West Kamagak | 5 | 40% | 60% | 40% | 1222 | 40% of 5 stations inside the built polygon |
| 1274 | Wasweta Ii | 5 | 40% |  | 40% | 1266 | 40% of 5 stations inside the built polygon |
| 1307 | Bogetenga | 11 | 36% | 73% | 36% | 1306 | 36% of 11 stations inside the built polygon |
| 1320 | Bobasi Chache | 5 | 20% | 20% | 20% | 1313 | 20% of 5 stations inside the built polygon |
| 1321 | Sameta/Mokwerero | 6 | 33% | 67% | 33% | 1322 | 33% of 6 stations inside the built polygon |
| 1342 | Bogeka | 6 | 17% | 67% | 17% | 1343 | 17% of 6 stations inside the built polygon |
| 1344 | Kitutu   Central | 7 | 43% |  | 43% | 1332 | 43% of 7 stations inside the built polygon |
| 1349 | Magombo | 5 | 40% | 80% | 40% | 1346 | 40% of 5 stations inside the built polygon |
| 1367 | Parklands/Highridge | 7 | 43% | 86% | 43% | 1374 | 43% of 7 stations inside the built polygon |
| 1369 | Kangemi | 3 | 0% | 67% | 0% | 1370 | 0% of 3 stations inside the built polygon |
| 1370 | Mountain View | 3 | 0% | 67% | 0% | 1373 | 0% of 3 stations inside the built polygon |
| 1372 | Kawangware | 3 | 33% | 67% | 33% | 1377 | 33% of 3 stations inside the built polygon |
| 1375 | Kabiro | 3 | 33% | 33% | 33% | 1372 | 33% of 3 stations inside the built polygon |
| 1382 | Nairobi West | 3 | 33% | 67% | 33% | 1372 | 33% of 3 stations inside the built polygon |
| 1383 | Mugumu-Ini | 7 | 43% |  | 43% | 1382 | 43% of 7 stations inside the built polygon |
| 1388 | Makina | 5 | 40% | 80% | 40% | 1387 | 40% of 5 stations inside the built polygon |
| 1389 | Woodley/Kenyatta Golf Course | 6 | 33% | 67% | 33% | 1385 | 33% of 6 stations inside the built polygon |
| 1393 | Zimmerman | 3 | 33% | 100% | 33% | 1394 | 33% of 3 stations inside the built polygon |
| 1396 | Clay City | 3 | 0% | 33% | 0% | 1398 | 0% of 3 stations inside the built polygon |
| 1403 | Mathare North | 3 | 0% | 0% | 0% | 1437 | 0% of 3 stations inside the built polygon |
| 1405 | Korogocho | 4 | 25% | 75% | 25% | 1412 | 25% of 4 stations inside the built polygon |
| 1406 | Imara Daima | 3 | 0% | 67% | 0% | 1407 | 0% of 3 stations inside the built polygon |
| 1425 | Mihango | 3 | 33% | 67% | 33% | 1400 | 33% of 3 stations inside the built polygon |
| 1429 | Kariobangi South | 5 | 20% | 40% | 20% | 1382 | 20% of 5 stations inside the built polygon |
| 1431 | Viwandani | 3 | 0% | 33% | 0% | 1381 | 0% of 3 stations inside the built polygon |
| 1433 | Makongeni | 5 | 20% | 60% | 20% | 1443 | 20% of 5 stations inside the built polygon |
| 1434 | Pumwani | 5 | 40% | 60% | 40% | 1433 | 40% of 5 stations inside the built polygon |
| 1435 | Eastleigh North | 3 | 33% | 67% | 33% | 1385 | 33% of 3 stations inside the built polygon |
| 1444 | Nairobi South | 6 | 33% | 50% | 33% | 1433 | 33% of 6 stations inside the built polygon |
| 1447 | Huruma | 3 | 0% | 33% | 0% | 1387 | 0% of 3 stations inside the built polygon |

Reference-point candidates not used (12, from `boundaries/build/reference-candidates.csv`, written by `boundaries/scripts/reference_points.mjs`):

| Place | Expected ward | OSM | Why not |
|---|---|---|---|
| Ukunda town | 32 Ukunda | node/44914382 | 48 m from a line in the Red Cross layer: too close to call |
| Malindi town | 78 Malindi Town | node/44929687 | 42 m from a line in the IEBC layer: too close to call |
| Faza town | 101 Faza | node/45004382 | outside every IEBC ward: a coast or border line difference, not a ward filed under the wrong code |
| Danaba town | 166 Danaba | node/3696859225 | 20 m from a line in the IEBC layer: too close to call |
| Wargadud town | 175 Wargadud | node/3702721572 | only the Red Cross layer has it in its ward, but 3 stations favour IEBC (1 inside IEBC, 0.667 inside Red Cross) |
| Wargadud town | 206 Wargadud | node/10657170579 | 56 m from a line in the IEBC layer: too close to call |
| Moyale town | 225 Moyale Township | node/44927166 | outside every IEBC ward: a coast or border line difference, not a ward filed under the wrong code |
| Kapenguria town | 642 Kapenguria | node/44997889 | in neither layer's Kapenguria: IEBC 643, Red Cross Mnagei Ward |
| Nanyuki town | 820 Nanyuki | node/44925466 | 34 m from a line in the IEBC layer: too close to call |
| Londiani town | 936 Londiani | node/44931441 | in neither layer's Londiani: IEBC 937, Red Cross Kedowa/kimugul Ward |
| Kapsoit town | 944 Kapsoit | node/44998146 | 34 m from a line in the Red Cross layer: too close to call |
| Chavakali town | 1057 Chavakali | node/1821782084 | 15 m from a line in the Red Cross layer: too close to call |

## Dropped features (1)

| Code in source | Name in source | Reason |
|---|---|---|
| 0 | PTOYO/NAKWIJIT | no valid ward code |

## Merged duplicate codes (5)

Each code appeared on more than one IEBC polygon. The pieces were dissolved into one feature.

| Code | Ward | Pieces |
|---|---|---|
| 224 | Golbo | 2 |
| 280 | Nyaki East | 2 |
| 289 | Kibirichia | 2 |
| 398 | Kalama | 2 |
| 678 | Keiyo | 2 |

## Corrections from the gazette

19 wards had a parent (constituency or county) that differs from the gazette, in 25 fields (7 of them a source county code of 0, meaning unset), and 32 had a name that differs. All were replaced with the gazette values.

The data quality report counted 19 parent and 24 name differences on the per-ward source files. This build reads the combined `data/wards.geojson`, whose names differ in more places. Most are the same ward in different spelling or case, but a few carry another ward's name (for example 97, 245 and 1283, whose polygons do match the gazette ward). Replaced wards (above) are left out of these tables: their IEBC polygon and its attributes describe another ward, and the "Replaced wards" table gives the name each removed polygon carried.

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

- [dissolve] Dissolved 1,406 features into 1,401 features
- [dissolve] Dissolved 59 features into 49 features
- [clean] Removed 12,147 of 12,147 slivers using 400+ sqkm variable threshold
- [clean] Retained 1,450 of 1,450 features

Gap threshold: with mapshaper's default, 434 gaps totalling about 1,324 km² stayed inside the country. They are land that no ward covers, so the map would show holes and a tap there would select nothing. The largest is about 309 km², so a threshold of 400 km² fills every one into the neighbouring ward that shares most boundary with it. Overlaps need no tuning: the default already leaves none.

| Stage | Sum of ward areas (km²) | Area of union (km²) | Overlap (km²) | Holes inside the country | Hole area (km²) |
|---|---|---|---|---|---|
| After assembly (full detail) | 594,044.77 | 594,044.77 | 0 | 6 | 0.07 |
| After simplification | 594,017.57 | 594,017.57 | 0 | 1 | 0 |

## Simplification: largest area changes per ward

Each ward's area after simplification against its full-detail area (after cleaning and patching). 0 wards change by more than 20%; the build fails if any ward changes by more than 35%. The 15 largest changes:

| Code | Ward | Full detail (km²) | Simplified (km²) | Change |
|---|---|---|---|---|
| 212 | Township | 25.5 | 24.3 | -4.7% |
| 101 | Faza | 30.18 | 28.77 | -4.7% |
| 29 | Shimanzi/Ganjoni | 5.02 | 5.24 | +4.5% |
| 104 | Shella | 105.41 | 101.17 | -4.0% |
| 424 | Wote | 97.23 | 93.78 | -3.6% |
| 797 | Kapropita | 96.83 | 93.95 | -3.0% |
| 596 | Karai | 26.82 | 27.61 | +2.9% |
| 738 | Moiben/Kuserwo | 130.12 | 133.92 | +2.9% |
| 761 | Nandi Hills | 77.02 | 79.23 | +2.9% |
| 607 | Kijabe | 78.81 | 80.88 | +2.6% |
| 1275 | Ragana-Oruba | 30.27 | 29.48 | -2.6% |
| 944 | Kapsoit | 62.42 | 64.04 | +2.6% |
| 10 | Junda | 7.88 | 8.08 | +2.6% |
| 598 | Sigona | 24.33 | 24.93 | +2.5% |
| 750 | Metkei | 64.76 | 66.34 | +2.4% |

## Checks on the real data

Ward count: 1,450 of 1,450.

The five Ruiru patches (571, 572, 573, 575, 576) and 574 Kiuu, which IEBC had swallowed them into, all exist and have area:

| Code | Ward | Area (km²) |
|---|---|---|
| 571 | Gatongora | 113.39 |
| 572 | Kahawa Sukari | 4.44 |
| 573 | Kahawa Wendani | 1.14 |
| 574 | Kiuu | 11.56 |
| 575 | Mwiki | 1.49 |
| 576 | Mwihoko | 25.87 |

Pairwise overlap among these six wards (15 pairs): none.

Reference points: 92 in `boundaries/overrides/reference_points.csv`, 92 of them inside their expected ward at full detail; the build also fails if any falls outside it after simplification.

## Output files

| File | Raw (KB) | Gzipped (KB) | Gzip budget (KB) |
|---|---|---|---|
| constituencies.geojson | 536.8 | 135.6 | 180 |
| counties.geojson | 199.8 | 57.3 | 120 |
| labels.geojson | 264.5 | 32.8 |  |
| provinces.geojson | 103.6 | 31.7 |  |
| units.json | 145.1 | 41.8 | 60 |
| wards.geojson | 1284.7 | 286.5 | 300 |
