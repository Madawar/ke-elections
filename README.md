# Kenya Electoral Map

An interactive, phone-first map of Kenya's electoral units: 47 counties, 290 constituencies
and 1,450 wards. It is for tracking party nominations ahead of the August 2027 general
election, with collaborative, verified data entry.

**Status: planning.** No app code yet. See:

- [`docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`](docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md): the plan (draft)
- [`docs/boundary-quality-report.md`](docs/boundary-quality-report.md): an assessment of the
  available boundary data

## Reproducing the boundary quality report

```bash
boundaries/scripts/fetch_sources.sh        # downloads into boundaries/raw/ (gitignored)
python3 -m venv .venv && .venv/bin/pip install shapely pyshp
.venv/bin/python -I boundaries/scripts/recon/quality_report.py boundaries/raw out.json data/reference/iebc_wards_2027_gn13771.csv
.venv/bin/python -I boundaries/scripts/recon/diagnose_wards.py boundaries/raw data/reference/iebc_wards_2027_gn13771.csv out2.json
```

## Data sources and attribution

- **IEBC 2012 boundary delimitation.** Independent Electoral and Boundaries Commission,
  Kenya. Retrieved via [mikelmaron/kenya-election-data](https://github.com/mikelmaron/kenya-election-data),
  which was scraped from `vote.iebc.or.ke` in 2013. That repository carries no licence; the
  data is IEBC's.
- **Administrative Wards in Kenya 1450.** American Red Cross, via
  [HDX](https://data.humdata.org/dataset/administrative-wards-in-kenya-1450), under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used only to patch wards missing
  from the IEBC data.
- **Ward and constituency codes.** Kenya Gazette Vol. CXXVIII No. 150, Gazette Notice 13771
  (26 Aug 2026), published by IEBC.
  [PDF](https://www.iebc.or.ke/uploads/resources/LR79g5OZJn.pdf).
- **OpenStreetMap data** for the towns layer and the optional basemap: © OpenStreetMap
  contributors, under the ODbL. (Planned.)
