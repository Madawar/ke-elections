import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeColour, fillColor, NO_COLOURING } from '@/lib/map/colouring';
import { OVERLAYS } from '@/lib/map/overlays';
import { buildStyle, EMPTY_FC } from '@/lib/map/style';
import { OTHER, THEMES } from '@/lib/map/theme';
import { type SeatsData, EMPTY_SEATS, seatColouring } from '@/lib/seats';

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

const layerOf = (st: typeof style, id: string) =>
    st.layers.find((l) => l.id === id) as {
        id: string;
        type: string;
        source?: string;
        paint: Record<string, unknown>;
    };
/** A width or opacity `interpolate` over zoom, read at one zoom as MapLibre would. */
const atZoom = (expr: unknown, zoom: number): number => {
    if (typeof expr === 'number') return expr;
    const stops = (expr as unknown[]).slice(3) as number[];
    const first = stops[0];
    if (zoom <= first) return stops[1];
    for (let i = 0; i < stops.length - 2; i += 2)
        if (zoom <= stops[i + 2]) {
            const t = (zoom - stops[i]) / (stops[i + 2] - stops[i]);
            return stops[i + 1] + t * (stops[i + 3] - stops[i + 1]);
        }
    return stops[stops.length - 1];
};
const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const mpColouring = {
    mode: { kind: 'seat', seat: 'mp' },
    colours: new Map([[1, '#ff0000']]),
    fallback: '#cccccc',
} as const;
const governorColouring = {
    mode: { kind: 'seat', seat: 'governor' },
    colours: new Map([[1, '#ff0000']]),
    fallback: '#cccccc',
} as const;

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

        it('keeps the neutral line colours inside the unit, constituency lines darker than ward lines', () => {
            expect(paint(focused, 'wards-line')['line-color']).toBe(
                theme.wardLine,
            );
            expect(paint(focused, 'constituencies-line')['line-color']).toBe(
                theme.constituencyLine,
            );
            expect(luminance(theme.constituencyLine)).toBeLessThan(
                luminance(theme.wardLine),
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

    describe('seat colouring finer than the seat level', () => {
        const theme = THEMES.light;
        const read = (file: string) =>
            JSON.parse(
                readFileSync(resolve(root, 'public/boundaries', file), 'utf8'),
            ).features.map(
                (f: { properties: Record<string, number> }) => f.properties,
            );
        const constituencies = read('constituencies.geojson');
        const wards = read('wards.geojson');
        const props = (list: Record<string, number>[], code: number) =>
            list.find((p) => p.code === code)!;
        const governor = {
            mode: { kind: 'seat', seat: 'governor' },
            colours: new Map([
                [1, '#111111'],
                [47, '#474747'],
            ]),
            fallback: '#cccccc',
        } as const;
        const mp = {
            mode: { kind: 'seat', seat: 'mp' },
            colours: new Map([
                [289, '#289289'],
                [290, '#290290'],
            ]),
            fallback: '#cccccc',
        } as const;
        const layerPaint = (st: typeof style, id: string) =>
            (
                st.layers.find((l) => l.id === id) as {
                    paint: Record<string, unknown>;
                }
            ).paint;
        /** Reads a `match` on a feature property, as MapLibre would for one feature. */
        const evalMatch = (
            expr: unknown,
            properties: Record<string, number>,
        ) => {
            const [op, [, property], ...rest] = expr as [
                string,
                [string, string],
                ...unknown[],
            ];
            expect(op).toBe('match');
            const fallback = rest.pop();
            for (let i = 0; i < rest.length; i += 2)
                if (rest[i] === properties[property]) return rest[i + 1];
            return fallback;
        };
        const build = (
            colouring: never,
            level?: 'county' | 'constituency' | 'ward',
        ) =>
            buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                colouring,
                focus: level ? { level } : undefined,
            });
        const pinnedOpacity = (st: typeof style, id: string) =>
            JSON.stringify(layerPaint(st, id)['fill-opacity']);

        it('colours a focused constituency by its county governor', () => {
            const st = build(governor as never, 'constituency');
            expect(
                evalMatch(
                    layerPaint(st, 'constituencies-fill')['fill-color'],
                    props(constituencies, 290),
                ),
            ).toBe('#474747');
            expect(pinnedOpacity(st, 'constituencies-fill')).toContain(',0.8]');
            expect(pinnedOpacity(st, 'constituencies-fill')).not.toContain(
                'interpolate',
            );
        });

        it('colours a focused ward by its county governor', () => {
            const st = build(governor as never, 'ward');
            expect(
                evalMatch(
                    layerPaint(st, 'wards-fill')['fill-color'],
                    props(wards, 1448),
                ),
            ).toBe('#474747');
            expect(pinnedOpacity(st, 'wards-fill')).not.toContain(
                'interpolate',
            );
            // The level above is hidden by the focus filter; its opacity is left as it was.
            expect(pinnedOpacity(st, 'constituencies-fill')).toContain(
                'interpolate',
            );
        });

        it('colours a focused ward by its constituency MP', () => {
            const st = build(mp as never, 'ward');
            expect(
                evalMatch(
                    layerPaint(st, 'wards-fill')['fill-color'],
                    props(wards, 1448),
                ),
            ).toBe('#290290');
            expect(pinnedOpacity(st, 'wards-fill')).not.toContain(
                'interpolate',
            );
        });

        it('lets the county layer colour a focused county, so children do not stack on it', () => {
            const st = build(governor as never, 'county');
            expect(pinnedOpacity(st, 'counties-fill')).toContain(',0.8]');
            expect(pinnedOpacity(st, 'constituencies-fill')).toContain(
                'interpolate',
            );
            // The children still know their county's colour.
            expect(
                evalMatch(
                    layerPaint(st, 'constituencies-fill')['fill-color'],
                    props(constituencies, 290),
                ),
            ).toBe('#474747');
        });

        it('is unchanged when nothing is focused', () => {
            const st = build(governor as never);
            expect(layerPaint(st, 'constituencies-fill')['fill-color']).toBe(
                theme.ink,
            );
            expect(layerPaint(st, 'wards-fill')['fill-color']).toBe(theme.ink);
            expect(pinnedOpacity(st, 'constituencies-fill')).toContain(
                'interpolate',
            );
        });
    });

    describe('clear borders in every colour view', () => {
        const theme = THEMES.light;
        const LINES = ['wards', 'constituencies', 'counties'] as const;
        const build = (colouring?: never, focus?: never) =>
            buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                colouring,
                focus,
            });
        const views = {
            none: build(),
            province: build({
                ...NO_COLOURING,
                mode: { kind: 'province' },
            } as never),
            mp: build(mpColouring as never),
            governor: build(governorColouring as never),
        };

        it('draws a light casing under every boundary line', () => {
            const ids = style.layers.map((l) => l.id);
            for (const name of LINES) {
                const line = layerOf(style, `${name}-line`);
                const casing = layerOf(style, `${name}-line-casing`);
                expect(casing.type).toBe('line');
                expect(casing.source).toBe(line.source);
                expect(ids.indexOf(`${name}-line-casing`)).toBeLessThan(
                    ids.indexOf(`${name}-line`),
                );
                expect(casing.paint['line-color']).toBe(theme.ground);
                for (const z of [5, 7, 9, 11, 13]) {
                    if (atZoom(line.paint['line-width'], z) === 0) continue;
                    expect(atZoom(casing.paint['line-width'], z)).toBeCloseTo(
                        1.5 * atZoom(line.paint['line-width'], z),
                        5,
                    );
                }
            }
        });

        it('shows the casing in colour views and leaves the boundaries only view as it was', () => {
            for (const name of LINES) {
                expect(
                    layerOf(views.none, `${name}-line-casing`).paint[
                        'line-opacity'
                    ],
                ).toBe(0);
                for (const view of ['province', 'mp', 'governor'] as const)
                    expect(
                        JSON.stringify(
                            layerOf(views[view], `${name}-line-casing`).paint[
                                'line-opacity'
                            ],
                        ),
                    ).toBe(
                        JSON.stringify(
                            layerOf(views[view], `${name}-line`).paint[
                                'line-opacity'
                            ],
                        ),
                    );
            }
        });

        it('never colours a boundary line by party: every line is one of the neutral tokens', () => {
            const tokens = [
                theme.ink,
                theme.countyLine,
                theme.constituencyLine,
                theme.wardLine,
                theme.ground,
                theme.selected,
            ];
            for (const st of Object.values(views))
                for (const l of st.layers.filter((x) => x.type === 'line'))
                    expect(tokens).toContain(
                        (l as unknown as { paint: Record<string, unknown> })
                            .paint['line-color'],
                    );
            expect(layerOf(style, 'counties-line').paint['line-color']).toBe(
                theme.ink,
            );
        });

        it('draws constituency lines at least 1.6 times as wide as ward lines', () => {
            for (const z of [9, 11])
                expect(
                    atZoom(
                        layerOf(style, 'constituencies-line').paint[
                            'line-width'
                        ],
                        z,
                    ) /
                        atZoom(
                            layerOf(style, 'wards-line').paint['line-width'],
                            z,
                        ),
                ).toBeGreaterThanOrEqual(1.6);
        });

        it('keeps that hierarchy, and a lighter ward line, inside a focused county at every zoom', () => {
            const focused = build(undefined, { level: 'county' } as never);
            for (const z of [9, 11, 12, 13, 14, 15])
                expect(
                    atZoom(
                        layerOf(focused, 'constituencies-line').paint[
                            'line-width'
                        ],
                        z,
                    ) /
                        atZoom(
                            layerOf(focused, 'wards-line').paint['line-width'],
                            z,
                        ),
                ).toBeGreaterThanOrEqual(1.6);
        });

        it('keeps the focused unit outline on top of every line and casing', () => {
            const focused = build(undefined, { level: 'county' } as never);
            const ids = focused.layers.map((l) => l.id);
            for (const sel of ['counties', 'constituencies', 'wards'])
                for (const other of LINES)
                    for (const kind of ['line', 'line-casing'])
                        expect(ids.indexOf(`${sel}-selected`)).toBeGreaterThan(
                            ids.indexOf(`${other}-${kind}`),
                        );
        });

        it('fills a seat colour at 0.8 opacity so lines and labels stay legible', () => {
            const base = (st: typeof style, id: string) => {
                const e = layerOf(st, id).paint['fill-opacity'] as unknown[];
                return e[e.length - 1];
            };
            expect(base(views.mp, 'constituencies-fill')).toBe(0.8);
            expect(base(views.governor, 'counties-fill')).toBe(0.8);
        });
    });

    describe('highlighting parties from the legend', () => {
        const theme = THEMES.light;
        const holder = (
            seat: string,
            level: string,
            code: number,
            party: string,
        ) => ({
            seat,
            level,
            code,
            name: 'X',
            party,
            basis: 'elected',
            started_on: '2022-08-09',
            source_url: 'https://example.org',
        });
        const data: SeatsData = {
            ...EMPTY_SEATS,
            parties: [
                {
                    abbrev: 'UDA',
                    name: 'UDA',
                    coalition_2022: null,
                    colour: '#E5B800',
                },
                {
                    abbrev: 'ODM',
                    name: 'ODM',
                    coalition_2022: null,
                    colour: '#E07B20',
                },
                {
                    abbrev: 'JP',
                    name: 'JP',
                    coalition_2022: null,
                    colour: '#C8323C',
                },
            ],
            holders: [
                holder('mp', 'constituency', 289, 'UDA'),
                holder('mp', 'constituency', 290, 'ODM'),
                holder('mp', 'constituency', 1, 'JP'),
                holder('governor', 'county', 47, 'UDA'),
                holder('governor', 'county', 1, 'JP'),
            ] as SeatsData['holders'],
        };
        const colouring = (seat: 'mp' | 'governor', only: string[]) =>
            seatColouring(data, seat, {
                noData: '#eee',
                faded: OTHER,
                only: new Set(only),
            });
        const paintOf = (st: typeof style, id: string) => layerOf(st, id).paint;
        const props = (code: number, extra: Record<string, number> = {}) => ({
            code,
            ...extra,
        });
        /** Reads a `match` on a feature property, as MapLibre would. */
        const colourOf = (
            expr: unknown,
            properties: Record<string, number>,
        ) => {
            const [, [, property], ...rest] = expr as [
                string,
                [string, string],
                ...unknown[],
            ];
            const fallback = rest.pop();
            for (let i = 0; i < rest.length; i += 2)
                if (rest[i] === properties[property]) return rest[i + 1];
            return fallback;
        };
        const build = (c: ReturnType<typeof colouring>, focus?: never) =>
            buildStyle({
                manifest,
                theme,
                provinceOfCounty,
                colouring: c,
                focus,
            });

        it('keeps the highlighted party colours and turns every other holder to the Other grey', () => {
            const fill = paintOf(
                build(colouring('mp', ['UDA'])),
                'constituencies-fill',
            )['fill-color'];
            expect(colourOf(fill, props(289))).toBe('#E5B800');
            expect(colourOf(fill, props(290))).toBe(OTHER);
            expect(colourOf(fill, props(1))).toBe(OTHER);
        });

        it('highlights several parties at once, each keeping its own colour', () => {
            const fill = paintOf(
                build(colouring('mp', ['UDA', 'ODM'])),
                'constituencies-fill',
            )['fill-color'];
            expect(colourOf(fill, props(289))).toBe('#E5B800');
            expect(colourOf(fill, props(290))).toBe('#E07B20');
            expect(colourOf(fill, props(1))).toBe(OTHER);
            // Toggling ODM off leaves UDA only.
            const one = paintOf(
                build(colouring('mp', ['UDA'])),
                'constituencies-fill',
            )['fill-color'];
            expect(colourOf(one, props(290))).toBe(OTHER);
        });

        it('restores the normal colours when the highlight is cleared', () => {
            const cleared = paintOf(
                build(colouring('mp', [])),
                'constituencies-fill',
            )['fill-color'];
            expect(colourOf(cleared, props(290))).toBe('#E07B20');
            expect(colourOf(cleared, props(1))).toBe('#C8323C');
        });

        it('follows a highlighted governor down to the wards of a focused unit', () => {
            const fill = paintOf(
                build(colouring('governor', ['UDA']), {
                    level: 'ward',
                } as never),
                'wards-fill',
            )['fill-color'];
            expect(colourOf(fill, { code: 1448, county_code: 47 })).toBe(
                '#E5B800',
            );
            expect(colourOf(fill, { code: 1, county_code: 1 })).toBe(OTHER);
        });

        it('keeps the surroundings grey and the borders neutral and cased while a party is highlighted', () => {
            const outside = ['!=', ['get', 'code'], 290] as never;
            const st = build(colouring('mp', ['UDA']), {
                level: 'constituency',
                outside: {
                    constituencies: outside,
                    counties: outside,
                    wards: outside,
                },
            } as never);
            expect(
                (
                    paintOf(st, 'constituencies-fill')[
                        'fill-color'
                    ] as unknown[]
                )[0],
            ).toBe('case');
            expect(
                (
                    paintOf(st, 'constituencies-fill')[
                        'fill-color'
                    ] as unknown[]
                )[2],
            ).toBe(theme.muted);
            expect(paintOf(st, 'constituencies-line')['line-color']).toBe(
                theme.constituencyLine,
            );
            expect(
                paintOf(st, 'constituencies-line-casing')['line-color'],
            ).toBe(theme.ground);
        });
    });
});
