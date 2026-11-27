import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FiveSeatsCard from '@/components/export/FiveSeatsCard.vue';
import { fiveSeatsCaption, xLength } from '@/lib/export/caption';
import {
    FIVE_SEATS_HEADLINE,
    FIVE_SEATS_KEY_NOTE,
    KEY_MAX,
    type FiveSeatsCardView,
    fiveSeatsCardView,
    fiveSeatsKeyNote,
    fiveSeatsScope,
} from '@/lib/export/fiveSeatsCard';
import {
    type FiveSeatsLayout,
    fiveSeatsLayout,
} from '@/lib/export/fiveSeatsLayout';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import { numbersCardView, numbersRowLine } from '@/lib/export/numbersCard';
import {
    componentOf,
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineWording,
    headlineOf,
    inTheme,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH, SPECS } from '@/lib/export/viewLayout';
import { viewColouring, viewStyle } from '@/lib/export/viewMap';
import { buildLegend } from '@/lib/legend';
import { ATTRIBUTION, OTHER, THEMES, type ThemeName } from '@/lib/map/theme';
import {
    type Holder,
    type SeatsData,
    seatLegend,
    withIndependentColour,
} from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const SIZES = ['square', 'story'] as const;
const URL = 'https://example.org/';
const BALLOT = ['governor', 'senator', 'woman_rep', 'mp', 'mca'] as const;

const themed = (data: SeatsData, theme: ThemeName) =>
    withIndependentColour(data, THEMES[theme].independent);
const view = (data: SeatsData = NUMBERS_SEATS, theme: ThemeName = 'dark') =>
    fiveSeatsCardView({ seats: themed(data, theme), index, theme });
const card = view();
const text = (c: FiveSeatsCardView) => ({
    headline: FIVE_SEATS_HEADLINE,
    url: URL,
    mapAspect: 0.82,
});
const layout = (c: FiveSeatsCardView, size: (typeof SIZES)[number]) =>
    fiveSeatsLayout(size, c, { headline: FIVE_SEATS_HEADLINE, url: URL });

/** Every colour any of the five maps draws a seat in, as the map draws it. */
function mapColours(c: FiveSeatsCardView, data: SeatsData, theme: ThemeName) {
    const out = new Set<string>();
    for (const slot of mapSlotsOf('square', c, text(c))) {
        const colouring = viewColouring(slot.spec, themed(data, theme), THEMES[theme]);
        for (const colour of colouring.colours.values()) out.add(colour);
    }
    return out;
}

/** The fixture seats with `n` more parties, each with a colour of its own, holding a few MCAs. */
function manyParties(n: number): SeatsData {
    const extra = Array.from({ length: n }, (_, i) => ({
        abbrev: `P${String(i + 1).padStart(2, '0')}`,
        name: `Placeholder party ${i + 1}`,
        coalition_2022: null,
        colour: `#${(0x203040 + i * 0x0a0b0c).toString(16).padStart(6, '0')}`,
    }));
    // P01 holds n wards, P02 n - 1, ... so they rank by their number.
    let code = 1;
    const owner = new Map<number, string>();
    extra.forEach((p, i) => {
        for (let k = 0; k < n - i; k++) owner.set(code++, p.abbrev);
    });
    return {
        ...NUMBERS_SEATS,
        parties: [...NUMBERS_SEATS.parties, ...extra],
        holders: NUMBERS_SEATS.holders.map(
            (h): Holder =>
                h.seat === 'mca' && owner.has(h.code)
                    ? { ...h, party: owner.get(h.code)! }
                    : h,
        ),
    };
}

describe('fiveSeatsCardView', () => {
    it('has the five seats in ballot order, each with its number of seats from the unit index', () => {
        expect(card.maps.map((m) => [m.seat, m.label, m.seats])).toEqual([
            ['governor', 'Governors', 47],
            ['senator', 'Senators', 47],
            ['woman_rep', 'Woman Reps', 47],
            ['mp', 'MPs', 290],
            ['mca', 'MCAs', 1450],
        ]);
        expect(FIVE_SEATS_HEADLINE).toBe('Kenya’s five elected seats, by party');
        expect(fiveSeatsScope(card)).toBe(
            'Who holds each seat now, from 47 counties to 1,450 wards',
        );
        expect(card.path).toBe('/');
        expect(card.asOf).toBe('2026-07-16');
        expect(card.sources).toEqual(['IEBC gazette notices']);
    });

    it('keys every party with a colour of its own on any map, by seats held across all five, ties by abbreviation, then "Other parties"', () => {
        const data = themed(NUMBERS_SEATS, 'dark');
        const totals = new Map<string, number>();
        for (const seat of BALLOT)
            for (const r of seatLegend(data, seat))
                totals.set(r.abbrev, (totals.get(r.abbrev) ?? 0) + r.seats);
        const own = card.key.filter((k) => k.key !== 'other');
        for (const k of own) expect(k.count, k.key).toBe(totals.get(k.key));
        // Most first, ties by abbreviation.
        for (let i = 1; i < own.length; i++) {
            const [a, b] = [own[i - 1], own[i]];
            expect(
                a.count > b.count || (a.count === b.count && a.key < b.key),
                `${a.key} before ${b.key}`,
            ).toBe(true);
        }
        expect(card.key.at(-1)!.label).toBe('Other parties');
        expect(card.key.at(-1)!.colour).toBe(OTHER);
        // "Other parties" counts every seat the legends fold into it.
        const other = BALLOT.reduce(
            (n, seat) =>
                n +
                (buildLegend(data, seat, null, []).rows.find((r) => r.key === 'other')
                    ?.count ?? 0),
            0,
        );
        expect(card.key.at(-1)!.count).toBe(other);
        // Independents read "Independent", in their place by count.
        const ind = card.key.find((k) => k.key === 'IND')!;
        expect(ind.label).toBe('Independent');
        expect(ind.colour).toBe(THEMES.dark.independent);
        expect(card.key.map((k) => k.key).slice(0, 2)).toEqual(['UDA', 'ODM']);
    });

    it('breaks a tie in seats held by abbreviation', () => {
        // Give UDA MCA seats from whichever of JP and WDM-K holds more, until the two are level.
        const total = (data: SeatsData, abbrev: string) =>
            BALLOT.reduce(
                (n, seat) =>
                    n + (seatLegend(data, seat).find((r) => r.abbrev === abbrev)?.seats ?? 0),
                0,
            );
        const diff = total(NUMBERS_SEATS, 'JP') - total(NUMBERS_SEATS, 'WDM-K');
        const from = diff > 0 ? 'JP' : 'WDM-K';
        let moves = Math.abs(diff);
        const data: SeatsData = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.map((h) =>
                h.seat === 'mca' && h.party === from && moves-- > 0
                    ? { ...h, party: 'UDA' }
                    : h,
            ),
        };
        expect(total(data, 'JP')).toBe(total(data, 'WDM-K'));
        const keys = view(data).key.map((k) => k.key);
        expect(keys.indexOf('JP') + 1).toBe(keys.indexOf('WDM-K'));
    });

    it('names every colour on the five maps, and nothing that is on none, in both themes', () => {
        for (const theme of ['light', 'dark'] as const) {
            const c = view(NUMBERS_SEATS, theme);
            const onMaps = mapColours(c, NUMBERS_SEATS, theme);
            const named = new Set(c.key.map((k) => k.colour));
            expect(named, theme).toEqual(onMaps);
            expect(c.key.length).toBe(named.size);
        }
    });

    it('names no "Other parties" when no map shows that colour', () => {
        const data: SeatsData = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.map((h) =>
                ['SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'SP6'].includes(h.party ?? '')
                    ? { ...h, party: 'UDA' }
                    : h,
            ),
        };
        const c = view(data);
        // MCA seats in the fixtures still have parties without a colour of their own.
        const mcaOther = buildLegend(themed(data, 'dark'), 'mca', null, []).rows.some(
            (r) => r.key === 'other',
        );
        expect(c.key.some((k) => k.key === 'other')).toBe(mcaOther);
        expect(new Set(c.key.map((k) => k.colour))).toEqual(
            mapColours(c, data, 'dark'),
        );
    });

    it('says when a seat has no approved holder, in the no-data colour the maps use', () => {
        const data: SeatsData = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.filter(
                (h) => !(h.seat === 'governor' && h.code === 47),
            ),
        };
        const c = view(data);
        expect(c.vacant).toBe(1);
        expect(c.key.at(-1)).toMatchObject({
            key: 'none',
            label: 'No approved holder yet',
            colour: THEMES.dark.noData,
            count: 1,
        });
        const onMaps = mapColours(c, data, 'dark');
        onMaps.add(THEMES.dark.noData);
        expect(new Set(c.key.map((k) => k.colour))).toEqual(onMaps);
        expect(card.key.some((k) => k.key === 'none')).toBe(false);
    });

    it(`folds the parties with the fewest seats into "Other parties" past ${KEY_MAX} entries, on the maps too, and says how many`, () => {
        const data = manyParties(20);
        const c = view(data);
        expect(c.key.length).toBeLessThanOrEqual(KEY_MAX);
        expect(c.folded.length).toBeGreaterThan(0);
        // The smallest go first; independents are never folded (they are not a party).
        expect(c.folded).toContain('P20');
        expect(c.folded).not.toContain('IND');
        expect(c.key.some((k) => k.key === 'IND')).toBe(true);
        for (const p of c.folded) expect(c.key.some((k) => k.key === p)).toBe(false);
        // The maps draw them in the Other grey, so every colour is still named, both ways.
        expect(new Set(c.key.map((k) => k.colour))).toEqual(
            mapColours(c, data, 'dark'),
        );
        expect(fiveSeatsKeyNote(c)).toBe(
            `${FIVE_SEATS_KEY_NOTE}. The ${c.folded.length} with the fewest are drawn as Other parties.`,
        );
        expect(fiveSeatsKeyNote(card)).toBe(FIVE_SEATS_KEY_NOTE);
        expect(card.folded).toEqual([]);
    });
});

describe('the five maps', () => {
    it('are five slots, one per seat in ballot order, each with nothing focused or highlighted', () => {
        for (const size of SIZES) {
            const slots = mapSlotsOf(size, card, text(card));
            expect(slots.map((s) => s.key)).toEqual([...BALLOT]);
            expect(slots.map((s) => s.spec.seat)).toEqual([...BALLOT]);
            for (const s of slots) {
                expect(s.spec.focus).toBeNull();
                expect(s.spec.only).toEqual([]);
                expect(s.spec.colouring).toBeUndefined();
                expect(s.spec.stripes).toBeFalsy();
            }
            const l = layoutOf(size, card, text(card)) as FiveSeatsLayout;
            expect(slots.map((s) => s.box)).toEqual(l.maps.map((m) => m.box));
        }
    });

    it('are the same size and lined up, so they are drawn at one scale', () => {
        for (const size of SIZES) {
            const boxes = mapSlotsOf(size, card, text(card)).map((s) => s.box);
            for (const b of boxes) {
                expect(b.w, size).toBe(boxes[0].w);
                expect(b.h, size).toBe(boxes[0].h);
            }
            // Three across in both sizes. A row's maps share a top; a column's share a left edge.
            const across = 3;
            for (let i = 0; i < boxes.length; i++) {
                const row = Math.floor(i / across);
                const col = i % across;
                expect(boxes[i].y).toBe(boxes[row * across].y);
                expect(boxes[i].x).toBe(boxes[col].x);
            }
        }
    });

    it('colour each seat as the seat view does, with no colouring of the card’s own', () => {
        const data = themed(NUMBERS_SEATS, 'dark');
        for (const slot of mapSlotsOf('square', card, text(card))) {
            const plain = viewColouring(
                { seat: slot.spec.seat, only: [], focus: null, showSurroundings: false },
                data,
                THEMES.dark,
            );
            expect(viewColouring(slot.spec, data, THEMES.dark)).toEqual(plain);
        }
    });

    it('draw the folded parties in the Other grey', () => {
        const data = manyParties(20);
        const c = view(data);
        const mca = mapSlotsOf('square', c, text(c)).find((s) => s.key === 'mca')!;
        const colouring = viewColouring(mca.spec, themed(data, 'dark'), THEMES.dark);
        const p20 = data.holders.find((h) => h.seat === 'mca' && h.party === 'P20')!;
        expect(colouring.colours.get(p20.code)).toBe(OTHER);
    });

    it('leave out ward lines, so the MCA map reads as fills at its small size', () => {
        const ctx = {
            manifest: {},
            provinceOfCounty: new Map<number, number>(),
            index,
            seats: NUMBERS_SEATS,
        };
        const mca = mapSlotsOf('square', card, text(card)).find((s) => s.key === 'mca')!;
        const ids = viewStyle(mca.spec, ctx, THEMES.dark).layers.map((l) => l.id);
        expect(ids).toContain('wards-fill');
        expect(ids.some((id) => id.startsWith('wards-line'))).toBe(false);
        expect(ids).toContain('counties-line');
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
    return { x: t.anchor === 'end' ? t.x - w : t.x, y: t.y - t.size * 0.8, w, h: t.size };
};
const texts = (l: FiveSeatsLayout): TextItem[] => [
    l.scopeLine,
    ...l.maps.flatMap((m) => m.title),
    ...l.key.title,
    ...l.key.entries.map((e) => e.label),
    ...l.key.note,
];
const CASES = {
    fixtures: card,
    light: view(NUMBERS_SEATS, 'light'),
    folded: view(manyParties(20)),
    foldedVacant: (() => {
        const data = manyParties(20);
        return view({
            ...data,
            holders: data.holders.filter((h) => !(h.seat === 'mca' && h.code < 3)),
        });
    })(),
    vacant: view({
        ...NUMBERS_SEATS,
        holders: NUMBERS_SEATS.holders.filter(
            (h) => !(h.seat === 'mp' && h.code < 4),
        ),
    }),
};

describe('fiveSeatsLayout', () => {
    it('keeps everything on the card, apart, and whole, in both sizes', () => {
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                const where = `${name} ${size}`;
                const boxes: (readonly [string, Box])[] = [
                    ...texts(l).map((t) => [t.text, textBox(t)] as const),
                    ...l.maps.map((m) => [`map ${m.seat}`, m.box] as const),
                    ...l.maps.map((m) => [`rule ${m.seat}`, m.rule] as const),
                    ['key rule', l.key.rule],
                    ...l.key.entries.map((e) => [`chip ${e.key}`, e.chip] as const),
                    ['footer', l.footerBox],
                    ...l.headlineLines.map(
                        (t) => [t.text, textBox(t, HEADLINE_STRETCH)] as const,
                    ),
                ];
                for (const [t, b] of boxes) {
                    expect(t, where).not.toContain('…');
                    expect(inside(b, l.w, l.h), `${where} "${t}"`).toBe(true);
                }
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(
                            apart(boxes[i][1], boxes[j][1]),
                            `${where}: "${boxes[i][0]}" and "${boxes[j][0]}"`,
                        ).toBe(true);
                expect(l.headlineLines.map((t) => t.text).join(' ')).toBe(
                    FIVE_SEATS_HEADLINE,
                );
                expect(l.scopeLine.text).toBe(fiveSeatsScope(c));
                // Every key entry, whole and in the card's order.
                expect(l.key.entries.map((e) => e.label.text)).toEqual(
                    c.key.map((k) => k.label),
                );
                expect(l.key.entries.map((e) => e.chip.colour)).toEqual(
                    c.key.map((k) => k.colour),
                );
                expect(l.key.note.map((t) => t.text).join(' ')).toBe(
                    fiveSeatsKeyNote(c),
                );
            }
    });

    it('puts the five maps in a grid of three across and two down, in both sizes, with the key in the sixth cell when it fits there', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(l.maps.map((m) => m.seat)).toEqual([...BALLOT]);
            // Three across, two down: Governors, Senators, Woman Reps / MPs, MCAs.
            const rows = [...new Set(l.maps.map((m) => m.rule.y))];
            expect(rows, size).toHaveLength(2);
            expect(l.maps.slice(0, 3).every((m) => m.rule.y === rows[0])).toBe(true);
            expect(l.maps.slice(3).every((m) => m.rule.y === rows[1])).toBe(true);
            expect(l.maps[3].rule.x).toBe(l.maps[0].rule.x);
            expect(l.maps[4].rule.x).toBe(l.maps[1].rule.x);
            // Each cell: its seat's ballot colour as a rule, "Governors" bold and "47 seats".
            for (const [i, m] of l.maps.entries()) {
                expect(m.title.map((t) => t.text)).toEqual([
                    card.maps[i].label,
                    `${card.maps[i].seats.toLocaleString('en-GB')} seats`,
                ]);
                expect(m.title[0].weight).toBe(700);
                expect(m.rule.y).toBeLessThan(m.title[0].y - m.title[0].size);
                expect(m.box.y).toBeGreaterThan(m.title[0].y);
            }
            expect(l.key.title.map((t) => t.text)).toEqual(['Party colours']);
        }
        // The square: the key is the sixth cell (its entries fit there in two columns).
        const sq = layout(card, 'square');
        expect(sq.key.across).toBe(false);
        expect(sq.key.rule.x).toBe(sq.maps[2].rule.x);
        expect(sq.key.rule.w).toBe(sq.maps[2].rule.w);
        expect(sq.key.rule.y).toBe(sq.maps[3].rule.y);
    });

    it('puts the story’s key across the full width under the grid, in three or four columns, when two columns do not fit in the sixth cell', () => {
        for (const [name, c] of Object.entries(CASES)) {
            const l = layout(c, 'story');
            const cellW = l.maps[0].rule.w;
            // Two columns of the key at the card's small text are wider than a cell.
            const widest = Math.max(
                ...l.key.entries.map((e) => e.label.x + textWidth(e.label.text, e.label.size) - e.chip.x),
            );
            expect(2 * widest, name).toBeGreaterThan(cellW);
            expect(l.key.across, name).toBe(true);
            // The sixth cell is left empty, nothing centred: the maps stay in their columns.
            expect(l.maps[3].rule.x).toBe(l.maps[0].rule.x);
            expect(l.key.rule.x).toBe(l.maps[0].rule.x);
            expect(l.key.rule.x + l.key.rule.w).toBe(l.maps[2].rule.x + l.maps[2].rule.w);
            // Under the grid.
            const gridBottom = Math.max(...l.maps.map((m) => m.box.y + m.box.h));
            expect(l.key.rule.y).toBeGreaterThan(gridBottom);
            const xs = new Set(l.key.entries.filter((e) => e.key !== 'none').map((e) => e.chip.x));
            expect([3, 4], name).toContain(xs.size);
        }
    });

    it('keeps every key entry inside the key’s own width, in every case and size', () => {
        expect(CASES.foldedVacant.folded.length).toBeGreaterThan(0);
        expect(CASES.foldedVacant.key.at(-1)!.key).toBe('none');
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                const right = l.key.rule.x + l.key.rule.w;
                for (const e of l.key.entries) {
                    expect(e.chip.x, `${name} ${size} ${e.key}`).toBeGreaterThanOrEqual(l.key.rule.x);
                    expect(
                        e.label.x + textWidth(e.label.text, e.label.size),
                        `${name} ${size} ${e.label.text}`,
                    ).toBeLessThanOrEqual(right);
                }
                for (const t of l.key.note) {
                    const w = textWidth(t.text, t.size);
                    const x0 = t.anchor === 'end' ? t.x - w : t.x;
                    expect(x0, `${name} ${size} note`).toBeGreaterThanOrEqual(l.key.rule.x);
                    expect(x0 + w, `${name} ${size} note`).toBeLessThanOrEqual(right);
                }
            }
    });

    it('never makes the key smaller than the card’s small text, two columns in a cell', () => {
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                for (const e of l.key.entries)
                    expect(e.label.size, `${name} ${size}`).toBeGreaterThanOrEqual(
                        SPECS[size].callout.sub,
                    );
                const xs = new Set(l.key.entries.filter((e) => e.key !== 'none').map((e) => e.chip.x));
                if (!l.key.across) expect(xs.size, `${name} ${size}`).toBeLessThanOrEqual(2);
            }
    });

    it('gives the maps the room there is: at least 230 wide on the square and 240 on the story', () => {
        expect(layout(card, 'square').maps[0].box.w).toBeGreaterThanOrEqual(230);
        expect(layout(card, 'story').maps[0].box.w).toBeGreaterThanOrEqual(240);
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(new Set(l.maps.map((m) => `${m.box.w}x${m.box.h}`)).size).toBe(1);
        }
    });

    it('sets the same gap between every title’s name and its count', () => {
        for (const size of SIZES) {
            const l = layout(card, size);
            expect(new Set(l.maps.map((m) => m.titleGap)).size, size).toBe(1);
            expect(l.maps[0].titleGap).toBeGreaterThan(0);
        }
    });

    it('puts the headline on one line when it fits there, and never leaves a word alone on the last', () => {
        expect(layout(card, 'square').headlineLines.map((t) => t.text)).toEqual([
            FIVE_SEATS_HEADLINE,
        ]);
        const story = layout(card, 'story').headlineLines;
        expect(story.length).toBe(2);
        expect(story.at(-1)!.text).toContain(' ');
        const note = layout(card, 'story').key.note;
        if (note.length > 1) expect(note.at(-1)!.text).toContain(' ');
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
                ...l.headlineLines.map((t): [TextItem, number] => [t, HEADLINE_STRETCH]),
                ...[...texts(l), ...footer.lines].map((t): [TextItem, number] => [t, 1]),
            ];
            for (const [t, stretch] of all) {
                const b = textBox(t, stretch);
                expect(b.x + b.w, t.text).toBeLessThanOrEqual(960);
                expect(t.y, t.text).toBeLessThanOrEqual(1520);
            }
            for (const m of l.maps) {
                expect(m.box.y + m.box.h).toBeLessThanOrEqual(1520);
                expect(m.box.x + m.box.w).toBeLessThanOrEqual(960);
            }
            expect(l.headline.y).toBeGreaterThanOrEqual(120);
        }
    });
});

describe('FiveSeatsCard', () => {
    const images = Object.fromEntries(
        BALLOT.map((s) => [s, `data:image/png;base64,${s.toUpperCase()}`]),
    );
    const draw = (
        c: FiveSeatsCardView,
        size: (typeof SIZES)[number] = 'square',
        mapImages: Record<string, string> = images,
    ) =>
        mount(FiveSeatsCard, {
            props: {
                view: c,
                size,
                headline: FIVE_SEATS_HEADLINE,
                mapImage: null,
                mapImages,
                mapPlaceholder: 'Drawing the map…',
                mapAspect: 0.82,
                url: URL,
                theme: THEMES.light,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(card, 'square').attributes('viewBox')).toBe('0 0 1080 1080');
        expect(draw(card, 'story').attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('draws the five maps from their slots’ images, with the key, the source, date and link', () => {
        const w = draw(card);
        expect(
            w.findAll('image[data-map]').map((i) => [i.attributes('data-map'), i.attributes('href')]),
        ).toEqual(BALLOT.map((s) => [s, images[s]]));
        const text = w.text();
        expect(text).toContain('Kenya’s five elected seats, by party');
        expect(text).toContain('Who holds each seat now, from 47 counties to 1,450 wards');
        expect(text).toContain('Woman Reps');
        expect(text).toContain('1,450 seats');
        expect(text).toContain('Party colours');
        expect(text).toContain('Independent');
        expect(text).toContain('Other parties');
        expect(text).toContain(FIVE_SEATS_KEY_NOTE);
        expect(text).toContain('Source: IEBC gazette notices.');
        expect(text).toContain('Data as of 16 July 2026.');
        expect(text).toContain('Boundaries:');
        expect(text).toContain('example.org');
        expect(w.findAll('[data-key-entry]')).toHaveLength(card.key.length);
    });

    it('draws each title as one line of text, the count a span after the name, so the browser sets the gap', () => {
        for (const size of SIZES) {
            const w = draw(card, size);
            const l = layout(card, size);
            for (const m of l.maps) {
                const title = w.get(`[data-seat="${m.seat}"] [data-title]`);
                const spans = title.findAll('tspan');
                expect(spans.map((t) => t.text())).toEqual(m.title.map((t) => t.text));
                expect(spans[0].attributes('font-weight')).toBe('700');
                // The count follows the name where the browser ends it, then the gap.
                expect(spans[1].attributes('x')).toBeUndefined();
                expect(spans[1].attributes('dx')).toBe(String(m.titleGap));
            }
        }
    });

    it('says a map is being drawn where its image has not come yet', () => {
        const w = draw(card, 'square', { governor: images.governor });
        expect(w.findAll('image[data-map]')).toHaveLength(1);
        expect(w.text().match(/Drawing the map…/g)).toHaveLength(4);
    });

    it('marks sample data as sample', () => {
        expect(draw({ ...card, sample: true }).text()).toContain('SAMPLE DATA');
        expect(draw(card).find('[data-watermark]').exists()).toBe(false);
    });
});

describe('sharing "Five seats"', () => {
    it('comes in square and story, with an editable headline, its own copy, file name and component', () => {
        expect(sizesOf(card)).toEqual(['square', 'story']);
        expect(headlineEditable(card)).toBe(true);
        // No numbers in its headline, so the dialog does not ask to keep to them.
        expect(headlineWording(card)).toEqual({
            hint: 'Keep it to the facts, so the image stays neutral.',
            reset: 'Use the default again',
        });
        expect(headlineOf(card)).toBe(FIVE_SEATS_HEADLINE);
        expect(shareCards([card]).map((c) => [c.key, c.label])).toEqual([
            ['fiveSeats', 'Five seats'],
        ]);
        expect(dialogCopy(card)).toEqual({
            title: 'Share five seats',
            description:
                'All five elected seats on one card, each map coloured by party, sized for Instagram or stories.',
        });
        expect(filenameOf(card, 'story')).toBe('kenya-electoral-map-five-seats-story.png');
        expect(componentOf(card)).toBe(FiveSeatsCard);
    });

    it('is taken again from the seats in the other theme', () => {
        const ctx = { seats: NUMBERS_SEATS, index };
        const light = inTheme(card, 'light', ctx) as FiveSeatsCardView;
        expect(light.theme).toBe('light');
        expect(light.key.find((k) => k.key === 'IND')!.colour).toBe(
            THEMES.light.independent,
        );
    });

    it('writes a caption with a line per seat and the key on Instagram, and stays within 280 on X', () => {
        const ig = fiveSeatsCaption(card, URL, 'instagram');
        expect(ig).toContain(FIVE_SEATS_HEADLINE);
        expect(ig).toContain(fiveSeatsScope(card));
        const numbers = numbersCardView({
            seats: themed(NUMBERS_SEATS, 'dark'),
            index,
            theme: 'dark',
        });
        for (const r of numbers.rows) expect(ig).toContain(numbersRowLine(r));
        expect(ig).toContain(
            `Party colours, in order of seats held across all five: ${card.key.map((k) => k.label).join(', ')}.`,
        );
        expect(ig).not.toContain('drawn as Other parties');
        expect(ig).not.toContain('No approved holder');
        expect(ig).toContain('Source: IEBC gazette notices, data as of 16 July 2026.');
        expect(ig).toContain(URL);
        const x = fiveSeatsCaption(card, URL, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain(FIVE_SEATS_HEADLINE);
    });

    it('keeps "No approved holder yet" out of the party colours in the caption, says how many seats, and says what was folded', () => {
        const c = CASES.foldedVacant;
        const ig = fiveSeatsCaption(c, URL, 'instagram');
        const parties = c.key.filter((k) => k.key !== 'none').map((k) => k.label);
        expect(ig).toContain(
            `Party colours, in order of seats held across all five: ${parties.join(', ')}. The ${c.folded.length} with the fewest are drawn as Other parties.`,
        );
        expect(c.vacant).toBe(2);
        expect(ig).toContain('No approved holder yet for 2 seats.');
        const one = view({
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.filter((h) => !(h.seat === 'mp' && h.code === 1)),
        });
        expect(fiveSeatsCaption(one, URL, 'instagram')).toContain(
            'No approved holder yet for 1 seat.',
        );
    });
});
