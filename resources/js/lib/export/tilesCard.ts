// "Every county the same size": 47 equal tiles, one per county, laid out roughly like the map
// (countyTiles.ts) and coloured by the party of the county's Governor, Senator or Woman Rep. A
// card with no map: the tiles are drawn. Each tile's colour is the national seat map's fill for
// that county (viewColouring, nothing highlighted), and the key is that seat's legend across Kenya
// (buildLegend), so the card, the map and the legend cannot disagree. A county with no approved
// holder is the no-data colour, and the key names it only when there is one.
import { SEAT_LABEL, buildLegend } from '@/lib/legend';
import { type MapTheme, THEMES, type ThemeName } from '@/lib/map/theme';
import { type SeatsData, seatSources } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { COUNTY_TILES } from './countyTiles';
import { sourceLine, sourceParts } from './format';
import { viewColouring } from './viewMap';
import { viewPath } from './viewState';

/** The seats a county has one of. */
export type TileSeat = 'governor' | 'senator' | 'woman_rep';
export const TILE_SEATS: readonly TileSeat[] = ['governor', 'senator', 'woman_rep'];

export const TILES_SCOPE = 'Every county drawn the same size, so small ones count too';

export interface Tile {
    code: number;
    /** As the unit index spells it ("Elgeyo/Marakwet", "Tharaka - Nithi"). */
    name: string;
    col: number;
    row: number;
    /** The map's fill for this county and seat. */
    colour: string;
    /** The text colour on that fill: the card's dark ink or white, whichever reads better. */
    ink: string;
    /** The key entry the tile belongs to: a party abbreviation, IND, "other" or "none". */
    group: string;
}

export interface TilesKeyEntry {
    /** A party abbreviation, IND, "other" or "none" (no approved holder). */
    key: string;
    label: string;
    colour: string;
    count: number;
}

export interface TilesCardView {
    kind: 'tiles';
    theme: ThemeName;
    seat: TileSeat;
    /** By IEBC county code. */
    tiles: Tile[];
    /** The legend's rows, then "No approved holder yet" when a county has none. */
    key: TilesKeyEntry[];
    /** Counties with no approved holder of this seat. */
    vacant: number;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The national map on this seat. */
    path: string;
}

const WHITE = '#FFFFFF';

/** WCAG relative luminance of a "#RRGGBB" colour. */
function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#RRGGBB" colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * The text colour on a tile: the card's dark ink or white, whichever has the higher contrast with
 * the fill. On the light card the dark ink is its ink; on the dark card, whose ink is light, it is
 * the card's own ground colour.
 */
export function tileInk(fill: string, theme: MapTheme): string {
    const dark = luminance(theme.ink) < luminance(theme.land) ? theme.ink : theme.land;
    return contrastRatio(dark, fill) >= contrastRatio(WHITE, fill) ? dark : WHITE;
}

export function tilesCardView({
    seats,
    index,
    seat,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    seat: TileSeat;
    theme: ThemeName;
    sample?: boolean;
}): TilesCardView {
    const tokens = THEMES[theme];
    const legend = buildLegend(seats, seat, null, []);
    // Each holder's group is the legend row that stands for its party.
    const rowOf = new Map(
        Object.entries(legend.members).flatMap(([key, parties]) => parties.map((p) => [p, key])),
    );
    const groupOf = new Map(
        seats.holders
            .filter((h) => h.seat === seat && h.party)
            .map((h) => [h.code, rowOf.get(h.party!) ?? 'none']),
    );
    // The national map of this seat with nothing highlighted: the same colouring, so the same fills.
    const colouring = viewColouring(
        { seat, only: [], focus: null, showSurroundings: false },
        seats,
        tokens,
    );
    const tiles = index
        .all()
        .filter((u) => u.l === 'county')
        .sort((a, b) => a.c - b.c)
        .map((u) => {
            const colour = colouring.colours.get(u.c) ?? colouring.fallback;
            const cell = COUNTY_TILES[u.c];
            return {
                code: u.c,
                name: u.n,
                col: cell.col,
                row: cell.row,
                colour,
                ink: tileInk(colour, tokens),
                group: groupOf.get(u.c) ?? 'none',
            };
        });
    // No approved holder: no holder of this seat with a party, as the legend counts them.
    const vacant = tiles.filter((t) => t.group === 'none').length;
    const urls = seatSources(seats, seat);
    return {
        kind: 'tiles',
        theme,
        seat,
        tiles,
        key: [
            ...legend.rows.map((r) => ({
                key: r.key,
                label: r.label,
                colour: r.colour,
                count: r.count ?? 0,
            })),
            ...(vacant
                ? [
                      {
                          key: 'none',
                          label: 'No approved holder yet',
                          colour: tokens.noData,
                          count: vacant,
                      },
                  ]
                : []),
        ],
        vacant,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: viewPath(seat, null, []),
    };
}

/** "Governors by party", "Woman Reps by party". */
export const tilesHeadline = (card: Pick<TilesCardView, 'seat'>): string =>
    `${SEAT_LABEL[card.seat]}s by party`;
