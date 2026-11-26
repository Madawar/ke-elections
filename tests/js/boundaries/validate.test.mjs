import { describe, expect, it } from 'vitest';
import { validateCodes } from '../../../boundaries/pipeline/validate.mjs';

const square = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const feature = (code, geometry = square) => ({ type: 'Feature', properties: { code }, geometry });
const check = (codes, expected = 4) => validateCodes(codes.map((c) => feature(c)), { key: 'code', expected });

describe('validateCodes', () => {
    it('passes a complete set', () => {
        expect(check([1, 2, 3, 4])).toEqual({ ok: true, missing: [], duplicates: [], outOfRange: [], empty: [] });
    });

    it('reports missing and duplicate codes', () => {
        const r = check([1, 2, 2, 4]);
        expect(r.missing).toEqual([3]);
        expect(r.duplicates).toEqual([2]);
        expect(r.ok).toBe(false);
    });

    it('reports out-of-range and non-integer codes', () => {
        expect(check([0, 1, 2, 3, 4]).outOfRange).toEqual([0]);
        expect(check([1, 2, 3, 4, 1.5]).outOfRange).toEqual([1.5]);
    });

    it('reports empty geometry', () => {
        const features = [feature(1), feature(2, null), feature(3, { type: 'Polygon' })];
        const r = validateCodes(features, { key: 'code', expected: 3 });
        expect(r.empty).toEqual([2, 3]);
        expect(r.ok).toBe(false);
    });
});
