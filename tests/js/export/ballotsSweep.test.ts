// Every ward of the real unit index (public/boundaries/units.json), laid out in both sizes with
// the worst case the data has: each seat's holder named with a placeholder as long as the longest
// real name for that seat, and the widest real party line on all five seats. The names of the
// wards, constituencies and counties are the real (published) ones, so a long or unbroken ward
// name in the headline or scope line is caught here, not on someone's phone.
import { describe, expect, it } from 'vitest';
import { ballotsCardView, ballotsHeadline } from '@/lib/export/ballotsCard';
import { ballotsLayout } from '@/lib/export/ballotsLayout';
import { leadersCardView, leadersHeadline } from '@/lib/export/leadersCard';
import { leadersLayout } from '@/lib/export/leadersLayout';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH, headlineText } from '@/lib/export/viewLayout';
import { THEMES } from '@/lib/map/theme';
import type { Holder } from '@/lib/seats';
import { withIndependentColour } from '@/lib/seats';
import { ballotsFaults } from './ballotsChecks';
import { LONGEST_NAMES, holder, index, placeholderName, seatsWith } from './ballotsFixtures';

const PARTY = 'NOPEU';
const byLevel = (l: 'county' | 'constituency' | 'ward') => index.all().filter((u) => u.l === l);
const names = Object.fromEntries(
    Object.entries(LONGEST_NAMES).map(([seat, [length, words]]) => [seat, placeholderName(length, words)]),
) as Record<keyof typeof LONGEST_NAMES, string>;

const holders: Holder[] = [
    ...byLevel('county').flatMap((u) =>
        (['governor', 'senator', 'woman_rep'] as const).map((seat) =>
            holder(seat, 'county', u.c, PARTY, { name: names[seat] }),
        ),
    ),
    ...byLevel('constituency').map((u) => holder('mp', 'constituency', u.c, PARTY, { name: names.mp })),
    ...byLevel('ward').map((u) => holder('mca', 'ward', u.c, PARTY, { name: names.mca })),
];
const seats = withIndependentColour(seatsWith(holders), THEMES.light.independent);
const wards = byLevel('ward');
// All 1,450 wards in both sizes take about five seconds; this runs the ones whose names test the
// card hardest (the 50 longest ward names, and the 50 longest "ward, constituency, county" lines)
// and every tenth ward, about 240.
const placeLength = (u: (typeof wards)[number]) => {
    const c = index.get('constituency', u.p!)!;
    return u.n.length + c.n.length + index.get('county', c.p!)!.n.length;
};
const longest = (by: (u: (typeof wards)[number]) => number) =>
    [...wards].sort((a, b) => by(b) - by(a) || a.c - b.c).slice(0, 50);
const swept = [
    ...new Set([
        ...longest((u) => u.n.length),
        ...longest(placeLength),
        ...wards.filter((u) => u.c % 10 === 0),
    ]),
];

describe('the ward card for every ward', () => {
    it('uses placeholder names as long as the longest real ones', () => {
        for (const [seat, [length, words]] of Object.entries(LONGEST_NAMES)) {
            const name = names[seat as keyof typeof names];
            expect(name).toHaveLength(length);
            expect(name.split(' ')).toHaveLength(words);
            expect(name.startsWith('Placeholder')).toBe(true);
        }
        expect(wards).toHaveLength(1450);
        // The hardest names are in the sweep: Shinoyi-Shikomari-Esumeyia (one unbroken word).
        expect(swept.map((u) => u.c)).toContain(1016);
    });

    it('cuts nothing, overlaps nothing, ends above the footer and keeps the story’s safe zones, in both sizes', () => {
        const faults: string[] = [];
        for (const w of swept) {
            const c = ballotsCardView({ seats, index, ward: w.c, theme: 'light' })!;
            const headline = ballotsHeadline(c);
            const url = `https://example.org/ward/${w.c}`;
            for (const size of ['portrait', 'story'] as const) {
                const l = ballotsLayout(size, c, { headline, url });
                for (const f of ballotsFaults(l, size, { source: c.source, url }, headline))
                    faults.push(`${w.c} ${w.n} ${size}: ${f}`);
            }
        }
        expect(faults).toEqual([]);
    });
});

describe('the leaders card’s default headline for every county and constituency', () => {
    // The leaders card shares the headline's fallback (`fitHeadline`): no name is cut there either.
    it('is whole, with no ellipsis, inside the card, in every size', () => {
        const faults: string[] = [];
        const empty = seatsWith([]);
        for (const level of ['county', 'constituency'] as const)
            for (const u of byLevel(level)) {
                const c = leadersCardView({
                    seats: empty,
                    index,
                    focus: { level, code: u.c },
                    theme: 'light',
                })!;
                const headline = leadersHeadline(c);
                for (const size of Object.keys(VIEW_SIZES) as ViewSize[]) {
                    const l = leadersLayout(size, c, { headline, url: 'https://example.org/', mapAspect: 1 });
                    const lines = l.headlineLines;
                    if (headlineText(lines) !== headline) faults.push(`${level} ${u.c} ${size}: ${lines.map((t) => t.text).join(' / ')}`);
                    for (const t of lines)
                        if (t.x + textWidth(t.text, t.size, true) * HEADLINE_STRETCH > l.w + 0.5)
                            faults.push(`${level} ${u.c} ${size}: "${t.text}" off the card`);
                }
            }
        expect(faults).toEqual([]);
    });
});
