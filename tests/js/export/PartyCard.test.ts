import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import PartyCard from '@/components/export/PartyCard.vue';
import { partyCaption, xLength } from '@/lib/export/caption';
import { footerBlock, type TextItem } from '@/lib/export/layout';
import {
    partyCardView,
    partyHeadline,
    partyScopeLine,
} from '@/lib/export/partyCard';
import { type PartyLayout, partyLayout } from '@/lib/export/partyLayout';
import { VIEW_SIZES, type ViewSize, viewFilename } from '@/lib/export/sizes';
import { textWidth } from '@/lib/export/text';
import { HEADLINE_STRETCH, SPECS, type Box } from '@/lib/export/viewLayout';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { seatsInTheme } from '@/lib/export/viewState';
import { partyProfile } from '@/lib/party';
import type { PartyScope } from '@/lib/map/urls';
import type { Holder, SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';
import { HOLDERS, PARTIES, PARTY_SEATS, seatsFrom } from '../party/partyFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const units: Unit[] = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../public/boundaries/units.json'), 'utf8'),
);
const index = UnitIndex.fromRows(units);
const NAIROBI = { level: 'county', code: 47 } as const;
const MATHARE = { level: 'constituency', code: 290 } as const;
const card = (
    abbrev: string,
    seats: SeatsData = PARTY_SEATS,
    theme: 'dark' | 'light' = 'dark',
    scope: PartyScope = null,
) =>
    partyCardView({ seats: seatsInTheme(seats, theme), abbrev, theme, index, scope })!;
const URL = 'https://example.org/party/uda';
const text = (card_: ReturnType<typeof card>) => ({
    headline: partyHeadline(card_),
    url: `https://example.org${card_.path}`,
    mapAspect: card_.focus ? 1.1 : 0.82,
});

// A party that holds every seat of every kind: the widest "n of N (100%)" there can be.
const ALL: Holder[] = HOLDERS.filter((h) => h.party !== 'IND').map((h) => ({
    ...h,
    party: 'UDA',
}));
const EVERYTHING = seatsFrom(ALL);
// A long name and a hyphenated abbreviation.
const LONG = seatsFrom(HOLDERS.map((h) => (h.party === 'DP' ? { ...h, party: 'FORD-K' } : h)), {
    parties: [
        ...PARTIES,
        {
            abbrev: 'FORD-K',
            name: 'Forum for Restoration of Democracy-Kenya',
            coalition_2022: null,
            colour: '#8e6bb0',
        },
    ],
});

describe('partyCardView', () => {
    it('is the profile as a card: seven rows in the profile\'s order, with its counts', () => {
        const c = card('UDA');
        const p = partyProfile(PARTY_SEATS, 'UDA')!;
        expect(c.kind).toBe('partyCard');
        expect(c.rows.map((r) => r.key)).toEqual(p.rows.map((r) => r.seat));
        expect(c.rows.map((r) => r.label)).toEqual([
            'Governors',
            'Senators',
            'Woman Reps',
            'MPs',
            'MCAs',
            'Nominated MPs',
            'Nominated Senators',
        ]);
        expect(c.rows[0]).toMatchObject({
            count: 20,
            total: 47,
            value: '20 of 47 (43%)',
        });
        expect(c.rows[4].value).toBe('517 of 1,450 (36%)');
        expect(c.colour).toBe('#e8c547');
        expect(c.path).toBe('/party/uda');
        expect(c.asOf).toBe('2026-07-16');
    });

    it('says "<ABBREV> seats across Kenya" and names the party in the line under it', () => {
        const c = card('WDM-K');
        expect(partyHeadline(c)).toBe('WDM-K seats across Kenya');
        expect(partyScopeLine(c)).toBe('Wiper Patriotic Front, seats held now');
    });

    it('follows the scope: the headline, the map\'s focus, the link and the file name', () => {
        const c = card('UDA', PARTY_SEATS, 'dark', NAIROBI);
        expect(partyHeadline(c)).toBe('UDA seats in Nairobi City');
        expect(c.scope).toEqual({ level: 'county', code: 47, name: 'Nairobi City' });
        expect(c.focus).toMatchObject({ level: 'county', code: 47, name: 'Nairobi City' });
        expect(c.focus!.b).toEqual(index.get('county', 47)!.b);
        expect(c.path).toBe('/party/uda?in=county-47');
        expect(viewFilename(c, 'story')).toBe('kenya-electoral-map-mca-county-47-uda-story.png');
        expect(partyHeadline(card('UDA', PARTY_SEATS, 'dark', MATHARE))).toBe('UDA seats in Mathare');
        expect(card('UDA').focus).toBeNull();
        expect(card('UDA').top.length).toBeGreaterThan(0);
    });

    it('draws the map of where the party holds MCA seats, highlighting only that party', () => {
        const c = card('ODM');
        expect(c.seat).toBe('mca');
        expect(c.only).toEqual(['ODM']);
        expect(c.focus).toBeNull();
        expect(c.showSurroundings).toBe(false);
    });

    it('is not made for independents or an unknown party', () => {
        expect(partyCardView({ seats: PARTY_SEATS, abbrev: 'IND', theme: 'dark' })).toBeNull();
        expect(partyCardView({ seats: PARTY_SEATS, abbrev: 'NOPE', theme: 'dark' })).toBeNull();
    });

    it('has the file name of a party card', () => {
        expect(viewFilename(card('UDA'), 'square')).toBe(
            'kenya-electoral-map-mca-kenya-uda-square.png',
        );
    });
});

const inside = (b: Box, w: number, h: number) =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5;
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const textBox = (t: TextItem, stretch = 1): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600) * stretch;
    return {
        x: t.anchor === 'end' ? t.x - w : t.x,
        y: t.y - t.size * 0.8,
        w,
        h: t.size,
    };
};
const lines = (l: PartyLayout): TextItem[] => [
    l.scopeLine,
    ...l.rows.flatMap((r) => [r.label, r.value]),
    ...(l.list ? [...l.list.title, ...l.list.items.flatMap((i) => [i.label, i.value])] : []),
];

describe('partyLayout', () => {
    const cases: [string, ReturnType<typeof card>][] = [
        ['UDA', card('UDA')],
        ['ODM, light', card('ODM', PARTY_SEATS, 'light')],
        ['a party holding every seat', card('UDA', EVERYTHING)],
        ['a long name', card('FORD-K', LONG)],
        ['a party with no seats', card('NOSEAT')],
        ['UDA in Nairobi City', card('UDA', PARTY_SEATS, 'dark', NAIROBI)],
        ['ODM in Mathare, light', card('ODM', PARTY_SEATS, 'light', MATHARE)],
        ['a long name in a county', card('FORD-K', LONG, 'dark', NAIROBI)],
    ];

    for (const [name, c] of cases)
        for (const size of SIZES)
            it(`${name}, ${size}: every block is on the card and apart from the others`, () => {
                const l = partyLayout(size, c, text(c));
                const { w, h } = VIEW_SIZES[size];
                expect([l.w, l.h]).toEqual([w, h]);
                const blocks: [string, Box][] = [
                    ['headline', l.headline],
                    ['map', l.map],
                    ['rows', l.rowsBox],
                    ['footer', l.footerBox],
                    ...(l.list ? [['list', l.list.box] as [string, Box]] : []),
                ];
                for (const [n, b] of blocks)
                    expect(inside(b, w, h), `${n} ${JSON.stringify(b)}`).toBe(true);
                for (let i = 0; i < blocks.length; i++)
                    for (let j = i + 1; j < blocks.length; j++)
                        expect(
                            apart(blocks[i][1], blocks[j][1]),
                            `${blocks[i][0]} and ${blocks[j][0]}`,
                        ).toBe(true);
                // Seven rows, in order, each inside the rows block with its bar.
                expect(l.rows.map((r) => r.key)).toEqual(c.rows.map((r) => r.key));
                for (const r of l.rows) {
                    expect(inside(r.track, w, h)).toBe(true);
                    expect(r.track.x).toBeGreaterThanOrEqual(l.rowsBox.x);
                    expect(r.track.x + r.track.w).toBeLessThanOrEqual(l.rowsBox.x + l.rowsBox.w + 0.5);
                    expect(r.track.y + r.track.h).toBeLessThanOrEqual(l.rowsBox.y + l.rowsBox.h + 0.5);
                    expect(r.bar.w).toBeLessThanOrEqual(r.track.w);
                }
            });

    for (const [name, c] of cases)
        for (const size of SIZES)
            it(`${name}, ${size}: no two lines of text overlap, and the bars sit under their text`, () => {
                const l = partyLayout(size, c, text(c));
                const boxes = lines(l).map((t) => textBox(t));
                for (const b of boxes) expect(inside(b, l.w, l.h)).toBe(true);
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(
                            apart(boxes[i], boxes[j]),
                            `${lines(l)[i].text} and ${lines(l)[j].text}`,
                        ).toBe(true);
                // The headline is drawn at full width, about 9% wider than the metrics.
                const head = l.headlineLines.map((t) => textBox(t, HEADLINE_STRETCH));
                for (const b of head) expect(inside(b, l.w, l.h)).toBe(true);
                for (const b of head.concat(boxes))
                    expect(apart(b, l.footerBox), 'text above the footer').toBe(true);
                for (const r of l.rows) {
                    expect(apart(textBox(r.label), r.track), r.label.text).toBe(true);
                    expect(apart(textBox(r.value), r.track), r.value.text).toBe(true);
                }
                for (let i = 0; i < head.length; i++)
                    for (const b of boxes) expect(apart(head[i], b)).toBe(true);
            });

    it('draws each bar as its share of that seat, in the party colour, on a track for the whole seat', () => {
        const c = card('UDA');
        const l = partyLayout('square', c, text(c));
        const gov = l.rows[0];
        expect(gov.colour).toBe('#e8c547');
        expect(gov.bar.w / gov.track.w).toBeCloseTo(20 / 47, 2);
        const mca = l.rows[4];
        expect(mca.bar.w / mca.track.w).toBeCloseTo(517 / 1450, 2);
        // A party with none has a track and no bar
        const none = partyLayout('square', card('DP'), text(card('DP'))).rows[0];
        expect(none.bar.w).toBe(0);
    });

    it('keeps story text out of the areas the apps cover', () => {
        const c = card('UDA');
        const l = partyLayout('story', c, text(c));
        const spec = SPECS.story;
        const right = VIEW_SIZES.story.w - (spec.insetRight ?? 0);
        const all = [...lines(l).map((t) => textBox(t)), ...l.headlineLines.map((t) => textBox(t, HEADLINE_STRETCH))];
        for (const b of all) {
            expect(b.y).toBeGreaterThanOrEqual(spec.safeTop);
            expect(b.y + b.h).toBeLessThanOrEqual(VIEW_SIZES.story.h - spec.safeBottom);
            expect(b.x + b.w).toBeLessThanOrEqual(right + 0.5);
        }
        expect(l.footerBox.y + l.footerBox.h).toBeLessThanOrEqual(VIEW_SIZES.story.h - spec.safeBottom);
    });

    it('lists the top counties across Kenya only, inside the card and apart from the map', () => {
        const national = card('UDA');
        expect(national.top).toHaveLength(5);
        for (const size of SIZES) {
            const l = partyLayout(size, national, text(national));
            expect(l.list, size).not.toBeNull();
            expect(l.list!.items).toHaveLength(5);
            expect(l.list!.items.map((i) => i.label.text)).toEqual(national.top.map((c) => c.name));
            expect(apart(l.list!.box, l.map), size).toBe(true);
        }
        const county = card('UDA', PARTY_SEATS, 'dark', NAIROBI);
        expect(county.top).toEqual([]);
        for (const size of SIZES)
            expect(partyLayout(size, county, text(county)).list).toBeNull();
    });

    it('a county card has one row per seat there (five), a constituency card two', () => {
        const county = card('UDA', PARTY_SEATS, 'dark', NAIROBI);
        expect(county.rows.map((r) => r.key)).toEqual(['governor', 'senator', 'woman_rep', 'mp', 'mca']);
        expect(partyLayout('square', county, text(county)).rows).toHaveLength(5);
        const constituency = card('UDA', PARTY_SEATS, 'dark', MATHARE);
        expect(constituency.rows.map((r) => r.key)).toEqual(['mp', 'mca']);
        expect(partyLayout('story', constituency, text(constituency)).rows).toHaveLength(2);
    });

    it('gives the map the room it can use: wider than a thumbnail on every size', () => {
        const c = card('UDA');
        for (const size of SIZES) {
            const l = partyLayout(size, c, text(c));
            expect(l.map.w, size).toBeGreaterThanOrEqual(300);
            expect(l.map.h, size).toBeGreaterThanOrEqual(300);
        }
    });
});

const props = (over: Record<string, unknown> = {}) => ({
    view: card('UDA'),
    size: 'square' as ViewSize,
    headline: 'UDA seats across Kenya',
    mapImage: 'data:image/png;base64,AAAA',
    url: URL,
    theme: THEMES.dark,
    ...over,
});

describe('PartyCard', () => {
    it('draws each size with its own viewBox', () => {
        for (const size of SIZES) {
            const svg = mount(PartyCard, { props: props({ size }) }).get('svg');
            const { w, h } = VIEW_SIZES[size];
            expect(svg.attributes('viewBox')).toBe(`0 0 ${w} ${h}`);
        }
    });

    it('shows the headline, the seven rows with "n of N (p%)", the map, the source, date and link', () => {
        for (const size of SIZES) {
            const wrapper = mount(PartyCard, { props: props({ size }) });
            const t = wrapper.text();
            expect(
                wrapper.findAll('[data-headline]').map((x) => x.text()).join(' '),
            ).toBe('UDA seats across Kenya');
            expect(t, size).toContain('United Democratic Alliance, seats held now');
            expect(wrapper.findAll('[data-row]'), size).toHaveLength(7);
            expect(wrapper.get('[data-row="governor"]').text()).toContain('Governors');
            expect(wrapper.get('[data-row="governor"]').text()).toContain('20 of 47 (43%)');
            expect(wrapper.get('[data-row="nominated_senator"]').text()).toContain('Nominated Senators');
            expect(t).toContain('Source: IEBC gazette notices');
            expect(t).toContain('Data as of 16 July 2026');
            expect(t).toContain('example.org/party/uda');
            expect(wrapper.get('image[data-map]').attributes('href')).toBe('data:image/png;base64,AAAA');
        }
    });

    it('draws bars in the party colour on a hairline track', () => {
        const wrapper = mount(PartyCard, { props: props() });
        const bar = wrapper.get('[data-row="mp"] [data-bar]');
        expect(bar.attributes('fill')).toBe('#e8c547');
        expect(wrapper.get('[data-row="mp"] [data-track]').attributes('fill')).toBe(THEMES.dark.hairline);
    });

    it('shows a placeholder where the map goes until it is drawn', () => {
        const wrapper = mount(PartyCard, { props: props({ mapImage: null, mapPlaceholder: 'Drawing the map…' }) });
        expect(wrapper.find('image[data-map]').exists()).toBe(false);
        expect(wrapper.text()).toContain('Drawing the map…');
    });

    it('marks sample data with a watermark only when sample records are shown', () => {
        expect(mount(PartyCard, { props: props() }).text()).not.toContain('SAMPLE DATA');
        expect(
            mount(PartyCard, { props: props({ view: { ...card('UDA'), sample: true } }) }).text(),
        ).toContain('SAMPLE DATA');
    });

    it('prints the same footer the other cards do, with the boundary attribution', () => {
        const wrapper = mount(PartyCard, { props: props() });
        const l = partyLayout('square', card('UDA'), text(card('UDA')));
        const block = footerBlock(l.footerBox, l.footerFonts, {
            source: card('UDA').source,
            asOf: '16 July 2026',
            attribution: ATTRIBUTION,
            url: URL,
        });
        for (const line of block.lines) expect(wrapper.text()).toContain(line.text.trim());
    });
});

describe('partyCaption', () => {
    const c = card('UDA');
    it('lists the numbers, the source with its date, the link and the tags', () => {
        const t = partyCaption(c, URL);
        expect(t).toContain('UDA seats across Kenya');
        expect(t).toContain('Governors: 20 of 47 (43%)');
        expect(t).toContain('MCAs: 517 of 1,450 (36%)');
        expect(t).toContain('Nominated Senators: 9 of 20 (45%)');
        expect(t).toContain('Source: IEBC gazette notices, data as of 16 July 2026.');
        expect(t).toContain(URL);
        expect(t).toContain('#Kenya2027 #KenyaDecides');
        expect(t.length).toBeLessThanOrEqual(2199);
    });

    it('says held or not held for a county seat, and follows the scope in the headline and numbers', () => {
        const scoped = card('UDA', PARTY_SEATS, 'dark', NAIROBI);
        const t = partyCaption(scoped, 'https://example.org/party/uda?in=county-47');
        expect(t).toContain('UDA seats in Nairobi City');
        expect(t).toMatch(/Governor: (held|not held by UDA)/);
        expect(t).toMatch(/MCAs: \d+ of 85 wards \(\d+%\)/);
        expect(t).not.toContain('Nominated');
        expect(t).not.toContain('most MCA seats');
    });

    it('names the top counties for the national card', () => {
        const t = partyCaption(c, URL);
        expect(t).toMatch(/Where it holds the most MCA seats: .+ of \d+ wards/);
        expect(partyCaption(c, URL, 'x')).not.toContain('Where it holds');
    });

    it('fits X: under 280 with the link counted as 23, and still has the source, link and tags', () => {
        const t = partyCaption(c, URL, 'x');
        expect(xLength(t)).toBeLessThanOrEqual(279);
        expect(t).toContain('UDA seats across Kenya');
        expect(t).toContain('Source:');
        expect(t).toContain(URL);
        expect(t).toContain('#Kenya2027');
    });

    it('follows an edited headline', () => {
        expect(partyCaption(c, URL, 'instagram', 'UDA, in numbers')).toMatch(/^UDA, in numbers\n/);
    });
});
