# Kenya Electoral Map

An interactive, phone-first map of Kenya's electoral units: 47 counties, 290 constituencies
and 1,450 wards. It is for tracking party nominations ahead of the August 2027 general
election, with collaborative, verified data entry.

**Status: Phase 1 in progress** (boundaries and map). See:

- [`docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md`](docs/superpowers/specs/2026-11-26-kenya-electoral-map-design.md): the plan (draft)
- [`docs/boundary-quality-report.md`](docs/boundary-quality-report.md): an assessment of the
  available boundary data

## Development

The app is Laravel 13 with the Vue/Inertia starter kit, MySQL 8.4 and
[Laravel Sail](https://laravel.com/docs/sail). You need Docker; nothing else is installed on
the host.

```bash
git clone <repo-url> elections && cd elections
cp .env.example .env

# install PHP dependencies without a local PHP
docker run --rm -u "$(id -u):$(id -g)" -v "$(pwd)":/var/www/html -w /var/www/html \
  laravelsail/php84-composer:latest composer install --ignore-platform-reqs

./vendor/bin/sail up -d
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan migrate
./vendor/bin/sail npm ci
./vendor/bin/sail npm run dev      # Vite dev server (port 5173)
```

The app is served at <http://localhost:8080>. Sail also creates a `testing` database for the
test suite.

Run the tests (the PHP tests need built assets, so run `npm run build` once first):

```bash
./vendor/bin/sail npm run build
./vendor/bin/sail artisan test     # Pest, against MySQL
./vendor/bin/sail npm run test:js  # Vitest (happy-dom)
```

Continuous integration (`.github/workflows/ci.yml`) runs the same steps on every push and
pull request.

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
