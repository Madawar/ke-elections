// Writes the web-ready files and a manifest of short content hashes.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PRECISION = 1e5;
const round = (x) => Math.round(x * PRECISION) / PRECISION;

const roundPosition = (p) => [round(p[0]), round(p[1])];
const samePosition = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Round a ring, dropping points that collapse onto their neighbour. Null if fewer than 3 distinct points remain. */
function roundRing(ring) {
    const out = [];
    for (const p of ring.map(roundPosition)) {
        if (out.length === 0 || !samePosition(out[out.length - 1], p)) out.push(p);
    }
    return out.length >= 4 && samePosition(out[0], out[out.length - 1]) ? out : null;
}

function roundPolygon(rings) {
    const [outer, ...holes] = rings.map(roundRing);
    return outer ? [outer, ...holes.filter(Boolean)] : null;
}

function roundGeometry(geometry) {
    if (geometry.type === 'Point') return { ...geometry, coordinates: roundPosition(geometry.coordinates) };
    if (geometry.type === 'Polygon') {
        const coordinates = roundPolygon(geometry.coordinates);
        if (!coordinates) throw new Error('A polygon collapsed when rounded to 5 decimal places');
        return { ...geometry, coordinates };
    }
    if (geometry.type === 'MultiPolygon') {
        const coordinates = geometry.coordinates.map(roundPolygon).filter(Boolean);
        if (coordinates.length === 0) throw new Error('A multipolygon collapsed when rounded to 5 decimal places');
        return { ...geometry, coordinates };
    }
    throw new Error(`Unsupported geometry type ${geometry.type}`);
}

const roundCollection = (fc) => ({ ...fc, features: fc.features.map((f) => ({ ...f, geometry: roundGeometry(f.geometry) })) });

/**
 * Write `files` (`{ 'name.geojson': FeatureCollection, 'name.json': data }`) into `dir` and
 * `manifest.json` as `{ "<file>": "<first 8 hex chars of sha256>" }`.
 * GeoJSON coordinates are rounded to 5 decimal places (about 1 m).
 * Returns the manifest and each file's size in bytes.
 */
export function writeOutputs(dir, files) {
    mkdirSync(dir, { recursive: true });
    const manifest = {};
    const sizes = {};

    for (const name of Object.keys(files).sort()) {
        const data = name.endsWith('.geojson') ? roundCollection(files[name]) : files[name];
        const bytes = Buffer.from(JSON.stringify(data));
        writeFileSync(join(dir, name), bytes);
        manifest[name] = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
        sizes[name] = bytes.length;
    }

    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    return { manifest, sizes };
}
