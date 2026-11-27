# Mzalendo and other record links: findings

Checked 27 November 2026 against the live sites. Nothing here changes the app or its data. We read pages and files only, one request at a time, and only the paths Mzalendo's robots.txt allows (details below).

## Verdict

**Link out only. Build the link file with automatic candidates plus a human check, and do not copy Mzalendo's numbers into our app.**

- Linking to a public page is safe. Mzalendo publishes no licence, so reusing its figures, tables or CSVs is not.
- Effort: about one working day for one reviewer for the first full file (415 current holders), then minutes per by-election. See "Effort" below.
- Attendance cannot be shown from anyone's data today. Mzalendo says it does not have Parliament's attendance register, and we found no official attendance register on parliament.go.ke.

## 1. What Mzalendo publishes

Owner: Mzalendo Trust ("A Kenyan non-partisan parliamentary monitoring organisation publishing Parliament's own record", from the site's own page metadata). Footer: "© Mzalendo Trust. All Rights Reserved."

### Coverage

| Question | Finding |
|---|---|
| 13th Parliament? | Yes. National Assembly page says "13th Parliament: 349 members shown". Senate page says "13th Parliament: 68 members shown" (67 plus the Speaker). Records run to November 2026 (home page shows the newest record dated 25 Nov 2026). |
| MPs and Senators? | Yes, one profile page per member, including Woman Reps and nominated members. |
| MCAs / county assemblies? | No. We found no MCA or county assembly profile pages. The only ward-level material is IEBC gazette documents under /electoral-reforms/documents/. The sitemaps list no county assembly member pages. |
| Counties and constituencies? | Yes. 47 county pages (/mps-performance/counties/{county}/) and 290 constituency pages (/research-and-knowledge/constituencies/{constituency}/) which name the MP, Senator and Woman Rep. |
| NG-CDF? | Yes. 290 pages, /public-finance/ngcdf/{constituency}/, showing the NG-CDF Board's approved allocation by year (for example Changamwe KSh 192,613,248 for FY 2025/26) and stating it is not a record of money released or spent. |

### What a member's profile shows (read on Omar Mwinyi, Babu Owino and Edwin Sifuna)

- At a glance: bills sponsored, contributions in Hansard, committees, questions, petitions, votes recorded.
- Ranking among 348 National Assembly members (67 Senators for the Senate), each measure ranked separately with "no overall score": contributions, divisions voted in, bills sponsored, motions/questions/petitions/statements, papers laid.
- Voting record per division, committee membership and committee reports, bills, motions, questions, statements, and "named by other members in N passages across N sittings".
- Background (education, career) and the 2022 result with the Gazette notice (for example "Gazette Notice 9950").
- Links to the official Parliament profile page.
- A link "Download contributions (CSV)" whose target is `?format=csv&what=contributions`.

### Attendance and sittings

- Each profile says: "Attendance at sittings: we do not hold Parliament's attendance register, so no attendance figure is shown."
- It also says: "Parliament publishes no committee attendance for either House, so nobody can count it, us included."
- What Mzalendo does show is not attendance: contributions made, divisions voted in (for Changamwe's MP the constituency page shows "8/8 Divisions attended", which is a count of votes, not of sittings present), and how often other members named the person in debate across N sittings.
- The "Annual Parliamentary Scorecard" page (/research-and-knowledge/scorecard/) lists reports for 2013 to 2019 (older Parliaments), not the 13th Parliament.

### URLs: stable, per person, and the pattern

| Item | Pattern | Stable? |
|---|---|---|
| National Assembly member | `/mps-performance/national-assembly/13th-parliament/{slug}/` | Per person and permanent-looking, but the slug cannot be built from a name. |
| Senator | `/mps-performance/senate/13th-parliament/{slug}/` | Same. |
| County | `/mps-performance/counties/{county}/` | Name slug, easy to build. |
| Constituency | `/research-and-knowledge/constituencies/{constituency}/` | Name slug, easy to build, but spelling differs from ours in a few cases (for example mount-elgon). |
| NG-CDF | `/public-finance/ngcdf/{constituency}/` | Name slug. The page says the record is "Constituency ID 1, named CHANGAMWE in the source", which is the NG-CDF Board's own ID. |
| Listing pages | `/mps-performance/national-assembly/?page=N` (8 pages) and `/mps-performance/senate/13th-parliament/senators/` (all 68 on one page) | Page layout can change. |

Slug pattern is mostly surname first, then other names (`omar-mwinyi-shimbwa`, `babu-owino-paul-ongili`), but with many exceptions: `anthony-kimani-ichungwah`, `hussein-weytan` (display name "Hussein Weytan"; Parliament and our data write "Husseinweytan Mohamed Abdirahman"), `eric-wamumbi` (Parliament and our data use Kahugu), `okiya-omtatah-okoiti` (display name "Okoiti Andrew Omtatah"), `nuh-junet`. Do not generate slugs. Copy them from Mzalendo's listing and check them.

Mzalendo's pages carry no IEBC code. Their own join is by constituency or county name. Our join must be done on our side: our code to their constituency name, then to their slug.

### API and data

- No documented API. We tried /api/ and /developers/ and both return 404.
- RSS feeds exist and are linked from every page: Bills (/feeds/bills.xml), divisions (/feeds/divisions.xml), Hansard sittings (/feeds/hansard.xml) and news (/feeds/posts.xml). We read the Hansard feed header only.
- `sitemap.xml` and `sitemap-data.xml` list public URLs (363 National Assembly profile URLs, 73 Senate profile URLs, 290 constituency, 290 NG-CDF, 48 county pages).
- CSV download of contributions per member exists on the page, but see robots below.

### Terms of use and licence

- Terms of Service page (https://mzalendo.com/terms-of-service/): "This Terms of Service is being finalised by Mzalendo Trust and will be published here shortly." It contains nothing on linking, reuse, scraping or attribution.
- Data Policy page (https://mzalendo.com/data-policy/): the same draft notice. It says Mzalendo uses "the parliamentary data on this platform solely to promote open, inclusive and accountable governance."
- No open licence (no Creative Commons or similar) anywhere we looked. The footer says all rights reserved.
- Contact given on the Terms page: info@mzalendo.com, +254 (0)726 464 063.
- robots.txt (https://mzalendo.com/robots.txt), for all crawlers: allows everything except `/admin/`, `/global-search/`, any URL with a query string other than a plain `?page=N` on listing pages, and `/*?format=csv`. So the CSV download links are off limits to crawlers. Several bots (CCBot, Bytespider, AhrefsBot, SemrushBot) are blocked entirely.
- What we did: fetched robots.txt, both sitemaps, the National Assembly listing pages 1 to 8, the Senate listing, and 10 profile pages, one request at a time with pauses. We did not request any CSV, search, or filtered URL.

What this means for us:

1. Linking to a profile is fine under any reading.
2. Reusing their figures (contributions, rankings, allocations) or their CSV needs written permission, because there is no licence. Ask info@mzalendo.com. Until they answer, do not republish any number.
3. Do not run a crawler against profile pages on a schedule. The one-time listing read described below is the lightest way to get slugs. Ask Mzalendo first if you want a refresh job.
4. Read their terms again when they publish the final version.

## 2. Other sources for sittings and attendance

| Source | What it has | Attendance? |
|---|---|---|
| parliament.go.ke Hansard, https://www.parliament.go.ke/the-national-assembly/house-business/hansard | Hansard PDFs for each sitting of the 13th Parliament (2022-2027), newest Thursday 19 November 2026 (evening sitting); filter by Parliament. | No list of members present. Hansard records speeches. |
| parliament.go.ke other house business | Order papers, votes and proceedings (/votes-proceeding), bill tracker, motion tracker, petitions, statement tracker, question tracker. | We did not find an attendance register in the menu. We could not read the PDFs ourselves (compressed binary), so we cannot rule out attendance notes inside them. |
| parliament.go.ke member pages, e.g. https://www.parliament.go.ke/the-national-assembly/hon-shimbwa-omar-mwinyi-0 | Constituency, party, education and career. | No. |
| Parliament list of members by party as at 12 Aug 2026 (PDF) | Name, constituency, party for every NA member. We used it to cross-check the sample. | No. |
| Senate, https://www.parliament.go.ke/the-senate/senators | Senator pages with county and party. | No. |
| Nairobi City County Assembly, nairobiassembly.go.ke | Hansard PDFs for 2014 to July 2026 (a search found them; each has a disclaimer that the online copy is for information and the Hansard Editor issues the certified version). | No attendance list found. |
| Other county assemblies | Not checked individually. Do not assume any other county publishes anything. | Unknown |

We found no terms page on parliament.go.ke that sets out reuse conditions, so we also treat Hansard as link-only.

Official route for attendance: Article 35(1)(a) of the Constitution gives every citizen the right of access to information held by the State. A request to the Clerk of the National Assembly and the Clerk of the Senate for attendance registers is the lawful way to get them if they exist. Nothing we found says whether they do.

## 3. Feasibility of linking

### Proposed file: `data/sources/links/mzalendo.csv`

Reviewed by a human, committed to the repo, imported like the holders files.

| Column | Meaning |
|---|---|
| seat | `mp`, `woman_rep`, `senator`, `nominated_mp`, `nominated_senator` (same values as the holders files) |
| unit_level | `constituency`, `county` or `national` (from our holders file) |
| unit_code | IEBC code from our holders file. The join key. Blank for nominated members. |
| holder_name | Name exactly as in our holders file (for the human check only; never used to join) |
| mzalendo_url | Full URL of the profile page |
| mzalendo_name_shown | Name on the Mzalendo page (to show why it differs) |
| name_match | `exact`, `reordered`, `alias` or `manual` |
| verified_on | Date the page was opened and checked |
| verified_by | Reviewer initials |
| source | The Parliament page or list used for the cross-check |

Rows are keyed by seat plus unit_code (nominated members by holder row id). When the holder changes in `holders/*.csv` (by-election, death), the link row for that seat becomes stale and must be removed and redone. A check in the importer can compare holder_name with the holders file and fail loudly if they differ.

### How much is automatic

We ran a trial in a scratch folder, read-only against our CSVs. Mzalendo's listing pages show "MP for {constituency} constituency", "Woman Representative for {county}", and for Senators the county. Matching those names to our `unit_name_in_source` gives:

| Seat | Current holders in our data | Matched to a profile by unit name | Name also agrees (score 0.67 or higher) | Needs a person |
|---|---|---|---|---|
| MP | 290 | 287 | 282 | 8 (3 unmatched only by spelling: our source says Kibwei East, Endebes and Mt Elgon, Mzalendo says Kibwezi East, Endebess and Mount Elgon; 5 name mismatches) |
| Woman Rep | 47 | 46 | 46 | 1 (Nairobi City vs Nairobi) |
| Nominated MP | 11 | by name only (no unit) | 11 | 0 |
| Senator | 47 | 47 | 45 | 2 (Taita Taveta has two candidates; Tharaka-Nithi uses a nickname) |
| Nominated Senator | 20 | by name only | 15 | 5 |
| Total | 415 | | 399 | 16 |

(The three unmatched MP seats are spelling differences only. On Mzalendo's listing the holders' names are Mbalu Jessica Nduku Kiko (Kibwezi East), Pukose Robert (Endebess) and Fred Kapondi (Mount Elgon), which agree with ours. We opened only the Mt Elgon page. Matching against the spelled names in `data/reference/iebc_wards_2027_gn13771.csv` instead of `unit_name_in_source` may remove these, but we did not test that.)

So the matching is automatic plus checking: a script proposes 399 rows and flags 16, and a person opens each proposed link. A high name score is not proof: in the trial the "Taita Taveta" Senator had two candidate profiles, and "Hussein Weytan" scored 0 against "Husseinweytan Mohamed Abdirahman" but is correct (confirmed against Parliament's list).

### Sample: 10 rows, each opened and checked

See `mzalendo-sample.csv`. Six MPs and four Senators, chosen to include the awkward cases (aliases, a fused name, a constituency that failed automatic matching, a county with two candidates). Each Mzalendo page was opened (HTTP 200) and its name, seat and party read, then cross-checked against Parliament's own list of members by party (12 Aug 2026) for MPs and Parliament's own Senator page for Senators.

Result: 10 of 10 confirmed as the person in our holders file. 4 of 10 differ in name (Mandera East, Mathira, Tharaka-Nithi and Kikuyu spelling) and would have been missed or mis-flagged by name matching alone. Our data and Parliament differ slightly on one spelling (Mathira, "Mwangi" vs "Meangi"): we did not change anything and a human should check that against the Gazette.

Side finding for the data team: Parliament's list shows the Mt Elgon MP as "Chesebe, Fred Kapondi", while Mzalendo's profile says no gazetted 2022 result is linked. Our row is sourced to the IEBC gazette, so no action is needed here.

### Effort for all 349 MPs and 67 Senators

(Our current counts are 290 MPs, 47 Woman Reps and 11 nominated MPs; 47 Senators and 20 nominated Senators. That is 415 rows. The 349 and 67 in the brief include the Speakers and one vacant nominated MP seat.)

| Task | Time |
|---|---|
| Script to read the listing pages once and propose rows (reusing the approach in the trial) | 2 to 3 hours |
| Human opens the 399 confident rows and compares name, seat and party (about 30 seconds each, using the page and Parliament's list) | about 4 hours |
| Human resolves the 16 flagged rows (about 3 minutes each) | about 1 hour |
| Review, import test, importer check for stale rows | 2 hours |
| Total, first time | about 1.5 working days including the script, about 1 day for the human check alone |
| Each later by-election or nomination change | about 5 minutes per row |

If Mzalendo gives written permission, a periodic refresh could be automated. Without it, run the listing read by hand after each by-election and after the nominations in 2027.

## 4. Can we show sittings figures ourselves?

- Not from Mzalendo: no licence, and their numbers are contributions and divisions, not sittings attended.
- Not from Parliament: we found no attendance register. If one exists it needs an access-to-information request under Art. 35.
- Possible later, with care: count how many Hansard sittings a member spoke at, from Parliament's Hansard PDFs. We did not check whether Parliament sets reuse terms (we found none), the work is a parsing project, and it measures speaking, not attendance. We do not recommend it for the first release.
- Safe now: show a plain link on the unit panel: "Record in Parliament: Mzalendo profile (opens in a new tab)" and "Official profile: parliament.go.ke". Do not show any number from either site. If we ever show a figure, it must carry its source and an "as of" date (CLAUDE.md rule).
- Neutral wording: link the same way for every holder who has a page. For holders with no page (MCAs), show nothing rather than a broken link.

## 5. Things we could not settle

- Mzalendo's final terms (a draft says they are coming).
- Whether Parliament keeps attendance registers and would release them.
- Whether Mzalendo would allow our use of their numbers or CSV.
- Whether the 403/empty responses from kenyalaw.org to scripts are a block on automated access. We stopped there and did not try to get around it.
- Whether the Kibwezi East and Endebess profiles are right: we matched them from the listing text and did not open them.
