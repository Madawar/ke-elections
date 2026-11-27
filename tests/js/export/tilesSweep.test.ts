// The county tiles card for every seat it can be made for (Governor, Senator, Woman Rep), in both
// sizes and both themes, over the real unit index (every real county name), with the worst cases
// for the key: every county held by the party with the longest real abbreviation, by independents
// and by a party with no colour of its own; the twenty longest real abbreviations at once (a key
// of twenty-three entries); and vacancies. Holders are placeholders.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TILE_SEATS, type TileSeat, tilesCardView, tilesHeadline } from '@/lib/export/tilesCard';
import { tilesLayout } from '@/lib/export/tilesLayout';
import { headlineText } from '@/lib/export/viewLayout';
import { THEMES, type ThemeName } from '@/lib/map/theme';
import { type Holder, type Party, type SeatsData, withIndependentColour } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';
import { tilesFaults } from './tilesChecks';

const SIZES = ['portrait', 'story'] as const;
const URL = 'https://example.org/?seat=woman_rep';
const counties = index.all().filter((u) => u.l === 'county').map((u) => u.c);

/** The real registry's abbreviations (data/sources/parties.csv), longest first. */
const ABBREVS = readFileSync(resolve(import.meta.dirname, '../../../data/sources/parties.csv'), 'utf8')
    .split('\n')
    .slice(1)
    .map((line) => line.split(',')[0])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));

const party = (abbrev: string, colour: string | null): Party => ({
    abbrev,
    name: `Placeholder name for ${abbrev}`,
    coalition_2022: null,
    colour,
});
const holder = (seat: TileSeat, code: number, p: string): Holder => ({
    seat,
    level: 'county',
    code,
    name: `Placeholder ${seat} ${code}`,
    party: p,
    basis: 'elected',
    started_on: '2022-08-25',
    source_url: 'https://www.iebc.or.ke/uploads/resources/sample.pdf',
});
/** Every seat's holders by county code, from a function of the code (null: no holder). */
const seatsWith = (parties: Party[], of: (code: number) => string | null): SeatsData => ({
    ...NUMBERS_SEATS,
    parties: [...NUMBERS_SEATS.parties.filter((p) => !parties.some((q) => q.abbrev === p.abbrev)), ...parties],
    holders: TILE_SEATS.flatMap((seat) =>
        counties.flatMap((c) => {
            const p = of(c);
            return p ? [holder(seat, c, p)] : [];
        }),
    ),
});
const colour = (i: number) => `#${(0x284060 + i * 0x0b0a09).toString(16).padStart(6, '0')}`;
const longest = ABBREVS.slice(0, 20);

const CASES: [string, SeatsData][] = [
    ['the fixtures', NUMBERS_SEATS],
    [`every county ${ABBREVS[0]}`, seatsWith([party(ABBREVS[0], '#8A5A2B')], () => ABBREVS[0])],
    ['every county independent', seatsWith([], () => 'IND')],
    ['every county a party with no colour', seatsWith([party('NOPEU', null)], () => 'NOPEU')],
    [
        'the twenty longest abbreviations, independents, no colour and vacancies',
        seatsWith(
            [...longest.map((a, i) => party(a, colour(i))), party('PICKX', null)],
            (c) =>
                c <= 40
                    ? longest[(c - 1) % 20]
                    : c <= 43
                      ? 'IND'
                      : c === 44
                        ? 'PICKX'
                        : null,
        ),
    ],
    ['no county with a holder', seatsWith([], () => null)],
];

describe('the county tiles card for every seat, size and theme', () => {
    it('uses the longest real abbreviations', () => {
        expect(ABBREVS[0]).toBe('KADU-ASILI');
        expect(longest).toHaveLength(20);
    });

    it('keeps every name whole, the key whole, nothing overlapping, nothing past the footer, the story zones clear', () => {
        const faults: string[] = [];
        const placed: Record<string, number> = { corner: 0, under: 0 };
        for (const [name, data] of CASES)
            for (const theme of ['light', 'dark'] as ThemeName[])
                for (const seat of TILE_SEATS) {
                    const card = tilesCardView({
                        seats: withIndependentColour(data, THEMES[theme].independent),
                        index,
                        seat,
                        theme,
                    });
                    for (const size of SIZES) {
                        const headline = tilesHeadline(card);
                        const l = tilesLayout(size, card, { headline, url: URL });
                        const at = `${name}, ${seat}, ${size}, ${theme}`;
                        for (const f of tilesFaults(l, size, card)) faults.push(`${at}: ${f}`);
                        if (headlineText(l.headlineLines) !== headline) faults.push(`${at}: headline not whole`);
                        // The key is the card's, every entry.
                        const keyed = l.key.entries.map((e) => `${e.label.text} ${e.count.text}`);
                        const want = card.key.map((k) => `${k.label} ${k.count}`);
                        if (keyed.join('|') !== want.join('|')) faults.push(`${at}: key ${keyed.join('|')}`);
                        // Names whole and readable.
                        const nameSize = l.tiles[0].name[0].size;
                        if (nameSize < Math.round(l.tile * 0.12)) faults.push(`${at}: names at ${nameSize}px`);
                        for (const t of l.tiles) {
                            const words = t.name.map((n) => n.text).join(' ').replace(/([^\s][/-]) /g, '$1');
                            if (words !== index.get('county', t.code)!.n) faults.push(`${at}: name ${words}`);
                        }
                        placed[l.key.inCorner ? 'corner' : 'under']++;
                    }
                }
        expect(faults).toEqual([]);
        // The key fits the corner in most cases; the twenty-three-entry key goes under the grid.
        expect(placed.corner).toBeGreaterThan(0);
        expect(placed.under).toBeGreaterThan(0);
    });
});
