import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stationName, toStationsGeoJSON } from '../../../boundaries/pipeline/stations.mjs';

const root = resolve(import.meta.dirname, '../../..');
const read = (f) => readFileSync(resolve(root, 'public/boundaries', f));

describe('stations', () => {
    it('title-cases names and keeps known acronyms', () => {
        expect(stationName('ATIAR  PRIMARY SCHOOL')).toBe('Atiar Primary School');
        expect(stationName('ACK ST. PAULS (KIAMBU)')).toBe('ACK St. Pauls (Kiambu)');
    });

    it('keeps a station only inside its listed county and merges streams at one centre', () => {
        const county = { type: 'Feature', properties: { code: 1 }, geometry: { type: 'Polygon', coordinates: [[[37, 0], [38, 0], [38, 1], [37, 1], [37, 0]]] } };
        const out = toStationsGeoJSON(
            [
                { code: 5, countyCode: 1, point: [37.5, 0.5], name: 'A SCHOOL' },
                { code: 5, countyCode: 1, point: [37.50001, 0.50001], name: 'A SCHOOL' },
                { code: 6, countyCode: 1, point: [0, 0], name: 'NOWHERE' },
                { code: 7, countyCode: 2, point: [37.5, 0.5], name: 'WRONG COUNTY' },
            ],
            { type: 'FeatureCollection', features: [county] },
        );
        expect(out.features.map((f) => [f.properties.name, f.properties.ward_code])).toEqual([['A School', 5]]);
    });

    it('real output: thousands of stations, every one on a gazette ward, hash in the manifest', () => {
        const stations = JSON.parse(read('stations.geojson').toString());
        const wards = new Set(JSON.parse(read('units.json').toString()).filter((u) => u.l === 'ward').map((u) => u.c));
        expect(stations.features.length).toBeGreaterThan(10000);
        for (const f of stations.features) expect(wards.has(f.properties.ward_code)).toBe(true);
        const manifest = JSON.parse(read('manifest.json').toString());
        expect(manifest['stations.geojson']).toBe(createHash('sha256').update(read('stations.geojson')).digest('hex').slice(0, 8));
    });
});
