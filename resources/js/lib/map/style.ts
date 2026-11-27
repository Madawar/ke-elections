import type {
    ExpressionSpecification,
    LayerSpecification,
    StyleSpecification,
} from 'maplibre-gl';
import {
    type Colouring,
    type OutlineColouring,
    NO_COLOURING,
    codeColour,
    fillColor,
    fillPattern,
    isFinerThanSeat,
    pinnedLevel,
} from './colouring';
import { patternId } from './stripes';
import { type MapLevel, levelOpacityStops } from './levels';
import type { MapTheme } from './theme';
import { NAME_LINE_MAX_EMS, fitsNameLine } from './wardLabels';

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
    /** The focused unit's code: a focused ward's label carries its MCA's name. */
    code?: number;
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
    outline?: OutlineColouring,
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
        ...outlineLayers(theme, focus, outline),
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

/**
 * The MP outline is this wide, in pixels, by zoom: 4 to 5 from zoom 12, where single wards are
 * read, and lighter further out, where a 4px band inside every small constituency of a whole
 * county (Nairobi City has 17) would bury the ward fills.
 */
const OUTLINE_WIDTH = [6.4, 1.5, 9, 2.5, 11, 3.2, 12, 4, 14, 5];
/** The ink edge on each side of it. */
const OUTLINE_EDGE = 1;

/**
 * MP outlines over the MCA wards: inside each constituency, a party-colour line between two thin
 * ink edges, so it reads even over wards of the same colour. It is offset inward by half its
 * width, so two neighbours each show their own MP's colour on their own side of a shared border.
 * The layers are always in the style (a restyle only changes paint); with no outline to draw
 * they are fully transparent. Outlines show from the constituency zoom band down, and at any
 * zoom while a unit is focused.
 */
function outlineLayers(
    theme: MapTheme,
    focus: FocusStyle | undefined,
    outline: OutlineColouring | undefined,
): LayerSpecification[] {
    const zoomed = (stops: number[], f: (v: number) => number) =>
        [
            'interpolate',
            ['linear'],
            ['zoom'],
            ...stops.map((v, i) => (i % 2 === 1 ? f(v) : v)),
        ] as ExpressionSpecification;
    const outside = focus?.outside?.constituencies;
    const shown: ExpressionSpecification | number = focus
        ? 1
        : (['interpolate', ['linear'], ['zoom'], 6.4, 0, 7.2, 1] as never);
    const opacity = !outline
        ? 0
        : outside
          ? (['case', outside, OUTSIDE_LINE_FACTOR, shown] as never)
          : shown;
    const colour = outline
        ? codeColour(outline.colours, outline.fallback)
        : theme.noData;
    const edged = (v: number) => v + 2 * OUTLINE_EDGE;
    // A focused constituency's own outline (ink, centred on its border) would cover most of the
    // band, so there the band starts inside that outline.
    const clear = (zoom: number) =>
        focus?.level === 'constituency'
            ? (3.4 + ((Math.min(12, zoom) - 4) / 8) * 2.2) / 2
            : 0;
    const offset = [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...OUTLINE_WIDTH.map((v, i) =>
            i % 2 === 1 ? edged(v) / 2 + clear(OUTLINE_WIDTH[i - 1]) : v,
        ),
    ] as ExpressionSpecification;
    const layer = (
        id: string,
        lineColour: unknown,
        lineWidth: ExpressionSpecification,
    ): LayerSpecification =>
        ({
            id,
            type: 'line',
            source: 'constituencies',
            layout: { 'line-join': 'round' },
            paint: {
                'line-color': lineColour,
                'line-width': lineWidth,
                'line-offset': offset,
                'line-opacity': opacity,
            },
        }) as LayerSpecification;
    return [
        layer('mp-outline-edge', theme.ink, zoomed(OUTLINE_WIDTH, edged)),
        layer(
            'mp-outline',
            outside ? ['case', outside, theme.muted, colour] : colour,
            zoomed(OUTLINE_WIDTH, (v) => v),
        ),
    ];
}

/** A filter that matches nothing: the layer stays in the style but places no label. */
const NO_LABELS = ['==', ['get', 'code'], -1] as const;

/**
 * The "MP: <ABBREV>" badge at each constituency's label point, and the selected ward's two-line
 * label with its MCA's name. Both sit under the labels they must give way to (MapLibre places
 * the layers on top first): the badge under the constituency and ward names, and the plain ward
 * name under the two-line label, so that if the two lines do not fit the name alone still shows.
 */
function seatLabelLayers(
    theme: MapTheme,
    colouring: Colouring,
    focus: FocusStyle | undefined,
): { badge: LayerSpecification; wardNames: LayerSpecification } {
    const text = {
        'text-allow-overlap': false,
        'text-padding': 3,
        'symbol-sort-key': ['get', 'code'],
    };
    const paint = {
        'text-color': theme.label,
        'text-halo-color': theme.labelHalo,
        'text-halo-width': 1.6,
    };
    const outline = colouring.outline;
    const badge = {
        id: 'labels-mp',
        type: 'symbol',
        source: 'labels',
        minzoom: 7,
        filter: ['==', ['get', 'level'], 'constituency'],
        layout: {
            ...text,
            'text-field': outline
                ? codeColour(outline.badges, outline.fallbackBadge)
                : '',
            'text-font': ['Noto Sans Medium'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 12],
            // Under the constituency's name where there is room, else beside or above it.
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            // Far enough from the point to clear a one-line constituency name.
            'text-radial-offset': 1.7,
            'text-justify': 'auto',
        },
        paint,
    } as unknown as LayerSpecification;

    // The selected ward's label carries its MCA's name (see wardLabels.ts for why only that one).
    // A name that would need more than two lines is left off rather than cut.
    const code = focus?.level === 'ward' ? focus.code : undefined;
    const line = code === undefined ? undefined : colouring.names?.get(code);
    const shown = line !== undefined && fitsNameLine(line);
    const wardNames = {
        id: 'labels-ward-mca',
        type: 'symbol',
        source: 'labels',
        filter: shown
            ? [
                  'all',
                  ['==', ['get', 'level'], 'ward'],
                  ['==', ['get', 'code'], code],
              ]
            : NO_LABELS,
        layout: {
            ...text,
            'text-field': shown
                ? [
                      'format',
                      ['get', 'name'],
                      {},
                      '\n',
                      {},
                      line,
                      { 'font-scale': 0.86, 'text-color': theme.muted },
                  ]
                : '',
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 9.3, 11, 13, 14],
            'text-max-width': NAME_LINE_MAX_EMS,
            'text-line-height': 1.15,
        },
        paint,
    } as unknown as LayerSpecification;
    return { badge, wardNames };
}

function labelLayers(
    theme: MapTheme,
    showProvinces: boolean,
    seat: { badge: LayerSpecification; wardNames: LayerSpecification },
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
        seat.badge,
        base(
            'ward',
            'Noto Sans Regular',
            [9.3, 10, 13, 13],
            { minzoom: 9.1 },
            [9.1, 0, 9.7, 1],
        ),
        seat.wardNames,
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
        (level): LayerSpecification => {
            // "County seats": each county's stripes. Outside the focused unit it is one neutral
            // grey, as every other colour is.
            const pattern = fillPattern(colouring, level);
            const outside = focus?.outside?.[SOURCE_OF[level]];
            const neutral = patternId([theme.muted, theme.muted, theme.muted]);
            return {
            id: `${SOURCE_OF[level]}-fill`,
            type: 'fill',
            source: SOURCE_OF[level],
            paint: {
                ...(pattern === undefined
                    ? {}
                    : {
                          'fill-pattern': (outside
                              ? ['case', outside, neutral, pattern]
                              : pattern) as never,
                      }),
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
            };
        },
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
            ...lineLayers(
                theme,
                colouring.mode.kind !== 'none',
                focus,
                colouring.outline,
            ),
            {
                id: 'overlays-anchor',
                type: 'background',
                layout: { visibility: 'none' },
                paint: {},
            },
            ...labelLayers(
                theme,
                colouring.mode.kind === 'province',
                seatLabelLayers(theme, colouring, focus),
            ),
        ],
    };
}
