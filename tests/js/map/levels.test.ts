import { describe, expect, it } from 'vitest';
import {
    KENYA_BOUNDS,
    childLevel,
    levelForZoom,
    levelOpacity,
    zoomOutTarget,
} from '@/lib/map/levels';
import { parseUnitPath, unitPath } from '@/lib/map/urls';

describe('levels', () => {
    it('picks the level for a zoom', () => {
        expect(levelForZoom(6.9)).toBe('county');
        expect(levelForZoom(7)).toBe('constituency');
        expect(levelForZoom(9.49)).toBe('constituency');
        expect(levelForZoom(9.5)).toBe('ward');
    });

    it('knows child levels', () => {
        expect(childLevel('county')).toBe('constituency');
        expect(childLevel('ward')).toBeNull();
    });

    it('cross-fades opacity around thresholds', () => {
        expect(levelOpacity('county', 5)).toBe(1);
        expect(levelOpacity('county', 8)).toBe(0);
        expect(levelOpacity('county', 7)).toBeCloseTo(0.5);
        expect(levelOpacity('constituency', 8)).toBe(1);
        expect(levelOpacity('constituency', 5)).toBe(0);
        expect(levelOpacity('constituency', 9.5)).toBeCloseTo(0.5);
        expect(levelOpacity('ward', 12)).toBe(1);
        const mid = levelOpacity('ward', 9.3);
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(1);
    });

    it('zooms out to the parent unit, then to Kenya', () => {
        const units = {
            'ward:1448': {
                l: 'ward',
                c: 1448,
                p: 280,
                b: [36.8, -1.3, 36.9, -1.2],
            },
            'constituency:280': {
                l: 'constituency',
                c: 280,
                p: 47,
                b: [36.7, -1.3, 36.9, -1.2],
            },
            'county:47': {
                l: 'county',
                c: 47,
                p: 8,
                b: [36.6, -1.4, 37.1, -1.1],
            },
        } as const;
        const get = (l: string, c: number) =>
            (units as Record<string, never>)[`${l}:${c}`];
        expect(zoomOutTarget({ level: 'ward', code: 1448 }, get)).toEqual({
            unit: { level: 'constituency', code: 280 },
            bounds: units['constituency:280'].b,
        });
        expect(zoomOutTarget({ level: 'county', code: 47 }, get)).toEqual({
            unit: null,
            bounds: KENYA_BOUNDS,
        });
        expect(zoomOutTarget(null, get).unit).toBeNull();
    });
});

describe('urls', () => {
    it('round-trips unit paths', () => {
        expect(unitPath('ward', 1448)).toBe('/ward/1448');
        expect(parseUnitPath('/ward/1448')).toEqual({
            level: 'ward',
            code: 1448,
        });
        expect(parseUnitPath('/ward/abc')).toBeNull();
        expect(parseUnitPath('/province/1')).toBeNull();
        expect(parseUnitPath('/')).toBeNull();
        expect(parseUnitPath('/ward/0')).toBeNull();
    });
});
