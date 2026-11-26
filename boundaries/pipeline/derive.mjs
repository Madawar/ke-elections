// Derives the upper layers from the wards. Wards are simplified once, then
// constituencies, counties and provinces are dissolved from those simplified
// wards, so every layer shares exactly the same lines and nests perfectly.

import { runMapshaper } from './wards.mjs';

const collection = (features) => ({ type: 'FeatureCollection', features });
const byCode = (a, b) => a.properties.code - b.properties.code;

/** Simplify the ward layer. `keep-shapes` stops small wards from collapsing. */
export async function simplifyWards(wards, percentage = '2%') {
    const { output } = await runMapshaper(`-i wards.json -simplify ${percentage} keep-shapes -o out.json format=geojson`, {
        'wards.json': wards,
    });
    const simplified = JSON.parse(output['out.json'].toString());
    return collection(simplified.features.sort(byCode));
}

/** Dissolve wards on one property, returning one feature per value as `{ code }`. */
async function dissolveBy(features, field) {
    const input = collection(features.map(({ properties, geometry }) => ({ type: 'Feature', properties: { [field]: properties[field] }, geometry })));
    const { output } = await runMapshaper(`-i in.json -dissolve ${field} -o out.json format=geojson`, { 'in.json': input });
    const dissolved = JSON.parse(output['out.json'].toString());
    return new Map(dissolved.features.map((f) => [f.properties[field], f.geometry]));
}

/** Build one layer: a feature per entry, named and parented from the gazette, sorted by code. */
function layer(geometries, entries, propertiesOf) {
    return collection(
        entries
            .map(([code, info]) => {
                const geometry = geometries.get(code);
                if (!geometry) throw new Error(`No wards found for code ${code} while deriving a layer`);
                return { type: 'Feature', properties: { code, ...propertiesOf(code, info) }, geometry };
            })
            .sort(byCode),
    );
}

/**
 * Derive `{ constituencies, counties, provinces }` from the (already simplified)
 * wards. `gazette` is the result of `loadGazette`, `provinces` of `loadProvinces`.
 */
export async function deriveLayers(wards, gazette, provinces) {
    const withProvince = wards.features.map((f) => ({
        ...f,
        properties: { ...f.properties, province_code: provinces.get(f.properties.county_code)?.code },
    }));
    if (withProvince.some((f) => f.properties.province_code == null)) {
        throw new Error('A ward belongs to a county with no province in provinces.csv');
    }

    const [constituencyGeometry, countyGeometry, provinceGeometry] = await Promise.all([
        dissolveBy(withProvince, 'constituency_code'),
        dissolveBy(withProvince, 'county_code'),
        dissolveBy(withProvince, 'province_code'),
    ]);

    const provinceNames = new Map([...provinces.values()].map((p) => [p.code, p.name]));

    return {
        constituencies: layer(constituencyGeometry, [...gazette.constituencies], (code, c) => ({
            name: c.name,
            county_code: c.countyCode,
        })),
        counties: layer(countyGeometry, [...gazette.counties], (code, c) => ({
            name: c.name,
            province_code: provinces.get(code).code,
        })),
        provinces: layer(provinceGeometry, [...provinceNames], (code, name) => ({ name })),
    };
}

/** The `[west, south, east, north]` box of a feature, rounded outward to 4 decimal places. */
function bbox(geometry) {
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    const visit = (c) => {
        if (typeof c[0] === 'number') {
            w = Math.min(w, c[0]);
            e = Math.max(e, c[0]);
            s = Math.min(s, c[1]);
            n = Math.max(n, c[1]);
        } else {
            c.forEach(visit);
        }
    };
    visit(geometry.coordinates);
    const down = (x) => Math.floor(x * 1e4 + 1e-6) / 1e4;
    const up = (x) => Math.ceil(x * 1e4 - 1e-6) / 1e4;
    return [down(w), down(s), up(e), up(n)];
}

/**
 * The searchable index of every unit: `{ l: level, c: code, n: name, p: parent code, b: bounds }`.
 * The parent is the province for a county, the county for a constituency, the
 * constituency for a ward, and null for a province.
 */
export function buildUnitsIndex({ provinces, counties, constituencies, wards }) {
    const levels = [
        ['province', provinces, () => null],
        ['county', counties, (p) => p.province_code],
        ['constituency', constituencies, (p) => p.county_code],
        ['ward', wards, (p) => p.constituency_code],
    ];
    return levels.flatMap(([l, fc, parentOf]) =>
        [...fc.features].sort(byCode).map((f) => ({
            l,
            c: f.properties.code,
            n: f.properties.name,
            p: parentOf(f.properties),
            b: bbox(f.geometry),
        })),
    );
}

export const LEVEL_RANK = { province: 0, county: 1, constituency: 2, ward: 3 };

/**
 * One label point per unit at every level, placed at the polygon's inner point
 * (`-points inner`): `{ level, code, name, rank }`, where rank 0 (province) to 3
 * (ward) lets the map order labels so bigger units win collisions.
 */
export async function labelPoints({ provinces, counties, constituencies, wards }) {
    const levels = { province: provinces, county: counties, constituency: constituencies, ward: wards };
    const features = [];

    for (const [level, fc] of Object.entries(levels)) {
        const { output } = await runMapshaper('-i in.json -points inner -o out.json format=geojson', { 'in.json': fc });
        const points = JSON.parse(output['out.json'].toString());
        for (const f of points.features) {
            if (f.geometry?.type !== 'Point') throw new Error(`No label point for ${level} ${f.properties.code}`);
            features.push({
                type: 'Feature',
                properties: { level, code: f.properties.code, name: f.properties.name, rank: LEVEL_RANK[level] },
                geometry: f.geometry,
            });
        }
    }

    return collection(features);
}
