import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findContaining, pointInGeometry } from '@/lib/map/locate';

describe('locate', () => {
    it('handles holes', () => {
        const g = {
            type: 'Polygon' as const,
            coordinates: [
                [
                    [0, 0],
                    [4, 0],
                    [4, 4],
                    [0, 4],
                    [0, 0],
                ],
                [
                    [1, 1],
                    [3, 1],
                    [3, 3],
                    [1, 3],
                    [1, 1],
                ],
            ],
        };
        expect(pointInGeometry([0.5, 0.5], g)).toBe(true);
        expect(pointInGeometry([2, 2], g)).toBe(false);
        expect(pointInGeometry([5, 5], g)).toBe(false);
    });

    it('finds the Nairobi CBD ward on the real data', () => {
        const root = resolve(import.meta.dirname, '../../..');
        const wards = JSON.parse(
            readFileSync(
                resolve(root, 'public/boundaries/wards.geojson'),
                'utf8',
            ),
        );
        const units = JSON.parse(
            readFileSync(resolve(root, 'public/boundaries/units.json'), 'utf8'),
        );
        const code = findContaining(wards.features, [36.8219, -1.2864]);
        const ward = units.find(
            (u: { l: string; c: number }) => u.l === 'ward' && u.c === code,
        );
        expect(ward?.p).toBeDefined();
        const constituency = units.find(
            (u: { l: string; c: number }) =>
                u.l === 'constituency' && u.c === ward.p,
        );
        expect(
            units.find(
                (u: { l: string; c: number }) =>
                    u.l === 'county' && u.c === constituency.p,
            ).n,
        ).toBe('Nairobi City');
    });
});
