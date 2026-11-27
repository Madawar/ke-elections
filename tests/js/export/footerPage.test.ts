// The page text of a slide in a series ("2 of 4"): it sits on the link's line, beside the link, so
// the footer's measured height never changes; a card outside a series has none and its footer is
// exactly what it was. When the line cannot hold the brand, the page text and the link, the page
// text takes the brand's place on that line; when even that is too narrow, the link shrinks.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CardFooter from '@/components/export/CardFooter.vue';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import { SPECS, cardFrame } from '@/lib/export/viewLayout';
import { ATTRIBUTION, CODES_CREDIT, THEMES } from '@/lib/map/theme';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const input = {
    source: 'IEBC gazette notices and parliament.go.ke',
    asOf: '16 July 2026',
    attribution: ATTRIBUTION,
};
/** A long origin and the longest link a slide of the county carousel has. */
const LONG = 'https://kenya-electoral-map.example.org/county/47?seat=county_seats';
/** The links a carousel's slides have, from the cover's (short) to the leaders card's (long). */
const LINKS = [
    'http://localhost:8080/county/37',
    'http://localhost:8080/county/47?seat=county_seats',
    'https://kenya-electoral-map.example.org/county/37',
    LONG,
];

const span = (t: TextItem) => {
    const w = textWidth(t.text.trimEnd(), t.size, (t.weight ?? 400) >= 600);
    return t.anchor === 'end' ? [t.x - w, t.x] : [t.x, t.x + w];
};
const onLine = (lines: TextItem[], page: TextItem) => lines.filter((l) => l.y === page.y);
const apart = (a: TextItem, b: TextItem) => {
    const [a0, a1] = span(a);
    const [b0, b1] = span(b);
    return a1 <= b0 + 0.5 || b1 <= a0 + 0.5;
};
const inside = (t: TextItem, area: Box) => {
    const [x0, x1] = span(t);
    return x0 >= area.x - 0.5 && x1 <= area.x + area.w + 0.5;
};

describe('footerBlock: the page text of a slide', () => {
    it('is absent without a page, and the lines are exactly those of a card outside a series', () => {
        const area = { x: 64, y: 1100, w: 952, h: 200 };
        const fonts = SPECS.portrait.footer;
        const url = 'https://example.org/county/37';
        const plain = footerBlock(area, fonts, { ...input, url });
        expect(plain.page).toBeNull();
        const paged = footerBlock(area, fonts, { ...input, url, page: '2 of 4' });
        // The other lines do not move and the height does not change.
        expect(paged.lines).toEqual(plain.lines);
        expect(paged.bottom).toBe(plain.bottom);
        expect(paged.rule).toBe(plain.rule);
    });

    for (const size of SIZES)
        for (const attribution of [ATTRIBUTION, CODES_CREDIT])
            it(`keeps the page text and a long link on one line on the ${size} card (${attribution === ATTRIBUTION ? 'full' : 'codes'} credit)`, () => {
                for (const url of LINKS) {
                    const { footerBox } = cardFrame(size, { source: input.source, asOf: input.asOf }, url, attribution);
                    const fonts = SPECS[size].footer;
                    const plain = footerBlock(footerBox, fonts, { ...input, attribution, url });
                    const b = footerBlock(footerBox, fonts, { ...input, attribution, url, page: '4 of 4' });
                    const page = b.page!;
                    expect(page.text).toBe('4 of 4');
                    expect(page.tone).toBe('muted');
                    const line = onLine(b.lines, page);
                    const link = line.find((l) => l.text.includes('/county/'))!;
                    expect(link).toBeDefined();
                    expect(page.size).toBe(link.size);
                    for (const t of line) expect(apart(page, t)).toBe(true);
                    for (const t of [...line, page]) expect(inside(t, footerBox)).toBe(true);
                    // Beside the link, after the brand, when the brand is on the line.
                    if (line.some((l) => l.text === 'Kenya Electoral Map'))
                        expect(span(page)[1]).toBeLessThan(span(link)[0]);
                    // The other lines and the height are those of the card outside a series.
                    expect(b.lines.filter((l) => l.y !== page.y)).toEqual(plain.lines.filter((l) => l.y !== page.y));
                    expect(b.bottom).toBe(plain.bottom);
                    expect(b.bottom).toBeLessThanOrEqual(footerBox.y + footerBox.h);
                }
            });

    it('keeps the brand where the brand, the page text and the link fit (a county’s link on the portrait)', () => {
        for (const url of LINKS.slice(0, 3)) {
            const { footerBox } = cardFrame('portrait', { source: input.source, asOf: input.asOf }, url);
            const b = footerBlock(footerBox, SPECS.portrait.footer, { ...input, url, page: '1 of 4' });
            const line = onLine(b.lines, b.page!);
            expect(line.map((l) => l.text)[0]).toBe('Kenya Electoral Map');
            expect(b.page!.anchor).toBe('end');
        }
    });

    it('takes the brand’s place when the line cannot hold all three', () => {
        const fonts = SPECS.portrait.footer;
        const url = 'https://example.org/county/47?seat=county_seats';
        const urlW = textWidth('example.org/county/47?seat=county_seats', fonts.url, true);
        const brandW = textWidth('Kenya Electoral Map', fonts.url, true);
        // Room for the brand and the link (as today), not for the page text too.
        const area = { x: 0, y: 0, w: Math.ceil(brandW + urlW + fonts.url * 1.5 + 4), h: 300 };
        const plain = footerBlock(area, fonts, { ...input, url });
        expect(plain.lines.some((l) => l.text === 'Kenya Electoral Map')).toBe(true);
        const b = footerBlock(area, fonts, { ...input, url, page: '3 of 4' });
        const page = b.page!;
        const line = onLine(b.lines, page);
        expect(line.some((l) => l.text === 'Kenya Electoral Map')).toBe(false);
        expect(page.x).toBe(area.x);
        expect(page.anchor ?? 'start').toBe('start');
        const link = line.find((l) => l.text.includes('county/47'))!;
        expect(link.size).toBe(plain.lines.find((l) => l.text.includes('county/47'))!.size);
        expect(apart(page, link)).toBe(true);
        for (const t of [...line, page]) expect(inside(t, area)).toBe(true);
        expect(b.bottom).toBe(plain.bottom);
    });

    it('shrinks the link to share a line too narrow for both at full size, and never overlaps', () => {
        const fonts = SPECS.story.footer;
        for (const w of [800, 700, 600, 560]) {
            const area = { x: 10, y: 0, w, h: 400 };
            const plain = footerBlock(area, fonts, { ...input, url: LONG });
            const b = footerBlock(area, fonts, { ...input, url: LONG, page: '1 of 4' });
            const page = b.page!;
            const line = onLine(b.lines, page);
            expect(line.length).toBeGreaterThan(0);
            for (const t of line) expect(apart(page, t)).toBe(true);
            for (const t of [...line, page]) expect(inside(t, area)).toBe(true);
            expect(b.bottom).toBe(plain.bottom);
        }
    });
});

describe('CardFooter: the page text', () => {
    const props = {
        box: { x: 64, y: 1100, w: 952, h: 200 },
        fonts: SPECS.portrait.footer,
        source: input.source,
        asOf: input.asOf,
        url: 'https://example.org/county/37',
        theme: THEMES.light,
    };
    it('draws nothing more without a page', () => {
        const w = mount(CardFooter, { props });
        expect(w.find('[data-page]').exists()).toBe(false);
        const lines = footerBlock(props.box, props.fonts, { ...input, attribution: ATTRIBUTION, url: props.url }).lines;
        expect(w.findAll('text')).toHaveLength(lines.length);
    });
    it('draws the page text in the muted ink beside the link', () => {
        const w = mount(CardFooter, { props: { ...props, page: '2 of 4' } });
        const page = w.find('[data-page]');
        expect(page.text()).toBe('2 of 4');
        expect(page.attributes('fill')).toBe(THEMES.light.muted);
        const link = w.findAll('text').find((t) => t.text() === 'example.org/county/37')!;
        expect(page.attributes('y')).toBe(link.attributes('y'));
    });
});

describe('every card declares the page text, as one of the uniform props', () => {
    const cards = import.meta.glob<{ default: { props?: Record<string, unknown> } }>(
        '@/components/export/{View,Party,Leaders,Numbers,TopCounties,FiveSeats,Ballots,Tiles,Versus,Cover}Card.vue',
        { eager: true },
    );
    it('finds the cards', () => expect(Object.keys(cards).length).toBeGreaterThanOrEqual(9));
    for (const [path, mod] of Object.entries(cards))
        it(`${path.split('/').pop()} takes \`page\``, () => {
            expect(Object.keys(mod.default.props ?? {})).toContain('page');
        });
});
