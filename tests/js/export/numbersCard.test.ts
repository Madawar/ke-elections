import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NumbersCard from '@/components/export/NumbersCard.vue';
import { numbersCaption, xLength } from '@/lib/export/caption';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import {
    NUMBERS_SCOPE,
    type NumbersCardView,
    numbersCardView,
    numbersHeadline,
    numbersNote,
} from '@/lib/export/numbersCard';
import { type NumbersLayout, numbersLayout } from '@/lib/export/numbersLayout';
import {
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineOf,
    inTheme,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { buildLegend } from '@/lib/legend';
import { ATTRIBUTION, SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import { type SeatsData, seatLegend, withIndependentColour } from '@/lib/seats';
import {
    GOVERNORS,
    NUMBERS_SEATS,
    numbersIndex as index,
    seatHolders,
} from './numbersFixtures';

const SEATS = ['governor', 'senator', 'woman_rep', 'mp', 'mca'] as const;
const SIZES = ['square', 'story'] as const;
const seats = withIndependentColour(NUMBERS_SEATS, THEMES.dark.independent);
const card = (data: SeatsData = seats, theme: 'dark' | 'light' = 'dark') =>
    numbersCardView({ seats: data, index, theme });
const numbers = card();
const URL = 'https://example.org/';

/** The data with some holders of one seat taken out (their seats have no approved holder). */
const without = (seat: string, n: number): SeatsData => {
    let left = n;
    return {
        ...seats,
        holders: seats.holders.filter((h) => h.seat !== seat || left-- <= 0),
    };
};
/** No nominated members at all. */
const noNominated: SeatsData = {
    ...seats,
    holders: seats.holders.filter((h) => !h.seat.startsWith('nominated')),
};
/** Governors with a tie for third place: WDM-K and JP both hold 3. */
const tied: SeatsData = {
    ...seats,
    holders: [
        ...seats.holders.filter((h) => h.seat !== 'governor'),
        ...seatHolders('governor', 'county', [
            ...GOVERNORS.slice(0, 3),
            ['JP', 3],
            ['UDM', 1],
            ...GOVERNORS.slice(5),
        ]),
    ],
};

describe('numbersCardView', () => {
    it('counts every elected seat below the President, from the unit index', () => {
        expect(numbers.total).toBe(47 * 3 + 290 + 1450);
        expect(numbersHeadline(numbers)).toBe(
            '1,881 elected seats below the President',
        );
        expect(NUMBERS_SCOPE).toBe('Who holds them now, seat by seat');
        expect(numbers.rows.map((r) => [r.seat, r.label, r.seats])).toEqual([
            ['governor', 'Governors', 47],
            ['senator', 'Senators', 47],
            ['woman_rep', 'Woman Reps', 47],
            ['mp', 'MPs', 290],
            ['mca', 'MCAs', 1450],
        ]);
    });

    it('lists the three groups holding the most, as the legend counts them', () => {
        for (const row of numbers.rows) {
            const legend = seatLegend(seats, row.seat);
            expect(row.most, row.seat).toEqual(
                legend.slice(0, 3).map((l) => ({
                    key: l.abbrev,
                    label: l.abbrev === 'IND' ? 'Independent' : l.abbrev,
                    colour: l.colour,
                    count: l.seats,
                })),
            );
        }
        expect(
            numbers.rows[0].most.map((m) => `${m.label} ${m.count}`),
        ).toEqual(['UDA 20', 'ODM 15', 'WDM-K 3']);
        expect(
            numbers.rows[4].most.map((m) => `${m.label} ${m.count}`),
        ).toEqual(['UDA 523', 'ODM 312', 'Independent 114']);
        expect(numbers.rows[4].most[2].colour).toBe(THEMES.dark.independent);
    });

    it('draws each mix bar from the legend’s rows, in the legend’s order, adding up to the seats', () => {
        for (const row of numbers.rows) {
            const legend = buildLegend(seats, row.seat, null, []);
            expect(row.parts, row.seat).toEqual(
                legend.rows.map((r) => ({
                    key: r.key,
                    colour: r.colour,
                    count: r.count,
                })),
            );
            expect(row.parts.reduce((n, p) => n + p.count, 0)).toBe(row.seats);
            expect(row.vacant).toBe(0);
        }
        expect(numbers.rows[4].parts.at(-1)?.key).toBe('other');
    });

    it('breaks a tie for third place by abbreviation, and says so', () => {
        const t = card(tied);
        expect(t.rows[0].most.map((m) => `${m.label} ${m.count}`)).toEqual([
            'UDA 20',
            'ODM 15',
            'JP 3',
        ]);
        expect(t.rows[0].tieAtCut).toBe(true);
        expect(t.rows.slice(1).some((r) => r.tieAtCut)).toBe(false);
        expect(numbersNote(t)).toContain(
            'Ties are listed by party abbreviation.',
        );
        expect(numbers.rows.some((r) => r.tieAtCut)).toBe(false);
        expect(numbersNote(numbers)).not.toContain('Ties');
    });

    it('keeps seats with no approved holder as a last, no-data part, and says how many', () => {
        const v = card(without('senator', 2));
        const senators = v.rows[1];
        expect(senators.vacant).toBe(2);
        expect(senators.parts.at(-1)).toEqual({
            key: 'none',
            colour: THEMES.dark.noData,
            count: 2,
        });
        expect(senators.parts.reduce((n, p) => n + p.count, 0)).toBe(47);
        expect(v.vacant).toBe(2);
        expect(numbersNote(v)).toContain(
            '2 seats have no approved holder yet.',
        );
        expect(numbersNote(card(without('mca', 1)))).toContain(
            '1 seat has no approved holder yet.',
        );
        expect(numbersNote(numbers)).not.toContain('no approved holder');
        // A seat no one holds is listed, with nothing invented for it.
        const empty = card(without('governor', 47));
        expect(empty.rows[0].most).toEqual([]);
        expect(empty.rows[0].parts).toEqual([
            { key: 'none', colour: THEMES.dark.noData, count: 47 },
        ]);
    });

    it('names the nominated members of Parliament when the data has them', () => {
        expect(numbers.nominated).toBe(31);
        expect(numbersNote(numbers)).toBe(
            'The President is elected on a sixth ballot. Parliament also has 31 nominated MPs and senators in office.',
        );
        expect(numbersNote(card(noNominated))).toBe(
            'The President is elected on a sixth ballot.',
        );
    });

    it('gives its sources (every holder it counts), the date the data describes and the link to the map', () => {
        expect(numbers.sources).toEqual([
            'IEBC gazette notices',
            'parliament.go.ke',
        ]);
        expect(card(noNominated).sources).toEqual(['IEBC gazette notices']);
        expect(numbers.asOf).toBe('2026-07-16');
        expect(numbers.path).toBe('/');
        expect(numbers.sample).toBe(false);
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
const texts = (l: NumbersLayout): TextItem[] => [
    l.scopeLine,
    ...l.rows.flatMap((r) => [r.number, r.label, ...r.most]),
    ...l.note,
];
const layout = (c: NumbersCardView, size: (typeof SIZES)[number]) =>
    numbersLayout(size, c, {
        headline: numbersHeadline(c),
        url: URL,
        mapAspect: 1,
    });
/** Every note at once: a tie, vacancies and the nominated members. */
const busy = card({
    ...tied,
    holders: tied.holders.filter((h, i) => h.seat !== 'mp' || i % 40 !== 0),
});

describe('numbersLayout', () => {
    it('draws the five seats in ballot order, each with its ballot colour at the edge', () => {
        for (const size of SIZES) {
            const l = layout(numbers, size);
            expect(l.rows.map((r) => r.seat)).toEqual(SEATS);
            expect(l.rows.map((r) => r.lid.colour)).toEqual(
                SEATS.map((s) => SEAT_COLOURS[s]),
            );
            expect(l.rows.map((r) => r.number.text)).toEqual([
                '47',
                '47',
                '47',
                '290',
                '1,450',
            ]);
            expect(l.rows.map((r) => r.label.text)).toEqual([
                'Governors',
                'Senators',
                'Woman Reps',
                'MPs',
                'MCAs',
            ]);
            // The numbers share one right edge, and the seat names start after it.
            const right = l.rows[0].number.x;
            expect(l.rows.every((r) => r.number.x === right)).toBe(true);
            expect(l.rows.every((r) => r.number.anchor === 'end')).toBe(true);
            expect(l.rows.every((r) => r.label.x > right)).toBe(true);
            expect(l.strip).toHaveLength(6);
            expect(l.strip.every((s) => !s.current)).toBe(true);
        }
    });

    it('writes "Most held:" then each group with its chip, and a thin mix bar of the legend’s parts', () => {
        const l = layout(numbers, 'square');
        const mca = l.rows[4];
        expect(mca.most.map((t) => t.text)).toEqual([
            'Most held:',
            'UDA 523',
            'ODM 312',
            'Independent 114',
        ]);
        expect(mca.most[0].tone).toBe('muted');
        expect(mca.chips.map((c) => c.colour)).toEqual(
            numbers.rows[4].most.map((m) => m.colour),
        );
        expect(mca.bar.map((p) => p.key)).toEqual(
            numbers.rows[4].parts.map((p) => p.key),
        );
        // Thin, and a gap between the parts.
        expect(mca.bar[0].h).toBeLessThan(mca.label.size);
        for (let i = 1; i < mca.bar.length; i++)
            expect(mca.bar[i].x).toBeGreaterThan(
                mca.bar[i - 1].x + mca.bar[i - 1].w,
            );
        // Every chip sits before its own group's text.
        mca.chips.forEach((c, i) =>
            expect(c.x + c.w).toBeLessThan(mca.most[i + 1].x),
        );
    });

    it('keeps "Most held:" on one line on the square card, and never parts a chip from its group', () => {
        for (const r of layout(numbers, 'square').rows)
            expect(new Set(r.most.map((t) => t.y)).size, r.seat).toBe(1);
        for (const size of SIZES)
            for (const r of layout(busy, size).rows)
                r.chips.forEach((c, i) => {
                    const t = r.most[i + 1];
                    expect(c.y, `${size} ${r.seat}`).toBeLessThan(t.y);
                    expect(c.y + c.h, `${size} ${r.seat}`).toBeGreaterThan(
                        t.y - t.size * 0.8,
                    );
                });
    });

    it('breaks every row’s "Most held:" line the same way', () => {
        for (const c of [numbers, busy])
            for (const size of SIZES) {
                const l = layout(c, size);
                const together = l.rows.map((r) => r.most[1].y === r.most[0].y);
                expect(new Set(together).size, size).toBe(1);
            }
    });

    it('says when a seat has no holder at all, with an empty bar', () => {
        const l = layout(card(without('governor', 47)), 'square');
        expect(l.rows[0].most.map((t) => t.text)).toEqual([
            'No approved holder yet',
        ]);
        expect(l.rows[0].chips).toEqual([]);
        expect(l.rows[0].bar.map((p) => p.key)).toEqual(['none']);
    });

    it('puts the note under the rows, after a rule', () => {
        for (const size of SIZES) {
            const l = layout(busy, size);
            expect(l.note.map((t) => t.text).join(' ')).toBe(numbersNote(busy));
            const last = l.rows[4];
            expect(l.rule.y).toBeGreaterThan(last.box.y + last.box.h);
            expect(l.note[0].y - l.note[0].size).toBeGreaterThan(l.rule.y);
        }
    });

    it('keeps everything on the card and apart, and cuts no text', () => {
        for (const c of [numbers, busy, card(noNominated)])
            for (const size of SIZES) {
                const l = layout(c, size);
                const blocks: [string, Box][] = [
                    ['headline', l.headline],
                    ['footer', l.footerBox],
                    ['rule', l.rule],
                    ['note', l.noteBox],
                    ...l.rows.map((r): [string, Box] => [r.seat, r.box]),
                ];
                for (const [name, b] of blocks)
                    expect(inside(b, l.w, l.h), `${size} ${name}`).toBe(true);
                for (let i = 0; i < blocks.length; i++)
                    for (let j = i + 1; j < blocks.length; j++)
                        expect(
                            apart(blocks[i][1], blocks[j][1]),
                            `${size}: ${blocks[i][0]} and ${blocks[j][0]}`,
                        ).toBe(true);
                // Inside each row: the lid, the chips and the bar parts do not overlap the text.
                for (const r of l.rows) {
                    const parts: [string, Box][] = [
                        ['lid', r.lid],
                        ...r.chips.map((b, i): [string, Box] => [
                            `chip ${i}`,
                            b,
                        ]),
                        ...r.bar.map((b): [string, Box] => [`bar ${b.key}`, b]),
                        ...[r.number, r.label, ...r.most].map(
                            (t): [string, Box] => [t.text, textBox(t)],
                        ),
                    ];
                    for (const [name, b] of parts)
                        expect(
                            inside(b, l.w, l.h) &&
                                b.y >= r.box.y - 0.5 &&
                                b.y + b.h <= r.box.y + r.box.h + 0.5,
                            `${size} ${r.seat} ${name}`,
                        ).toBe(true);
                    for (let i = 0; i < parts.length; i++)
                        for (let j = i + 1; j < parts.length; j++)
                            expect(
                                apart(parts[i][1], parts[j][1]),
                                `${size} ${r.seat}: ${parts[i][0]} and ${parts[j][0]}`,
                            ).toBe(true);
                }
                const boxes = texts(l).map(
                    (t) => [t.text, textBox(t)] as const,
                );
                for (const [text, b] of boxes) {
                    expect(text, size).not.toContain('…');
                    expect(inside(b, l.w, l.h), `${size} "${text}"`).toBe(true);
                }
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(
                            apart(boxes[i][1], boxes[j][1]),
                            `${size}: "${boxes[i][0]}" and "${boxes[j][0]}"`,
                        ).toBe(true);
                expect(l.headlineLines.map((t) => t.text).join(' ')).toBe(
                    numbersHeadline(c),
                );
                expect(l.scopeLine.text).toBe(NUMBERS_SCOPE);
            }
    });

    it('keeps story text out of the zones TikTok and Reels cover', () => {
        for (const c of [numbers, busy]) {
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
            expect(l.headline.y).toBeGreaterThanOrEqual(120);
        }
    });

    it('is what the share dialog lays out for the card', () => {
        const text = {
            headline: numbersHeadline(numbers),
            url: URL,
            mapAspect: 1,
        };
        expect(layoutOf('story', numbers, text)).toEqual(
            numbersLayout('story', numbers, text),
        );
    });
});

describe('NumbersCard', () => {
    const draw = (
        c: NumbersCardView,
        size: (typeof SIZES)[number] = 'square',
    ) =>
        mount(NumbersCard, {
            props: {
                view: c,
                size,
                headline: numbersHeadline(c),
                url: URL,
                theme: THEMES.light,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(numbers, 'square').attributes('viewBox')).toBe(
            '0 0 1080 1080',
        );
        expect(draw(numbers, 'story').attributes('viewBox')).toBe(
            '0 0 1080 1920',
        );
    });

    it('shows the headline, the five seats with their numbers, the note, the source, the date and the link', () => {
        const w = draw(numbers);
        expect(
            w
                .findAll('[data-headline]')
                .map((t) => t.text())
                .join(' '),
        ).toBe('1,881 elected seats below the President');
        expect(
            w.findAll('[data-seat]').map((g) => g.attributes('data-seat')),
        ).toEqual([...SEATS]);
        expect(w.findAll('[data-number]').map((t) => t.text())).toEqual([
            '47',
            '47',
            '47',
            '290',
            '1,450',
        ]);
        expect(w.find('[data-number]').attributes('text-anchor')).toBe('end');
        const text = w.text();
        expect(text).toContain('Who holds them now, seat by seat');
        expect(text).toContain('Most held:');
        expect(text).toContain('Independent 114');
        expect(w.find('[data-note]').text()).toContain(
            'Parliament also has 31 nominated MPs and senators in office.',
        );
        expect(text).toContain(
            'Source: IEBC gazette notices and parliament.go.ke.',
        );
        expect(text).toContain('Data as of 16 July 2026.');
        expect(text).toContain('example.org');
        expect(w.find('image').exists()).toBe(false);
    });

    it('marks sample data as sample', () => {
        expect(draw({ ...numbers, sample: true }).text()).toContain(
            'SAMPLE DATA',
        );
        expect(draw(numbers).find('[data-watermark]').exists()).toBe(false);
    });
});

describe('sharing "By the numbers"', () => {
    it('comes in square and story, with no map, its own copy, file name and an editable headline', () => {
        expect(sizesOf(numbers)).toEqual(['square', 'story']);
        expect(
            mapSlotsOf('square', numbers, {
                headline: 'x',
                url: URL,
                mapAspect: 1,
            }),
        ).toEqual([]);
        expect(headlineOf(numbers)).toBe(
            '1,881 elected seats below the President',
        );
        expect(headlineEditable(numbers)).toBe(true);
        expect(dialogCopy(numbers)).toEqual({
            title: 'Share by the numbers',
            description:
                'Every elected seat below the President and who holds them now, sized for Instagram or stories.',
        });
        expect(filenameOf(numbers, 'story')).toBe(
            'kenya-electoral-map-numbers-story.png',
        );
        expect(shareCards([numbers])).toEqual([
            { key: 'numbers', label: 'By the numbers', view: numbers },
        ]);
    });

    it('follows the theme: independents take that theme’s colour', () => {
        const light = inTheme(numbers, 'light', {
            seats: NUMBERS_SEATS,
            index,
        });
        expect(light.theme).toBe('light');
        expect(light).toEqual(
            card(
                withIndependentColour(NUMBERS_SEATS, THEMES.light.independent),
                'light',
            ),
        );
        expect((light as NumbersCardView).rows[4].most[2].colour).toBe(
            THEMES.light.independent,
        );
    });

    it('captions it with the five rows, the note, the source, the date, the link and the tags', () => {
        expect(numbersCaption(numbers, URL).split('\n')).toEqual([
            '1,881 elected seats below the President',
            '',
            'Governors: 47 seats. Most held: UDA 20, ODM 15, WDM-K 3.',
            'Senators: 47 seats. Most held: UDA 22, ODM 13, JP 4.',
            'Woman Reps: 47 seats. Most held: UDA 21, ODM 10, WDM-K 4.',
            'MPs: 290 seats. Most held: UDA 123, ODM 73, JP 22.',
            'MCAs: 1,450 seats. Most held: UDA 523, ODM 312, Independent 114.',
            '',
            'The President is elected on a sixth ballot. Parliament also has 31 nominated MPs and senators in office.',
            '',
            'Source: IEBC gazette notices and parliament.go.ke, data as of 16 July 2026.',
            URL,
            '',
            '#Kenya2027 #KenyaDecides',
        ]);
        const x = numbersCaption(busy, URL, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain('1,881 elected seats below the President');
        expect(x).toContain('Source: IEBC gazette notices');
        expect(
            xLength(numbersCaption(busy, URL, 'x', 'A'.repeat(400))),
        ).toBeLessThanOrEqual(280);
    });
});
