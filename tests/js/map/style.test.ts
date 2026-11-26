import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeColour, fillColor, NO_COLOURING } from '@/lib/map/colouring';
import { OVERLAYS } from '@/lib/map/overlays';
import { buildStyle, EMPTY_FC } from '@/lib/map/style';
import { THEMES } from '@/lib/map/theme';

const root = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(
    readFileSync(resolve(root, 'public/boundaries/manifest.json'), 'utf8'),
);
const counties = JSON.parse(
    readFileSync(resolve(root, 'public/boundaries/counties.geojson'), 'utf8'),
);
const provinceOfCounty = new Map<number, number>(
    counties.features.map(
        (f: { properties: { code: number; province_code: number } }) => [
            f.properties.code,
            f.properties.province_code,
        ],
    ),
);
const style = buildStyle({ manifest, theme: THEMES.light, provinceOfCounty });

describe('buildStyle', () => {
    it('starts with an empty ward source', () => {
        expect((style.sources.wards as { data: unknown }).data).toEqual(
            EMPTY_FC,
        );
    });

    it('versions every boundary URL with the manifest hash', () => {
        for (const [name, source] of Object.entries(style.sources)) {
            if (name === 'wards') continue;
            const data = (source as { data: string }).data;
            const file = data.split('/').pop()!.split('?')[0];
            expect(data).toBe(`/boundaries/${file}?v=${manifest[file]}`);
        }
    });

    it('uses self-hosted glyphs and the agreed layer ids', () => {
        expect(style.glyphs).toBe('/glyphs/{fontstack}/{range}.pbf');
        const ids = style.layers.map((l) => l.id);
        for (const id of [
            'counties-fill',
            'constituencies-fill',
            'wards-fill',
            'counties-line',
            'labels-county',
            'labels-ward',
            'wards-selected',
        ])
            expect(ids).toContain(id);
        // Every font used must have downloaded glyphs.
        const fonts = new Set(
            style.layers.flatMap(
                (l) =>
                    (l as { layout?: { 'text-font'?: string[] } }).layout?.[
                        'text-font'
                    ] ?? [],
            ),
        );
        for (const layer of OVERLAYS.flatMap((o) =>
            o.layers(THEMES.light, 'x'),
        ))
            for (const f of (layer as { layout?: { 'text-font'?: string[] } })
                .layout?.['text-font'] ?? [])
                fonts.add(f);
        for (const font of fonts)
            expect(() =>
                readFileSync(resolve(root, 'public/glyphs', font, '0-255.pbf')),
            ).not.toThrow();
    });

    it('colours by former province with a match on county_code covering 47 counties', () => {
        const e = fillColor(
            { ...NO_COLOURING, mode: { kind: 'province' } },
            'ward',
            provinceOfCounty,
            '#000',
        ) as unknown[];
        expect(e[0]).toBe('match');
        expect(e[1]).toEqual(['get', 'county_code']);
        expect((e.length - 3) / 2).toBe(47);
    });

    it('colours a seat level by code and never emits an empty match', () => {
        expect(codeColour(new Map(), '#ccc')).toBe('#ccc');
        expect(
            codeColour(
                new Map([
                    [2, '#f00'],
                    [1, '#0f0'],
                ]),
                '#ccc',
            ),
        ).toEqual(['match', ['get', 'code'], 1, '#0f0', 2, '#f00', '#ccc']);
    });

    describe('while a unit is focused', () => {
        const theme = THEMES.light;
        const paint = (st: typeof style, id: string) =>
            (
                st.layers.find((l) => l.id === id) as {
                    paint: Record<string, unknown>;
                }
            ).paint;
        const focused = buildStyle({
            manifest,
            theme,
            provinceOfCounty,
            focus: {},
        });
        const topStop = (e: unknown) => {
            const stops = (e as unknown[]).slice(3);
            return Math.max(...stops.filter((_, i) => i % 2 === 1).map(Number));
        };

        it('draws the unit outline in the one ink colour, thicker than every inner border', () => {
            const inner = Math.max(
                topStop(paint(focused, 'wards-line')['line-width']),
                topStop(paint(focused, 'constituencies-line')['line-width']),
                topStop(paint(focused, 'counties-line')['line-width']),
            );
            for (const id of [
                'counties-selected',
                'constituencies-selected',
                'wards-selected',
            ]) {
                expect(paint(focused, id)['line-color']).toBe(theme.ink);
                expect(
                    topStop(paint(focused, id)['line-width']),
                ).toBeGreaterThan(inner);
            }
        });

        it('uses one neutral colour for every border inside the unit', () => {
            expect(paint(focused, 'wards-line')['line-color']).toBe(
                theme.constituencyLine,
            );
            expect(paint(focused, 'constituencies-line')['line-color']).toBe(
                theme.constituencyLine,
            );
            // Without focus the ward lines keep their own, lighter colour.
            expect(paint(style, 'wards-line')['line-color']).toBe(
                theme.wardLine,
            );
        });

        it('greys and fades what is outside the unit when the surroundings are shown', () => {
            const outside = ['!=', ['get', 'county_code'], 47];
            const shown = buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                colouring: { ...NO_COLOURING, mode: { kind: 'province' } },
                focus: { outside: { wards: outside as never } },
            });
            const colour = paint(shown, 'wards-fill')[
                'fill-color'
            ] as unknown[];
            expect(colour).toEqual([
                'case',
                outside,
                theme.muted,
                expect.arrayContaining(['match']),
            ]);
            const opacity = JSON.stringify(
                paint(shown, 'wards-fill')['fill-opacity'],
            );
            expect(opacity).toContain(
                `["case",${JSON.stringify(outside)},0.15,`,
            );
            const lines = JSON.stringify(
                paint(shown, 'wards-line')['line-opacity'],
            );
            expect(lines).toContain(`["case",${JSON.stringify(outside)},0.3,`);
            // A plain map has no fills to dim, but the surroundings still get the grey wash.
            const plain = buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                focus: { outside: { wards: outside as never } },
            });
            expect(
                JSON.stringify(paint(plain, 'wards-fill')['fill-opacity']),
            ).toContain(`["case",${JSON.stringify(outside)},0.15,`);
        });

        it('washes only the coloured level when a seat colouring is on, so the washes do not stack', () => {
            const outside = ['!=', ['get', 'code'], 290];
            const seat = buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                colouring: {
                    mode: { kind: 'seat', seat: 'mp' },
                    colours: new Map(),
                    fallback: '#ccc',
                },
                focus: {
                    outside: {
                        constituencies: outside as never,
                        counties: outside as never,
                    },
                },
            });
            expect(
                JSON.stringify(
                    paint(seat, 'constituencies-fill')['fill-opacity'],
                ),
            ).toContain('"case"');
            expect(
                JSON.stringify(paint(seat, 'counties-fill')['fill-opacity']),
            ).not.toContain(JSON.stringify(outside));
        });

        it('leaves other sources alone', () => {
            const outside = ['!=', ['get', 'county_code'], 47];
            const shown = buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                focus: { outside: { wards: outside as never } },
            });
            // Layers of the other sources are not touched.
            expect(paint(shown, 'counties-fill')['fill-color']).not.toEqual(
                expect.arrayContaining(['case']),
            );
        });
    });
});
