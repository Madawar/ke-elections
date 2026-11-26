import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seatsFor, UnitIndex, type Unit } from '@/lib/units';

const rows: Unit[] = JSON.parse(
    readFileSync(
        resolve(import.meta.dirname, '../../public/boundaries/units.json'),
        'utf8',
    ),
);
const index = UnitIndex.fromRows(rows);

describe('UnitIndex on the real units.json', () => {
    it('holds every unit', () => {
        expect(index.all()).toHaveLength(8 + 47 + 290 + 1450);
    });

    it('gets a unit by level and code', () => {
        expect(index.get('county', 47)?.n).toBe('Nairobi City');
        expect(index.get('ward', 99999)).toBeUndefined();
    });

    it('lists the children of a county', () => {
        expect(index.children('county', 47)).toHaveLength(17);
        expect(
            index.children('county', 47).every((u) => u.l === 'constituency'),
        ).toBe(true);
        expect(index.children('ward', 1448)).toEqual([]);
    });

    it('lists the ancestors nearest first, ending with the province', () => {
        expect(index.ancestors('ward', 1448).map((u) => u.n)).toEqual([
            'Mathare',
            'Nairobi City',
            'Nairobi',
        ]);
        expect(index.ancestors('county', 42).map((u) => u.l)).toEqual([
            'province',
        ]);
        expect(index.ancestors('province', 1)).toEqual([]);
    });

    it('counts descendants per level', () => {
        expect(index.descendantCounts('county', 47)).toEqual({
            constituency: 17,
            ward: 85,
        });
        expect(index.descendantCounts('constituency', 290)).toEqual({
            ward: 6,
        });
        expect(index.descendantCounts('ward', 1448)).toEqual({});
    });
});

describe('UnitIndex.load', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('fetches the rows from a url', async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue({
                ok: true,
                json: async () => rows.slice(0, 8),
            });
        vi.stubGlobal('fetch', fetch);
        const loaded = await UnitIndex.load('/boundaries/units.json?v=abc');
        expect(fetch).toHaveBeenCalledWith('/boundaries/units.json?v=abc');
        expect(loaded.all()).toHaveLength(8);
    });

    it('rejects on an HTTP error', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue({
                    ok: false,
                    status: 404,
                    json: async () => [],
                }),
        );
        await expect(UnitIndex.load('/missing.json')).rejects.toThrow('404');
    });
});

describe('seatsFor', () => {
    it('gives the elective seats per level', () => {
        expect(seatsFor('county')).toEqual([
            { key: 'governor', label: 'Governor' },
            { key: 'senator', label: 'Senator' },
            { key: 'woman_rep', label: 'Woman Representative' },
        ]);
        expect(seatsFor('constituency')).toEqual([
            { key: 'mp', label: 'Member of the National Assembly' },
        ]);
        expect(seatsFor('ward')).toEqual([
            { key: 'mca', label: 'Member of County Assembly' },
        ]);
        expect(seatsFor('province')).toEqual([]);
    });
});
