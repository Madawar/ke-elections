import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BallotsCard from '@/components/export/BallotsCard.vue';
import {
    type BallotsCardView,
    ballotsCardView,
    ballotsHeadline,
    ballotsScopeLines,
    holderSince,
} from '@/lib/export/ballotsCard';
import { type BallotsLayout, NAME_FLOOR, ballotsLayout } from '@/lib/export/ballotsLayout';
import { ballotsCaption, xLength } from '@/lib/export/caption';
import { type Box, type TextItem, footerBlock } from '@/lib/export/layout';
import {
    componentOf,
    dialogCopy,
    filenameOf,
    headlineEditable,
    inTheme,
    layoutOf,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH, SPECS } from '@/lib/export/viewLayout';
import { viewColouring } from '@/lib/export/viewMap';
import { basisLabel, leadersFor } from '@/lib/leaders';
import { ATTRIBUTION, SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import {
    BALLOT_SEATS,
    ISUKHA_WEST,
    LONG_NAME,
    NGEI,
    index,
    placesOf,
    seatsWith,
    wardSeats,
} from './ballotsFixtures';

const SIZES = ['portrait', 'story'] as const;
const URL = 'https://example.org/ward/1046';
const BALLOT = ['governor', 'senator', 'woman_rep', 'mp', 'mca'];
const card = (
    ward = ISUKHA_WEST,
    seats = BALLOT_SEATS,
    theme: 'light' | 'dark' = 'light',
) =>
    ballotsCardView({
        seats: withIndependentColour(seats, THEMES[theme].independent),
        index,
        ward,
        theme,
    })!;
const isukha = card();
const P = placesOf(ISUKHA_WEST);
const rowsOf = (c: BallotsCardView) => c.papers.flatMap((p) => p.rows);

describe('ballotsCardView', () => {
    it('is the ward’s five seats, in ballot order whatever the data’s order, on three papers by the level each is held at', () => {
        // The data lists the MCA first and the Governor last.
        expect(BALLOT_SEATS.holders.slice(0, 5).map((h) => h.seat)).toEqual([
            'mca',
            'woman_rep',
            'mp',
            'senator',
            'governor',
        ]);
        expect(isukha.papers.map((p) => p.key)).toEqual(['county', 'constituency', 'ward']);
        expect(isukha.papers.map((p) => p.rows.map((r) => r.seat))).toEqual([
            ['governor', 'senator', 'woman_rep'],
            ['mp'],
            ['mca'],
        ]);
        // The same holders as leadersFor, regrouped.
        const leaders = leadersFor(P.ward, BALLOT_SEATS, index);
        for (const r of rowsOf(isukha)) {
            const l = leaders.find((x) => x.seat === r.seat)!;
            expect(r.name).toBe(l.holder!.name);
            expect(r.unit).toEqual({ level: l.unit.level, code: l.unit.code });
        }
    });

    it('names each seat and its place: "Kakamega County", "Shinyalu constituency", "Isukha West ward"', () => {
        expect(rowsOf(isukha).map((r) => [r.label, r.place])).toEqual([
            ['Governor', `${P.county.n} County`],
            ['Senator', `${P.county.n} County`],
            ['Woman Rep', `${P.county.n} County`],
            ['MP', `${P.constituency.n} constituency`],
            ['MCA', `${P.ward.n} ward`],
        ]);
        expect(P.ward.n).toBe('Isukha West');
        expect(P.constituency.n).toBe('Shinyalu');
        expect(P.county.n).toBe('Kakamega');
    });

    it('writes the party as "ODM, Orange Democratic Movement", an independent as "Independent", and no party where the record names none', () => {
        const rows = rowsOf(isukha);
        expect(rows[0].party).toEqual({
            line: 'ODM, Orange Democratic Movement',
            abbrev: 'ODM',
            colour: '#e07b24',
        });
        const ind = card(
            ISUKHA_WEST,
            seatsWith(wardSeats(ISUKHA_WEST, { mp: 'IND', mca: null })),
        );
        const mp = rowsOf(ind).find((r) => r.seat === 'mp')!;
        expect(mp.party).toEqual({
            line: 'Independent',
            abbrev: null,
            colour: THEMES.light.independent,
        });
        const mca = rowsOf(ind).find((r) => r.seat === 'mca')!;
        expect(mca.name).toBe('Placeholder mca 1046');
        expect(mca.party).toBeNull();
    });

    it('says how each holder came to the seat, from the panel’s own wording', () => {
        expect(rowsOf(isukha)[0].since).toBe('Elected in August 2022');
        const data = seatsWith(
            wardSeats(ISUKHA_WEST, {}, {
                mp: { basis: 'by_election', started_on: '2025-11-27' },
                governor: { basis: 'succession', started_on: '2024-03-02' },
                senator: { started_on: '' },
            }),
        );
        const rows = rowsOf(card(ISUKHA_WEST, data));
        expect(rows.find((r) => r.seat === 'mp')!.since).toBe('By-election in November 2025');
        expect(rows.find((r) => r.seat === 'governor')!.since).toBe('Succeeded in March 2024');
        expect(rows.find((r) => r.seat === 'senator')!.since).toBe('Elected');
        // The panel's words.
        expect(basisLabel('by_election')).toBe('By-election');
        expect(holderSince({ basis: 'elected', startedOn: '2022-08-25' })).toBe(
            'Elected in August 2022',
        );
    });

    it('keeps a seat with no approved holder in its place, and says so: nothing is invented', () => {
        const data = seatsWith(wardSeats(ISUKHA_WEST, {}, { senator: null, mca: null }));
        const c = card(ISUKHA_WEST, data);
        expect(rowsOf(c).map((r) => r.seat)).toEqual(BALLOT);
        for (const seat of ['senator', 'mca']) {
            const r = rowsOf(c).find((x) => x.seat === seat)!;
            expect(r.name).toBeNull();
            expect(r.party).toBeNull();
            expect(r.since).toBeNull();
        }
        expect(c.sources).toEqual(['IEBC gazette notices']);
    });

    it('frames its three maps by code: the county with the ward marked, the county with the constituency, the constituency with the ward', () => {
        expect(isukha.papers.map((p) => [p.map.frame.level, p.map.frame.code, p.map.mark])).toEqual([
            ['county', P.county.c, { level: 'ward', code: ISUKHA_WEST }],
            ['county', P.county.c, { level: 'constituency', code: P.constituency.c }],
            ['constituency', P.constituency.c, { level: 'ward', code: ISUKHA_WEST }],
        ]);
        expect(isukha.papers[0].map.frame.b).toEqual(P.county.b);
        expect(isukha.papers[2].map.frame.b).toEqual(P.constituency.b);
    });

    it('has the headline, the scope lines longest first, the date, sources and the ward’s link', () => {
        expect(ballotsHeadline(isukha)).toBe('Who represents Isukha West ward');
        expect(ballotsScopeLines(isukha)).toEqual([
            'Isukha West ward is in Shinyalu constituency, Kakamega County',
            'In Shinyalu constituency, Kakamega County',
            'In Kakamega County',
        ]);
        expect(isukha.asOf).toBe('2026-07-16');
        expect(isukha.path).toBe('/ward/1046');
        expect(isukha.sources).toEqual(['IEBC gazette notices']);
        expect(card(NGEI).path).toBe('/ward/1448');
    });

    it('is null for a code that is not a ward', () => {
        expect(ballotsCardView({ seats: BALLOT_SEATS, index, ward: 99999, theme: 'light' })).toBeNull();
    });
});

const inside = (b: Box, w: number, h: number) =>
    b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
const within = (b: Box, outer: Box) =>
    b.x >= outer.x - 0.5 &&
    b.y >= outer.y - 0.5 &&
    b.x + b.w <= outer.x + outer.w + 0.5 &&
    b.y + b.h <= outer.y + outer.h + 0.5;
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x + 0.5 ||
    b.x + b.w <= a.x + 0.5 ||
    a.y + a.h <= b.y + 0.5 ||
    b.y + b.h <= a.y + 0.5;
const textBox = (t: TextItem, stretch = 1): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600) * stretch;
    return { x: t.anchor === 'end' ? t.x - w : t.x, y: t.y - t.size * 0.8, w, h: t.size };
};
const layout = (c: BallotsCardView, size: (typeof SIZES)[number]) =>
    ballotsLayout(size, c, { headline: ballotsHeadline(c), url: URL });
const seatTexts = (l: BallotsLayout) =>
    l.papers.flatMap((p) =>
        p.seats.flatMap((s) => [...s.title, ...s.name, ...s.party, ...(s.since ? [s.since] : [])]),
    );

const LONG = (() => {
    const data = seatsWith(
        wardSeats(ISUKHA_WEST, { mp: 'NLP' }, {
            governor: { name: LONG_NAME },
            mp: { name: LONG_NAME },
            mca: { name: LONG_NAME },
        }),
    );
    return card(ISUKHA_WEST, data);
})();
const CASES = {
    isukha,
    ngei: card(NGEI),
    dark: card(ISUKHA_WEST, BALLOT_SEATS, 'dark'),
    long: LONG,
    vacant: card(ISUKHA_WEST, seatsWith(wardSeats(ISUKHA_WEST, {}, { senator: null, mp: null }))),
};

describe('ballotsLayout', () => {
    it('keeps everything on the card, apart and whole, every seat’s words inside its paper, in both sizes', () => {
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                const where = `${name} ${size}`;
                const boxes: (readonly [string, Box])[] = [
                    ...seatTexts(l).map((t) => [t.text, textBox(t)] as const),
                    ...l.papers.map((p) => [`map ${p.key}`, p.map] as const),
                    ...l.papers.flatMap((p) =>
                        p.seats.flatMap((s) => (s.chip ? [[`chip ${s.seat}`, s.chip] as const] : [])),
                    ),
                    [l.scopeLine.text, textBox(l.scopeLine)],
                    ['footer', l.footerBox],
                    ...l.headlineLines.map((t) => [t.text, textBox(t, HEADLINE_STRETCH)] as const),
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
                // Papers apart from each other, the footer and the scope line.
                for (const [i, p] of l.papers.entries()) {
                    expect(apart(p.box, l.footerBox), where).toBe(true);
                    expect(p.box.y, where).toBeGreaterThan(l.scopeLine.y);
                    if (i) expect(p.box.y, where).toBeGreaterThan(l.papers[i - 1].box.y + l.papers[i - 1].box.h);
                    expect(within(p.map, p.box), `${where} map ${p.key}`).toBe(true);
                    for (const s of p.seats) {
                        for (const t of [...s.title, ...s.name, ...s.party, ...(s.since ? [s.since] : [])])
                            expect(within(textBox(t), p.box), `${where} "${t.text}"`).toBe(true);
                        expect(within(s.edge, p.box), where).toBe(true);
                        // The words keep clear of the map.
                        for (const t of [...s.title, ...s.name, ...s.party])
                            expect(textBox(t).x + textBox(t).w, `${where} "${t.text}"`).toBeLessThanOrEqual(p.map.x - 8);
                    }
                }
            }
    });

    it('prints every name whole, exactly as the data spells it, the 45-character name included, and every party line whole', () => {
        expect(LONG_NAME).toHaveLength(45);
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES) {
                const l = layout(c, size);
                const seats = l.papers.flatMap((p) => p.seats);
                for (const [i, r] of rowsOf(c).entries()) {
                    const s = seats[i];
                    expect(s.seat).toBe(r.seat);
                    expect(s.name.map((t) => t.text).join(' '), `${name} ${size}`).toBe(
                        r.name ?? 'No approved data yet',
                    );
                    expect(s.party.map((t) => t.text).join(' ')).toBe(r.party?.line ?? '');
                    expect(s.since?.text ?? null).toBe(r.since);
                    expect(!!s.chip).toBe(!!r.party);
                }
            }
        // The long party name on the MP paper, whole.
        const mp = layout(LONG, 'portrait').papers[1].seats[0];
        expect(mp.party.map((t) => t.text).join(' ')).toBe(
            'NLP, National Liberation and Reconstruction Party of the Republic of Kenya',
        );
    });

    it('never makes a name smaller than its floor: a long name wraps rather than shrinking past it', () => {
        for (const size of SIZES) {
            const long = layout(LONG, size);
            // The short name on the same card (the Senator's) is at the card's name size.
            const base = long.papers[0].seats[1].name[0].size;
            const longName = long.papers[0].seats[0].name;
            for (const t of longName)
                expect(t.size, size).toBeGreaterThanOrEqual(Math.round(base * NAME_FLOOR));
            // Whole, on one line at its floor or wrapped onto more (never cut).
            expect(longName.map((t) => t.text).join(' ')).toBe(LONG_NAME);
        }
    });

    it('wraps a name too long for one line at its floor onto more lines, and the paper grows for it', () => {
        const longer = `${LONG_NAME} Anothersurname Yetanother`;
        const data = seatsWith(wardSeats(ISUKHA_WEST, {}, { governor: { name: longer } }));
        const c = card(ISUKHA_WEST, data);
        for (const size of SIZES) {
            const l = layout(c, size);
            const name = l.papers[0].seats[0].name;
            expect(name.length, size).toBeGreaterThanOrEqual(2);
            expect(name.map((t) => t.text).join(' ')).toBe(longer);
            expect(name[1].y).toBeGreaterThan(name[0].y);
            // The Governor's block is taller than the Senator's, which has one line.
            const [gov, sen] = l.papers[0].seats;
            expect(gov.edge.h, size).toBeGreaterThan(sen.edge.h);
        }
    });

    it('gives each seat its ballot colour as the paper’s left edge, in ballot order', () => {
        for (const size of SIZES) {
            const l = layout(isukha, size);
            expect(l.papers.flatMap((p) => p.seats.map((s) => s.seat))).toEqual(BALLOT);
            for (const p of l.papers) {
                for (const s of p.seats) {
                    expect(s.edge.colour).toBe(SEAT_COLOURS[s.seat]);
                    expect(s.edge.x).toBe(p.box.x);
                }
                // The edges run the paper's height, one after another.
                expect(p.seats[0].edge.y).toBe(p.box.y);
                expect(p.seats.at(-1)!.edge.y + p.seats.at(-1)!.edge.h).toBe(p.box.y + p.box.h);
                for (let i = 1; i < p.seats.length; i++)
                    expect(p.seats[i].edge.y).toBe(p.seats[i - 1].edge.y + p.seats[i - 1].edge.h);
            }
            // A hairline between the county's three seats.
            expect(l.papers[0].rules).toHaveLength(2);
            expect(l.papers[1].rules).toHaveLength(0);
        }
    });

    it('pads every paper alike: the same room above the first line and below the last', () => {
        for (const size of SIZES) {
            const l = layout(isukha, size);
            const tops = l.papers.map((p) => p.seats[0].title[0].y - p.seats[0].title[0].size * 0.8 - p.box.y);
            const bottoms = l.papers.map((p) => {
                const s = p.seats.at(-1)!;
                const last = s.since ?? s.party.at(-1) ?? s.name.at(-1)!;
                return p.box.y + p.box.h - last.y;
            });
            for (const t of tops) expect(Math.abs(t - tops[0]), size).toBeLessThanOrEqual(1);
            for (const b of bottoms) expect(Math.abs(b - bottoms[0]), size).toBeLessThanOrEqual(1);
        }
    });

    it('breaks the headline after "Who represents", keeping the ward’s name whole, when it takes two lines', () => {
        for (const size of SIZES) {
            const lines = layout(isukha, size).headlineLines.map((t) => t.text);
            expect(lines.join(' ')).toBe('Who represents Isukha West ward');
            if (lines.length === 2) expect(lines, size).toEqual(['Who represents', 'Isukha West ward']);
        }
        // An edited headline is laid out as it is.
        const edited = ballotsLayout('story', isukha, {
            headline: 'Isukha West ward has five elected leaders',
            url: URL,
        }).headlineLines.map((t) => t.text);
        expect(edited.join(' ')).toBe('Isukha West ward has five elected leaders');
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
                ...[l.scopeLine, ...seatTexts(l), ...footer.lines].map((t): [TextItem, number] => [t, 1]),
            ];
            for (const [t, stretch] of all) {
                const b = textBox(t, stretch);
                expect(b.x + b.w, t.text).toBeLessThanOrEqual(960);
                expect(t.y, t.text).toBeLessThanOrEqual(1520);
            }
            for (const p of l.papers) {
                expect(p.box.y + p.box.h).toBeLessThanOrEqual(1520);
                expect(p.box.x + p.box.w).toBeLessThanOrEqual(960);
            }
            expect(l.headline.y).toBeGreaterThanOrEqual(120);
        }
    });

    it('writes no word smaller than the card’s footer text', () => {
        for (const [name, c] of Object.entries(CASES))
            for (const size of SIZES)
                for (const t of seatTexts(layout(c, size)))
                    expect(t.size, `${name} ${size} ${t.text}`).toBeGreaterThanOrEqual(SPECS[size].footer.text - 1);
    });
});

describe('the ward card’s maps', () => {
    const text = (c: BallotsCardView) => ({ headline: ballotsHeadline(c), url: URL, mapAspect: 1 });
    it('are three slots, one per paper, each framed and marked by code, on the paper’s surface', () => {
        for (const size of SIZES) {
            const slots = mapSlotsOf(size, isukha, text(isukha));
            const l = layoutOf(size, isukha, text(isukha)) as BallotsLayout;
            expect(slots.map((s) => s.key)).toEqual(['county', 'constituency', 'ward']);
            expect(slots.map((s) => s.box)).toEqual(l.papers.map((p) => p.map));
            expect(slots.map((s) => [s.spec.focus?.level, s.spec.focus?.code, s.spec.mark])).toEqual([
                ['county', P.county.c, { level: 'ward', code: ISUKHA_WEST }],
                ['county', P.county.c, { level: 'constituency', code: P.constituency.c }],
                ['constituency', P.constituency.c, { level: 'ward', code: ISUKHA_WEST }],
            ]);
            for (const s of slots) {
                expect(s.spec.onSurface).toBe(true);
                expect(s.spec.showSurroundings).toBe(false);
                expect(s.spec.only).toEqual([]);
                expect(s.spec.colouring).toBeUndefined();
                // The mark's colouring: ink, never a seat's ballot colour.
                const col = viewColouring(s.spec, BALLOT_SEATS, THEMES.light);
                expect([...col.colours.values()]).toEqual([THEMES.light.ink]);
                expect(Object.values(SEAT_COLOURS)).not.toContain(THEMES.light.ink);
            }
            expect(slots[1].spec.seat).toBe('mp');
            expect(slots[0].spec.seat).toBe('mca');
        }
    });

    it('keeps each map’s shape, from its frame', () => {
        const l = layout(isukha, 'portrait');
        const aspect = ([w, s, e, n]: number[]) => {
            const y = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
            return (((e - w) * Math.PI) / 180) / (y(n) - y(s));
        };
        for (const [i, p] of l.papers.entries())
            expect(p.map.w / p.map.h).toBeCloseTo(aspect(isukha.papers[i].map.frame.b), 1);
    });
});

describe('BallotsCard', () => {
    const images = {
        county: 'data:image/png;base64,COUNTY',
        constituency: 'data:image/png;base64,CONST',
        ward: 'data:image/png;base64,WARD',
    };
    const draw = (
        c: BallotsCardView,
        size: (typeof SIZES)[number] = 'portrait',
        mapImages: Record<string, string> = images,
    ) =>
        mount(BallotsCard, {
            props: {
                view: c,
                size,
                headline: ballotsHeadline(c),
                mapImage: null,
                mapImages,
                mapPlaceholder: 'Drawing the map…',
                mapAspect: 1,
                url: URL,
                theme: THEMES.light,
            },
        });

    it('draws each size with its own viewBox', () => {
        expect(draw(isukha, 'portrait').attributes('viewBox')).toBe('0 0 1080 1350');
        expect(draw(isukha, 'story').attributes('viewBox')).toBe('0 0 1080 1920');
    });

    it('draws the three papers with their seats, names, parties, maps, the source, date and link', () => {
        const w = draw(isukha);
        expect(w.findAll('[data-paper]').map((p) => p.attributes('data-paper'))).toEqual([
            'county',
            'constituency',
            'ward',
        ]);
        expect(w.findAll('[data-seat]').map((s) => s.attributes('data-seat'))).toEqual(BALLOT);
        expect(
            w.findAll('image[data-map]').map((i) => [i.attributes('data-map'), i.attributes('href')]),
        ).toEqual(Object.entries(images));
        const text = w.text();
        expect(w.findAll('[data-headline]').map((t) => t.text()).join(' ')).toBe(
            'Who represents Isukha West ward',
        );
        expect(text).toContain('Isukha West ward is in Shinyalu constituency, Kakamega County');
        expect(text).toContain('Placeholder governor');
        expect(text).toContain('Orange Democratic Movement');
        expect(text).toContain('Elected in August 2022');
        expect(text).toContain('Kakamega County');
        expect(text).toContain('Source: IEBC gazette notices.');
        expect(text).toContain('Data as of 16 July 2026.');
        expect(text).toContain('Boundaries:');
        expect(text).toContain('example.org/ward/1046');
        // Each paper is a surface panel with a hairline border.
        const paper = w.get('[data-paper="county"] rect[data-paper-box]');
        expect(paper.attributes('fill')).toBe(THEMES.light.surface);
        expect(paper.attributes('stroke')).toBe(THEMES.light.hairline);
    });

    it('draws a seat’s title as one line of text, the place a span after the seat, so the browser sets the gap', () => {
        const w = draw(isukha);
        const title = w.get('[data-seat="governor"] [data-title]');
        expect(title.findAll('tspan').map((t) => t.text())).toEqual(['Governor', 'Kakamega County']);
        expect(title.findAll('tspan')[1].attributes('x')).toBeUndefined();
    });

    it('says "No approved data yet" for a seat with no holder, with no chip', () => {
        const w = draw(CASES.vacant);
        const senator = w.get('[data-seat="senator"]');
        expect(senator.text()).toContain('No approved data yet');
        expect(senator.find('[data-chip]').exists()).toBe(false);
    });

    it('says a map is being drawn where its image has not come yet', () => {
        const w = draw(isukha, 'portrait', { county: images.county });
        expect(w.findAll('image[data-map]')).toHaveLength(1);
        expect(w.text().match(/Drawing the map…/g)).toHaveLength(2);
    });

    it('marks sample data as sample', () => {
        const w = draw({ ...isukha, sample: true });
        expect(w.text().toLowerCase()).toContain('sample');
    });
});

describe('the ward card in the registry', () => {
    it('comes in portrait and story, with an editable headline, its own copy, file name, label and component', () => {
        expect(sizesOf(isukha)).toEqual(['portrait', 'story']);
        expect(headlineEditable(isukha)).toBe(true);
        expect(dialogCopy(isukha)).toEqual({
            title: 'Share who represents this ward',
            description:
                'The five elected seats of Isukha West ward and who holds them, with sources, sized for Instagram or stories.',
        });
        expect(filenameOf(isukha, 'story')).toBe('kenya-electoral-map-ward-1046-who-represents-story.png');
        expect(shareCards([isukha]).map((c) => [c.key, c.label])).toEqual([['ballots', 'Who represents']]);
        expect(componentOf(isukha)).toBe(BallotsCard);
    });

    it('is taken again from the seats in the other theme', () => {
        const data = seatsWith(wardSeats(ISUKHA_WEST, { mp: 'IND' }));
        const light = card(ISUKHA_WEST, data, 'light');
        const ctx = { seats: data, index };
        const dark = inTheme(light, 'dark', ctx) as BallotsCardView;
        expect(dark.theme).toBe('dark');
        expect(rowsOf(dark).find((r) => r.seat === 'mp')!.party!.colour).toBe(THEMES.dark.independent);
    });

    it('writes a caption with a line per seat on Instagram, and stays within 280 on X', () => {
        const ig = ballotsCaption(isukha, URL, 'instagram');
        expect(ig).toContain('Who represents Isukha West ward');
        expect(ig).toContain('Isukha West ward is in Shinyalu constituency, Kakamega County.');
        expect(ig).toContain('Governor (Kakamega County): Placeholder governor 47 (ODM, Orange Democratic Movement). Elected in August 2022.'.replace('47', String(P.county.c)));
        expect(ig).toContain('MCA (Isukha West ward): Placeholder mca 1046 (DAP-K, Democratic Action Party-Kenya). Elected in August 2022.');
        expect(ig).toContain('Source: IEBC gazette notices, data as of 16 July 2026.');
        expect(ig).toContain(URL);
        const vacant = ballotsCaption(CASES.vacant, URL, 'instagram');
        expect(vacant).toContain(`Senator (${P.county.n} County): no approved data yet.`);
        const x = ballotsCaption(isukha, URL, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain('Who represents Isukha West ward');
    });
});
