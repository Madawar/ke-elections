import { describe, expect, it } from 'vitest';
import type { Box, TextItem } from '@/lib/export/layout';
import { leadersStrip } from '@/lib/export/leadersStrip';
import { textWidth } from '@/lib/export/text';
import { cardLeaders } from '@/lib/export/viewState';
import { type LeaderRow, leadersFor } from '@/lib/leaders';
import { SEAT_COLOURS } from '@/lib/map/theme';
import { LEADERS_SEATS as seats, leadersIndex as index } from '../leadersFixtures';

const rowsAt = (l: 'county' | 'constituency', c: number) =>
    leadersFor(index.get(l, c)!, seats, index);
const LINK = 'example.org/constituency/290';
const strip = (
    rows: LeaderRow[],
    over: Partial<Parameters<typeof leadersStrip>[0]> = {},
) =>
    leadersStrip({
        x: 60,
        y: 400,
        w: 960,
        maxH: 400,
        rows,
        font: 24,
        link: LINK,
        columns: 1,
        ...over,
    })!;
const textBox = (t: TextItem): Box => {
    const w = textWidth(t.text, t.size, (t.weight ?? 400) >= 600);
    return { x: t.x, y: t.y - t.size * 0.8, w, h: t.size };
};
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x + 0.5 ||
    b.x + b.w <= a.x + 0.5 ||
    a.y + a.h <= b.y + 0.5 ||
    b.y + b.h <= a.y + 0.5;
const says = (r: { texts: TextItem[] }) => r.texts.map((t) => t.text);

describe('cardLeaders (which cards get the strip, and whose rows)', () => {
    const focus = (level: 'county' | 'constituency' | 'ward', code: number) => ({
        level,
        code,
    });
    it('gives a county MCA card the Governor, Senator and Woman Rep', () => {
        expect(
            cardLeaders(seats, index, 'mca', focus('county', 47)).map(
                (r) => r.seat,
            ),
        ).toEqual(['governor', 'senator', 'woman_rep']);
    });
    it('starts a constituency MCA card with that constituency’s MP', () => {
        const rows = cardLeaders(seats, index, 'mca', focus('constituency', 290));
        expect(rows.map((r) => r.seat)).toEqual([
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(rows[0].holder?.name).toBe('Placeholder mp 290');
    });
    it('gives no strip to other cards: other seats, a ward, or all of Kenya', () => {
        expect(cardLeaders(seats, index, 'mca', null)).toEqual([]);
        expect(cardLeaders(seats, index, 'mca', focus('ward', 1448))).toEqual(
            [],
        );
        for (const seat of ['governor', 'senator', 'woman_rep', 'mp'] as const)
            expect(cardLeaders(seats, index, seat, focus('county', 47))).toEqual(
                [],
            );
    });
});

describe('leadersStrip layout', () => {
    it('draws one row per leader, in seat order: ballot bar, seat, name, party chip', () => {
        const s = strip(rowsAt('constituency', 290));
        expect(s.rows.map((r) => r.seat)).toEqual([
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(s.rows.map((r) => r.lid.colour)).toEqual([
            SEAT_COLOURS.mp,
            SEAT_COLOURS.governor,
            SEAT_COLOURS.senator,
            SEAT_COLOURS.woman_rep,
        ]);
        expect(says(s.rows[1])).toEqual([
            'Governor',
            'Placeholder governor 47',
            'UDA',
        ]);
        expect(s.rows[1].chip?.colour).toBe('#e8c547');
        expect(s.more).toBeNull();
    });

    it('adds since when to the MP row of a constituency card', () => {
        const s = strip(rowsAt('constituency', 290));
        expect(says(s.rows[0])).toEqual([
            'MP',
            'Placeholder mp 290',
            'ODM',
            'since 2022',
        ]);
    });

    it('reads "No approved data yet" for a seat with no holder, with no chip', () => {
        const s = strip(rowsAt('county', 3));
        expect(says(s.rows[1])).toEqual(['Senator', 'No approved data yet']);
        expect(s.rows[1].chip).toBeNull();
    });

    it('sets a county’s three rows in two columns when asked, reading left to right', () => {
        const s = strip(rowsAt('county', 47), { columns: 2 });
        expect(s.columns).toBe(2);
        const [governor, senator, womanRep] = s.rows;
        expect(senator.lid.y).toBe(governor.lid.y);
        expect(senator.lid.x).toBeGreaterThan(governor.lid.x + 400);
        expect(womanRep.lid.x).toBe(governor.lid.x);
        expect(womanRep.lid.y).toBeGreaterThan(governor.lid.y);
        // Two lines instead of three.
        expect(s.box.h).toBeLessThan(strip(rowsAt('county', 47)).box.h);
    });

    it('gives a constituency’s MP a line of its own above the two columns', () => {
        const s = strip(rowsAt('constituency', 290), { columns: 2 });
        expect(s.columns).toBe(2);
        const [mp, governor, senator, womanRep] = s.rows;
        expect(governor.lid.x).toBe(mp.lid.x);
        expect(governor.lid.y).toBeGreaterThan(mp.lid.y);
        expect(senator.lid.y).toBe(governor.lid.y);
        expect(senator.lid.x).toBeGreaterThan(mp.lid.x + 400);
        expect(womanRep.lid.x).toBe(mp.lid.x);
        expect(womanRep.lid.y).toBeGreaterThan(governor.lid.y);
        // Three lines instead of four, and the MP row still says since when.
        expect(s.box.h).toBeLessThan(strip(rowsAt('constituency', 290)).box.h);
        expect(says(mp)).toContain('since 2022');
    });

    it('lets the MP share the two columns when told to, saying since when only if it fits', () => {
        const s = strip(rowsAt('constituency', 290), {
            columns: 2,
            lead: false,
        });
        expect(s.columns).toBe(2);
        const [mp, governor, senator, womanRep] = s.rows;
        // Two lines: MP and Governor, then Senator and Woman Rep.
        expect(governor.lid.y).toBe(mp.lid.y);
        expect(governor.lid.x).toBeGreaterThan(mp.lid.x + 400);
        expect(senator.lid.x).toBe(mp.lid.x);
        expect(womanRep.lid.y).toBe(senator.lid.y);
        expect(says(mp)).toEqual(['MP', 'Placeholder mp 290', 'ODM']);
        // With the room for it, the date stays.
        const wide = strip(rowsAt('constituency', 290), {
            columns: 2,
            lead: false,
            w: 1500,
        });
        expect(says(wide.rows[0])).toContain('since 2022');
    });

    it('falls back to one column when a name does not fit half the width', () => {
        const long = rowsAt('county', 47).map((r, i) =>
            i === 0
                ? {
                      ...r,
                      holder: {
                          ...r.holder!,
                          name: 'Placeholder With A Very Long Name Indeed Wa Kwanza',
                      },
                  }
                : r,
        );
        const s = strip(long, { columns: 2, w: 700 });
        expect(s.columns).toBe(1);
        expect(says(s.rows[0])[1]).toBe(
            'Placeholder With A Very Long Name Indeed Wa Kwanza',
        );
    });

    it('never cuts a name: it shrinks the type a little, and every row keeps one size', () => {
        const s = strip(rowsAt('constituency', 290), { columns: 2, w: 760 });
        for (const r of s.rows)
            for (const t of r.texts) expect(t.text).not.toContain('…');
        expect(new Set(s.rows.map((r) => r.texts[1].size)).size).toBe(1);
    });

    it('shows the first two rows and "+N more at <link>" when there is no room for all', () => {
        const county = strip(rowsAt('county', 47), { columns: 2, maxH: 40 });
        expect(county.rows.map((r) => r.seat)).toEqual(['governor', 'senator']);
        expect(county.more?.text).toBe(`+1 more at ${LINK}`);
        const constituency = strip(rowsAt('constituency', 290), {
            columns: 2,
            maxH: 40,
        });
        expect(constituency.rows.map((r) => r.seat)).toEqual([
            'mp',
            'governor',
        ]);
        expect(constituency.more?.text).toBe(`+2 more at ${LINK}`);
    });

    it('keeps every line inside its box and apart from the others', () => {
        for (const columns of [1, 2] as const)
            for (const rows of [rowsAt('constituency', 290), rowsAt('county', 3)])
                for (const maxH of [400, 40]) {
                    const s = strip(rows, { columns, maxH });
                    const all = [
                        ...s.rows.flatMap((r) => r.texts),
                        ...(s.more ? [s.more] : []),
                    ].map(textBox);
                    for (const b of all) {
                        expect(b.x).toBeGreaterThanOrEqual(s.box.x);
                        expect(b.x + b.w).toBeLessThanOrEqual(
                            s.box.x + s.box.w + 0.5,
                        );
                        expect(b.y).toBeGreaterThanOrEqual(s.box.y - 0.5);
                        expect(b.y + b.h).toBeLessThanOrEqual(
                            s.box.y + s.box.h + 0.5,
                        );
                    }
                    for (let i = 0; i < all.length; i++)
                        for (let j = i + 1; j < all.length; j++)
                            expect(apart(all[i], all[j])).toBe(true);
                }
    });

    it('is nothing at all with no rows', () => {
        expect(
            leadersStrip({
                x: 0,
                y: 0,
                w: 900,
                maxH: 300,
                rows: [],
                font: 24,
                link: LINK,
                columns: 2,
            }),
        ).toBeNull();
    });
});
