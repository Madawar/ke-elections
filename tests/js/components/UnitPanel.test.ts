import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UnitPanel from '@/components/map/UnitPanel.vue';
import { EMPTY_SEATS, type SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';
import { LEADERS_SEATS, leadersIndex } from '../leadersFixtures';

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

    it('scrolls again once the bottom sheet has finished opening', async () => {
        const calls: string[] = [];
        const original = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function () {
            calls.push(this.textContent ?? '');
        };
        const sheet = document.createElement('aside');
        sheet.setAttribute('data-sheet', '');
        document.body.appendChild(sheet);
        try {
            mount(UnitPanel, {
                props: {
                    unit: county,
                    index,
                    seats,
                    towns: [],
                    highlightSeat: 'woman_rep',
                },
                attachTo: sheet,
            });
            await new Promise((r) => setTimeout(r, 0));
            const before = calls.length;
            const end = new Event('transitionend', { bubbles: true });
            Object.assign(end, { propertyName: 'height' });
            sheet.dispatchEvent(end);
            expect(calls.length).toBe(before + 1);
            expect(calls.at(-1)).toContain('Test Person Three');
            // Only the first end of the transition: later ones do not scroll again.
            sheet.dispatchEvent(end);
            expect(calls.length).toBe(before + 1);
        } finally {
            HTMLElement.prototype.scrollIntoView = original;
            sheet.remove();
        }
    });

    it('describes the surroundings switch with its hint, so its name stays short', () => {
        const wrapper = mount(UnitPanel, {
            props: {
                unit: county,
                index,
                seats,
                towns: [],
                showSurroundings: false,
            },
            attachTo: document.body,
        });
        const toggle = wrapper.get('button[role="switch"]').element;
        const byId = (attr: string) =>
            document.getElementById(toggle.getAttribute(attr) ?? '');
        expect(byId('aria-labelledby')?.textContent?.trim()).toBe(
            'Show surroundings',
        );
        expect(byId('aria-describedby')?.textContent?.trim()).toBe(
            'The rest of the map, faint and in grey',
        );
        wrapper.unmount();
    });

    it('offers a labelled switch for showing the surroundings', async () => {
        const wrapper = mount(UnitPanel, {
            props: {
                unit: county,
                index,
                seats,
                towns: [],
                showSurroundings: false,
            },
        });
        const toggle = wrapper.get('button[role="switch"]');
        expect(toggle.text()).toContain('Show surroundings');
        expect(toggle.attributes('aria-checked')).toBe('false');
        await toggle.trigger('click');
        expect(wrapper.emitted('update:showSurroundings')).toEqual([[true]]);
        await wrapper.setProps({ showSurroundings: true });
        expect(toggle.attributes('aria-checked')).toBe('true');
    });

    describe('party names open the party profile', () => {
        const withParties: SeatsData = {
            ...seats,
            parties: [
                { abbrev: 'ODM', name: 'Orange Democratic Movement', coalition_2022: null, colour: '#f80' },
                { abbrev: 'IND', name: 'Independent', coalition_2022: null, colour: null },
            ],
            holders: [
                ...seats.holders,
                { ...holder('governor', 'Test Independent'), code: 2, party: 'IND' },
            ],
        };
        // The panel reads who represents a unit through the unit directory, so Kwale is in it.
        const kwale: Unit = { l: 'county', c: 2, n: 'Kwale', p: null, b: box };
        const both = UnitIndex.fromRows([county, kwale]);
        const mountWith = (data: SeatsData, unit: Unit = county) =>
            mount(UnitPanel, {
                props: { unit, index: both, seats: data, towns: [] },
            });

        it('is a button that emits the abbreviation', async () => {
            const wrapper = mountWith(withParties);
            const buttons = wrapper.findAll('button[data-party]');
            expect(buttons).toHaveLength(3);
            expect(buttons[0].text()).toBe('Orange Democratic Movement');
            expect(buttons[0].attributes('aria-label')).toBe(
                'Orange Democratic Movement: all seats',
            );
            expect(buttons[0].classes()).toContain('min-h-11');
            await buttons[0].trigger('click');
            expect(wrapper.emitted('party')).toEqual([['ODM']]);
        });

        it('is plain text for an independent, who is not a party', () => {
            const wrapper = mountWith(withParties, kwale);
            expect(wrapper.find('button[data-party]').exists()).toBe(false);
            expect(wrapper.text()).toContain('Independent');
        });

        it('is plain text for a party the data has no profile for', () => {
            const wrapper = mountWith(seats);
            expect(wrapper.find('button[data-party]').exists()).toBe(false);
            expect(wrapper.text()).toContain('ODM');
        });
    });
});

describe('UnitPanel: who represents the unit', () => {
    const mountAt = (l: 'county' | 'constituency' | 'ward', c: number) =>
        mount(UnitPanel, {
            props: {
                unit: leadersIndex.get(l, c)!,
                index: leadersIndex,
                seats: LEADERS_SEATS,
                towns: [],
            },
        });
    const rowTexts = (w: ReturnType<typeof mountAt>) =>
        w.findAll('[data-leader]').map((r) => r.text().replace(/\s+/g, ' '));

    it('heads the section "Who represents <unit>"', () => {
        const w = mountAt('constituency', 290);
        expect(w.get('[data-leaders] h3').text()).toBe(
            'Who represents Mathare',
        );
        expect(w.text()).not.toContain('Seats');
    });

    it('lists a constituency’s MP, then the county-wide three labelled as county-wide', () => {
        const w = mountAt('constituency', 290);
        expect(
            w.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['mp', 'governor', 'senator', 'woman_rep']);
        const rows = rowTexts(w);
        expect(rows[0]).toContain('Member of the National Assembly');
        expect(rows[0]).toContain('Placeholder mp 290');
        expect(rows[0]).not.toContain('county-wide');
        expect(rows[1]).toContain('Governor (Nairobi City, county-wide)');
        expect(rows[2]).toContain('Senator (Nairobi City, county-wide)');
        expect(rows[3]).toContain(
            'Woman Representative (Nairobi City, county-wide)',
        );
    });

    it('lists a ward’s MCA first, then its MP, then the county-wide three', () => {
        const w = mountAt('ward', 1448);
        expect(
            w.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['mca', 'mp', 'governor', 'senator', 'woman_rep']);
        const rows = rowTexts(w);
        expect(rows[0]).toContain('Placeholder mca 1448');
        expect(rows[1]).toContain(
            'Member of the National Assembly (Mathare constituency)',
        );
    });

    it('keeps a county to its own three seats, with no place label', () => {
        const w = mountAt('county', 47);
        expect(
            w.findAll('[data-leader]').map((r) => r.attributes('data-leader')),
        ).toEqual(['governor', 'senator', 'woman_rep']);
        expect(w.text()).not.toContain('county-wide');
        expect(w.find('[data-mca-summary]').exists()).toBe(false);
    });

    it('shows each row’s party, how the seat was won and its own source', () => {
        const row = mountAt('county', 47).get('[data-leader="governor"]');
        expect(row.text()).toContain('United Democratic Alliance');
        expect(row.text()).toContain('Elected 2022');
        expect(row.get('a').attributes('href')).toBe(
            'https://archive.gazettes.africa/archive/ke/2022/sample-169.pdf',
        );
        expect(row.get('a').text()).toBe('archive.gazettes.africa');
    });

    it('says "No approved data yet" for a seat with no holder', () => {
        const w = mountAt('county', 3);
        expect(w.get('[data-leader="senator"]').text()).toContain(
            'No approved data yet',
        );
        expect(w.get('[data-leader="governor"]').text()).not.toContain(
            'No approved data yet',
        );
    });

    it('sums up a constituency’s MCAs in one line that opens the list of wards', async () => {
        const w = mountAt('constituency', 290);
        const summary = w.get('[data-mca-summary]');
        expect(summary.text()).toContain(
            'MCAs (6): ODM 3, UDA 2, no approved data yet 1',
        );
        const toggle = summary.get('button[aria-expanded]');
        expect(toggle.attributes('aria-expanded')).toBe('false');
        expect(w.findAll('[data-mca-ward]')).toHaveLength(0);
        await toggle.trigger('click');
        expect(toggle.attributes('aria-expanded')).toBe('true');
        const wards = w.findAll('[data-mca-ward]');
        expect(wards.map((r) => r.attributes('data-mca-ward'))).toEqual([
            '1445',
            '1446',
            '1447',
            '1448',
            '1449',
            '1450',
        ]);
        expect(wards[3].text()).toContain('Ngei');
        expect(wards[3].text()).toContain('Placeholder mca 1448');
        expect(wards[3].text()).toContain('ODM');
        expect(wards[5].text()).toContain('No approved data yet');
    });

    it('focuses a ward when its MCA’s name is pressed', async () => {
        const w = mountAt('constituency', 290);
        await w.get('[data-mca-summary] button[aria-expanded]').trigger('click');
        await w.get('[data-mca-ward="1448"] button').trigger('click');
        expect(w.emitted('go')?.[0]).toEqual([leadersIndex.get('ward', 1448)]);
        // A ward with no MCA still leads to the ward, by its name.
        await w.get('[data-mca-ward="1450"] button').trigger('click');
        expect(w.emitted('go')?.[1]).toEqual([leadersIndex.get('ward', 1450)]);
    });

    it('closes the ward list again when another unit is shown', async () => {
        const w = mountAt('constituency', 290);
        await w.get('[data-mca-summary] button[aria-expanded]').trigger('click');
        await w.setProps({ unit: leadersIndex.get('constituency', 289)! });
        expect(
            w
                .get('[data-mca-summary] button[aria-expanded]')
                .attributes('aria-expanded'),
        ).toBe('false');
    });

    it('highlights the row of a seat held above the unit when asked to', () => {
        const w = mount(UnitPanel, {
            props: {
                unit: leadersIndex.get('ward', 1448)!,
                index: leadersIndex,
                seats: LEADERS_SEATS,
                towns: [],
                highlightSeat: 'governor',
            },
        });
        const marked = w.findAll('[data-highlighted="true"]');
        expect(marked).toHaveLength(1);
        expect(marked[0].attributes('data-leader')).toBe('governor');
    });
});
