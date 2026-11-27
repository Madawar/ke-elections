import type { ExpressionSpecification } from 'maplibre-gl';
import type { MapLevel } from './levels';
import { PROVINCE_TINTS } from './theme';

export type SeatKey = 'governor' | 'senator' | 'woman_rep' | 'mp' | 'mca';
/** The view that stripes each county by its three county-wide seats. */
export const COUNTY_SEATS = 'county_seats';
/** The county-wide seats, in the order their stripes are always drawn. */
export const COUNTY_SEAT_KEYS = ['governor', 'senator', 'woman_rep'] as const;
/**
 * What the map is coloured by: nothing, the former provinces, the party holding a seat, or the
 * parties holding each county's three seats ("County seats").
 */
export type ColourKey = 'none' | 'province' | SeatKey | typeof COUNTY_SEATS;
/** A colouring that shows who holds seats: one seat, or the three county seats together. */
export type SeatMode = SeatKey | typeof COUNTY_SEATS;
/** The level a seat mode is held at (the three county seats: the county). */
export const seatModeLevel = (mode: SeatMode): MapLevel =>
    mode === COUNTY_SEATS ? 'county' : SEAT_LEVEL[mode];
export const isSeatMode = (mode: ColourKey | string): mode is SeatMode =>
    mode === COUNTY_SEATS || mode in SEAT_LEVEL;
export const SEAT_LEVEL: Record<SeatKey, MapLevel> = {
    governor: 'county',
    senator: 'county',
    woman_rep: 'county',
    mp: 'constituency',
    mca: 'ward',
};

export type ColourMode =
    | { kind: 'none' }
    | { kind: 'province' }
    | { kind: 'seat'; seat: SeatKey }
    | { kind: typeof COUNTY_SEATS };

/** What the fills show. For a seat, `colours` maps unit code (at the seat's level) to a colour. */
export interface Colouring {
    mode: ColourMode;
    colours: Map<number, string>;
    fallback: string;
    /** "County seats": each county's stripe pattern (a `patternId`), by county code. */
    patterns?: Map<number, string>;
    /** ... and the pattern of a county with no holder at all. */
    fallbackPattern?: string;
    /** MCA view: each constituency outlined in its MP's party colour, over the ward fills. */
    outline?: OutlineColouring;
    /** MCA view: the second line of a ward's label, "<MCA name> (<ABBREV>)", by ward code. */
    names?: Map<number, string>;
}

/** The MP outlines drawn over the MCA ward fills. */
export interface OutlineColouring {
    /** Constituency code to the MP's party colour (the faded colour when not highlighted). */
    colours: Map<number, string>;
    /** A constituency with no approved MP. */
    fallback: string;
    /** Constituency code to its badge, "MP: ODM". */
    badges: Map<number, string>;
    /** The badge of a constituency with no approved MP. */
    fallbackBadge: string;
}

export const NO_COLOURING: Colouring = {
    mode: { kind: 'none' },
    colours: new Map(),
    fallback: 'rgba(0,0,0,0)',
};

/** The level whose fills are shown at every zoom (seat colouring), or null for zoom-banded fills. */
export function pinnedLevel(mode: ColourMode): MapLevel | null {
    if (mode.kind === COUNTY_SEATS) return 'county';
    return mode.kind === 'seat' ? SEAT_LEVEL[mode.seat] : null;
}

/**
 * The stripe pattern of each county: a `match` on the county code, or the one pattern when there
 * are no entries (MapLibre rejects empty matches). Undefined outside the "County seats" view.
 */
export function fillPattern(
    colouring: Colouring,
    level: MapLevel,
): ExpressionSpecification | string | undefined {
    if (colouring.mode.kind !== COUNTY_SEATS || level !== 'county')
        return undefined;
    const fallback = colouring.fallbackPattern ?? '';
    return codeColour(colouring.patterns ?? new Map(), fallback);
}

/** Former-province tint for a level: counties match their province_code, everything below matches county_code. */
export function provinceColour(
    level: MapLevel,
    provinceOfCounty: Map<number, number>,
): ExpressionSpecification {
    const tint = (province: number) =>
        PROVINCE_TINTS[(province - 1) % PROVINCE_TINTS.length];
    if (level === 'county') {
        const pairs = [...new Set(provinceOfCounty.values())]
            .sort((a, b) => a - b)
            .flatMap((p) => [p, tint(p)]);
        return [
            'match',
            ['get', 'province_code'],
            ...pairs,
            PROVINCE_TINTS[0],
        ] as unknown as ExpressionSpecification;
    }
    const pairs = [...provinceOfCounty.entries()]
        .sort(([a], [b]) => a - b)
        .flatMap(([county, province]) => [county, tint(province)]);
    return [
        'match',
        ['get', 'county_code'],
        ...pairs,
        PROVINCE_TINTS[0],
    ] as unknown as ExpressionSpecification;
}

/**
 * A `match` on a feature property (its own code by default); a constant when there are no
 * entries (MapLibre rejects empty matches).
 */
export function codeColour(
    colours: Map<number, string>,
    fallback: string,
    property = 'code',
): ExpressionSpecification | string {
    if (colours.size === 0) return fallback;
    const pairs = [...colours.entries()]
        .sort(([a], [b]) => a - b)
        .flatMap(([code, colour]) => [code, colour]);
    return [
        'match',
        ['get', property],
        ...pairs,
        fallback,
    ] as unknown as ExpressionSpecification;
}

const DEPTH: Record<MapLevel, number> = { county: 0, constituency: 1, ward: 2 };

/** Is `level` below the level the seat colouring is about (wards, for a Governor)? */
export const isFinerThanSeat = (level: MapLevel, mode: ColourMode): boolean => {
    const pinned = pinnedLevel(mode);
    return pinned !== null && DEPTH[level] > DEPTH[pinned];
};

/**
 * The fill colour for a level. With `byAncestor` (a unit is focused), levels below the seat level
 * take the colour of the unit that holds the seat above them, so a focused ward is still coloured
 * by its governor even though the county layer is out of the picture.
 */
export function fillColor(
    colouring: Colouring,
    level: MapLevel,
    provinceOfCounty: Map<number, number>,
    neutral: string,
    byAncestor = false,
): ExpressionSpecification | string {
    const { mode } = colouring;
    if (mode.kind === 'province')
        return provinceColour(level, provinceOfCounty);
    if (mode.kind === 'seat' && SEAT_LEVEL[mode.seat] === level)
        return codeColour(colouring.colours, colouring.fallback);
    if (mode.kind === 'seat' && byAncestor && isFinerThanSeat(level, mode))
        return codeColour(
            colouring.colours,
            colouring.fallback,
            `${SEAT_LEVEL[mode.seat]}_code`,
        );
    return neutral;
}
