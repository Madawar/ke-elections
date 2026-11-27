// "Side by side" laid out and drawn: the two halves line up row by row (also when only one
// county's key wraps), one type scale, the same map box, the headline whole and broken at "and",
// the leaders line as separate items with no separator characters, and the component drawing
// what the layout returns, with both maps and the full attribution.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VersusCard from '@/components/export/VersusCard.vue';
import { componentOf, layoutOf } from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { type VersusCardView, versusCardView, versusHeadline } from '@/lib/export/versusCard';
import { versusHeadlineLines, versusLayout } from '@/lib/export/versusLayout';
import { HEADLINE_STRETCH, headlineText } from '@/lib/export/viewLayout';
import { ATTRIBUTION, THEMES, type ThemeName } from '@/lib/map/theme';
import { type SeatsData, legendScope, withIndependentColour } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';
import { misaligned, versusFaults } from './versusChecks';

const SIZES = ['x', 'story'] as const;
const URL = 'https://example.org/?seat=mca';
const view = (a: number, b: number, seats: SeatsData = NUMBERS_SEATS, theme: ThemeName = 'light') =>
    versusCardView({ seats: withIndependentColour(seats, THEMES[theme].independent), index, seat: 'mca', counties: [a, b], theme });
const layout = (c: VersusCardView, size: (typeof SIZES)[number]) =>
    versusLayout(size, c, { headline: versusHeadline(c), url: URL });

/** Nairobi City's wards spread over many placeholder parties with colours, so only its key wraps. */
function crowdedNairobi(n = 14): SeatsData {
    const extra = Array.from({ length: n }, (_, i) => ({
        abbrev: `P${String(i + 1).padStart(2, '0')}`,
        name: `Placeholder party ${i + 1}`,
        coalition_2022: null,
        colour: `#${(0x203040 + i * 0x0a0b0c).toString(16).padStart(6, '0')}`,
    }));
    const wards = legendScope(index, 'mca', { level: 'county', code: 47 })!.codes;
    let i = 0;
    return {
        ...NUMBERS_SEATS,
        parties: [...NUMBERS_SEATS.parties, ...extra],
        holders: NUMBERS_SEATS.holders.map((h) =>
            h.seat === 'mca' && wards.has(h.code) ? { ...h, party: extra[i++ % n].abbrev } : h,
        ),
    };
}

describe('versusLayout', () => {
    it('lines the two halves up row by row, in one type scale, with one map box size', () => {
        for (const size of SIZES)
            for (const [a, b] of [[47, 1], [37, 38], [28, 13]]) {
                const l = layout(view(a, b), size);
                expect(misaligned(l), `${size} ${a}/${b}`).toEqual([]);
                const [p, q] = l.halves;
                if (size === 'x') {
                    // Side by side: the same heights on the card.
                    expect(p.box.y).toBe(q.box.y);
                    expect(q.box.x).toBeGreaterThan(p.box.x + p.box.w);
                } else {
                    // The second county under the first.
                    expect(q.box.y).toBeGreaterThan(p.box.y + p.box.h);
                    expect(q.box.x).toBe(p.box.x);
                }
                expect([p.map.w, p.map.h]).toEqual([q.map.w, q.map.h]);
            }
    });

    it('leaves the same room in the other half when only one county’s key wraps', () => {
        for (const size of SIZES) {
            const card = view(47, 1, crowdedNairobi());
            const l = layout(card, size);
            const [mombasa, nairobi] = l.halves;
            const lines = (hf: typeof mombasa) => new Set(hf.key.map((k) => k.label.y)).size;
            expect(lines(nairobi), size).toBeGreaterThan(lines(mombasa));
            expect(misaligned(l), size).toEqual([]);
            expect(mombasa.keyBox.h).toBe(nairobi.keyBox.h);
            expect(versusFaults(l, size, card), size).toEqual([]);
        }
    });

    it('the alignment check finds a half out of line', () => {
        const l = layout(view(47, 1), 'x');
        const moved = structuredClone(l);
        moved.halves[1].bar.box.y += 4;
        expect(misaligned(moved)).toEqual(['bar']);
    });

    it('keeps both county names whole in the headline: one line when it fits, else broken before "and"', () => {
        for (const size of SIZES) {
            const card = view(28, 13);
            const l = layout(card, size);
            const headline = versusHeadline(card);
            expect(headlineText(l.headlineLines)).toBe(headline);
            if (l.headlineLines.length === 2) expect(l.headlineLines[1].text.startsWith('and ')).toBe(true);
            for (const t of l.headlineLines)
                expect(textWidth(t.text, t.size, true) * HEADLINE_STRETCH).toBeLessThanOrEqual(l.footerBox.w + 0.5);
            expect(versusFaults(l, size, card)).toEqual([]);
        }
        // A width no headline fits on one line: two lines, shrunk only as far as needed.
        const two = versusHeadlineLines('MCA seats: Tharaka - Nithi and Elgeyo/Marakwet', 600, 74);
        expect(two.lines).toEqual(['MCA seats: Tharaka - Nithi', 'and Elgeyo/Marakwet']);
        expect(two.lines.every((t) => textWidth(t, two.size, true) <= 600)).toBe(true);
    });

    it('prints a count inside a part of the bar only when it fits, and every count in the key', () => {
        for (const size of SIZES) {
            const card = view(47, 1);
            const l = layout(card, size);
            l.halves.forEach((hf, i) => {
                expect(hf.bar.parts.map((p) => p.key)).toEqual(card.halves[i].key.map((k) => k.key));
                expect(hf.key.map((k) => k.label.text)).toEqual(card.halves[i].key.map((k) => `${k.label} ${k.count}`));
                for (const p of hf.bar.parts) if (p.label) expect(p.label.x + textWidth(p.label.text, p.label.size, true)).toBeLessThanOrEqual(p.x + p.w);
            });
            expect(l.halves.some((hf) => hf.bar.parts.some((p) => p.label))).toBe(true);
        }
    });

    it('draws the leaders line as three items, each after its tick, apart, with no separator characters', () => {
        for (const size of SIZES) {
            const l = layout(view(47, 1), size);
            for (const hf of l.halves) {
                expect(hf.leaders.map((x) => x.seat)).toEqual(['governor', 'senator', 'woman_rep']);
                for (let i = 1; i < hf.leaders.length; i++) {
                    const prev = hf.leaders[i - 1];
                    const cur = hf.leaders[i];
                    if (cur.tick.y === prev.tick.y)
                        expect(cur.tick.x - (prev.party.x + textWidth(prev.party.text, prev.party.size, true))).toBeGreaterThanOrEqual(prev.party.size);
                }
                for (const x of hf.leaders) {
                    expect(x.label.x).toBeGreaterThan(x.tick.x + x.tick.w);
                    expect(`${x.label.text}${x.party.text}`).not.toMatch(/[·•|,]/);
                }
            }
        }
    });

    it('is what the share dialog lays out for the card', () => {
        const card = view(47, 1);
        expect(layoutOf('x', card, { headline: versusHeadline(card), url: URL, mapAspect: 1 })).toEqual(layout(card, 'x'));
        expect(componentOf(card)).toBe(VersusCard);
    });
});

describe('VersusCard', () => {
    const draw = (c: VersusCardView, size: (typeof SIZES)[number] = 'x', images: Record<string, string> = {}) =>
        mount(VersusCard, {
            props: {
                view: c,
                size,
                headline: versusHeadline(c),
                url: URL,
                theme: THEMES.light,
                mapImage: null,
                mapImages: images,
                mapPlaceholder: 'Drawing the map…',
                mapAspect: 1,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(view(47, 1), 'x').attributes('viewBox')).toBe('0 0 1600 900');
        expect(draw(view(47, 1), 'story').attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('draws both halves in code order, each map from its slot, no names, the full attribution', () => {
        const card = view(47, 1);
        const w = draw(card, 'x', { a: 'data:image/png;base64,A', b: 'data:image/png;base64,B' });
        expect(w.findAll('[data-half]').map((h) => h.attributes('data-county'))).toEqual(['1', '47']);
        expect(w.find('[data-county="1"] image').attributes('href')).toBe('data:image/png;base64,A');
        expect(w.find('[data-county="47"] image').attributes('href')).toBe('data:image/png;base64,B');
        expect(w.findAll('[data-headline]').map((t) => t.text()).join(' ')).toBe('MCA seats: Mombasa and Nairobi City');
        expect(w.find('[data-scope]').text()).toBe('Maps are not to the same scale.');
        expect(w.findAll('[data-name]').map((t) => t.text())).toEqual(['Mombasa', 'Nairobi City']);
        expect(w.text()).not.toContain('Placeholder');
        expect(w.findAll('[data-leader]')).toHaveLength(6);
        const footer = w.find('[data-footer]').text();
        for (const part of ATTRIBUTION.split('; ')) expect(footer).toContain(part);
        expect(w.find('[data-watermark]').exists()).toBe(false);
    });

    it('says the map is drawing until its image comes, and marks sample data', () => {
        const w = draw(view(47, 1), 'x', { a: 'data:image/png;base64,A' });
        expect(w.find('[data-county="47"]').text()).toContain('Drawing the map…');
        expect(draw({ ...view(47, 1), sample: true }).text()).toContain('SAMPLE DATA');
    });
});
