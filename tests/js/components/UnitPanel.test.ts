import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UnitPanel from '@/components/map/UnitPanel.vue';
import { EMPTY_SEATS, type SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

const box: Unit['b'] = [0, 0, 1, 1];
const county: Unit = { l: 'county', c: 1, n: 'Mombasa', p: null, b: box };
const index = UnitIndex.fromRows([county]);
const holder = (seat: 'governor' | 'senator' | 'woman_rep', name: string) => ({
    seat,
    level: 'county' as const,
    code: 1,
    name,
    party: 'ODM',
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: 'https://example.test/gazette',
});
const seats: SeatsData = {
    ...EMPTY_SEATS,
    holders: [
        holder('governor', 'Test Person One'),
        holder('senator', 'Test Person Two'),
        holder('woman_rep', 'Test Person Three'),
    ],
};

describe('UnitPanel', () => {
    it('highlights only the seat row that was picked', () => {
        const wrapper = mount(UnitPanel, {
            props: {
                unit: county,
                index,
                seats,
                towns: [],
                highlightSeat: 'senator',
            },
        });
        const marked = wrapper.findAll('[data-highlighted="true"]');
        expect(marked).toHaveLength(1);
        expect(marked[0].text()).toContain('Test Person Two');
    });

    it('highlights nothing by default', () => {
        const wrapper = mount(UnitPanel, {
            props: { unit: county, index, seats, towns: [] },
        });
        expect(wrapper.find('[data-highlighted="true"]').exists()).toBe(false);
    });

    it('scrolls the highlighted row into view', async () => {
        const calls: string[] = [];
        const original = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function () {
            calls.push(this.textContent ?? '');
        };
        try {
            mount(UnitPanel, {
                props: {
                    unit: county,
                    index,
                    seats,
                    towns: [],
                    highlightSeat: 'woman_rep',
                },
                attachTo: document.body,
            });
            await new Promise((r) => setTimeout(r, 0));
            expect(calls).toHaveLength(1);
            expect(calls[0]).toContain('Test Person Three');
        } finally {
            HTMLElement.prototype.scrollIntoView = original;
        }
    });
});
