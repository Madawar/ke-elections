# Page proposal: "Who does what"

A phone-first page that answers one question: "Who do I ask about this?" It uses the roles research in `roles-en.md`, `services.csv` and `facts.csv`, and our current holders from `data/sources/holders/`. No product code is written. This is a sketch for review.

## Principles (from CLAUDE.md and the owner)

- Neutral. We say what each office can and cannot do. We never say whether a person is doing it well. No party branding.
- Every claim shows its source and an "as of" date. Constitution citations come first, in short form, for example (Constitution, Art. 185(3)).
- Holders come from our data and show the date of that data. Nobody is named without a source.
- Seat colours are the IEBC ballot colours: Governor blue, Senator yellow, Woman Rep purple, MP green, MCA beige. Archivo type. Sentence case. No emoji, no gradients, no arrows on links, no "A · B · C" strings, no matching soft-shadow cards.
- Where the law is contested (NG-CDF, ward funds, road levy), say so in a plain box, with the date.

## Two ways in, one result

The page has a place picker at the top (county, constituency, ward: the same picker the map uses, saved in the browser) and two tabs.

1. **Pick a problem** (default). The voter names a problem; the page says which level of government and which elected people answer for it at their place.
2. **Pick a seat.** The voter taps a seat (Governor, Senator, Woman Rep, MP, MCA) and sees what that person can and cannot do, with the current holder.

A third entry, from the map: in the unit panel, under each holder, a text link "What does this seat do?" opens the seat explainer for that seat and place.

## Screen 1: home (before a place is chosen)

```
+--------------------------------------+
| Kenya Electoral Map                  |
| Who does what                        |
|                                      |
| Find out who answers for the things  |
| you see every day: roads, schools,   |
| water, clinics.                      |
|                                      |
| Your place                           |
| [ Search county, constituency, ward ]|
| Use my location                      |
|                                      |
| [ Pick a problem ] [ Pick a seat ]   |
|                                      |
| Sources: Constitution of Kenya 2010, |
| Fourth Schedule. Facts checked 27    |
| Nov 2026.                            |
+--------------------------------------+
```

English copy:

- Title: "Who does what"
- Intro: "Find out who answers for the things you see every day. The Constitution splits the work between the national government and your county government. Then different people you elect oversee each one."
- Place label: "Your place". Placeholder: "Search a county, constituency or ward".
- Location button: "Use my location". Help text under it: "We use your location only to find your ward. It is not stored."
- Footer line: "Checked against the Constitution of Kenya, 2010, on 27 November 2026. Laws change. See sources."

## Screen 2: pick a problem

```
+--------------------------------------+
| Who does what          Kisumu county |
| Pick a problem                       |
|                                      |
| ( ) The road is bad                  |
| ( ) A school needs classrooms        |
| ( ) A child cannot pay school costs  |
| ( ) There is no water                |
| ( ) The clinic has no medicine       |
| ( ) Rubbish is not collected         |
| ( ) Street lights do not work        |
| ( ) Market or trade licence problem  |
| ( ) Crime and policing               |
| ( ) Land or boundary dispute         |
| ( ) Something else                   |
+--------------------------------------+
```

List items are plain radio rows with large tap targets. Copy: heading "What is the problem?" Under the list: "Not sure which one fits? Pick a seat instead." (links to the seat tab)

Problem list comes from `services.csv`. First release covers the 11 above, in this order, because they are the most asked.

## Screen 3: result, example "The road is bad"

A road can be national or county. We ask one question first, because the answer is different.

```
+--------------------------------------+
| The road is bad                      |
| Kisumu county                        |
|                                      |
| What kind of road is it?             |
| ( ) A main highway between towns     |
| ( ) A county, town or estate road    |
| ( ) I am not sure                    |
+--------------------------------------+
```

If the person picks "A county, town or estate road":

```
+--------------------------------------+
| County roads are mostly your county  |
| government's job                     |
| (Fourth Schedule, Part 2, para 5)    |
|                                      |
| Who answers                          |
| [blue]  Governor                     |
|         <name from our data>         |
|         Leads the county executive   |
|         that builds and fixes roads. |
| [beige] Member of County Assembly    |
|         for <ward>                   |
|         <name from our data>         |
|         Approves the county budget   |
|         and checks the executive.    |
|         (Constitution, Art. 185(3))  |
| [yellow] Senator                     |
|         <name>                       |
|         Oversees how county money    |
|         is used. (Art. 96(3))        |
|                                      |
| What they cannot do                  |
| The MCA cannot build or fix the road|
| themselves. The law says MCAs stay   |
| out of executive work. (County       |
| Governments Act, s. 9(2))            |
| Your MP does not build roads. The MP |
| makes national laws and votes on the |
| national budget. (Art. 95)           |
|                                      |
| What you can do                      |
| Go to the ward or county budget      |
| forum and ask for the road to be put |
| in the budget. (County Governments   |
| Act, s. 91)                          |
| Send a written petition to the       |
| county government. (s. 88)           |
|                                      |
| Not settled                          |
| Who looks after which road can      |
| differ. Some rural roads are run by  |
| a national agency. A bill about the  |
| road fuel levy for counties is still |
| in Parliament (checked 27 Nov 2026). |
|                                      |
| Sources    Show on map               |
+--------------------------------------+
```

If the person picks "A main highway between towns":

- Heading: "Main highways are a national government job" with "(Fourth Schedule, Part 1, para 18(b))".
- Who answers: the President (head of the national executive, Art. 131(1)) and the Cabinet Secretary responsible for roads (Art. 153(3): must answer questions in Parliament). Do not name the Cabinet Secretary until we have a checked source for the post; show the office only.
- Who oversees: MPs of the National Assembly approve the national budget (Art. 221) and Senators oversee national revenue sent to counties (Art. 96(3)), shown as "your MP" and "your Senator" with names from our data.
- Cannot do: "Your MP cannot order the road to be fixed. MPs make laws, approve the budget and ask questions in Parliament."
- Next step text: "Report it to the national road agency. Your county government does not run this road."

If "I am not sure": show both short answers and a plain test: "A main highway usually has a letter and number, like A1 or B3. Estate and village roads usually do not. If you are not sure, ask at your county roads office." (This wording is a draft: classification letters need a source before release.)

## Screen 4: result, example "A school needs classrooms"

```
+--------------------------------------+
| A school needs classrooms            |
|                                      |
| What kind of school?                 |
| ( ) Nursery / ECDE                   |
| ( ) Primary or secondary             |
+--------------------------------------+
```

Primary or secondary result copy:

- Heading: "Primary and secondary schools are a national government job" (Fourth Schedule, Part 1, para 16).
- Who answers: President and the Cabinet Secretary for education (national).
- Who can help with money: "The constituency fund (NG-CDF) can pay for classrooms because schools are a national function. The fund's committee for your constituency chooses projects after ward meetings. (NG-CDF Act, s. 24 and s. 27)." MP shown as "your MP"; "The MP is not a member of the committee in the 2023 text of the Act".
- Contested box: "The NG-CDF Act was declared unconstitutional by the High Court in September 2024. The Court of Appeal restored it on 6 February 2026. The case is now before the Supreme Court. Checked 27 November 2026."
- Cannot do: "Your county government and MCA do not run primary or secondary schools."

ECDE result: "Nursery schools (early childhood education) are a county government job" (Fourth Schedule, Part 2, para 9). Governor and MCAs shown as for roads.

## Screen 5: pick a seat (explainer)

```
+--------------------------------------+
| Pick a seat                          |
|                                      |
| [blue]   Governor                    |
| [yellow] Senator                     |
| [purple] Woman Representative        |
| [green]  Member of Parliament        |
| [beige]  Member of County Assembly   |
| (nominated members, deputies)        |
+--------------------------------------+
```

Seat page, example MP:

```
+--------------------------------------+
| [green] Member of Parliament (MP)    |
| For Kikuyu constituency              |
| <name from our data>                 |
| Elected 2022. Data as of 26 Nov 2026 |
|                                      |
| What an MP does                      |
| Speaks for the people of the         |
| constituency in the National         |
| Assembly. Makes national laws.       |
| Approves the national budget and     |
| checks how national money is spent.  |
| (Constitution, Art. 95)              |
|                                      |
| What an MP does not do               |
| Build roads, run schools or run a    |
| hospital. Those jobs belong to the   |
| national and county governments.     |
| (Fourth Schedule)                    |
|                                      |
| Money linked to this seat            |
| NG-CDF is a national fund for        |
| projects in the constituency. A      |
| committee, not the MP, picks         |
| projects. Legal status is contested. |
|                                      |
| Records                              |
| Parliament profile, parliament.go.ke |
| Mzalendo profile (outside site)      |
|                                      |
| Sources    Show on map               |
+--------------------------------------+
```

Same layout for each seat. Key lines in English:

- Governor (blue): "Leads the county government. Runs county services such as county roads, county health facilities, nursery schools, markets and water (Fourth Schedule, Part 2). Proposes the budget. Answers to the county assembly and, for removal, to the Senate. (Art. 179, Art. 183; County Governments Act, s. 30, s. 33)"
- Senator (yellow): "Speaks for the county in the Senate. Helps decide how national money is shared among counties. Oversees national money sent to counties. Hears the case if a county assembly wants to remove a governor. Does not make county laws. (Art. 96, Art. 217; County Governments Act, s. 33)". Mention the County Development Board only with its caveat (see below).
- Woman Representative (purple): "Elected by every voter in the county. A full member of the National Assembly: makes national laws, approves the national budget, oversees national spending. (Art. 97(1)(b), Art. 95). Her role in the NGAAF fund is not set out in the regulations we read."
- MCA (beige): "Speaks for the ward in the county assembly. Makes county laws, approves the county budget and checks the county executive. Does not run county services. (Art. 185; County Governments Act, s. 9)"
- Nominated members: "Chosen by parties, not by voters, to include groups such as youth and persons with disabilities (Art. 97(1)(c), 98(1), 177(1)(b),(c))."
- Deputy governor: "Takes over if the governor leaves office. (Art. 182(2))"
- President and Deputy President: "Lead the national government. Responsible for police, national roads, primary and secondary schools, and the other national functions in Fourth Schedule, Part 1. The President does not run county services."

Caution to keep in the copy: do not list "County Development Board" as a duty of the Senator until we have the outcome of the 2015 High Court case on section 91A (facts.csv row on s. 91A, status partial).

## Result block (reused everywhere)

Order is fixed so people learn it:

1. The answer in one sentence, with the citation.
2. Who answers (seat chips in ballot colours, holder name, source line).
3. What they can do / what they cannot do.
4. What you can do next.
5. Not settled (only when the topic is contested; plain box with date).
6. Sources (opens the list from `facts.csv`, with status verified, partial or unverified shown in words) and "Show on map".

Seat chip layout, small:

```
[blue block]  Governor
              <holder name>
              ODM. Elected 2022. As of 26 Nov 2026.
```

No party colour is used for the chip. The party shows as text only, from our data.

## Behaviour on a phone

- Single column, 16 px gutters, one question per screen, big tap targets, back button works.
- Place and last problem stay in the browser (try/catch around storage).
- Works offline once opened: the roles content is a small JSON file in the service worker cache. Holders come from the same data the map already caches.
- Reading level target is Grade 8. Sentences under 20 words. Plain words: "answers for", "checks", "approves".
- Links read as words ("Open the Constitution text"), with no arrow glyphs.
- Kiswahili is not needed now (owner instruction).

## Content and data

- `data/sources/roles/services.csv`: this research's file, reviewed by a person, imported like other sources. Columns used: topic, level, responsible body, who answers, Fourth Schedule reference, notes.
- `data/sources/roles/facts.csv`: sources shown behind the "Sources" button. Each shown claim stores its fact id.
- `data/sources/roles/seats.csv` (new, small): one row per seat with the can-do and cannot-do lines and fact ids.
- Holders: joined on IEBC codes (county, constituency, ward), never on names, as in CLAUDE.md. Place picker returns codes; the page reads the holders for those codes.
- Records links (`data/sources/links/mzalendo.csv`, see `mzalendo.md`): shown only for MP, Senator, Woman Rep and nominated members that have a reviewed row; hidden otherwise. Never show a Mzalendo number.
- Anything with status `unverified` in `facts.csv` is shown with a plain label "We could not confirm this" or left out. Nothing unverified appears as a bare fact.
- Sample data is labelled as sample (CLAUDE.md), including any exported image.

## Contested topics: copy for the "Not settled" box

- NG-CDF: "The constituency fund has been in court. The High Court declared the law unconstitutional in September 2024. The Court of Appeal restored it on 6 February 2026, except one subsection. The case has been taken to the Supreme Court. Checked 27 November 2026."
- Ward development funds: "Some counties have a ward fund set up by county law. Courts and the national Controller of Budget have been asked about them. The County Governments Act says MCAs must stay out of running services. Rules differ by county. Ask your county assembly for its law."
- County roads levy: "Counties do not yet have a fixed share of the road fuel levy. A bill in Parliament would change that. Checked 27 November 2026."

All three are marked in `facts.csv` as partial or unverified. The page shows that wording honestly.

## What this page will not do

- No scores, rankings or "good/bad" labels for any person or office.
- No claim about what a person promised or achieved.
- No numbers from Mzalendo (no licence).
- No advice on which party to pick.

## Build order (suggested)

1. Static explainer: seats and 11 problems, no holders (content and tests only).
2. Join holders by code and add the source line with "as of".
3. Add the unit panel link "What does this seat do?" on the map.
4. Add the records links once `mzalendo.csv` is reviewed.
5. Review the copy with a plain-language reader and a lawyer before launch.

## Open questions for the owner

1. Is it fine to leave the Senator's County Development Board role out until the 2015 court case outcome is checked?
2. Show only the office (not the name) for national officers such as the Cabinet Secretary for roads, until we hold a checked source for them?
3. Ask Mzalendo for permission to show their counts, or stay with plain links?
4. Does the owner want the page to explain how to contact an office (address, phone)? We have no checked source for contacts yet.
