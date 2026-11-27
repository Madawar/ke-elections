import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SearchBox from '@/components/map/SearchBox.vue';
import type { Holder } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

const box: Unit['b'] = [0, 0, 1, 1];
const index = UnitIndex.fromRows([
    { l: 'province', c: 1, n: 'Coast', p: null, b: box },
    { l: 'county', c: 1, n: 'Mombasa', p: 1, b: box },
    { l: 'constituency', c: 1, n: 'Changamwe', p: 1, b: box },
    { l: 'constituency', c: 2, n: 'Jomvu', p: 1, b: box },
    { l: 'constituency', c: 3, n: 'Kisauni', p: 1, b: box },
]);

const mp = (code: number, name: string): Holder => ({
    seat: 'mp',
    level: 'constituency',
    code,
    name,
    party: 'ODM',
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: 'https://example.test/gazette',
});
const nominated = (name: string): Holder => ({
    seat: 'nominated_mp',
    level: 'national',
    code: 0,
    name,
    party: 'ODM',
    basis: 'nominated',
    started_on: '2022-09-01',
    source_url: 'https://example.test/gazette',
});

const holders = [mp(1, 'Test Changa One'), mp(2, 'Test Changa Two')];

async function type(wrapper: ReturnType<typeof mount>, text: string) {
    const input = wrapper.get('input');
    await input.trigger('focus');
    await input.setValue(text);
}

describe('SearchBox', () => {
    it('shows Places and People headings, hidden from the option list', async () => {
        const wrapper = mount(SearchBox, { props: { index, holders } });
        await type(wrapper, 'cha');
        const headings = wrapper.findAll('[role="presentation"]');
        expect(headings.map((h) => h.text())).toEqual(['Places', 'People']);
        const options = wrapper.findAll('[role="option"]');
        expect(options.map((o) => o.text())).toEqual([
            expect.stringContaining('Changamwe'),
            expect.stringContaining('Test Changa One'),
            expect.stringContaining('Test Changa Two'),
        ]);
        expect(options[1].text()).toContain('MP, Changamwe, Mombasa (ODM)');
        expect(wrapper.findAll('[role="listbox"]')).toHaveLength(1);
    });

    it('moves from the last place to the first person with ArrowDown', async () => {
        const wrapper = mount(SearchBox, { props: { index, holders } });
        await type(wrapper, 'cha');
        const input = wrapper.get('input');
        const selected = () =>
            wrapper
                .findAll('[role="option"]')
                .map((o) => o.attributes('aria-selected'));
        expect(selected()).toEqual(['true', 'false', 'false']);
        await input.trigger('keydown', { key: 'ArrowDown' });
        expect(selected()).toEqual(['false', 'true', 'false']);
        const active = wrapper.findAll('[role="option"]')[1].attributes('id');
        expect(input.attributes('aria-activedescendant')).toBe(active);
        await input.trigger('keydown', { key: 'ArrowUp' });
        expect(selected()).toEqual(['true', 'false', 'false']);
    });

    it('emits pickPerson on Enter over a person, and pick over a place', async () => {
        const wrapper = mount(SearchBox, { props: { index, holders } });
        await type(wrapper, 'cha');
        const input = wrapper.get('input');
        await input.trigger('keydown', { key: 'ArrowDown' });
        await input.trigger('keydown', { key: 'Enter' });
        const picked = wrapper.emitted('pickPerson');
        expect(picked).toHaveLength(1);
        expect((picked![0][0] as { holder: Holder }).holder.name).toBe(
            'Test Changa One',
        );
        expect(wrapper.emitted('pick')).toBeUndefined();

        await type(wrapper, 'cha');
        await wrapper.get('input').trigger('keydown', { key: 'Enter' });
        expect(wrapper.emitted('pick')).toHaveLength(1);
    });

    it('closes on Escape', async () => {
        const wrapper = mount(SearchBox, { props: { index, holders } });
        await type(wrapper, 'cha');
        await wrapper.get('input').trigger('keydown', { key: 'Escape' });
        expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    });

    it('shows up to 8 people when there are no place matches', async () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            nominated(`Test Zed Person ${i + 1}`),
        );
        const wrapper = mount(SearchBox, { props: { index, holders: many } });
        await type(wrapper, 'zed');
        expect(wrapper.findAll('[role="option"]')).toHaveLength(8);
        expect(
            wrapper.findAll('[role="presentation"]').map((h) => h.text()),
        ).toEqual(['People']);
    });

    it('shows at most 6 of each group when both have matches', async () => {
        const people = Array.from({ length: 10 }, (_, i) =>
            mp(1, `Test Zed Person ${i + 1}`),
        );
        const places = UnitIndex.fromRows([
            { l: 'county', c: 1, n: 'Mombasa', p: null, b: box },
            ...Array.from({ length: 10 }, (_, i) => ({
                l: 'constituency' as const,
                c: i + 1,
                n: `Zed Place ${i + 1}`,
                p: 1,
                b: box,
            })),
        ]);
        const wrapper = mount(SearchBox, {
            props: { index: places, holders: people },
        });
        await type(wrapper, 'zed');
        expect(wrapper.findAll('[role="option"]')).toHaveLength(12);
    });

    it('shows up to 8 places when no people match', async () => {
        const places = UnitIndex.fromRows([
            { l: 'county', c: 1, n: 'Mombasa', p: null, b: box },
            ...Array.from({ length: 10 }, (_, i) => ({
                l: 'constituency' as const,
                c: i + 1,
                n: `Zed Place ${i + 1}`,
                p: 1,
                b: box,
            })),
        ]);
        const wrapper = mount(SearchBox, {
            props: { index: places, holders },
        });
        await type(wrapper, 'zed');
        expect(wrapper.findAll('[role="option"]')).toHaveLength(8);
        expect(
            wrapper.findAll('[role="presentation"]').map((h) => h.text()),
        ).toEqual(['Places']);
    });

    describe('parties', () => {
        const parties = [
            {
                abbrev: 'UDA',
                name: 'United Democratic Alliance',
                coalition_2022: null,
                colour: null,
                former_names: [{ abbrev: 'PDR', effective_on: null }],
            },
            {
                abbrev: 'ODM',
                name: 'Orange Democratic Movement',
                coalition_2022: null,
                colour: null,
            },
            {
                abbrev: 'IND',
                name: 'Independent',
                coalition_2022: null,
                colour: null,
            },
        ];

        it('lists a Parties group after Places and People', async () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            await type(wrapper, 'democratic');
            expect(
                wrapper.findAll('[role="presentation"]').map((h) => h.text()),
            ).toEqual(['Parties']);
            expect(
                wrapper.findAll('[role="option"]').map((o) => o.text()),
            ).toEqual([
                expect.stringContaining('Orange Democratic Movement'),
                expect.stringContaining('United Democratic Alliance'),
            ]);
        });

        it('finds a party by its abbreviation and says what the row is', async () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            await type(wrapper, 'uda');
            const [row] = wrapper.findAll('[role="option"]');
            expect(row.text()).toContain('UDA');
            expect(row.text()).toContain('United Democratic Alliance');
            expect(row.text()).toContain('party');
        });

        it('finds a party by a former name and shows it', async () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            await type(wrapper, 'pdr');
            const [row] = wrapper.findAll('[role="option"]');
            expect(row.text()).toContain('UDA');
            expect(row.text()).toContain('formerly PDR');
        });

        it('never lists the independents', async () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            await type(wrapper, 'independent');
            expect(wrapper.findAll('[role="option"]')).toHaveLength(0);
        });

        it('emits pickParty with the abbreviation on Enter, and not pick or pickPerson', async () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            await type(wrapper, 'odm');
            await wrapper.get('input').trigger('keydown', { key: 'Enter' });
            expect(wrapper.emitted('pickParty')).toEqual([['ODM']]);
            expect(wrapper.emitted('pick')).toBeUndefined();
            expect(wrapper.emitted('pickPerson')).toBeUndefined();
        });

        it('mixes with the other groups: places, people, then parties', async () => {
            const withKenya = [
                ...parties,
                {
                    abbrev: 'CHA',
                    name: 'Changa Party',
                    coalition_2022: null,
                    colour: null,
                },
            ];
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties: withKenya },
            });
            await type(wrapper, 'cha');
            expect(
                wrapper.findAll('[role="presentation"]').map((h) => h.text()),
            ).toEqual(['Places', 'People', 'Parties']);
        });

        it('says it searches parties too', () => {
            const wrapper = mount(SearchBox, {
                props: { index, holders, parties },
            });
            expect(wrapper.get('input').attributes('placeholder')).toBe(
                'Search a place, person or party',
            );
            expect(wrapper.get('label').text()).toBe(
                'Search places, people and parties',
            );
        });
    });
});
