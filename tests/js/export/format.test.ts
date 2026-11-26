import { describe, expect, it } from 'vitest';
import { formatAsOf, sourceLine } from '@/lib/export/format';

describe('formatAsOf', () => {
    it('reads the date as a calendar date', () => {
        expect(formatAsOf('2026-03-12')).toBe('12 March 2026');
        expect(formatAsOf('2026-01-01')).toBe('1 January 2026');
        expect(formatAsOf(null)).toBeNull();
    });
});

describe('sourceLine', () => {
    it('names IEBC gazette notices for IEBC and gazette archive links', () => {
        expect(
            sourceLine([
                'https://www.iebc.or.ke/uploads/x.pdf',
                'https://archive.gazettes.africa/archive/ke/2022/x.pdf',
            ]),
        ).toBe('IEBC gazette notices');
        expect(sourceLine([])).toBe('IEBC gazette notices');
    });

    it('adds any other site by name', () => {
        expect(
            sourceLine([
                'https://www.iebc.or.ke/a.pdf',
                'https://www.the-star.co.ke/news/x',
                'https://citizen.digital/news/y',
                'not a url',
            ]),
        ).toBe('IEBC gazette notices, citizen.digital and the-star.co.ke');
        expect(sourceLine(['https://www.the-star.co.ke/x'])).toBe(
            'IEBC gazette notices and the-star.co.ke',
        );
    });
});
