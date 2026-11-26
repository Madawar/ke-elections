"""Boundary data quality report (recon only). Usage: python -I analyze.py <raw_dir> <out_json>"""
import json, sys, glob, os, re, collections
import shapefile
from shapely.geometry import shape, mapping
from shapely.validation import make_valid, explain_validity
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely import area as sarea

RAW, OUT = sys.argv[1], sys.argv[2]
report = {}

def geo(g):
    s = shape(g)
    return s

def load_geojson(p):
    with open(p) as f:
        d = json.load(f)
    return d.get('features', [d])

def summarise(name, feats, code_key, expected, name_key):
    codes = [f['properties'].get(code_key) for f in feats]
    codes = [int(c) if c not in (None, '') else None for c in codes]
    cnt = collections.Counter(codes)
    invalid = []
    for f, c in zip(feats, codes):
        g = geo(f['geometry'])
        if not g.is_valid:
            invalid.append({'code': c, 'name': f['properties'].get(name_key), 'why': explain_validity(g)})
    r = {
        'features': len(feats),
        'distinct_codes': len([c for c in cnt if c]),
        'missing_codes': sorted(set(range(1, expected + 1)) - set(cnt)),
        'duplicate_codes': {c: n for c, n in cnt.items() if n > 1},
        'out_of_range': sorted(c for c in cnt if c is not None and not 1 <= c <= expected),
        'null_codes': cnt.get(None, 0),
        'blank_names': sum(1 for f in feats if not str(f['properties'].get(name_key) or '').strip()),
        'invalid_geoms': len(invalid),
        'invalid_examples': invalid[:8],
    }
    report[name] = r
    return r

# ---------- mikelmaron (IEBC 2012 via api.iebc.or.ke, 2013) ----------
M = os.path.join(RAW, "mikelmaron", "data")
mc = load_geojson(os.path.join(M, 'counties.geojson'))
mk = load_geojson(os.path.join(M, 'constituencies.geojson'))
mw = []
ward_files = sorted(glob.glob(os.path.join(M, 'httpapiiebcorkegeojsonward_*geojson')))
for p in ward_files:
    try:
        fs = load_geojson(p)
    except Exception as e:
        report.setdefault('mikelmaron_ward_file_errors', []).append([os.path.basename(p), str(e)[:80]])
        continue
    idx = int(re.search(r'ward_(\d+)geojson', p).group(1))
    for f in fs:
        f['properties']['_file_idx'] = idx
        mw.append(f)
report['mikelmaron_ward_files'] = len(ward_files)
summarise('mm_counties', mc, 'COUNTY_COD', 47, 'COUNTY_NAM')
summarise('mm_constituencies', mk, 'CONST_CODE', 290, 'CONSTITUEN')
summarise('mm_wards', mw, 'COUNTY_ASS', 1450, 'COUNTY_A_1')
report['mm_ward_file_idx_ne_code'] = [
    (f['properties']['_file_idx'], f['properties'].get('COUNTY_ASS')) for f in mw
    if f['properties']['_file_idx'] != f['properties'].get('COUNTY_ASS')][:20]

# ---------- hierarchy consistency (attributes) ----------
const_county = {}
for f in mk:
    c = f['properties'].get('CONST_CODE')
    if c:
        const_county[int(c)] = int(f['properties']['COUNTY_COD'])
bad_parent = []
wards_per_const = collections.Counter()
for f in mw:
    p = f['properties']
    if not p.get('COUNTY_ASS'):
        continue
    k, c = int(p['CONST_CODE']), int(p['COUNTY_COD'])
    wards_per_const[k] += 1
    if const_county.get(k) != c:
        bad_parent.append({'ward': p['COUNTY_ASS'], 'name': p.get('COUNTY_A_1'), 'const': k, 'county': c, 'const_county': const_county.get(k)})
report['hierarchy_attr_mismatch'] = bad_parent
report['constituencies_without_wards'] = sorted(set(range(1, 291)) - set(wards_per_const))

# ---------- spatial consistency + gaps/overlaps ----------
def clean(g):
    g = shape(g)
    return g if g.is_valid else make_valid(g)

kgeom = {int(f['properties']['CONST_CODE']): clean(f['geometry']) for f in mk if f['properties'].get('CONST_CODE')}
cgeom = collections.defaultdict(list)
for f in mc:
    if f['properties'].get('COUNTY_COD'):
        cgeom[int(f['properties']['COUNTY_COD'])].append(clean(f['geometry']))
cgeom = {k: unary_union(v) for k, v in cgeom.items()}

wgeom = {}
for f in mw:
    p = f['properties']
    if p.get('COUNTY_ASS'):
        g = clean(f['geometry'])
        code = int(p['COUNTY_ASS'])
        wgeom[code] = unary_union([wgeom[code], g]) if code in wgeom else g

ward_outside_parent = []
for f in mw:
    p = f['properties']
    if not p.get('COUNTY_ASS'):
        continue
    code = int(p['COUNTY_ASS'])
    g = wgeom[code]
    k = kgeom.get(int(p['CONST_CODE']))
    if k is None:
        continue
    inside = g.intersection(k).area / g.area if g.area else 0
    if inside < 0.9:
        ward_outside_parent.append({'ward': code, 'name': p.get('COUNTY_A_1'), 'const': int(p['CONST_CODE']), 'share_inside_parent': round(inside, 3)})
report['wards_mostly_outside_parent_constituency'] = ward_outside_parent

const_outside_county = []
for code, g in kgeom.items():
    cg = cgeom.get(const_county[code])
    inside = g.intersection(cg).area / g.area
    if inside < 0.9:
        const_outside_county.append({'const': code, 'share_inside': round(inside, 3)})
report['constituencies_mostly_outside_parent_county'] = const_outside_county

def overlaps_and_gaps(geoms, label, outline, min_km2=0.05):
    deg2_to_km2 = 111.32 ** 2  # rough at the equator; Kenya straddles it
    codes = list(geoms)
    gl = [geoms[c] for c in codes]
    tree = STRtree(gl)
    ov = []
    for i, g in enumerate(gl):
        for j in tree.query(g):
            if j <= i:
                continue
            inter = g.intersection(gl[j]).area * deg2_to_km2
            if inter > min_km2:
                ov.append({'a': codes[i], 'b': codes[j], 'km2': round(inter, 3)})
    u = unary_union(gl)
    gaps = outline.difference(u)
    parts = list(getattr(gaps, 'geoms', [gaps]))
    big = sorted([p for p in parts if p.area * deg2_to_km2 > min_km2], key=lambda p: -p.area)
    report[label] = {
        'overlap_pairs_over_%.2fkm2' % min_km2: len(ov),
        'overlap_total_km2': round(sum(o['km2'] for o in ov), 2),
        'worst_overlaps': sorted(ov, key=lambda o: -o['km2'])[:10],
        'gap_pieces_over_%.2fkm2' % min_km2: len(big),
        'gap_total_km2': round(sum(p.area for p in big) * deg2_to_km2, 2),
        'worst_gaps': [{'km2': round(p.area * deg2_to_km2, 2), 'at': [round(p.representative_point().x, 4), round(p.representative_point().y, 4)]} for p in big[:10]],
        'union_area_km2': round(u.area * deg2_to_km2),
    }

national = unary_union(list(cgeom.values()))
report['national_area_km2_from_counties'] = round(national.area * 111.32 ** 2)
overlaps_and_gaps(cgeom, 'mm_counties_topology', national)
overlaps_and_gaps(kgeom, 'mm_constituencies_topology', national)
overlaps_and_gaps(wgeom, 'mm_wards_topology', national)

# ---------- HDX American Red Cross wards: geometry match against IEBC codes ----------
ar = shapefile.Reader(os.path.join(RAW, 'hdx_arc_wards/kenya_wards/Kenya_Wards/kenya_wards'))
arc = [(sr.record.as_dict(), clean(sr.shape.__geo_interface__)) for sr in ar.shapeRecords()]
wcodes = list(wgeom)
wl = [wgeom[c] for c in wcodes]
wtree = STRtree(wl)
ious = []
best_codes = collections.Counter()
for rec, g in arc:
    best = (0, None)
    for j in wtree.query(g):
        inter = g.intersection(wl[j]).area
        if inter:
            iou = inter / g.union(wl[j]).area
            if iou > best[0]:
                best = (iou, wcodes[j])
    ious.append((best[0], best[1], rec['ward'], rec['county']))
    if best[1]:
        best_codes[best[1]] += 1
buckets = collections.Counter('>=0.9' if i >= .9 else '0.7-0.9' if i >= .7 else '0.5-0.7' if i >= .5 else '<0.5' for i, *_ in ious)
report['arc_vs_iebc_wards'] = {
    'arc_features': len(arc),
    'iou_buckets': dict(buckets),
    'iebc_codes_matched_by_more_than_one_arc_ward': sum(1 for v in best_codes.values() if v > 1),
    'iebc_codes_not_best_match_of_any_arc_ward': len(set(wcodes) - set(best_codes)),
    'worst_matches': sorted(ious)[:10],
}

# ---------- compare codes/parents/names against IEBC gazette (GN 13771, 2027 list) ----------
import csv, unicodedata
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'\bWARD\b', '', s)
    return re.sub(r'[^A-Z0-9]', '', s)
gz = list(csv.DictReader(open(sys.argv[3])))
gw = {int(r['caw_code']): r for r in gz}
gk = {int(r['const_code']): r for r in gz}
gc = {int(r['county_code']): r for r in gz}
report['gazette_counts'] = {'wards': len(gw), 'constituencies': len(gk), 'counties': len(gc)}
cmp = {'ward_parent_mismatch': [], 'ward_name_differs': [], 'const_parent_mismatch': [], 'const_name_differs': [], 'county_name_differs': []}
for f in mw:
    p = f['properties']
    if not p.get('COUNTY_ASS'):
        continue
    c = int(p['COUNTY_ASS']); g = gw.get(c)
    if not g:
        continue
    if (int(p['CONST_CODE']), int(p['COUNTY_COD'])) != (int(g['const_code']), int(g['county_code'])):
        cmp['ward_parent_mismatch'].append({'ward': c, 'geom_const': p['CONST_CODE'], 'gazette_const': g['const_code']})
    if norm(p.get('COUNTY_A_1')) != norm(g['caw_name']):
        cmp['ward_name_differs'].append({'ward': c, 'geom': p.get('COUNTY_A_1'), 'gazette': g['caw_name']})
for f in mk:
    p = f['properties']
    if not p.get('CONST_CODE'):
        continue
    c = int(p['CONST_CODE']); g = gk[c]
    if int(p['COUNTY_COD']) != int(g['county_code']):
        cmp['const_parent_mismatch'].append({'const': c, 'geom_county': p['COUNTY_COD'], 'gazette': g['county_code']})
    if norm(p.get('CONSTITUEN')) != norm(g['const_name']):
        cmp['const_name_differs'].append({'const': c, 'geom': p.get('CONSTITUEN'), 'gazette': g['const_name']})
for f in mc:
    p = f['properties']
    if p.get('COUNTY_COD') and norm(p.get('COUNTY_NAM')) != norm(gc[int(p['COUNTY_COD'])]['county_name']):
        cmp['county_name_differs'].append({'county': p['COUNTY_COD'], 'geom': p.get('COUNTY_NAM'), 'gazette': gc[int(p['COUNTY_COD'])]['county_name']})
report['vs_gazette'] = {k: {'count': len(v), 'examples': v[:15]} for k, v in cmp.items()}

with open(OUT, 'w') as f:
    json.dump(report, f, indent=1, default=str)
print(json.dumps(report, indent=1, default=str)[:12000])
