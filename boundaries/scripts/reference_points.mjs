// Builds boundaries/overrides/reference_points.csv (Task 4b), and lists every candidate it rejects
// in boundaries/build/reference-candidates.csv so the choice can be reviewed.
// Run with `node boundaries/scripts/reference_points.mjs` after `npm run boundaries:fetch` and a
// `npm run boundaries:build` (it reads boundaries/build/ward-evidence.csv).
//
// Rule: an OpenStreetMap place=town or place=city (HOT OSM export on HDX) whose name equals a
// gazette ward's name, or the ward's name without "Township"/"Town", in the county the point lies
// in (by the Red Cross layer), is expected to lie in that ward. Names only choose the candidates;
// the CSV records the code. Villages are skipped (many share a name with a ward they are not in),
// except Neboi and Khalalio in Mandera East. A candidate is rejected when:
// - the point is outside every IEBC ward (a coast or border line difference, not a misfiled code); or
// - neither the IEBC build nor the Red Cross layer has the point in its namesake ward (the
//   namesake assumption is what fails, as at Kapenguria town, in Mnagei ward in both); or
// - only the Red Cross layer has it there, but the ward's own polling stations (at least 3) are
//   more often inside the IEBC polygon than the Red Cross one: the signals disagree; or
// - it is within CLEARANCE_M of a line in either layer: a town node is a point placed somewhere
//   in a town, and 2012-era lines are not drawn to better than tens of metres, so a point that
//   close says nothing about which side of the line the town is on (Ukunda town is 48 m inside
//   the Red Cross Ukunda; Nanyuki town 34 m outside IEBC's Nanyuki). The brief's two points are
//   held to this too.
// Mandera's and Kitengela's town centres, which the Task 4b brief confirms, are added by hand.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as turf from '@turf/turf';
import { matchRedCross, matchStations, normName, toCsv } from '../pipeline/evidence.mjs';
import { loadGazette, parseCsv } from '../pipeline/gazette.mjs';
import { runMapshaper } from '../pipeline/wards.mjs';

const root = resolve(import.meta.dirname, '../..');
const path = (p) => resolve(root, p);
const OSM = 'HOT OSM populated places export on HDX, snapshot 2026-11-02';
const CLEARANCE_M = 100;
const VILLAGES = new Set(['node/12989190492', 'node/12989190496']); // Neboi and Khalalio, Mandera East

const readShapefile = async (file) =>
    JSON.parse((await runMapshaper(`-i ${path(file)} -o out.json format=geojson`, {})).output['out.json'].toString());

const gazette = loadGazette(readFileSync(path('data/reference/iebc_wards_2027_gn13771.csv'), 'utf8'));
const iebc = JSON.parse(readFileSync(path('boundaries/raw/mikelmaron/data/wards.geojson'), 'utf8')).features.filter(
    (f) => f.geometry && Number(f.properties.COUNTY_ASS) > 0,
);
const arc = await readShapefile('boundaries/raw/hdx_arc_wards/kenya_wards/Kenya_Wards/kenya_wards.shp');
const stations = await readShapefile('boundaries/raw/mikelmaron/output/pollingstations.shp');
const places = JSON.parse(readFileSync(path('boundaries/raw/osm/places/populated_places.geojson'), 'utf8')).features;
const evidence = new Map(parseCsv(readFileSync(path('boundaries/build/ward-evidence.csv'), 'utf8')).map((r) => [Number(r.code), r]));

const matched = matchRedCross(arc, gazette, matchStations(stations, gazette).byCode);
const boxes = new WeakMap();
const at = (features, pt) =>
    features.find((f) => {
        if (!boxes.has(f)) boxes.set(f, turf.bbox(f));
        const [w, s, e, n] = boxes.get(f);
        return pt[0] >= w && pt[0] <= e && pt[1] >= s && pt[1] <= n && turf.booleanPointInPolygon(pt, f);
    }) ?? null;
/** Metres from `pt` to the nearest edge of `feature`, or Infinity without a feature. */
function edgeMetres(feature, pt) {
    if (!feature) return Infinity;
    const lines = turf.flatten(turf.polygonToLine(feature)).features.flatMap((l) => turf.flatten(l).features);
    return Math.min(...lines.map((l) => turf.pointToLineDistance(pt, l, { units: 'meters' })));
}
const clearance = (pt) => Math.min(edgeMetres(at(iebc, pt), pt), edgeMetres(at(arc.features, pt), pt));
const countyCode = (name) => [...gazette.counties.values()].find((c) => normName(c.name) === normName(name) || (normName(name) === 'NAIROBI' && c.code === 47))?.code;

const namesake = new Map();
for (const w of gazette.wards.values()) {
    for (const name of new Set([w.name, w.name.replace(/\s*(township|town)$/i, '')])) {
        const key = `${w.countyCode}|${normName(name)}`;
        namesake.set(key, namesake.has(key) && namesake.get(key) !== w.code ? null : w.code);
    }
}
const where = (code) => {
    const w = gazette.wards.get(code);
    return `${code} ${w.name} (${gazette.constituencies.get(w.constituencyCode).name}, ${gazette.counties.get(w.countyCode).name}; GN 13771)`;
};

const accepted = [
    {
        place: 'Mandera town centre',
        lon: 41.85732,
        lat: 3.93842,
        expected_code: 212,
        source: `OpenStreetMap node/44929726 (place=town, name=Mandera; ${OSM}). Expected ward: ${where(212)}, which is Mandera town; confirmed in the Task 4b brief (41.855, 3.937).`,
    },
    {
        place: 'Kitengela town centre',
        lon: 36.96,
        lat: -1.475,
        expected_code: 922,
        source: `Task 4b brief: Kitengela town at (36.96, -1.475), confirmed to be in ${where(922)}. OpenStreetMap node/2956137647 (place=town, name=Kitengela; ${OSM}) is 100 m west at (36.95899, -1.47454), within 10 m of the Red Cross line between Kitengela and Oloosirkon/Sholinke, so it is not used.`,
    },
];
const rejected = [];
for (const r of accepted) {
    const metres = clearance([r.lon, r.lat]);
    if (metres < CLEARANCE_M) throw new Error(`${r.place} is ${metres.toFixed(0)} m from a line`);
}

for (const f of places) {
    const p = f.properties ?? {};
    if (f.geometry?.type !== 'Point' || !p.name || ['Mandera', 'Kitengela'].includes(p.name)) continue;
    if (!(p.place === 'town' || p.place === 'city' || VILLAGES.has(p.id))) continue;
    const pt = f.geometry.coordinates.map((v) => Math.round(v * 1e5) / 1e5);
    const rc = at(arc.features, pt);
    if (!rc) continue;
    const code = namesake.get(`${countyCode(rc.properties.county)}|${normName(p.name)}`);
    if (!code) continue;
    const inIebc = Number(at(iebc, pt)?.properties.COUNTY_ASS) === code;
    const inRedCross = matched.get(code) === rc;
    const row = { place: `${p.name} ${p.place}`, lon: pt[0], lat: pt[1], expected_code: code };
    const e = evidence.get(code);
    const metres = clearance(pt);
    if (metres < CLEARANCE_M) {
        rejected.push({ ...row, osm: p.id, reason: `${metres.toFixed(0)} m from a line in ${edgeMetres(at(iebc, pt), pt) < CLEARANCE_M ? 'the IEBC' : 'the Red Cross'} layer: too close to call` });
    } else if (!at(iebc, pt)) {
        rejected.push({ ...row, osm: p.id, reason: 'outside every IEBC ward: a coast or border line difference, not a ward filed under the wrong code' });
    } else if (!inIebc && !inRedCross) {
        rejected.push({ ...row, osm: p.id, reason: `in neither layer's ${gazette.wards.get(code).name}: IEBC ${at(iebc, pt)?.properties.COUNTY_ASS ?? 'none'}, Red Cross ${rc.properties.ward}` });
    } else if (!inIebc && Number(e.stations) >= 3 && Number(e.inside_ours) > Number(e.inside_red_cross)) {
        rejected.push({ ...row, osm: p.id, reason: `only the Red Cross layer has it in its ward, but ${e.stations} stations favour IEBC (${e.inside_ours} inside IEBC, ${e.inside_red_cross} inside Red Cross)` });
    } else {
        accepted.push({ ...row, source: `OpenStreetMap ${p.id} (place=${p.place}, name=${p.name}; ${OSM}). Expected ward: ${where(code)}, the ward named after this ${p.place}.` });
    }
}

const order = (a, b) => a.expected_code - b.expected_code || a.place.localeCompare(b.place);
writeFileSync(path('boundaries/overrides/reference_points.csv'), toCsv(accepted.sort(order), ['place', 'lon', 'lat', 'expected_code', 'source']));
writeFileSync(path('boundaries/build/reference-candidates.csv'), toCsv(rejected.sort(order), ['place', 'lon', 'lat', 'expected_code', 'osm', 'reason']));
console.log(`${accepted.length} reference points; ${rejected.length} candidates rejected (boundaries/build/reference-candidates.csv)`);
