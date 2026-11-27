// "Side by side" over the real unit index: every county against its default pick and against the
// longest-named county, both seats (MP, MCA), both sizes (X, story), with the fixtures and with the
// worst cases at once: every county's seats spread over fourteen parties with colours of their own
// (the longest real abbreviations among them) and the independents, one seat in each county with no
// approved holder, and a vacancy on the leaders line. Nothing cut, nothing overlapping, nothing past
// the footer, the story's covered zones kept, the halves lined up. Holders are placeholders.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textWidth } from '@/lib/export/text';
import {
    type VersusSeat,
    versusCardView,
    versusDefault,
    versusHeadline,
} from '@/lib/export/versusCard';
import { versusLayout } from '@/lib/export/versusLayout';
import { headlineText } from '@/lib/export/viewLayout';
import { SEAT_LEVEL } from '@/lib/map/colouring';
import type { Holder, Party, SeatsData } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';
import { misaligned, versusFaults } from './versusChecks';

const SIZES = ['x', 'story'] as const;
const SEATS: VersusSeat[] = ['mca', 'mp'];
const URL = 'https://example.org/?seat=mca';
const counties = index.all().filter((u) => u.l === 'county');
const byWidth = [...counties].sort((a, b) => textWidth(b.n, 40, true) - textWidth(a.n, 40, true));

/** The real registry's abbreviations (data/sources/parties.csv), longest first. */
const ABBREVS = readFileSync(resolve(import.meta.dirname, '../../../data/sources/parties.csv'), 'utf8')
    .split('\n')
    .slice(1)
    .map((line) => line.split(',')[0])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
const MANY = ABBREVS.slice(0, 14);
const extra: Party[] = MANY.map((abbrev, i) => ({
    abbrev,
    name: `Placeholder name for ${abbrev}`,
    coalition_2022: null,
    colour: `#${(0x284060 + i * 0x0b0a09).toString(16).padStart(6, '0')}`,
}));

/**
 * Every county's units of each seat spread over the fourteen and IND, the first one empty; no
 * Woman Rep (the longest label, vacant), or none of the three county seats.
 */
function crowded(countySeats: readonly string[] = ['governor', 'senator']): SeatsData {
    const holders: Holder[] = [];
    for (const seat of SEATS)
        for (const c of counties) {
            const units =
                seat === 'mp'
                    ? index.children('county', c.c)
                    : index.children('county', c.c).flatMap((k) => index.children('constituency', k.c));
            units.slice(1).forEach((u, i) =>
                holders.push({
                    ...NUMBERS_SEATS.holders[0],
                    seat,
                    level: SEAT_LEVEL[seat],
                    code: u.c,
                    name: 'Placeholder',
                    party: i % 15 === 14 ? 'IND' : MANY[i % 15],
                }),
            );
        }
    return {
        ...NUMBERS_SEATS,
        parties: [...NUMBERS_SEATS.parties.filter((p) => !MANY.includes(p.abbrev)), ...extra],
        holders: [
            ...NUMBERS_SEATS.holders.filter((h) => countySeats.includes(h.seat)),
            ...holders,
        ],
    };
}

const CASES: [string, SeatsData][] = [
    ['the fixtures', NUMBERS_SEATS],
    ['fourteen parties, a vacancy and no woman reps', crowded()],
    ['fourteen parties, a vacancy and none of the three county seats', crowded([])],
];

describe('side by side, every county', () => {
    for (const [label, seats] of CASES)
        it(`lays out whole, apart and lined up: ${label}`, () => {
            const faults: string[] = [];
            let checked = 0;
            for (const seat of SEATS)
                for (const c of counties) {
                    const longest = byWidth[0].c === c.c ? byWidth[1].c : byWidth[0].c;
                    for (const other of [versusDefault(index, c.c, null), longest]) {
                        const card = versusCardView({ seats, index, seat, counties: [c.c, other], theme: 'light' });
                        const headline = versusHeadline(card);
                        for (const size of SIZES) {
                            const l = versusLayout(size, card, { headline, url: URL });
                            const tag = `${seat} ${c.c}/${other} ${size}`;
                            faults.push(...versusFaults(l, size, card, URL).map((f) => `${tag}: ${f}`));
                            const off = misaligned(l);
                            if (off.length) faults.push(`${tag}: not lined up: ${off.join(', ')}`);
                            if (headlineText(l.headlineLines) !== headline) faults.push(`${tag}: headline not whole`);
                            checked++;
                        }
                    }
                }
            expect(checked).toBe(47 * 2 * 2 * 2);
            expect(faults.slice(0, 40)).toEqual([]);
        });

    it('really meets the worst cases it claims', () => {
        const card = versusCardView({ seats: crowded(), index, seat: 'mca', counties: [47, 1], theme: 'light' });
        expect(card.halves[1].key.length).toBeGreaterThanOrEqual(16);
        expect(card.halves[1].key.map((k) => k.label)).toContain(MANY[0]);
        expect(card.halves[1].key.at(-1)!.key).toBe('none');
        expect(card.halves[0].leaders.map((l) => l.party === null)).toEqual([false, false, true]);
        const empty = versusCardView({ seats: crowded([]), index, seat: 'mca', counties: [47, 1], theme: 'light' });
        expect(empty.halves.flatMap((h) => h.leaders.map((l) => l.party))).toEqual(Array(6).fill(null));
        expect(MANY[0]).toBe('KADU-ASILI');
    });
});
