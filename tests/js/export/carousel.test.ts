// The county carousel (Task H2): the cover's layout and component, the four slides (their kinds,
// order and sizes), and slides 2 to 4 being byte for byte the cards they are outside the series
// (made by the same functions the page uses), apart from the link line of their footers (in a
// series every slide has the series' link and its page text).
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CoverCard from '@/components/export/CoverCard.vue';
import { coverCardView, coverHeadline, coverScope } from '@/lib/export/coverCard';
import { coverLayout } from '@/lib/export/coverLayout';
import { leadersCardView } from '@/lib/export/leadersCard';
import {
    type ShareableView,
    aspectOf,
    carouselCard,
    componentOf,
    headlineOf,
    layoutOf,
    sizesOf,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { snapshotView } from '@/lib/export/viewState';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { coverFaults } from './coverChecks';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const SIZES = ['portrait', 'story'] as const;
const URL = 'https://example.org/county/37';
const seats = withIndependentColour(NUMBERS_SEATS, THEMES.light.independent);
const cover = (code = 37) => coverCardView({ seats, index, county: code, theme: 'light' })!;
const layout = (code: number, size: (typeof SIZES)[number]) => {
    const c = cover(code);
    return coverLayout(size, c, { headline: coverHeadline(c), url: URL, mapAspect: aspectOf(c) });
};
const byName = (name: string) => index.all().find((u) => u.l === 'county' && u.n === name)!.c;

describe('coverLayout', () => {
    it('lays out Kakamega whole, apart and inside, in both sizes', () => {
        for (const size of SIZES) {
            const c = cover(37);
            expect(coverFaults(layout(37, size), size, c, coverHeadline(c), URL), size).toEqual([]);
        }
    });

    it('puts the county’s name above the headline, in sentence case, smaller and muted', () => {
        for (const size of SIZES) {
            const l = layout(37, size);
            expect(l.kicker.text).toBe('Kakamega County');
            expect(l.kicker.tone).toBe('muted');
            expect(l.kicker.size).toBeLessThan(l.headlineLines[0].size / 1.8);
            expect(l.kicker.y).toBeLessThan(l.headlineLines[0].y - l.headlineLines[0].size * 0.8);
        }
    });

    it('holds the longest names whole in the headline: shrinks, then wraps, never cuts', () => {
        for (const name of ['Elgeyo/Marakwet', 'Tharaka - Nithi', 'Taita Taveta', 'Homa Bay', 'Nyandarua', 'Nairobi City'])
            for (const size of SIZES) {
                const code = byName(name);
                const c = cover(code);
                const l = layout(code, size);
                expect(coverFaults(l, size, c, coverHeadline(c), URL), `${name} ${size}`).toEqual([]);
                expect(l.headlineLines.map((t) => t.text).join(' ')).toContain(`${name}’s`.split(' ').at(-1));
                for (const t of l.headlineLines)
                    expect(textWidth(t.text, t.size, true) * HEADLINE_STRETCH).toBeLessThanOrEqual(l.footerBox.w + 0.5);
            }
    });

    it('wraps the scope line rather than cut it where one line is too narrow', () => {
        const l = layout(37, 'story');
        expect(l.scopeLines.map((t) => t.text).join(' ')).toBe(
            '1 governor, 1 senator, 1 woman rep, 12 MPs and 60 MCAs. Swipe for each.',
        );
        for (const t of l.scopeLines) expect(textWidth(t.text, t.size)).toBeLessThanOrEqual(l.footerBox.w + 0.5);
    });

    it('keeps "Swipe for each." together, breaking before "Swipe" where the line cannot hold it (Nairobi City, story)', () => {
        const l = layout(47, 'story');
        const lines = l.scopeLines.map((t) => t.text);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join(' ')).toBe(coverScope(cover(47)));
        expect(lines.some((t) => t.includes('Swipe for each.'))).toBe(true);
        for (const t of lines) expect(t).not.toMatch(/Swipe$/);
        expect(lines.at(-1)).toBe('Swipe for each.');
        // Every county and size: never split.
        for (const c of index.all().filter((u) => u.l === 'county'))
            for (const size of SIZES)
                expect(layout(c.c, size).scopeLines.some((t) => t.text.includes('Swipe for each.')), `${c.n} ${size}`).toBe(true);
    });

    it('draws the map with the county’s shape, as large as the room allows, the note under it', () => {
        for (const size of SIZES) {
            const c = cover(37);
            const l = layout(37, size);
            expect(Math.abs(l.map.w / l.map.h - aspectOf(c))).toBeLessThan(0.02);
            expect(l.note.text).toBe('Wards coloured by the MCA’s party');
            expect(l.note.y).toBeGreaterThan(l.map.y + l.map.h);
            // Kakamega is taller than wide: the map takes most of the card's height.
            expect(l.map.h).toBeGreaterThan(l.h * (size === 'story' ? 0.35 : 0.5));
        }
    });

    it('is what the share dialog lays out for the cover', () => {
        const c = cover(37);
        const text = { headline: coverHeadline(c), url: URL, mapAspect: aspectOf(c) };
        expect(layoutOf('portrait', c, text)).toEqual(coverLayout('portrait', c, text));
        expect(componentOf(c)).toBe(CoverCard);
    });
});

describe('CoverCard', () => {
    const props = (page?: string) => {
        const c = cover(37);
        return {
            view: c,
            size: 'portrait' as const,
            headline: coverHeadline(c),
            mapImage: 'data:image/png;base64,MAP',
            mapImages: { map: 'data:image/png;base64,MAP' },
            mapPlaceholder: 'Drawing the map…',
            mapAspect: aspectOf(c),
            url: URL,
            theme: THEMES.light,
            page,
        };
    };
    it('draws what the layout returns, with the map, the full attribution and the page text', () => {
        const w = mount(CoverCard, { props: props('1 of 4') });
        const l = coverLayout('portrait', cover(37), { headline: props().headline, url: URL, mapAspect: props().mapAspect });
        expect(w.find('[data-kicker]').text()).toBe('Kakamega County');
        expect(w.findAll('[data-headline]').map((t) => t.text())).toEqual(l.headlineLines.map((t) => t.text));
        expect(w.findAll('[data-scope]').map((t) => t.text())).toEqual(l.scopeLines.map((t) => t.text));
        expect(w.find('[data-note]').text()).toBe('Wards coloured by the MCA’s party');
        expect(w.find('image[data-map]').attributes('width')).toBe(String(l.map.w));
        expect(w.find('[data-footer]').text()).toContain(ATTRIBUTION.slice(0, 30));
        expect(w.find('[data-page]').text()).toBe('1 of 4');
        // No key on the cover, and no ALL-CAPS line.
        expect(w.find('[data-key]').exists()).toBe(false);
        for (const t of w.findAll('text')) expect(t.text()).not.toMatch(/^[A-Z\s]{6,}$/);
    });
});

describe('carouselCard', () => {
    const settings = { showSurroundings: true, mpOutlines: true };
    const card = carouselCard({ seats, index, county: 37, theme: 'light', ...settings })!;
    const slides = card.slides!;

    it('is four slides: the cover, the county’s leaders, the county on MP, the county on MCA', () => {
        expect(card.key).toBe('carousel');
        expect(card.label).toBe('Carousel');
        expect(card.view).toBe(slides[0]);
        expect(slides.map((s) => s.kind)).toEqual(['cover', 'leaders', 'party', 'party']);
        expect(slides.map((s) => ('seat' in s ? s.seat : null))).toEqual(['mca', 'mca', 'mp', 'mca']);
        expect(slides.map((s) => s.path)).toEqual([
            '/county/37',
            '/county/37?seat=county_seats',
            '/county/37?seat=mp',
            '/county/37?seat=mca',
        ]);
        expect(headlineOf(slides[0])).toBe('Who holds Kakamega’s 75 elected seats');
    });

    it('comes in the sizes every slide has: portrait and story', () => {
        const all = sizesOf(slides[0]).filter((s) => slides.every((v) => sizesOf(v).includes(s)));
        expect(all).toEqual(['portrait', 'story']);
    });

    it('makes slides 2 to 4 with the page’s own functions: the same views as outside the series', () => {
        const focus = { level: 'county' as const, code: 37 };
        expect(slides[1]).toEqual(leadersCardView({ seats, index, focus, theme: 'light' }));
        for (const [i, seat] of [[2, 'mp'], [3, 'mca']] as const)
            expect(slides[i]).toEqual(
                snapshotView({ seats, index, seat, focus, only: [], theme: 'light', ...settings }),
            );
    });

    it('is null for a code that is not a county', () => {
        expect(carouselCard({ seats, index, county: 99, theme: 'light' })).toBeNull();
    });

    // What a card draws, as markup with the footer's link line (brand, page text, link) taken out.
    const drawn = (view: ShareableView, size: 'portrait' | 'story', url: string, page?: string) => {
        const w = mount(componentOf(view), {
            props: {
                view,
                size,
                headline: headlineOf(view),
                mapImage: 'data:image/png;base64,MAP',
                mapImages: { map: 'data:image/png;base64,MAP' },
                mapPlaceholder: 'Drawing the map…',
                mapAspect: aspectOf(view),
                url,
                theme: THEMES.light,
                page,
                pageWidest: page ? '4 of 4' : undefined,
            },
        });
        const page$ = w.find('[data-page]');
        const pageText = page$.exists() ? page$.text() : null;
        const footer = w.get('[data-footer]').element;
        const texts = [...footer.querySelectorAll('text')];
        const linkLine = texts.at(-1)!;
        const link = linkLine.lastChild!.textContent;
        for (const t of texts)
            if (t === linkLine || t.textContent === 'Kenya Electoral Map') t.remove();
        return { html: w.html(), texts: w.findAll('text').map((t) => t.text()), pageText, link };
    };

    it('draws slides 2 to 4 exactly as outside the series, apart from the footer’s link and page text', () => {
        const focus = { level: 'county' as const, code: 37 };
        const outside: ShareableView[] = [
            leadersCardView({ seats, index, focus, theme: 'light' })!,
            snapshotView({ seats, index, seat: 'mp', focus, only: [], theme: 'light', ...settings }),
            snapshotView({ seats, index, seat: 'mca', focus, only: [], theme: 'light', ...settings }),
        ];
        const series = `https://example.org${slides[0].path}`;
        for (const size of SIZES)
            for (let i = 1; i < 4; i++) {
                const own = `https://example.org${outside[i - 1].path}`;
                const inside = drawn(slides[i], size, series, `${i + 1} of 4`);
                const alone = drawn(outside[i - 1], size, own);
                expect(inside.pageText).toBe(`${i + 1} of 4`);
                expect(alone.pageText).toBeNull();
                // The series' link inside, the card's own outside.
                expect(inside.link).toBe('example.org/county/37');
                expect(alone.link).toBe(own.replace('https://', ''));
                expect(inside.texts, `${size} slide ${i + 1}`).toEqual(alone.texts);
                expect(inside.html, `${size} slide ${i + 1}`).toBe(alone.html);
                const at = (url: string) => layoutOf(size, slides[i], { headline: headlineOf(slides[i]), url, mapAspect: aspectOf(slides[i]) });
                expect(at(series)).toEqual(layoutOf(size, outside[i - 1], { headline: headlineOf(slides[i]), url: own, mapAspect: aspectOf(slides[i]) }));
            }
    });
});
