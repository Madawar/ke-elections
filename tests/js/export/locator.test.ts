import { describe, expect, it } from 'vitest';
import {
    cardSeats,
    codesAtLevel,
    insetStyle,
    mapLegend,
    unitStyle,
} from '@/lib/export/locator';
import { seatColouring } from '@/lib/seats';
import { NO_COLOURING } from '@/lib/map/colouring';
import { OTHER, THEMES } from '@/lib/map/theme';
import { SEATS, index, unit } from './fixtures';

describe('cardSeats', () => {
    it('lists the seats of a county with holder, party and colour, or no data', () => {
        const rows = cardSeats(SEATS, unit('county', 47));
        expect(rows.map((r) => r.label)).toEqual([
            'Governor',
            'Senator',
            'Woman Representative',
        ]);
        expect(rows[0].holder).toEqual({
            name: 'Sample Governor',
            party: 'Sample Party A',
            abbrev: 'SPA',
            colour: '#E69F00',
            sourceUrl: 'https://example.org/gazette',
        });
        expect(rows[1].holder).toBeNull();
    });

    it('names independents as such, in the independent colour', () => {
        const [row] = cardSeats(SEATS, unit('ward', 1448));
        expect(row.key).toBe('mca');
        expect(row.holder).toMatchObject({
            name: 'Sample Ward Rep',
            party: 'Independent',
            colour: THEMES.light.independent,
        });
    });
});

describe('codesAtLevel', () => {
    it('walks down to the level', () => {
        expect(codesAtLevel(index, unit('county', 47), 'constituency')).toEqual(
            [289, 290],
        );
        expect(codesAtLevel(index, unit('constituency', 290), 'ward')).toEqual([
            1447, 1448,
        ]);
    });

    it('walks up to the level', () => {
        expect(codesAtLevel(index, unit('ward', 1448), 'county')).toEqual([47]);
        expect(codesAtLevel(index, unit('ward', 1448), 'ward')).toEqual([1448]);
    });
});

describe('mapLegend', () => {
    it('is empty without seat colouring', () => {
        expect(
            mapLegend(SEATS, index, unit('county', 47), NO_COLOURING),
        ).toBeNull();
    });

    it('counts the coloured units inside the selected unit by party', () => {
        const colouring = seatColouring(SEATS, 'mp', {
            noData: '#E3E8E5',
            faded: '#D5DCD8',
        });
        const legend = mapLegend(SEATS, index, unit('county', 47), colouring)!;
        expect(legend.title).toBe('MP seats by party in Nairobi City');
        expect(legend.rows).toEqual([
            { label: 'SPB', colour: '#56B4E9', count: 2 },
        ]);
    });

    it('shows units without a holder as no data', () => {
        const colouring = seatColouring(SEATS, 'mca', {
            noData: '#E3E8E5',
            faded: '#D5DCD8',
        });
        const legend = mapLegend(
            SEATS,
            index,
            unit('constituency', 290),
            colouring,
        )!;
        expect(legend.rows).toEqual([
            {
                label: 'Independent',
                colour: THEMES.light.independent,
                count: 1,
            },
            { label: 'No approved data', colour: '#E3E8E5', count: 1 },
        ]);
    });
});

describe('map styles for the card', () => {
    const ctx = {
        manifest: { 'wards.geojson': 'abc' } as Record<string, string>,
        provinceOfCounty: new Map([[47, 8]]),
        theme: THEMES.light,
        colouring: NO_COLOURING,
    };

    it('loads wards and washes out the units around the selected one', () => {
        const style = unitStyle(ctx, unit('ward', 1448) as never);
        expect((style.sources.wards as { data: string }).data).toBe(
            '/boundaries/wards.geojson?v=abc',
        );
        const ids = style.layers.map((l) => l.id);
        const dim = style.layers.find((l) => l.id === 'export-dim')!;
        expect(dim).toMatchObject({
            source: 'wards',
            filter: ['!=', ['get', 'code'], 1448],
        });
        expect(ids.indexOf('export-dim')).toBeLessThan(
            ids.indexOf('wards-line'),
        );
        expect(ids.indexOf('export-dim')).toBeGreaterThan(
            ids.indexOf('wards-fill'),
        );
    });

    it('draws only the unit when focused, with the same filters as the screen', () => {
        const focused = { ...ctx, focus: { index, showSurroundings: false } };
        const style = unitStyle(focused, unit('ward', 1448) as never);
        const layer = (id: string) =>
            style.layers.find((l) => l.id === id) as { filter?: unknown };
        expect(layer('wards-fill').filter).toEqual([
            '==',
            ['get', 'code'],
            1448,
        ]);
        expect(layer('counties-fill').filter).toEqual([
            '==',
            ['get', 'code'],
            -1,
        ]);
        expect(layer('labels-ward').filter).toEqual([
            'all',
            ['==', ['get', 'level'], 'ward'],
            expect.anything(),
        ]);
        // Hidden means not drawn, so there is no wash over the neighbours.
        expect(style.layers.some((l) => l.id === 'export-dim')).toBe(false);
        expect(
            (
                style.layers.find(
                    (l) => l.id === 'wards-selected',
                ) as never as {
                    paint: Record<string, unknown>;
                }
            ).paint['line-color'],
        ).toBe(THEMES.light.ink);
    });

    it('colours the card map by the county governor when a constituency is focused', () => {
        const colouring = {
            mode: { kind: 'seat' as const, seat: 'governor' as const },
            colours: new Map([[47, '#474747']]),
            fallback: '#cccccc',
        };
        const style = unitStyle(
            { ...ctx, colouring, focus: { index, showSurroundings: false } },
            unit('constituency', 290) as never,
        );
        const fill = style.layers.find(
            (l) => l.id === 'constituencies-fill',
        ) as {
            paint: Record<string, unknown>;
        };
        // The unit's own layer shows the colour at full strength, not the faint zoom-banded wash.
        expect(JSON.stringify(fill.paint['fill-opacity'])).not.toContain(
            'interpolate',
        );
        expect(fill.paint['fill-color']).toEqual([
            'match',
            ['get', 'county_code'],
            47,
            '#474747',
            '#cccccc',
        ]);
    });

    it('keeps the neighbours, faint and grey, when the surroundings are shown', () => {
        const focused = { ...ctx, focus: { index, showSurroundings: true } };
        const style = unitStyle(focused, unit('ward', 1448) as never);
        const wards = style.layers.find((l) => l.id === 'wards-fill') as {
            filter?: unknown;
            paint: Record<string, unknown>;
        };
        expect(wards.filter).toBeUndefined();
        expect(JSON.stringify(wards.paint['fill-color'])).toContain(
            THEMES.light.muted,
        );
        expect(
            (
                style.layers.find((l) => l.id === 'labels-county') as {
                    filter: unknown[];
                }
            ).filter,
        ).toEqual([
            'all',
            ['==', ['get', 'level'], 'county'],
            expect.anything(),
        ]);
    });

    it('draws Kenya without labels, with the county filled and the unit dotted', () => {
        const style = insetStyle(ctx, unit('ward', 1448), 47);
        expect(style.layers.some((l) => l.type === 'symbol')).toBe(false);
        expect(
            style.layers.find((l) => l.id === 'export-county'),
        ).toMatchObject({
            filter: ['==', ['get', 'code'], 47],
        });
        const point = style.sources['export-unit'] as {
            data: { geometry: { coordinates: number[] } };
        };
        expect(point.data.geometry.coordinates[0]).toBeCloseTo(36.871);
        expect(point.data.geometry.coordinates[1]).toBeCloseTo(-1.258);
    });
});

describe('mapLegend with filters', () => {
    it('labels parties faded by the party filter as not selected', () => {
        const colouring = seatColouring(SEATS, 'mp', {
            noData: '#E3E8E5',
            faded: '#D5DCD8',
            only: new Set(['SPA']),
        });
        const legend = mapLegend(SEATS, index, unit('county', 47), colouring)!;
        expect(legend.rows).toEqual([
            { label: 'Not selected', colour: '#D5DCD8', count: 2 },
        ]);
    });

    it('labels a colourless party that is not highlighted as not selected, not by name', () => {
        const theme = THEMES.light;
        const data = {
            ...SEATS,
            parties: [
                ...SEATS.parties,
                {
                    abbrev: 'ZZZ',
                    name: 'Zed',
                    coalition_2022: null,
                    colour: null,
                },
            ],
            holders: SEATS.holders.map((h) =>
                h.seat === 'mp' && h.code === 290 ? { ...h, party: 'ZZZ' } : h,
            ),
        };
        const colouring = seatColouring(data, 'mp', {
            noData: theme.noData,
            faded: theme.faded,
            only: new Set(['SPB']),
        });
        const labels = mapLegend(
            data,
            index,
            unit('county', 47),
            colouring,
        )!.rows.map((r) => r.label);
        expect(labels).toContain('SPB');
        expect(labels).toContain('Not selected');
        expect(labels).not.toContain('ZZZ');
    });

    it('folds small parties into an "Other parties" row with no swatch', () => {
        const data = {
            ...SEATS,
            holders: [
                ...SEATS.holders,
                { ...SEATS.holders[3], code: 1447, party: 'SPA' },
            ],
        };
        const colouring = seatColouring(data, 'mca', {
            noData: '#E3E8E5',
            faded: '#D5DCD8',
        });
        const legend = mapLegend(
            data,
            index,
            unit('constituency', 290),
            colouring,
            1,
        )!;
        // Independents never fold: they keep their row beside "Other parties".
        expect(legend.rows).toEqual([
            {
                label: 'Independent',
                colour: THEMES.light.independent,
                count: 1,
            },
            { label: 'Other parties', colour: null, count: 1 },
        ]);
    });
});
