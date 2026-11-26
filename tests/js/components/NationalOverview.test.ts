import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Hemicycle from '@/components/map/Hemicycle.vue';
import NationalOverview from '@/components/map/NationalOverview.vue';
import { type SeatsData, EMPTY_SEATS } from '@/lib/seats';

const seats: SeatsData = {
    ...EMPTY_SEATS,
    parties: [
        {
            abbrev: 'AAA',
            name: 'Alpha',
            coalition_2022: null,
            colour: '#E69F00',
        },
        { abbrev: 'ZZZ', name: 'Zeta', coalition_2022: null, colour: null },
        { abbrev: 'QQQ', name: 'Quill', coalition_2022: null, colour: null },
    ],
    holders: [
        {
            seat: 'mp',
            level: 'constituency',
            code: 1,
            name: 'X',
            party: 'AAA',
            basis: 'elected',
            started_on: '2022-08-09',
            source_url: 'https://example.org',
        },
    ],
    // ZZZ sits in the National Assembly only; QQQ holds no seat in either chamber.
    chambers: {
        national_assembly: { AAA: 5, ZZZ: 2 },
        senate: { AAA: 3 },
    },
};

const mountWith = (highlightParty?: string) =>
    mount(NationalOverview, { props: { seats, highlightParty } });
const highlights = (w: ReturnType<typeof mountWith>) =>
    w.findAllComponents(Hemicycle).map((h) => h.props('highlight'));
const status = (w: ReturnType<typeof mountWith>) =>
    w.find('[role="status"]').text();

describe('NationalOverview party highlight', () => {
    it('highlights a coloured party in both chambers and says so', () => {
        const w = mountWith('AAA');
        expect(highlights(w)).toEqual(['AAA', 'AAA']);
        expect(status(w)).toBe('Seats held by Alpha are highlighted below.');
    });

    it('highlights Other only in the chamber where an uncoloured party holds seats', () => {
        const w = mountWith('ZZZ');
        expect(highlights(w)).toEqual(['other', undefined]);
        expect(status(w)).toContain(
            'Zeta is counted in the highlighted Other group',
        );
    });

    it('highlights nothing, and does not claim to, for a party with no seats', () => {
        const w = mountWith('QQQ');
        expect(highlights(w)).toEqual([undefined, undefined]);
        expect(status(w)).toBe(
            'Quill holds no seats in the National Assembly or the Senate.',
        );
        expect(status(w)).not.toContain('highlighted');
    });

    it('shows no status line without a picked party', () => {
        const w = mountWith();
        expect(w.find('[role="status"]').exists()).toBe(false);
        expect(highlights(w)).toEqual([undefined, undefined]);
    });
});
