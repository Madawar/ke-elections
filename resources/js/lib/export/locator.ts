// Data for the "Unit locator" card: the unit's seats with their current holders, the legend for
// the map colouring, and the two map images (the unit, and Kenya with the unit marked).
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import {
    type Colouring,
    NO_COLOURING,
    type SeatKey,
    SEAT_LEVEL,
} from '@/lib/map/colouring';
import { combineFilter, focusFilters, focusOutside } from '@/lib/map/focus';
import { KENYA_BOUNDS, type MapLevel } from '@/lib/map/levels';
import { SOURCE_OF, buildStyle } from '@/lib/map/style';
import { type MapTheme, OTHER } from '@/lib/map/theme';
import { INDEPENDENT, type SeatsData, partyColours } from '@/lib/seats';
import { type Level, type Unit, type UnitIndex, seatsFor } from '@/lib/units';
import type { Box } from './layout';
import { renderMapImage } from './renderMapImage';

export interface CardSeat {
    key: SeatKey;
    label: string;
    holder: {
        name: string;
        /** Party name for display ("Independent" for independents). */
        party: string;
        abbrev: string;
        colour: string;
        sourceUrl: string;
    } | null;
}

export const SEAT_SHORT: Record<SeatKey, string> = {
    governor: 'Governor',
    senator: 'Senator',
    woman_rep: 'Woman Rep',
    mp: 'MP',
    mca: 'MCA',
};

export function partyLabel(data: SeatsData, abbrev: string | null): string {
    if (!abbrev) return 'No party recorded';
    if (abbrev === INDEPENDENT) return 'Independent';
    return data.parties.find((p) => p.abbrev === abbrev)?.name ?? abbrev;
}

/** The unit's elective seats, each with its current holder (or null: "No approved data yet"). */
export function cardSeats(data: SeatsData, unit: Unit): CardSeat[] {
    if (unit.l === 'province') return [];
    const colours = partyColours(data);
    return seatsFor(unit.l).map((seat) => {
        const h = data.holders.find(
            (x) =>
                x.seat === seat.key && x.level === unit.l && x.code === unit.c,
        );
        return {
            key: seat.key,
            label: seat.label,
            holder: h
                ? {
                      name: h.name,
                      party: partyLabel(data, h.party),
                      abbrev: h.party ?? '',
                      colour: (h.party && colours.get(h.party)) || OTHER,
                      sourceUrl: h.source_url,
                  }
                : null,
        };
    });
}

const DEPTH: Record<Level, number> = {
    province: 0,
    county: 1,
    constituency: 2,
    ward: 3,
};

/** Codes at `level` that cover the unit: its ancestor or itself above, its descendants below. */
export function codesAtLevel(
    index: UnitIndex,
    unit: Unit,
    level: MapLevel,
): number[] {
    if (DEPTH[level] <= DEPTH[unit.l]) {
        if (level === unit.l) return [unit.c];
        const a = index.ancestors(unit.l, unit.c).find((u) => u.l === level);
        return a ? [a.c] : [];
    }
    let frontier = [unit];
    while (frontier.length && frontier[0].l !== level)
        frontier = frontier.flatMap((u) => index.children(u.l, u.c));
    return frontier.map((u) => u.c).sort((a, b) => a - b);
}

export interface MapLegend {
    title: string;
    /** A null colour means the row has no single colour on the map (no swatch). */
    rows: { label: string; colour: string | null; count: number }[];
}

/**
 * What the map's seat colouring shows inside the unit: one row per colour, with how many seats
 * have it. Null when the map is not coloured by a seat.
 */
export function mapLegend(
    data: SeatsData,
    index: UnitIndex,
    unit: Unit,
    colouring: Colouring,
    maxRows = 6,
): MapLegend | null {
    const mode = colouring.mode;
    if (mode.kind !== 'seat') return null;
    const level = SEAT_LEVEL[mode.seat];
    const area =
        DEPTH[level] < DEPTH[unit.l]
            ? (index.ancestors(unit.l, unit.c).find((u) => u.l === level) ??
              unit)
            : unit;
    const colours = partyColours(data);
    const counts = new Map<string, { colour: string | null; count: number }>();
    for (const code of codesAtLevel(index, unit, level)) {
        const h = data.holders.find(
            (x) => x.seat === mode.seat && x.level === level && x.code === code,
        );
        const colour = colouring.colours.get(code) ?? colouring.fallback;
        // A party left out by the "only these parties" filter is drawn faded: say so.
        const label = !h?.party
            ? 'No approved data'
            : colour !== (colours.get(h.party) ?? OTHER)
              ? 'Not selected'
              : h.party === INDEPENDENT
                ? 'Independent'
                : h.party;
        const row = counts.get(label) ?? { colour, count: 0 };
        row.count++;
        counts.set(label, row);
    }
    const rows = [...counts.entries()]
        .map(([label, r]) => ({ label, ...r }))
        .sort(
            (a, b) =>
                Number(a.label === 'No approved data') -
                    Number(b.label === 'No approved data') ||
                b.count - a.count ||
                a.label.localeCompare(b.label),
        );
    // Past `maxRows` rows, the smallest parties fold into "Other parties"; independents and
    // units with no data always keep their own rows.
    const apart = (r: { label: string }) =>
        r.label === 'No approved data' || r.label === 'Independent';
    const parties = rows.filter((r) => !apart(r));
    const kept = rows.filter((r) => r.label === 'Independent');
    const room = Math.max(0, maxRows - 1 - kept.length);
    const rest = parties.slice(room);
    if (parties.length + kept.length > maxRows && rest.length) {
        return {
            title: legendTitle(mode.seat, area),
            rows: [
                ...[...parties.slice(0, room), ...kept].sort(
                    (a, b) =>
                        b.count - a.count || a.label.localeCompare(b.label),
                ),
                {
                    // Their colours vary on the map, so this row gets no swatch.
                    label: 'Other parties',
                    colour: null,
                    count: rest.reduce((n, r) => n + r.count, 0),
                },
                ...rows.filter((r) => r.label === 'No approved data'),
            ],
        };
    }
    return { title: legendTitle(mode.seat, area), rows };
}

const legendTitle = (seat: SeatKey, area: Unit) =>
    `${SEAT_SHORT[seat]} seats by party in ${area.n}`;

// ---- map images ------------------------------------------------------------------------

export interface LocatorMapContext {
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
    theme: MapTheme;
    colouring: Colouring;
    /** The map as on screen: only the unit drawn, or with its surroundings faint when shown. */
    focus?: { index: UnitIndex; showSurroundings: boolean };
    /** Draw seat colours at this opacity instead of the screen's (see StyleInput). */
    seatFillOpacity?: number;
}

const centre = (b: Unit['b']): [number, number] => [
    (b[0] + b[2]) / 2,
    (b[1] + b[3]) / 2,
];

/** Kenya with no labels, the unit's county filled and a dot on the unit. */
export function insetStyle(
    ctx: LocatorMapContext,
    unit: Unit,
    countyCode: number,
): StyleSpecification {
    const base = buildStyle({
        manifest: ctx.manifest,
        theme: ctx.theme,
        colouring: NO_COLOURING,
        provinceOfCounty: ctx.provinceOfCounty,
    });
    return {
        ...base,
        sources: {
            ...base.sources,
            'export-unit': {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: centre(unit.b) },
                },
            },
        },
        layers: [
            ...base.layers.filter(
                (l) =>
                    l.type !== 'symbol' &&
                    !l.id.endsWith('-selected') &&
                    l.id !== 'overlays-anchor',
            ),
            {
                id: 'export-county',
                type: 'fill',
                source: 'counties',
                filter: ['==', ['get', 'code'], countyCode],
                paint: { 'fill-color': ctx.theme.ink, 'fill-opacity': 0.35 },
            },
            {
                id: 'export-dot',
                type: 'circle',
                source: 'export-unit',
                paint: {
                    'circle-radius': 5,
                    'circle-color': ctx.theme.selected,
                    'circle-stroke-color': ctx.theme.surface,
                    'circle-stroke-width': 2,
                },
            },
        ],
    };
}

/**
 * The map as on screen (theme and colouring), with every ward line available at any zoom and
 * the units around the selected one washed out, so the card reads at a glance.
 */
export function unitStyle(
    ctx: LocatorMapContext,
    unit: Unit & { l: MapLevel },
): StyleSpecification {
    const base = buildStyle({
        manifest: ctx.manifest,
        theme: ctx.theme,
        colouring: ctx.colouring,
        provinceOfCounty: ctx.provinceOfCounty,
        wards: true,
        seatFillOpacity: ctx.seatFillOpacity,
        focus: ctx.focus
            ? {
                  outside: ctx.focus.showSurroundings
                      ? focusOutside({ level: unit.l, code: unit.c })
                      : undefined,
                  level: unit.l,
              }
            : undefined,
    });
    if (ctx.focus) {
        const filters = focusFilters(
            { level: unit.l, code: unit.c },
            ctx.focus.index,
            { surroundings: ctx.focus.showSurroundings },
        );
        return {
            ...base,
            layers: base.layers.map((layer) => {
                if (!(layer.id in filters)) return layer;
                const filter = combineFilter(
                    (layer as { filter?: never }).filter,
                    filters[layer.id],
                );
                if (!filter) return layer;
                return { ...layer, filter } as LayerSpecification;
            }),
        };
    }
    const dim: LayerSpecification = {
        id: 'export-dim',
        type: 'fill',
        source: SOURCE_OF[unit.l],
        filter: ['!=', ['get', 'code'], unit.c],
        paint: { 'fill-color': ctx.theme.ground, 'fill-opacity': 0.6 },
    };
    const firstLine = base.layers.findIndex((l) => l.type === 'line');
    const layers = [...base.layers];
    layers.splice(firstLine < 0 ? layers.length : firstLine, 0, dim);
    return { ...base, layers };
}

export interface LocatorImages {
    map?: string;
    inset?: string;
}

/**
 * Draw both images at the exact pixel size of their boxes on the card. The main map uses the
 * colouring on screen and outlines the unit; the inset is drawn after it (one WebGL context at
 * a time keeps low-end phones happy).
 */
export async function renderLocatorImages(
    ctx: LocatorMapContext,
    unit: Unit & { l: MapLevel },
    countyCode: number,
    boxes: { map: Box; inset: Box; legendHeight: number },
): Promise<LocatorImages> {
    const { map, inset } = boxes;
    const pad = Math.round(Math.min(map.w, map.h) * 0.08);
    const mapImage = await renderMapImage({
        style: unitStyle(ctx, unit),
        bounds: unit.b,
        width: map.w,
        height: map.h,
        highlight: { level: unit.l, code: unit.c },
        padding: {
            top: pad,
            left: pad,
            right: pad,
            bottom: pad + boxes.legendHeight,
        },
    });
    const insetImage = await renderMapImage({
        style: insetStyle(ctx, unit, countyCode),
        bounds: KENYA_BOUNDS,
        width: inset.w,
        height: inset.h,
        padding: 4,
    });
    return { map: mapImage, inset: insetImage };
}
