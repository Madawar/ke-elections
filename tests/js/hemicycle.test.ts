import { describe, expect, it } from 'vitest';
import { layoutHemicycle } from '@/lib/hemicycle';

describe('layoutHemicycle', () => {
    it.each([349, 67, 1, 2, 47, 290, 1450])(
        'places exactly %i seats',
        (total) => {
            expect(layoutHemicycle(total)).toHaveLength(total);
        },
    );

    it('places nothing for zero seats', () => {
        expect(layoutHemicycle(0)).toEqual([]);
    });

    it.each([349, 67, 1])(
        'keeps every seat of %i inside the half-disc',
        (total) => {
            for (const s of layoutHemicycle(total)) {
                expect(s.y).toBeGreaterThanOrEqual(s.r - 1e-9);
                expect(Math.hypot(s.x, s.y) + s.r).toBeLessThanOrEqual(
                    1 + 1e-9,
                );
                expect(s.x - s.r).toBeGreaterThanOrEqual(-1 - 1e-9);
                expect(s.x + s.r).toBeLessThanOrEqual(1 + 1e-9);
            }
        },
    );

    it.each([349, 67, 47, 290])('never overlaps two of %i seats', (total) => {
        const seats = layoutHemicycle(total);
        for (let i = 0; i < seats.length; i++) {
            for (let j = i + 1; j < seats.length; j++) {
                const d = Math.hypot(
                    seats[i].x - seats[j].x,
                    seats[i].y - seats[j].y,
                );
                expect(d).toBeGreaterThanOrEqual(2 * seats[i].r * 0.95);
            }
        }
    });

    it('orders seats by angle from left to right', () => {
        const seats = layoutHemicycle(349);
        for (let i = 1; i < seats.length; i++) {
            expect(seats[i].angle).toBeLessThanOrEqual(seats[i - 1].angle);
        }
        expect(seats[0].x).toBeLessThan(0);
        expect(seats[seats.length - 1].x).toBeGreaterThan(0);
    });

    it('honours the row count option', () => {
        const rows = new Set(
            layoutHemicycle(349, { rows: 9 }).map((s) => s.row),
        );
        expect(rows.size).toBe(9);
    });

    it('puts more seats on outer rows', () => {
        const seats = layoutHemicycle(349, { rows: 8 });
        const perRow = Array.from(
            { length: 8 },
            (_, r) => seats.filter((s) => s.row === r).length,
        );
        for (let r = 1; r < perRow.length; r++) {
            expect(perRow[r]).toBeGreaterThanOrEqual(perRow[r - 1]);
        }
    });
});
