import { describe, expect, it } from 'vitest';
import {
    CHIPS_BESIDE_SEARCH,
    LEGEND_WIDTH,
    centreOn,
    mapPadding,
} from '@/lib/map/camera';

describe('mapPadding', () => {
    it('keeps a phone unit centred in the map above a half-height sheet', () => {
        const viewport = { width: 390, height: 844 };
        const sheetHeight = Math.round(viewport.height * 0.46);
        const p = mapPadding({ desktop: false, sheetHeight, viewport });
        // The visible map is the part of the screen above the sheet.
        expect(p.bottom).toBeGreaterThanOrEqual(sheetHeight);
        const visibleTop = p.top;
        const visibleBottom = viewport.height - p.bottom;
        expect(visibleBottom).toBeGreaterThan(visibleTop);
        expect(visibleBottom).toBeLessThanOrEqual(
            viewport.height - sheetHeight,
        );
    });

    it('never gives more than 60 percent of a phone screen to the sheet', () => {
        const p = mapPadding({
            desktop: false,
            sheetHeight: 772,
            viewport: { width: 390, height: 844 },
        });
        expect(p.bottom).toBe(Math.round(844 * 0.6) + 16);
    });

    it('centres a phone unit horizontally, clear of the zoom buttons', () => {
        const p = mapPadding({
            desktop: false,
            sheetHeight: 388,
            viewport: { width: 390, height: 844 },
        });
        expect(p.left).toBe(p.right);
        expect(p.right).toBeGreaterThanOrEqual(56);
    });

    it('centres a desktop unit in the map to the right of the side panel', () => {
        // A wide desktop: the chips sit beside the search bar, so top and bottom are even.
        const viewport = { width: 1600, height: 900 };
        const p = mapPadding({ desktop: true, sheetHeight: 0, viewport });
        expect(p.left).toBeGreaterThanOrEqual(380);
        const middleX = (p.left + (viewport.width - p.right)) / 2;
        expect(middleX).toBe((380 + viewport.width) / 2);
        const middleY = (p.top + (viewport.height - p.bottom)) / 2;
        expect(middleY).toBe(viewport.height / 2);
    });
});

describe('mapPadding with the seat chips', () => {
    // The chips sit under the search bar (44px high, from 12px down, then the chips from 64px).
    const CHIPS_BOTTOM = 64 + 44;

    it('keeps a phone unit clear of the search bar and the chip row', () => {
        const p = mapPadding({
            desktop: false,
            sheetHeight: 388,
            viewport: { width: 390, height: 844 },
        });
        expect(p.top).toBeGreaterThan(CHIPS_BOTTOM);
    });

    it('keeps a narrow desktop window clear of the chip row under the search bar', () => {
        const p = mapPadding({
            desktop: true,
            sheetHeight: 0,
            viewport: { width: 1024, height: 768 },
        });
        expect(p.top).toBeGreaterThan(CHIPS_BOTTOM);
    });

    it('needs only the search bar clear on a wide desktop, where the chips sit beside it', () => {
        const p = mapPadding({
            desktop: true,
            sheetHeight: 0,
            viewport: { width: 1600, height: 900 },
        });
        expect(p.top).toBe(72);
    });

    it('puts the seven chips beside the search bar only from 1536px: at 1440 they sit under it', () => {
        // Seven chips need about 640px to the right of the panel and the search bar (864px).
        expect(CHIPS_BESIDE_SEARCH).toBe(1536);
        const top = (width: number) =>
            mapPadding({
                desktop: true,
                sheetHeight: 0,
                viewport: { width, height: 900 },
            }).top;
        expect(top(1440)).toBeGreaterThan(CHIPS_BOTTOM);
        expect(top(1535)).toBeGreaterThan(CHIPS_BOTTOM);
        expect(top(1536)).toBe(72);
    });
});

describe('mapPadding with the legend open', () => {
    const viewport = { width: 1440, height: 900 };

    it('keeps a desktop unit clear of the legend box at the bottom left', () => {
        const closed = mapPadding({ desktop: true, sheetHeight: 0, viewport });
        const open = mapPadding({
            desktop: true,
            sheetHeight: 0,
            viewport,
            legendOpen: true,
        });
        // The legend spans x 396 to 716 (320 wide) beside the side panel.
        expect(open.left).toBeGreaterThanOrEqual(396 + LEGEND_WIDTH);
        expect(open.left).toBeGreaterThan(closed.left);
        expect(open.right).toBe(closed.right);
    });

    it('lets the legend overlap the map when clearing it would leave the unit under 320px', () => {
        for (const width of [768, 834, 1000]) {
            const narrow = { width, height: 900 };
            const closed = mapPadding({
                desktop: true,
                sheetHeight: 0,
                viewport: narrow,
            });
            const open = mapPadding({
                desktop: true,
                sheetHeight: 0,
                viewport: narrow,
                legendOpen: true,
            });
            expect(open).toEqual(closed);
            // The unit keeps the same usable width as with the legend closed.
            expect(width - open.left - open.right).toBeGreaterThan(0);
        }
    });

    it('clears the legend whenever that leaves a unit at least 320px wide', () => {
        for (const width of [1200, 1440]) {
            const v = { width, height: 900 };
            const open = mapPadding({
                desktop: true,
                sheetHeight: 0,
                viewport: v,
                legendOpen: true,
            });
            expect(open.left).toBe(396 + LEGEND_WIDTH + 16);
            expect(width - open.left - open.right).toBeGreaterThanOrEqual(320);
        }
    });

    it('leaves phone padding alone: the sheet already makes room and the legend opens on tap', () => {
        const args = {
            desktop: false,
            sheetHeight: 388,
            viewport: { width: 390, height: 844 },
        };
        expect(mapPadding({ ...args, legendOpen: true })).toEqual(
            mapPadding(args),
        );
    });
});

describe('centreOn', () => {
    const padding = { top: 72, bottom: 420, left: 56, right: 56 };

    it('eases to the middle of the unit at the zoom the person is at', () => {
        const o = centreOn([36.84, -1.27, 36.88, -1.25], padding, 7.3);
        expect(o.center[0]).toBeCloseTo(36.86);
        expect(o.center[1]).toBeCloseTo(-1.26);
        expect(o.zoom).toBe(7.3);
        // The padding is what puts the middle of the unit in the middle of the visible map.
        expect(o.padding).toEqual(padding);
        expect(o.duration).toBe(300);
    });

    it('does not animate for people who prefer reduced motion', () => {
        expect(centreOn([0, 0, 2, 2], padding, 5, true).duration).toBe(0);
    });
});
