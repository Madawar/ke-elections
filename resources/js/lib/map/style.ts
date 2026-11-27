import type {
    ExpressionSpecification,
    LayerSpecification,
    StyleSpecification,
} from 'maplibre-gl';
import {
    type Colouring,
    NO_COLOURING,
    fillColor,
    isFinerThanSeat,
    pinnedLevel,
} from './colouring';
import { type MapLevel, levelOpacityStops } from './levels';
import type { MapTheme } from './theme';

export const GLYPHS = '/glyphs/{fontstack}/{range}.pbf';
export const SOURCES = [
    'provinces',
    'counties',
    'constituencies',
    'wards',
] as const;
export const EMPTY_FC = { type: 'FeatureCollection', features: [] } as const;
export const MAP_LEVELS: MapLevel[] = ['county', 'constituency', 'ward'];
export const SOURCE_OF: Record<
    MapLevel,
    'counties' | 'constituencies' | 'wards'
> = { county: 'counties', constituency: 'constituencies', ward: 'wards' };

/** Per source, true for features outside the focused unit (set only while "Show surroundings" is on). */
export type OutsideTests = Partial<
    Record<'counties' | 'constituencies' | 'wards', ExpressionSpecification>
>;
/** Present while a unit is focused: borders turn neutral and the unit's outline turns strong. */
export interface FocusStyle {
    outside?: OutsideTests;
    /** The focused unit's level; a seat colouring above it is carried down to that level's fill. */
    level?: MapLevel;
}
/** A seat colour is drawn this opaque, so the lines and labels over it stay legible. */
export const SEAT_FILL_OPACITY = 0.8;
/** Outside the focused unit, fills are at most this opaque, in a neutral grey. */
export const OUTSIDE_FILL_OPACITY = 0.15;
/** Outside the focused unit, boundary lines are drawn at this share of their usual opacity. */
export const OUTSIDE_LINE_FACTOR = 0.3;

export const fileUrl = (manifest: Record<string, string>, file: string) =>
    `/boundaries/${file}?v=${manifest[file] ?? ''}`;

const selected = [
    'boolean',
    ['feature-state', 'selected'],
    false,
] as ExpressionSpecification;
const hovered = [
    'boolean',
    ['feature-state', 'hover'],
    false,
] as ExpressionSpecification;
const state = (sel: number, hov: number, base: number) =>
    ['case', selected, sel, hovered, hov, base] as ExpressionSpecification;

/** Interpolate over zoom, multiplying a per-feature value by the level's cross-fade factor. */
function banded(
    level: MapLevel,
    value: (factor: number) => ExpressionSpecification | number,
): ExpressionSpecification {
    const stops = levelOpacityStops(level).flatMap(([z, f]) => [z, value(f)]);
    return [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...stops,
    ] as ExpressionSpecification;
}

const scaled = (e: ExpressionSpecification, f: number) =>
    f === 0 ? 0 : f === 1 ? e : (['*', f, e] as ExpressionSpecification);

export function fillOpacity(
    level: MapLevel,
    colouring: Colouring,
    outside?: ExpressionSpecification,
    focusLevel?: MapLevel,
    seatOpacity = SEAT_FILL_OPACITY,
): ExpressionSpecification {
    const seatFill = state(
        Math.max(0.9, seatOpacity),
        Math.max(0.85, seatOpacity),
        seatOpacity,
    );
    const pinned = pinnedLevel(colouring.mode);
    // Outside the focused unit a fill is only a faint grey wash. With seat colouring only the
    // coloured level washes, so the levels do not stack.
    const dim = (inner: ExpressionSpecification | number, wash: number) =>
        !outside || wash === 0
            ? inner
            : (['case', outside, wash, inner] as ExpressionSpecification);
    // Focused on a level below the seat colouring (a ward, for a Governor): the layer for that level
    // is the one that shows the colour, as the coloured level above it is out of the picture.
    if (focusLevel === level && isFinerThanSeat(level, colouring.mode)) {
        return (
            outside ? ['case', outside, 0, seatFill] : seatFill
        ) as ExpressionSpecification;
    }
    if (pinned === level)
        return dim(seatFill, OUTSIDE_FILL_OPACITY) as ExpressionSpecification;
    const tinted =
        colouring.mode.kind === 'province'
            ? state(0.95, 0.9, 0.72)
            : state(0.16, 0.08, 0);
    return banded(
        level,
        (f) =>
            dim(
                scaled(tinted, f),
                pinned || f === 0 ? 0 : OUTSIDE_FILL_OPACITY * f,
            ) as never,
    );
}

/** A casing is this much wider than the line it lies under. */
export const CASING_RATIO = 1.5;

/**
 * Boundary lines, thickest for counties; constituency and ward lines fade in ahead of their fills.
 * Each line is drawn twice: a casing in the ground colour underneath, then the line on top, so a
 * border reads against any fill. Lines use only the neutral line tokens, never a party colour.
 * The casing is off in the "boundaries only" view, which looks as it always has.
 */
function lineLayers(
    theme: MapTheme,
    cased: boolean,
    focus?: FocusStyle,
): LayerSpecification[] {
    const width = (stops: number[]) =>
        [
            'interpolate',
            ['linear'],
            ['zoom'],
            ...stops,
        ] as ExpressionSpecification;
    const widen = (stops: number[]) =>
        stops.map((v, i) => (i % 2 === 1 ? v * CASING_RATIO : v));
    // Line opacity, faded outside the focused unit when the surroundings are shown.
    const opacity = (
        stops: number[],
        source: 'counties' | 'constituencies' | 'wards',
    ): ExpressionSpecification | number => {
        const outside = focus?.outside?.[source];
        const fade = (v: number) =>
            outside
                ? (['case', outside, v * OUTSIDE_LINE_FACTOR, v] as never)
                : v;
        if (stops.length === 1) return fade(stops[0]) as never;
        return [
            'interpolate',
            ['linear'],
            ['zoom'],
            ...stops.flatMap((v, i) => (i % 2 === 0 ? [v] : [fade(v)])),
        ] as ExpressionSpecification;
    };
    // Inside a focused unit the constituency lines are clearly heavier than the ward lines.
    const wardWidth = focus
        ? [9, 0.5, 12, 1, 15, 1.4]
        : [9, 0.3, 12, 1, 15, 1.6];
    const constituencyWidth = focus
        ? [6.2, 0.6, 9, 1.6, 12, 2.6, 15, 3.4]
        : [6.2, 0.4, 9, 1, 12, 1.8];
    const countyWidth = [4, 0.8, 7, 1.6, 12, 2.8];
    const lines = [
        {
            name: 'wards' as const,
            minzoom: 8.6,
            colour: theme.wardLine,
            stops: wardWidth,
            fade: [8.6, 0, 9.4, 1],
        },
        {
            name: 'constituencies' as const,
            minzoom: 6.2,
            colour: theme.constituencyLine,
            stops: constituencyWidth,
            fade: [6.2, 0, 7.1, 0.9],
        },
        {
            name: 'counties' as const,
            minzoom: undefined,
            colour: theme.countyLine,
            stops: countyWidth,
            fade: [0.9],
        },
    ].flatMap(({ name, minzoom, colour, stops, fade }) => {
        const layer = (
            id: string,
            lineColour: string,
            lineWidth: number[],
            lineOpacity: ExpressionSpecification | number,
        ): LayerSpecification => ({
            id,
            type: 'line',
            source: name,
            ...(minzoom === undefined ? {} : { minzoom }),
            ...(name === 'counties'
                ? { layout: { 'line-join': 'round' as const } }
                : {}),
            paint: {
                'line-color': lineColour,
                'line-width': width(lineWidth),
                'line-opacity': lineOpacity,
            },
        });
        const strength = opacity(fade, name);
        return [
            layer(
                `${name}-line-casing`,
                theme.ground,
                widen(stops),
                cased ? strength : 0,
            ),
            layer(`${name}-line`, colour, stops, strength),
        ];
    });
    return [
        ...lines,
        ...SOURCES.filter((s) => s !== 'provinces').map(
            (source): LayerSpecification => ({
                id: `${source}-selected`,
                type: 'line',
                source,
                layout: { 'line-join': 'round' },
                paint: {
                    'line-color': focus ? theme.ink : theme.selected,
                    'line-width': width(
                        focus ? [4, 3.4, 12, 5.6] : [4, 2.4, 12, 4],
                    ),
                    'line-opacity': ['case', selected, 1, 0],
                },
            }),
        ),
    ];
}

function labelLayers(
    theme: MapTheme,
    showProvinces: boolean,
): LayerSpecification[] {
    const opacity = (stops: number[]) =>
        [
            'interpolate',
            ['linear'],
            ['zoom'],
            ...stops,
        ] as ExpressionSpecification;
    const base = (
        level: string,
        font: string,
        size: number[],
        extra: Partial<LayerSpecification> & {
            minzoom?: number;
            maxzoom?: number;
        },
        textOpacity: number[],
    ) =>
        ({
            id: `labels-${level}`,
            type: 'symbol',
            source: 'labels',
            filter: ['==', ['get', 'level'], level],
            ...extra,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': [font],
                'text-size': ['interpolate', ['linear'], ['zoom'], ...size],
                'text-allow-overlap': false,
                'text-padding': 3,
                'text-max-width': 7,
                'symbol-sort-key': ['get', 'code'],
                'text-letter-spacing': level === 'county' ? 0.02 : 0,
            },
            paint: {
                'text-color': theme.label,
                'text-halo-color': theme.labelHalo,
                'text-halo-width': 1.6,
                'text-opacity': opacity(textOpacity),
            },
        }) as LayerSpecification;
    return [
        base(
            'ward',
            'Noto Sans Regular',
            [9.3, 10, 13, 13],
            { minzoom: 9.1 },
            [9.1, 0, 9.7, 1],
        ),
        base(
            'constituency',
            'Noto Sans Regular',
            [6.8, 10.5, 9.5, 13],
            { minzoom: 6.6, maxzoom: 10.3 },
            [6.6, 0, 7.2, 1, 9.6, 1, 10.3, 0],
        ),
        base(
            'county',
            'Noto Sans Medium',
            [4, 10, 7, 14],
            { maxzoom: 8 },
            [4, 1, 7.2, 1, 7.9, 0],
        ),
        {
            ...base(
                'province',
                'Noto Sans Medium',
                [4, 11, 6, 14],
                { maxzoom: 6.4 },
                [4, 0.85, 6, 0.85, 6.4, 0],
            ),
            layout: {
                ...(
                    base(
                        'province',
                        'Noto Sans Medium',
                        [4, 11, 6, 14],
                        {},
                        [0, 1],
                    ) as { layout: object }
                ).layout,
                visibility: showProvinces ? 'visible' : 'none',
                'text-letter-spacing': 0.08,
            },
        } as LayerSpecification,
    ];
}

/** Outside the focused unit nothing is party-coloured: it is one neutral grey. */
const focusedColour = (
    colour: ExpressionSpecification | string,
    outside: ExpressionSpecification | undefined,
    neutral: string,
) =>
    outside
        ? (['case', outside, neutral, colour] as ExpressionSpecification)
        : colour;

export interface StyleInput {
    manifest: Record<string, string>;
    theme: MapTheme;
    colouring?: Colouring;
    provinceOfCounty: Map<number, number>;
    /** Load ward geometry now (otherwise the source starts empty and is filled on demand). */
    wards?: boolean;
    /** Set while a unit is focused. */
    focus?: FocusStyle;
    /** How opaque a seat colour is drawn; image exports draw it solid to match their bars. */
    seatFillOpacity?: number;
}

export function buildStyle({
    manifest,
    theme,
    colouring = NO_COLOURING,
    provinceOfCounty,
    wards = false,
    focus,
    seatFillOpacity,
}: StyleInput): StyleSpecification {
    const geojson = (file: string) => ({
        type: 'geojson' as const,
        data: fileUrl(manifest, file),
        promoteId: 'code',
    });
    const fills = (['county', 'constituency', 'ward'] as MapLevel[]).map(
        (level): LayerSpecification => ({
            id: `${SOURCE_OF[level]}-fill`,
            type: 'fill',
            source: SOURCE_OF[level],
            paint: {
                'fill-color': focusedColour(
                    fillColor(
                        colouring,
                        level,
                        provinceOfCounty,
                        theme.ink,
                        focus !== undefined,
                    ),
                    focus?.outside?.[SOURCE_OF[level]],
                    theme.muted,
                ) as string,
                'fill-opacity': fillOpacity(
                    level,
                    colouring,
                    focus?.outside?.[SOURCE_OF[level]],
                    focus?.level,
                    seatFillOpacity,
                ),
            },
        }),
    );
    return {
        version: 8,
        glyphs: GLYPHS,
        sources: {
            provinces: geojson('provinces.geojson'),
            counties: geojson('counties.geojson'),
            constituencies: geojson('constituencies.geojson'),
            wards: wards
                ? geojson('wards.geojson')
                : {
                      type: 'geojson',
                      data: EMPTY_FC as never,
                      promoteId: 'code',
                  },
            labels: {
                type: 'geojson',
                data: fileUrl(manifest, 'labels.geojson'),
            },
        },
        layers: [
            {
                id: 'background',
                type: 'background',
                paint: { 'background-color': theme.ground },
            },
            {
                id: 'land',
                type: 'fill',
                source: 'counties',
                paint: { 'fill-color': theme.land },
            },
            // The county land fill is hidden by a constituency or ward focus, so the focused level
            // gets its own land base: its interior reads as Kenya, not as the area outside it.
            ...(['constituency', 'ward'] as const).map(
                (level): LayerSpecification => ({
                    id: `land-${SOURCE_OF[level]}`,
                    type: 'fill',
                    source: SOURCE_OF[level],
                    paint: {
                        'fill-color': theme.land,
                        'fill-opacity': focus?.level === level ? 1 : 0,
                    },
                }),
            ),
            ...fills,
            ...lineLayers(theme, colouring.mode.kind !== 'none', focus),
            {
                id: 'overlays-anchor',
                type: 'background',
                layout: { visibility: 'none' },
                paint: {},
            },
            ...labelLayers(theme, colouring.mode.kind === 'province'),
        ],
    };
}
