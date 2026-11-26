// Assembles the 1,450-ward layer: IEBC polygons as the base, a handful of
// reviewed American Red Cross polygons patched in where IEBC has none or
// has filed a ward's polygon under the wrong code (mode=replace),
// then cleaned so wards neither overlap nor leave gaps. Names and parent
// codes always come from the gazette, joined on the IEBC ward code.

import mapshaper from 'mapshaper';
import { parseCsv } from './gazette.mjs';
import { validateCodes } from './validate.mjs';

const hasGeometry = (geometry) => Array.isArray(geometry?.coordinates) && geometry.coordinates.length > 0;

// -clean fills gaps smaller than this. Left at mapshaper's default (an 80 m-wide
// sliver), 434 gaps totalling about 1,324 km2 stayed inside the country on the real
// data: unmapped land that belongs to no ward, so the map showed holes and a tap
// there selected nothing. The largest is about 309 km2, so 400 km2 fills every one,
// each into the neighbouring ward it shares most boundary with.
const GAP_FILL_AREA = '400km2';

const norm = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const PATCH_MODES = ['fill', 'replace'];

/**
 * Parse ward_patches.csv into `{ iebcCode, arcUid, mode, reason }[]`.
 * `mode=fill`: the code has no IEBC polygon and takes the Red Cross one.
 * `mode=replace`: the code has an IEBC polygon, misfiled, which the Red Cross one replaces.
 * A CSV without a `mode` column is all fills; with one, every row needs a `reason`.
 */
export function parsePatches(csvText) {
    const codes = new Set();
    const uids = new Set();

    return parseCsv(csvText).map((row, i) => {
        const iebcCode = Number(row.iebc_code);
        const arcUid = (row.arc_uid ?? '').trim();
        const mode = (row.mode ?? 'fill').trim();
        const reason = (row.reason ?? '').trim();
        if (!Number.isInteger(iebcCode) || iebcCode < 1 || arcUid === '') {
            throw new Error(`Invalid ward patch on data row ${i + 1}: ${JSON.stringify(row)}`);
        }
        if (!PATCH_MODES.includes(mode)) throw new Error(`Invalid mode "${mode}" for ward patch ${iebcCode} (data row ${i + 1}): expected fill or replace`);
        if ('mode' in row && reason === '') throw new Error(`Ward patch ${iebcCode} (data row ${i + 1}) has no reason`);
        if (codes.has(iebcCode)) throw new Error(`Duplicate iebc_code ${iebcCode} in ward patches (data row ${i + 1})`);
        if (uids.has(arcUid)) throw new Error(`Duplicate arc_uid ${arcUid} in ward patches (data row ${i + 1})`);
        codes.add(iebcCode);
        uids.add(arcUid);
        return { iebcCode, arcUid, mode, reason };
    });
}

/** Run mapshaper in memory, returning its output files and every status message it printed. */
export async function runMapshaper(commands, input) {
    const { internal } = mapshaper;
    const restore = internal.getLoggingSetter();
    const messages = [];
    const capture = (...args) => messages.push(internal.formatLogArgs(args));
    internal.setLoggingFunctions(
        capture,
        (...args) => {
            throw new Error(internal.formatLogArgs(args));
        },
        (...args) => {
            throw new Error(internal.formatLogArgs(args));
        },
        capture,
    );
    try {
        const output = await mapshaper.applyCommands(commands, input);
        return { output, messages };
    } finally {
        restore();
    }
}

function collectIebc(iebc, replaced, log) {
    const kept = [];
    const sources = new Map();
    const pieces = new Map();
    const removed = new Map();

    for (const feature of iebc.features) {
        const props = feature.properties ?? {};
        const code = Number(props.COUNTY_ASS);
        const name = props.COUNTY_A_1 ?? null;

        if (!Number.isInteger(code) || code <= 0) {
            log.push({ step: 'dropped', detail: { code: props.COUNTY_ASS ?? null, name, reason: 'no valid ward code' } });
        } else if (!hasGeometry(feature.geometry)) {
            log.push({ step: 'dropped', detail: { code, name, reason: 'empty geometry' } });
        } else if (replaced.has(code)) {
            // The polygon filed under this code is someone else's; its attributes describe it, not the ward.
            const entry = removed.get(code) ?? { sourceName: name, pieces: 0 };
            entry.pieces++;
            removed.set(code, entry);
        } else {
            kept.push({ type: 'Feature', properties: { code }, geometry: feature.geometry });
            pieces.set(code, (pieces.get(code) ?? 0) + 1);
            if (!sources.has(code)) {
                sources.set(code, { name, constituencyCode: props.CONST_CODE, countyCode: props.COUNTY_COD });
            }
        }
    }

    for (const [code, count] of pieces) {
        if (count > 1) log.push({ step: 'merged', detail: { code, pieces: count } });
    }

    return { kept, sources, removed };
}

function collectPatches(arc, patches, iebcCodes, removed, log) {
    const features = [];

    for (const { iebcCode, arcUid, mode = 'fill', reason = '' } of patches) {
        if (mode === 'fill' && iebcCodes.has(iebcCode)) {
            throw new Error(`Ward patch ${iebcCode} (arc uid ${arcUid}): code already present in IEBC data`);
        }
        if (mode === 'replace' && !removed.has(iebcCode)) {
            throw new Error(`Ward patch ${iebcCode} (arc uid ${arcUid}): mode=replace but the code is not in the IEBC data`);
        }
        const matches = arc.features.filter((f) => f.properties?.uid === arcUid && hasGeometry(f.geometry));
        if (matches.length === 0) {
            throw new Error(`Ward patch ${iebcCode}: arc uid ${arcUid} not found (or has no geometry)`);
        }
        for (const match of matches) {
            features.push({ type: 'Feature', properties: { code: iebcCode }, geometry: match.geometry });
        }
        if (mode === 'replace') {
            log.push({ step: 'replaced', detail: { code: iebcCode, arcUid, reason, ...removed.get(iebcCode) } });
        } else {
            log.push({ step: 'patched', detail: { code: iebcCode, arcUid } });
        }
    }

    return features;
}

const collection = (features) => ({ type: 'FeatureCollection', features });

function joinGazette(assembled, gazette, sources, log) {
    const features = assembled.features
        .map((feature) => {
            const code = feature.properties.code;
            const ward = gazette.wards.get(code);
            if (!ward) throw new Error(`Ward code ${code} is not in the gazette`);

            const source = sources.get(code);
            if (source) {
                const changes = [];
                if (source.name != null && norm(source.name) !== norm(ward.name)) {
                    changes.push({ field: 'name', source: source.name, gazette: ward.name });
                }
                if (source.constituencyCode != null && Number(source.constituencyCode) !== ward.constituencyCode) {
                    changes.push({ field: 'constituency_code', source: source.constituencyCode, gazette: ward.constituencyCode });
                }
                if (source.countyCode != null && Number(source.countyCode) !== ward.countyCode) {
                    changes.push({ field: 'county_code', source: source.countyCode, gazette: ward.countyCode });
                }
                if (changes.length > 0) log.push({ step: 'attribute-corrected', detail: { code, changes } });
            }

            return {
                type: 'Feature',
                properties: {
                    code,
                    name: ward.name,
                    constituency_code: ward.constituencyCode,
                    county_code: ward.countyCode,
                },
                geometry: feature.geometry,
            };
        })
        .sort((a, b) => a.properties.code - b.properties.code);

    return collection(features);
}

export async function assembleWards({ iebc, arc, patches, gazette, expected = 1450 }) {
    const log = [];

    const replaced = new Set(patches.filter((p) => p.mode === 'replace').map((p) => p.iebcCode));
    const { kept, sources, removed } = collectIebc(iebc, replaced, log);
    const patchFeatures = collectPatches(arc, patches, new Set(sources.keys()), removed, log);

    // Dissolve merges pieces sharing a code. A replaced code's IEBC polygon was left
    // out above. Patch polygons (fills and replacements alike) are erased from the
    // IEBC layer first so they win where the two sources overlap; -clean then snaps
    // edges and fills the slivers left between neighbours, including what is left of
    // a replaced polygon that its Red Cross successor does not cover.
    const input = { 'iebc.json': collection(kept) };
    let commands = '-i iebc.json -dissolve code';
    if (patchFeatures.length > 0) {
        input['patch.json'] = collection(patchFeatures);
        commands =
            '-i iebc.json patch.json combine-files -target iebc -dissolve code ' +
            '-target patch -dissolve code -target iebc -erase source=patch ' +
            '-merge-layers target=iebc,patch name=wards';
    } else {
        commands += ' -rename-layers wards';
    }
    commands += ` -clean gap-fill-area=${GAP_FILL_AREA} -o out.json target=wards format=geojson`;

    const { output, messages } = await runMapshaper(commands, input);
    log.push({ step: 'cleaned', detail: { gapFillArea: GAP_FILL_AREA, messages } });

    const assembled = JSON.parse(output['out.json'].toString());
    const wards = joinGazette(assembled, gazette, sources, log);

    const result = validateCodes(wards.features, { key: 'code', expected });
    if (!result.ok) {
        const error = new Error(`Ward codes failed validation: ${JSON.stringify(result)}`);
        error.validation = result;
        throw error;
    }

    return { wards, log };
}
