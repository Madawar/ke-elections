// The page text of a slide in a series ("2 of 4"): it sits on the link's line, right before the
// link, which is right-aligned at the footer's right edge, so the footer's measured height never
// changes; a card outside a series has none and its footer is exactly what it was. In a series every
// slide has the series' link and is measured with the series' widest page text (`pageWidest`), so
// every slide decides alike: the brand on all of them or on none, the link at one size.
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
                    // Right before the link, which ends at the footer's right edge.
                    expect(span(page)[1]).toBeLessThan(span(link)[0]);
                    expect(link.anchor).toBe('end');
                    expect(link.x).toBe(footerBox.x + footerBox.w);
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

    it('drops the brand where it does not fit, and keeps the page text and the link right-aligned', () => {
        const url = 'http://localhost:8080/county/47?seat=county_seats';
        const { footerBox } = cardFrame('story', { source: input.source, asOf: input.asOf }, url);
        const fonts = SPECS.story.footer;
        const plain = footerBlock(footerBox, fonts, { ...input, url });
        expect(plain.lines.some((l) => l.text === 'Kenya Electoral Map')).toBe(false);
        const b = footerBlock(footerBox, fonts, { ...input, url, page: '2 of 4' });
        const link = b.lines.at(-1)!;
        expect(b.lines.some((l) => l.text === 'Kenya Electoral Map')).toBe(false);
        expect(link.anchor).toBe('end');
        expect(link.x).toBe(footerBox.x + footerBox.w);
        expect(link.size).toBe(plain.lines.at(-1)!.size);
        expect(b.page!.anchor).toBe('end');
        expect(b.page!.x).toBe(Math.round(link.x - textWidth(link.text, link.size, true) - Math.round(fonts.url * 0.6)));
        expect(inside(b.page!, footerBox)).toBe(true);
    });

    it('drops the brand, not the link’s place, when the line holds the brand and the link but not the page text too', () => {
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
        const link = line.find((l) => l.text.includes('county/47'))!;
        expect(link.x).toBe(area.x + area.w);
        expect(link.anchor).toBe('end');
        expect(link.size).toBe(plain.lines.find((l) => l.text.includes('county/47'))!.size);
        expect(span(page)[1]).toBeLessThan(span(link)[0]);
        for (const t of [...line, page]) expect(inside(t, area)).toBe(true);
        expect(b.bottom).toBe(plain.bottom);
    });

    it('decides with the widest page text of the series, so every slide shows the same line', () => {
        const fonts = SPECS.portrait.footer;
        const url = 'https://example.org/county/37';
        const urlW = textWidth('example.org/county/37', fonts.url, true);
        const brandW = textWidth('Kenya Electoral Map', fonts.url, true);
        const gap = Math.round(fonts.url * 0.6);
        // Room for the brand, "1 of 10" and the link, not for "10 of 10".
        const w = Math.ceil(brandW + fonts.url * 1.5 + textWidth('1 of 10', fonts.url) + gap + urlW + 1);
        expect(w).toBeLessThan(brandW + fonts.url * 1.5 + textWidth('10 of 10', fonts.url) + gap + urlW);
        const area = { x: 0, y: 0, w, h: 300 };
        const alone = footerBlock(area, fonts, { ...input, url, page: '1 of 10' });
        expect(alone.lines.some((l) => l.text === 'Kenya Electoral Map')).toBe(true);
        const lines = Array.from({ length: 10 }, (_, i) =>
            footerBlock(area, fonts, { ...input, url, page: `${i + 1} of 10`, pageWidest: '10 of 10' }),
        );
        for (const b of lines) {
            expect(b.lines).toEqual(lines[0].lines);
            expect(b.lines.some((l) => l.text === 'Kenya Electoral Map')).toBe(false);
            expect(b.page!.x).toBe(lines[0].page!.x);
            expect(b.page!.size).toBe(lines[0].page!.size);
        }
    });

    it('shrinks the link only where the page text and the link do not fit, by the same on every slide, and never overlaps', () => {
        const fonts = SPECS.story.footer;
        for (const w of [800, 700, 600, 560]) {
            const area = { x: 10, y: 0, w, h: 400 };
            const plain = footerBlock(area, fonts, { ...input, url: LONG });
            const all = [1, 2, 3, 4].map((i) => footerBlock(area, fonts, { ...input, url: LONG, page: `${i} of 4`, pageWidest: '4 of 4' }));
            for (const b of all) {
                const page = b.page!;
                const line = onLine(b.lines, page);
                const link = line.at(-1)!;
                expect(line.length).toBe(1);
                expect(link.anchor).toBe('end');
                expect(link.x).toBe(area.x + area.w);
                expect(link.size).toBeLessThan(fonts.url);
                expect(page.size).toBe(link.size);
                expect(page.anchor).toBe('end');
                expect(page.x).toBe(Math.round(link.x - textWidth(link.text, link.size, true) - Math.round(fonts.url * 0.6)));
                expect(b.lines).toEqual(all[0].lines);
                expect(page.x).toBe(all[0].page!.x);
                for (const t of line) expect(apart(page, t)).toBe(true);
                for (const t of [...line, page]) expect(inside(t, area)).toBe(true);
                expect(b.bottom).toBe(plain.bottom);
            }
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
    it('draws the page text just before the link, in its text element, also where the brand gives way and where the link shrinks', () => {
        const story = {
            ...props,
            box: cardFrame('story', { source: input.source, asOf: input.asOf }, 'http://localhost:8080/county/47?seat=county_seats').footerBox,
            fonts: SPECS.story.footer,
            url: 'http://localhost:8080/county/47?seat=county_seats',
        };
        const noRoom = mount(CardFooter, { props: { ...story, page: '2 of 4' } });
        expect(noRoom.get('[data-link]').text()).toBe('2 of 4localhost:8080/county/47?seat=county_seats');
        expect(noRoom.get('[data-link]').attributes('text-anchor')).toBe('end');
        expect(noRoom.get('[data-link]').attributes('x')).toBe(String(story.box.x + story.box.w));
        expect(noRoom.get('[data-link]').findAll('tspan')[1].attributes('dx')).toBe(String(Math.round(SPECS.story.footer.url * 0.6)));
        expect(noRoom.findAll('text').some((t) => t.text() === 'Kenya Electoral Map')).toBe(false);
        const url = 'https://example.org/county/47?seat=county_seats';
        // Too narrow for both at full size: the link shrinks, the page text still just before it.
        const narrow = mount(CardFooter, { props: { ...props, box: { x: 0, y: 0, w: 560, h: 300 }, url, page: '3 of 4', pageWidest: '4 of 4' } });
        const link = narrow.get('[data-link]');
        expect(link.text()).toMatch(/^3 of 4example\.org\/county\/47/);
        expect(Number(link.attributes('font-size'))).toBeLessThan(SPECS.portrait.footer.url);
        expect(link.attributes('x')).toBe('560');
        expect(narrow.findAll('[data-page]')).toHaveLength(1);
    });

    it('draws the page text in the muted ink beside the link', () => {
        const w = mount(CardFooter, { props: { ...props, page: '2 of 4' } });
        const page = w.find('[data-page]');
        expect(page.text()).toBe('2 of 4');
        expect(page.attributes('fill')).toBe(THEMES.light.muted);
        // In the link's own text element, just before the link, a gap apart.
        const link = w.get('[data-link]');
        expect(link.element.contains(page.element)).toBe(true);
        expect(link.text()).toBe('2 of 4example.org/county/37');
        expect(link.findAll('tspan')[1].attributes('dx')).toBe(String(Math.round(props.fonts.url * 0.6)));
        expect(page.attributes('font-weight')).toBe('400');
    });
});

describe('every card declares the page text, as one of the uniform props', () => {
    const cards = import.meta.glob<{ default: { props?: Record<string, unknown> } }>(
        '@/components/export/{View,Party,Leaders,Numbers,TopCounties,FiveSeats,Ballots,Tiles,Versus,Cover}Card.vue',
        { eager: true },
    );
    it('finds the cards', () => expect(Object.keys(cards).length).toBeGreaterThanOrEqual(9));
    for (const [path, mod] of Object.entries(cards))
        it(`${path.split('/').pop()} takes \`page\` and \`pageWidest\``, () => {
            expect(Object.keys(mod.default.props ?? {})).toContain('page');
            expect(Object.keys(mod.default.props ?? {})).toContain('pageWidest');
        });
});
