import { describe, expect, it } from 'vitest';
import { fitFontSize, textWidth, wrapText } from '@/lib/export/text';

describe('text measuring', () => {
    it('grows with length and size', () => {
        expect(textWidth('Ngei', 20)).toBeGreaterThan(0);
        expect(textWidth('Ngei ward', 20)).toBeGreaterThan(
            textWidth('Ngei', 20),
        );
        expect(textWidth('Ngei', 40)).toBeCloseTo(textWidth('Ngei', 20) * 2);
    });

    it('wraps on spaces without losing words', () => {
        const text =
            'Boundaries: IEBC 2012 delimitation via mikelmaron and a few more words';
        const lines = wrapText(text, 200, 16);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join(' ')).toBe(text);
        for (const line of lines)
            expect(textWidth(line, 16)).toBeLessThanOrEqual(200);
    });

    it('ends with an ellipsis when it runs out of lines', () => {
        const lines = wrapText('one two three four five six seven', 60, 16, 2);
        expect(lines).toHaveLength(2);
        expect(lines[1].endsWith('…')).toBe(true);
        expect(textWidth(lines[1], 16)).toBeLessThanOrEqual(60);
    });

    it('shrinks a font until the text fits, but not below the minimum', () => {
        expect(fitFontSize('Ngei', 1000, 64, 40)).toBe(64);
        const size = fitFontSize('A rather long ward name here', 300, 64, 20);
        expect(size).toBeLessThan(64);
        expect(
            textWidth('A rather long ward name here', size),
        ).toBeLessThanOrEqual(300);
        expect(fitFontSize('A rather long ward name here', 10, 64, 20)).toBe(
            20,
        );
    });
});
