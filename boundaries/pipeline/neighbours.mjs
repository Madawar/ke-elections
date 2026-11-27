// Which counties share a border, from the committed county boundaries
// (public/boundaries/counties.geojson). The counties are dissolved from one set of simplified
// wards (derive.mjs), so two counties that share a border share the very same vertices along it:
// a border is a segment (two consecutive vertices) found in both counties' rings. Counties that
// only meet at a single vertex, with no segment in common, are listed apart as `touching` and are
// not counted as neighbours.
//
// Usage: node boundaries/pipeline/neighbours.mjs  (writes resources/js/lib/export/countyNeighbours.json)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
export const COUNTIES = resolve(ROOT, 'public/boundaries/counties.geojson');
export const OUTPUT = resolve(ROOT, 'resources/js/lib/export/countyNeighbours.json');

const point = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`;

function rings(geometry) {
    if (geometry.type === 'Polygon') return geometry.coordinates;
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
    throw new Error(`Unexpected geometry ${geometry.type}`);
}

/**
 * `{ neighbours, touching }`: each a list of `[a, b]` county-code pairs (a < b), sorted. Neighbours
 * share at least one segment of border; touching pairs share a vertex but no segment.
 */
export function countyNeighbours(collection) {
    const segments = new Map();
    const vertices = new Map();
    const add = (map, key, code) => {
        const set = map.get(key) ?? new Set();
        set.add(code);
        map.set(key, set);
    };
    for (const f of collection.features) {
        const code = f.properties.code;
        for (const ring of rings(f.geometry))
            for (let i = 0; i < ring.length; i++) {
                const a = point(ring[i]);
                add(vertices, a, code);
                if (i + 1 < ring.length) {
                    const b = point(ring[i + 1]);
                    if (a !== b) add(segments, a < b ? `${a}|${b}` : `${b}|${a}`, code);
                }
            }
    }
    const pairs = (map) => {
        const out = new Set();
        for (const codes of map.values()) {
            const list = [...codes].sort((x, y) => x - y);
            for (let i = 0; i < list.length; i++)
                for (let j = i + 1; j < list.length; j++) out.add(`${list[i]}-${list[j]}`);
        }
        return out;
    };
    const shared = pairs(segments);
    const met = pairs(vertices);
    const toList = (set) =>
        [...set].map((k) => k.split('-').map(Number)).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    return {
        neighbours: toList(shared),
        touching: toList(new Set([...met].filter((k) => !shared.has(k)))),
    };
}

/** The committed file: neighbours by code, and how they were found. */
export function neighboursFile(collection) {
    const { neighbours, touching } = countyNeighbours(collection);
    return {
        about:
            'County pairs that share a border, by IEBC county code, computed by boundaries/pipeline/neighbours.mjs from public/boundaries/counties.geojson: two counties are neighbours when a segment of their boundaries (two consecutive vertices) is the same in both, as the counties are dissolved from one set of wards. Pairs that meet at a single point only are listed under "touching" and are not neighbours.',
        neighbours,
        touching,
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const collection = JSON.parse(readFileSync(COUNTIES, 'utf8'));
    const file = neighboursFile(collection);
    // One pair per line, so a change to the boundaries reads as a short diff.
    const list = (pairs) => `[\n${pairs.map((p) => `        ${JSON.stringify(p)}`).join(',\n')}\n    ]`;
    writeFileSync(
        OUTPUT,
        `{\n    "about": ${JSON.stringify(file.about)},\n    "neighbours": ${list(file.neighbours)},\n    "touching": ${list(file.touching)}\n}\n`,
    );
    console.log(`${file.neighbours.length} neighbouring pairs, ${file.touching.length} touching at a point, written to ${OUTPUT}`);
}
