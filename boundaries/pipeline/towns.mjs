// Towns layer: OSM cities and towns (HOT export on HDX), each tagged with the ward it falls in.
// Run with `npm run boundaries:towns` after `npm run boundaries:fetch`.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as turf from '@turf/turf';

export const KENYA_BBOX = [33.5, -5.0, 42.5, 5.5];
const PLACES = new Set(['city', 'town']);

const inBox = ([x, y]) => x >= KENYA_BBOX[0] && x <= KENYA_BBOX[2] && y >= KENYA_BBOX[1] && y <= KENYA_BBOX[3];

/** "12,000" -> 12000; anything unparseable -> null. */
export function parsePopulation(value) {
    if (value === null || value === undefined) return null;
    const digits = String(value).replace(/[,\s]/g, '');
    return /^\d+$/.test(digits) ? Number.parseInt(digits, 10) : null;
}

/**
 * Points from the HOT OSM populated-places export (GeoJSON) or an Overpass response,
 * keeping named cities and towns inside Kenya's bounding box.
 */
export function toTownsGeoJSON(source) {
    const raw = source.elements
        ? source.elements.map((e) => ({ tags: e.tags ?? {}, coords: [e.lon, e.lat] }))
        : source.features.map((f) => ({ tags: f.properties ?? {}, coords: f.geometry?.coordinates }));
    const features = raw
        .filter(({ tags, coords }) => tags.name && PLACES.has(tags.place) && Array.isArray(coords) && inBox(coords))
        .map(({ tags, coords }) => ({
            type: 'Feature',
            properties: { name: String(tags.name).trim(), place: tags.place, population: parsePopulation(tags.population) },
            geometry: { type: 'Point', coordinates: [Math.round(coords[0] * 1e5) / 1e5, Math.round(coords[1] * 1e5) / 1e5] },
        }));
    return { type: 'FeatureCollection', features };
}

/** Adds ward_code (and its parents) to each town from the ward polygons; towns outside every ward are dropped. */
export function assignWards(towns, wards) {
    const boxes = wards.features.map((w) => ({ w, b: turf.bbox(w) }));
    const features = [];
    for (const town of towns.features) {
        const [x, y] = town.geometry.coordinates;
        const hit = boxes.find(({ w, b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && turf.booleanPointInPolygon(town, w));
        if (!hit) continue;
        const p = hit.w.properties;
        features.push({
            ...town,
            properties: { ...town.properties, ward_code: p.code, constituency_code: p.constituency_code, county_code: p.county_code },
        });
    }
    // Cities first, then by population, so MapLibre places the important labels first.
    features.sort((a, b) => (a.properties.place === b.properties.place ? 0 : a.properties.place === 'city' ? -1 : 1) || (b.properties.population ?? 0) - (a.properties.population ?? 0));
    features.forEach((f, i) => (f.properties.rank = i));
    return { type: 'FeatureCollection', features };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const root = resolve(import.meta.dirname, '../..');
    const src = JSON.parse(readFileSync(resolve(root, 'boundaries/raw/osm/places/populated_places.geojson'), 'utf8'));
    const wards = JSON.parse(readFileSync(resolve(root, 'public/boundaries/wards.geojson'), 'utf8'));
    const towns = assignWards(toTownsGeoJSON(src), wards);
    const body = JSON.stringify(towns);
    writeFileSync(resolve(root, 'public/boundaries/towns.geojson'), body);
    const manifestPath = resolve(root, 'public/boundaries/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest['towns.geojson'] = createHash('sha256').update(body).digest('hex').slice(0, 8);
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`towns.geojson: ${towns.features.length} towns (${(body.length / 1024).toFixed(1)} KB)`);
}
