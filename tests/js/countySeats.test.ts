import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCountySeatsLegend } from '@/lib/legend';
import { pinnedLevel } from '@/lib/map/colouring';
import { coloursOf, patternId } from '@/lib/map/stripes';
import { buildStyle } from '@/lib/map/style';
import { OTHER, THEMES } from '@/lib/map/theme';
import {
    type Holder,
    type SeatsData,
    EMPTY_SEATS,
    countySeatsColouring,
} from '@/lib/seats';

const AAA = '#e69f00';
const BBB = '#56b4e9';
const h = (seat: string, code: number, party: string | null): Holder =>
    ({
        seat,
        level: 'county',
        code,
        name: 'X',
        party,
        basis: 'elected',
        started_on: '2022-08-09',
        source_url: 'https://example.org',
    }) as Holder;
/**
 * 47 counties, three seats each (141). County 1: AAA, BBB, AAA. County 2: all AAA. County 3: a
 * Governor only (two vacancies). County 4: an independent Senator and a party with no colour.
 * Every other county: AAA, BBB, BBB.
 */
const holders: Holder[] = [];
for (let c = 1; c <= 47; c++) {
    if (c === 1) holders.push(h('governor', c, 'AAA'), h('senator', c, 'BBB'), h('woman_rep', c, 'AAA'));
    else if (c === 2) holders.push(h('governor', c, 'AAA'), h('senator', c, 'AAA'), h('woman_rep', c, 'AAA'));
    else if (c === 3) holders.push(h('governor', c, 'BBB'));
    else if (c === 4) holders.push(h('governor', c, 'AAA'), h('senator', c, 'IND'), h('woman_rep', c, 'ZZZ'));
    else holders.push(h('governor', c, 'AAA'), h('senator', c, 'BBB'), h('woman_rep', c, 'BBB'));
}
const data: SeatsData = {
    ...EMPTY_SEATS,
    parties: [
        { abbrev: 'AAA', name: 'Alpha', coalition_2022: null, colour: AAA },
        { abbrev: 'BBB', name: 'Beta', coalition_2022: null, colour: BBB },
        { abbrev: 'ZZZ', name: 'Zeta', coalition_2022: null, colour: null },
    ],
    // MPs must never leak into the county seats.
    holders: [...holders, { ...h('mp', 1, 'BBB'), level: 'constituency' }],
};
const T = THEMES.light;
const colouring = (only: string[] = []) =>
    countySeatsColouring(data, {
        noData: T.noData,
        faded: T.faded,
        only: new Set(only),
    });
const low = (c: string) => c.toLowerCase();

describe('countySeatsColouring', () => {
    it('gives each county a stripe pattern of its Governor, Senator and Woman Rep, in that order', () => {
        const col = colouring();
        expect(col.mode).toEqual({ kind: 'county_seats' });
        expect(coloursOf(col.patterns!.get(1)!)).toEqual([AAA, BBB, AAA]);
        expect(coloursOf(col.patterns!.get(5)!)).toEqual([AAA, BBB, BBB]);
        // The order is the seats', not the parties': the same two parties the other way round
        // is another pattern.
        expect(col.patterns!.get(1)).not.toBe(col.patterns!.get(5));
        expect(col.patterns!.size).toBe(47);
    });

    it('repeats the colour when seats share a party, so one party gives a solid fill', () => {
        expect(coloursOf(colouring().patterns!.get(2)!)).toEqual([AAA, AAA, AAA]);
    });

    it('uses the no-data colour for a seat with no holder, and for a county with none at all', () => {
        const col = colouring();
        expect(coloursOf(col.patterns!.get(3)!)).toEqual([
            BBB,
            low(T.noData),
            low(T.noData),
        ]);
        expect(col.fallbackPattern).toBe(
            patternId([T.noData, T.noData, T.noData]),
        );
    });

    it('draws independents in their own colour and a party without one in the Other grey', () => {
        expect(coloursOf(colouring().patterns!.get(4)!)).toEqual([
            AAA,
            low(T.independent),
            low(OTHER),
        ]);
    });

    it('fades the stripes of the parties that are not highlighted', () => {
        const col = colouring(['BBB']);
        expect(coloursOf(col.patterns!.get(1)!)).toEqual([
            low(T.faded),
            BBB,
            low(T.faded),
        ]);
        // A vacancy stays no-data, never faded.
        expect(coloursOf(col.patterns!.get(3)!)).toEqual([
            BBB,
            low(T.noData),
            low(T.noData),
        ]);
    });

    it('pins the county fills at every zoom, like a Governor colouring', () => {
        expect(pinnedLevel(colouring().mode)).toBe('county');
    });
});

describe('the style of the "County seats" view', () => {
    const root = resolve(import.meta.dirname, '../..');
    const manifest = JSON.parse(
        readFileSync(resolve(root, 'public/boundaries/manifest.json'), 'utf8'),
    );
    const provinceOfCounty = new Map<number, number>([[1, 1]]);
    const fill = (st: ReturnType<typeof buildStyle>, id = 'counties-fill') =>
        (st.layers.find((l) => l.id === id) as { paint: Record<string, unknown> })
            .paint;

    it('fills each county with its pattern, matched on the county code', () => {
        const col = colouring();
        const st = buildStyle({
            manifest,
            theme: T,
            provinceOfCounty,
            colouring: col,
        });
        const pattern = fill(st)['fill-pattern'] as unknown[];
        expect(pattern[0]).toBe('match');
        expect(pattern[1]).toEqual(['get', 'code']);
        expect(pattern.slice(2, 4)).toEqual([1, col.patterns!.get(1)]);
        expect(pattern[pattern.length - 1]).toBe(col.fallbackPattern);
        // 47 counties, a code and a pattern each, plus the fallback.
        expect(pattern).toHaveLength(2 + 47 * 2 + 1);
        // The levels under the counties carry no pattern.
        expect(fill(st, 'constituencies-fill')['fill-pattern']).toBeUndefined();
        expect(fill(st, 'wards-fill')['fill-pattern']).toBeUndefined();
    });

    it('has no pattern in any other view', () => {
        expect(
            fill(buildStyle({ manifest, theme: T, provinceOfCounty }))[
                'fill-pattern'
            ],
        ).toBeUndefined();
    });

    it('draws what is outside a focused county in one neutral grey, not in stripes', () => {
        const outside = ['!=', ['get', 'code'], 1];
        const st = buildStyle({
            manifest,
            theme: T,
            provinceOfCounty,
            colouring: colouring(),
            focus: { level: 'county', outside: { counties: outside as never } },
        });
        const pattern = fill(st)['fill-pattern'] as unknown[];
        expect(pattern.slice(0, 3)).toEqual([
            'case',
            outside,
            patternId([T.muted, T.muted, T.muted]),
        ]);
    });

    it('cases the borders, as every colour view does', () => {
        const st = buildStyle({
            manifest,
            theme: T,
            provinceOfCounty,
            colouring: colouring(),
        });
        expect(fill(st, 'counties-line-casing')['line-opacity']).not.toBe(0);
    });
});

describe('the "County seats" legend', () => {
    it('counts the county seats each party holds across all three seats: 141 less the vacancies', () => {
        const legend = buildCountySeatsLegend(data, null, [], '1 November 2026');
        const total = legend.rows.reduce((n, r) => n + (r.count ?? 0), 0);
        // County 3 has two vacancies.
        expect(total).toBe(141 - 2);
        const count = (key: string) =>
            legend.rows.find((r) => r.key === key)?.count;
        // AAA: 1 has 2, 2 has 3, 4 has 1, and 43 other counties have 1 each.
        expect(count('AAA')).toBe(2 + 3 + 1 + 43);
        // BBB: 1 has 1, 3 has 1, and 43 other counties have 2 each.
        expect(count('BBB')).toBe(1 + 1 + 86);
        expect(count('IND')).toBe(1);
        expect(count('other')).toBe(1);
        expect(legend.members.other).toEqual(['ZZZ']);
    });

    it('says what the stripes are, with the source and date', () => {
        const legend = buildCountySeatsLegend(data, null, [], '1 November 2026');
        expect(legend.title).toBe('County seats across Kenya by party');
        expect(legend.chipLabel).toBe('County seats');
        expect(legend.note).toBe(
            'Each county is striped by its Governor, Senator and Woman Rep. Elected 2022, with changes since. Source: IEBC gazette notices, as of 1 November 2026',
        );
    });

    it('covers only the focused county, and names it', () => {
        const legend = buildCountySeatsLegend(
            data,
            { codes: new Set([1]), unitName: 'Mombasa' },
            [],
        );
        expect(legend.title).toBe('County seats in Mombasa by party');
        expect(legend.rows.map((r) => [r.key, r.count])).toEqual([
            ['AAA', 2],
            ['BBB', 1],
        ]);
    });

    it('marks the highlighted parties, as the seat legends do', () => {
        const legend = buildCountySeatsLegend(data, null, ['BBB']);
        expect(legend.highlighted).toEqual(['BBB']);
        expect(legend.filtered).toBe(true);
        expect(legend.title).toBe(
            'County seats across Kenya by party: showing BBB',
        );
        expect(legend.chipLabel).toBe('County seats: BBB');
    });
});
