// Builds public/boundaries/* and boundaries/build-report.md from the raw sources.
// Run with `npm run boundaries:build`. Exits non-zero if any validation fails, and then
// writes none of the outputs or the report (boundaries/build/ward-evidence.csv is still
// written, since it is what a failing replace row is reviewed against).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as turf from '@turf/turf';
import { WARD_SIMPLIFY, buildUnitsIndex, deriveLayers, labelPoints, simplifyWards } from './derive.mjs';
import { loadGazette, loadProvinces, parseCsv } from './gazette.mjs';
import { checkReferencePoints, matchStations, parseReferencePoints, replaceSignals, scoreWards, toCsv } from './evidence.mjs';
import { renderOutputs, writeOutputs } from './outputs.mjs';
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

/** Read a shapefile into GeoJSON. */
async function readShapefile(file) {
    const { output } = await runMapshaper(`-i ${path(file)} -o out.json format=geojson`, {});
    return JSON.parse(output['out.json'].toString());
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

// Stations at least this many, and less than half of them inside the built polygon: the ward
// stays on the "still uncertain" list unless it was replaced and the evidence agrees.
const UNCERTAIN = { minStations: 3, maxInside: 0.5 };
const EVIDENCE_COLUMNS = [
    'code', 'name', 'constituency_code', 'county_code', 'stations', 'inside_ours', 'inside_red_cross',
    'arc_uid', 'mostly_in', 'inside_built', 'reference_points', 'signals', 'mode',
];

function fail(problems) {
    console.error('Boundary build failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}

/**
 * Score the IEBC build (fills only) against the stations, the Red Cross layer and the reference
 * points, check every replace row against the rule, and score the final build again.
 */
function gatherEvidence({ baseline, final, log, stations, arcAll, gazette, points, patches, problems }) {
    const rows = scoreWards({ wards: baseline, stations, arc: arcAll, gazette });
    const refs = checkReferencePoints(points, { wards: baseline, arc: arcAll, rows });
    const builtRows = final === baseline ? rows : scoreWards({ wards: final, stations, arc: arcAll, gazette });
    const builtRefs = checkReferencePoints(points, { wards: final, arc: arcAll, rows });
    const row = new Map(rows.map((r) => [r.code, r]));
    const built = new Map(builtRows.map((r) => [r.code, r]));
    const patchFor = new Map(patches.map((p) => [p.iebcCode, p]));
    const signals = new Map(rows.map((r) => [r.code, replaceSignals(r, refs)]));
    // Where each replaced code's old IEBC polygon went (assembleWards re-files it under the patch
    // covering most of it): this is what ties a cluster such as Mandera East together.
    const refiledTo = new Map(log.filter((e) => e.step === 'replaced').map((e) => [e.detail.code, e.detail.refiledTo ?? []]));
    const linked = (a, b) => a !== b && ((refiledTo.get(a) ?? []).includes(b) || (refiledTo.get(b) ?? []).includes(a));

    const replaces = patches.filter((p) => p.mode === 'replace');
    const supported = new Set(replaces.filter((p) => signals.get(p.iebcCode).length > 0).map((p) => p.iebcCode));
    const replacements = replaces.map((p) => {
        const r = row.get(p.iebcCode);
        const own = signals.get(p.iebcCode);
        // A cluster member with no signal of its own is allowed only when its old polygon went to a
        // supported replacement, or a supported replacement's old polygon went to it.
        const group = own.length === 0 ? [...supported].filter((q) => linked(p.iebcCode, q)) : [];
        if (own.length === 0 && group.length === 0) problems.push(`Replace row ${p.iebcCode} has neither stations nor a reference point supporting it, and is not in a cluster with a supported replacement`);
        if (r.arcUid !== null && r.arcUid !== p.arcUid) problems.push(`Replace row ${p.iebcCode} uses Red Cross ${p.arcUid}, but the evidence matched ${r.arcUid}`);
        return {
            ...r,
            sourceName: log.find((e) => e.step === 'replaced' && e.detail.code === p.iebcCode)?.detail.sourceName,
            arcUid: p.arcUid,
            reason: p.reason,
            signals: own.length > 0 ? own : [`with its group (${group.join(', ')})`],
            refiledTo: refiledTo.get(p.iebcCode) ?? [],
            insideBuilt: built.get(p.iebcCode).insideOurs,
            refs: builtRefs.filter((x) => x.expectedCode === p.iebcCode),
        };
    });

    const uncertain = builtRows
        .map((b) => {
            const notes = [];
            if (b.stations >= UNCERTAIN.minStations && b.insideOurs !== null && b.insideOurs < UNCERTAIN.maxInside) {
                notes.push(`${Math.round(b.insideOurs * 100)}% of ${b.stations} stations inside the built polygon`);
            }
            for (const x of builtRefs.filter((x) => x.expectedCode === b.code && x.oursCode !== b.code)) {
                notes.push(`reference point ${x.place} falls in ${x.oursCode ?? 'no ward'}`);
            }
            if (signals.get(b.code).length > 0 && patchFor.get(b.code)?.mode !== 'replace') notes.push(`meets the replace rule (${signals.get(b.code).join(', ')}) but is not replaced`);
            return { ...row.get(b.code), insideBuilt: b.insideOurs, mostlyInBuilt: b.mostlyIn, notes };
        })
        .filter((u) => u.notes.length > 0);

    for (const x of builtRefs) {
        if (x.oursCode !== x.expectedCode) problems.push(`Reference point ${x.place} is in ward ${x.oursCode} in the build, not ${x.expectedCode}`);
    }

    const refText = (code) =>
        refs.filter((x) => x.expectedCode === code).map((x) => `${x.place}: ours ${x.oursCode ?? '-'}, Red Cross ${x.inRedCross ? 'yes' : 'no'}`).join('; ');
    const csvRows = rows.map((r) => {
        const w = gazette.wards.get(r.code);
        return {
            code: r.code,
            name: w.name,
            constituency_code: w.constituencyCode,
            county_code: w.countyCode,
            stations: r.stations,
            inside_ours: r.insideOurs,
            inside_red_cross: r.insideRedCross,
            arc_uid: r.arcUid,
            mostly_in: r.mostlyIn,
            inside_built: built.get(r.code).insideOurs,
            reference_points: refText(r.code),
            signals: signals.get(r.code).join('; '),
            mode: patchFor.get(r.code)?.mode ?? '',
        };
    });

    return { csv: toCsv(csvRows, EVIDENCE_COLUMNS), replacements, uncertain, refs: builtRefs };
}

async function main() {
    const problems = [];
    const gazette = loadGazette(text('data/reference/iebc_wards_2027_gn13771.csv'));
    const provinces = loadProvinces(text('boundaries/overrides/provinces.csv'));
    const patches = parsePatches(text('boundaries/overrides/ward_patches.csv'));
    const points = parseReferencePoints(text('boundaries/overrides/reference_points.csv'));
    const iebc = JSON.parse(text('boundaries/raw/mikelmaron/data/wards.geojson'));
    const arcAll = await readShapefile('boundaries/raw/hdx_arc_wards/kenya_wards/Kenya_Wards/kenya_wards.shp');
    const stations = await readShapefile('boundaries/raw/mikelmaron/output/pollingstations.shp');
    const fills = patches.filter((p) => p.mode === 'fill');

    console.log('Assembling wards (IEBC with fills only, for the evidence)...');
    const baseline = await assembleWards({ iebc, arc: arcAll, patches: fills, gazette, expected: EXPECTED.wards });
    let assembled = baseline.wards;
    let log = baseline.log;
    if (fills.length < patches.length) {
        console.log('Assembling wards with the replacements...');
        ({ wards: assembled, log } = await assembleWards({ iebc, arc: arcAll, patches, gazette, expected: EXPECTED.wards }));
    }

    console.log('Scoring wards against polling stations, the Red Cross layer and reference points...');
    const evidence = gatherEvidence({ baseline: baseline.wards, final: assembled, log, stations, arcAll, gazette, points, patches, problems });
    mkdirSync(path('boundaries/build'), { recursive: true });
    writeFileSync(path('boundaries/build/ward-evidence.csv'), evidence.csv);
    const stationMatch = matchStations(stations, gazette);

    const assembledCoverage = await coverage(assembled);
    const patchChecks = checkRuiru(assembled);
    if (patchChecks.overlaps.length > 0) problems.push('The Ruiru wards overlap each other');
    if (patchChecks.rows.some((r) => !(r.areaKm2 > 0))) problems.push('A Ruiru ward has no area');

    const fullAreas = new Map(assembled.features.map((f) => [f.properties.code, sqKm(f)]));

    console.log('Simplifying wards and deriving layers...');
    const wards = await simplifyWards(assembled);
    const changes = areaChanges(fullAreas, wards);
    const tooFar = changes.filter((c) => Math.abs(c.change) > MAX_AREA_CHANGE);
    if (tooFar.length > 0) problems.push(`${tooFar.length} wards changed area by more than ${MAX_AREA_CHANGE * 100}% when simplified: ${tooFar.map((c) => c.code).join(', ')}`);
    const simplifiedCoverage = await coverage(wards);
    // The reference points must hold in what ships, not only at full detail.
    for (const x of checkReferencePoints(points, { wards, arc: arcAll, rows: [] })) {
        if (x.oursCode !== x.expectedCode) problems.push(`Reference point ${x.place} is in ward ${x.oursCode} after simplification, not ${x.expectedCode}`);
    }
    const { constituencies, counties, provinces: provinceLayer } = await deriveLayers(wards, gazette, provinces);
    const layers = { provinces: provinceLayer, counties, constituencies, wards };

    for (const [name, expected] of Object.entries(EXPECTED)) {
        const result = validateCodes(layers[name].features, { key: 'code', expected });
        if (!result.ok) problems.push(`${name} failed code validation: ${JSON.stringify(result)}`);
    }

    console.log('Placing labels and rendering outputs...');
    const labels = await labelPoints(layers);
    const units = buildUnitsIndex(layers);
    const outputs = {
        'provinces.geojson': layers.provinces,
        'counties.geojson': layers.counties,
        'constituencies.geojson': layers.constituencies,
        'wards.geojson': layers.wards,
        'labels.geojson': labels,
        'units.json': units,
    };
    const rendered = renderOutputs(outputs);
    const files = Object.keys(rendered.manifest).map((name) => {
        const bytes = rendered.sizes[name];
        const gzipBytes = gzipSync(rendered.buffers[name]).length;
        const budgetKb = BUDGET_KB[name];
        if (budgetKb && gzipBytes / 1024 > budgetKb) problems.push(`${name} is ${(gzipBytes / 1024).toFixed(1)} KB gzipped, over the ${budgetKb} KB budget`);
        return { name, bytes, gzipBytes, budgetKb };
    });

    const counts = Object.fromEntries(Object.entries(layers).map(([name, fc]) => [name, fc.features.length]));
    console.log(`Built ${counts.provinces} provinces / ${counts.counties} counties / ${counts.constituencies} constituencies / ${counts.wards} wards`);
    for (const f of files) console.log(`  ${f.name.padEnd(24)} ${(f.bytes / 1024).toFixed(1).padStart(8)} KB raw ${(f.gzipBytes / 1024).toFixed(1).padStart(8)} KB gzip`);

    // Nothing below runs on a failed build, so the committed outputs and report stay as they were.
    if (problems.length > 0) fail(problems);

    writeOutputs(path('public/boundaries'), outputs);
    writeFileSync(
        path('boundaries/build/ward-areas.json'),
        JSON.stringify(Object.fromEntries([...fullAreas].map(([code, km2]) => [code, Math.round(km2 * 1e6) / 1e6]))) + '\n',
    );
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
            evidence: {
                ...evidence,
                stations: stationMatch,
                uncertainRule: UNCERTAIN,
                rejectedRefs: existsSync(path('boundaries/build/reference-candidates.csv')) ? parseCsv(text('boundaries/build/reference-candidates.csv')) : [],
            },
        }),
    );
    console.log(`Replaced ${evidence.replacements.length} wards; ${evidence.uncertain.length} still uncertain (see boundaries/build-report.md)`);
}

main().catch((error) => fail([error.stack ?? String(error)]));
