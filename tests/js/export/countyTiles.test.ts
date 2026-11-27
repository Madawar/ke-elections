// The county tile grid: every county once, by IEBC code, laid out roughly like the map, and checked
// against the counties that really share a border (resources/js/lib/export/countyNeighbours.json,
// computed from public/boundaries/counties.geojson by boundaries/pipeline/neighbours.mjs).
import { describe, expect, it } from 'vitest';
import {
    COUNTY_TILES,
    TILE_COLUMNS,
    TILE_ROWS,
    type TileCell,
} from '@/lib/export/countyTiles';
import neighbours from '@/lib/export/countyNeighbours.json';
import { numbersIndex as index } from './numbersFixtures';

/** Neighbours whose tiles are more than one cell apart (diagonals count as one). */
function separated(grid: Record<number, TileCell>): [number, number][] {
    return (neighbours.neighbours as [number, number][]).filter(([a, b]) => {
        const p = grid[a];
        const q = grid[b];
        return Math.max(Math.abs(p.col - q.col), Math.abs(p.row - q.row)) > 1;
    });
}

/** The number recorded in docs/superpowers/plans/2026-11-27-share-formats-2-progress.md. */
const RECORDED = 24;

/** The mock-up's arrangement, by code (the plan's table), for the record. */
const MOCK_UP = [
    [0, 0, 23, 0, 10, 0, 0, 9],
    [0, 26, 24, 28, 25, 0, 8, 0],
    [39, 37, 27, 30, 31, 11, 0, 0],
    [40, 38, 29, 18, 19, 12, 0, 0],
    [41, 42, 35, 32, 20, 13, 0, 7],
    [43, 46, 36, 22, 21, 14, 0, 0],
    [44, 45, 33, 47, 16, 15, 4, 5],
    [0, 0, 0, 34, 17, 6, 3, 0],
    [0, 0, 0, 0, 0, 2, 1, 0],
];
const fromRows = (rows: number[][]): Record<number, TileCell> =>
    Object.fromEntries(
        rows.flatMap((r, row) =>
            r.flatMap((code, col) => (code ? [[code, { col, row }]] : [])),
        ),
    );

describe('the county tile grid', () => {
    const codes = Object.keys(COUNTY_TILES).map(Number);

    it('has every county of the unit index once, by code', () => {
        const counties = index
            .all()
            .filter((u) => u.l === 'county')
            .map((u) => u.c)
            .sort((a, b) => a - b);
        expect(counties).toHaveLength(47);
        expect([...codes].sort((a, b) => a - b)).toEqual(counties);
    });

    it('puts no two counties in one cell, and stays within its columns and rows', () => {
        const cells = codes.map((c) => `${COUNTY_TILES[c].col},${COUNTY_TILES[c].row}`);
        expect(new Set(cells).size).toBe(47);
        for (const c of codes) {
            const { col, row } = COUNTY_TILES[c];
            expect(col, `${c}`).toBeGreaterThanOrEqual(0);
            expect(col, `${c}`).toBeLessThan(TILE_COLUMNS);
            expect(row, `${c}`).toBeGreaterThanOrEqual(0);
            expect(row, `${c}`).toBeLessThan(TILE_ROWS);
        }
        expect(TILE_COLUMNS).toBeLessThanOrEqual(8);
        expect(TILE_ROWS).toBeLessThanOrEqual(9);
        // Every column and row is used: no empty band.
        expect(new Set(codes.map((c) => COUNTY_TILES[c].col)).size).toBe(TILE_COLUMNS);
        expect(new Set(codes.map((c) => COUNTY_TILES[c].row)).size).toBe(TILE_ROWS);
    });

    it('keeps the map’s shape: north at the top, the lake on the left, the coast bottom right, Nairobi in the middle', () => {
        const at = (code: number) => COUNTY_TILES[code];
        // Turkana, Marsabit and Mandera on the top row, Mandera in the north-east corner.
        for (const c of [23, 10, 9]) expect(at(c).row, `${c}`).toBe(0);
        expect(at(9).col).toBe(TILE_COLUMNS - 1);
        // Busia, Siaya, Kisumu, Homa Bay and Migori in the two left columns.
        for (const c of [40, 41, 42, 43, 44]) expect(at(c).col, `${c}`).toBeLessThanOrEqual(1);
        // Mombasa and Kwale on the bottom row, Lamu on the right edge, Mombasa east of Kwale.
        expect(at(1).row).toBe(TILE_ROWS - 1);
        expect(at(2).row).toBe(TILE_ROWS - 1);
        expect(at(1).col).toBeGreaterThan(at(2).col);
        expect(at(5).col).toBe(TILE_COLUMNS - 1);
        // Nairobi City in the middle columns, above Kajiado and beside Machakos.
        expect([3, 4]).toContain(at(47).col);
        expect(at(47).row).toBeLessThan(at(34).row);
        expect(at(47).col).toBeLessThan(at(16).col);
    });

    it('keeps the Mount Kenya counties in their familiar order, as the mock-up has them', () => {
        const at = (code: number) => COUNTY_TILES[code];
        // Meru, Tharaka - Nithi, Embu going south; Nyeri, Kirinyaga, Murang'a going south.
        expect(at(20)).toEqual({ col: 4, row: 4 }); // Kirinyaga
        expect(at(13)).toEqual({ col: 5, row: 4 }); // Tharaka - Nithi
        expect(at(21)).toEqual({ col: 4, row: 5 }); // Murang'a
        expect(at(14)).toEqual({ col: 5, row: 5 }); // Embu
    });

    it('leaves the bottom-left corner empty, for the key', () => {
        for (const c of codes) {
            const { col, row } = COUNTY_TILES[c];
            expect(col <= 2 && row >= TILE_ROWS - 2, `${c}`).toBe(false);
        }
    });

    it('keeps real neighbours next to each other, with no more pairs apart than recorded', () => {
        // The mock-up's arrangement had 29 such pairs; moving tiles brought it down.
        expect(separated(fromRows(MOCK_UP))).toHaveLength(29);
        const apart = separated(COUNTY_TILES);
        expect(apart.length, JSON.stringify(apart)).toBeLessThanOrEqual(RECORDED);
    });
});
