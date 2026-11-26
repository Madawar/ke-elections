# By-elections: research and design

Prepared 2026-11-26 for Kenya Electoral Map (read-only research; nothing in the repo was changed).
Companion file: `found.csv` (same columns as `data/sources/holders/*.csv`, only rows confirmed from IEBC gazette PDFs).

Marking: **[gazette]** = read from the IEBC/Kenya Gazette PDF itself; **[press]** = news report only; **[unverified]** = could not confirm from a primary source.

---

## 1. Findings

### 1.1 By-elections held in 2026

The owner remembers two, but IEBC gazetted results for **three by-election polling days in 2026**, plus a fourth that is pending. All three are already in our CSVs and match the gazettes on name, party, date and code.

| Poll | Seat (IEBC code) | Winner, party, votes | Vacancy cause | Declaration |
|---|---|---|---|---|
| 26 Feb 2026 | MP Isiolo South (const 50, county 11) | Mohamed Tubi Tubi, UDA, 7,352 | Death of Mohamed Tubi Bidu (JP) [press] | GN 3105, Gazette Vol CXXVIII No 38, 3 Mar 2026 [gazette] https://www.iebc.or.ke/uploads/resources/43G2gsv56c.pdf |
| 26 Feb 2026 | MCA Muminji (ward 329, Mbeere North 66) | Peterson Njeru Njiru, UDA, 3,207 | MCA Newton Ndwiga resigned to contest the Nov 2025 Mbeere North MP by-election and lost [press] | GN 3105 [gazette] |
| 26 Feb 2026 | MCA Evurore (ward 330, Mbeere North 66) | Duncan Muratia Nyaga, UDA, 7,853 | MCA Duncan Mbui resigned to contest Mbeere North and lost [press] | GN 3105 [gazette] |
| 26 Feb 2026 | MCA West Kabras (ward 1002, Malava 201) | Elphas Kainanga Shalakha, UDA, 3,317 | MCA David Athman Ndakwa won the Malava MP by-election of 27 Nov 2025 [gazette GN 17611 + press] | GN 3105 [gazette] |
| 14 May 2026 | MP Emurua Dikirr (const 178, Narok 33) | David Kipsang Keter, UDA, 18,266 | Death of Johana Ng'eno, 28 Feb 2026 (helicopter crash); Speaker's notice 10 Mar 2026 [press] | GN 7394, Vol CXXVIII No 85, 19 May 2026 [gazette] https://www.iebc.or.ke/uploads/resources/bearFKfHLF.pdf |
| 14 May 2026 | MCA Porro/Poro (ward 665, Samburu West 133) | Daniel Lolngojine, UDA, 2,328 | Death of MCA Patrick Leerte (ANC), 28 Dec 2025; declared vacant 5 Jan 2026 [press] | GN 7394 [gazette] |
| 14 May 2026 | MCA Endo (ward 733, Marakwet East 147) | Festus Korir Kirop, UDA, 4,475 | Declared vacant 27 Jan 2026 [press]; death of MCA Jeremiah Kibiwott per The Star infographic [press, medium] | GN 7394 [gazette] |
| 16 Jul 2026 | MP Ol Kalou (const 91, Nyandarua 18) | Sammy Douglas Kamau Waweru, DCP, 35,440 (UDA runner-up 5,450; turnout ~57%) | Death of David Njuguna Kiaraho (JP), 29 Mar 2026; Speaker's notice ~20–22 Apr 2026 [press] | GN 11216, Vol CXXVIII No 123, 22 Jul 2026 (dated 21 Jul) [gazette] https://www.iebc.or.ke/uploads/resources/hlYWqNRqs2.pdf |

The Ol Kalou poll is the one most likely to be remembered as "the" by-election of 2026, because it was the opposition DCP's first seat. If the owner counts only constituency polls, there were still three: Isiolo South, Emurua Dikirr and Ol Kalou. Worth asking which "two" they meant.

Sources for the table: IEBC gazette list https://www.iebc.or.ke/resources/?Gazette_Notices= ; The Star "Seats up for by-elections in 2026" (18 Mar 2026) https://www.the-star.co.ke/news/infographics/2026-03-18-seats-up-for-by-elections-in-2026 (it wrongly puts Emurua Dikirr in Kajiado; the gazette says Narok 033) ; https://www.kenyans.co.ke/news/121694-iebc-schedules-may-14-elections-three-vacant-seats ; https://kenyantrend.com/2025/12/iebc-sets-february-26-2026-for-key-by-elections-in-three-counties/ ; https://allafrica.com/stories/202602170193.html ; https://www.the-star.co.ke/news/2026-04-26-iebc-schedules-ol-kalou-by-election-for-july-16 ; https://x.com/IEBCKenya/status/2077965009250828683 ; https://www.citizen.digital/news/porro-ward-mca-patrick-lerte-dies-while-undergoing-treatment-in-samburu-n374994 ; https://www.the-star.co.ke/news/2026-03-21-emurua-dikirr-seat-declared-vacant-after-ngenos-death ; https://eastleighvoice.co.ke/national/337253/speaker-wetangula-declares-ol-kalou-parliamentary-seat-vacant-following-death-of-mp-kiaraho

### 1.2 All by-elections since August 2022 (what our CSVs hold)

| Poll | Seats | Declaration | In our CSVs |
|---|---|---|---|
| 29 Aug 2022 | Postponed general-election polls (Mombasa and Kakamega governors, some MPs) | GN 10535 | Yes, as `elected` (correct: postponed, not by-elections) |
| 8 Dec 2022 | Senator Bungoma (Wetang'ula resigned before swearing in to become Speaker); 5 postponed wards (Kyome/Thaana, Oloimasani, Mumias North, South Gem, Utawala) | GN 15569 | Yes. The wards are `elected` although the gazette calls them by-elections. Correct. |
| 5 Jan 2023 | Senator Elgeyo Marakwet; MPs Garissa Township and Kandara; MCA Shella | GN 143 | Yes. **The senator row cites citizen.digital and says "IEBC declaration gazette not retrieved", but GN 143 (already in `raw_mca/`) has it in its First Schedule** (Kisang William Kipkemoi, UDA, 41,378). |
| Jan 2023–Jul 2025 | None. The IEBC had no commissioners, so it could not gazette by-elections. It was reconstituted in July 2025 and cleared the backlog on 27 Nov 2025. | — | The README's "MCA by-elections Jan 2023–Oct 2025 may be missing" gap is very likely empty. Cite https://citizen.digital/article/kenya-faces-constitutional-crisis-over-delayed-iebc-appointments-n353897 and https://www.kbc.co.ke/?p=110371 and close it. |
| 27 Nov 2025 (+ 29 Oct 2025 no-contest declarations) | 24 areas: Senator Baringo; MPs Banissa, Kasipul, Magarini, Malava, Mbeere North, Ugunja; 17 wards (Tembelio and Metkei unopposed, GN 15732) | GN 17611, corrigenda GN 17612 and GN 17614 | Yes, all 24 (17 wards counted). https://iebc.or.ke/news/?Commission_clears_181_candidates_to_contest_in_24_by-elections_in_November= |
| 26 Feb, 14 May, 16 Jul 2026 | See 1.1 | GN 3105, 7394, 11216 | Yes |

### 1.3 Gaps and inconsistencies in `data/sources/holders/*.csv`

1. **Migwani ward (338, Mwingi West 68, Kitui 15) is shown as held, but it has been vacant since 6 Aug 2026.** `mca.csv` line 344 still has Harrison Maluki Mawia (WDM-K) as the current holder. IEBC GN 15266 (Vol CXXVIII No 168, 23 Sep 2026) cites the Speaker's declaration of 6 Aug 2026 and Art. 194(1)(d), resignation. The press says he became Clerk of the Kitui County Assembly. Fix: set `ended_on=2026-08-06`, which is in `found.csv`. Once that is done, the seat has no current holder, and the import, the API and the UI all need a way to show a vacancy (see section 2).
2. **David Athman Ndakwa is recorded as holding two seats at once.** His MCA term for West Kabras ends 2026-02-26 (the by-election date, used as an upper bound), but his MP term for Malava starts 2025-11-27. His MCA term ended on or before 2025-11-27, and probably before nominations in Oct 2025. This was the only overlap a scan of all three CSVs found.
3. **Outgoing MCAs' `ended_on` is the by-election date, not the date the seat fell vacant.** This hides months of vacancy and overstates as-of counts. Better dates found so far:
   - Porro: death on 2025-12-28 [press].
   - Endo: declared vacant 2026-01-27 [press].
   - Muminji and Evurore: resigned before the 27 Nov 2025 poll [press, exact date unknown].
   - Migwani: 2026-08-06 [gazette].

   Update them to `confidence=medium`, with a note that the date is the vacancy date or an upper bound. Speaker vacancy notices are gazetted, and finding them is a follow-up task.
4. Elgeyo Marakwet senator: switch `source_url` to GN 143 (https://www.iebc.or.ke/uploads/resources/1I8vyxes9K.pdf). The row is in `found.csv`.
5. `data/sources/raw_mca/sources.csv` doesn't list GN 11216 (Ol Kalou) or GN 15266 (Migwani). Their sha256 values are in `found.csv`'s notes.
6. Fafi (155): the same person, Hassan Aden Kolosho, was elected in 2022 on UPIA and won the 2025 by-election on FORD-K. The data is right. It is the "same person, different party" case that "changes since 2022" must handle.
7. Not by-elections, but nearby events worth recording:
   - IEBC GN 15172 (Oct 2026), re-allocation of nominated MCA special seats: https://www.iebc.or.ke/uploads/resources/a4w8Rbqidf.pdf
   - GN 4233 (Apr 2026), clearance of a nominated Deputy Governor for Homa Bay. Deputy governors aren't tracked.
   - The ANC nominated-MP seat left vacant after Joseph Hamisi Denar died; the README already notes it.
8. Owner and coordinator note: Mzalendo (https://mzalendo.com/elections-2027/) shows 2022 ward results without the later by-elections. I could only check its landing page, which shows no by-elections. That makes a complete "changes since 2022" a real differentiator, so by-elections should be recorded thoroughly, including vacancy dates and causes.

### 1.4 Pending by-elections and current vacancies (as of 26 Nov 2026)

| Seat | Status | Sources |
|---|---|---|
| MCA Migwani (ward 338) | Vacancy declared 6 Aug 2026. GN 15266 set the poll for 17 Nov 2026 (nominations 21–22 Oct; campaign 21 Oct–14 Nov). Six candidates were cleared. The IEBC suspended the poll on 27 Oct after High Court orders of 22 Oct (petition by Francis Musili Kauta). Around 20 Nov the court reportedly lifted the orders, found no merit in the petition, and told the IEBC to resume from the 22 Oct stage. **No new poll date was in the IEBC gazette list as of today [unverified].** | GN 15266 [gazette]; https://www.the-star.co.ke/news/2026-09-23-migwani-ward-mca-by-election-set-for-november-17 ; https://nairobiwire.com/2026/10/iebc-suspends-migwani-ward-by-election-court-halts-poll.html ; https://peopledaily.digital/news/kitui-court-clears-iebc-to-proceed-with-migwani-ward-by-election (403 to our fetcher; search snippet only) |
| Nominated MP (ANC list) | Vacant pending the court case over ANC's dissolution. Party-list seat, so no by-election. | README; https://mbaitufm.com/wetangula-declares-parliamentary-seat-vacant-after-death-of-nominated-mp-denar-hamisi/ |
| Other elected seats | No other Speaker vacancy notices or IEBC by-election notices found for Aug–Nov 2026. The searches were limited, so this is [unverified]. | IEBC gazette list (checked 26 Nov 2026) |

### 1.5 How the by-election lifecycle is published

| Step | Who and where | Our examples and lead times |
|---|---|---|
| 1. Vacancy arises: death, resignation, appointment as CS, nullification upheld, MCA elected elsewhere, recall/removal | News; for an annulment, the court judgment (kenyalaw.org) | — |
| 2. Speaker's notice of vacancy | Speaker of the NA, Senate or county assembly, in the **Kenya Gazette** (Gazette Notice). Art. 101(4)(a): within 21 days, for MPs, Woman Reps and Senators. | Emurua Dikirr: death 28 Feb, notice 10 Mar (10 days). Ol Kalou: death 29 Mar, notice ~20–22 Apr (22–24 days). Migwani: Speaker 6 Aug. |
| 3. IEBC by-election notice and timetable | IEBC Gazette Notice, special issue, also uploaded to https://www.iebc.or.ke/resources/?Gazette_Notices= and summarised in iebc.or.ke/news and on X @IEBCKenya. It gives the poll date, the party-primary deadline, the nomination days, campaign period, dispute deadlines and the voter-register freeze. | GN 3391, 13 Mar 2026, 3 days after the Speaker, poll 62 days later. Ol Kalou ~26 Apr, poll 81 days later. GN 15266, 22 Sep, 47 days after the Speaker, poll 56 days later. |
| 4. Returning officers, polling stations, tallying centres, register certification | IEBC GNs, for example 6005–6010 (Ol Kalou), 825 (Feb 2026) | 1–3 weeks after step 3 |
| 5. Party-primary aspirant lists, independents' names and symbols | IEBC GNs, for example 4987 (UDA, May 2026), 6560–6561 (Ol Kalou), 15972 (Migwani) | 2–4 weeks after step 3 |
| 6. Nominations by the Returning Officer; nominated candidates gazetted; no-contest declarations | IEBC GNs, for example 1720–1723 (Feb 2026), 8408–8411 (Ol Kalou), 15731–15734 (Nov 2025, including no-contest) | Nominations about 4–7 weeks before the poll. Candidate gazette 10 days to 5 weeks before it. |
| 7. Poll; results forms | Forms 35A/B (MP), 36A/B/C (MCA), 38 (Senator), 39 (Woman Rep), 37 (Governor) on the IEBC results portal (forms.iebc.or.ke); declaration at the tallying centre by the Returning Officer, announced on X. The exact letter of the final declaration form varies by source [unverified]. | Same day or next day |
| 8. Declaration of persons elected | IEBC GN "Declaration of persons elected in the by-elections held on …", Kenya Gazette special issue, plus corrigenda | 5–6 days after the poll (GN 3105: +5; GN 7394: +5; GN 11216: +5 to +6; GN 17611: +4) |
| 9. Swearing-in; election petition window (28 days) | Parliament or county assembly Hansard; High Court | Isiolo South sworn in 5 Mar 2026, 7 days after the poll |

Where to find the documents:
- IEBC gazette PDFs: https://www.iebc.or.ke/resources/?Gazette_Notices= (the source we already use).
- The full Kenya Gazette, including Speaker notices: https://new.kenyalaw.org/gazettes/ and https://archive.gazettes.africa/ (already used in `county_seats.csv`).
- Press releases: https://www.iebc.or.ke/news/

### 1.6 Constitutional and statutory timing rules

- **MPs, Woman Reps, county Senators (Art. 101(4)):** (a) the Speaker notifies the IEBC within 21 days of the vacancy; (b) the by-election is held within 90 days of the vacancy. **Art. 101(5): a vacancy "shall not be filled within the three months immediately before a general election."** Source: https://klrc.go.ke/index.php/constitution-of-kenya/123-chapter-eight-the-legislature/part-2-composition-and-membership-of-parliament/269-101-election-of-members-of-parliament
- **The IEBC often runs past 90 days.** Ol Kalou took 109 days, Isiolo South about 106 days, and the 2025 backlog over two years. In Aug 2025 the IEBC relied on Art. 259 to argue that the time limit flexes: https://www.kbc.co.ke/?p=110371 . So the 90-day rule is a **warning** in our validator, never an error.
- **MCAs (Art. 177(1)(a), 193, 194):** Art. 194 lists the grounds for a vacancy (death, absence, resignation in writing, party defection and so on). The IEBC says the Constitution sets **no timeline** for MCA by-elections (KBC, above). In practice the poll comes 3–5 months after the vacancy: Porro about 4.5 months, Endo about 3.5, Migwani over 3. Whether the County Governments Act or Elections Act has its own bar before a general election is **[unverified]**.
- **Governor (Art. 182):** the deputy governor takes over. That is `basis=succession`, as with Meru in 2025, not a by-election. An election is needed only if both offices are vacant: within 60 days, per Art. 182(5) [unverified wording].
- **Nominated seats (party lists, Art. 90; Elections Act s.34–37):** filled by the party's next nominee. The IEBC gazettes the replacement. **Never a by-election.**
- **What this means now:** the general election is on **Tuesday 10 Aug 2027** (IEBC GN 12251 and GN 13497–13503, https://www.iebc.or.ke/uploads/resources/3MMJlcBEs1.pdf).
  - No MP, Woman Rep or Senator by-election can be held from about **10 May 2027**.
  - Recent lead times were 75–110 days from vacancy to poll. So a parliamentary vacancy arising after roughly **mid-February 2027** will probably stay vacant until the general election. That is an inference; the IEBC will decide case by case.
  - Vacancies arising now, in Nov 2026 to Jan 2027, can still be filled, with a poll by about early May 2027.
  - The UI needs a terminal state: "Not filled before the 2027 general election."

---

## 2. Design

### 2.1 Data model

Terms alone (`office_holders`) are almost enough to show who held a seat and when. They can't represent:
- a vacancy, which is a period with no term;
- a scheduled, suspended or failed poll;
- gazette references for each stage, turnout and candidates.

Encoding these as fake "Vacant" holder rows would break the rule against inventing people, and every count would have to filter them out. **Recommendation: keep `office_holders` as the single record of who held a seat. Add a small `by_elections` table for the contest. Add an end reason to terms.**

```
by_elections
  id
  seat                 enum (elected seats only: governor, senator, woman_rep, mp, mca)
  unit_level, unit_code
  vacancy_on           date null      -- when the seat fell vacant (death, resignation…), if known
  vacancy_declared_on  date null      -- Speaker's declaration
  vacancy_cause        enum: died, resigned, appointed (CS/public office), nullified, elected_elsewhere,
                             removed (impeached/recalled/Art.194 grounds), resigned_before_swearing_in, other
  status               enum: vacancy_declared, scheduled, nominations_closed, suspended, polled,
                             declared, uncontested, not_held (overtaken by the general election), cancelled
  poll_on              date null      -- current scheduled or held poll date (may change while suspended)
  registered_voters, votes_cast  int null   -- turnout = votes_cast / registered_voters, only when both sourced
  vacancy_notice_ref / _url          -- Speaker's Kenya Gazette notice
  schedule_notice_ref / _url         -- IEBC notice with the date and timetable (GN 15266)
  candidates_notice_ref / _url       -- IEBC nominated-candidates notice (GN 8408–8411)
  declaration_notice_ref / _url      -- IEBC declaration (GN 11216)
  outgoing_holder_id   FK office_holders null   -- the term that ended (null for postponed/first polls)
  incoming_holder_id   FK office_holders null   -- the winner's term (set when declared)
  confidence, source_url (primary), notes, import_batch_id, timestamps
  unique (seat, unit_level, unit_code, vacancy_declared_on)  -- natural key (the poll date can move)
```

Changes to `office_holders`, in a new migration that adds columns and leaves existing data alone:
- `end_reason` (null for a current holder): the same values as `vacancy_cause`, plus `term_ended` (2027) and `party_list_replaced`.
- `ended_on_kind`: `exact` or `upper_bound`. Today's MCA rows say "the by-election date"; mark those `upper_bound`, so the UI can say "until at the latest …".
- `basis` stays: `elected`, `by_election`, `nominated`, `succession`. The link to the contest is `by_elections.incoming_holder_id`. No new FK on the term.

`nominations` gets a nullable `by_election_id`.
- When it is null, the row is a general-election nomination, as now (`election_year`).
- When it is set, the row belongs to that by-election. `election_year` becomes the poll year.
- The natural key becomes `(by_election_id ?? election_year, seat, unit, candidate_name)`.

`NominationStatus` already covers `nominated`, `withdrawn`, `disqualified`, `elected` and `lost`, and works unchanged. The by-election's winner nomination (`elected`) and `incoming_holder_id` must agree. That is a validation check.

**Vacancy without inventing anyone:**
- A seat is vacant on date D when no term for (seat, unit) covers D, where a term covers `started_on <= D < ended_on`.
- Today it is vacant when no term has `ended_on IS NULL`.
- The `by_elections` row says why it is vacant and what happens next.
- A vacancy with no `by_elections` row is a data-check failure ("seat with no holder and no recorded vacancy"), not a public state.

**Changes since 2022, computed from terms only:**
- **Baseline** per seat and unit: the term with `basis=elected` from the 2022 general election (poll 9 Aug, 29 Aug or 8 Dec 2022).
- **Changed:** any later term, or a current vacancy.
- **Classify each change:**
  - `party_changed`: the current holder's party differs from the baseline party (party as elected on; IND counts as a party for this).
  - `same_party_new_person`.
  - `same_person_reelected`: Magarini re-run (same party); Fafi re-elected on another party, which counts as `party_changed`.
  - `vacant_now`.
  - `succession`: Meru.
- Nominated seats are excluded from "changes", or shown separately as list replacements. They are not by-elections.

### 2.2 Import and verification

New kind: `php artisan data:import by_elections data/sources/by_elections.csv [--dry-run]`. The order is parties, then holders, then by_elections, then nominations. It reuses `CsvFile`, `ImportReport`, batches and audits.

```
seat,unit_level,unit_code,unit_name_in_source,outgoing_holder_name,vacancy_cause,vacancy_on,vacancy_declared_on,
vacancy_notice_ref,vacancy_notice_url,status,poll_on,schedule_notice_ref,schedule_notice_url,candidates_notice_ref,
candidates_notice_url,declaration_notice_ref,declaration_notice_url,winner_name,registered_voters,votes_cast,
confidence,source_url,notes
```

Errors (the whole file is rejected, as now):
- The unit code must exist for the level. The seat must be elected: a `nominated_*` seat is an error saying "party-list seats are filled from the list, not by by-election".
- Dates must be in order: `vacancy_on <= vacancy_declared_on <= poll_on`.
- `status=declared` or `uncontested` requires `declaration_notice_ref`, a `_url`, and `winner_name`. A holder with `basis=by_election` must exist for that seat and unit with `started_on = poll_on`, or the declaration date when uncontested (Tembelio, Metkei), and the name must match ignoring case.
- `outgoing_holder_name` must match a term for that seat and unit whose `ended_on` is no later than `poll_on`. Join on seat + unit + date; the name is only a cross-check.
- A seat and unit can have at most one open by-election (status not declared, uncontested, not_held or cancelled).
- For Art. 101 seats, `poll_on` must be before (general election − 3 months). The general-election date lives in config, `elections.next_general = 2027-08-10`.

Warnings (the file still imports):
- Art. 101 seats: more than 90 days from `vacancy_on` to `poll_on`.
- No `vacancy_on`, so the vacancy length is unknown.
- The outgoing term's `ended_on` is later than `vacancy_on` (an upper bound).
- A person holding two elected seats at once, which catches the Ndakwa overlap.
- A governor by-election while the deputy governor is not also vacant.

Holders import, an extra check: a term with `basis=by_election` should have a matching `by_elections` row. This is a warning at first, so the existing CSVs still import; it becomes an error once `by_elections.csv` is backfilled.

Sources: each by-election stage cites the IEBC or Kenya Gazette PDF. Press reports are allowed only for `vacancy_on` and `vacancy_cause`, with `confidence=medium`. Downloaded PDFs are listed in `data/sources/raw_mca/sources.csv`, which should be renamed `raw/` because they're no longer MCA-only, with sha256 as now.

Admin review table (Phase 2), new tabs and filters in the Filament data-checks view:
- **Vacant seats:** seats with no current holder, joined to `by_elections` for status, poll date and a link. It also flags vacancies with no by-election row.
- **Changed since 2022:** every non-baseline current term, with its change class, filterable by seat, county and party.
- **By-elections:** a list with stage refs. "Missing declaration gazette" and "past poll date but not declared" are the most useful chase-up filters.
- **Overlapping terms:** the same person in two seats at once, or two terms covering one seat.
- **Upper-bound end dates:** terms whose `ended_on_kind=upper_bound`, so they can be improved from Speaker notices.

Every create and update is audited through `audits`, as for holders. Rollback is a new audited change.

### 2.3 Public API

- `/data/seats.json` gains:
  - On each current holder that came in by by-election: `by_election: {poll_on, declaration_ref, declaration_url}`.
  - A new `vacancies` array: `{seat, level, code, since, since_kind, cause, by_election: {status, poll_on, schedule_url} | null}`.
  - `totals` and `chambers` stay counts of seated members, plus a new `vacant: {mp: 0, mca: 1, …}`, so the hemicycle can draw a neutral "Vacant" wedge.
  - `data_as_of` should also consider `by_elections` dates.
- New `/data/history.json`, public and cached like seats.json, loaded lazily when the panel timeline or the Changes layer opens. It holds every term, ended ones included (about 2,000 rows), and every by-election. The client computes "as of D" counts and "changes since 2022" from it, so no server parameter is needed and caching stays simple.

### 2.4 Public UI

All UI stays neutral: no party colours in badges, no gradients or emoji. Dates read "14 May 2026".

- **Seat row in the unit panel:**
  - The holder's name and party, then a plain-text badge "By-election 14 May 2026" that links to the declaration gazette.
  - Under it, a collapsible "Earlier": "Johana Ng'eno Kipyegon (UDA), elected 9 Aug 2022, until 28 Feb 2026 (died)".
  - When the end date is an upper bound: "until 26 Feb 2026 at the latest".
- **Vacant seat row:**
  - "Vacant since 6 Aug 2026 (resigned)".
  - Then one of:
    - "By-election on 17 Nov 2026";
    - "By-election suspended by court order (22 Oct 2026)";
    - "Not filled before the 2027 general election";
    - "No by-election date yet".
  - Each links to its gazette. The map paints vacant units in a neutral hatched pattern, not a party colour or "no data" grey, and the legend has a "Vacant (1)" row.
- **Changes since 2022:** a colour-by mode or filter in `LayersPanel`.
  - Units are tinted by change class: party changed, same party new person, vacant now. Unchanged units fade.
  - The legend counts each class. Example: "MP seats changed since 2022: 13 (4 to a different party)". Compute the real numbers from the data.
- **Timeline per unit:** a compact list in the panel. For Ol Kalou: "9 Aug 2022: elected (JP)", then "29 Mar 2026: died", "20 Apr 2026: Speaker declares vacancy", "16 Jul 2026: by-election, DCP". Each entry has its source.
- **Search:** results include vacancies ("Migwani, MCA seat vacant") and former holders, labelled "former MCA, Migwani (until 6 Aug 2026)".
- **In-power counts and "as of":** the National Overview and the "In power now" card say "as of <date>" and show vacant seats explicitly. An optional date picker or "on date" mode recomputes from history.json, which lets the "Incoming vs outgoing" view later compare 2022 with now.
- **Infographics:**
  - A "Seats that changed hands since 2022" card: a table of seat, unit, 2022 party, current party and date, grouped by seat type, with the source footer.
  - A "By-election result" card for one unit: winner, party, votes from the gazette, previous holder, turnout only if sourced, and the declaration GN.
  - Both carry "Approved data as of …" and the sample watermark rules, as now.

### 2.5 Nominations interplay

A by-election is a small election, so it reuses the 2027 machinery:
- Nominations rows with `by_election_id` hold candidates from the IEBC nominated-candidates gazette (for example GN 15731 or GN 8408) and party-primary notices. Statuses are `nominated`, `withdrawn`, `disqualified`, then `elected` or `lost` after the declaration.
- The candidate page (`/candidate/<id>`) shows "Candidate, MCA by-election, Migwani, 17 Nov 2026 (suspended)", with a link to the by-election.
- The party page lists by-elections contested, won and lost since 2022 under its own heading, separate from the 2027 nominations.
- The unit panel's "Nominees" section shows by-election candidates while a by-election is open, then switches to the 2027 nominees.
- The "Nominees for <seat> in <unit>" share card works for a by-election too, titled with the poll date.

### 2.6 Edge cases

| Case | Handling |
|---|---|
| Seat vacant on an as-of date | No term covers D, so it counts as "vacant" in that day's counts and is never assigned to a party. |
| By-election won by the same party | `same_party_new_person`. It is still a change in the timeline but isn't counted in "changed party" totals. Example: Garissa Township UDA to UDA. |
| Same person re-elected | Magarini: the old term ends 2024-05-31 (annulment upheld, `end_reason=nullified`). Vacant until 27 Nov 2025, then a new term for the same name. Class `same_person_reelected`. |
| Same person, new party | Fafi: UPIA in 2022, FORD-K in 2025. Class `party_changed`. |
| Nullified and re-run, or the by-election result itself annulled | The first by-election row becomes `declared`. A later annulment ends the winner's term (`nullified`) and opens a new `by_elections` row. |
| Uncontested ("no contest") | `status=uncontested`. The term starts on the IEBC declaration date (GN 15732, 29 Oct 2025), and the badge reads "Elected unopposed 29 Oct 2025". |
| Postponed 2022 polls (29 Aug, 8 Dec 2022) | `basis=elected`. They are not by-elections and are part of the baseline, even when the gazette says "by-election". |
| Nominated seats replaced or reallocated (GN 15172, Orwoba, Mbadi, the ANC seat) | Not by-elections. The `nominated` term ends with `end_reason=party_list_replaced`. They are shown under "Nominated members", never on the Changes map. |
| Deputy governor takes over | `basis=succession`, not a by-election (Meru 2025). Deputy-governor nominations (Homa Bay 2026) are out of scope. |
| Died or resigned before swearing in | The term exists from the declaration (Wetang'ula, Bungoma senator, 2022), with `end_reason=resigned_before_swearing_in` or `died`. The by-election row links it as outgoing. A future `sworn_in_on` column is optional. |
| MCA elected to Parliament in a by-election | Ndakwa: the MCA term ends by the MP poll date at the latest, and the cascade by-election (West Kabras) links to it. The overlap check catches mistakes. |
| Resign to contest | Muminji and Evurore: `end_reason=resigned`, with the vacancy before the other poll. |
| Vacancy inside the 3-month bar before 10 Aug 2027 | `status=not_held`. "Vacant until the 2027 general election." It ends when the 2027 terms are imported. |
| Court suspends a poll | `status=suspended`, with `poll_on` kept and a note. A resumed date is a new IEBC notice, which updates `poll_on` and the refs, all audited. |
| Unit codes printed wrong in the gazette | Same as now: fix the row, keep the printed value in notes (Ugunja printed as 223). |

---

## 3. Implementation tasks

1. **Data fixes** in `data/sources/holders/mca.csv` and `county_seats.csv`:
   - Migwani (338): set `ended_on=2026-08-06` (row in `found.csv`).
   - Elgeyo Marakwet senator: `source_url` to GN 143.
   - West Kabras (Ndakwa): `ended_on` on or before 2025-11-27, confidence medium.
   - Porro (2025-12-28) and Endo (2026-01-27): `ended_on`, medium.
   - Close the README gap about MCA by-elections Jan 2023–Oct 2025, with the IEBC-quorum explanation.
   - Add GN 11216 and GN 15266 to `raw_mca/sources.csv`.
2. **Migrations:**
   - `database/migrations/2026_11_27_000001_create_by_elections_table.php`
   - `…_000002_add_end_reason_to_office_holders_table.php`, adding `end_reason` and `ended_on_kind`
   - `…_000003_add_by_election_id_to_nominations_table.php`
3. **Domain:**
   - `app/Enums/ByElectionStatus.php` and `app/Enums/VacancyCause.php`
   - `app/Models/ByElection.php`, with relations to the outgoing and incoming `OfficeHolder` and to `Nomination`
   - Add `scopeCoveringDate($d)` and `endReason` to `app/Models/OfficeHolder.php`
   - Put `config('elections.next_general')` in `config/elections.php`
4. **Import:**
   - `app/Imports/ByElectionsImporter.php`, with the errors and warnings from 2.2
   - Register the `by_elections` kind in `app/Console/Commands/DataImport.php`
   - Add the overlap and by_election-link warnings to `HoldersImporter.php`
   - Update `docs/data-import.md`
   - Write `data/sources/by_elections.csv`, backfilled with all 37 by-elections since 2022 plus Migwani
   - Tests: `tests/Feature/ByElectionsImportTest.php`
5. **API:**
   - `app/Http/Controllers/Data/SeatsController.php`: `vacancies`, `vacant` counts, `by_election` on holders.
   - New `app/Http/Controllers/Data/HistoryController.php` serving `/data/history.json`, routed in `routes/web.php`.
   - Tests in `tests/Feature/SeatsEndpointTest.php` and a new `HistoryEndpointTest.php`.
6. **Frontend logic:**
   - `resources/js/lib/seats.ts`: `Vacancy` type and a vacant fill in `seatColouring` and the legend.
   - New `resources/js/lib/history.ts`: `loadHistory`, `holdersOn(date)`, `changesSince2022()`, `unitTimeline()`.
   - Tests in `tests/js/history.test.ts` and `tests/js/seats.test.ts`.
7. **UI:**
   - `resources/js/components/map/UnitPanel.vue`: badge, "Earlier", vacancy row, timeline.
   - `LayersPanel.vue` and `Legend.vue`: "Changes since 2022" mode and the Vacant row.
   - `Hemicycle.vue` and `NationalOverview.vue`: vacant wedge, as-of.
   - `SearchBox.vue` and `resources/js/lib/search.ts`: vacancies and former holders.
8. **Admin (Phase 2):** Filament data-check tabs "Vacant seats", "Changed since 2022", "By-elections", "Overlapping terms" and "Upper-bound end dates".
9. **Exports (Phase 2 or later):** cards for "Seats that changed hands since 2022" and "By-election result" under `resources/js/components/export/`.
10. **Watch list (ongoing):**
    - Check the IEBC gazette list weekly until 10 May 2027 for new Speaker vacancy notices, by-election notices and declarations.
    - Next expected: a revised Migwani timetable, then its declaration.
