// A series has one link, and its footer is the same on every slide: every slide of the county
// carousel is given the series' link (the cover's, `/county/<code>`) and measured with the series'
// widest page text, so within one series every slide shows the brand or none does, the link is at
// one size, and the page text and the link stand at the same x on every slide. With a local and a
// production-length address the brand is kept wherever the stand-alone seat-view card keeps it.
// Every county, portrait and story, three hosts. Holders are placeholders.
import { describe, expect, it } from 'vitest';
import { type Box, type FooterFonts, footerBlock } from '@/lib/export/layout';
import {
    aspectOf,
    carouselCard,
    headlineOf,
    layoutOf,
    slidePlace,
    widestPlace,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { snapshotView } from '@/lib/export/viewState';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const SIZES = ['portrait', 'story'] as const;
const LONG_HOST = 'kenyas-electoral-map-27.elections.example.org';
const HOSTS = ['http://localhost:8080', 'https://kenya-electoral-map.example.org', `https://${LONG_HOST}`];
const BRAND = 'Kenya Electoral Map';
const seats = withIndependentColour(NUMBERS_SEATS, THEMES.light.independent);
const counties = index.all().filter((u) => u.l === 'county');

const footerOf = (
    size: (typeof SIZES)[number],
    view: Parameters<typeof layoutOf>[1],
    url: string,
    page?: { text: string; widest: string },
) => {
    const l = layoutOf(size, view, { headline: headlineOf(view), url, mapAspect: aspectOf(view) }) as {
        footerBox: Box;
        footerFonts: FooterFonts;
    };
    const b = footerBlock(l.footerBox, l.footerFonts, {
        source: view.source,
        asOf: '16 July 2026',
        attribution: ATTRIBUTION,
        url,
        page: page?.text,
        pageWidest: page?.widest,
    });
    const link = b.lines.at(-1)!;
    return {
        brand: b.lines.some((t) => t.text === BRAND),
        link: { text: link.text, size: link.size, x: link.x, anchor: link.anchor },
        page: b.page ? { x: b.page.x, size: b.page.size, anchor: b.page.anchor } : null,
        right: l.footerBox.x + l.footerBox.w,
    };
};

describe('a series’ footer: one link, the same on every slide', () => {
    it('the widest page text of four is "4 of 4"', () => {
        expect(widestPlace(4)).toBe('4 of 4');
        const ten = widestPlace(10);
        for (let i = 0; i < 10; i++)
            expect(textWidth(slidePlace(i, 10), 10)).toBeLessThanOrEqual(textWidth(ten, 10));
    });

    it('uses a 45-character host for the long case', () => expect(LONG_HOST).toHaveLength(45));

    it('every county, both sizes, three hosts: each slide’s footer shows the same, at the same places', () => {
        const faults: string[] = [];
        let series = 0;
        for (const c of counties) {
            const card = carouselCard({ seats, index, county: c.c, theme: 'light' })!;
            const slides = card.slides!;
            const widest = widestPlace(slides.length);
            for (const size of SIZES)
                for (const [h, host] of HOSTS.entries()) {
                    const url = `${host}${slides[0].path}`;
                    const feet = slides.map((s, i) => footerOf(size, s, url, { text: slidePlace(i, slides.length), widest }));
                    const tag = `${c.c} ${c.n} ${size} ${host}`;
                    const first = JSON.stringify({ ...feet[0] });
                    feet.forEach((f, i) => {
                        if (JSON.stringify(f) !== first) faults.push(`${tag}: slide ${i + 1} ${JSON.stringify(f)} differs from ${first}`);
                        if (f.link.anchor !== 'end' || f.link.x !== f.right) faults.push(`${tag}: slide ${i + 1} link not at the right edge`);
                        if (!f.page || f.page.anchor !== 'end' || f.page.size !== f.link.size) faults.push(`${tag}: slide ${i + 1} page text not beside the link`);
                        if (f.link.text !== url.replace(/^https?:\/\//, '')) faults.push(`${tag}: slide ${i + 1} link ${f.link.text}`);
                    });
                    // Where the stand-alone seat-view card keeps its brand, so does the series.
                    if (h < 2)
                        for (const seat of ['mp', 'mca'] as const) {
                            const alone = snapshotView({ seats, index, seat, focus: { level: 'county', code: c.c }, only: [], theme: 'light' });
                            const own = footerOf(size, alone, `${host}${alone.path}`);
                            if (own.brand && !feet[0].brand) faults.push(`${tag}: the ${seat} card keeps the brand, the series does not`);
                        }
                    series++;
                }
        }
        expect(series).toBe(47 * 2 * 3);
        expect(faults.slice(0, 30)).toEqual([]);
    });
});
