import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KENYA_BBOX, assignWards, parsePopulation, toTownsGeoJSON } from '../../../boundaries/pipeline/towns.mjs';

const root = resolve(import.meta.dirname, '../../..');

describe('toTownsGeoJSON', () => {
    it('keeps named towns inside Kenya and parses population (Overpass shape)', () => {
        const fc = toTownsGeoJSON({
            elements: [
                { type: 'node', lat: 0.5, lon: 37, tags: { place: 'town' } },
                { type: 'node', lat: 10, lon: 37, tags: { place: 'town', name: 'Far away' } },
                { type: 'node', lat: -1.29, lon: 36.82, tags: { place: 'town', name: 'Valid', population: '12,000' } },
            ],
        });
        expect(fc.features).toHaveLength(1);
        expect(fc.features[0].properties).toEqual({ name: 'Valid', place: 'town', population: 12000 });
    });

    it('reads the HOT export shape and drops villages', () => {
        const fc = toTownsGeoJSON({
            features: [
                { properties: { name: 'Village', place: 'village' }, geometry: { type: 'Point', coordinates: [37, 0] } },
                { properties: { name: 'City', place: 'city', population: 'about 5' }, geometry: { type: 'Point', coordinates: [37, 0] } },
            ],
        });
        expect(fc.features.map((f) => f.properties)).toEqual([{ name: 'City', place: 'city', population: null }]);
    });

    it('parsePopulation', () => {
        expect(parsePopulation('1 234')).toBe(1234);
        expect(parsePopulation(null)).toBeNull();
        expect(parsePopulation('n/a')).toBeNull();
    });
});

describe('assignWards', () => {
    it('tags the containing ward and drops points outside every ward', () => {
        const ward = { type: 'Feature', properties: { code: 7, constituency_code: 2, county_code: 1 }, geometry: { type: 'Polygon', coordinates: [[[37, 0], [38, 0], [38, 1], [37, 1], [37, 0]]] } };
        const towns = toTownsGeoJSON({ elements: [
            { lat: 0.5, lon: 37.5, tags: { place: 'town', name: 'In' } },
            { lat: 3, lon: 40, tags: { place: 'town', name: 'Out' } },
        ] });
        const out = assignWards(towns, { type: 'FeatureCollection', features: [ward] });
        expect(out.features.map((f) => [f.properties.name, f.properties.ward_code, f.properties.rank])).toEqual([['In', 7, 0]]);
    });
});

describe('real output', () => {
    const towns = JSON.parse(readFileSync(resolve(root, 'public/boundaries/towns.geojson'), 'utf8'));
    const wardCodes = new Set(JSON.parse(readFileSync(resolve(root, 'public/boundaries/units.json'), 'utf8')).filter((u) => u.l === 'ward').map((u) => u.c));

    it('has at least 50 towns, a city, every point in Kenya and in a real ward', () => {
        expect(towns.features.length).toBeGreaterThanOrEqual(50);
        expect(towns.features.some((f) => f.properties.place === 'city')).toBe(true);
        for (const f of towns.features) {
            const [x, y] = f.geometry.coordinates;
            expect(x >= KENYA_BBOX[0] && x <= KENYA_BBOX[2] && y >= KENYA_BBOX[1] && y <= KENYA_BBOX[3]).toBe(true);
            expect(wardCodes.has(f.properties.ward_code)).toBe(true);
        }
    });

    it('has the self-hosted glyphs', () => {
        for (const font of ['Noto Sans Regular', 'Noto Sans Medium']) {
            for (const range of ['0-255', '256-511']) {
                const file = resolve(root, 'public/glyphs', font, `${range}.pbf`);
                expect(existsSync(file)).toBe(true);
                expect(statSync(file).size).toBeGreaterThan(1024);
            }
        }
    });
});
