"""Focused diagnosis. python -I analyze2.py <raw_dir> <gazette_csv> <out_json>"""
import json, sys, glob, os, re, csv, collections, unicodedata, difflib
import shapefile
from shapely.geometry import shape
from shapely.validation import make_valid
from shapely.ops import unary_union
from shapely.strtree import STRtree

RAW, GZ, OUT = sys.argv[1:4]
K2 = 111.32 ** 2
def clean(g):
    g = shape(g); return g if g.is_valid else make_valid(g)
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'\bWARD\b', '', s); return re.sub(r'[^A-Z0-9]', '', s)
gz = {int(r['caw_code']): r for r in csv.DictReader(open(GZ))}
rep = {}

M = os.path.join(RAW, "mikelmaron", "data")
files = {}
for p in glob.glob(os.path.join(M, 'httpapiiebcorkegeojsonward_*geojson')):
    idx = int(re.search(r'ward_(\d+)geojson', p).group(1))
    files[idx] = json.load(open(p))['features']
rep['ward_file_indices_missing'] = sorted(set(range(0, 1451)) - set(files))

# mis-coded files: label code != file index
mis = []
for idx, fs in sorted(files.items()):
    for f in fs:
        c = f['properties'].get('COUNTY_ASS')
        if c and c != idx:
            nm = f['properties'].get('COUNTY_A_1')
            mis.append({'file_idx': idx, 'label_code': c, 'label_name': nm,
                        'gazette_name_for_file_idx': gz.get(idx, {}).get('caw_name'),
                        'gazette_name_for_label': gz.get(c, {}).get('caw_name')})
rep['miscoded_files'] = mis

# all features with code
feats = [(f['properties'], clean(f['geometry'])) for fs in files.values() for f in fs if f['properties'].get('COUNTY_ASS')]
bycode = collections.defaultdict(list)
for p, g in feats:
    bycode[p['COUNTY_ASS']].append((p, g))
rep['duplicates'] = {c: [{'name': p.get('COUNTY_A_1'), 'km2': round(g.area * K2, 2), 'const': p.get('CONST_CODE')} for p, g in v]
                     for c, v in bycode.items() if len(v) > 1}

# ARC wards: crosswalk by geometry, check by name
ar = shapefile.Reader(os.path.join(RAW, 'hdx_arc_wards/kenya_wards/Kenya_Wards/kenya_wards'))
arc = [(sr.record.as_dict(), clean(sr.shape.__geo_interface__)) for sr in ar.shapeRecords()]
iebc = {c: unary_union([g for _, g in v]) for c, v in bycode.items()}
codes = list(iebc); geoms = [iebc[c] for c in codes]; tree = STRtree(geoms)

# per gazette ward: best ARC polygon by name similarity within same county (diagnostic only)
arc_by_county = collections.defaultdict(list)
for i, (r, g) in enumerate(arc):
    arc_by_county[norm(r['county'])].append(i)
def county_key(n):
    n = norm(n); return {'NAIROBICITY': 'NAIROBI', 'ELGEYOMARAKWET': 'ELGEYOMARAKWET', 'THARAKANITHI': 'THARAKANITHI'}.get(n, n)

missing = sorted(set(range(1, 1451)) - set(iebc))
miss = []
for c in missing:
    g = gz[c]; ck = county_key(g['county_name'])
    cands = arc_by_county.get(ck) or [i for k, v in arc_by_county.items() if k.startswith(ck[:5]) for i in v]
    best = max(cands, key=lambda i: difflib.SequenceMatcher(None, norm(arc[i][0]['ward']), norm(g['caw_name'])).ratio()) if cands else None
    entry = {'code': c, 'gazette': f"{g['caw_name']} / {g['const_name']} / {g['county_name']}"}
    if best is not None:
        ag = arc[best][1]
        entry['arc_name_match'] = arc[best][0]['ward']
        entry['name_ratio'] = round(difflib.SequenceMatcher(None, norm(arc[best][0]['ward']), norm(g['caw_name'])).ratio(), 2)
        covering = sorted(((ag.intersection(geoms[j]).area / ag.area, codes[j]) for j in tree.query(ag)), reverse=True)[:2]
        entry['arc_polygon_falls_in_iebc'] = [(cc, gz[cc]['caw_name'], round(s, 2)) for s, cc in covering]
    miss.append(entry)
rep['missing_wards'] = miss

# crosswalk confidence for all ARC wards: geometry best match vs name agreement
agree = collections.Counter(); low = []
for r, g in arc:
    best = (0, None)
    for j in tree.query(g):
        inter = g.intersection(geoms[j]).area
        if inter:
            share = inter / g.area
            if share > best[0]: best = (share, codes[j])
    s, c = best
    nr = difflib.SequenceMatcher(None, norm(r['ward']), norm(gz[c]['caw_name'])).ratio() if c else 0
    bucket = ('geom>=0.8' if s >= .8 else 'geom<0.8') + ('|name ok' if nr >= .8 else '|name differs')
    agree[bucket] += 1
    if s < .8 or nr < .8:
        low.append((round(s, 2), round(nr, 2), r['ward'], r['county'], c, gz.get(c, {}).get('caw_name')))
rep['arc_crosswalk'] = {'buckets': dict(agree), 'needs_review': len(low), 'examples': sorted(low)[:25]}

# gaps in IEBC wards vs county outline: how much is covered by ARC (land) vs not (likely water)
mc = json.load(open(os.path.join(M, 'counties.geojson')))['features']
national = unary_union([clean(f['geometry']) for f in mc if f['properties'].get('COUNTY_COD')])
gaps = national.difference(unary_union(geoms))
arc_u = unary_union([g for _, g in arc])
parts = sorted([p for p in getattr(gaps, 'geoms', [gaps]) if p.area * K2 > 0.05], key=lambda p: -p.area)
rep['ward_gaps_vs_counties'] = {
    'total_km2': round(sum(p.area for p in parts) * K2),
    'covered_by_arc_wards_km2': round(sum(p.intersection(arc_u).area for p in parts) * K2),
    'largest': [{'km2': round(p.area * K2), 'arc_covers': round(p.intersection(arc_u).area / p.area, 2),
                 'at': [round(p.representative_point().x, 3), round(p.representative_point().y, 3)]} for p in parts[:12]],
}
arc_gaps = national.difference(arc_u)
ap = [p for p in getattr(arc_gaps, 'geoms', [arc_gaps]) if p.area * K2 > 0.05]
rep['arc_gaps_vs_iebc_counties_km2'] = round(sum(p.area for p in ap) * K2)
arc_area = sum(g.area for _, g in arc) * K2
rep['arc_overlap_km2'] = round(arc_area - arc_u.area * K2, 2)
rep['arc_invalid'] = sum(1 for sr in ar.shapes() if not shape(sr.__geo_interface__).is_valid)
json.dump(rep, open(OUT, 'w'), indent=1, default=str)
print(json.dumps(rep, indent=1, default=str)[:14000])
