// The seat colouring follows the focus: a governor means nothing inside a single constituency,
// and an MP means nothing inside a single ward. The page remembers what the person chose at each
// level, so stepping back out brings their choice back.
import {
    type ColourKey,
    type SeatMode,
    isSeatMode,
    seatModeLevel,
} from './colouring';
import type { MapLevel } from './levels';

const DEPTH: Record<MapLevel, number> = { county: 0, constituency: 1, ward: 2 };
/** Nothing focused counts as the county level: all of Kenya shows the same modes. */
type FocusLevel = MapLevel | null;
const bucket = (level: FocusLevel): MapLevel => level ?? 'county';

export type RememberedModes = Partial<Record<MapLevel, ColourKey>>;

/** The level to remember a person's choice under (Kenya shares the county level's). */
export const rememberLevel = bucket;

const isSeat = (mode: ColourKey): mode is SeatMode => isSeatMode(mode);

/** The mode shows at this focus level: its seats are held at that level or finer. */
function isValid(level: FocusLevel, mode: ColourKey): boolean {
    const depth = DEPTH[bucket(level)];
    if (isSeat(mode)) return DEPTH[seatModeLevel(mode)] >= depth;
    return mode === 'none' || depth === 0;
}

const ALL: ColourKey[] = [
    'none',
    'province',
    'governor',
    'senator',
    'woman_rep',
    'mp',
    'mca',
    'county_seats',
];

/** Every mode that makes sense with this focus. */
export function validSeatModes(level: FocusLevel): ColourKey[] {
    return ALL.filter((mode) => isValid(level, mode));
}

/**
 * The seat to show when the current mode does not fit: the finest seat there is to see inside the
 * unit, so a constituency shows its wards coloured by their MCAs (MP stays a chip to choose).
 */
const FALLBACK: Record<MapLevel, ColourKey> = {
    county: 'none',
    constituency: 'mca',
    ward: 'mca',
};

/**
 * The mode to draw when the focus moves to `level`: what the person chose at that level before if
 * it still fits, else the current mode if it fits, else the seat that is held at that level.
 */
export function modeForFocus(
    level: FocusLevel,
    current: ColourKey,
    remembered: RememberedModes,
): ColourKey {
    const own = remembered[bucket(level)];
    if (own && isValid(level, own)) return own;
    if (isValid(level, current)) return current;
    return current === 'province' ? 'none' : FALLBACK[bucket(level)];
}

/**
 * Where a chip leads when its seat is held above the focus: the level to step up to, or null when
 * the chip shows at the focus level as it is.
 */
export function chipStepUp(
    level: FocusLevel,
    mode: ColourKey,
): 'county' | 'constituency' | null {
    if (!isSeat(mode)) return null;
    const seatLevel = seatModeLevel(mode);
    return DEPTH[seatLevel] < DEPTH[bucket(level)]
        ? (seatLevel as 'county' | 'constituency')
        : null;
}
