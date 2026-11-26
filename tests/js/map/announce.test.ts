import { describe, expect, it } from 'vitest';
import { announceSelection } from '@/lib/map/announce';

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
