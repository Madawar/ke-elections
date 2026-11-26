import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOCUS_LAYERS, focusFilters, focusOutside } from '@/lib/map/focus';
import { OVERLAYS, overlaySourceId } from '@/lib/map/overlays';
import { buildStyle } from '@/lib/map/style';
import { THEMES } from '@/lib/map/theme';
import { type Unit, UnitIndex } from '@/lib/units';

const root = resolve(import.meta.dirname, '../../..');
const read = <T>(file: string): T =>
    JSON.parse(readFileSync(resolve(root, 'public/boundaries', file), 'utf8'));
type Fc = { features: { properties: Record<string, unknown> }[] };

const index = UnitIndex.fromRows(read<Unit[]>('units.json'));
const manifest = read<Record<string, string>>('manifest.json');
const data = {
    counties: read<Fc>('counties.geojson').features,
    constituencies: read<Fc>('constituencies.geojson').features,
    wards: read<Fc>('wards.geojson').features,
    labels: read<Fc>('labels.geojson').features,
    towns: read<Fc>('towns.geojson').features,
    stations: read<Fc>('stations.geojson').features,
};

const style = buildStyle({
    manifest,
    theme: THEMES.light,
    provinceOfCounty: new Map(),
});
const layers = [
    ...style.layers,
    ...OVERLAYS.flatMap((o) => o.layers(THEMES.light, overlaySourceId(o))),
];
const layerById = new Map(layers.map((l) => [l.id, l]));

/** Properties of the features a layer draws, by source. */
const featuresOf = (source: string) =>
    (data as Record<string, Fc['features']>)[source.replace('overlay-', '')];

/** The features of a layer's source that survive its base filter and the focus filter. */
function matching(layerId: string, focus: unknown) {
    const layer = layerById.get(layerId) as {
        source: string;
        filter?: unknown;
    };
    const base = layer.filter
        ? featureFilter(layer.filter as never, 'layers[0].filter')
        : null;
    const test = featureFilter(focus as never, 'layers[0].filter');
    return featuresOf(layer.source).filter((f) => {
        const feature = { type: 3, properties: f.properties } as never;
        const ctx = { zoom: 12 } as never;
        return (
            (!base || base.filter(ctx, feature)) && test.filter(ctx, feature)
        );
    });
}
const codes = (fs: { properties: Record<string, unknown> }[]) =>
    fs.map((f) => f.properties.code);

describe('focusFilters', () => {
    it('returns null for every layer when nothing is selected', () => {
        const filters = focusFilters(null, index);
        expect(Object.keys(filters).length).toBeGreaterThan(10);
        for (const filter of Object.values(filters)) expect(filter).toBeNull();
    });

    it('has one entry for every layer in the built style that can be filtered', () => {
        const filterable = layers
            .filter((l) => l.type !== 'background')
            .map((l) => l.id)
            .sort();
        expect(Object.keys(focusFilters(null, index)).sort()).toEqual(
            filterable,
        );
        expect([...FOCUS_LAYERS].sort()).toEqual(filterable);
    });

    it('keeps exactly Nairobi City, its 17 constituencies and 85 wards for county 47', () => {
        const f = focusFilters({ level: 'county', code: 47 }, index);
        expect(codes(matching('counties-fill', f['counties-fill']))).toEqual([
            47,
        ]);
        expect(
            matching('constituencies-fill', f['constituencies-fill']),
        ).toHaveLength(17);
        expect(matching('wards-fill', f['wards-fill'])).toHaveLength(85);
        expect(matching('wards-line', f['wards-line'])).toHaveLength(85);
        expect(
            matching('constituencies-line', f['constituencies-line']),
        ).toHaveLength(17);
        expect(codes(matching('land', f.land))).toEqual([47]);
    });

    it('keeps the labels, towns and stations of county 47 and nothing else', () => {
        const f = focusFilters({ level: 'county', code: 47 }, index);
        expect(codes(matching('labels-county', f['labels-county']))).toEqual([
            47,
        ]);
        expect(
            matching('labels-constituency', f['labels-constituency']),
        ).toHaveLength(17);
        expect(matching('labels-ward', f['labels-ward'])).toHaveLength(85);
        expect(matching('labels-province', f['labels-province'])).toHaveLength(
            0,
        );

        const towns = matching('towns-dot', f['towns-dot']);
        expect(towns.length).toBeGreaterThan(0);
        for (const t of towns) expect(t.properties.county_code).toBe(47);
        const stations = matching('stations-dot', f['stations-dot']);
        expect(stations.length).toBeGreaterThan(0);
        const nairobiWards = new Set(
            index
                .children('county', 47)
                .flatMap((c) => index.children('constituency', c.c))
                .map((w) => w.c),
        );
        for (const s of stations)
            expect(nairobiWards.has(s.properties.ward_code as number)).toBe(
                true,
            );
    });

    it('keeps a constituency and its wards, and hides counties and provinces', () => {
        const mathare = index
            .children('county', 47)
            .find((c) => c.n.startsWith('Mathare'))!;
        const f = focusFilters(
            { level: 'constituency', code: mathare.c },
            index,
        );
        expect(
            codes(matching('constituencies-fill', f['constituencies-fill'])),
        ).toEqual([mathare.c]);
        const wards = matching('wards-fill', f['wards-fill']);
        expect(wards).toHaveLength(
            index.children('constituency', mathare.c).length,
        );
        for (const w of wards)
            expect(w.properties.constituency_code).toBe(mathare.c);
        for (const id of [
            'counties-fill',
            'counties-line',
            'land',
            'counties-selected',
            'labels-county',
            'labels-province',
        ])
            expect(matching(id, f[id])).toHaveLength(0);
        for (const t of matching('towns', f.towns))
            expect(t.properties.constituency_code).toBe(mathare.c);
    });

    it('keeps one ward, its label, towns and stations for ward 1448', () => {
        const f = focusFilters({ level: 'ward', code: 1448 }, index);
        expect(codes(matching('wards-fill', f['wards-fill']))).toEqual([1448]);
        expect(codes(matching('wards-line', f['wards-line']))).toEqual([1448]);
        expect(codes(matching('wards-selected', f['wards-selected']))).toEqual([
            1448,
        ]);
        expect(codes(matching('labels-ward', f['labels-ward']))).toEqual([
            1448,
        ]);
        for (const id of [
            'constituencies-fill',
            'counties-fill',
            'labels-constituency',
            'labels-county',
        ])
            expect(matching(id, f[id])).toHaveLength(0);
        for (const t of matching('towns', f.towns))
            expect(t.properties.ward_code).toBe(1448);
        for (const s of matching('stations-label', f['stations-label']))
            expect(s.properties.ward_code).toBe(1448);
    });

    it('hides the province layers for any selection', () => {
        for (const sel of [
            { level: 'county', code: 47 },
            { level: 'constituency', code: 280 },
            { level: 'ward', code: 1448 },
        ] as const) {
            const f = focusFilters(sel, index);
            expect(f['labels-province']).toEqual(['==', ['get', 'code'], -1]);
        }
    });

    it('keeps the outside drawn, but not labelled, when surroundings are shown', () => {
        const f = focusFilters({ level: 'county', code: 47 }, index, {
            surroundings: true,
        });
        for (const id of [
            'land',
            'counties-fill',
            'wards-fill',
            'constituencies-line',
            'wards-selected',
        ])
            expect(f[id]).toBeNull();
        expect(codes(matching('labels-county', f['labels-county']))).toEqual([
            47,
        ]);
        expect(matching('labels-province', f['labels-province'])).toHaveLength(
            0,
        );
        for (const t of matching('towns', f.towns))
            expect(t.properties.county_code).toBe(47);
    });
});

describe('focusOutside', () => {
    const outsideCodes = (
        sel: Parameters<typeof focusOutside>[0],
        source: 'counties' | 'constituencies' | 'wards',
    ) => {
        const test = featureFilter(
            focusOutside(sel)[source] as never,
            'layers[0].filter',
        );
        return data[source]
            .filter((f) =>
                test.filter(
                    { zoom: 5 } as never,
                    { type: 3, properties: f.properties } as never,
                ),
            )
            .map((f) => f.properties.code);
    };

    it('marks every feature outside the unit and none inside it', () => {
        expect(
            outsideCodes({ level: 'county', code: 47 }, 'counties'),
        ).toHaveLength(46);
        expect(
            outsideCodes({ level: 'county', code: 47 }, 'constituencies'),
        ).toHaveLength(290 - 17);
        expect(
            outsideCodes({ level: 'county', code: 47 }, 'wards'),
        ).toHaveLength(1450 - 85);
        expect(
            outsideCodes({ level: 'ward', code: 1448 }, 'wards'),
        ).toHaveLength(1449);
        expect(
            outsideCodes({ level: 'ward', code: 1448 }, 'counties'),
        ).toHaveLength(47);
        expect(
            outsideCodes({ level: 'constituency', code: 280 }, 'counties'),
        ).toHaveLength(47);
    });
});
