import { describe, expect, it } from 'vitest';
import { captionFor } from '@/lib/export/caption';
import { snapshotView } from '@/lib/export/viewState';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const URL = 'https://kenyaelectoralmap.example/?seat=mca&parties=uda,odm';
const view = (only: string[]) =>
    snapshotView({
        seats: VIEW_SEATS,
        index: viewIndex,
        seat: 'mca',
        focus: null,
        only,
        showSurroundings: false,
        theme: 'dark',
    });

describe('captionFor', () => {
    it('gives the headline, one line per highlighted party, the source, the link and the tags', () => {
        const text = captionFor(view(['UDA', 'ODM']), URL);
        expect(text.split('\n')).toEqual([
            'MCA seats across Kenya: UDA 523, ODM 312',
            '',
            'UDA (United Democratic Alliance): 523 of 1,450 seats, 36%',
            'ODM (Orange Democratic Movement): 312 of 1,450 seats, 22%',
            '',
            'Source: IEBC gazette notices, data as of 16 July 2026.',
            URL,
            '',
            '#Kenya2027 #KenyaDecides',
        ]);
    });

    it('lists the top three parties when none are highlighted', () => {
        const text = captionFor(view([]), URL);
        expect(text).toContain('UDA (United Democratic Alliance): 523');
        expect(text).toContain('ODM (Orange Democratic Movement): 312');
        expect(text).toContain('Independent: 114 of 1,450 seats, 8%');
        expect(text).not.toContain('Other and independent');
        expect(text).not.toContain('JP (');
    });

    it('stays within the Instagram and X limits however many parties are highlighted', () => {
        const all = VIEW_SEATS.parties.map((p) => p.abbrev);
        for (const v of [view([]), view(['UDA', 'ODM']), view(all)]) {
            const long = captionFor(v, URL);
            expect(long.length).toBeLessThan(2200);
            expect(long).toContain('IEBC gazette notices');
            expect(long).toContain(URL);
            const x = captionFor(v, URL, 'x');
            expect(x.length).toBeLessThan(280);
            expect(x).toContain('IEBC gazette notices');
            expect(x).toContain(URL);
            expect(x).toContain('#Kenya2027');
        }
    });

    it('keeps the source, link and tags when the sources run long', () => {
        const hosts = Array.from(
            { length: 40 },
            (_, i) => `news-site-number-${i + 1}.example.org`,
        );
        const base = view(VIEW_SEATS.parties.map((p) => p.abbrev));
        const many = {
            ...base,
            sources: ['IEBC gazette notices', ...hosts],
            source: `IEBC gazette notices, ${hosts.join(', ')}`,
            // Many long party names, so the party lines alone would pass the limit.
            highlights: Array.from({ length: 30 }, (_, i) => ({
                label: `P${i}`,
                name: `A party with a very long registered name, number ${i} ${'x'.repeat(80)}`,
                colour: '#000',
                count: 1,
                share: '<1%',
            })),
        };
        const x = captionFor(many, URL, 'x');
        expect(x.length).toBeLessThan(280);
        expect(x).toContain(
            'Source: IEBC gazette notices, news-site-number-1.example.org and 39 more sources',
        );
        expect(x).toContain(URL);
        expect(x).toContain('#Kenya2027 #KenyaDecides');
        const ig = captionFor(many, URL);
        expect(ig.length).toBeLessThan(2200);
        expect(ig).toContain('Source: IEBC gazette notices');
        expect(ig).toContain(URL);
        expect(ig.endsWith('#Kenya2027 #KenyaDecides')).toBe(true);
        expect(ig).toContain('more parties.');
    });
});
