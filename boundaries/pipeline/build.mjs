// Builds public/boundaries/* and boundaries/build-report.md from the raw sources.
// Run with `npm run boundaries:build`. Exits non-zero if any validation fails.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as turf from '@turf/turf';
import { WARD_SIMPLIFY, buildUnitsIndex, deriveLayers, labelPoints, simplifyWards } from './derive.mjs';
import { loadGazette, loadProvinces } from './gazette.mjs';
import { writeOutputs } from './outputs.mjs';
import { renderReport } from './report.mjs';
import { validateCodes } from './validate.mjs';
import { assembleWards, parsePatches, runMapshaper } from './wards.mjs';

const root = resolve(import.meta.dirname, '../..');
const path = (...parts) => resolve(root, ...parts);
const text = (...parts) => readFileSync(path(...parts), 'utf8');

// The build fails if simplification changes any ward's area by more than this; the aim is 20%.
const MAX_AREA_CHANGE = 0.35;
const REPORTED_AREA_CHANGES = 15;
const RUIRU = [571, 572, 573, 574, 575, 576];
const BUDGET_KB = { 'counties.geojson': 120, 'constituencies.geojson': 180, 'wards.geojson': 300, 'units.json': 60 };
const EXPECTED = { provinces: 8, counties: 47, constituencies: 290, wards: 1450 };

const sqKm = (feature) => turf.area(feature) / 1e6;

/** The Red Cross wards named by the patch list, read straight from the shapefile. */
async function loadArcWards(patches) {
    const shapefile = path('boundaries/raw/hdx_arc_wards/kenya_wards/Kenya_Wards/kenya_wards.shp');
    const { output } = await runMapshaper(`-i ${shapefile} -o out.json format=geojson`, {});
    const all = JSON.parse(output['out.json'].toString());
    const wanted = new Set(patches.map((p) => p.arcUid));
    return { type: 'FeatureCollection', features: all.features.filter((f) => wanted.has(f.properties?.uid)) };
}

/** How well a ward layer tiles: area summed vs area of the union gives overlap; interior rings of the union are gaps. */
async function coverage(wards) {
    const { output } = await runMapshaper('-i wards.json -dissolve -o union.json format=geojson', { 'wards.json': wards });
    const union = JSON.parse(output['union.json'].toString());
    const geometry = union.geometries?.[0] ?? union.features?.[0]?.geometry ?? union;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

    const sumKm2 = wards.features.reduce((sum, f) => sum + sqKm(f), 0);
    const unionKm2 = sqKm({ type: 'Feature', properties: {}, geometry });
    const holes = polygons.flatMap((rings) => rings.slice(1));
    const holeKm2 = holes.reduce((sum, ring) => sum + sqKm(turf.polygon([ring])), 0);
    return { sumKm2, unionKm2, overlapKm2: Math.max(0, sumKm2 - unionKm2), holes: holes.length, holeKm2 };
}

function checkRuiru(wards) {
    const find = (code) => {
        const ward = wards.features.find((f) => f.properties.code === code);
        if (!ward) throw new Error(`Ward ${code} is missing from the assembled wards`);
        return ward;
    };
    const rows = RUIRU.map((code) => ({ code, name: find(code).properties.name, areaKm2: sqKm(find(code)) }));
    const overlaps = [];
    let pairs = 0;
    for (let i = 0; i < RUIRU.length; i++) {
        for (let j = i + 1; j < RUIRU.length; j++) {
            pairs++;
            const shared = turf.intersect(turf.featureCollection([find(RUIRU[i]), find(RUIRU[j])]));
            if (shared && turf.area(shared) > 0) overlaps.push({ a: RUIRU[i], b: RUIRU[j], areaM2: turf.area(shared) });
        }
    }
    return { rows, overlaps, pairs };
}

/** Each ward's area after simplification against its full-detail area, largest change first. */
function areaChanges(full, simplified) {
    return simplified.features
        .map((f) => {
            const before = full.get(f.properties.code);
            const after = sqKm(f);
            return { code: f.properties.code, name: f.properties.name, beforeKm2: before, afterKm2: after, change: after / before - 1 };
        })
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function fail(problems) {
    console.error('Boundary build failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}

async function main() {
    const problems = [];
    const gazette = loadGazette(text('data/reference/iebc_wards_2027_gn13771.csv'));
    const provinces = loadProvinces(text('boundaries/overrides/provinces.csv'));
    const patches = parsePatches(text('boundaries/overrides/ward_patches.csv'));
    const iebc = JSON.parse(text('boundaries/raw/mikelmaron/data/wards.geojson'));
    const arc = await loadArcWards(patches);

    console.log('Assembling wards...');
    const { wards: assembled, log } = await assembleWards({ iebc, arc, patches, gazette, expected: EXPECTED.wards });
    const assembledCoverage = await coverage(assembled);
    const patchChecks = checkRuiru(assembled);
    if (patchChecks.overlaps.length > 0) problems.push('The Ruiru wards overlap each other');
    if (patchChecks.rows.some((r) => !(r.areaKm2 > 0))) problems.push('A Ruiru ward has no area');

    const fullAreas = new Map(assembled.features.map((f) => [f.properties.code, sqKm(f)]));
    mkdirSync(path('boundaries/build'), { recursive: true });
    writeFileSync(
        path('boundaries/build/ward-areas.json'),
        JSON.stringify(Object.fromEntries([...fullAreas].map(([code, km2]) => [code, Math.round(km2 * 1e6) / 1e6]))) + '\n',
    );

    console.log('Simplifying wards and deriving layers...');
    const wards = await simplifyWards(assembled);
    const changes = areaChanges(fullAreas, wards);
    const tooFar = changes.filter((c) => Math.abs(c.change) > MAX_AREA_CHANGE);
    if (tooFar.length > 0) problems.push(`${tooFar.length} wards changed area by more than ${MAX_AREA_CHANGE * 100}% when simplified: ${tooFar.map((c) => c.code).join(', ')}`);
    const simplifiedCoverage = await coverage(wards);
    const { constituencies, counties, provinces: provinceLayer } = await deriveLayers(wards, gazette, provinces);
    const layers = { provinces: provinceLayer, counties, constituencies, wards };

    for (const [name, expected] of Object.entries(EXPECTED)) {
        const result = validateCodes(layers[name].features, { key: 'code', expected });
        if (!result.ok) problems.push(`${name} failed code validation: ${JSON.stringify(result)}`);
    }

    console.log('Placing labels and writing outputs...');
    const labels = await labelPoints(layers);
    const units = buildUnitsIndex(layers);
    const dir = path('public/boundaries');
    const { manifest, sizes } = writeOutputs(dir, {
        'provinces.geojson': layers.provinces,
        'counties.geojson': layers.counties,
        'constituencies.geojson': layers.constituencies,
        'wards.geojson': layers.wards,
        'labels.geojson': labels,
        'units.json': units,
    });

    const files = Object.keys(manifest).map((name) => {
        const bytes = sizes[name];
        const gzipBytes = gzipSync(readFileSync(resolve(dir, name))).length;
        const budgetKb = BUDGET_KB[name];
        if (budgetKb && gzipBytes / 1024 > budgetKb) problems.push(`${name} is ${(gzipBytes / 1024).toFixed(1)} KB gzipped, over the ${budgetKb} KB budget`);
        return { name, bytes, gzipBytes, budgetKb };
    });

    const counts = Object.fromEntries(Object.entries(layers).map(([name, fc]) => [name, fc.features.length]));
    const wardNames = new Map([...gazette.wards.values()].map((w) => [w.code, w.name]));
    writeFileSync(
        path('boundaries/build-report.md'),
        renderReport(log, {
            counts,
            wardNames,
            simplify: WARD_SIMPLIFY,
            areaChanges: { rows: changes.slice(0, REPORTED_AREA_CHANGES), over20: changes.filter((c) => Math.abs(c.change) > 0.2).length, limit: MAX_AREA_CHANGE },
            coverage: { assembled: assembledCoverage, simplified: simplifiedCoverage },
            patchChecks,
            files,
        }),
    );

    console.log(`Built ${counts.provinces} provinces / ${counts.counties} counties / ${counts.constituencies} constituencies / ${counts.wards} wards`);
    for (const f of files) console.log(`  ${f.name.padEnd(24)} ${(f.bytes / 1024).toFixed(1).padStart(8)} KB raw ${(f.gzipBytes / 1024).toFixed(1).padStart(8)} KB gzip`);

    if (problems.length > 0) fail(problems);
}

main().catch((error) => fail([error.stack ?? String(error)]));
