import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import LeadersStrip from '@/components/map/LeadersStrip.vue';
import Legend from '@/components/map/Legend.vue';
import { leadersFor } from '@/lib/leaders';
import { legendTitle } from '@/lib/seats';
import { LEADERS_SEATS, leadersIndex } from '../leadersFixtures';

const rows = [
    {
        key: 'other',
        label: 'Other parties',
        name: 'Other parties',
        parties: 9,
        colour: '#9AA5A0',
        count: 6,
        last: true,
    },
    { key: 'JP', label: 'JP', name: 'Jubilee Party', colour: '#d00', count: 1 },
    {
        key: 'UDA',
        label: 'UDA',
        name: 'United Democratic Alliance',
        colour: '#fc0',
        count: 4,
    },
    {
        key: 'ODM',
        label: 'ODM',
        name: 'Orange Democratic Movement',
        colour: '#f80',
        count: 13,
    },
    {
        key: 'ANC',
        label: 'ANC',
        name: 'Amani National Congress',
        colour: '#0a0',
        count: 4,
    },
];
const mountLegend = (props = {}) =>
    mount(Legend, {
        props: {
            title: 'MP seats by party',
            chipLabel: 'MP seats',
            rows,
            ...props,
        },
    });

/** Each row's count and share, read from their own cells: two columns that line up. */
const cells = (wrapper: ReturnType<typeof mountLegend>) =>
    wrapper
        .findAll('li')
        .map(
            (li) =>
                `${li.find('[data-count]').text()} ${li.find('[data-share]').text()}`,
        );

describe('Legend as a bar chart', () => {
    it('sorts by count, ties by abbreviation, with Other last', () => {
        const items = mountLegend().findAll('li');
        expect(items.map((li) => li.attributes('data-key'))).toEqual([
            'ODM',
            'ANC',
            'UDA',
            'JP',
            'other',
        ]);
    });

    it('draws every bar on one zero-based scale, the largest filling the track', () => {
        const widths = mountLegend()
            .findAll('[data-bar]')
            .map((b) => parseFloat((b.element as HTMLElement).style.width));
        expect(widths[0]).toBe(100);
        expect(widths[1]).toBeCloseTo((4 / 13) * 100, 0);
        expect(widths[4]).toBeCloseTo((6 / 13) * 100, 0);
    });

    it('scales a 13-of-22 bar to about 59 percent', () => {
        const wrapper = mountLegend({
            rows: [
                {
                    key: 'A',
                    label: 'AAA',
                    name: 'Alpha',
                    colour: '#111',
                    count: 22,
                },
                {
                    key: 'B',
                    label: 'BBB',
                    name: 'Beta',
                    colour: '#222',
                    count: 13,
                },
            ],
        });
        const [a, b] = wrapper
            .findAll('[data-bar]')
            .map((x) => parseFloat((x.element as HTMLElement).style.width));
        expect(a).toBe(100);
        expect(b).toBeCloseTo(59.1, 1);
    });

    it('colours each bar with its party colour', () => {
        const bar = mountLegend().find('[data-bar]');
        expect((bar.element as HTMLElement).style.background).toContain('#f80');
    });

    it('reads without colour: count text and an accessible name per row', () => {
        const items = mountLegend().findAll('li');
        expect(items[0].find('.sr-only').text()).toBe(
            'Orange Democratic Movement: 13 seats, 46 percent',
        );
        expect(items[4].find('.sr-only').text()).toBe(
            'Other parties (9): 6 seats, 21 percent',
        );
        expect(items[0].text()).toContain('13');
        const one = mountLegend({
            rows: [
                {
                    key: 'A',
                    label: 'AAA',
                    name: 'Alpha',
                    colour: '#111',
                    count: 1,
                },
            ],
        });
        expect(one.find('li .sr-only').text()).toBe(
            'Alpha: 1 seat, 100 percent',
        );
    });

    it('hides the bars from assistive technology', () => {
        const wrapper = mountLegend();
        for (const track of wrapper.findAll('[data-track]'))
            expect(track.attributes('aria-hidden')).toBe('true');
        expect(wrapper.find('ul').element.tagName).toBe('UL');
    });

    it('shows the scoped heading and keeps the note below the chart', () => {
        const wrapper = mountLegend({
            title: 'MP seats in Nairobi City by party',
            note: 'Source: IEBC',
        });
        expect(wrapper.text()).toContain('MP seats in Nairobi City by party');
        const html = wrapper.html();
        expect(html.indexOf('Source: IEBC')).toBeGreaterThan(
            html.lastIndexOf('</ul>'),
        );
    });

    it('pins the source note and Show all outside the scrolling rows, so a capped legend still shows them', () => {
        const wrapper = mountLegend({
            note: 'Source: IEBC',
            filtered: true,
            highlighted: ['UDA'],
            maxHeight: '220px',
        });
        const scroller = wrapper.find('.overflow-y-auto');
        expect(scroller.find('ul').exists()).toBe(true);
        expect(scroller.text()).not.toContain('Source: IEBC');
        expect(scroller.text()).not.toContain('Show all');
        const note = wrapper
            .findAll('p')
            .find((p) => p.text() === 'Source: IEBC')!;
        expect(note.exists()).toBe(true);
        expect(scroller.element.contains(note.element)).toBe(false);
        // The cap stays on the whole legend; the footer does not scroll away.
        expect(wrapper.attributes('style')).toContain('max-height: 220px');
        expect(note.element.parentElement?.classList.contains('shrink-0')).toBe(
            true,
        );
        expect(
            wrapper.findAll('button').some((b) => b.text() === 'Show all'),
        ).toBe(true);
    });

    it('words the heading by scope: across Kenya unfocused, the unit when focused', () => {
        expect(legendTitle('Senator')).toBe(
            'Senator seats across Kenya by party',
        );
        expect(legendTitle('MP', 'Nairobi City')).toBe(
            'MP seats in Nairobi City by party',
        );
        const wrapper = mountLegend({ title: legendTitle('Senator') });
        expect(wrapper.find('button').text()).toContain(
            'Senator seats across Kenya by party',
        );
    });

    it('keeps counts and shares in their own right-aligned tabular cells', () => {
        const wrapper = mountLegend();
        for (const li of wrapper.findAll('li')) {
            for (const cell of ['[data-count]', '[data-share]']) {
                const classes = li.find(cell).classes();
                expect(classes).toContain('text-right');
                expect(classes).toContain('tabular-nums');
            }
        }
    });

    it('uses tokens only: no literal colour classes, an opaque surface, a capped height', () => {
        const wrapper = mountLegend({ maxHeight: 'calc(100dvh - 400px)' });
        const classes = wrapper
            .findAll('*')
            .flatMap((el) => el.classes())
            .concat(wrapper.classes());
        expect(
            classes.filter((c) => /(^|-)(black|white)(\/|$)|\[#/.test(c)),
        ).toEqual([]);
        expect(wrapper.classes()).toContain('bg-surface');
        expect(wrapper.classes().join(' ')).not.toContain('bg-surface/');
        expect((wrapper.element as HTMLElement).style.maxHeight).toBe(
            'calc(100dvh - 400px)',
        );
    });

    it('collapses to a chip and opens on tap', async () => {
        const wrapper = mountLegend({ open: false });
        expect(wrapper.find('ul').exists()).toBe(false);
        const button = wrapper.find('button');
        expect(button.text()).toContain('MP seats');
        expect(button.text()).not.toContain('by party');
        expect(button.attributes('aria-expanded')).toBe('false');
        await button.trigger('click');
        expect(wrapper.emitted('update:open')?.[0]).toEqual([true]);
    });

    it('lists swatches without bars when there are no counts', () => {
        const wrapper = mount(Legend, {
            props: {
                title: 'Former provinces',
                rows: [
                    { key: '1', label: 'Coast', colour: '#aaa' },
                    { key: '2', label: 'Rift Valley', colour: '#bbb' },
                ],
            },
        });
        expect(wrapper.findAll('[data-bar]')).toHaveLength(0);
        expect(wrapper.findAll('li').map((li) => li.text())).toEqual([
            'Coast',
            'Rift Valley',
        ]);
    });

    it('shows each count with its share of the seats in view, rounded to whole percent', () => {
        const wrapper = mountLegend({
            rows: [
                {
                    key: 'UDA',
                    label: 'UDA',
                    name: 'United Democratic Alliance',
                    colour: '#fc0',
                    count: 22,
                },
                {
                    key: 'ODM',
                    label: 'ODM',
                    name: 'Orange Democratic Movement',
                    colour: '#f80',
                    count: 13,
                },
                {
                    key: 'JP',
                    label: 'JP',
                    name: 'Jubilee Party',
                    colour: '#d00',
                    count: 4,
                },
                {
                    key: 'WDM',
                    label: 'WDM-K',
                    name: 'Wiper',
                    colour: '#00d',
                    count: 3,
                },
                {
                    key: 'UDM',
                    label: 'UDM',
                    name: 'UDM',
                    colour: '#0dd',
                    count: 2,
                },
                {
                    key: 'FORD',
                    label: 'FORD-K',
                    name: 'FORD-Kenya',
                    colour: '#a0d',
                    count: 1,
                },
                {
                    key: 'other',
                    label: 'Other parties',
                    name: 'Other parties',
                    colour: '#9AA5A0',
                    count: 2,
                    last: true,
                },
            ],
        });
        const counts = cells(wrapper);
        expect(counts[0]).toBe('22 (47%)');
        expect(counts[1]).toBe('13 (28%)');
        // The shares are rounded one by one and are not forced to add up to 100.
        expect(counts.slice(2)).toEqual([
            '4 (9%)',
            '3 (6%)',
            '2 (4%)',
            '1 (2%)',
            '2 (4%)',
        ]);
        expect(wrapper.find('li .sr-only').text()).toBe(
            'United Democratic Alliance: 22 seats, 47 percent',
        );
    });

    it('shows a share under half a percent as <1%', () => {
        const wrapper = mountLegend({
            rows: [
                {
                    key: 'A',
                    label: 'AAA',
                    name: 'Alpha',
                    colour: '#111',
                    count: 289,
                },
                {
                    key: 'B',
                    label: 'BBB',
                    name: 'Beta',
                    colour: '#222',
                    count: 1,
                },
            ],
        });
        expect(cells(wrapper)).toEqual(['289 (100%)', '1 (<1%)']);
        const spoken = wrapper.findAll('li .sr-only').map((c) => c.text());
        expect(spoken[1]).toBe('Beta: 1 seat, less than 1 percent');
    });

    it('turns each party row into an independent toggle button', async () => {
        const wrapper = mountLegend({ highlighted: ['ODM', 'other'] });
        const buttons = wrapper.findAll('li button');
        expect(buttons).toHaveLength(5);
        expect(buttons[0].attributes('aria-label')).toBe(
            'Highlight Orange Democratic Movement areas',
        );
        const pressed = buttons.map((b) => b.attributes('aria-pressed'));
        expect(pressed).toEqual(['true', 'false', 'false', 'false', 'true']);
        await buttons[2].trigger('click');
        await buttons[4].trigger('click');
        expect(wrapper.emitted('toggle')).toEqual([['UDA'], ['other']]);
    });

    it('offers Show all only while something is highlighted, and clears every highlight', async () => {
        expect(mountLegend().text()).not.toContain('Show all');
        const wrapper = mountLegend({
            highlighted: ['ODM', 'UDA'],
            filtered: true,
        });
        const clear = wrapper
            .findAll('button')
            .find((b) => b.text() === 'Show all')!;
        await clear.trigger('click');
        expect(wrapper.emitted('clear')).toHaveLength(1);
    });

    it('lists the parties in the heading while they are highlighted', () => {
        expect(legendTitle('MP', null, ['UDA'])).toBe(
            'MP seats across Kenya by party: showing UDA',
        );
        expect(legendTitle('MP', 'Nairobi City', ['UDA', 'ODM'])).toBe(
            'MP seats in Nairobi City by party: showing UDA, ODM',
        );
        expect(legendTitle('MP', null, ['UDA', 'ODM', 'JP'])).toBe(
            'MP seats across Kenya by party: showing UDA, ODM, JP',
        );
        expect(
            legendTitle('MP', 'Nairobi City', ['UDA', 'ODM', 'JP', 'ANC']),
        ).toBe('MP seats in Nairobi City by party: showing 4 parties');
    });

    it('offers "Share this view" when shareable, standing out while something is in focus', async () => {
        expect(mountLegend().find('[data-share-view]').exists()).toBe(false);
        const plain = mountLegend({ shareable: true });
        const button = plain.get('[data-share-view]');
        expect(button.text()).toBe('Share this view');
        expect(button.classes()).not.toContain('bg-ink');
        await button.trigger('click');
        expect(plain.emitted('share')).toHaveLength(1);
        const emphasised = mountLegend({
            shareable: true,
            shareEmphasis: true,
        });
        expect(emphasised.get('[data-share-view]').classes()).toContain(
            'bg-ink',
        );
    });

    describe('party details', () => {
        const withProfiles = rows.map((r) =>
            r.key === 'other' ? r : { ...r, party: r.key },
        );
        const row = (wrapper: ReturnType<typeof mountLegend>, key: string) =>
            wrapper.get(`li[data-key="${key}"]`);

        it('gives each party its own "<name>: all seats" button, apart from the highlight toggle', async () => {
            const wrapper = mountLegend({ rows: withProfiles });
            const li = row(wrapper, 'UDA');
            const toggle = li.get('[aria-pressed]');
            const details = li.get(
                '[aria-label="United Democratic Alliance: all seats"]',
            );
            expect(details.element).not.toBe(toggle.element);
            // Neither button contains the other, so a tap on one never reaches the other.
            expect(toggle.element.contains(details.element)).toBe(false);
            expect(details.element.contains(toggle.element)).toBe(false);
            await details.trigger('click');
            expect(wrapper.emitted('party')).toEqual([['UDA']]);
            expect(wrapper.emitted('toggle')).toBeUndefined();
            await toggle.trigger('click');
            expect(wrapper.emitted('toggle')).toEqual([['UDA']]);
            expect(wrapper.emitted('party')).toHaveLength(1);
        });

        it('is a 44px-wide target, and 44px tall on touch screens', () => {
            const details = row(mountLegend({ rows: withProfiles }), 'ODM').get(
                '[data-party-details]',
            );
            expect(details.classes()).toContain('w-11');
            expect(details.classes()).toContain('pointer-coarse:min-h-11');
            expect(details.attributes('type')).toBe('button');
        });

        it('has none for Other parties or for rows with no profile', () => {
            const wrapper = mountLegend({ rows: withProfiles });
            expect(row(wrapper, 'other').find('[data-party-details]').exists()).toBe(false);
            const plain = mountLegend();
            expect(plain.find('[data-party-details]').exists()).toBe(false);
        });

        it('keeps the highlighted row pressed state on the toggle only', () => {
            const wrapper = mountLegend({ rows: withProfiles, highlighted: ['UDA'] });
            const li = row(wrapper, 'UDA');
            expect(li.get('[aria-pressed]').attributes('aria-pressed')).toBe('true');
            expect(li.get('[data-party-details]').attributes('aria-pressed')).toBeUndefined();
        });
    });
});

describe('Legend: the "Leaders here" strip', () => {
    const leaders = leadersFor(
        leadersIndex.get('constituency', 290)!,
        LEADERS_SEATS,
        leadersIndex,
    );
    beforeEach(() => {
        localStorage.clear();
        window.matchMedia = ((q: string) => ({
            matches: q.includes('min-width'),
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
        })) as never;
    });

    it('sits at the top of the open legend, above the party bars, inside the part that scrolls', () => {
        const wrapper = mountLegend({ leaders, note: 'Source: IEBC' });
        const strip = wrapper.getComponent(LeadersStrip);
        expect(strip.props('rows')).toEqual(leaders);
        const scroller = wrapper.get('.overflow-y-auto');
        expect(scroller.element.contains(strip.element)).toBe(true);
        expect(scroller.element.firstElementChild).toBe(strip.element);
        // The share button and the source stay outside the scrolling part, always in reach.
        const share = mountLegend({ leaders, shareable: true }).get(
            '[data-share-view]',
        );
        expect(share.element.closest('.overflow-y-auto')).toBeNull();
    });

    it('passes on the leader whose name was pressed', async () => {
        const wrapper = mountLegend({ leaders });
        await wrapper.get('[data-leader="governor"] button').trigger('click');
        expect(wrapper.emitted('leader')?.[0]).toEqual([leaders[1]]);
    });

    it('is absent with nobody to list, and while the legend is a chip', () => {
        expect(mountLegend().findComponent(LeadersStrip).exists()).toBe(false);
        expect(
            mountLegend({ leaders: [] }).findComponent(LeadersStrip).exists(),
        ).toBe(false);
        expect(
            mountLegend({ leaders, open: false })
                .findComponent(LeadersStrip)
                .exists(),
        ).toBe(false);
    });
});
