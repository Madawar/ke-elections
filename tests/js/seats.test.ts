import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OTHER, THEMES } from '@/lib/map/theme';
import {
    type SeatsData,
    EMPTY_SEATS,
    chamberGroups,
    chamberHighlight,
    partyColours,
    seatColouring,
    legendScope,
    seatLegend,
} from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

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

describe('legend counts that follow the focus', () => {
    const index = UnitIndex.fromRows(
        JSON.parse(
            readFileSync(
                resolve(
                    import.meta.dirname,
                    '../../public/boundaries/units.json',
                ),
                'utf8',
            ),
        ) as Unit[],
    );
    const nairobi = index.children('county', 47).map((u) => u.c);
    const national: SeatsData = {
        ...data,
        holders: [
            // Nairobi's 17 MPs: 13 AAA and 4 BBB; four more MPs elsewhere.
            ...nairobi.map((code, i) =>
                h('mp', 'constituency', code, i < 13 ? 'AAA' : 'BBB'),
            ),
            ...[1, 2, 3, 4].map((code) => h('mp', 'constituency', code, 'AAA')),
            h('governor', 'county', 47, 'BBB'),
            h('governor', 'county', 1, 'AAA'),
        ] as SeatsData['holders'],
    };
    const total = (rows: { seats: number }[]) =>
        rows.reduce((n, r) => n + r.seats, 0);

    it('counts only the seats inside the focused county', () => {
        const scope = legendScope(index, 'mp', { level: 'county', code: 47 })!;
        expect(scope.unit.n).toBe('Nairobi City');
        const rows = seatLegend(national, 'mp', scope.codes);
        expect(total(rows)).toBe(17);
        expect(rows.map((r) => [r.abbrev, r.seats])).toEqual([
            ['AAA', 13],
            ['BBB', 4],
        ]);
        // Unfocused, the totals stay national.
        expect(total(seatLegend(national, 'mp'))).toBe(21);
        expect(legendScope(index, 'mp', null)).toBeNull();
    });

    it('counts the one seat that covers a focused unit when the seat is coarser', () => {
        const ward = legendScope(index, 'governor', {
            level: 'ward',
            code: 1448,
        })!;
        expect(ward.unit.n).toBe('Nairobi City');
        expect(
            seatLegend(national, 'governor', ward.codes).map((r) => r.abbrev),
        ).toEqual(['BBB']);
        const constituency = legendScope(index, 'mp', {
            level: 'ward',
            code: 1448,
        })!;
        expect(constituency.unit.l).toBe('constituency');
        expect(constituency.codes.size).toBe(1);
    });

    it('scopes a finer seat to the wards inside the unit', () => {
        const scope = legendScope(index, 'mca', {
            level: 'constituency',
            code: nairobi[0],
        })!;
        expect(scope.codes.size).toBe(
            index.children('constituency', nairobi[0]).length,
        );
    });
});

describe('highlighting "Other and independent"', () => {
    // CCC has no colour of its own, so it is drawn as the Other grey; AAA and BBB have colours.
    const noColour: SeatsData = {
        ...data,
        parties: [
            ...data.parties,
            {
                abbrev: 'CCC',
                name: 'Gamma',
                coalition_2022: null,
                colour: null,
            },
        ],
        holders: [
            h('mp', 'constituency', 1, 'AAA'),
            h('mp', 'constituency', 2, 'BBB'),
            h('mp', 'constituency', 3, 'CCC'),
            h('mp', 'constituency', 4, 'IND'),
        ] as SeatsData['holders'],
    };

    it('draws selected units and not-selected units in clearly different colours', () => {
        for (const theme of [THEMES.light, THEMES.dark]) {
            const col = seatColouring(noColour, 'mp', {
                noData: theme.noData,
                faded: theme.faded,
                only: new Set(['CCC', 'IND']),
            });
            // The highlighted remainder keeps the Other grey; everything else is the faded wash.
            expect(col.colours.get(3)).toBe(OTHER);
            expect(col.colours.get(4)).toBe(OTHER);
            expect(col.colours.get(1)).toBe(theme.faded);
            expect(col.colours.get(2)).toBe(theme.faded);
            expect(theme.faded).not.toBe(OTHER);
            expect(theme.faded).not.toBe(theme.noData);
        }
    });
});

describe('chamberHighlight', () => {
    const groups = [{ key: 'AAA' }, { key: 'BBB' }, { key: 'other' }];
    const chamber = { AAA: 2, BBB: 1, IND: 1, ZZZ: 3 };

    it('highlights the party’s own group', () => {
        expect(chamberHighlight(groups, chamber, 'AAA')).toBe('AAA');
    });

    it('highlights Other for a party that sits in it', () => {
        expect(chamberHighlight(groups, chamber, 'ZZZ')).toBe('other');
        expect(chamberHighlight(groups, chamber, 'IND')).toBe('other');
    });

    it('highlights nothing for a party with no seats in the chamber', () => {
        expect(chamberHighlight(groups, chamber, 'QQQ')).toBeUndefined();
        expect(chamberHighlight(groups, { AAA: 1 }, 'ZZZ')).toBeUndefined();
        expect(chamberHighlight(groups, chamber, undefined)).toBeUndefined();
    });

    it('highlights nothing when the chamber has no Other group to point at', () => {
        expect(
            chamberHighlight([{ key: 'AAA' }], chamber, 'ZZZ'),
        ).toBeUndefined();
    });
});
