import { describe, expect, it } from 'vitest';
import { OTHER } from '@/lib/map/theme';
import {
    type SeatsData,
    EMPTY_SEATS,
    chamberGroups,
    partyColours,
    seatColouring,
    seatLegend,
} from '@/lib/seats';

const h = (
    seat: string,
    level: string,
    code: number,
    party: string | null,
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
            abbrev: 'AAA',
            name: 'Alpha',
            coalition_2022: null,
            colour: '#E69F00',
        },
        {
            abbrev: 'BBB',
            name: 'Beta',
            coalition_2022: null,
            colour: '#123456',
        },
    ],
    holders: [
        h('mp', 'constituency', 1, 'AAA'),
        h('mp', 'constituency', 2, 'AAA'),
        h('mp', 'constituency', 3, 'BBB'),
        h('mp', 'constituency', 4, 'IND'),
        h('governor', 'county', 1, 'BBB'),
    ] as SeatsData['holders'],
    chambers: { national_assembly: { AAA: 2, BBB: 1, IND: 1 }, senate: {} },
};

describe('seats', () => {
    it('uses set colours, and the neutral fallback for parties without one', () => {
        const c = partyColours(data);
        expect(c.get('BBB')).toBe('#123456');
        expect(c.get('AAA')).toBe('#E69F00');
        expect(c.get('ZZZ')).toBeUndefined();
        expect(c.get('IND')).toBe(OTHER);
        const noColour = {
            ...data,
            parties: [{ ...data.parties[0], colour: null }],
        };
        expect(partyColours(noColour).get('AAA')).toBe(OTHER);
    });

    it('keeps colours stable when seat counts change', () => {
        const more = {
            ...data,
            holders: [
                ...data.holders,
                ...Array.from({ length: 9 }, (_, i) => ({
                    ...data.holders[3],
                    code: 10 + i,
                    party: 'IND',
                })),
            ],
        };
        expect(partyColours(more).get('BBB')).toBe('#123456');
    });

    it('colours a seat level by party and fades filtered-out parties', () => {
        const col = seatColouring(data, 'mp', {
            noData: '#eee',
            faded: '#ddd',
            only: new Set(['BBB']),
        });
        expect(col.mode).toEqual({ kind: 'seat', seat: 'mp' });
        expect(col.colours.get(3)).toBe('#123456');
        expect(col.colours.get(1)).toBe('#ddd');
        expect(col.fallback).toBe('#eee');
    });

    it('builds a legend and chamber groups, largest first', () => {
        expect(seatLegend(data, 'mp').map((r) => [r.abbrev, r.seats])).toEqual([
            ['AAA', 2],
            ['BBB', 1],
            ['IND', 1],
        ]);
        expect(
            chamberGroups(data, 'national_assembly').map((g) => [
                g.key,
                g.seats,
            ]),
        ).toEqual([
            ['AAA', 2],
            ['BBB', 1],
            ['other', 1],
        ]);
    });

    it('is empty-safe', () => {
        expect(chamberGroups(EMPTY_SEATS, 'senate')).toEqual([]);
        expect(
            seatColouring(EMPTY_SEATS, 'mca', { noData: '#e', faded: '#d' })
                .colours.size,
        ).toBe(0);
    });
});
