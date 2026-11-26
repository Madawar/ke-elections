import { describe, expect, it } from 'vitest';
import { centreOn, mapPadding } from '@/lib/map/camera';

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
        const viewport = { width: 1440, height: 900 };
        const p = mapPadding({ desktop: true, sheetHeight: 0, viewport });
        expect(p.left).toBeGreaterThanOrEqual(380);
        const middleX = (p.left + (viewport.width - p.right)) / 2;
        expect(middleX).toBe((380 + viewport.width) / 2);
        const middleY = (p.top + (viewport.height - p.bottom)) / 2;
        expect(middleY).toBe(viewport.height / 2);
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
