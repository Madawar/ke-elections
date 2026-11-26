"""Diagnostic: does each built ward polygon sit where the Red Cross ward of the same (gazette) name is?
python -I crosswalk_check.py <wards.geojson> <arc.shp> <gazette.csv>"""
import sys, json, csv, re, difflib, collections, unicodedata
import shapefile
from shapely.geometry import shape
from shapely.validation import make_valid
from shapely.strtree import STRtree

W, ARC, GZ = sys.argv[1:4]
def clean(g):
    g = shape(g); return g if g.is_valid else make_valid(g)
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'\b(WARD|SUB COUNTY)\b', '', s); return re.sub(r'[^A-Z0-9]', '', s)
gz = {int(r['caw_code']): r for r in csv.DictReader(open(GZ))}
wards = {f['properties']['code']: clean(f['geometry']) for f in json.load(open(W))['features']}
codes = list(wards); geoms = [wards[c] for c in codes]; tree = STRtree(geoms)
arc = [(r.as_dict(), clean(s.__geo_interface__)) for r, s in zip(shapefile.Reader(ARC).records(), shapefile.Reader(ARC).shapes())]
by_county = collections.defaultdict(list)
for i, (r, g) in enumerate(arc):
    by_county[norm(r['county'])[:6]].append(i)

suspect = []
for code, g in sorted(wards.items()):
    row = gz[code]; target = norm(row['caw_name'])
    cands = by_county.get(norm(row['county_name'])[:6], [])
    if not cands:
        continue
    best = max(cands, key=lambda i: difflib.SequenceMatcher(None, norm(arc[i][0]['ward']), target).ratio())
    ratio = difflib.SequenceMatcher(None, norm(arc[best][0]['ward']), target).ratio()
    if ratio < 0.85:
        continue  # no confident name match; can't judge
    ag = arc[best][1]
    shares = sorted(((ag.intersection(geoms[j]).area / ag.area, codes[j]) for j in tree.query(ag) if ag.area), reverse=True)
    if not shares:
        continue
    top_share, top_code = shares[0]
    own = next((s for s, c in shares if c == code), 0.0)
    if top_code != code and top_share > 0.5 and own < 0.2:
        suspect.append((code, row['caw_name'], row['const_name'], row['county_name'], arc[best][0]['ward'], top_code, gz[top_code]['caw_name'], round(top_share, 2), round(own, 2)))
print(f"checked {len(wards)} wards; suspects (Red Cross ward of this name lies mostly in ANOTHER code's polygon): {len(suspect)}")
for s in suspect:
    print(f"  code {s[0]} {s[1]} ({s[2]}, {s[3]}): RC '{s[4]}' is {s[7]:.0%} inside code {s[5]} ({s[6]}), {s[8]:.0%} inside its own")
