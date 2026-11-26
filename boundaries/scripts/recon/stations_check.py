"""Diagnostic: score ward polygons against IEBC 2013 polling-station locations.
For each gazette ward, take the stations IEBC listed under that ward (matched by normalised
county+constituency+ward name; diagnostic only), and measure the share inside our polygon for
that code, and inside the Red Cross polygon of the same name.
python -I stations_check.py <wards.geojson> <stations.shp> <arc.shp> <gazette.csv> <out.json>"""
import sys, json, csv, re, collections, unicodedata, difflib
import shapefile
from shapely.geometry import shape, Point
from shapely.validation import make_valid
from shapely.strtree import STRtree

W, ST, ARC, GZ, OUT = sys.argv[1:6]
def clean(g):
    g = shape(g); return g if g.is_valid else make_valid(g)
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'\b(WARD|SUB COUNTY|CONSTITUENCY)\b', '', s); return re.sub(r'[^A-Z0-9]', '', s)

gz = list(csv.DictReader(open(GZ)))
key2code = {}
for r in gz:
    key2code[(norm(r['county_name'])[:5], norm(r['const_name']), norm(r['caw_name']))] = int(r['caw_code'])
const_wards = collections.defaultdict(list)
for r in gz:
    const_wards[(norm(r['county_name'])[:5], norm(r['const_name']))].append((norm(r['caw_name']), int(r['caw_code'])))
# constituency name fuzzy map (2013 names vs 2026 gazette, e.g. MBITA -> Suba North)
const_keys = list(const_wards)

def code_for(county, const, ward):
    ck = norm(county)[:5]; kn = norm(const); wn = norm(ward)
    k = (ck, kn)
    if k not in const_wards:
        cands = [c for c in const_keys if c[0] == ck]
        best = max(cands, key=lambda c: difflib.SequenceMatcher(None, c[1], kn).ratio(), default=None)
        if not best or difflib.SequenceMatcher(None, best[1], kn).ratio() < 0.8:
            return None
        k = best
    names = const_wards[k]
    bn, bc = max(names, key=lambda n: difflib.SequenceMatcher(None, n[0], wn).ratio())
    return bc if difflib.SequenceMatcher(None, bn, wn).ratio() >= 0.8 else None

ours = {f['properties']['code']: clean(f['geometry']) for f in json.load(open(W))['features']}
codes = list(ours); tree = STRtree([ours[c] for c in codes])
rc = shapefile.Reader(ARC)
rcs = [(r['ward'], r['county'], clean(s.__geo_interface__)) for r, s in zip(rc.records(), rc.shapes())]
rtree = STRtree([g for _, _, g in rcs])
gzname = {int(r['caw_code']): (r['caw_name'], r['county_name']) for r in gz}
def rc_for(code):
    name, county = gzname[code]
    cands = [i for i, (n, c, _) in enumerate(rcs) if norm(c)[:5] == norm(county)[:5]]
    best = max(cands, key=lambda i: difflib.SequenceMatcher(None, norm(rcs[i][0]), norm(name)).ratio(), default=None)
    if best is None or difflib.SequenceMatcher(None, norm(rcs[best][0]), norm(name)).ratio() < 0.85:
        return None
    return rcs[best][2]

st = shapefile.Reader(ST)
fields = [f[0] for f in st.fields[1:]]
by_code = collections.defaultdict(list); unmatched = 0
for rec, shp in zip(st.records(), st.shapes()):
    d = dict(zip(fields, rec))
    if not shp.points: continue
    x, y = shp.points[0]
    if not (33.5 < x < 42.5 and -5 < y < 5.5): continue
    c = code_for(d.get('county'), d.get('constituen') or d.get('constituency'), d.get('ward'))
    if c is None: unmatched += 1; continue
    by_code[c].append(Point(x, y))

rows = []
for code in sorted(by_code):
    pts = by_code[code]
    if len(pts) < 3: continue
    own = sum(ours[code].contains(p) for p in pts) / len(pts) if code in ours else 0
    rg = rc_for(code)
    rcs_share = (sum(rg.contains(p) for p in pts) / len(pts)) if rg is not None else None
    # where do our-map misses land?
    elsewhere = collections.Counter()
    for p in pts:
        if code in ours and ours[code].contains(p): continue
        for j in tree.query(p):
            if ours[codes[j]].contains(p): elsewhere[codes[j]] += 1; break
    rows.append({'code': code, 'name': gzname[code][0], 'stations': len(pts), 'ours': round(own, 2),
                 'redcross': None if rcs_share is None else round(rcs_share, 2), 'ours_misses_land_in': elsewhere.most_common(2)})
json.dump(rows, open(OUT, 'w'), indent=1)
bad = [r for r in rows if r['ours'] < 0.5]
print(f"stations fields={fields}; unmatched stations={unmatched}; wards scored={len(rows)}")
print(f"wards where <50% of their own stations fall in OUR polygon: {len(bad)}")
for r in sorted(bad, key=lambda r: r['ours'])[:60]:
    print(f"  {r['code']:>4} {r['name'][:24]:<24} n={r['stations']:<3} ours={r['ours']:.0%} redcross={'-' if r['redcross'] is None else format(r['redcross'],'.0%')} misses→{r['ours_misses_land_in']}")
import statistics
print("median share in ours:", statistics.median(r['ours'] for r in rows), " in redcross:", statistics.median(r['redcross'] for r in rows if r['redcross'] is not None))
