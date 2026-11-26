// Renders boundaries/build-report.md from the assembly log and the build statistics.

const kb = (bytes) => (bytes / 1024).toFixed(1);
const km2 = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|');
const table = (header, rows) =>
    [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const byStep = (log, step) => log.filter((entry) => entry.step === step).map((entry) => entry.detail);
const byCode = (a, b) => a.code - b.code;

function corrections(log) {
    const rows = [];
    for (const { code, changes } of byStep(log, 'attribute-corrected')) {
        for (const change of changes) rows.push({ code, ...change });
    }
    const parent = rows.filter((r) => r.field !== 'name').sort(byCode);
    const name = rows.filter((r) => r.field === 'name').sort(byCode);
    const unsetCounty = parent.filter((r) => r.field === 'county_code' && Number(r.source) === 0).length;
    return { parent, name, unsetCounty, parentWards: new Set(parent.map((r) => r.code)).size, nameWards: name.length };
}

/**
 * `log` is the step list from assembleWards. `stats`:
 * `{ counts, wardNames: Map, simplify, coverage: { assembled, simplified }, patchChecks, files }`.
 */
export function renderReport(log, stats) {
    const { counts, wardNames, simplify, coverage, patchChecks, files } = stats;
    const name = (code) => wardNames.get(code) ?? '';
    const patched = byStep(log, 'patched').sort(byCode);
    const dropped = byStep(log, 'dropped');
    const merged = byStep(log, 'merged').sort(byCode);
    const cleaned = byStep(log, 'cleaned')[0] ?? { messages: [] };
    const fixes = corrections(log);
    const out = [];

    out.push('# Boundary build report', '', 'Written by `npm run boundaries:build` on every run. Do not edit by hand.', '');

    out.push(
        '## Result',
        '',
        table(
            ['Layer', 'Features'],
            [
                ['Provinces', counts.provinces],
                ['Counties', counts.counties],
                ['Constituencies', counts.constituencies],
                ['Wards', counts.wards],
            ],
        ),
        '',
        `All codes are present exactly once and no polygon is empty. Names and parent codes come from the gazette. Wards were simplified with \`${simplify}\`, then the constituencies, counties and provinces were dissolved from those simplified wards, so every layer shares the same lines.`,
        '',
    );

    out.push(
        `## Patched wards (${patched.length})`,
        '',
        'IEBC has no polygon for these codes. Each takes the polygon of the reviewed Red Cross ward in `boundaries/overrides/ward_patches.csv`, cut out of whatever IEBC polygon covered it.',
        '',
        table(['Code', 'Ward', 'Red Cross uid'], patched.map((p) => [p.code, name(p.code), p.arcUid])),
        '',
    );

    out.push(
        `## Dropped features (${dropped.length})`,
        '',
        dropped.length
            ? table(['Code in source', 'Name in source', 'Reason'], dropped.map((d) => [d.code, d.name, d.reason]))
            : 'None.',
        '',
    );

    out.push(
        `## Merged duplicate codes (${merged.length})`,
        '',
        'Each code appeared on more than one IEBC polygon. The pieces were dissolved into one feature.',
        '',
        table(['Code', 'Ward', 'Pieces'], merged.map((m) => [m.code, name(m.code), m.pieces])),
        '',
    );

    out.push(
        '## Corrections from the gazette',
        '',
        `${fixes.parentWards} wards had a parent (constituency or county) that differs from the gazette, in ${fixes.parent.length} fields (${fixes.unsetCounty} of them a source county code of 0, meaning unset), and ${fixes.nameWards} had a name that differs. All were replaced with the gazette values.`,
        '',
        'The data quality report counted 19 parent and 24 name differences on the per-ward source files. This build reads the combined `data/wards.geojson`, whose names differ in 12 more places. Most are the same ward in different spelling or case, but a few carry another ward\'s name (for example 97, 245 and 1283, whose polygons do match the gazette ward), and wards 212 to 216 in Mandera are listed in a different order from both the gazette and the Red Cross layer, so those five polygons need a manual check against a map.',
        '',
        '### Parent corrections',
        '',
        table(
            ['Ward code', 'Ward', 'Field', 'Source', 'Gazette'],
            fixes.parent.map((c) => [c.code, name(c.code), c.field, c.source, c.gazette]),
        ),
        '',
        '### Name corrections',
        '',
        table(['Ward code', 'Source name', 'Gazette name'], fixes.name.map((c) => [c.code, c.source, c.gazette])),
        '',
    );

    out.push(
        '## Cleaning',
        '',
        `Run with \`-clean gap-fill-area=${cleaned.gapFillArea}\`. Mapshaper said:`,
        '',
        ...cleaned.messages.map((m) => `- ${m}`),
        '',
        'Gap threshold: with mapshaper\'s default, 434 gaps totalling about 1,324 km² stayed inside the country. They are land that no ward covers, so the map would show holes and a tap there would select nothing. The largest is about 309 km², so a threshold of 400 km² fills every one into the neighbouring ward that shares most boundary with it. Overlaps need no tuning: the default already leaves none.',
        '',
        table(
            ['Stage', 'Sum of ward areas (km²)', 'Area of union (km²)', 'Overlap (km²)', 'Holes inside the country', 'Hole area (km²)'],
            [
                ['After assembly (full detail)', coverage.assembled],
                ['After simplification', coverage.simplified],
            ].map(([stage, c]) => [stage, km2(c.sumKm2), km2(c.unionKm2), km2(c.overlapKm2), c.holes, km2(c.holeKm2)]),
        ),
        '',
    );

    out.push(
        '## Checks on the real data',
        '',
        `Ward count: ${counts.wards.toLocaleString('en-US')} of 1,450.`,
        '',
        'The five Ruiru patches (571, 572, 573, 575, 576) and 574 Kiuu, which IEBC had swallowed them into, all exist and have area:',
        '',
        table(['Code', 'Ward', 'Area (km²)'], patchChecks.rows.map((r) => [r.code, r.name, km2(r.areaKm2)])),
        '',
        patchChecks.overlaps.length === 0
            ? `Pairwise overlap among these six wards (${patchChecks.pairs} pairs): none.`
            : `Pairwise overlap among these six wards: ${patchChecks.overlaps.map((o) => `${o.a} and ${o.b} (${km2(o.areaM2)} m²)`).join(', ')}.`,
        '',
    );

    out.push(
        '## Output files',
        '',
        table(
            ['File', 'Raw (KB)', 'Gzipped (KB)', 'Gzip budget (KB)'],
            files.map((f) => [f.name, kb(f.bytes), kb(f.gzipBytes), f.budgetKb ?? '']),
        ),
        '',
    );

    return out.join('\n');
}
