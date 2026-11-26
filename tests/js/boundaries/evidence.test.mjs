import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    matchRedCross,
    matchStations,
    normName,
    parseReferencePoints,
    replaceSignals,
    scoreWards,
} from '../../../boundaries/pipeline/evidence.mjs';

// A small gazette: county 1 has two constituencies that both have a "Township" ward;
// county 2 is Homa Bay, whose 2013 constituency "Mbita" is now "Suba North".
const gazette = {
    wards: new Map([
        [1, { code: 1, name: 'Township', constituencyCode: 1, countyCode: 1 }],
        [2, { code: 2, name: 'Market', constituencyCode: 1, countyCode: 1 }],
        [3, { code: 3, name: 'Township', constituencyCode: 2, countyCode: 1 }],
        [4, { code: 4, name: 'Lake', constituencyCode: 2, countyCode: 1 }],
        [5, { code: 5, name: 'Rusinga', constituencyCode: 3, countyCode: 2 }],
    ]),
    constituencies: new Map([
        [1, { code: 1, name: 'North', countyCode: 1 }],
        [2, { code: 2, name: 'South', countyCode: 1 }],
        [3, { code: 3, name: 'Suba North', countyCode: 2 }],
    ]),
    counties: new Map([
        [1, { code: 1, name: 'Alpha' }],
        [2, { code: 2, name: 'Homa Bay' }],
    ]),
};

// 0.1-degree boxes laid out west to east near (36, 0), inside Kenya's bounding box.
const box = (x0, x1, y0 = 0, y1 = 0.1) => ({
    type: 'Polygon',
    coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});
const ward = (code, geometry) => ({ type: 'Feature', properties: { code }, geometry });
const wards = {
    type: 'FeatureCollection',
    features: [
        ward(1, box(36.0, 36.1)),
        ward(2, box(36.1, 36.2)),
        ward(3, box(36.2, 36.3)),
        ward(4, box(36.3, 36.4)),
        ward(5, box(36.4, 36.5)),
    ],
};

const station = (county, constituen, wardName, x, y = 0.05) => ({
    type: 'Feature',
    properties: { county, constituen, ward: wardName, name: 'SCHOOL' },
    geometry: { type: 'Point', coordinates: [x, y] },
});

describe('normName', () => {
    it('ignores case, punctuation, accents and the word "ward"', () => {
        expect(normName('Kahawa/sukari Ward')).toBe(normName('Kahawa Sukari'));
        expect(normName("Cherang'any/Chebororwa")).toBe('CHERANGANYCHEBORORWA');
        expect(normName('Embobut / Embulot')).toBe(normName('EMBOBUT/EMBULOT'));
    });
});

describe('matchStations', () => {
    it('assigns a ward code only from a ward of the same name in the station\'s own constituency', () => {
        const stations = {
            type: 'FeatureCollection',
            features: [
                station('ALPHA', 'NORTH', 'TOWNSHIP', 36.05),
                station('ALPHA', 'SOUTH', 'TOWNSHIP', 36.25),
                // "Lake" exists only in South: a North station named Lake must not be assigned.
                station('ALPHA', 'NORTH', 'LAKE', 36.35),
                // Unknown constituency: never guessed from another constituency.
                station('ALPHA', 'NORTH EAST', 'MARKET', 36.15),
            ],
        };
        const { byCode, counts } = matchStations(stations, gazette);
        expect(byCode.get(1)).toEqual([[36.05, 0.05]]);
        expect(byCode.get(3)).toEqual([[36.25, 0.05]]);
        expect(byCode.has(4)).toBe(false);
        expect(byCode.has(2)).toBe(false);
        expect(counts).toMatchObject({ total: 4, assigned: 2, noWard: 1, noConstituency: 1 });
    });

    it('resolves 2013 constituency names through the explicit alias table only', () => {
        const stations = {
            type: 'FeatureCollection',
            features: [station('HOMA BAY', 'MBITA', 'RUSINGA', 36.45), station('HOMA BAY', 'SUBA  NORTH', 'RUSINGA', 36.45)],
        };
        expect(matchStations(stations, gazette).byCode.get(5)).toHaveLength(2);
    });

    it('drops stations outside Kenya\'s bounding box', () => {
        const stations = {
            type: 'FeatureCollection',
            features: [station('ALPHA', 'NORTH', 'TOWNSHIP', -0.3, 36.1), station('ALPHA', 'NORTH', 'TOWNSHIP', 36.05)],
        };
        const { byCode, counts } = matchStations(stations, gazette);
        expect(byCode.get(1)).toHaveLength(1);
        expect(counts.outside).toBe(1);
    });
});

describe('matchRedCross', () => {
    // Two Red Cross polygons in county Alpha share the name Township.
    const arc = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { uid: 'A1', ward: 'TOWNSHIP', county: 'ALPHA' }, geometry: box(36.2, 36.3) },
            { type: 'Feature', properties: { uid: 'A2', ward: 'Township Ward', county: 'Alpha' }, geometry: box(36.0, 36.1) },
            { type: 'Feature', properties: { uid: 'A3', ward: 'Market', county: 'Beta' }, geometry: box(36.1, 36.2) },
        ],
    };

    it('resolves wards sharing a name in one county by where their stations are', () => {
        const byCode = new Map([
            [1, [[36.05, 0.05], [36.06, 0.05]]],
            [3, [[36.25, 0.05]]],
        ]);
        const matches = matchRedCross(arc, gazette, byCode);
        expect(matches.get(1).properties.uid).toBe('A2');
        expect(matches.get(3).properties.uid).toBe('A1');
    });

    it('matches by name within the county only', () => {
        const matches = matchRedCross(arc, gazette, new Map());
        expect(matches.has(2)).toBe(false); // the only "Market" polygon is in another county
    });

    it('renames Red Cross wards only through the explicit alias table, within the county', () => {
        // Mandera's Red Cross layer uses 2013 names: its "LIBEHIA" (Lafey) is the gazette's 216 Sala,
        // and its "BULLA MPYA" (Mandera East) is the gazette's 215 Libehia.
        const mandera = {
            wards: new Map([
                [215, { code: 215, name: 'Libehia', constituencyCode: 43, countyCode: 9 }],
                [216, { code: 216, name: 'Sala', constituencyCode: 44, countyCode: 9 }],
                [217, { code: 217, name: 'Libehia', constituencyCode: 99, countyCode: 10 }],
            ]),
            constituencies: new Map(),
            counties: new Map([
                [9, { code: 9, name: 'Mandera' }],
                [10, { code: 10, name: 'Elsewhere' }],
            ]),
        };
        const rc = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { uid: 'L', ward: 'LIBEHIA', county: 'MANDERA' }, geometry: box(36.0, 36.1) },
                { type: 'Feature', properties: { uid: 'B', ward: 'BULLA MPYA', county: 'MANDERA' }, geometry: box(36.1, 36.2) },
                { type: 'Feature', properties: { uid: 'E', ward: 'Libehia', county: 'Elsewhere' }, geometry: box(36.2, 36.3) },
            ],
        };
        const matches = matchRedCross(rc, mandera, new Map());
        expect(matches.get(215).properties.uid).toBe('B');
        expect(matches.get(216).properties.uid).toBe('L');
        expect(matches.get(217).properties.uid).toBe('E');
    });

    it('leaves a shared name unmatched when stations cannot tell the polygons apart', () => {
        const matches = matchRedCross(arc, gazette, new Map());
        expect(matches.has(1)).toBe(false);
        expect(matches.has(3)).toBe(false);
    });
});

describe('scoreWards', () => {
    it('returns one row per gazette ward with the share of its stations inside each layer', () => {
        // Ward 1's stations sit in our polygon for ward 2; the Red Cross polygon for ward 1 holds them.
        const stations = {
            type: 'FeatureCollection',
            features: [
                ...[36.11, 36.12, 36.13, 36.14].map((x) => station('ALPHA', 'NORTH', 'TOWNSHIP', x)),
                station('ALPHA', 'NORTH', 'TOWNSHIP', 36.05),
                station('ALPHA', 'NORTH', 'MARKET', 36.15),
            ],
        };
        const arc = {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { uid: 'R1', ward: 'Township', county: 'Alpha' }, geometry: box(36.04, 36.15) },
                { type: 'Feature', properties: { uid: 'R2', ward: 'Lake', county: 'Alpha' }, geometry: box(36.3, 36.4) },
            ],
        };
        const rows = scoreWards({ wards, stations, arc, gazette });
        expect(rows.map((r) => r.code)).toEqual([1, 2, 3, 4, 5]);
        expect(rows[0]).toEqual({ code: 1, stations: 5, insideOurs: 0.2, insideRedCross: 1, arcUid: 'R1', mostlyIn: 2 });
        expect(rows[1]).toEqual({ code: 2, stations: 1, insideOurs: 1, insideRedCross: null, arcUid: null, mostlyIn: null });
        expect(rows[3]).toEqual({ code: 4, stations: 0, insideOurs: null, insideRedCross: null, arcUid: 'R2', mostlyIn: null });
    });

    it('ignores stations whose GPS puts them outside their own county (misgeocoded)', () => {
        // Ward 5 is the only ward of county 2. A ward 1 (county 1) station placed inside ward 5,
        // or outside every ward, says nothing about ward 1's polygon.
        const stations = {
            type: 'FeatureCollection',
            features: [
                station('ALPHA', 'NORTH', 'TOWNSHIP', 36.05),
                station('ALPHA', 'NORTH', 'TOWNSHIP', 36.45),
                station('ALPHA', 'NORTH', 'TOWNSHIP', 37.5),
            ],
        };
        const rows = scoreWards({ wards, stations, arc: { type: 'FeatureCollection', features: [] }, gazette });
        expect(rows[0]).toMatchObject({ code: 1, stations: 1, insideOurs: 1 });
    });
});

describe('replaceSignals', () => {
    const row = { code: 1, stations: 5, insideOurs: 0.2, insideRedCross: 0.8, arcUid: 'R1' };

    it('counts stations only with at least 5, at most 30% inside ours and at least 70% inside the Red Cross ward', () => {
        expect(replaceSignals(row, [])).toEqual(['stations']);
        expect(replaceSignals({ ...row, stations: 4 }, [])).toEqual([]);
        expect(replaceSignals({ ...row, insideOurs: 0.31 }, [])).toEqual([]);
        expect(replaceSignals({ ...row, insideRedCross: 0.69 }, [])).toEqual([]);
    });

    it('counts a reference point only when it is in the wrong code in ours and inside the Red Cross ward', () => {
        const point = { expectedCode: 1, oursCode: 2, inRedCross: true };
        const none = { ...row, stations: 0 };
        expect(replaceSignals(none, [point])).toEqual(['reference point']);
        expect(replaceSignals(none, [{ ...point, oursCode: 1 }])).toEqual([]);
        expect(replaceSignals(none, [{ ...point, inRedCross: false }])).toEqual([]);
        // Outside every IEBC ward is a coast or border difference, not a misfiled code.
        expect(replaceSignals(none, [{ ...point, oursCode: null }])).toEqual([]);
        expect(replaceSignals(row, [point])).toEqual(['stations', 'reference point']);
    });
});

describe('parseReferencePoints', () => {
    const csv = readFileSync(resolve(import.meta.dirname, '../../../boundaries/overrides/reference_points.csv'), 'utf8');

    it('reads cited points, including Mandera and Kitengela town centres', () => {
        const points = parseReferencePoints(csv);
        const byPlace = (re) => points.find((p) => re.test(p.place));
        expect(byPlace(/^Mandera/)).toMatchObject({ expectedCode: 212 });
        expect(byPlace(/^Kitengela/)).toMatchObject({ expectedCode: 922 });
        for (const p of points) {
            expect(p.source, p.place).toMatch(/\S/);
            expect(Number.isFinite(p.lon) && Number.isFinite(p.lat)).toBe(true);
        }
    });

    it('rejects a row without a source or with a bad code', () => {
        expect(() => parseReferencePoints('place,lon,lat,expected_code,source\nX,36,0,5,\n')).toThrow(/source/);
        expect(() => parseReferencePoints('place,lon,lat,expected_code,source\nX,36,0,abc,OSM\n')).toThrow(/expected_code/);
    });
});
