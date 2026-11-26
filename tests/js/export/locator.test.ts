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

    it('names independents as such, in the grey "Other" colour', () => {
        const [row] = cardSeats(SEATS, unit('ward', 1448));
        expect(row.key).toBe('mca');
        expect(row.holder).toMatchObject({
            name: 'Sample Ward Rep',
            party: 'Independent',
            colour: OTHER,
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
            { label: 'Independent', colour: OTHER, count: 1 },
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

    it('folds small parties into an "Others" row with no swatch', () => {
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
        expect(legend.rows).toEqual([
            { label: 'Others', colour: null, count: 2 },
        ]);
    });
});
