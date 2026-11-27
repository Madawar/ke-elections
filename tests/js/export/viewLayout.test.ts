import { describe, expect, it } from 'vitest';
import { footerBlock, type TextItem } from '@/lib/export/layout';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import {
    type Box,
    HEADLINE_STRETCH,
    type ViewLayout,
    viewLayout,
} from '@/lib/export/viewLayout';
import { headlineFor, snapshotView } from '@/lib/export/viewState';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { MIX_SEATS, mixIndex } from './mixFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const seats = withIndependentColour(MIX_SEATS, THEMES.dark.independent);
const view = (
    seat: 'mca' | 'mp' | 'governor',
    focus: { level: 'county' | 'constituency'; code: number } | null,
    only: string[] = [],
) =>
    snapshotView({
        seats,
        index: mixIndex,
        seat,
        focus,
        only,
        showSurroundings: false,
        theme: 'dark',
    });
const nairobiMca = view('mca', { level: 'county', code: 47 });
const nairobiMp = view('mp', { level: 'county', code: 47 });
const mathareMca = view('mca', { level: 'constituency', code: 290 });
const kenyaMca = view('mca', null, ['ODM']);
const nairobiGovernor = view('governor', { level: 'county', code: 47 });
/** A constituency with a single ward: one row under the strip. */
const oneWardMca = {
    ...mathareMca,
    mix: { ...mathareMca.mix, rows: mathareMca.mix.rows.slice(0, 1) },
};
/**
 * MCA cards whose strip has every leader, with long names: Nairobi City with its 85 wards, and
 * Mathare. The fixture itself has only a Governor, so its other rows read "No approved data yet".
 */
const ledMca = [nairobiMca, mathareMca].map((v) => ({
    ...v,
    leaders: v.leaders.map((r, i) => ({
        ...r,
        holder: r.holder ?? {
            name: [
                'Placeholder Longer Middle Name Surname',
                'Placeholder Wa Kwanza',
                'Placeholder Another Quite Long Name',
                'Placeholder Short',
            ][i % 4],
            party: 'ODM',
            partyLabel: 'ODM',
            partyName: 'Orange Democratic Movement',
            colour: '#e07b24',
            basis: 'elected',
            startedOn: '2022-08-09',
            sourceUrl: 'https://www.iebc.or.ke/sample.pdf',
        },
    })),
}));
const URL = 'https://example.org/county/47?seat=mca';
const layoutOf = (size: ViewSize, v = nairobiMca) =>
    viewLayout(size, v, {
        headline: headlineFor(v),
        url: URL,
        mapAspect: 1.5,
    });

const inside = (b: Box, w: number, h: number) =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x + 0.5 ||
    b.x + b.w <= a.x + 0.5 ||
    a.y + a.h <= b.y + 0.5 ||
    b.y + b.h <= a.y + 0.5;
/** The box a line of text takes (from its baseline, with ascender and descender). */
const textBox = (t: TextItem, stretch = 1): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600) * stretch;
    return {
        x: t.anchor === 'end' ? t.x - w : t.x,
        y: t.y - t.size * 0.8,
        w,
        h: t.size,
    };
};
const texts = (l: ViewLayout): TextItem[] => [
    l.scopeLine,
    ...(l.chartTitle ? [l.chartTitle] : []),
    ...l.rows.flatMap((r) =>
        [r.label, r.value].filter((t): t is TextItem => !!t),
    ),
    ...l.callouts.flatMap((c) => [c.label, c.number, c.sub]),
    ...(l.mixBar?.segments.flatMap((s) => (s.label ? [s.label] : [])) ?? []),
    ...(l.mixLegend?.items.map((i) => i.text) ?? []),
    ...l.mixRows.flatMap((r) => r.texts),
    ...(l.moreLine ? [l.moreLine] : []),
    ...(l.holder?.texts ?? []),
    ...(l.leaders?.rows.flatMap((r) => r.texts) ?? []),
    ...(l.leaders?.more ? [l.leaders.more] : []),
];

describe('seat mix layout', () => {
    it('lists the first Nairobi City rows plus "and N more": a dozen or more on story and portrait, six or more on square and X', () => {
        // Before the bigger map and the leaders strip (owner, 2026-11-27), story and portrait
        // listed all 17. The room for both came from the rows, as the owner's addition asks.
        for (const size of SIZES) {
            const l = layoutOf(size);
            expect(l.mixRows.length, size).toBeGreaterThanOrEqual(
                size === 'story' || size === 'portrait' ? 12 : 6,
            );
            expect(l.mixRows.length, size).toBeLessThan(17);
            expect(l.rowsMore).toBe(17 - l.mixRows.length);
            expect(l.moreLine?.text).toBe(
                `and ${17 - l.mixRows.length} more constituencies`,
            );
            // The first rows by code, never re-sorted.
            expect(l.mixRows.map((r) => r.code)).toEqual(
                nairobiMca.mix.rows
                    .slice(0, l.mixRows.length)
                    .map((r) => r.code),
            );
        }
    });

    it('puts a 100%-width mix bar under the headline in every view', () => {
        for (const v of [nairobiMca, nairobiMp, mathareMca, kenyaMca])
            for (const size of SIZES) {
                const l = layoutOf(size, v);
                const bar = l.mixBar!;
                expect(bar, size).toBeTruthy();
                expect(bar.box.y).toBeGreaterThan(l.headline.y + l.headline.h);
                const widths = bar.segments.reduce((n, s) => n + s.w, 0);
                const gaps = (bar.segments.length - 1) * bar.gap;
                expect(Math.abs(widths + gaps - bar.box.w)).toBeLessThan(2);
            }
    });

    it('prints a share inside a segment only when it fits with room to spare', () => {
        for (const size of SIZES) {
            const bar = layoutOf(size).mixBar!;
            for (const s of bar.segments) {
                if (!s.label) continue;
                const w = textWidth(s.label.text, s.label.size, true);
                expect(w + s.label.size).toBeLessThanOrEqual(s.w);
                expect(s.label.x).toBeGreaterThanOrEqual(s.x);
            }
            // The largest segment (ODM, 47%) always has room.
            expect(bar.segments[0].label?.text).toBe('47%');
        }
    });

    it('keeps every block on the card and apart, and no two lines of text overlap', () => {
        for (const v of [
            nairobiMca,
            nairobiMp,
            mathareMca,
            kenyaMca,
            nairobiGovernor,
            oneWardMca,
            ...ledMca,
        ])
            for (const [size, aspect] of SIZES.flatMap((s) =>
                [0.6, 1.05, 1.5, 2.3].map((a) => [s, a] as const),
            )) {
                const l = viewLayout(size, v, {
                    headline: headlineFor(v),
                    url: URL,
                    mapAspect: aspect,
                });
                const blocks: [string, Box][] = [
                    ['headline', l.headline],
                    ['map', l.map],
                    ...(l.mixBar
                        ? ([['mix bar', l.mixBar.box]] as [string, Box][])
                        : []),
                    ['footer', l.footerBox],
                    ...(l.holder
                        ? ([['holder', l.holder.box]] as [string, Box][])
                        : l.mixRows.length
                          ? ([['rows', l.rowsBox!]] as [string, Box][])
                          : ([
                                ['callouts', l.calloutBox],
                                ['chart', l.chartBox],
                            ] as [string, Box][])),
                    ...(l.mixLegend
                        ? ([['mix legend', l.mixLegend.box]] as [string, Box][])
                        : []),
                    ...(l.leaders
                        ? ([['leaders', l.leaders.box]] as [string, Box][])
                        : []),
                ];
                for (const [name, b] of blocks)
                    expect(inside(b, l.w, l.h), `${size} ${name}`).toBe(true);
                for (let i = 0; i < blocks.length; i++)
                    for (let j = i + 1; j < blocks.length; j++)
                        expect(
                            apart(blocks[i][1], blocks[j][1]),
                            `${v.seat} ${size}: ${blocks[i][0]} and ${blocks[j][0]}`,
                        ).toBe(true);
                const boxes = texts(l).map(
                    (t) => [t.text, textBox(t)] as const,
                );
                for (const [text, b] of boxes)
                    expect(inside(b, l.w, l.h), `${size} "${text}"`).toBe(true);
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(
                            apart(boxes[i][1], boxes[j][1]),
                            `${v.seat} ${size}: "${boxes[i][0]}" and "${boxes[j][0]}"`,
                        ).toBe(true);
            }
    });

    it('keeps story text out of the zones TikTok and Reels cover', () => {
        for (const v of [nairobiMca, nairobiMp, mathareMca, oneWardMca, ...ledMca]) {
            const l = layoutOf('story', v);
            const footer = footerBlock(l.footerBox, l.footerFonts, {
                source: v.source,
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
        }
    });

    it('names a party folded into Other parties in the mix legend, with its own colour', () => {
        const l = layoutOf('story');
        const legend = l.mixLegend!;
        const kanu = legend.items.find((i) => i.text.text.startsWith('KANU'));
        expect(kanu?.swatch.colour).toBe('#8a5a2b');
        expect(legend.items.map((i) => i.text.text)).toContain(
            'Independent 2 (2%)',
        );
    });

    it('never cuts a name mid-word: long names wrap or shrink', () => {
        const long = {
            ...nairobiMca,
            mix: {
                ...nairobiMca.mix,
                rows: nairobiMca.mix.rows.map((r, i) =>
                    i === 0
                        ? {
                              ...r,
                              name: 'Embakasi Central and a Much Longer Name',
                          }
                        : r,
                ),
            },
        };
        for (const size of SIZES) {
            const l = layoutOf(size, long);
            const first = l.mixRows[0].texts
                .filter((t) => t.role === 'name')
                .map((t) => t.text)
                .join(' ');
            expect(first, size).toBe('Embakasi Central and a Much Longer Name');
        }
    });
});

describe('chart labels', () => {
    it('share one size per chart, "Other parties" included', () => {
        for (const v of [kenyaMca, view('mca', null)])
            for (const size of SIZES) {
                const l = layoutOf(size, v);
                const sizes = new Set(l.rows.map((r) => r.label.size));
                expect(sizes.size, size).toBe(1);
            }
    });
});

describe('the headline beside the map', () => {
    it('is never cut, however long the generated headline', () => {
        const tie = {
            ...nairobiMca,
        };
        for (const size of SIZES) {
            const headline =
                'MCA seats in Nairobi City: ODM and UDA, 35 each of 85';
            const l = viewLayout(size, tie, {
                headline,
                url: URL,
                mapAspect: 1.5,
            });
            expect(l.headlineLines.map((t) => t.text).join(' '), size).toBe(
                headline,
            );
        }
    });
});

describe('room for the map and the rows', () => {
    it('still lists a dozen rows on portrait and story with a three-line headline', () => {
        const headline =
            'MCA seats in Nairobi City: ODM and UDA, 35 each of 85';
        for (const size of ['portrait', 'story'] as const) {
            const l = viewLayout(size, nairobiMca, {
                headline,
                url: URL,
                mapAspect: 1.5,
            });
            expect(l.mixRows.length, size).toBeGreaterThanOrEqual(12);
            expect(l.moreLine?.text, size).toBe(
                `and ${17 - l.mixRows.length} more constituencies`,
            );
        }
    });

    it('gives a few rows (a constituency’s wards) a full-width map above them', () => {
        for (const size of ['story', 'portrait'] as const) {
            const l = layoutOf(size, mathareMca);
            expect(l.map.w, size).toBeGreaterThan(l.w * 0.7);
            expect(l.map.y + l.map.h).toBeLessThan(l.mixBar!.box.y);
            expect(l.mixRows).toHaveLength(5);
        }
    });
});

describe('the leaders strip on MCA cards', () => {
    it('is on every MCA card for a county or a constituency, in all four sizes, and on no other card', () => {
        for (const size of SIZES) {
            expect(
                layoutOf(size, nairobiMca).leaders?.rows.map((r) => r.seat),
                size,
            ).toEqual(['governor', 'senator', 'woman_rep']);
            const mathare = layoutOf(size, mathareMca).leaders!;
            expect(mathare.rows[0].seat, size).toBe('mp');
            expect(mathare.rows.map((r) => r.seat).slice(1), size).toEqual(
                ['governor', 'senator', 'woman_rep'].slice(
                    0,
                    mathare.rows.length - 1,
                ),
            );
            for (const v of [nairobiMp, kenyaMca, nairobiGovernor])
                expect(layoutOf(size, v).leaders, size).toBeNull();
        }
    });

    it('sits above the seat mix, under the map (or beside it on X, where it leads the words)', () => {
        for (const v of [nairobiMca, mathareMca, ...ledMca])
            for (const size of SIZES) {
                const l = layoutOf(size, v);
                const strip = l.leaders!.box;
                if (strip.x >= l.mixBar!.box.x - 1)
                    expect(strip.y + strip.h, size).toBeLessThanOrEqual(
                        l.mixBar!.box.y,
                    );
                else expect(strip.y, size).toBeGreaterThanOrEqual(l.map.y + l.map.h);
            }
    });

    it('names its sources in the footer with the card’s own', () => {
        expect(nairobiMca.source).toBe('IEBC gazette notices');
        const other = snapshotView({
            seats: {
                ...seats,
                holders: seats.holders.map((h) =>
                    h.seat === 'governor'
                        ? { ...h, source_url: 'https://www.parliament.go.ke/x' }
                        : h,
                ),
            },
            index: mixIndex,
            seat: 'mca',
            focus: { level: 'county', code: 47 },
            only: [],
            showSurroundings: false,
            theme: 'dark',
        });
        expect(other.source).toBe('IEBC gazette notices and parliament.go.ke');
        expect(other.sources).toEqual([
            'IEBC gazette notices',
            'parliament.go.ke',
        ]);
    });
});
