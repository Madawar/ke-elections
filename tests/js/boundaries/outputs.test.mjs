// Checks the committed outputs under public/boundaries/ against the gazette.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { parseReferencePoints } from '../../../boundaries/pipeline/evidence.mjs';
import { loadGazette, loadProvinces } from '../../../boundaries/pipeline/gazette.mjs';
import { writeOutputs } from '../../../boundaries/pipeline/outputs.mjs';

const root = resolve(import.meta.dirname, '../../..');
const outDir = resolve(root, 'public/boundaries');
const read = (name) => readFileSync(resolve(outDir, name));
const json = (name) => JSON.parse(read(name).toString());

const gazette = loadGazette(readFileSync(resolve(root, 'data/reference/iebc_wards_2027_gn13771.csv'), 'utf8'));
const provinceOf = loadProvinces(readFileSync(resolve(root, 'boundaries/overrides/provinces.csv'), 'utf8'));

const layers = {
    provinces: json('provinces.geojson'),
    counties: json('counties.geojson'),
    constituencies: json('constituencies.geojson'),
    wards: json('wards.geojson'),
};
const labels = json('labels.geojson');
const units = json('units.json');
const manifest = json('manifest.json');

const expectedCounts = { provinces: 8, counties: 47, constituencies: 290, wards: 1450 };
const byCode = (collection) => new Map(collection.features.map((f) => [f.properties.code, f]));
const gzipKb = (name) => gzipSync(read(name)).length / 1024;

describe('boundary outputs', () => {
    for (const [name, count] of Object.entries(expectedCounts)) {
        it(`${name} has unique integer codes covering exactly 1..${count}`, () => {
            const codes = layers[name].features.map((f) => f.properties.code);
            expect(codes.every(Number.isInteger)).toBe(true);
            expect(new Set(codes).size).toBe(codes.length);
            expect([...codes].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
        });

        it(`${name} features all have a polygon with area above 0`, () => {
            for (const feature of layers[name].features) {
                expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
                expect(turf.area(feature), `${name} ${feature.properties.code}`).toBeGreaterThan(0);
            }
        });
    }

    it('simplification keeps every ward within 20% of its full-detail area', () => {
        const full = JSON.parse(readFileSync(resolve(root, 'boundaries/build/ward-areas.json'), 'utf8'));
        expect(Object.keys(full)).toHaveLength(1450);
        for (const feature of layers.wards.features) {
            const before = full[feature.properties.code];
            const change = turf.area(feature) / 1e6 / before - 1;
            expect(Math.abs(change), `ward ${feature.properties.code} ${feature.properties.name}`).toBeLessThanOrEqual(0.2);
        }
    });

    it('wards carry gazette names and parent codes', () => {
        for (const { properties: p } of layers.wards.features) {
            const ward = gazette.wards.get(p.code);
            expect(p).toEqual({
                code: p.code,
                name: ward.name,
                constituency_code: ward.constituencyCode,
                county_code: ward.countyCode,
            });
        }
    });

    it('constituencies carry gazette names and county codes', () => {
        for (const { properties: p } of layers.constituencies.features) {
            const c = gazette.constituencies.get(p.code);
            expect(p).toEqual({ code: p.code, name: c.name, county_code: c.countyCode });
        }
    });

    it('counties carry gazette names and the province from provinces.csv', () => {
        for (const { properties: p } of layers.counties.features) {
            expect(p).toEqual({
                code: p.code,
                name: gazette.counties.get(p.code).name,
                province_code: provinceOf.get(p.code).code,
            });
        }
    });

    it('provinces carry only code and name', () => {
        const names = new Map([...provinceOf.values()].map((p) => [p.code, p.name]));
        for (const { properties: p } of layers.provinces.features) {
            expect(p).toEqual({ code: p.code, name: names.get(p.code) });
        }
    });

    it('every label point exists at all four levels and sits inside its own polygon', () => {
        const ranks = { province: 0, county: 1, constituency: 2, ward: 3 };
        const polygons = {
            province: byCode(layers.provinces),
            county: byCode(layers.counties),
            constituency: byCode(layers.constituencies),
            ward: byCode(layers.wards),
        };
        const seen = { province: 0, county: 0, constituency: 0, ward: 0 };
        for (const feature of labels.features) {
            const { level, code, name, rank } = feature.properties;
            expect(rank).toBe(ranks[level]);
            const polygon = polygons[level].get(code);
            expect(name).toBe(polygon.properties.name);
            expect(turf.booleanPointInPolygon(feature, polygon), `${level} ${code}`).toBe(true);
            seen[level]++;
        }
        expect(seen).toEqual({ province: 8, county: 47, constituency: 290, ward: 1450 });
    });

    it('each ward label point is inside its constituency polygon, and each constituency label inside its county', () => {
        const constituencies = byCode(layers.constituencies);
        const counties = byCode(layers.counties);
        for (const f of labels.features) {
            const { level, code } = f.properties;
            if (level === 'ward') {
                const parent = constituencies.get(gazette.wards.get(code).constituencyCode);
                expect(turf.booleanPointInPolygon(f, parent), `ward ${code}`).toBe(true);
            } else if (level === 'constituency') {
                const parent = counties.get(gazette.constituencies.get(code).countyCode);
                expect(turf.booleanPointInPolygon(f, parent), `constituency ${code}`).toBe(true);
            }
        }
    });

    it('units.json has 1795 entries with parents and bounds inside Kenya', () => {
        expect(units).toHaveLength(8 + 47 + 290 + 1450);
        const levels = { province: 8, county: 47, constituency: 290, ward: 1450 };
        for (const [level, count] of Object.entries(levels)) {
            expect(units.filter((u) => u.l === level)).toHaveLength(count);
        }
        for (const u of units) {
            const [w, s, e, n] = u.b;
            expect(w).toBeGreaterThanOrEqual(33.5);
            expect(s).toBeGreaterThanOrEqual(-5.0);
            expect(e).toBeLessThanOrEqual(42.5);
            expect(n).toBeLessThanOrEqual(5.5);
            expect(w).toBeLessThan(e);
            expect(s).toBeLessThan(n);
            if (u.l === 'province') expect(u.p).toBeNull();
        }
        const unit = (l, c) => units.find((u) => u.l === l && u.c === c);
        expect(unit('ward', 1450).p).toBe(gazette.wards.get(1450).constituencyCode);
        expect(unit('constituency', 1).p).toBe(gazette.constituencies.get(1).countyCode);
        expect(unit('county', 1).p).toBe(provinceOf.get(1).code);
    });

    it('manifest hashes match the file contents', () => {
        const files = Object.keys(manifest);
        expect(files.sort()).toEqual(
            ['constituencies.geojson', 'counties.geojson', 'labels.geojson', 'provinces.geojson', 'towns.geojson', 'units.json', 'wards.geojson'],
        );
        for (const file of files) {
            expect(manifest[file]).toBe(createHash('sha256').update(read(file)).digest('hex').slice(0, 8));
        }
    });

    it('gzipped sizes are within budget', () => {
        expect(gzipKb('counties.geojson')).toBeLessThanOrEqual(120);
        expect(gzipKb('constituencies.geojson')).toBeLessThanOrEqual(180);
        expect(gzipKb('wards.geojson')).toBeLessThanOrEqual(300);
        expect(gzipKb('units.json')).toBeLessThanOrEqual(60);
    });

    describe('reference points (Task 4b)', () => {
        const wardsByCode = byCode(layers.wards);
        const wardAt = (lon, lat) =>
            layers.wards.features.find((f) => turf.booleanPointInPolygon(turf.point([lon, lat]), f))?.properties.code ?? null;

        it('Mandera town centre is in 212 Township and Kitengela town in 922 Kitengela', () => {
            expect(wardAt(41.855, 3.937)).toBe(212);
            expect(wardAt(36.96, -1.475)).toBe(922);
        });

        const points = parseReferencePoints(readFileSync(resolve(root, 'boundaries/overrides/reference_points.csv'), 'utf8'));
        for (const p of points) {
            it(`${p.place} is in ward ${p.expectedCode} ${gazette.wards.get(p.expectedCode)?.name}`, () => {
                expect(turf.booleanPointInPolygon(turf.point([p.lon, p.lat]), wardsByCode.get(p.expectedCode))).toBe(true);
            });
        }
    });
});

describe('writeOutputs', () => {
    it('keeps manifest entries for files it does not write, re-hashed from disk', () => {
        const dir = mkdtempSync(join(tmpdir(), 'outputs-'));
        try {
            writeFileSync(join(dir, 'towns.geojson'), '{"type":"FeatureCollection","features":[]}');
            writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ 'towns.geojson': 'stale000', 'gone.geojson': 'deadbeef' }));
            const fc = { type: 'FeatureCollection', features: [] };
            const { manifest } = writeOutputs(dir, { 'wards.geojson': fc });
            const onDisk = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
            const hash = (name) => createHash('sha256').update(readFileSync(join(dir, name))).digest('hex').slice(0, 8);
            expect(onDisk).toEqual(manifest);
            expect(Object.keys(onDisk)).toEqual(['towns.geojson', 'wards.geojson']);
            expect(onDisk['towns.geojson']).toBe(hash('towns.geojson'));
            expect(onDisk['wards.geojson']).toBe(hash('wards.geojson'));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
