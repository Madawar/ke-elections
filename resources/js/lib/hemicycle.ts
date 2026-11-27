// Parliament seating chart layout. Seats sit on concentric semicircular rows inside a half-disc
// of radius 1 (viewBox width 2, height 1, origin at the bottom centre, y pointing up). Each row
// gets seats in proportion to its arc length, and the seats are then ordered by angle from left
// to right across all rows, so consecutive seats (one party's block) form a wedge.

export interface HemicycleSeat {
    x: number;
    y: number;
    r: number;
    row: number; // 0 is the innermost row
    angle: number; // radians, π on the far left to 0 on the far right
}

export interface HemicycleOptions {
    /** Number of rows. Chosen from the total when omitted. */
    rows?: number;
    /** Inner radius of the empty well, as a share of the outer radius (default 0.4). */
    innerRatio?: number;
}

const SEAT_TO_SPACING = 0.4; // seat radius as a share of the centre-to-centre spacing
const MAX_ROWS = 60;

interface Row {
    radius: number;
    start: number; // first angle, so that the seat stays above the baseline
    capacity: number;
}

function buildRows(rows: number, innerRatio: number, spacing: number): Row[] {
    const pitch = (1 - innerRatio) / rows;
    const r = SEAT_TO_SPACING * spacing;
    return Array.from({ length: rows }, (_, i) => {
        const radius = innerRatio + (i + 0.5) * pitch;
        const start = Math.asin(Math.min(1, r / radius));
        const span = Math.PI - 2 * start;
        const step = 2 * Math.asin(Math.min(1, spacing / (2 * radius)));
        return { radius, start, capacity: Math.floor(span / step + 1e-9) + 1 };
    });
}

const capacityOf = (rows: Row[]) =>
    rows.reduce((n, row) => n + row.capacity, 0);

/** Hands out seats one at a time to the row furthest below its fair share of the arc length. */
function allocate(total: number, rows: Row[]): number[] {
    const length = rows.map((row) => row.radius * (Math.PI - 2 * row.start));
    const sum = length.reduce((a, b) => a + b, 0);
    const counts = rows.map(() => 0);
    for (let seat = 0; seat < total; seat++) {
        let best = -1;
        let bestDeficit = -Infinity;
        rows.forEach((row, i) => {
            if (counts[i] >= row.capacity) return;
            const deficit = ((seat + 1) * length[i]) / sum - counts[i];
            if (deficit > bestDeficit) {
                best = i;
                bestDeficit = deficit;
            }
        });
        counts[best]++;
    }
    return counts;
}

export function layoutHemicycle(
    total: number,
    options: HemicycleOptions = {},
): HemicycleSeat[] {
    const n = Math.max(0, Math.floor(total));
    if (n === 0) return [];
    const innerRatio = Math.min(0.9, Math.max(0, options.innerRatio ?? 0.4));

    // Seats are spaced along a row as far apart as the rows are; with a fixed row count that
    // cannot hold everyone, the spacing (and the seats) shrink until they fit.
    let rowCount = options.rows ? Math.max(1, Math.floor(options.rows)) : 1;
    let spacing = (1 - innerRatio) / rowCount;
    let rows = buildRows(rowCount, innerRatio, spacing);
    while (capacityOf(rows) < n) {
        if (options.rows || rowCount >= MAX_ROWS) {
            spacing *= 0.97;
        } else {
            rowCount++;
            spacing = (1 - innerRatio) / rowCount;
        }
        rows = buildRows(rowCount, innerRatio, spacing);
    }

    const r = SEAT_TO_SPACING * spacing;
    const counts = allocate(n, rows);
    const seats: HemicycleSeat[] = [];
    rows.forEach((row, i) => {
        const k = counts[i];
        for (let j = 0; j < k; j++) {
            const angle =
                k === 1
                    ? Math.PI / 2
                    : Math.PI -
                      row.start -
                      (j * (Math.PI - 2 * row.start)) / (k - 1);
            seats.push({
                x: row.radius * Math.cos(angle),
                y: row.radius * Math.sin(angle),
                r,
                row: i,
                angle,
            });
        }
    });

    return seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
}
