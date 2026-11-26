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
});
