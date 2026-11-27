import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TopCountiesCard from '@/components/export/TopCountiesCard.vue';
import { topCountiesCaption, xLength } from '@/lib/export/caption';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import {
    type TopCountiesCardView,
    countyShade,
    topCountiesCardView,
    topCountiesColouring,
    topCountiesHeadline,
    topCountiesNote,
    topCountiesScope,
} from '@/lib/export/topCountiesCard';
import {
    type TopCountiesLayout,
    topCountiesLayout,
} from '@/lib/export/topCountiesLayout';
import {
    dialogCopy,
    filenameOf,
    headlineEditable,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { viewColouring } from '@/lib/export/viewMap';
import { buildLegend } from '@/lib/legend';
import { SEAT_LEVEL } from '@/lib/map/colouring';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import {
    type SeatsData,
    legendScope,
    seatLegend,
    withIndependentColour,
} from '@/lib/seats';
import { NUMBERS_SEATS } from './numbersFixtures';
import { index, placed } from './topCountiesFixtures';

const SIZES = ['square', 'story'] as const;
const URL = 'https://example.org/?seat=mca&parties=ind';
const dark = (data: SeatsData) =>
    withIndependentColour(data, THEMES.dark.independent);
const view = (
    data: SeatsData,
    seat: 'mp' | 'mca' = 'mca',
    group = 'IND',
    theme: 'dark' | 'light' = 'dark',
) =>
    topCountiesCardView({
        seats: withIndependentColour(data, THEMES[theme].independent),
        index,
        seat,
        group,
        theme,
    });

/** Eleven counties for independents (by IEBC county code), the tenth and eleventh tied on 4. */
const ELEVEN: Record<number, number> = {
    15: 9,
    8: 8,
    44: 8,
    32: 7,
    12: 5,
    17: 5,
    21: 5,
    3: 4,
    19: 4,
    36: 4,
    40: 4,
};
const eleven = view(placed('mca', 'IND', ELEVEN));
const countyName = (code: number) => index.get('county', code)!.n;

describe('topCountiesCardView', () => {
    it('ranks the counties by the group’s seats, the most first, ties by IEBC county code, ten at most', () => {
        expect(eleven.rows.map((r) => [r.rank, r.code, r.count])).toEqual([
            [1, 15, 9],
            [2, 8, 8],
            [3, 44, 8],
            [4, 32, 7],
            [5, 12, 5],
            [6, 17, 5],
            [7, 21, 5],
            [8, 3, 4],
            [9, 19, 4],
            [10, 36, 4],
        ]);
        expect(eleven.rows.map((r) => r.name)).toEqual(
            eleven.rows.map((r) => countyName(r.code)),
        );
        expect(eleven.counties).toBe(11);
    });

    it('counts each county as the legend does for that county', () => {
        const data = dark(placed('mca', 'IND', ELEVEN));
        for (const r of eleven.rows) {
            const scope = legendScope(index, 'mca', {
                level: 'county',
                code: r.code,
            })!;
            const legend = buildLegend(
                data,
                'mca',
                { codes: scope.codes, unitName: scope.unit.n },
                [],
            );
            expect(r.count).toBe(
                legend.rows.find((l) => l.key === 'IND')?.count,
            );
            expect(r.total).toBe(scope.codes.size);
            expect(r.of).toBe(`of ${scope.codes.size} wards`);
        }
        expect(eleven.held).toBe(
            seatLegend(data, 'mca').find((l) => l.abbrev === 'IND')!.seats,
        );
        expect(eleven.held).toBe(63);
        expect(eleven.seats).toBe(1450);
    });

    it('says when the tenth place is tied with counties left out, and that ties go by county code', () => {
        expect(eleven.tiedOut).toBe(1);
        expect(topCountiesNote(eleven)).toBe(
            'One more county also has 4. Ties are listed by IEBC county code.',
        );
        const thirteen = view(
            placed('mca', 'IND', { ...ELEVEN, 1: 4, 2: 4 }),
        );
        expect(thirteen.rows.map((r) => r.code).slice(-3)).toEqual([1, 2, 3]);
        expect(thirteen.tiedOut).toBe(3);
        expect(topCountiesNote(thirteen)).toBe(
            '3 more counties also have 4. Ties are listed by IEBC county code.',
        );
        // A tie inside the list decides an order: said, with no "more".
        const inside = view(placed('mca', 'IND', { 15: 3, 8: 3, 1: 1 }));
        expect(inside.tiedOut).toBe(0);
        expect(topCountiesNote(inside)).toBe(
            'Ties are listed by IEBC county code.',
        );
        // No tie at all: no note.
        const none = view(placed('mca', 'IND', { 15: 3, 8: 2, 1: 1 }));
        expect(none.tieDecided).toBe(false);
        expect(topCountiesNote(none)).toBe('');
    });

    it('writes the fixed headline and the scope from the template, for independents and for a party', () => {
        expect(topCountiesHeadline(eleven)).toBe(
            'Where independents hold the most MCA seats',
        );
        expect(topCountiesScope(eleven)).toEqual({
            lead: '63 of 1,450 MCAs nationally are independents.',
            list: 'The 10 counties with the most:',
        });
        const uda = view(NUMBERS_SEATS, 'mp', 'UDA');
        expect(topCountiesHeadline(uda)).toBe(
            'Where UDA holds the most MP seats',
        );
        expect(topCountiesScope(uda).lead).toBe(
            '123 of 290 MPs nationally are UDA.',
        );
        expect(uda.rows[0].of).toMatch(/^of \d+ constituenc(y|ies)$/);
    });

    it('lists fewer than ten when fewer counties have any, and says so', () => {
        const three = view(placed('mca', 'IND', { 15: 3, 8: 2, 1: 1 }));
        expect(three.rows).toHaveLength(3);
        expect(topCountiesScope(three).list).toBe(
            'The 3 counties with any:',
        );
        const one = view(placed('mca', 'IND', { 15: 2 }));
        expect(topCountiesScope(one)).toEqual({
            lead: '2 of 1,450 MCAs nationally are independents.',
            list: 'The one county with any:',
        });
    });

    it('lists nothing, and says so, when no county has any: nothing is invented', () => {
        const nobody = view(placed('mca', 'IND', {}));
        expect(nobody.rows).toEqual([]);
        expect(nobody.held).toBe(0);
        expect(topCountiesScope(nobody)).toEqual({
            lead: '0 of 1,450 MCAs nationally are independents.',
            list: 'No county has any.',
        });
        expect(topCountiesNote(nobody)).toBe('');
        expect([...topCountiesColouring(nobody, THEMES.dark).colours]).toEqual(
            [],
        );
    });

    it('draws its bars in the group’s data colour, as the legend does', () => {
        expect(eleven.colour).toBe(THEMES.dark.independent);
        expect(view(placed('mca', 'IND', ELEVEN), 'mca', 'IND', 'light').colour).toBe(
            THEMES.light.independent,
        );
        const uda = view(NUMBERS_SEATS, 'mp', 'UDA');
        expect(uda.colour).toBe(
            seatLegend(dark(NUMBERS_SEATS), 'mp').find((l) => l.abbrev === 'UDA')!
                .colour,
        );
    });

    it('gives its sources (the group’s holders of the seat), the date and the existing deep link', () => {
        expect(eleven.sources).toEqual(['IEBC gazette notices']);
        expect(eleven.asOf).toBe('2026-07-16');
        expect(eleven.path).toBe('/?seat=mca&parties=ind');
        expect(view(NUMBERS_SEATS, 'mp', 'UDA').path).toBe(
            '/?seat=mp&parties=uda',
        );
        expect(eleven.sample).toBe(false);
    });
});

describe('the top-10 map', () => {
    it('shades the listed counties, by code, on a neutral count scale, the rest in the no-data colour', () => {
        for (const theme of [THEMES.light, THEMES.dark]) {
            const c = topCountiesColouring(eleven, theme);
            expect([...c.colours.keys()]).toEqual(
                eleven.rows.map((r) => r.code),
            );
            expect(c.fallback).toBe(theme.noData);
            // The county fills are what is coloured: the spec's seat is held at the county.
            expect(c.mode).toEqual({ kind: 'seat', seat: 'governor' });
            expect(SEAT_LEVEL.governor).toBe('county');
            // More seats, a stronger shade; equal counts, the same shade.
            expect(c.colours.get(15)).toBe(countyShade(9, 4, 9, theme));
            expect(c.colours.get(8)).toBe(c.colours.get(44));
            expect(c.colours.get(36)).toBe(countyShade(4, 4, 9, theme));
            expect(c.colours.get(15)).not.toBe(c.colours.get(36));
            // Never the group's colour: the shade is a count, not a party.
            for (const colour of c.colours.values()) {
                expect(colour).not.toBe(eleven.colour);
                expect(colour).not.toBe(theme.noData);
            }
        }
    });

    it('is the one map slot, of all of Kenya, coloured as above', () => {
        const text = { headline: topCountiesHeadline(eleven), url: URL, mapAspect: 0.82 };
        for (const size of SIZES) {
            const slots = mapSlotsOf(size, eleven, text);
            expect(slots.map((s) => s.key)).toEqual(['map']);
            const l = layoutOf(size, eleven, text) as TopCountiesLayout;
            expect(slots[0].box).toEqual(l.map);
            const spec = slots[0].spec;
            expect(spec.focus).toBeNull();
            expect(spec.only).toEqual([]);
            expect(SEAT_LEVEL[spec.seat]).toBe('county');
            expect(viewColouring(spec, NUMBERS_SEATS, THEMES.dark)).toEqual(
                topCountiesColouring(eleven, THEMES.dark),
            );
        }
    });
});

const inside = (b: Box, w: number, h: number) =>
    b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x + 0.5 ||
    b.x + b.w <= a.x + 0.5 ||
    a.y + a.h <= b.y + 0.5 ||
    b.y + b.h <= a.y + 0.5;
const textBox = (t: TextItem, stretch = 1): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600) * stretch;
    return {
        x: t.anchor === 'end' ? t.x - w : t.x,
        y: t.y - t.size * 0.8,
        w,
        h: t.size,
    };
};
const texts = (l: TopCountiesLayout): TextItem[] => [
    l.scopeLine,
    ...(l.lead ? [l.lead] : []),
    ...l.rows.flatMap((r) => [r.rank, ...r.name, r.count, r.of]),
    ...l.note,
    l.mapCaption,
    ...l.key.map((k) => k.label),
];
const layout = (c: TopCountiesCardView, size: (typeof SIZES)[number]) =>
    topCountiesLayout(size, c, {
        headline: topCountiesHeadline(c),
        url: URL,
    });
/** The ten counties with the longest names, all listed, with a tie at the cut. */
const longNames = (() => {
    const counties = index
        .all()
        .filter((u) => u.l === 'county')
        .sort((a, b) => textWidth(b.n, 10, true) - textWidth(a.n, 10, true));
    const counts: Record<number, number> = {};
    counties.slice(0, 11).forEach((c, i) => (counts[c.c] = 12 - Math.min(i, 10)));
    return view(placed('mca', 'IND', counts));
})();
const CASES = {
    eleven,
    longNames,
    party: view(NUMBERS_SEATS, 'mp', 'UDA'),
    three: view(placed('mca', 'IND', { 15: 3, 8: 2, 1: 1 })),
    nobody: view(placed('mca', 'IND', {})),
};

describe('topCountiesLayout', () => {
    it('lists the rows in rank order, with each bar on one scale from zero', () => {
        for (const size of SIZES) {
            const l = layout(eleven, size);
            expect(l.rows.map((r) => r.code)).toEqual(
                eleven.rows.map((r) => r.code),
            );
            expect(l.rows.map((r) => r.rank.text)).toEqual(
                eleven.rows.map((r) => String(r.rank)),
            );
            expect(l.rows.map((r) => r.count.text)).toEqual(
                eleven.rows.map((r) => String(r.count)),
            );
            expect(l.rows.map((r) => r.of.text)).toEqual(
                eleven.rows.map((r) => r.of),
            );
            const x0 = l.rows[0].bar.x;
            const perSeat = l.rows[0].bar.w / eleven.rows[0].count;
            for (const [i, r] of l.rows.entries()) {
                expect(r.bar.x).toBe(x0);
                expect(r.bar.colour).toBe(eleven.colour);
                expect(
                    Math.abs(r.bar.w - perSeat * eleven.rows[i].count),
                ).toBeLessThanOrEqual(1);
            }
        }
    });

    it('keeps everything on the card, apart, and whole, in both sizes', () => {
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                const where = `${name} ${size}`;
                const items = texts(l).map((t) => [t.text, textBox(t)] as const);
                const boxes: (readonly [string, Box])[] = [
                    ...items,
                    ...l.rows.map((r) => [`bar ${r.code}`, r.bar] as const),
                    ['map', l.map],
                    ...l.key.map((k, i) => [`swatch ${i}`, k.swatch] as const),
                    ['footer', l.footerBox],
                    ...l.headlineLines.map(
                        (t) => [t.text, textBox(t, HEADLINE_STRETCH)] as const,
                    ),
                ];
                for (const [text, b] of boxes) {
                    expect(text, where).not.toContain('…');
                    expect(inside(b, l.w, l.h), `${where} "${text}"`).toBe(true);
                }
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(
                            apart(boxes[i][1], boxes[j][1]),
                            `${where}: "${boxes[i][0]}" and "${boxes[j][0]}"`,
                        ).toBe(true);
                expect(l.headlineLines.map((t) => t.text).join(' ')).toBe(
                    topCountiesHeadline(c),
                );
                // No word left alone on the headline's last line.
                if (l.headlineLines.length > 1)
                    expect(l.headlineLines.at(-1)!.text, where).toContain(' ');
                // Names whole, as the data spells them.
                expect(l.rows.map((r) => r.name.map((t) => t.text).join(' '))).toEqual(
                    c.rows.map((r) => r.name),
                );
                // The scope and the list's lead, whole.
                const scope = topCountiesScope(c);
                expect(
                    [l.scopeLine.text, l.lead?.text].filter(Boolean).join(' '),
                    where,
                ).toBe(`${scope.lead} ${scope.list}`);
                expect(l.note.map((t) => t.text).join(' ')).toBe(
                    topCountiesNote(c),
                );
            }
    });

    it('gives the map room to be read: about a third of the card’s width at least', () => {
        for (const size of SIZES) {
            const l = layout(eleven, size);
            expect(l.map.w * l.map.h, size).toBeGreaterThan(260 * 300);
            expect(l.mapCaption.text).toBe('The 10 counties shaded');
        }
        expect(layout(CASES.three, 'square').mapCaption.text).toBe(
            'The 3 counties shaded',
        );
        expect(layout(view(placed('mca', 'IND', { 15: 2 })), 'square').mapCaption.text).toBe(
            'The one county shaded',
        );
        expect(layout(CASES.nobody, 'square').mapCaption.text).toBe(
            'No county shaded',
        );
    });

    it('keys the shade with the lowest and highest counts it shows, in their shades', () => {
        const l = layout(eleven, 'square');
        expect(l.key.map((k) => k.label.text)).toEqual(['4 seats', '9 seats']);
        expect(l.key.map((k) => k.swatch.colour)).toEqual([
            countyShade(4, 4, 9, THEMES.dark),
            countyShade(9, 4, 9, THEMES.dark),
        ]);
        expect(layout(view(placed('mca', 'IND', { 15: 1 })), 'square').key.map(
            (k) => k.label.text,
        )).toEqual(['1 seat']);
        expect(layout(CASES.nobody, 'square').key).toEqual([]);
    });

    it('keeps story text out of the zones TikTok and Reels cover', () => {
        for (const c of Object.values(CASES)) {
            const l = layout(c, 'story');
            const footer = footerBlock(l.footerBox, l.footerFonts, {
                source: c.source,
                asOf: '16 July 2026',
                attribution: ATTRIBUTION,
                url: URL,
            });
            const all: [TextItem, number][] = [
                ...l.headlineLines.map((t): [TextItem, number] => [
                    t,
                    HEADLINE_STRETCH,
                ]),
                ...[...texts(l), ...footer.lines].map(
                    (t): [TextItem, number] => [t, 1],
                ),
            ];
            for (const [t, stretch] of all) {
                const b = textBox(t, stretch);
                expect(b.x + b.w, t.text).toBeLessThanOrEqual(960);
                expect(t.y, t.text).toBeLessThanOrEqual(1520);
            }
            expect(l.map.y + l.map.h).toBeLessThanOrEqual(1520);
            expect(l.headline.y).toBeGreaterThanOrEqual(120);
        }
    });
});

describe('TopCountiesCard', () => {
    const draw = (
        c: TopCountiesCardView,
        size: (typeof SIZES)[number] = 'square',
        mapImage: string | null = 'data:image/png;base64,MAP',
    ) =>
        mount(TopCountiesCard, {
            props: {
                view: c,
                size,
                headline: topCountiesHeadline(c),
                mapImage,
                mapImages: mapImage ? { map: mapImage } : {},
                mapPlaceholder: 'Drawing the map…',
                mapAspect: 0.82,
                url: URL,
                theme: THEMES.light,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(eleven, 'square').attributes('viewBox')).toBe('0 0 1080 1080');
        expect(draw(eleven, 'story').attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('shows the headline, the ranked counties, the note, the map with its caption and key, the source, date and link', () => {
        const w = draw(eleven);
        expect(
            w
                .findAll('[data-headline]')
                .map((t) => t.text())
                .join(' '),
        ).toBe('Where independents hold the most MCA seats');
        expect(w.findAll('[data-county]').map((g) => Number(g.attributes('data-county')))).toEqual(
            eleven.rows.map((r) => r.code),
        );
        const text = w.text();
        expect(text).toContain('63 of 1,450 MCAs nationally are independents.');
        expect(text).toContain('The 10 counties with the most:');
        expect(text).toContain(countyName(15));
        expect(text).toContain('of 40 wards');
        expect(w.find('[data-note]').text()).toBe(
            'One more county also has 4. Ties are listed by IEBC county code.',
        );
        expect(w.find('image[data-map]').attributes('href')).toBe(
            'data:image/png;base64,MAP',
        );
        expect(text).toContain('The 10 counties shaded');
        expect(w.findAll('[data-key] rect')).toHaveLength(2);
        expect(text).toContain('Source: IEBC gazette notices.');
        expect(text).toContain('Data as of 16 July 2026.');
        expect(text).toContain('Boundaries:');
        expect(text).toContain('example.org/?seat=mca&parties=ind');
    });

    it('says the map is being drawn while it is', () => {
        const w = draw(eleven, 'square', null);
        expect(w.find('image[data-map]').exists()).toBe(false);
        expect(w.text()).toContain('Drawing the map…');
    });

    it('marks sample data as sample', () => {
        expect(draw({ ...eleven, sample: true }).text()).toContain('SAMPLE DATA');
        expect(draw(eleven).find('[data-watermark]').exists()).toBe(false);
    });
});

describe('sharing "Top 10 counties"', () => {
    it('comes in square and story, with a fixed headline, its own copy and file name', () => {
        expect(sizesOf(eleven)).toEqual(['square', 'story']);
        expect(headlineEditable(eleven)).toBe(false);
        expect(shareCards([eleven]).map((c) => [c.key, c.label])).toEqual([
            ['topCounties', 'Top 10 counties'],
        ]);
        expect(dialogCopy(eleven)).toEqual({
            title: 'Share top 10 counties',
            description:
                'The counties where independents hold the most MCA seats, sized for Instagram or stories.',
        });
        expect(filenameOf(eleven, 'story')).toBe(
            'kenya-electoral-map-top-counties-ind-mca-story.png',
        );
        expect(filenameOf(view(NUMBERS_SEATS, 'mp', 'UDA'), 'square')).toBe(
            'kenya-electoral-map-top-counties-uda-mp-square.png',
        );
    });

    it('writes a caption that lists the counties on Instagram and stays within 280 on X', () => {
        const ig = topCountiesCaption(eleven, URL, 'instagram');
        expect(ig).toContain('Where independents hold the most MCA seats');
        expect(ig).toContain(
            '63 of 1,450 MCAs nationally are independents. The 10 counties with the most:',
        );
        expect(ig).toContain(`1. ${countyName(15)}: 9 of 40 wards`);
        expect(ig).toContain('One more county also has 4.');
        expect(ig).toContain('Source: IEBC gazette notices, data as of 16 July 2026.');
        expect(ig).toContain(URL);
        const x = topCountiesCaption(eleven, URL, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain('Where independents hold the most MCA seats');
    });
});
