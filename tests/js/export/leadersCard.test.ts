import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LeadersCard from '@/components/export/LeadersCard.vue';
import { leadersCaption, xLength } from '@/lib/export/caption';
import type { Box, TextItem } from '@/lib/export/layout';
import { footerBlock } from '@/lib/export/layout';
import {
    type LeadersCardView,
    countyLeaders,
    leadersCardView,
    leadersHeadline,
    leadersScopeLine,
    leadersScopeLines,
    mcaMixLabel,
} from '@/lib/export/leadersCard';
import { type LeadersLayout, leadersLayout } from '@/lib/export/leadersLayout';
import {
    captionOf,
    dialogCopy,
    headlineOf,
    inTheme,
    isLeadersCard,
    layoutOf,
    leadersLabel,
} from '@/lib/export/shareView';
import { VIEW_SIZES, type ViewSize, viewFilename } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH } from '@/lib/export/viewLayout';
import { viewColouring, viewStyle } from '@/lib/export/viewMap';
import { ATTRIBUTION, SEAT_COLOURS, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import {
    LEADERS_SEATS,
    holder,
    leadersIndex as index,
} from '../leadersFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const seats = withIndependentColour(LEADERS_SEATS, THEMES.dark.independent);
const card = (
    level: 'county' | 'constituency' | 'ward',
    code: number,
    data = seats,
) =>
    leadersCardView({
        seats: data,
        index,
        focus: { level, code },
        theme: 'dark',
    })!;
const nairobi = card('county', 47);
const mathare = card('constituency', 290);
const ngei = card('ward', 1448);
const kilifi = card('county', 3);
const URL = 'https://example.org/county/47?seat=county_seats';
const layout = (c: LeadersCardView, size: ViewSize, aspect = 1.5) =>
    leadersLayout(size, c, {
        headline: leadersHeadline(c),
        url: URL,
        mapAspect: aspect,
    });

describe('countyLeaders', () => {
    it('gives a county’s Governor, Senator and Woman Rep, in that order, each with its source', () => {
        const rows = countyLeaders(seats, index, 47);
        expect(rows.map((r) => r.seat)).toEqual([
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(rows.map((r) => r.holder?.name)).toEqual([
            'Placeholder governor 47',
            'Placeholder senator 47',
            'Placeholder woman_rep 47',
        ]);
        expect(rows.map((r) => r.holder?.sourceUrl)).toEqual([
            'https://archive.gazettes.africa/archive/ke/2022/sample-169.pdf',
            'https://archive.gazettes.africa/archive/ke/2022/sample-170.pdf',
            'https://www.iebc.or.ke/uploads/resources/sample-woman_rep.pdf',
        ]);
    });
});

describe('leadersCardView', () => {
    it('is "County leaders in <county>": three rows, a striped map and the link to that view', () => {
        expect(nairobi.kind).toBe('leaders');
        expect(leadersHeadline(nairobi)).toBe('County leaders in Nairobi City');
        expect(nairobi.rows.map((r) => r.seat)).toEqual([
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(nairobi.stripes).toBe(true);
        expect(nairobi.mcas).toBeNull();
        expect(nairobi.path).toBe('/county/47?seat=county_seats');
        expect(leadersScopeLine(nairobi)).toBe(
            'Striped by the parties of its Governor, Senator and Woman Rep',
        );
        expect(nairobi.focus).toMatchObject({
            level: 'county',
            code: 47,
            name: 'Nairobi City',
        });
    });

    it('is "Leaders of <constituency>": the MP, the county-wide three and the MCAs of its wards', () => {
        expect(leadersHeadline(mathare)).toBe('Leaders of Mathare');
        expect(mathare.rows.map((r) => r.seat)).toEqual([
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(mathare.stripes).toBe(false);
        expect(mathare.seat).toBe('mca');
        expect(mathare.path).toBe('/constituency/290?seat=mca');
        expect(mcaMixLabel(mathare)).toBe(
            'MCAs in 6 wards: ODM 3, UDA 2, no approved data yet 1',
        );
        expect(leadersScopeLine(mathare)).toBe(
            'Constituency in Nairobi City County',
        );
    });

    it('is "Leaders of <ward>": the MCA, the MP, then the county-wide three', () => {
        expect(leadersHeadline(ngei)).toBe('Leaders of Ngei');
        expect(ngei.rows.map((r) => r.seat)).toEqual([
            'mca',
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(ngei.mcas).toBeNull();
        expect(ngei.place).toBe(
            'Ward in Mathare constituency, Nairobi City County',
        );
        expect(ngei.path).toBe('/ward/1448?seat=mca');
    });

    it('names every source behind its rows, and the date the data describes', () => {
        expect(nairobi.source).toBe('IEBC gazette notices');
        expect(nairobi.asOf).toBe('2026-07-16');
        const other = card('county', 47, {
            ...seats,
            holders: seats.holders.map((h) =>
                h.seat === 'senator'
                    ? { ...h, source_url: 'https://www.parliament.go.ke/x' }
                    : h,
            ),
        });
        expect(other.source).toBe('IEBC gazette notices and parliament.go.ke');
        // A constituency's card shows its wards' MCAs too, so their sources count.
        const wardSource = card('constituency', 290, {
            ...seats,
            holders: seats.holders.map((h) =>
                h.seat === 'mca' && h.code === 1448
                    ? { ...h, source_url: 'https://countyassembly.example/x' }
                    : h,
            ),
        });
        expect(wardSource.sources).toContain('countyassembly.example');
    });

    it('keeps a row for a seat with no holder, and is null for a unit that is not in the directory', () => {
        expect(kilifi.rows.map((r) => !!r.holder)).toEqual([true, false, false]);
        expect(
            leadersCardView({
                seats,
                index,
                focus: { level: 'county', code: 999 },
                theme: 'dark',
            }),
        ).toBeNull();
    });

    it('follows the theme: independents take that theme’s colour', () => {
        const starehe = card('ward', 1439);
        const light = inTheme(starehe, 'light', { seats: LEADERS_SEATS, index });
        expect(isLeadersCard(light)).toBe(true);
        expect((light as LeadersCardView).rows[0].holder?.colour).toBe(
            THEMES.light.independent,
        );
        expect(starehe.rows[0].holder?.colour).toBe(THEMES.dark.independent);
        expect(inTheme(starehe, 'dark', { seats: LEADERS_SEATS, index })).toBe(
            starehe,
        );
    });
});

describe('the leaders card’s map', () => {
    const ctx = {
        manifest: {},
        provinceOfCounty: new Map([[47, 8]]),
        index,
        seats,
    };
    it('stripes a county by its three seats, in the order Governor, Senator, Woman Rep', () => {
        const col = viewColouring(nairobi, seats, THEMES.dark);
        expect(col.mode).toEqual({ kind: 'county_seats' });
        expect(col.patterns?.get(47)).toBe('stripes-e8c547-e07b24-e07b24');
        const style = viewStyle(nairobi, ctx, THEMES.dark);
        const fill = style.layers.find((l) => l.id === 'counties-fill') as {
            paint: Record<string, unknown>;
        };
        expect(JSON.stringify(fill.paint['fill-pattern'])).toContain(
            'stripes-e8c547-e07b24-e07b24',
        );
        // No ward mesh over the stripes.
        expect(style.layers.some((l) => l.id === 'wards-line')).toBe(false);
    });

    it('colours a constituency’s and a ward’s map by MCA', () => {
        for (const c of [mathare, ngei]) {
            const col = viewColouring(c, seats, THEMES.dark);
            expect(col.mode).toEqual({ kind: 'seat', seat: 'mca' });
            expect(col.colours.get(1448)).toBe('#e07b24');
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
    return { x: t.x, y: t.y - t.size * 0.8, w, h: t.size };
};
const texts = (l: LeadersLayout): TextItem[] => [
    l.scopeLine,
    ...l.blocks.flatMap((b) => b.texts),
    ...(l.mix?.label ?? []),
];
/** A card with long names and long party names in every row. */
const long = (c: LeadersCardView): LeadersCardView => ({
    ...c,
    rows: c.rows.map((r, i) => ({
        ...r,
        holder: r.holder && {
            ...r.holder,
            name: [
                'Placeholder Longer Middle Name Surname-Hyphenated',
                'Placeholder Wa Kwanza',
                'Placeholder Another Quite Long Name Indeed',
            ][i % 3],
            partyName: 'Forum for Restoration of Democracy-Kenya',
            party: 'FORD-K',
            partyLabel: 'FORD-K',
        },
    })),
});
const CARDS = [nairobi, mathare, ngei, kilifi, long(nairobi), long(mathare), long(ngei)];
const ASPECTS = [0.6, 1.05, 1.5, 2.3];

describe('leadersLayout', () => {
    it('draws one block per leader, in seat order, in all four sizes', () => {
        for (const size of SIZES) {
            expect(layout(nairobi, size).blocks.map((b) => b.seat), size).toEqual(
                ['governor', 'senator', 'woman_rep'],
            );
            expect(layout(mathare, size).blocks.map((b) => b.seat), size).toEqual(
                ['mp', 'governor', 'senator', 'woman_rep'],
            );
            expect(layout(ngei, size).blocks.map((b) => b.seat), size).toEqual([
                'mca',
                'mp',
                'governor',
                'senator',
                'woman_rep',
            ]);
        }
    });

    it('gives each block the seat’s ballot colour as its side bar, never the party’s', () => {
        for (const size of SIZES)
            expect(layout(mathare, size).blocks.map((b) => b.lid.colour)).toEqual([
                SEAT_COLOURS.mp,
                SEAT_COLOURS.governor,
                SEAT_COLOURS.senator,
                SEAT_COLOURS.woman_rep,
            ]);
    });

    it('shows the seat, the name as the data spells it, the party and its chip', () => {
        for (const size of SIZES) {
            const governor = layout(nairobi, size).blocks[0];
            const by = (role: string) =>
                governor.texts
                    .filter((t) => t.role === role)
                    .map((t) => t.text)
                    .join(' ');
            expect(by('seat'), size).toBe('Governor');
            expect(by('name'), size).toBe('Placeholder governor 47');
            expect(by('party'), size).toBe('United Democratic Alliance (UDA)');
            expect(governor.chip?.colour).toBe('#e8c547');
        }
    });

    it('says since when and gives the row’s own source on a county’s card', () => {
        for (const size of SIZES) {
            const rows = layout(nairobi, size).blocks.map((b) =>
                b.texts
                    .filter((t) => t.role === 'meta')
                    .map((t) => t.text)
                    .join(' '),
            );
            expect(rows[0], size).toBe(
                'In office since 9 August 2022. Source: archive.gazettes.africa',
            );
            expect(rows[2], size).toBe(
                'In office since 9 August 2022. Source: iebc.or.ke',
            );
        }
    });

    it('always keeps since when and the source on the unit’s own seat, whatever the room', () => {
        for (const c of [mathare, ngei])
            for (const size of SIZES)
                for (const aspect of ASPECTS) {
                    const first = layout(c, size, aspect).blocks[0];
                    expect(
                        first.texts.some((t) => t.role === 'meta'),
                        `${c.unit.name} ${size} ${aspect}`,
                    ).toBe(true);
                }
    });

    it('says where a seat held above the unit is held', () => {
        const seatsOf = (l: LeadersLayout) =>
            l.blocks.map((b) =>
                b.texts
                    .filter((t) => t.role === 'seat')
                    .map((t) => t.text)
                    .join(' '),
            );
        expect(seatsOf(layout(ngei, 'story'))).toEqual([
            'Member of County Assembly',
            'Member of the National Assembly (Mathare constituency)',
            'Governor (Nairobi City, county-wide)',
            'Senator (Nairobi City, county-wide)',
            'Woman Representative (Nairobi City, county-wide)',
        ]);
    });

    it('reads "No approved data yet" for a seat with no holder, with no chip and nothing invented', () => {
        for (const size of SIZES) {
            const senator = layout(kilifi, size).blocks[1];
            expect(senator.texts.map((t) => t.text)).toEqual([
                'Senator',
                'No approved data yet',
            ]);
            expect(senator.chip).toBeNull();
        }
    });

    it('never cuts a name or a party: they shrink a little, then wrap', () => {
        for (const c of CARDS)
            for (const size of SIZES)
                for (const aspect of ASPECTS) {
                    const l = layout(c, size, aspect);
                    l.blocks.forEach((b, i) => {
                        const row = c.rows[i];
                        if (!row.holder) return;
                        const name = b.texts
                            .filter((t) => t.role === 'name')
                            .map((t) => t.text)
                            .join(' ');
                        expect(name, `${size} ${aspect}`).toBe(row.holder.name);
                        for (const t of b.texts)
                            expect(t.text, `${size} ${aspect}`).not.toContain(
                                '…',
                            );
                    });
                }
    });

    it('draws a constituency’s MCAs as one bar: a part per party, then the wards with no MCA', () => {
        for (const size of SIZES) {
            const mix = layout(mathare, size).mix!;
            expect(mix.label.map((t) => t.text).join(' '), size).toBe(
                'MCAs in 6 wards: ODM 3, UDA 2, no approved data yet 1',
            );
            expect(mix.bar.map((s) => s.key)).toEqual(['ODM', 'UDA', 'none']);
            expect(mix.bar.map((s) => s.colour)).toEqual([
                '#e07b24',
                '#e8c547',
                THEMES.dark.noData,
            ]);
            // Widths in proportion to the wards: 3, 2 and 1 of 6.
            const [odm, uda, none] = mix.bar.map((s) => s.w);
            expect(odm / none).toBeGreaterThan(2.7);
            expect(uda / none).toBeGreaterThan(1.8);
            expect(layout(nairobi, size).mix).toBeNull();
            expect(layout(ngei, size).mix).toBeNull();
        }
    });

    it('keeps every block on the card and apart, and no two lines of text overlap', () => {
        for (const c of CARDS)
            for (const size of SIZES)
                for (const aspect of ASPECTS) {
                    const l = layout(c, size, aspect);
                    const where = `${c.unit.name} ${size} ${aspect}`;
                    const blocks: [string, Box][] = [
                        ['headline', l.headline],
                        ['map', l.map],
                        ['footer', l.footerBox],
                        ...l.blocks.map(
                            (b): [string, Box] => [`block ${b.seat}`, b.box],
                        ),
                        ...(l.mix ? ([['mix', l.mix.box]] as [string, Box][]) : []),
                    ];
                    for (const [name, b] of blocks)
                        expect(inside(b, l.w, l.h), `${where} ${name}`).toBe(true);
                    for (let i = 0; i < blocks.length; i++)
                        for (let j = i + 1; j < blocks.length; j++)
                            expect(
                                apart(blocks[i][1], blocks[j][1]),
                                `${where}: ${blocks[i][0]} and ${blocks[j][0]}`,
                            ).toBe(true);
                    const boxes = texts(l).map(
                        (t) => [t.text, textBox(t)] as const,
                    );
                    for (const [text, b] of boxes)
                        expect(inside(b, l.w, l.h), `${where} "${text}"`).toBe(
                            true,
                        );
                    for (let i = 0; i < boxes.length; i++)
                        for (let j = i + 1; j < boxes.length; j++)
                            expect(
                                apart(boxes[i][1], boxes[j][1]),
                                `${where}: "${boxes[i][0]}" and "${boxes[j][0]}"`,
                            ).toBe(true);
                    expect(l.map.w, where).toBeGreaterThan(l.w * 0.2);
                    expect(l.map.h, where).toBeGreaterThan(l.h * 0.12);
                }
    });

    it('keeps story text out of the zones TikTok and Reels cover', () => {
        for (const c of CARDS)
            for (const aspect of ASPECTS) {
                const l = layout(c, 'story', aspect);
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

    it('never cuts the line under the headline: it takes the longest wording that fits', () => {
        expect(leadersScopeLines(ngei)).toEqual([
            'Ward in Mathare constituency, Nairobi City County',
            'Ward in Nairobi City County',
            'Ward',
        ]);
        expect(leadersScopeLines(nairobi)[0]).toBe(
            'Striped by the parties of its Governor, Senator and Woman Rep',
        );
        for (const c of CARDS)
            for (const size of SIZES)
                for (const aspect of ASPECTS) {
                    const line = layout(c, size, aspect).scopeLine.text;
                    expect(line, `${c.unit.name} ${size}`).not.toContain('…');
                    expect(leadersScopeLines(c)).toContain(line);
                }
        // With the room, it is the full wording.
        expect(layout(ngei, 'story').scopeLine.text).toBe(
            'Ward in Mathare constituency, Nairobi City County',
        );
        expect(layout(nairobi, 'square').scopeLine.text).toBe(
            'Striped by the parties of its Governor, Senator and Woman Rep',
        );
    });

    it('is what the share dialog lays out for a leaders card', () => {
        const text = { headline: leadersHeadline(nairobi), url: URL, mapAspect: 1.5 };
        expect(layoutOf('square', nairobi, text)).toEqual(
            leadersLayout('square', nairobi, text),
        );
    });
});

describe('LeadersCard', () => {
    const mountCard = (view: LeadersCardView, size: ViewSize = 'portrait') =>
        mount(LeadersCard, {
            props: {
                view,
                size,
                headline: leadersHeadline(view),
                mapImage: 'data:image/png;base64,AAAA',
                url: URL,
                theme: THEMES.dark,
                mapAspect: 1.5,
            },
        });

    it('draws each size with its own viewBox', () => {
        for (const size of SIZES) {
            const svg = mountCard(nairobi, size).get('svg');
            const { w, h } = VIEW_SIZES[size];
            expect(svg.attributes('viewBox')).toBe(`0 0 ${w} ${h}`);
        }
    });

    it('shows the headline, the three holders in order, the source, the date and the link', () => {
        const w = mountCard(nairobi);
        expect(
            w
                .findAll('[data-headline]')
                .map((t) => t.text())
                .join(' '),
        ).toBe('County leaders in Nairobi City');
        expect(
            w.findAll('[data-leader]').map((g) => g.attributes('data-leader')),
        ).toEqual(['governor', 'senator', 'woman_rep']);
        const text = w.text();
        expect(text).toContain('Placeholder governor 47');
        expect(text).toContain('United Democratic Alliance (UDA)');
        expect(text).toContain('In office since 9 August 2022');
        expect(text).toContain('IEBC gazette notices');
        expect(text).toContain('Data as of 16 July 2026');
        expect(text).toContain('example.org/county/47?seat=county_seats');
        expect(w.find('[data-map]').attributes('href')).toContain('data:image');
        expect(w.find('[data-mca-mix]').exists()).toBe(false);
    });

    it('adds the MCA mix on a constituency’s card', () => {
        const w = mountCard(mathare);
        // The line may take two lines of text: read them joined.
        expect(
            w
                .get('[data-mca-mix]')
                .findAll('text')
                .map((t) => t.text())
                .join(' '),
        ).toBe('MCAs in 6 wards: ODM 3, UDA 2, no approved data yet 1');
        expect(w.get('[data-mca-mix]').findAll('rect')).toHaveLength(3);
    });

    it('says "No approved data yet" where a seat has no holder', () => {
        expect(mountCard(kilifi).get('[data-leader="senator"]').text()).toContain(
            'No approved data yet',
        );
    });

    it('marks sample data as sample', () => {
        const sample = mountCard({ ...nairobi, sample: true });
        expect(sample.text().toLowerCase()).toContain('sample');
        expect(mountCard(nairobi).text().toLowerCase()).not.toContain('sample');
    });
});

describe('sharing a leaders card', () => {
    it('has its own headline, dialog copy, label and file name', () => {
        expect(headlineOf(nairobi)).toBe('County leaders in Nairobi City');
        expect(dialogCopy(nairobi)).toEqual({
            title: 'Share leaders card',
            description:
                'Who represents Nairobi City, with sources, sized for Instagram, stories or X.',
        });
        expect(leadersLabel(nairobi)).toBe('County leaders');
        expect(leadersLabel(mathare)).toBe('Leaders');
        expect(viewFilename(nairobi, 'square')).toBe(
            'kenya-electoral-map-leaders-county-47-square.png',
        );
        expect(viewFilename(ngei, 'story')).toBe(
            'kenya-electoral-map-leaders-ward-1448-story.png',
        );
    });

    it('captions it with each seat and its holder, the source, the date, the link and the tags', () => {
        const caption = leadersCaption(mathare, 'https://example.org/c/290');
        expect(caption.split('\n')).toEqual([
            'Leaders of Mathare',
            '',
            'Member of the National Assembly: Placeholder mp 290 (ODM)',
            'Governor (Nairobi City, county-wide): Placeholder governor 47 (UDA)',
            'Senator (Nairobi City, county-wide): Placeholder senator 47 (ODM)',
            'Woman Representative (Nairobi City, county-wide): Placeholder woman_rep 47 (ODM)',
            'MCAs in 6 wards: ODM 3, UDA 2, no approved data yet 1',
            '',
            'Source: IEBC gazette notices, data as of 16 July 2026.',
            'https://example.org/c/290',
            '',
            '#Kenya2027 #KenyaDecides',
        ]);
        expect(captionOf(mathare, 'https://example.org/c/290', 'instagram', 'Leaders of Mathare')).toBe(caption);
    });

    it('says when a seat has no holder, and keeps the X caption within 280', () => {
        expect(leadersCaption(kilifi, 'https://example.org/c/3')).toContain(
            'Senator: no approved data yet',
        );
        const x = leadersCaption(nairobi, 'https://example.org/county/47', 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain('County leaders in Nairobi City');
        expect(x).toContain('Source: IEBC gazette notices');
    });

    it('never puts a holder on the card that the data does not have', () => {
        const none = card('county', 47, { ...seats, holders: [] });
        expect(none.rows.every((r) => r.holder === null)).toBe(true);
        const l = layout(none, 'square');
        expect(
            l.blocks.map((b) => b.texts.map((t) => t.text).join(' | ')),
        ).toEqual([
            'Governor | No approved data yet',
            'Senator | No approved data yet',
            'Woman Representative | No approved data yet',
        ]);
        expect(holder('governor', 'county', 47, 'UDA').name).toContain(
            'Placeholder',
        );
    });
});
