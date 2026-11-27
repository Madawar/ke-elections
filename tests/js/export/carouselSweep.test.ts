// The county carousel over the real unit index: every county's cover in portrait and story, and
// every county's four slides laid out in both sizes with their page text ("2 of 4") on the link's
// line, with a local and a long site address. Nothing cut, nothing overlapping, nothing past the
// footer, the story's covered zones kept, the footer no taller for the page text, and the slides
// starting their words at the same place so the carousel does not jump. Holders are placeholders.
import { describe, expect, it } from 'vitest';
import { coverHeadline } from '@/lib/export/coverCard';
import type { CoverLayout } from '@/lib/export/coverLayout';
import { type Box, type FooterFonts } from '@/lib/export/layout';
import { aspectOf, carouselCard, headlineOf, layoutOf } from '@/lib/export/shareView';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { coverFaults, pageFaults } from './coverChecks';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const SIZES = ['portrait', 'story'] as const;
const ORIGINS = ['http://localhost:8080', 'https://kenya-electoral-map.example.org'];
const counties = index.all().filter((u) => u.l === 'county');

describe('the county carousel, every county', () => {
    for (const theme of ['light', 'dark'] as const)
        it(`lays out every cover and every slide’s page text (${theme})`, () => {
            const seats = withIndependentColour(NUMBERS_SEATS, THEMES[theme].independent);
            const faults: string[] = [];
            let checked = 0;
            for (const c of counties) {
                const card = carouselCard({ seats, index, county: c.c, theme })!;
                const slides = card.slides!;
                expect(slides).toHaveLength(4);
                for (const size of SIZES)
                    for (const origin of ORIGINS) {
                        const tops: number[] = [];
                        const lefts: number[] = [];
                        slides.forEach((slide, i) => {
                            const url = `${origin}${slide.path}`;
                            const headline = headlineOf(slide);
                            const l = layoutOf(size, slide, { headline, url, mapAspect: aspectOf(slide) }) as {
                                headline: Box;
                                footerBox: Box;
                                footerFonts: FooterFonts;
                            };
                            const tag = `${c.c} ${c.n} ${size} ${origin} slide ${i + 1}`;
                            if (i === 0) {
                                const cl = l as unknown as CoverLayout;
                                faults.push(...coverFaults(cl, size, slide as never, coverHeadline(slide as never), url).map((f) => `${tag}: ${f}`));
                                tops.push(Math.round(cl.kicker.y - cl.kicker.size * 0.9));
                                lefts.push(cl.kicker.x);
                            } else {
                                tops.push(l.headline.y);
                                lefts.push(l.headline.x);
                            }
                            faults.push(
                                ...pageFaults(l.footerBox, l.footerFonts, { source: slide.source, asOf: '16 July 2026', url, attribution: ATTRIBUTION }, `${i + 1} of 4`, size).map(
                                    (f) => `${tag}: ${f}`,
                                ),
                            );
                            checked++;
                        });
                        // Every slide's words start at the same top (to the pixel the baseline rounds to) and left:
                        // swiping does not jump.
                        if (Math.max(...tops) - Math.min(...tops) > 1 || new Set(lefts).size !== 1)
                            faults.push(`${c.c} ${size}: slides start at ${tops.join('/')} and ${lefts.join('/')}`);
                    }
            }
            expect(checked).toBe(47 * 2 * 2 * 4);
            expect(faults.slice(0, 40)).toEqual([]);
        });
});
