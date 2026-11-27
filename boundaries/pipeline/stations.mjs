// Polling stations layer: IEBC's 2013 polling-station locations (github.com/mikelmaron/kenya-election-data,
// scraped from vote.iebc.or.ke), the only national set with GPS. Each station keeps the ward IEBC
// listed it under (matched by name within its constituency, as in evidence.mjs), and only stations
// whose point falls inside their listed county are kept: about 10,000 sit at (0,0) or elsewhere.
// Run with `npm run boundaries:stations` after `npm run boundaries:fetch`.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as turf from '@turf/turf';
import { matchStations } from './evidence.mjs';
import { loadGazette } from './gazette.mjs';
import { runMapshaper } from './wards.mjs';

const round = (x) => Math.round(x * 1e5) / 1e5;

/** "ATIAR PRIMARY SCHOOL" -> "Atiar Primary School"; keeps short all-caps tokens such as "ACK", "PCEA". */
export function stationName(raw) {
    const keep = new Set(['ACK', 'AIC', 'PCEA', 'SDA', 'RC', 'DEB', 'CDF', 'PAG', 'AIPCA', 'NCCK', 'KAG', 'MCK', 'ELCK', 'II', 'III', 'IV']);
    return String(raw ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/(^|[\s(/-])([a-z'.]+)/g, (_, sep, word) => sep + (keep.has(word.toUpperCase().replace(/\./g, '')) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)));
}

/**
 * Stations as a FeatureCollection of points `{name, ward_code}`, kept only when the point lies in
 * the county the station is listed under; streams at one centre (same name and place) are merged.
 */
export function toStationsGeoJSON(assigned, counties) {
    const byCounty = new Map(counties.features.map((f) => [f.properties.code, { f, b: turf.bbox(f) }]));
    const seen = new Set();
    const features = [];
    for (const s of assigned) {
        const county = byCounty.get(s.countyCode);
        const [x, y] = s.point;
        if (!county || x < county.b[0] || x > county.b[2] || y < county.b[1] || y > county.b[3]) continue;
        if (!turf.booleanPointInPolygon(s.point, county.f)) continue;
        const name = stationName(s.name);
        const key = `${name}|${round(x).toFixed(4)}|${round(y).toFixed(4)}`;
        if (!name || seen.has(key)) continue;
        seen.add(key);
        features.push({ type: 'Feature', properties: { name, ward_code: s.code }, geometry: { type: 'Point', coordinates: [round(x), round(y)] } });
    }
    return { type: 'FeatureCollection', features };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const root = resolve(import.meta.dirname, '../..');
    const gazette = loadGazette(readFileSync(resolve(root, 'data/reference/iebc_wards_2027_gn13771.csv'), 'utf8'));
    const { output } = await runMapshaper(`-i ${resolve(root, 'boundaries/raw/mikelmaron/output/pollingstations.shp')} -o out.json format=geojson`, {});
    const raw = JSON.parse(output['out.json'].toString());
    const counties = JSON.parse(readFileSync(resolve(root, 'public/boundaries/counties.geojson'), 'utf8'));
    const { assigned, counts } = matchStations(raw, gazette);
    const stations = toStationsGeoJSON(assigned, counties);
    const body = JSON.stringify(stations);
    writeFileSync(resolve(root, 'public/boundaries/stations.geojson'), body);
    const manifestPath = resolve(root, 'public/boundaries/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest['stations.geojson'] = createHash('sha256').update(body).digest('hex').slice(0, 8);
    writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
    console.log(`stations.geojson: ${stations.features.length} stations from ${counts.assigned} matched of ${counts.total} (${(body.length / 1024).toFixed(0)} KB)`);
}
