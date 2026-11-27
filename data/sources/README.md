# Sourced data

Facts the map shows, as CSV files that go through `php artisan data:import` (see
`docs/data-import.md`). Every row carries a `source_url`. Nothing here is invented; anything that
could not be confirmed is marked `confidence` medium or low with a note.

| File | What | Sources |
|---|---|---|
| `parties.csv` | Every party that won a seat in 2022 or since, with 2022 coalition, renames and ORPP colour text | ORPP register of fully registered parties (October 2026), ORPP coalition notices, Kenya Gazette |
| `holders/national_assembly.csv` | 290 MPs, 47 Woman Reps and 12 nominated MPs, elected 2022, with every by-election and change since | IEBC gazette notices 9950/9951, 10533–10535, 10537, 10710, 10083 and by-election declarations; cross-checked against parliament.go.ke member lists (Oct 2022 and 12 Aug 2026) |
| `holders/mca.csv` | 1,450 MCAs elected 2022 (including the 29 Aug and 8 Dec 2022 postponed polls) and 23 ward by-elections since | IEBC gazette notices in `raw_mca/` (GN 9956 with corrigenda 10534 and 10711, 10535, 15569, 143, 15732, 17611 with corrigenda 17612 and 17614, 3105, 7394); printed code errors fixed by ward name within the constituency and noted per row |
| `holders/county_seats.csv` | 47 governors, 47 senators and 20 nominated senators, with changes since | IEBC gazette notices 9949, 9955, 10535, 10537; parliament.go.ke Senate list; Council of Governors (cog.go.ke) |

Holder names are given-name first, in the gazette's spelling; where Parliament spells a name
differently the row's `notes` say so. Parties are recorded as the party a person was elected or
nominated on, not later alignment.

Known gaps:
- MCA by-elections between January 2023 and October 2025 may be missing: the IEBC gazette list shows none in that period.
- For a by-election, the previous holder's `ended_on` is the by-election date (an upper bound), since the gazettes don't give the vacancy date.
- One nominated MP seat (ANC) is vacant pending a court case over ANC's dissolution.
- Wiper is keyed `WDM-K` (its 2022 name); it is now Wiper Patriotic Front (WPF).
- Party display colours (`party_colours.csv`) are defaults for the ten parties with the most
  seats, derived from each party's ORPP-registered colours and adjusted so they stay distinct and
  keep map labels legible (checked by `tests/js/party-colours.test.ts`). Every other party, and
  independents, show as neutral grey "Other". Edit the file and re-run the parties import to
  change them.
