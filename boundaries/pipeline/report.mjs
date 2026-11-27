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
 * `{ counts, wardNames: Map, simplify, areaChanges, coverage: { assembled, simplified }, patchChecks, files, evidence }`.
 * `evidence` (Task 4b, optional): `{ replacements, uncertain, refs, stations, uncertainRule, rejectedRefs }` from build.mjs.
 */
export function renderReport(log, stats) {
    const { counts, wardNames, simplify, areaChanges, coverage, patchChecks, files, evidence } = stats;
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
        `All codes are present exactly once and no polygon is empty. Names and parent codes come from the gazette. Wards were simplified with \`-simplify ${simplify}\` (small wards keep more detail than large ones, see below), then the constituencies, counties and provinces were dissolved from those simplified wards, so every layer shares the same lines.`,
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

    if (evidence) out.push(...replacedSection(evidence, name));

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
        'The data quality report counted 19 parent and 24 name differences on the per-ward source files. This build reads the combined `data/wards.geojson`, whose names differ in more places. Most are the same ward in different spelling or case, but a few carry another ward\'s name (for example 97, 245 and 1283, whose polygons do match the gazette ward). Replaced wards (above) are left out of these tables: their IEBC polygon and its attributes describe another ward, and the "Replaced wards" table gives the name each removed polygon carried.',
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
        '## Simplification: largest area changes per ward',
        '',
        `Each ward's area after simplification against its full-detail area (after cleaning and patching). ${areaChanges.over20} wards change by more than 20%; the build fails if any ward changes by more than ${areaChanges.limit * 100}%. The ${areaChanges.rows.length} largest changes:`,
        '',
        table(
            ['Code', 'Ward', 'Full detail (km²)', 'Simplified (km²)', 'Change'],
            areaChanges.rows.map((r) => [r.code, r.name, km2(r.beforeKm2), km2(r.afterKm2), `${r.change >= 0 ? '+' : ''}${(r.change * 100).toFixed(1)}%`]),
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

    if (evidence) {
        const refs = evidence.refs;
        out.push(
            `Reference points: ${refs.length} in \`boundaries/overrides/reference_points.csv\`, ${refs.filter((r) => r.oursCode === r.expectedCode).length} of them inside their expected ward at full detail; the build also fails if any falls outside it after simplification.`,
            '',
        );
    }

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

const pct = (v) => (v === null || v === undefined ? '' : `${Math.round(v * 100)}%`);

function replacedSection(evidence, name) {
    const { replacements, uncertain, stations, uncertainRule, rejectedRefs = [] } = evidence;
    const c = stations.counts;
    const out = [];
    out.push(
        `## Replaced wards (${replacements.length})`,
        '',
        'IEBC has a polygon for these codes, but filed under the wrong code or drawn in the wrong place. Each takes its Red Cross polygon (`mode=replace` in `boundaries/overrides/ward_patches.csv`), cut out of its neighbours like a patch. The removed IEBC polygon is re-filed under the patch that covers most of it, and only what no Red Cross ward covers (lake, sea or a border strip) is kept, so coasts, lake shores and borders keep their IEBC line. A Red Cross polygon that reaches past that line still adds its bulge (Faza and Moyale towns are outside every IEBC polygon).',
        '',
        'A row is allowed only when two independent signals agree (the build fails otherwise):',
        '',
        '- **Stations:** at least 5 of the ward\'s IEBC 2013 polling stations, at most 30% of them inside the IEBC polygon and at least 70% inside the Red Cross one.',
        '- **Reference point:** a cited point from `boundaries/overrides/reference_points.csv` lies in the wrong code in the IEBC build and inside the Red Cross ward.',
        '- **With its group:** a member of a cluster (a code shift or swap) with no signal of its own, allowed only when its old polygon went to a supported replacement or a supported replacement\'s old polygon went to it.',
        '',
        'Station shares are of the stations matched to the ward. "IEBC" is the build with fills only, "built" this build at full detail. "Old polygon to" is where the removed IEBC polygon was re-filed. Every row\'s full reason is in `ward_patches.csv`; per-ward numbers for all 1,450 wards are in `boundaries/build/ward-evidence.csv`.',
        '',
        table(
            ['Code', 'Ward', 'Red Cross uid', 'IEBC polygon was', 'Signals', 'Stations', 'Inside IEBC', 'Inside Red Cross', 'Inside built', 'Old polygon to'],
            replacements
                .sort((a, b) => a.code - b.code)
                .map((r) => [r.code, name(r.code), r.arcUid, r.sourceName ?? '', r.signals.join(', '), r.stations, pct(r.insideOurs), pct(r.insideRedCross), pct(r.insideBuilt), (r.refiledTo ?? []).join(', ')]),
        ),
        '',
        '### Polling-station matching',
        '',
        `${c.total.toLocaleString('en-US')} stations in \`output/pollingstations.shp\`. ${c.outside.toLocaleString('en-US')} are outside Kenya's bounding box (mostly at 0, 0) and dropped. ${c.assigned.toLocaleString('en-US')} are matched to a gazette ward by exact normalised ward name inside their own constituency (2013 constituency names through an explicit alias table: Mbita is Suba North, Suba is Suba South); there is no fallback across constituencies. Unmatched: ${c.noCounty} by county, ${c.noConstituency} by constituency, ${c.noWard} by ward name:`,
        '',
        stations.unmatched.length
            ? table(['County', 'Constituency', 'Ward (2013 name)', 'Stations'], stations.unmatched.map((u) => [u.county, u.constituency, u.ward, u.stations]))
            : 'None. (The 2013 names with no 2026 ward in their constituency, Mandera East\'s "Bulla Mpya" and Lafey\'s "Libehia", only have stations at 0, 0.)',
        '',
        'A matched station counts for its ward only if its GPS falls inside the ward\'s own county; many 2013 coordinates belong to another county (Mandera East\'s Township, for one, lists 98 stations, scattered across the country or at 0, 0).',
        '',
        `### Still uncertain (${uncertain.length})`,
        '',
        `Wards whose signals disagree with this build and that were not replaced: at least ${uncertainRule.minStations} stations with fewer than ${uncertainRule.maxInside * 100}% of them inside the built polygon, a reference point outside its ward, or a ward that meets the rule but was left alone. Most are dense urban wards (Nairobi, Mombasa, Nakuru, Kisumu), where both layers agree poorly with the rough 2013 GPS.`,
        '',
        table(
            ['Code', 'Ward', 'Stations', 'Inside IEBC', 'Inside Red Cross', 'Inside built', 'Built polygon holding most', 'Why'],
            uncertain.map((u) => [u.code, name(u.code), u.stations, pct(u.insideOurs), pct(u.insideRedCross), pct(u.insideBuilt), u.mostlyInBuilt ?? '', u.notes.join('; ')]),
        ),
        '',
    );
    if (rejectedRefs.length > 0) {
        out.push(
            `Reference-point candidates not used (${rejectedRefs.length}, from \`boundaries/build/reference-candidates.csv\`, written by \`boundaries/scripts/reference_points.mjs\`):`,
            '',
            table(['Place', 'Expected ward', 'OSM', 'Why not'], rejectedRefs.map((r) => [r.place, `${r.expected_code} ${name(Number(r.expected_code))}`, r.osm, r.reason])),
            '',
        );
    }
    return out;
}
