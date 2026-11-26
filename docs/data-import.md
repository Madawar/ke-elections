# Data import

Real parties, office holders and nominations enter the database only through
`php artisan data:import`. It reads a CSV from a cited source, checks every row, and imports
either all of the rows or none of them. Nothing is typed into the database by hand, and
nothing is made up (see `CLAUDE.md`).

## Commands

```bash
php artisan migrate
php artisan db:seed --class=UnitsSeeder                   # units, once (safe to re-run)

php artisan data:import parties     data/sources/parties.csv --dry-run
php artisan data:import parties     data/sources/parties.csv
php artisan data:import holders     data/sources/holders_2022.csv --dry-run
php artisan data:import holders     data/sources/holders_2022.csv
php artisan data:import nominations data/sources/nominations_2027.csv
```

Import the parties first, because holders and nominations look their parties up.
`--dry-run` checks the file and prints what would be created, updated or left unchanged,
but writes nothing, not even an import batch. When any row has an error, the command prints
every problem with its line number (the header is line 1), imports nothing, and exits with
code 1.

The `parties` import also takes `--colours=<path>` (see "Party colours").

## Units

`UnitsSeeder` fills `units` with 8 provinces, 47 counties, 290 constituencies and 1,450
wards. They come from `data/reference/iebc_wards_2027_gn13771.csv`, plus
`boundaries/overrides/provinces.csv` for which province each county is in. Each unit has
its parent's level and code. Re-running the seeder upserts on `(level, code)`.

Every import joins on `unit_level` + `unit_code`, the IEBC codes. Names never drive the
join.

## File formats

All dates are `YYYY-MM-DD`. Every row needs a `source_url` with an `http` or `https` URL.
The column order does not matter, but every listed column must be in the header. A column
that isn't listed is ignored, with a warning.

### parties

```
abbrev,name,status,coalition_2022,renamed_from,renamed_on,orpp_colours_text,source_url,notes[,display_colour]
```

- `abbrev`: unique, case-insensitive. `IND` is reserved for independents.
- `status`: as the ORPP register gives it, for example `fully registered`.
- `renamed_from` + `renamed_on`: the party's former abbreviation. It is stored in
  `party_aliases`, so older sources that use the old name still resolve, for example
  WDM-K → Wiper. A former abbreviation cannot also be a current party.
- `orpp_colours_text`: the colours registered with ORPP, kept as text for reference only.
- `display_colour` (optional): `#RRGGBB`.

### holders (office holders, such as the 2022 results)

```
seat,unit_level,unit_code,unit_name_in_source,holder_name,party_abbrev,party_name_in_source,basis,started_on,ended_on,confidence,source_url,notes
```

| seat | unit_level | unit_code |
|---|---|---|
| governor, senator, woman_rep | county | 1–47 |
| mp | constituency | 1–290 |
| mca | ward | 1–1450 |
| nominated_mca | county | 1–47 |
| nominated_mp, nominated_senator | national | 0 |

- `party_abbrev`: a party abbreviation or alias. Use `IND` for an independent, which is
  stored as `party_id = null`.
- `basis`: `elected` or `by_election` for elected seats, `nominated` for nominated seats.
  Governors can also have `succession`, which records a deputy governor who took over the
  seat (Constitution Art. 182).
- `ended_on`: leave it empty for a sitting holder. If you fill it in, it must be on or after
  `started_on`.
- `confidence`: `high`, `medium` or `low`.
- `unit_name_in_source` and `party_name_in_source`: copied from the source, for the
  reviewer. If the unit name doesn't loosely match the gazette name, you get a WARNING but
  the row still imports. The check ignores case and punctuation, and the words "ward",
  "county", "constituency" and "city".

### nominations (2027 and later)

```
election_year,seat,unit_level,unit_code,unit_name_in_source,candidate_name,party_abbrev,status,source_url,notes
```

`status` is one of `nominated`, `withdrawn`, `disqualified`, `elected` or `lost`. The seat
and unit rules are the same as for holders.

## Validation rules (errors)

- The unit code must exist in `units` for that level. `national` + `0` is allowed only for
  nominated MPs and Senators.
- The seat must match the level, as in the table above.
- The party must exist in `parties` or `party_aliases`, or be `IND`.
- `source_url` is required and must be an http(s) URL.
- Dates must be real `YYYY-MM-DD` dates, and `ended_on` can't be before `started_on`.
- Holders: an elected seat and unit can have at most one current holder (`ended_on` empty).
  This counts the holders already in the database as well as the file. To record a
  by-election, put the outgoing holder's row in the same file with `ended_on` filled in.
- Nominations: an elected seat and unit can have at most one `elected` candidate per year.
- No duplicate rows on the natural key (below).

## Re-imports, batches and audits

Each record is upserted on its natural key:

| kind | natural key |
|---|---|
| parties | `abbrev` (aliases: `alias`) |
| holders | seat + unit_level + unit_code + holder_name + started_on |
| nominations | election_year + seat + unit_level + unit_code + candidate_name |

The keys ignore case. If you import the same file again, nothing changes: every row is
reported as unchanged and no audit rows are written. If a row changes, the record is
updated in place. Rows that are missing from a new file are **not** deleted. To end a term,
set its `ended_on`.

Each import that is applied creates an `import_batches` row (kind, file, sha256, row count,
created/updated/unchanged counts, imported_at). Every record it creates or updates gets that
`import_batch_id`. The import also writes one row to `audits` (append-only) for each change,
with event `created` or `updated` and the record's `old` and `new` values as JSON.

## Party colours

Parties have no colour unless one is given, and the UI shows a party without a colour as
grey "Other". When `data/sources/party_colours.csv` (`abbrev,colour`, with colours as
`#RRGGBB`) exists, the parties import applies it, and it takes precedence over a row's
`display_colour`. Use `--colours=<path>` to read a different file.

## Public endpoint

`GET /data/seats.json` is public, read-only and cacheable (`Cache-Control: public,
max-age=300` with an ETag). It sends no cookies. It returns:

```json
{
  "as_of": "2026-11-26",
  "parties": [{"abbrev": "...", "name": "...", "coalition_2022": "...", "colour": "#rrggbb"}],
  "holders": [{"seat": "mp", "level": "constituency", "code": 1, "name": "...", "party": "...",
               "basis": "elected", "started_on": "2022-09-08", "source_url": "...", "confidence": "high"}],
  "totals": {"mp": {"<abbrev>": 0}},
  "chambers": {"national_assembly": {"<abbrev>": 0}, "senate": {"<abbrev>": 0}}
}
```

- `as_of`: the date of the latest parties or holders import, or `null` if there hasn't been
  one.
- `holders`: current terms only.
- Independents are counted under `IND`, which is added to `parties` when an independent
  holds a seat.
- `totals`: has an entry for every seat type.
- National Assembly = `mp` + `woman_rep` + `nominated_mp`. Senate = `senator` +
  `nominated_senator`. The Speakers are not counted.

## 2027: nominations, then winners

The 2027 data goes through the same command and the same checks:

1. While parties nominate candidates, import `nominations` with status `nominated`. As
   things change, update rows to `withdrawn` or `disqualified`. Re-importing the corrected
   file updates them in place, and each change is audited.
2. After the results, set each candidate's status to `elected` or `lost` in the
   nominations file and import it again.
3. To start the new terms, import a `holders` file with the 2027 winners. It must contain
   both:
   - the outgoing 2022 rows with `ended_on` filled in;
   - the new rows with `started_on` filled in and `ended_on` empty.

   The one-current-holder rule rejects a file that leaves both the 2022 and the 2027 holder
   current.
