import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ViewCard from '@/components/export/ViewCard.vue';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { headlineFor, snapshotView } from '@/lib/export/viewState';
import {
    type Box,
    HEADLINE_STRETCH,
    SPECS,
    breakHeadline,
    cardFrame,
    footerHeight,
    viewLayout,
} from '@/lib/export/viewLayout';
import { footerBlock, type TextItem } from '@/lib/export/layout';
import { textWidth } from '@/lib/export/text';
import { ATTRIBUTION, CODES_CREDIT, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { MIX_SEATS, mixIndex } from './mixFixtures';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const mca = snapshotView({
    seats: VIEW_SEATS,
    index: viewIndex,
    seat: 'mca',
    focus: null,
    only: ['UDA', 'ODM'],
    showSurroundings: false,
    theme: 'dark',
});
const nairobi = snapshotView({
    seats: VIEW_SEATS,
    index: viewIndex,
    seat: 'mp',
    focus: { level: 'county', code: 47 },
    only: [],
    showSurroundings: true,
    theme: 'light',
});
const props = (over: Record<string, unknown> = {}) => ({
    view: mca,
    size: 'square' as ViewSize,
    headline: headlineFor(mca),
    mapImage: 'data:image/png;base64,AAAA',
    url: 'https://example.org/?seat=mca&parties=uda,odm',
    theme: THEMES.dark,
    ...over,
});

describe('ViewCard', () => {
    it('draws each size with its own viewBox', () => {
        for (const size of SIZES) {
            const svg = mount(ViewCard, { props: props({ size }) }).get('svg');
            const { w, h } = VIEW_SIZES[size];
            expect(svg.attributes('viewBox')).toBe(`0 0 ${w} ${h}`);
            expect(svg.attributes('width')).toBe(String(w));
        }
        expect(VIEW_SIZES).toEqual({
            square: { w: 1080, h: 1080 },
            portrait: { w: 1080, h: 1350 },
            story: { w: 1080, h: 1920 },
            x: { w: 1600, h: 900 },
        });
    });

    it('shows the headline, scope, chart, callouts, source, date and link', () => {
        // Portrait keeps both callouts beside a dozen chart rows (square gives them up for room).
        const wrapper = mount(ViewCard, { props: props({ size: 'portrait' }) });
        const text = wrapper.text();
        expect(
            wrapper
                .findAll('[data-headline]')
                .map((t) => t.text())
                .join(' '),
        ).toBe('MCA seats across Kenya: UDA 523, ODM 312');
        expect(text).toContain('Across Kenya, highlighting UDA and ODM');
        expect(text).toContain('IEBC gazette notices');
        expect(text).toContain('Data as of 16 July 2026');
        expect(text).toContain('example.org/?seat=mca&parties=uda,odm');
        expect(wrapper.findAll('[data-row]')).toHaveLength(12);
        expect(wrapper.get('[data-row="other"]').text()).toContain('183 (13%)');
        expect(wrapper.findAll('[data-callout]')).toHaveLength(2);
        expect(wrapper.get('image[data-map]').attributes('href')).toBe(
            'data:image/png;base64,AAAA',
        );
    });

    it('emphasises the highlighted rows', () => {
        const wrapper = mount(ViewCard, { props: props() });
        const on = wrapper.findAll('[data-row][data-highlighted="true"]');
        expect(on.map((r) => r.attributes('data-row'))).toEqual(['UDA', 'ODM']);
        expect(on[0].get('text').attributes('font-weight')).toBe('700');
        const off = wrapper.get('[data-row="JP"]');
        expect(off.attributes('data-highlighted')).toBe('false');
        expect(off.get('text').attributes('font-weight')).toBe('400');
    });

    it('marks sample data with a watermark only when sample records are shown', () => {
        expect(mount(ViewCard, { props: props() }).text()).not.toContain(
            'SAMPLE DATA',
        );
        expect(
            mount(ViewCard, {
                props: props({ view: { ...mca, sample: true } }),
            }).text(),
        ).toContain('SAMPLE DATA');
    });

    it('keeps every block on the card and apart from the others', () => {
        const inside = (b: Box, w: number, h: number) =>
            b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h;
        const apart = (a: Box, b: Box) =>
            a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y;
        const long =
            'An edited headline that runs on for much longer than the generated one does, to check it wraps and stays clear';
        for (const [view, headline] of [
            [mca, headlineFor(mca)],
            [nairobi, headlineFor(nairobi)],
            [mca, long],
        ] as const)
            for (const size of SIZES) {
                const l = viewLayout(size, view, {
                    headline,
                    url: 'https://example.org/county/47?seat=mp',
                    mapAspect: view.scope ? 1.5 : 0.82,
                });
                const blocks: [string, Box][] = [
                    ['headline', l.headline],
                    ['map', l.map],
                    ['callouts', l.calloutBox],
                    ['chart', l.chartBox],
                    ['footer', l.footerBox],
                ];
                for (const [name, b] of blocks)
                    expect(inside(b, l.w, l.h), `${size} ${name}`).toBe(true);
                for (let i = 0; i < blocks.length; i++)
                    for (let j = i + 1; j < blocks.length; j++)
                        expect(
                            apart(blocks[i][1], blocks[j][1]),
                            `${size}: ${blocks[i][0]} and ${blocks[j][0]}`,
                        ).toBe(true);
                // Every bar ends before its value, and every value stays inside the chart.
                for (const row of l.rows) {
                    expect(row.bar.x + row.bar.w).toBeLessThanOrEqual(
                        row.value.x,
                    );
                    expect(row.label.y).toBeLessThanOrEqual(
                        l.chartBox.y + l.chartBox.h,
                    );
                }
            }
    });
});

describe('breakHeadline', () => {
    it('breaks after the colon and keeps each party with its count', () => {
        expect(
            breakHeadline(
                'MCA seats across Kenya: UDA 523, ODM 312',
                800,
                56,
                2,
            ),
        ).toEqual(['MCA seats across Kenya:', 'UDA 523, ODM 312']);
        expect(
            breakHeadline(
                'MCA seats across Kenya: UDA 523, ODM 312',
                2000,
                56,
                2,
            ),
        ).toEqual(['MCA seats across Kenya: UDA 523, ODM 312']);
    });
});

describe('story safe zones', () => {
    it('keeps every line of text out of the bottom 400 px and right 120 px that TikTok and Reels cover', () => {
        const url =
            'https://kenyaelectoralmap.example/county/47?seat=mp&parties=uda,odm';
        const long =
            'An edited headline that runs on for much longer than the generated one does, to check it wraps and stays clear';
        for (const [view, headline] of [
            [mca, headlineFor(mca)],
            [nairobi, headlineFor(nairobi)],
            [mca, long],
        ] as const) {
            const l = viewLayout('story', view, {
                headline,
                url,
                mapAspect: view.scope ? 1.57 : 0.82,
            });
            const footer = footerBlock(l.footerBox, l.footerFonts, {
                source: view.source,
                asOf: '16 July 2026',
                attribution: ATTRIBUTION,
                url,
            });
            const texts: [TextItem, number][] = [
                ...l.headlineLines.map((t): [TextItem, number] => [
                    t,
                    HEADLINE_STRETCH,
                ]),
                ...[
                    l.scopeLine,
                    ...(l.chartTitle ? [l.chartTitle] : []),
                    ...l.rows.flatMap((r) =>
                        [r.label, r.value].filter(
                            (t): t is TextItem => t !== null,
                        ),
                    ),
                    ...l.callouts.flatMap((c) => [c.label, c.number, c.sub]),
                    ...footer.lines,
                ].map((t): [TextItem, number] => [t, 1]),
            ];
            for (const [t, stretch] of texts) {
                const width =
                    textWidth(t.text, t.size, (t.weight ?? 400) >= 600) *
                    stretch;
                const right = t.anchor === 'end' ? t.x : t.x + width;
                expect(right, t.text).toBeLessThanOrEqual(1080 - 120);
                expect(t.y, t.text).toBeLessThanOrEqual(1920 - 400);
            }
            expect(l.footerBox.y + l.footerBox.h).toBeLessThanOrEqual(1520);
            // With rows (MPs of a county) the map is an inset beside the headline by design.
            if (!view.mix.rows.length) expect(l.map.h).toBeGreaterThan(280);
            else expect(l.mixRows.length).toBe(view.mix.rows.length);
        }
    });
});

describe('credits', () => {
    it('separate their parts with semicolons, never "·"', () => {
        expect(ATTRIBUTION).not.toContain('·');
        expect(ATTRIBUTION).toBe(
            'Boundaries: IEBC 2012 delimitation (via mikelmaron/kenya-election-data); 13 wards: American Red Cross (HDX), CC BY 4.0; Codes: Kenya Gazette Notice 13771 (2026); Towns: © OpenStreetMap contributors',
        );
        expect(CODES_CREDIT).toBe('Codes: Kenya Gazette Notice 13771 (2026)');
        expect(ATTRIBUTION).toContain(CODES_CREDIT);
    });

    it('measure the footer with the full credit unless a card names its own', () => {
        const view = { source: 'Source: IEBC gazette notices.', asOf: '2026-07-16' };
        const fonts = SPECS.square.footer;
        expect(footerHeight(900, fonts, view, 'example.org')).toBe(
            footerHeight(900, fonts, view, 'example.org', ATTRIBUTION),
        );
        expect(
            footerHeight(900, fonts, view, 'example.org', CODES_CREDIT),
        ).toBeLessThan(footerHeight(900, fonts, view, 'example.org'));
        expect(cardFrame('square', view, 'example.org').footerBox).toEqual(
            cardFrame('square', view, 'example.org', ATTRIBUTION).footerBox,
        );
    });
});

describe('chart labels', () => {
    it('keep a one-line shrunk label level with its bar, like the others', () => {
        for (const size of SIZES) {
            const l = viewLayout(size, mca, {
                headline: headlineFor(mca),
                url: 'https://example.org/',
                mapAspect: 0.82,
            });
            for (const row of l.rows) {
                // Rows with the label above the bar (narrow columns) are not level by design.
                if (row.value.anchor === 'end') continue;
                const mid = row.bar.y + row.bar.h / 2;
                // The label's middle (baseline minus about a third of its size) is on the bar's.
                expect(
                    Math.abs(row.label.y - row.label.size * 0.36 - mid),
                ).toBeLessThan(row.label.size * 0.6);
            }
        }
    });
});

describe('a dozen parties', () => {
    it('keeps the map at least a third of the body in every size', () => {
        // The fixture's MCA view has 12 rows: 10 coloured parties, Independent, Other parties.
        expect(mca.rows).toHaveLength(12);
        for (const size of SIZES) {
            const l = viewLayout(size, mca, {
                headline: headlineFor(mca),
                url: 'https://example.org/',
                mapAspect: 0.82,
            });
            const body = l.footerBox.y - (l.scopeLine.y + 10);
            expect(l.map.h, size).toBeGreaterThan(
                size === 'x' ? 500 : body / 3,
            );
            // Rows stay readable.
            for (const row of l.rows)
                expect(row.value.size, size).toBeGreaterThanOrEqual(18);
        }
    });
});

describe('ViewCard seat mix', () => {
    const mixSeats = withIndependentColour(MIX_SEATS, THEMES.dark.independent);
    const nairobiMca = snapshotView({
        seats: mixSeats,
        index: mixIndex,
        seat: 'mca',
        focus: { level: 'county', code: 47 },
        only: [],
        showSurroundings: false,
        theme: 'dark',
    });
    const card = (size: ViewSize) =>
        mount(ViewCard, {
            props: props({
                view: nairobiMca,
                size,
                headline: headlineFor(nairobiMca),
                mapAspect: 1.5,
            }),
        });

    it('draws the mix bar in the legend order, with shares inside the parts that fit', () => {
        const w = card('story');
        const parts = w.findAll('[data-mix-segment]');
        expect(parts.map((p) => p.attributes('data-mix-segment'))).toEqual(
            nairobiMca.mix.segments.map((s) => s.key),
        );
        expect(parts[0].text()).toBe('47%');
        expect(w.text()).toContain('of which');
        expect(w.text()).toContain('KANU 2');
    });

    it('lists the first constituencies plus "and N more", the most of them on a story', () => {
        // The map grew and the leaders strip joined the card (owner, 2026-11-27): the room came
        // from the rows, so 17 constituencies no longer all fit, even on a story.
        const rows = (size: ViewSize) =>
            card(size).findAll('[data-mix-row]').length;
        expect(rows('story')).toBeGreaterThanOrEqual(13);
        expect(rows('story')).toBeGreaterThanOrEqual(rows('square'));
        for (const size of ['story', 'square'] as const) {
            const w = card(size);
            const shown = w.findAll('[data-mix-row]').length;
            expect(shown).toBeLessThan(17);
            expect(w.text()).toContain(`and ${17 - shown} more constituencies`);
            expect(w.findAll('[data-mix-row]')[0].text()).toContain(
                'Constituency 274',
            );
        }
    });

    it('draws the leaders strip of an MCA county card: Governor, Senator and Woman Rep, above the mix', () => {
        const w = card('portrait');
        const strip = w.get('[data-leaders]');
        expect(
            strip.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['governor', 'senator', 'woman_rep']);
        expect(strip.get('[data-leader="governor"]').text()).toContain(
            'Placeholder governor 47',
        );
        expect(strip.get('[data-leader="governor"]').text()).toContain('UDA');
        // The fixture has no Senator or Woman Rep: their rows say so, and nothing is invented.
        expect(strip.get('[data-leader="senator"]').text()).toContain(
            'No approved data yet',
        );
        // A national card, or one for another seat, has no strip.
        expect(mount(ViewCard, { props: props() }).find('[data-leaders]').exists()).toBe(
            false,
        );
    });
});
