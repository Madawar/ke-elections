# Sourced data

Facts the map shows, as CSV files that go through `php artisan data:import` (see
`docs/data-import.md`). Every row carries a `source_url`. Nothing here is invented; anything that
could not be confirmed is marked `confidence` medium or low with a note.

| File | What | Sources |
|---|---|---|
| `parties.csv` | Every party that won a seat in 2022 or since, with 2022 coalition, renames and ORPP colour text | ORPP register of fully registered parties (October 2026), ORPP coalition notices, Kenya Gazette |
| `holders/national_assembly.csv` | 290 MPs, 47 Woman Reps and 12 nominated MPs, elected 2022, with every by-election and change since | IEBC gazette notices 9950/9951, 10533–10535, 10537, 10710, 10083 and by-election declarations; cross-checked against parliament.go.ke member lists (Oct 2022 and 12 Aug 2026) |
| `holders/county_seats.csv` | 47 governors, 47 senators and 20 nominated senators, with changes since | IEBC gazette notices 9949, 9955, 10535, 10537; parliament.go.ke Senate list; Council of Governors (cog.go.ke) |

Holder names are given-name first, in the gazette's spelling; where Parliament spells a name
differently the row's `notes` say so. Parties are recorded as the party a person was elected or
nominated on, not later alignment.

Known gaps:
- One nominated MP seat (ANC) is vacant pending a court case over ANC's dissolution.
- Wiper is keyed `WDM-K` (its 2022 name); it is now Wiper Patriotic Front (WPF).
- Party display colours are not set yet (`party_colours.csv`); the map uses a colour-blind-safe
  palette by seats held.
