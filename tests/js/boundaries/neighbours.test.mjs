import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTIES, OUTPUT, countyNeighbours, neighboursFile } from '../../../boundaries/pipeline/neighbours.mjs';

const square = (code, [x, y], size = 1) => ({
    type: 'Feature',
    properties: { code },
    geometry: {
        type: 'Polygon',
        coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
    },
});

describe('countyNeighbours', () => {
    it('counts a shared segment as a border, and a shared point alone as touching only', () => {
        // 1 | 2 side by side; 3 sits diagonally under 2, meeting 1 at one corner only.
        const fc = {
            type: 'FeatureCollection',
            features: [square(1, [0, 0]), square(2, [1, 0]), square(3, [1, -1])],
        };
        const { neighbours, touching } = countyNeighbours(fc);
        expect(neighbours).toEqual([
            [1, 2],
            [2, 3],
        ]);
        expect(touching).toEqual([[1, 3]]);
    });

    it('is what is committed, computed again from the committed county boundaries', () => {
        const collection = JSON.parse(readFileSync(COUNTIES, 'utf8'));
        expect(JSON.parse(readFileSync(OUTPUT, 'utf8'))).toEqual(neighboursFile(collection));
    });

    it('finds the borders anyone can check on a map', () => {
        const { neighbours } = JSON.parse(readFileSync(OUTPUT, 'utf8'));
        const has = (a, b) => neighbours.some(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b));
        // Nairobi City (47) with Kiambu (22), Machakos (16) and Kajiado (34); Mombasa (1) with
        // Kilifi (3) and Kwale (2); Nakuru (32) with Baringo (30) and Narok (33).
        for (const [a, b] of [[47, 22], [47, 16], [47, 34], [1, 3], [1, 2], [32, 30], [32, 33]])
            expect(has(a, b), `${a}-${b}`).toBe(true);
        // Mombasa and Nairobi City are far apart.
        expect(has(1, 47)).toBe(false);
        // Every county has a neighbour.
        const codes = new Set(neighbours.flat());
        expect(codes.size).toBe(47);
    });
});
