// Evidence for ward corrections (Task 4b). Scores each ward polygon against IEBC's 2013
// polling-station locations and the American Red Cross ward layer, and checks reviewed
// reference points (town centres) against both.
//
// Names are used here only to gather evidence: a station gets a gazette ward code by an
// exact normalised ward-name match inside its own constituency, and a Red Cross polygon is
// matched by exact normalised name inside its county. Nothing is ever joined on names in
// the outputs: replacements are written to ward_patches.csv by hand, by code and uid.

import * as turf from '@turf/turf';
import { parseCsv } from './gazette.mjs';
import { KENYA_BBOX } from './towns.mjs';

// A replace row needs at least this many matched stations, at most MAX_INSIDE_OURS of them
// inside our polygon and at least MIN_INSIDE_RED_CROSS inside the Red Cross polygon.
export const STATION_RULE = { minStations: 5, maxInsideOurs: 0.3, minInsideRedCross: 0.7 };

/** Upper case, no accents, no punctuation or spaces, without the word "ward". */
export function normName(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\bWARD\b/g, '')
        .replace(/[^A-Z0-9]/g, '');
}

// County names in the 2013 stations and the Red Cross layer that differ from the gazette.
export const COUNTY_ALIASES = { NAIROBI: 'Nairobi City' };

// 2013 constituency names (the stations') renamed by 2026. Each is resolved inside its county only.
export const CONSTITUENCY_ALIASES = [
    { county: 'Homa Bay', from: 'Mbita', to: 'Suba North' },
    { county: 'Homa Bay', from: 'Suba', to: 'Suba South' },
];

const inKenya = ([x, y]) => x >= KENYA_BBOX[0] && x <= KENYA_BBOX[2] && y >= KENYA_BBOX[1] && y <= KENYA_BBOX[3];
const share = (hits, total) => (total > 0 ? Math.round((hits / total) * 1000) / 1000 : null);

const boxes = new WeakMap();

/** Point-in-polygon with a (cached) bounding-box test first. */
function contains(feature, point) {
    if (!boxes.has(feature)) boxes.set(feature, turf.bbox(feature));
    const [w, s, e, n] = boxes.get(feature);
    const [x, y] = point;
    return x >= w && x <= e && y >= s && y <= n && turf.booleanPointInPolygon(point, feature);
}

function countyIndex(gazette) {
    const byName = new Map([...gazette.counties.values()].map((c) => [normName(c.name), c.code]));
    return (name) => {
        const key = normName(name);
        return byName.get(key) ?? byName.get(normName(COUNTY_ALIASES[key])) ?? null;
    };
}

/**
 * Assign each polling station a gazette ward code.
 * `stations` is a FeatureCollection of points with `county`, `constituen` and `ward` names.
 * Returns `{ byCode: Map<code, [lon, lat][]>, counts, unmatched }`; `unmatched` lists the
 * county/constituency/ward name groups that could not be assigned, with station counts.
 */
export function matchStations(stations, gazette) {
    const countyOf = countyIndex(gazette);
    const constituencies = new Map();
    for (const c of gazette.constituencies.values()) constituencies.set(`${c.countyCode}|${normName(c.name)}`, c.code);
    const aliases = new Map(CONSTITUENCY_ALIASES.map((a) => [`${normName(a.county)}|${normName(a.from)}`, normName(a.to)]));

    // A ward name used twice inside one constituency would be ambiguous: it maps to null.
    const wards = new Map();
    for (const w of gazette.wards.values()) {
        const key = `${w.constituencyCode}|${normName(w.name)}`;
        wards.set(key, wards.has(key) ? null : w.code);
    }

    const byCode = new Map();
    const counts = { total: 0, assigned: 0, outside: 0, noCounty: 0, noConstituency: 0, noWard: 0 };
    const unmatched = new Map();
    const miss = (reason, p) => {
        counts[reason]++;
        const key = `${p.county}|${p.constituen}|${p.ward}`;
        const entry = unmatched.get(key) ?? { county: p.county, constituency: p.constituen, ward: p.ward, reason, stations: 0 };
        entry.stations++;
        unmatched.set(key, entry);
    };

    for (const feature of stations.features) {
        counts.total++;
        const p = feature.properties ?? {};
        const point = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
        if (!point || !inKenya(point)) {
            counts.outside++;
            continue;
        }
        const countyCode = countyOf(p.county);
        if (countyCode === null) {
            miss('noCounty', p);
            continue;
        }
        const name = normName(p.constituen);
        const constituencyName = aliases.get(`${normName(gazette.counties.get(countyCode).name)}|${name}`) ?? name;
        const constituencyCode = constituencies.get(`${countyCode}|${constituencyName}`);
        if (constituencyCode === undefined) {
            miss('noConstituency', p);
            continue;
        }
        const code = wards.get(`${constituencyCode}|${normName(p.ward)}`);
        if (code === undefined || code === null) {
            miss('noWard', p);
            continue;
        }
        counts.assigned++;
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push([point[0], point[1]]);
    }

    return { byCode, counts, unmatched: [...unmatched.values()] };
}

/**
 * Match each gazette ward to a Red Cross polygon by exact normalised name inside its county.
 * Where a county has more than one ward or polygon with the name, each polygon goes to the
 * ward with the most of its stations inside it (greedily, each used once); with no stations
 * to tell them apart they stay unmatched. Returns `Map<code, Feature>`.
 */
export function matchRedCross(arc, gazette, stationsByCode) {
    const countyOf = countyIndex(gazette);
    const polygons = new Map();
    for (const feature of arc.features) {
        const countyCode = countyOf(feature.properties?.county);
        if (countyCode === null || !feature.geometry) continue;
        const key = `${countyCode}|${normName(feature.properties.ward)}`;
        if (!polygons.has(key)) polygons.set(key, []);
        polygons.get(key).push(feature);
    }
    const wards = new Map();
    for (const w of gazette.wards.values()) {
        const key = `${w.countyCode}|${normName(w.name)}`;
        if (!wards.has(key)) wards.set(key, []);
        wards.get(key).push(w.code);
    }

    const matches = new Map();
    for (const [key, codes] of wards) {
        const candidates = polygons.get(key) ?? [];
        if (candidates.length === 0) continue;
        if (codes.length === 1 && candidates.length === 1) {
            matches.set(codes[0], candidates[0]);
            continue;
        }
        const pairs = [];
        for (const code of codes) {
            const points = stationsByCode.get(code) ?? [];
            for (const polygon of candidates) {
                const hits = points.filter((pt) => contains(polygon, pt)).length;
                if (hits > 0) pairs.push({ code, polygon, hits });
            }
        }
        pairs.sort((a, b) => b.hits - a.hits || a.code - b.code);
        const used = new Set();
        for (const { code, polygon } of pairs) {
            if (matches.has(code) || used.has(polygon)) continue;
            matches.set(code, polygon);
            used.add(polygon);
        }
    }
    return matches;
}

/** Finds the feature containing a point, through a 0.25-degree grid of bounding boxes. */
function locator(features) {
    const cell = 0.25;
    const grid = new Map();
    for (const f of features) {
        if (!boxes.has(f)) boxes.set(f, turf.bbox(f));
        const [w, s, e, n] = boxes.get(f);
        for (let i = Math.floor(w / cell); i <= Math.floor(e / cell); i++) {
            for (let j = Math.floor(s / cell); j <= Math.floor(n / cell); j++) {
                const key = `${i}|${j}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(f);
            }
        }
    }
    return (pt) => (grid.get(`${Math.floor(pt[0] / cell)}|${Math.floor(pt[1] / cell)}`) ?? []).find((f) => contains(f, pt)) ?? null;
}

/**
 * One row per gazette ward, by code:
 * `{ code, stations, insideOurs, insideRedCross, arcUid, mostlyIn }`.
 * - `stations`: polling stations matched to the ward (matchStations) whose GPS falls inside the
 *   ward's own county in `wards`. The 2013 coordinates are rough: many are (0, 0) or another
 *   county's, and those say nothing about where the ward's polygon should be.
 * - `insideOurs` / `insideRedCross`: the share of them inside our polygon for the code and inside
 *   the matched Red Cross polygon (null with no stations, or no Red Cross match).
 * - `arcUid`: the matched Red Cross polygon, or null.
 * - `mostlyIn`: the code of our polygon holding most of the stations that miss ours, or null.
 */
export function scoreWards({ wards, stations, arc, gazette }) {
    const { byCode: matched } = matchStations(stations, gazette);
    const locate = locator(wards.features);
    const countyOf = (code) => gazette.wards.get(code)?.countyCode;

    const byCode = new Map();
    const landed = new Map();
    for (const [code, points] of matched) {
        const kept = [];
        const where = [];
        for (const pt of points) {
            const hit = locate(pt);
            if (!hit || countyOf(hit.properties.code) !== countyOf(code)) continue;
            kept.push(pt);
            where.push(hit.properties.code);
        }
        byCode.set(code, kept);
        landed.set(code, where);
    }
    const redCross = matchRedCross(arc, gazette, byCode);

    return [...gazette.wards.keys()]
        .sort((a, b) => a - b)
        .map((code) => {
            const points = byCode.get(code) ?? [];
            const polygon = redCross.get(code);
            const misses = new Map();
            for (const other of landed.get(code) ?? []) if (other !== code) misses.set(other, (misses.get(other) ?? 0) + 1);
            const missCount = [...misses.values()].reduce((a, b) => a + b, 0);
            return {
                code,
                stations: points.length,
                insideOurs: share(points.length - missCount, points.length),
                insideRedCross: polygon ? share(points.filter((pt) => contains(polygon, pt)).length, points.length) : null,
                arcUid: polygon?.properties.uid ?? null,
                mostlyIn: [...misses].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null,
            };
        });
}

/** Parse reference_points.csv (`place,lon,lat,expected_code,source`) into `{ place, lon, lat, expectedCode, source }[]`. */
export function parseReferencePoints(csvText) {
    return parseCsv(csvText).map((row, i) => {
        const line = i + 1;
        const place = (row.place ?? '').trim();
        const lon = Number(row.lon);
        const lat = Number(row.lat);
        const code = String(row.expected_code ?? '').trim();
        const source = (row.source ?? '').trim();
        if (place === '') throw new Error(`Reference point on data row ${line} has no place`);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || !inKenya([lon, lat])) {
            throw new Error(`Reference point ${place} (data row ${line}) has no valid lon/lat inside Kenya`);
        }
        if (!/^\d+$/.test(code) || Number(code) < 1 || Number(code) > 1450) {
            throw new Error(`Reference point ${place} (data row ${line}) has an invalid expected_code "${row.expected_code}"`);
        }
        if (source === '') throw new Error(`Reference point ${place} (data row ${line}) has no source`);
        return { place, lon, lat, expectedCode: Number(code), source };
    });
}

/**
 * Locate each reference point: `oursCode` is the code of our polygon containing it (or null),
 * `inRedCross` whether the Red Cross polygon matched to its expected code contains it.
 * `rows` are scoreWards rows (for the matched uids), `arc` the Red Cross layer.
 */
export function checkReferencePoints(points, { wards, arc, rows }) {
    const uidFor = new Map(rows.map((r) => [r.code, r.arcUid]));
    const byUid = new Map(arc.features.map((f) => [f.properties?.uid, f]));
    return points.map((p) => {
        const pt = [p.lon, p.lat];
        const hit = wards.features.find((f) => contains(f, pt));
        const polygon = byUid.get(uidFor.get(p.expectedCode));
        return { ...p, oursCode: hit?.properties.code ?? null, inRedCross: Boolean(polygon && contains(polygon, pt)) };
    });
}

/**
 * The signals that support replacing a ward's polygon with its Red Cross one: 'stations' and/or
 * 'reference point'. Each already pairs the Red Cross layer with an independent source, so
 * either is enough; stations or the Red Cross layer alone never are.
 */
export function replaceSignals(row, referenceChecks) {
    const signals = [];
    if (
        row.stations >= STATION_RULE.minStations &&
        row.insideOurs !== null &&
        row.insideOurs <= STATION_RULE.maxInsideOurs &&
        row.insideRedCross !== null &&
        row.insideRedCross >= STATION_RULE.minInsideRedCross
    ) {
        signals.push('stations');
    }
    const points = referenceChecks.filter((p) => p.expectedCode === row.code);
    if (points.some((p) => p.oursCode !== row.code && p.inRedCross)) signals.push('reference point');
    return signals;
}

const csvCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV text from an array of flat objects, columns in the order of `columns`. */
export function toCsv(rows, columns) {
    return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}
