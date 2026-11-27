import { describe, expect, it } from 'vitest';
import { announcePerson, announceSelection } from '@/lib/map/announce';

describe('announceSelection', () => {
    it('names the unit and where it sits', () => {
        expect(
            announceSelection({ l: 'ward', n: 'Ngei' }, [
                { n: 'Mathare' },
                { n: 'Nairobi City' },
            ]),
        ).toBe('Selected: Ngei ward, Mathare, Nairobi City');
    });

    it('says so when the focus has stepped all the way out', () => {
        expect(announceSelection(null, [])).toBe('Showing all of Kenya');
    });
});

describe('announcePerson', () => {
    it('says who was picked, the seat, and where the map shows it', () => {
        expect(
            announcePerson(
                { name: 'A. Person', title: 'MP' },
                { l: 'constituency', n: 'Mathare' },
            ),
        ).toBe('A. Person, MP, shown in Mathare constituency');
        expect(
            announcePerson(
                { name: 'A. Person', title: 'MCA' },
                { l: 'ward', n: 'Ngei' },
            ),
        ).toBe('A. Person, MCA, shown in Ngei ward');
    });

    it('says the party is highlighted in the overview when there is no unit', () => {
        expect(
            announcePerson({ name: 'A. Person', title: 'Nominated MP' }, null),
        ).toBe(
            'A. Person, Nominated MP, party seats highlighted in the national overview',
        );
    });
});
