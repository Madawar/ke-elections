export type Level = 'province' | 'county' | 'constituency' | 'ward';
export type MapLevel = Exclude<Level, 'province'>;

export const CONSTITUENCY_MIN_ZOOM = 7;
export const WARD_MIN_ZOOM = 9.5;
/** Half-width of the cross-fade either side of each threshold. */
export const FADE = 0.6;
export const KENYA_BOUNDS: [number, number, number, number] = [
    33.9, -4.72, 41.91, 5.03,
];
export const MAX_BOUNDS: [number, number, number, number] = [22, -16, 54, 16];

const PARENT: Record<Level, Level | null> = {
    ward: 'constituency',
    constituency: 'county',
    county: 'province',
    province: null,
};
const CHILD: Record<Level, Level | null> = {
    province: 'county',
    county: 'constituency',
    constituency: 'ward',
    ward: null,
};

export const parentLevel = (l: Level): Level | null => PARENT[l];
export const childLevel = (l: Level): Level | null => CHILD[l];

export function levelForZoom(z: number): MapLevel {
    if (z >= WARD_MIN_ZOOM) return 'ward';
    if (z >= CONSTITUENCY_MIN_ZOOM) return 'constituency';
    return 'county';
}

/** [from, to] zoom band in which a level's fill is fully shown (before fades). */
export const LEVEL_BAND: Record<MapLevel, [number, number]> = {
    county: [-Infinity, CONSTITUENCY_MIN_ZOOM],
    constituency: [CONSTITUENCY_MIN_ZOOM, WARD_MIN_ZOOM],
    ward: [WARD_MIN_ZOOM, Infinity],
};

const ramp = (x: number, a: number, b: number) =>
    Math.min(1, Math.max(0, (x - a) / (b - a)));

/** 1 inside a level's band, 0 well outside it, linear across the ±FADE cross-fade. */
export function levelOpacity(level: MapLevel, zoom: number): number {
    const [from, to] = LEVEL_BAND[level];
    const fadeIn =
        from === -Infinity ? 1 : ramp(zoom, from - FADE, from + FADE);
    const fadeOut = to === Infinity ? 1 : 1 - ramp(zoom, to - FADE, to + FADE);
    return Math.min(fadeIn, fadeOut);
}

/** Zoom stops [zoom, factor] describing levelOpacity, for MapLibre interpolate expressions. */
export function levelOpacityStops(level: MapLevel): [number, number][] {
    const [from, to] = LEVEL_BAND[level];
    const stops: [number, number][] = [];
    if (from !== -Infinity) stops.push([from - FADE, 0], [from + FADE, 1]);
    if (to !== Infinity) stops.push([to - FADE, 1], [to + FADE, 0]);
    if (stops.length === 0) stops.push([0, 1], [24, 1]);
    return stops;
}

export interface Selection {
    level: Level;
    code: number;
}

export interface UnitLike {
    l: Level;
    c: number;
    p: number | null;
    b: [number, number, number, number];
}

/** Where "zoom out" goes from a selection: its parent unit (and bounds), or all of Kenya. */
export function zoomOutTarget(
    selection: Selection | null,
    get: (level: Level, code: number) => UnitLike | undefined,
): { unit: Selection | null; bounds: [number, number, number, number] } {
    if (!selection) return { unit: null, bounds: KENYA_BOUNDS };
    const unit = get(selection.level, selection.code);
    const up = parentLevel(selection.level);
    if (!unit || !up || up === 'province' || unit.p === null)
        return { unit: null, bounds: KENYA_BOUNDS };
    const parent = get(up, unit.p);
    return parent
        ? { unit: { level: up, code: parent.c }, bounds: parent.b }
        : { unit: null, bounds: KENYA_BOUNDS };
}
