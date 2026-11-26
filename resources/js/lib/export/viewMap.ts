// The map image on a "Share this view" card: the same seat colouring, highlight, focus and
// surroundings as on screen (seatColouring, focusFilters through unitStyle), drawn off-screen at
// the card's map box size with the card's own background so the map sits on the card.
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Colouring } from '@/lib/map/colouring';
import { SEAT_LEVEL } from '@/lib/map/colouring';
import { KENYA_BOUNDS, type MapLevel } from '@/lib/map/levels';
import { buildStyle } from '@/lib/map/style';
import {
    INDEPENDENT_NEUTRAL,
    type MapTheme,
    type ThemeName,
} from '@/lib/map/theme';
import { INDEPENDENT, type SeatsData, seatColouring } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import type { Box } from './layout';
import { unitStyle } from './locator';
import { renderMapImage } from './renderMapImage';
import type { ViewState } from './viewState';

export interface ViewMapContext {
    manifest: Record<string, string>;
    provinceOfCounty: Map<number, number>;
    index: UnitIndex;
    seats: SeatsData;
}

/**
 * The colouring on screen for this view and theme. Where the card gives independents a row of
 * their own, their areas take the same neutral as that row instead of the "Other" grey.
 */
export function viewColouring(
    view: ViewState,
    seats: SeatsData,
    theme: MapTheme,
    themeName: ThemeName,
): Colouring {
    const colouring = seatColouring(seats, view.seat, {
        noData: theme.noData,
        faded: theme.faded,
        only: new Set(view.only),
    });
    if (!view.rows.some((r) => r.kind === 'independent')) return colouring;
    const colours = new Map(colouring.colours);
    const level = SEAT_LEVEL[view.seat];
    for (const h of seats.holders)
        if (
            h.seat === view.seat &&
            h.level === level &&
            h.party === INDEPENDENT &&
            colours.get(h.code) !== theme.faded
        )
            colours.set(h.code, INDEPENDENT_NEUTRAL[themeName]);
    return { ...colouring, colours };
}

/** Width over height of the area the card's map shows, in Web Mercator. */
export function viewMapAspect(view: ViewState): number {
    const [w, s, e, n] = view.focus?.b ?? KENYA_BOUNDS;
    const y = (lat: number) =>
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const dx = ((e - w) * Math.PI) / 180;
    const dy = y(n) - y(s);
    return dy > 0 ? dx / dy : 1;
}

export function viewStyle(
    view: ViewState,
    ctx: ViewMapContext,
    theme: MapTheme,
    themeName: ThemeName,
): StyleSpecification {
    const colouring = viewColouring(view, ctx.seats, theme, themeName);
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
                  },
                  { ...unit, l: view.focus.level },
              )
            : buildStyle({
                  manifest: ctx.manifest,
                  theme,
                  colouring,
                  provinceOfCounty: ctx.provinceOfCounty,
                  wards: SEAT_LEVEL[view.seat] === 'ward',
              });
    // The card's background goes behind the map, so the shape stands on the card. Place names
    // are left out: at card size they would be too small to read on a phone. Ward lines are
    // only kept where they carry the colouring (MCA seats) or the unit is a constituency or
    // smaller, so a county or all of Kenya reads as its seats, not as a mesh.
    const wardLines =
        SEAT_LEVEL[view.seat] === 'ward' ||
        view.focus?.level === 'constituency' ||
        view.focus?.level === 'ward';
    const layers = base.layers
        .filter(
            (l) =>
                l.id !== 'overlays-anchor' &&
                l.type !== 'symbol' &&
                (wardLines || !l.id.startsWith('wards-line')),
        )
        .map((l): LayerSpecification =>
            l.type === 'background'
                ? { ...l, paint: { 'background-color': theme.land } }
                : l,
        );
    return { ...base, layers };
}

/** Draw the view's map at the exact pixel size of its box on the card. */
export function renderViewMap(
    view: ViewState,
    ctx: ViewMapContext,
    theme: MapTheme,
    themeName: ThemeName,
    map: Box,
): Promise<string> {
    const pad = Math.round(Math.min(map.w, map.h) * 0.03);
    return renderMapImage({
        style: viewStyle(view, ctx, theme, themeName),
        bounds: view.focus?.b ?? KENYA_BOUNDS,
        width: map.w,
        height: map.h,
        highlight: view.focus
            ? { level: view.focus.level as MapLevel, code: view.focus.code }
            : undefined,
        padding: pad,
    });
}
