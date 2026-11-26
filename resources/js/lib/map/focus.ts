// Focus mode: with a unit selected, draw only that unit and what is inside it. "Hidden" is a
// filter that matches nothing (not layout visibility), so restyling can never bring a layer back.
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { CONSTITUENCY_MIN_ZOOM, type MapLevel, WARD_MIN_ZOOM } from './levels';
import type { Unit, UnitIndex } from '@/lib/units';

export interface FocusSelection {
    level: MapLevel;
    code: number;
}

export type FocusSource = 'counties' | 'constituencies' | 'wards';

/** A filter that matches no feature. */
export const HIDDEN: FilterSpecification = ['==', ['get', 'code'], -1];

const GEOMETRY_LAYERS = [
    'land',
    'counties-fill',
    'constituencies-fill',
    'wards-fill',
    'counties-line',
    'constituencies-line',
    'wards-line',
    'counties-selected',
    'constituencies-selected',
    'wards-selected',
] as const;
const LABEL_LAYERS = [
    'labels-ward',
    'labels-constituency',
    'labels-county',
    'labels-province',
] as const;
const TOWN_LAYERS = ['towns', 'towns-dot'] as const;
const STATION_LAYERS = ['stations-dot', 'stations-label'] as const;

/** Every layer in the built style (and the overlays) that focus mode filters. */
export const FOCUS_LAYERS: readonly string[] = [
    ...GEOMETRY_LAYERS,
    ...LABEL_LAYERS,
    ...TOWN_LAYERS,
    ...STATION_LAYERS,
];

const SOURCE_OF_LAYER: Record<string, FocusSource> = {
    land: 'counties',
    'counties-fill': 'counties',
    'counties-line': 'counties',
    'counties-selected': 'counties',
    'constituencies-fill': 'constituencies',
    'constituencies-line': 'constituencies',
    'constituencies-selected': 'constituencies',
    'wards-fill': 'wards',
    'wards-line': 'wards',
    'wards-selected': 'wards',
};

const get = (property: string) => ['get', property] as ExpressionSpecification;
const equals = (property: string, value: number): FilterSpecification => [
    '==',
    get(property),
    value,
];
const inCodes = (codes: number[]): FilterSpecification =>
    codes.length
        ? ['in', get('code'), ['literal', codes] as ExpressionSpecification]
        : HIDDEN;

/** The units inside the selection, by level. */
function inside(sel: FocusSelection, index: UnitIndex) {
    let constituencies: Unit[] = [];
    let wards: Unit[] = [];
    if (sel.level === 'county') {
        constituencies = index.children('county', sel.code);
        wards = constituencies.flatMap((c) =>
            index.children('constituency', c.c),
        );
    } else if (sel.level === 'constituency') {
        const self = index.get('constituency', sel.code);
        constituencies = self ? [self] : [];
        wards = index.children('constituency', sel.code);
    } else {
        const self = index.get('ward', sel.code);
        wards = self ? [self] : [];
    }
    return {
        constituencies: constituencies.map((u) => u.c),
        wards: wards.map((u) => u.c),
    };
}

/**
 * The focus filter for each layer, to be combined with the layer's own filter (`combineFilter`).
 * `null` means "no focus filter". With `surroundings`, the geometry stays drawn (the style dims
 * it) and only labels, towns and stations are limited to the unit.
 */
export function focusFilters(
    sel: FocusSelection | null,
    index: UnitIndex,
    { surroundings = false }: { surroundings?: boolean } = {},
): Record<string, FilterSpecification | null> {
    const out: Record<string, FilterSpecification | null> = {};
    if (!sel) {
        for (const id of FOCUS_LAYERS) out[id] = null;
        return out;
    }
    const { level, code } = sel;
    const below = inside(sel, index);

    const own: Record<FocusSource, FilterSpecification> = {
        counties: level === 'county' ? equals('code', code) : HIDDEN,
        constituencies:
            level === 'county'
                ? equals('county_code', code)
                : level === 'constituency'
                  ? equals('code', code)
                  : HIDDEN,
        wards:
            level === 'county'
                ? equals('county_code', code)
                : level === 'constituency'
                  ? equals('constituency_code', code)
                  : equals('code', code),
    };
    for (const id of GEOMETRY_LAYERS)
        out[id] = surroundings ? null : own[SOURCE_OF_LAYER[id]];

    out['labels-province'] = HIDDEN;
    out['labels-county'] = level === 'county' ? inCodes([code]) : HIDDEN;
    out['labels-constituency'] = inCodes(below.constituencies);
    out['labels-ward'] = inCodes(below.wards);

    const town =
        level === 'county'
            ? equals('county_code', code)
            : level === 'constituency'
              ? equals('constituency_code', code)
              : equals('ward_code', code);
    for (const id of TOWN_LAYERS) out[id] = town;

    const station: FilterSpecification =
        level === 'ward'
            ? equals('ward_code', code)
            : below.wards.length
              ? [
                    'in',
                    get('ward_code'),
                    ['literal', below.wards] as ExpressionSpecification,
                ]
              : HIDDEN;
    for (const id of STATION_LAYERS) out[id] = station;
    return out;
}

/**
 * Per source, a boolean expression that is true for features outside the focused unit. The style
 * uses it to dim and grey the surroundings when "Show surroundings" is on.
 */
export function focusOutside(
    sel: FocusSelection,
): Record<FocusSource, ExpressionSpecification> {
    const differs = (property: string, value: number) =>
        ['!=', get(property), value] as ExpressionSpecification;
    const always = ['!=', get('code'), -1] as ExpressionSpecification;
    const { level, code } = sel;
    return {
        counties: level === 'county' ? differs('code', code) : always,
        constituencies:
            level === 'county'
                ? differs('county_code', code)
                : level === 'constituency'
                  ? differs('code', code)
                  : always,
        wards:
            level === 'county'
                ? differs('county_code', code)
                : level === 'constituency'
                  ? differs('constituency_code', code)
                  : differs('code', code),
    };
}

/** The layer's own filter with the focus filter on top; `null` focus restores the layer's own. */
export function combineFilter(
    base: FilterSpecification | undefined,
    focus: FilterSpecification | null | undefined,
): FilterSpecification | null {
    if (!focus) return base ?? null;
    return base ? (['all', base, focus] as FilterSpecification) : focus;
}

/** Where the county fills take over from the national view. */
export const COUNTY_MIN_ZOOM = 6;
const LEVEL_MIN_ZOOM: Record<MapLevel, number> = {
    county: COUNTY_MIN_ZOOM,
    constituency: CONSTITUENCY_MIN_ZOOM,
    ward: WARD_MIN_ZOOM,
};

// The camera fits small units no closer than its maximum zoom, so a ward and the constituency
// around it can report the same fit zoom. These caps keep each level's floor at least a level and
// a quarter under its child's, so every level is on screen for a while on the way out.
const FIT_ZOOM_CAP: Record<MapLevel, number> = {
    ward: 14,
    constituency: 12.75,
    county: 11.5,
};

/**
 * The zoom below which a focused unit gives way to its parent: 1.25 levels below the zoom that
 * fits the unit, so a small unit steps up soon after it is zoomed out of. It is never lower than
 * half a level under where the unit's own level takes over, so a huge unit (Turkana, Marsabit)
 * shown at a low zoom is not stepped up the moment it appears.
 */
export const focusFloor = (level: MapLevel, fitZoom: number): number =>
    Math.max(
        LEVEL_MIN_ZOOM[level] - 0.5,
        Math.min(fitZoom, FIT_ZOOM_CAP[level]) - 1.25,
    );

function parentOf(
    sel: FocusSelection,
    index: UnitIndex,
): FocusSelection | null {
    if (sel.level === 'county') return null;
    const parent = index.get(sel.level, sel.code)?.p;
    if (parent === null || parent === undefined) return null;
    return {
        level: sel.level === 'ward' ? 'constituency' : 'county',
        code: parent,
    };
}

/**
 * The focus after the person has zoomed out to `zoom`: the same unit while it is still in view,
 * otherwise its parent, and so on (a fast zoom-out can step several levels). Null means all of
 * Kenya. Zooming back in never narrows the focus again.
 */
export function stepUpFor(
    sel: FocusSelection | null,
    zoom: number,
    fitZoomOf: (sel: FocusSelection) => number,
    index: UnitIndex,
): FocusSelection | null {
    let current = sel;
    while (current && zoom < focusFloor(current.level, fitZoomOf(current)))
        current = parentOf(current, index);
    return current;
}
