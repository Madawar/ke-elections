import { describe, expect, it } from 'vitest';
import {
    CARD_SIZES,
    exportFilename,
    inPowerFilename,
} from '@/lib/export/sizes';

describe('card sizes', () => {
    it('has the four social sizes from the spec', () => {
        expect(CARD_SIZES).toEqual({
            square: { w: 1080, h: 1080 },
            portrait: { w: 1080, h: 1350 },
            story: { w: 1080, h: 1920 },
            landscape: { w: 1200, h: 630 },
        });
    });

    it('names locator files by level, code and size', () => {
        expect(exportFilename('ward', 1448, 'square')).toBe(
            'kenya-electoral-map-ward-1448-square.png',
        );
        expect(exportFilename('county', 47, 'story')).toBe(
            'kenya-electoral-map-county-47-story.png',
        );
    });

    it('names the national card file by size', () => {
        expect(inPowerFilename('landscape')).toBe(
            'kenya-electoral-map-in-power-now-landscape.png',
        );
    });
});
