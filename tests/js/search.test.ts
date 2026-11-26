import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalise, searchUnits } from '@/lib/search';
import { UnitIndex, type Unit } from '@/lib/units';

const rows: Unit[] = JSON.parse(
    readFileSync(
        resolve(import.meta.dirname, '../../public/boundaries/units.json'),
        'utf8',
    ),
);
const index = UnitIndex.fromRows(rows);

describe('normalise', () => {
    it('lower-cases, strips diacritics and apostrophes, and splits on / and -', () => {
        expect(normalise("Cherang'any/Chebororwa")).toBe(
            'cherangany chebororwa',
        );
        expect(normalise('Tharaka - Nithi')).toBe('tharaka nithi');
        expect(normalise('Ziwa La Ng’ombe')).toBe('ziwa la ngombe');
        expect(normalise('Mérü')).toBe('meru');
    });
});

describe('searchUnits', () => {
    it('finds both Huruma wards', () => {
        const wards = searchUnits(index, 'huruma').filter(
            (r) => r.unit.l === 'ward',
        );
        expect(wards).toHaveLength(2);
        expect(wards.map((r) => r.ancestors[0].n).sort()).toEqual([
            'Mathare',
            'Turbo',
        ]);
    });

    it('matches across apostrophes', () => {
        expect(
            searchUnits(index, 'cherangany').some(
                (r) => r.unit.l === 'ward' && r.unit.c === 737,
            ),
        ).toBe(true);
    });

    it('matches names split by a slash', () => {
        expect(
            searchUnits(index, 'embobut').some(
                (r) => r.unit.l === 'ward' && r.unit.c === 734,
            ),
        ).toBe(true);
    });

    it('ranks the exact county first', () => {
        const [first] = searchUnits(index, 'kisumu');
        expect(first.unit).toMatchObject({ l: 'county', c: 42 });
        expect(first.ancestors.map((u) => u.n)).toEqual(['Nyanza']);
    });

    it('needs every token to prefix-match', () => {
        const results = searchUnits(index, 'kisumu ea');
        expect(results.map((r) => r.unit.n)).toEqual(['Kisumu East']);
    });

    it('returns nothing for an empty query', () => {
        expect(searchUnits(index, '')).toEqual([]);
        expect(searchUnits(index, '   ')).toEqual([]);
    });

    it('respects the limit', () => {
        expect(searchUnits(index, 'k').length).toBeLessThanOrEqual(8);
        expect(searchUnits(index, 'k', 3)).toHaveLength(3);
    });

    it('leaves out provinces', () => {
        expect(
            searchUnits(index, 'nairobi').some((r) => r.unit.l === 'province'),
        ).toBe(false);
        expect(searchUnits(index, 'coast')).toEqual([]);
    });
});
