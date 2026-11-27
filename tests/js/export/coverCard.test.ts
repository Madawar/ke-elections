// The county carousel's cover (Task H2): its numbers from the unit index, the headline and scope
// wording, its map (the county on the MCA seat, nothing highlighted, no MP outlines), its sources,
// link, caption and registry entry. Holders are placeholders.
import { describe, expect, it } from 'vitest';
import { coverCaption, xLength } from '@/lib/export/caption';
import {
    COVER_NOTE,
    type CoverCardView,
    coverCardView,
    coverHeadline,
    coverKicker,
    coverScope,
} from '@/lib/export/coverCard';
import { sourceLine } from '@/lib/export/format';
import {
    aspectOf,
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineOf,
    inTheme,
    mapSlotsOf,
    sizesOf,
} from '@/lib/export/shareView';
import { viewMapAspect } from '@/lib/export/viewMap';
import { buildLegend } from '@/lib/legend';
import { THEMES } from '@/lib/map/theme';
import { legendScope, seatSources, withIndependentColour } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const URL = 'https://example.org/county/37';
const view = (code = 37, theme: 'light' | 'dark' = 'light') =>
    coverCardView({
        seats: withIndependentColour(NUMBERS_SEATS, THEMES[theme].independent),
        index,
        county: code,
        theme,
    })!;
const counties = index.all().filter((u) => u.l === 'county');

describe('coverCardView', () => {
    it('counts a county’s elected seats from the unit index: 3 + its constituencies + its wards', () => {
        const c = view(37);
        expect(c.kind).toBe('cover');
        expect(c.county).toMatchObject({ code: 37, name: 'Kakamega' });
        expect(c.counts).toEqual({ constituencies: 12, wards: 60, total: 75 });
        for (const u of counties) {
            const v = view(u.c);
            const cons = index.children('county', u.c);
            const wards = cons.flatMap((k) => index.children('constituency', k.c));
            expect(v.counts).toEqual({
                constituencies: cons.length,
                wards: wards.length,
                total: 3 + cons.length + wards.length,
            });
        }
        expect(counties.reduce((n, u) => n + view(u.c).counts.total, 0)).toBe(47 * 3 + 290 + 1450);
    });

    it('is null for a code that is not a county', () => {
        expect(coverCardView({ seats: NUMBERS_SEATS, index, county: 99, theme: 'light' })).toBeNull();
    });

    it('says who holds the county’s seats, with the name whole and a typographic apostrophe', () => {
        expect(coverHeadline(view(37))).toBe('Who holds Kakamega’s 75 elected seats');
        expect(coverKicker(view(37))).toBe('Kakamega County');
        // Names ending in "s" take the plain "’s" too.
        const machakos = view(counties.find((u) => u.n === 'Machakos')!.c);
        expect(coverHeadline(machakos)).toMatch(/^Who holds Machakos’s \d+ elected seats$/);
        for (const u of counties) {
            expect(coverHeadline(view(u.c))).toContain(`${u.n}’s `);
            expect(coverKicker(view(u.c))).toBe(`${u.n} County`);
            // The possessive is typographic; a straight one is only ever the name's own (Murang'a).
            expect(coverHeadline(view(u.c)).replace(u.n, '')).not.toMatch(/'/);
        }
    });

    it('spells out the seats in the scope line, with singular forms for one', () => {
        expect(coverScope(view(37))).toBe(
            '1 governor, 1 senator, 1 woman rep, 12 MPs and 60 MCAs. Swipe for each.',
        );
        const one = { ...view(37), counts: { constituencies: 1, wards: 1, total: 5 } } as CoverCardView;
        expect(coverScope(one)).toBe('1 governor, 1 senator, 1 woman rep, 1 MP and 1 MCA. Swipe for each.');
        expect(COVER_NOTE).toBe('Wards coloured by the MCA’s party');
    });

    it('draws the county on the MCA seat: in focus, nothing highlighted, no MP outlines', () => {
        const c = view(37);
        const [slot] = mapSlotsOf('portrait', c, { headline: coverHeadline(c), url: URL, mapAspect: aspectOf(c) });
        expect(slot.key).toBe('map');
        expect(slot.spec).toMatchObject({
            seat: 'mca',
            only: [],
            showSurroundings: false,
            outline: false,
            focus: { level: 'county', code: 37 },
        });
        expect(aspectOf(c)).toBe(viewMapAspect({ focus: c.focus } as never));
    });

    it('credits the county’s MCAs (what the map draws) and links to the county', () => {
        const c = view(37);
        const wards = legendScope(index, 'mca', { level: 'county', code: 37 })!.codes;
        expect(c.source).toBe(sourceLine(seatSources(NUMBERS_SEATS, 'mca', wards)));
        expect(c.path).toBe('/county/37');
        expect(c.asOf).toBe(NUMBERS_SEATS.data_as_of ?? NUMBERS_SEATS.as_of ?? null);
    });

    it('names the MCA holders’ sources only, not the county seats’ or the MPs’', () => {
        // Each seat's holders cite a site of their own.
        const bySeat = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.map((h) => ({ ...h, source_url: `https://${h.seat.replace('_', '-')}.example.org/record` })),
        };
        const c = coverCardView({ seats: bySeat, index, county: 37, theme: 'light' })!;
        expect(c.source).toBe('mca.example.org');
        expect(c.sources).toEqual(['mca.example.org']);
        for (const other of ['governor', 'senator', 'woman-rep', 'mp']) expect(c.sources).not.toContain(`${other}.example.org`);
    });

    it('keeps the MCA counts of the legend for its caption', () => {
        const c = view(37);
        const wards = legendScope(index, 'mca', { level: 'county', code: 37 })!.codes;
        const legend = buildLegend(withIndependentColour(NUMBERS_SEATS, THEMES.light.independent), 'mca', { codes: wards, unitName: 'Kakamega' }, []);
        expect(c.mcas).toEqual(legend.rows.map((r) => ({ label: r.label, count: r.count ?? 0 })));
    });
});

describe('the cover in the registry', () => {
    it('comes in portrait and story, with a fixed headline and its own file name', () => {
        const c = view(37);
        expect(sizesOf(c)).toEqual(['portrait', 'story']);
        expect(headlineEditable(c)).toBe(false);
        expect(headlineOf(c)).toBe(coverHeadline(c));
        expect(filenameOf(c, 'portrait')).toBe('kenya-electoral-map-county-37-cover-portrait.png');
        expect(dialogCopy(c)).toEqual({
            title: 'Share the county carousel',
            description: 'Four slides on who holds Kakamega’s 75 elected seats, sized for Instagram or stories.',
        });
    });

    it('is made again in the other theme', () => {
        const c = view(37, 'light');
        const dark = inTheme(c, 'dark', { seats: NUMBERS_SEATS, index });
        expect(dark).toEqual(view(37, 'dark'));
    });

    it('has a caption with the headline, the scope, the MCAs by party, the source and the link', () => {
        const c = view(37);
        const text = coverCaption(c, URL, 'instagram');
        expect(text.split('\n')[0]).toBe('Who holds Kakamega’s 75 elected seats');
        expect(text).toContain(coverScope(c));
        expect(text).toContain(`MCAs by party: ${c.mcas.map((m) => `${m.label} ${m.count}`).join(', ')}.`);
        expect(text).toContain(URL);
        expect(text).toMatch(/Source/);
        const x = coverCaption(c, URL, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x).toContain(URL);
    });
});
