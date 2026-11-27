// The map image on a "Share this view" card: the same seat colouring, highlight, focus and
// surroundings as on screen (seatColouring, focusFilters through unitStyle), drawn off-screen at
// the card's map box size with the card's own background so the map sits on the card. Seat
// colours are drawn solid, so the map matches the card's bars.
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Colouring } from '@/lib/map/colouring';
import { SEAT_LEVEL } from '@/lib/map/colouring';
import { KENYA_BOUNDS, type MapLevel } from '@/lib/map/levels';
import { buildStyle } from '@/lib/map/style';
import type { MapTheme } from '@/lib/map/theme';
import {
    type SeatsData,
    countySeatsColouring,
    mpOutline,
    seatColouring,
} from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import type { Box } from './layout';
import { unitStyle } from './locator';
import { renderMapImage } from './renderMapImage';
import type { ViewState } from './viewState';

/**
 * What the map image reads of a card: the seat to colour by, the parties to highlight, the focus
 * and whether the surroundings show. The seat view and the party card both have them.
 */
export type ViewMapSpec = Pick<
    ViewState,
    'seat' | 'only' | 'focus' | 'showSurroundings'
> & {
    /** A county leaders card: stripe the counties by their three seats instead of `seat`. */
    stripes?: boolean;
    /** Outline each constituency in its MP's party colour, over the MCA ward fills. */
    outline?: boolean;
    /** The highlight of those outlines. */
    onlyMp?: readonly string[];
    /**
     * A colouring made by the card itself (a locator, the top-10 map), drawn as it is in place of
     * the seat colouring. `seat` still decides which level's fills are coloured and whether ward
     * lines are drawn, so a colouring by county (the top-10 map, of MP or MCA counts) goes with a
     * seat held at the county, such as `governor`, and no focus.
     */
    colouring?: Colouring;
    /**
     * Draw each county line over a wider halo in the card's land colour, so the line between two
     * counties filled in one colour (the top-10 map) still shows, in either theme.
     */
    haloCountyLines?: boolean;
    /** Parties drawn in the "Other" grey, as a card's key folds them into "Other parties". */
    fold?: readonly string[];
    /** False: no ward lines, even on an MCA map (a small map of all 1,450 wards). */
    wardLines?: boolean;
    /**
     * A unit marked inside the frame (the focus), as the ward card's locators have it: it is
     * filled in the ink colour and every other unit of its level in the no-data colour, and it is
     * outlined in place of the frame. Never a seat's colour, which could be read as a party. `seat`
     * should be the seat held at the mark's level (`mca` for a ward, `mp` for a constituency).
     */
    mark?: { level: 'constituency' | 'ward'; code: number };
    /** Draw the map on the theme's surface colour (a paper on the card), not its land colour. */
    onSurface?: boolean;
};

/** The seat held at a marked unit's level: which fills the mark's colouring colours. */
const MARK_SEAT = { constituency: 'mp', ward: 'mca' } as const;

/**
 * The least size, in pixels, a marked unit may be drawn at and still be found. A smaller one gets
 * a ring around it (see `markRing`).
 */
export const MARK_MIN_PX = 10;
/** The ring's radius and line width, in pixels. */
const RING_RADIUS = Math.round(MARK_MIN_PX * 0.8);
const RING_WIDTH = 2;

const mercY = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercSize = ([w, s, e, n]: [number, number, number, number]) => ({
    dx: ((e - w) * Math.PI) / 180,
    dy: mercY(n) - mercY(s),
});
/** The padding `renderViewMap` leaves around the frame in a box. */
const mapPadding = (map: Box) => Math.round(Math.min(map.w, map.h) * 0.03);

/**
 * Where to ring the marked unit, when it is drawn smaller than MARK_MIN_PX across in this box (a
 * city ward inside its county); null when it is large enough to find, or there is no mark. `drawn`
 * is its larger side in pixels, `centre` the middle of its bounding box.
 */
export function markRing(
    view: ViewMapSpec,
    ctx: Pick<ViewMapContext, 'index'>,
    map: Box,
): { centre: [number, number]; drawn: number } | null {
    if (!view.mark || !view.focus) return null;
    const unit = ctx.index.get(view.mark.level, view.mark.code);
    if (!unit) return null;
    const frame = mercSize(view.focus.b);
    const pad = mapPadding(map);
    const scale = Math.min(
        (map.w - 2 * pad) / frame.dx,
        (map.h - 2 * pad) / frame.dy,
    );
    const mark = mercSize(unit.b);
    const drawn = Math.max(mark.dx, mark.dy) * scale;
    if (drawn >= MARK_MIN_PX) return null;
    const [w, s, e, n] = unit.b;
    return { centre: [(w + e) / 2, (s + n) / 2], drawn };
}

/** The seats with these parties' colours unset, so everything draws them in the "Other" grey. */
export const foldParties = (
    seats: SeatsData,
    fold: readonly string[],
): SeatsData =>
    fold.length
        ? {
              ...seats,
              parties: seats.parties.map((p) =>
                  fold.includes(p.abbrev) ? { ...p, colour: null } : p,
              ),
          }
        : seats;

/** The halo's width in pixels behind each county line, where a spec asks for one. */
const COUNTY_HALO_WIDTH = 2.2;

export interface ViewMapContext {
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
    index: UnitIndex;
    seats: SeatsData;
}

/** The colouring on screen for this view and theme: the same seatColouring and highlight. */
export function viewColouring(
    view: ViewMapSpec,
    seats: SeatsData,
    theme: MapTheme,
): Colouring {
    if (view.colouring) return view.colouring;
    if (view.mark)
        return {
            mode: { kind: 'seat', seat: MARK_SEAT[view.mark.level] },
            colours: new Map([[view.mark.code, theme.ink]]),
            fallback: theme.noData,
        };
    if (view.fold?.length) seats = foldParties(seats, view.fold);
    const tokens = {
        noData: theme.noData,
        faded: theme.faded,
        only: new Set(view.only),
    };
    if (view.stripes) return countySeatsColouring(seats, tokens);
    const colouring = seatColouring(seats, view.seat, tokens);
    return view.outline
        ? {
              ...colouring,
              outline: mpOutline(seats, {
                  noData: theme.noData,
                  faded: theme.faded,
                  only: new Set(view.onlyMp ?? []),
              }),
          }
        : colouring;
}

/** Width over height of the area the card's map shows, in Web Mercator. */
export function viewMapAspect(view: ViewMapSpec): number {
    const [w, s, e, n] = view.focus?.b ?? KENYA_BOUNDS;
    const y = (lat: number) =>
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const dx = ((e - w) * Math.PI) / 180;
    const dy = y(n) - y(s);
    return dy > 0 ? dx / dy : 1;
}

export function viewStyle(
    view: ViewMapSpec,
    ctx: ViewMapContext,
    theme: MapTheme,
    /** The map's box on the card: with it, a marked unit too small to find is ringed. */
    map?: Box,
): StyleSpecification {
    const colouring = viewColouring(view, ctx.seats, theme);
    const unit = view.focus
        ? ctx.index.get(view.focus.level, view.focus.code)
        : undefined;
    const base =
        view.focus && unit
            ? unitStyle(
                  {
                      manifest: ctx.manifest,
                      provinceOfCounty: ctx.provinceOfCounty,
                      theme,
                      colouring,
                      focus: {
                          index: ctx.index,
                          showSurroundings: view.showSurroundings,
                      },
                      seatFillOpacity: 1,
                  },
                  { ...unit, l: view.focus.level },
              )
            : buildStyle({
                  manifest: ctx.manifest,
                  theme,
                  colouring,
                  provinceOfCounty: ctx.provinceOfCounty,
                  wards: !view.stripes && SEAT_LEVEL[view.seat] === 'ward',
                  seatFillOpacity: 1,
              });
    // The card's background goes behind the map, so the shape stands on the card. Place names
    // are left out: at card size they would be too small to read on a phone. Ward lines are
    // only kept where they carry the colouring (MCA seats) or the unit is a constituency or
    // smaller, so a county or all of Kenya reads as its seats, not as a mesh.
    const wardLines =
        view.wardLines !== false &&
        !view.stripes &&
        (SEAT_LEVEL[view.seat] === 'ward' ||
            view.focus?.level === 'constituency' ||
            view.focus?.level === 'ward');
    const layers = base.layers
        .filter(
            (l) =>
                l.id !== 'overlays-anchor' &&
                l.type !== 'symbol' &&
                (wardLines || !l.id.startsWith('wards-line')),
        )
        .map((l): LayerSpecification =>
            l.type === 'background'
                ? {
                      ...l,
                      paint: {
                          'background-color': view.onSurface
                              ? theme.surface
                              : theme.land,
                      },
                  }
                : l,
        )
        .flatMap((l): LayerSpecification[] =>
            view.haloCountyLines && l.id === 'counties-line'
                ? [
                      {
                          id: 'counties-line-halo',
                          type: 'line',
                          source: 'counties',
                          layout: { 'line-join': 'round' },
                          paint: {
                              'line-color': theme.land,
                              'line-width': COUNTY_HALO_WIDTH,
                          },
                      },
                      l,
                  ]
                : [l],
        );
    const ring = map ? markRing(view, ctx, map) : null;
    if (!ring) return { ...base, layers };
    return {
        ...base,
        sources: {
            ...base.sources,
            'mark-ring': {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: ring.centre },
                },
            },
        },
        layers: [
            ...layers,
            {
                id: 'mark-ring',
                type: 'circle',
                source: 'mark-ring',
                paint: {
                    'circle-radius': RING_RADIUS,
                    'circle-opacity': 0,
                    'circle-stroke-color': theme.ink,
                    'circle-stroke-width': RING_WIDTH,
                },
            },
        ],
    };
}

/**
 * How far the card's map may zoom in to fill its box. A small urban constituency (Mathare is
 * under 5 km across) needs more than the on-screen map's usual 13 to fill the card.
 */
export const VIEW_MAP_MAX_ZOOM = 16;

/** Draw the view's map at the exact pixel size of its box on the card. */
export function renderViewMap(
    view: ViewMapSpec,
    ctx: ViewMapContext,
    theme: MapTheme,
    map: Box,
): Promise<string> {
    const pad = mapPadding(map);
    // A marked unit is outlined in place of the frame.
    const outlined = view.mark ?? view.focus;
    return renderMapImage({
        style: viewStyle(view, ctx, theme, map),
        bounds: view.focus?.b ?? KENYA_BOUNDS,
        width: map.w,
        height: map.h,
        highlight: outlined
            ? { level: outlined.level as MapLevel, code: outlined.code }
            : undefined,
        padding: pad,
        maxZoom: VIEW_MAP_MAX_ZOOM,
    });
}
