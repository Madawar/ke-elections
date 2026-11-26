// Writes the web-ready files and a manifest of short content hashes.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 8);

/**
 * Serialise `files` (`{ 'name.geojson': FeatureCollection, 'name.json': data }`) in memory.
 * GeoJSON coordinates are rounded to 5 decimal places (about 1 m).
 * Returns `{ buffers, manifest, sizes }`, keyed by file name.
 */
export function renderOutputs(files) {
    const buffers = {};
    const manifest = {};
    const sizes = {};
    for (const name of Object.keys(files).sort()) {
        const data = name.endsWith('.geojson') ? roundCollection(files[name]) : files[name];
        buffers[name] = Buffer.from(JSON.stringify(data));
        manifest[name] = hash(buffers[name]);
        sizes[name] = buffers[name].length;
    }
    return { buffers, manifest, sizes };
}

/**
 * Write `files` into `dir` and `manifest.json` as `{ "<file>": "<first 8 hex chars of sha256>" }`.
 * Entries already in the manifest for files this call does not write (towns.geojson, which
 * `npm run boundaries:towns` makes) are kept while the file exists, re-hashed from disk.
 * Returns the manifest and each written file's size in bytes.
 */
export function writeOutputs(dir, files) {
    const { buffers, manifest: written, sizes } = renderOutputs(files);
    mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of Object.entries(buffers)) writeFileSync(join(dir, name), bytes);

    const manifestPath = join(dir, 'manifest.json');
    const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
    const kept = Object.keys(previous).filter((name) => !(name in written) && existsSync(join(dir, name)));
    const all = { ...written, ...Object.fromEntries(kept.map((name) => [name, hash(readFileSync(join(dir, name)))])) };
    const manifest = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    return { manifest, sizes };
}
