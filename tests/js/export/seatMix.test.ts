import { describe, expect, it } from 'vitest';
import { seatMix } from '@/lib/export/seatMix';
import { scopeLineFor, snapshotView } from '@/lib/export/viewState';
import { buildLegend } from '@/lib/legend';
import { OTHER, THEMES } from '@/lib/map/theme';
import { legendScope, withIndependentColour } from '@/lib/seats';
import { MIX_SEATS, mixIndex } from './mixFixtures';

const seats = withIndependentColour(MIX_SEATS, THEMES.dark.independent);
const nairobi = { level: 'county' as const, code: 47 };

describe('seatMix', () => {
    it('gives Nairobi City MCA seats: 85 wards in the bar, 17 constituency rows in code order', () => {
        const mix = seatMix(seats, 'mca', nairobi, mixIndex);
        expect(mix.total).toBe(85);
        expect(mix.segments.reduce((n, s) => n + s.count, 0)).toBe(85);
        expect(mix.rows).toHaveLength(17);
        expect(mix.rowWord).toBe('constituencies');
        const codes = mix.rows.map((r) => r.code);
        expect(codes).toEqual([...codes].sort((a, b) => a - b));
        expect(codes[0]).toBe(274);
        let sum = 0;
        for (const row of mix.rows) {
            expect(row.kind).toBe('mix');
            if (row.kind !== 'mix') continue;
            expect(row.count).toBe(5);
            expect(row.segments.reduce((n, s) => n + s.count, 0)).toBe(5);
            sum += row.count;
        }
        expect(sum).toBe(85);
    });

    it('orders and colours the segments as the legend rows, folding parties under 3% into Other parties', () => {
        const mix = seatMix(seats, 'mca', nairobi, mixIndex);
        const scope = legendScope(mixIndex, 'mca', nairobi)!;
        const legend = buildLegend(
            seats,
            'mca',
            { codes: scope.codes, unitName: scope.unit.n },
            [],
        );
        // KANU (2 of 85) folds; Independent (2 of 85) never folds; SP1 is Other parties already.
        expect(mix.segments.map((s) => s.key)).toEqual(
            legend.rows.map((r) => r.key).filter((k) => k !== 'KANU'),
        );
        for (const s of mix.segments) {
            const row = legend.rows.find((r) => r.key === s.key)!;
            expect(s.colour).toBe(row.colour);
        }
        const other = mix.segments.at(-1)!;
        expect(other).toMatchObject({
            key: 'other',
            label: 'Other parties',
            colour: OTHER,
            count: 5,
        });
        // The folded coloured party is still named, with its own colour, for the card's legend.
        expect(other.includes.map((p) => [p.label, p.count, p.colour])).toEqual(
            [['KANU', 2, '#8a5a2b']],
        );
        const ind = mix.segments.find((s) => s.key === 'IND')!;
        expect(ind.count).toBe(2);
        expect(ind.colour).toBe(THEMES.dark.independent);
        expect(mix.segments[0]).toMatchObject({ key: 'ODM', share: '47%' });
    });

    it('lists who holds each MP seat in Nairobi City, one row per constituency in code order', () => {
        const mix = seatMix(seats, 'mp', nairobi, mixIndex);
        expect(mix.total).toBe(17);
        expect(mix.rows).toHaveLength(17);
        expect(mix.rowWord).toBe('constituencies');
        expect(mix.rows.map((r) => r.code)).toEqual(
            Array.from({ length: 17 }, (_, i) => 274 + i),
        );
        const first = mix.rows[0];
        expect(first.kind).toBe('holder');
        if (first.kind === 'holder')
            expect(first.holder).toMatchObject({
                name: 'Placeholder mp 274',
                party: 'ODM',
                colour: '#e07b24',
            });
        const ind = mix.rows.find(
            (r) => r.kind === 'holder' && r.holder?.party === 'Independent',
        );
        expect(ind?.kind === 'holder' && ind.holder?.colour).toBe(
            THEMES.dark.independent,
        );
    });

    it('lists the wards of a constituency with their MCA', () => {
        const mix = seatMix(
            seats,
            'mca',
            { level: 'constituency', code: 290 },
            mixIndex,
        );
        expect(mix.total).toBe(5);
        expect(mix.rowWord).toBe('wards');
        expect(mix.rows.map((r) => r.code)).toEqual([
            1446, 1447, 1448, 1449, 1450,
        ]);
        expect(mix.rows.every((r) => r.kind === 'holder')).toBe(true);
    });

    it('has no rows for a county seat, a unit at the seat level, or all of Kenya', () => {
        expect(seatMix(seats, 'governor', nairobi, mixIndex).rows).toEqual([]);
        expect(
            seatMix(seats, 'mp', { level: 'constituency', code: 290 }, mixIndex)
                .rows,
        ).toEqual([]);
        const kenya = seatMix(seats, 'mca', null, mixIndex);
        expect(kenya.rows).toEqual([]);
        expect(kenya.total).toBe(
            MIX_SEATS.holders.filter((h) => h.seat === 'mca').length,
        );
    });
});

describe('the scope line', () => {
    it('says exactly what is counted', () => {
        const view = (seat: 'mca' | 'mp', focus: typeof nairobi | null) =>
            snapshotView({
                seats,
                index: mixIndex,
                seat,
                focus,
                only: [],
                showSurroundings: false,
                theme: 'dark',
            });
        expect(scopeLineFor(view('mca', nairobi))).toBe(
            '85 wards in Nairobi City County',
        );
        expect(scopeLineFor(view('mp', nairobi))).toBe(
            '17 constituencies in Nairobi City County',
        );
        expect(
            scopeLineFor(
                view('mca', { level: 'constituency', code: 290 } as never),
            ),
        ).toBe('5 wards in Mathare constituency');
        expect(scopeLineFor(view('mca', null))).toBe('85 wards across Kenya');
        expect(view('mca', nairobi).mix.rows).toHaveLength(17);
    });
});
