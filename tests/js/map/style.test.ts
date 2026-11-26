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
});
