// Which unit a tap or hover picks. The level comes from what is focused, never from the zoom:
// nothing focused picks the county, a focused county picks its constituency, a focused
// constituency picks its ward, and a focused ward picks nothing.
import type { FocusSelection } from './focus';
import type { MapLevel } from './levels';

/** A unit's drawn shape under the finger: its own code, and the codes of the parents it carries. */
export interface TapFeature {
    level: MapLevel;
    code: number;
    county_code?: number;
    constituency_code?: number;
}

export interface TapPick {
    level: MapLevel;
    code: number;
}

/**
 * - A unit: the tap selects it (and the camera fits it).
 * - `'inside'`: the tap is on the focused unit and there is nothing deeper to pick, so nothing happens.
 * - `'outside'`: a unit is focused and the tap is not on it (empty ground, or the surroundings
 *   while they are hidden). With the surroundings shown, a tap on a neighbouring unit is a pick.
 * - `null`: nothing is focused and the tap is not on any county.
 */
export type TapResult = TapPick | 'inside' | 'outside' | null;

/** The level a tap selects from a focus. */
const NEXT: Record<MapLevel, MapLevel | null> = {
    county: 'constituency',
    constituency: 'ward',
    ward: null,
};

/** Is the feature the focused unit itself, or something inside it? */
function within(focus: FocusSelection, f: TapFeature): boolean {
    if (focus.level === 'county')
        return f.level === 'county'
            ? f.code === focus.code
            : f.county_code === focus.code;
    if (focus.level === 'constituency')
        return f.level === 'constituency'
            ? f.code === focus.code
            : f.level === 'ward' && f.constituency_code === focus.code;
    return f.level === 'ward' && f.code === focus.code;
}

const DEPTH: Record<MapLevel, number> = { county: 0, constituency: 1, ward: 2 };

/**
 * The neighbour a tap picks while the surroundings are shown: the unit at the focused level (a
 * ward beside a ward), else the finest coarser unit that is drawn there. Never a finer one, so a
 * tap never drops a level.
 */
function neighbourAt(
    focus: FocusSelection,
    features: TapFeature[],
): TapPick | null {
    const candidates = features
        .filter((f) => DEPTH[f.level] <= DEPTH[focus.level])
        .sort((a, b) => DEPTH[b.level] - DEPTH[a.level]);
    const pick = candidates[0];
    return pick ? { level: pick.level, code: pick.code } : null;
}

export function tapTarget(
    focus: FocusSelection | null,
    featuresUnderPoint: TapFeature[],
    { surroundings = false }: { surroundings?: boolean } = {},
): TapResult {
    if (!focus) {
        const county = featuresUnderPoint.find((f) => f.level === 'county');
        return county ? { level: 'county', code: county.code } : null;
    }
    const inFocus = featuresUnderPoint.filter((f) => within(focus, f));
    if (inFocus.length === 0)
        return (
            (surroundings && neighbourAt(focus, featuresUnderPoint)) ||
            'outside'
        );
    const next = NEXT[focus.level];
    const target = next && inFocus.find((f) => f.level === next);
    return target ? { level: target.level, code: target.code } : 'inside';
}
