import { describe, expect, it } from 'vitest';
import { mapPadding } from '@/lib/map/camera';

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
