// "Every county the same size": the card's data, its tile colours (the map's, by code, in both
// themes), its key (the legend's), the text colour on each tile, the caption and its registry entry.
import { describe, expect, it } from 'vitest';
import { tilesCaption, xLength } from '@/lib/export/caption';
import { sourceLine } from '@/lib/export/format';
import { COUNTY_TILES } from '@/lib/export/countyTiles';
import {
    FACTS_WORDING,
    dialogCopy,
    filenameOf,
    headlineEditable,
    headlineOf,
    headlineWording,
    inTheme,
    mapSlotsOf,
    shareCards,
    sizesOf,
} from '@/lib/export/shareView';
import {
    TILES_SCOPE,
    type TileSeat,
    type TilesCardView,
    contrastRatio,
    tileInk,
    tilesCardView,
    tilesHeadline,
} from '@/lib/export/tilesCard';
import { viewColouring } from '@/lib/export/viewMap';
import { parseViewQuery } from '@/lib/export/viewState';
import { buildLegend } from '@/lib/legend';
import { OTHER, THEMES, type ThemeName } from '@/lib/map/theme';
import { type SeatsData, seatSources, withIndependentColour } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const SEATS: TileSeat[] = ['governor', 'senator', 'woman_rep'];
const URL = 'https://example.org/?seat=governor';
const themed = (data: SeatsData, theme: ThemeName) =>
    withIndependentColour(data, THEMES[theme].independent);
const view = (
    seat: TileSeat = 'governor',
    data: SeatsData = NUMBERS_SEATS,
    theme: ThemeName = 'light',
) => tilesCardView({ seats: themed(data, theme), index, seat, theme });
/** The data with the first `n` holders of a seat taken out: those counties have none. */
const without = (seat: string, n: number): SeatsData => {
    let left = n;
    return {
        ...NUMBERS_SEATS,
        holders: NUMBERS_SEATS.holders.filter((h) => h.seat !== seat || left-- <= 0),
    };
};
/** The national map of this seat, as the seat view draws it: nothing highlighted. */
const mapFill = (seat: TileSeat, data: SeatsData, theme: ThemeName) => {
    const colouring = viewColouring(
        { seat, only: [], focus: null, showSurroundings: false },
        themed(data, theme),
        THEMES[theme],
    );
    return (code: number) => colouring.colours.get(code) ?? colouring.fallback;
};

describe('tilesCardView', () => {
    it('has one tile per county, by code, named as the unit index names it, in its grid cell', () => {
        const card = view();
        expect(card.kind).toBe('tiles');
        expect(card.tiles.map((t) => t.code)).toEqual(
            Array.from({ length: 47 }, (_, i) => i + 1),
        );
        for (const t of card.tiles) {
            expect(t.name).toBe(index.get('county', t.code)!.n);
            expect({ col: t.col, row: t.row }).toEqual(COUNTY_TILES[t.code]);
        }
        const name = (code: number) => card.tiles.find((t) => t.code === code)!.name;
        expect(name(28)).toBe('Elgeyo/Marakwet');
        expect(name(13)).toBe('Tharaka - Nithi');
        expect(name(47)).toBe('Nairobi City');
    });

    it('colours each tile as the map colours that county for that seat, by code, in both themes', () => {
        for (const data of [NUMBERS_SEATS, without('woman_rep', 3)])
            for (const seat of SEATS)
                for (const theme of ['light', 'dark'] as const) {
                    const fill = mapFill(seat, data, theme);
                    for (const t of view(seat, data, theme).tiles)
                        expect(t.colour, `${seat} ${theme} ${t.code}`).toBe(fill(t.code));
                }
        // The fixtures hold an independent (its own colour per theme) and a party with no colour
        // of its own (the "Other parties" grey).
        const light = view('governor', NUMBERS_SEATS, 'light');
        const dark = view('governor', NUMBERS_SEATS, 'dark');
        const ind = NUMBERS_SEATS.holders.find((h) => h.seat === 'governor' && h.party === 'IND')!;
        const other = NUMBERS_SEATS.holders.find((h) => h.seat === 'governor' && h.party === 'SP1')!;
        const tile = (c: TilesCardView, code: number) => c.tiles.find((t) => t.code === code)!;
        expect(tile(light, ind.code).colour).toBe(THEMES.light.independent);
        expect(tile(dark, ind.code).colour).toBe(THEMES.dark.independent);
        expect(tile(light, other.code).colour).toBe(OTHER);
    });

    it('shows every party, never a faded one: highlights on screen do not reach this card', () => {
        for (const theme of ['light', 'dark'] as const)
            for (const t of view('senator', NUMBERS_SEATS, theme).tiles)
                expect(t.colour).not.toBe(THEMES[theme].faded);
    });

    it('keys the colours with the legend’s rows and counts for that seat across Kenya', () => {
        for (const seat of SEATS)
            for (const theme of ['light', 'dark'] as const) {
                const card = view(seat, NUMBERS_SEATS, theme);
                const legend = buildLegend(themed(NUMBERS_SEATS, theme), seat, null, []);
                expect(card.key, `${seat} ${theme}`).toEqual(
                    legend.rows.map((r) => ({
                        key: r.key,
                        label: r.label,
                        colour: r.colour,
                        count: r.count,
                    })),
                );
                expect(card.vacant).toBe(0);
                // Every colour on a tile is in the key, and the counts add up to the tiles.
                const keyed = new Set(card.key.map((k) => k.colour));
                for (const t of card.tiles) expect(keyed.has(t.colour), `${t.code}`).toBe(true);
                // Each tile belongs to the key entry of its colour, and each entry counts its tiles.
                for (const k of card.key) {
                    const mine = card.tiles.filter((t) => t.group === k.key);
                    expect(mine, `${seat} ${k.key}`).toHaveLength(k.count);
                    for (const t of mine) expect(t.colour).toBe(k.colour);
                }
                expect(card.key.reduce((n, k) => n + k.count, 0)).toBe(47);
            }
        expect(view().key.map((k) => `${k.label} ${k.count}`)).toEqual([
            'UDA 20',
            'ODM 15',
            'WDM-K 3',
            'JP 2',
            'UDM 2',
            'ANC 1',
            'DAP-K 1',
            'FORD-K 1',
            'Independent 1',
            'Other parties 1',
        ]);
    });

    it('draws a county with no approved holder in the no-data colour, and keys it only then', () => {
        for (const theme of ['light', 'dark'] as const) {
            const data = without('governor', 2);
            const card = view('governor', data, theme);
            const gone = NUMBERS_SEATS.holders.filter((h) => h.seat === 'governor').slice(0, 2);
            for (const h of gone)
                expect(card.tiles.find((t) => t.code === h.code)!.colour).toBe(
                    THEMES[theme].noData,
                );
            expect(card.vacant).toBe(2);
            expect(card.key.at(-1)).toEqual({
                key: 'none',
                label: 'No approved holder yet',
                colour: THEMES[theme].noData,
                count: 2,
            });
            expect(card.key.reduce((n, k) => n + k.count, 0)).toBe(47);
        }
        // A holder whose record names no party: no approved holder, as the legend counts it.
        const partyless: SeatsData = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.map((h) =>
                h.seat === 'senator' && h.code === 5 ? { ...h, party: null } : h,
            ),
        };
        const card = view('senator', partyless);
        expect(card.vacant).toBe(1);
        expect(card.tiles.find((t) => t.code === 5)!.colour).toBe(THEMES.light.noData);
        expect(view().key.some((k) => k.key === 'none')).toBe(false);
    });

    it('is headed by the seat, scoped to every county, sourced from that seat’s holders and links to that seat’s map', () => {
        expect(SEATS.map((s) => tilesHeadline(view(s)))).toEqual([
            'Governors by party',
            'Senators by party',
            'Woman Reps by party',
        ]);
        expect(TILES_SCOPE).toBe('Every county drawn the same size, so small ones count too');
        const card = view('woman_rep');
        expect(card.path).toBe('/?seat=woman_rep');
        expect(view().path).toBe('/?seat=governor');
        expect(card.sources).toEqual(['IEBC gazette notices']);
        expect(card.source).toBe(sourceLine(seatSources(themed(NUMBERS_SEATS, 'light'), 'woman_rep')));
        expect(card.asOf).toBe('2026-07-16');
        expect(card.sample).toBe(false);
    });

    it('links to a page that opens that seat with nothing highlighted', () => {
        for (const seat of SEATS) {
            const { pathname, search } = new globalThis.URL(view(seat).path, 'https://example.org');
            expect(pathname).toBe('/');
            expect(parseViewQuery(search, NUMBERS_SEATS)).toEqual({ seat, parties: [] });
        }
    });
});

describe('the text colour on a tile', () => {
    it('measures contrast as WCAG does', () => {
        expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
        expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
        // #767676 on white is the well-known 4.54:1.
        expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
        expect(contrastRatio('#13233A', '#E8C547')).toBe(contrastRatio('#E8C547', '#13233A'));
    });

    it('is the card’s dark ink on a light fill and white on a dark fill, in both themes', () => {
        const yellow = '#E8C547'; // UDA
        const blue = '#2F5FA7'; // WDM-K
        // Light card: its ink is dark.
        expect(tileInk(yellow, THEMES.light)).toBe(THEMES.light.ink);
        expect(tileInk(blue, THEMES.light)).toBe('#FFFFFF');
        // Dark card: its ink is light, so the dark choice is the card's own ground colour.
        expect(tileInk(yellow, THEMES.dark)).toBe(THEMES.dark.land);
        expect(tileInk(blue, THEMES.dark)).toBe('#FFFFFF');
        // The no-data fill of each theme, and the independents' colour of each.
        expect(tileInk(THEMES.light.noData, THEMES.light)).toBe(THEMES.light.ink);
        expect(tileInk(THEMES.dark.noData, THEMES.dark)).toBe('#FFFFFF');
        expect(tileInk(THEMES.light.independent, THEMES.light)).toBe('#FFFFFF');
        expect(tileInk(THEMES.dark.independent, THEMES.dark)).toBe(THEMES.dark.land);
    });

    it('takes whichever of the two reads better, by the numbers', () => {
        for (const theme of [THEMES.light, THEMES.dark])
            for (const fill of ['#E8C547', '#E07B24', '#C8323C', '#2F5FA7', '#3BA39C', '#8E6BB0', '#3FAE49', '#6DB3E0', '#8A5A2B', '#B5508F', OTHER]) {
                const ink = tileInk(fill, theme);
                const other = ink === '#FFFFFF' ? (theme === THEMES.light ? theme.ink : theme.land) : '#FFFFFF';
                expect(contrastRatio(ink, fill), fill).toBeGreaterThanOrEqual(contrastRatio(other, fill));
            }
    });

    it('gives each tile the text colour for its fill', () => {
        for (const theme of ['light', 'dark'] as const)
            for (const t of view('governor', NUMBERS_SEATS, theme).tiles)
                expect(t.ink).toBe(tileInk(t.colour, THEMES[theme]));
    });
});

describe('the county tiles caption', () => {
    it('gives the headline, the scope, each group with its counties by code, the source and the link', () => {
        const card = view();
        const text = tilesCaption(card, URL, 'instagram', tilesHeadline(card));
        const lines = text.split('\n');
        expect(lines[0]).toBe('Governors by party');
        expect(text).toContain(`${TILES_SCOPE}.`);
        // One line per group, in the key's order, its counties in IEBC code order.
        const uda = card.tiles.filter((t) => NUMBERS_SEATS.holders.some((h) => h.seat === 'governor' && h.code === t.code && h.party === 'UDA'));
        expect(text).toContain(`UDA 20: ${uda.map((t) => t.name).join(', ')}.`);
        expect(lines.findIndex((l) => l.startsWith('UDA 20:'))).toBeLessThan(
            lines.findIndex((l) => l.startsWith('ODM 15:')),
        );
        expect(text).toContain('Other parties 1:');
        expect(text).toContain('Source: IEBC gazette notices, data as of 16 July 2026.');
        expect(text).toContain(URL);
        expect(text).not.toContain('No approved holder yet');
        expect(text.length).toBeLessThan(2200);
        // A vacancy is named like any group.
        expect(tilesCaption(view('governor', without('governor', 2)), URL)).toMatch(
            /No approved holder yet 2: [^\n]+\./,
        );
    });

    it('stays within X’s 280 characters, the edited headline first', () => {
        const card = view();
        const x = tilesCaption(card, URL, 'x', 'Governors by party');
        expect(xLength(x)).toBeLessThanOrEqual(280);
        expect(x.startsWith('Governors by party')).toBe(true);
        expect(xLength(tilesCaption(card, URL, 'x', 'G'.repeat(400)))).toBeLessThanOrEqual(280);
    });
});

describe('sharing county tiles', () => {
    const card = view();
    it('comes in portrait and story, with no map, an editable headline and the facts wording', () => {
        expect(sizesOf(card)).toEqual(['portrait', 'story']);
        for (const size of ['portrait', 'story'] as const)
            expect(mapSlotsOf(size, card, { headline: 'x', url: URL, mapAspect: 1 })).toEqual([]);
        expect(headlineEditable(card)).toBe(true);
        expect(headlineWording(card)).toEqual(FACTS_WORDING);
        expect(headlineOf(card)).toBe('Governors by party');
        expect(headlineOf(view('woman_rep'))).toBe('Woman Reps by party');
    });

    it('has its own label, copy and file name', () => {
        expect(shareCards([card])).toEqual([{ key: 'tiles', label: 'County tiles', view: card }]);
        expect(dialogCopy(card)).toEqual({
            title: 'Share county tiles',
            description:
                'Every county as one tile of the same size, coloured by the party of its governor, sized for Instagram or stories.',
        });
        expect(dialogCopy(view('woman_rep')).description).toContain('of its woman rep,');
        expect(filenameOf(card, 'story')).toBe('kenya-electoral-map-tiles-governor-story.png');
        expect(filenameOf(view('woman_rep'), 'portrait')).toBe(
            'kenya-electoral-map-tiles-woman_rep-portrait.png',
        );
    });

    it('is taken again in the other theme, so independents and no-data follow it', () => {
        const ctx = { seats: NUMBERS_SEATS, index };
        const dark = inTheme(card, 'dark', ctx) as TilesCardView;
        expect(dark).toEqual(view('governor', NUMBERS_SEATS, 'dark'));
        expect(inTheme(dark, 'light', ctx)).toEqual(card);
    });
});
