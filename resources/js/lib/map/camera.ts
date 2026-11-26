// How much of the screen the map may not use: the bottom sheet on phones, the side panel on desktop.
// A unit is fitted inside what is left, so it sits in the middle of the visible map.
export interface MapPadding {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export const SIDE_PANEL_WIDTH = 380;
/** The zoom buttons sit at the right edge, so both sides keep this much clear and the unit stays centred. */
const CONTROLS_CLEARANCE = 56;
/** The sheet may cover this share of a phone screen before the map stops making room for it. */
const MAX_SHEET_SHARE = 0.6;

export function mapPadding({
    desktop,
    sheetHeight,
    viewport,
}: {
    desktop: boolean;
    sheetHeight: number;
    viewport: { width: number; height: number };
}): MapPadding {
    if (desktop)
        return {
            left: SIDE_PANEL_WIDTH + CONTROLS_CLEARANCE,
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
