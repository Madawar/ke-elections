import { describe, expect, it } from 'vitest';
import {
    type Box,
    footerBlock,
    inPowerLayout,
    legendBlock,
    locatorLayout,
    seatBlocks,
} from '@/lib/export/layout';
import { textWidth } from '@/lib/export/text';
import { ATTRIBUTION } from '@/lib/map/theme';
import { CARD_SIZES, type CardSize } from '@/lib/export/sizes';

const SIZES = Object.keys(CARD_SIZES) as CardSize[];
const inside = (b: Box, size: CardSize) => {
    const { w, h } = CARD_SIZES[size];
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(w);
    expect(b.y + b.h).toBeLessThanOrEqual(h);
};
const apart = (a: Box, b: Box) =>
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y;

describe('locatorLayout', () => {
    for (const size of SIZES)
        for (const seats of [1, 3])
            it(`keeps every block on the ${size} card apart (${seats} seats)`, () => {
                const l = locatorLayout(size, seats);
                const boxes = [l.header, l.inset, l.map, l.seats, l.footer];
                boxes.forEach((b) => inside(b, size));
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        expect(apart(boxes[i], boxes[j])).toBe(true);
                expect(l.map.w).toBeGreaterThanOrEqual(400);
                expect(l.map.h).toBeGreaterThanOrEqual(400);
                expect(Number.isInteger(l.map.w)).toBe(true);
                expect(Number.isInteger(l.map.h)).toBe(true);
            });
});

describe('inPowerLayout', () => {
    for (const size of SIZES)
        it(`keeps both chambers and the footer apart on the ${size} card`, () => {
            const l = inPowerLayout(size);
            const boxes = [
                l.header,
                ...l.chambers.flatMap((c) => [c.heading, c.chart, c.legend]),
                l.footer,
            ];
            boxes.forEach((b) => inside(b, size));
            for (let i = 0; i < boxes.length; i++)
                for (let j = i + 1; j < boxes.length; j++)
                    expect(apart(boxes[i], boxes[j])).toBe(true);
            for (const c of l.chambers) expect(c.chart.w).toBe(c.chart.h * 2);
        });
});

describe('footerBlock', () => {
    const input = {
        source: 'IEBC gazette notices and parliament.go.ke',
        asOf: '12 September 2026',
        attribution: ATTRIBUTION,
        url: 'https://kenya-electoral-map.example.org/constituency/288',
    };
    for (const size of SIZES)
        it(`fits the footer of the ${size} cards`, () => {
            for (const l of [locatorLayout(size, 3), inPowerLayout(size)]) {
                const block = footerBlock(l.footer, l.footerFonts, input);
                expect(block.bottom).toBeLessThanOrEqual(
                    l.footer.y + l.footer.h,
                );
                for (const line of block.lines) {
                    const w = textWidth(line.text.trimEnd(), line.size, true);
                    if (line.anchor === 'end') {
                        expect(line.x - w).toBeGreaterThanOrEqual(
                            l.footer.x - 1,
                        );
                    } else {
                        expect(
                            line.x + textWidth(line.text.trimEnd(), line.size),
                        ).toBeLessThanOrEqual(l.footer.x + l.footer.w + 1);
                    }
                }
                const text = block.lines.map((x) => x.text).join('');
                expect(text).toContain(ATTRIBUTION);
                expect(text).toContain(
                    'kenya-electoral-map.example.org/constituency/288',
                );
            }
        });
});

describe('seatBlocks', () => {
    const rows = [
        {
            key: 'governor',
            label: 'Governor',
            holder: {
                name: 'Sample Holder With A Rather Long Name Indeed',
                party: 'Sample Party With A Long Registered Name',
                abbrev: 'SPWALRN',
                colour: '#E69F00',
            },
        },
        { key: 'senator', label: 'Senator', holder: null },
        {
            key: 'woman_rep',
            label: 'Woman Representative',
            holder: {
                name: 'Sample Holder',
                party: 'Independent',
                abbrev: 'IND',
                colour: '#9AA5A0',
            },
        },
    ];
    for (const size of SIZES)
        it(`keeps every seat inside its area on the ${size} card`, () => {
            for (const n of [1, 3]) {
                const l = locatorLayout(size, n);
                const blocks = seatBlocks(l, rows.slice(0, n));
                for (const b of blocks) {
                    expect(b.bottom).toBeLessThanOrEqual(l.seats.y + l.seats.h);
                    for (const line of b.lines)
                        expect(
                            line.x +
                                textWidth(
                                    line.text,
                                    line.size,
                                    line.weight === 600,
                                ),
                        ).toBeLessThanOrEqual(l.seats.x + l.seats.w + 1);
                }
                for (let i = 1; i < blocks.length; i++)
                    expect(apart(blocks[i - 1].lid, blocks[i].lid)).toBe(true);
            }
        });
});

describe('legendBlock', () => {
    it('stays inside the map', () => {
        const l = locatorLayout('landscape', 3);
        const block = legendBlock(l.map, l.legendText, {
            title: 'MP seats by party in Nairobi City',
            rows: Array.from({ length: 6 }, (_, i) => ({
                label: `SP${i}`,
                colour: '#000000',
                count: 10 + i,
            })),
        });
        inside(block.panel, 'landscape');
        expect(block.panel.x).toBeGreaterThanOrEqual(l.map.x);
        expect(block.panel.y).toBeGreaterThanOrEqual(l.map.y);
        expect(block.panel.x + block.panel.w).toBeLessThanOrEqual(
            l.map.x + l.map.w,
        );
        expect(block.panel.y + block.panel.h).toBeLessThanOrEqual(
            l.map.y + l.map.h,
        );
        for (const item of block.items)
            expect(item.label.y).toBeLessThanOrEqual(
                block.panel.y + block.panel.h,
            );
    });
});

describe('seat labels', () => {
    it('keeps "Member of the National Assembly" whole on every card', () => {
        for (const size of SIZES) {
            const [b] = seatBlocks(locatorLayout(size, 1), [
                {
                    key: 'mp',
                    label: 'Member of the National Assembly',
                    holder: null,
                },
            ]);
            expect(b.lines[0].text).toBe('Member of the National Assembly');
        }
    });
});
