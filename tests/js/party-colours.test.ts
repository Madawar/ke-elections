import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OTHER, THEMES } from '@/lib/map/theme';

const root = resolve(import.meta.dirname, '../..');
const rows = readFileSync(
    resolve(root, 'data/sources/party_colours.csv'),
    'utf8',
)
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','));
const parties = new Set(
    readFileSync(resolve(root, 'data/sources/parties.csv'), 'utf8')
        .split('\n')
        .slice(1)
        .map((l) => l.split(',')[0]),
);

const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex: string) => {
    const [r, g, b] = rgb(hex).map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const distance = (a: string, b: string) =>
    Math.hypot(...rgb(a).map((c, i) => (c - rgb(b)[i]) * 255));

describe('default party colours', () => {
    it('are valid, unique, and name real parties', () => {
        const colours = rows.map(([, c]) => c.toUpperCase());
        for (const [abbrev, colour] of rows) {
            expect(colour).toMatch(/^#[0-9A-F]{6}$/i);
            expect(parties.has(abbrev)).toBe(true);
        }
        expect(new Set(colours).size).toBe(colours.length);
    });

    it('stay apart from each other, from the fallback and from no-data fills', () => {
        const all = [
            ...rows.map(([, c]) => c),
            OTHER,
            THEMES.light.noData,
            THEMES.dark.noData,
        ];
        for (let i = 0; i < all.length; i++)
            for (let j = i + 1; j < all.length; j++)
                expect(distance(all[i], all[j])).toBeGreaterThan(40);
    });

    it('keep labels legible: ink or its halo always has 3:1 contrast with the fill', () => {
        for (const theme of [THEMES.light, THEMES.dark]) {
            for (const [, colour] of rows) {
                expect(
                    Math.max(
                        contrast(colour, theme.label),
                        contrast(colour, theme.labelHalo),
                    ),
                ).toBeGreaterThanOrEqual(3);
            }
        }
    });
});
