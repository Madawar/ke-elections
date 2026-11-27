import type { ExpressionSpecification } from 'maplibre-gl';
import type { MapLevel } from './levels';
import { PROVINCE_TINTS } from './theme';

export type SeatKey = 'governor' | 'senator' | 'woman_rep' | 'mp' | 'mca';
/** What the map is coloured by: nothing, the former provinces, or the party holding a seat. */
export type ColourKey = 'none' | 'province' | SeatKey;
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
    | { kind: 'seat'; seat: SeatKey };

/** What the fills show. For a seat, `colours` maps unit code (at the seat's level) to a colour. */
export interface Colouring {
    mode: ColourMode;
    colours: Map<number, string>;
    fallback: string;
}

export const NO_COLOURING: Colouring = {
    mode: { kind: 'none' },
    colours: new Map(),
    fallback: 'rgba(0,0,0,0)',
};

/** The level whose fills are shown at every zoom (seat colouring), or null for zoom-banded fills. */
export function pinnedLevel(mode: ColourMode): MapLevel | null {
    return mode.kind === 'seat' ? SEAT_LEVEL[mode.seat] : null;
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
