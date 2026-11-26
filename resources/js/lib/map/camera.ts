// How much of the screen the map may not use: the bottom sheet on phones, the side panel on desktop.
// A unit is fitted inside what is left, so it sits in the middle of the visible map.
export interface MapPadding {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * Where to ease the camera to put a unit in the middle of the visible map without changing the
 * zoom. Passing the padding along is what makes "the middle" the middle of the visible part.
 */
export function centreOn(
    bounds: [number, number, number, number],
    padding: MapPadding,
    zoom: number,
    reducedMotion = false,
) {
    return {
        center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] as [
            number,
            number,
        ],
        zoom,
        padding,
        duration: reducedMotion ? 0 : 300,
    };
}

export const SIDE_PANEL_WIDTH = 380;
/** The open legend's width, and the gap that keeps a unit clear of it (w-72 in Legend.vue). */
export const LEGEND_WIDTH = 288;
const LEGEND_GAP = 16;
/** Where the legend's left edge is on desktop, just right of the side panel (md:left-[396px]). */
const LEGEND_LEFT = SIDE_PANEL_WIDTH + 16;
/** The zoom buttons sit at the right edge, so both sides keep this much clear and the unit stays centred. */
const CONTROLS_CLEARANCE = 56;
/** The sheet may cover this share of a phone screen before the map stops making room for it. */
const MAX_SHEET_SHARE = 0.6;

export function mapPadding({
    desktop,
    sheetHeight,
    viewport,
    legendOpen = false,
}: {
    desktop: boolean;
    sheetHeight: number;
    viewport: { width: number; height: number };
    /** The legend box sits at the bottom left of the map; a fitted unit stays clear of it. */
    legendOpen?: boolean;
}): MapPadding {
    if (desktop)
        return {
            left: legendOpen
                ? LEGEND_LEFT + LEGEND_WIDTH + LEGEND_GAP
                : SIDE_PANEL_WIDTH + CONTROLS_CLEARANCE,
            right: CONTROLS_CLEARANCE,
            top: 72,
            bottom: 72,
        };
    return {
        left: CONTROLS_CLEARANCE,
        right: CONTROLS_CLEARANCE,
        top: 72,
        bottom:
            Math.round(
                Math.min(sheetHeight, viewport.height * MAX_SHEET_SHARE),
            ) + 16,
    };
}
