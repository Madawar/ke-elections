import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: defineComponent({ render: () => null }),
    router: { replace: vi.fn(), push: vi.fn() },
}));
// The page, without a real map: the legend's "Leaders here" strip and the panel are under test.
vi.mock('@/components/map/MapView.vue', () => ({
    default: defineComponent({
        setup(_p, { expose }) {
            expose({
                ready: false,
                setFocus: () => {},
                setShowSurroundings: () => {},
                setPadding: () => {},
                clearSelection: () => {},
                fitKenya: () => {},
                select: () => {},
            });
            return () => h('div', { 'data-testid': 'map' });
        },
    }),
}));

import { router } from '@inertiajs/vue3';
import BackButton from '@/components/map/BackButton.vue';
import LeadersStrip from '@/components/map/LeadersStrip.vue';
import Legend from '@/components/map/Legend.vue';
import UnitPanel from '@/components/map/UnitPanel.vue';
import Map from '@/pages/Map.vue';
import { LEADERS_SEATS } from '../leadersFixtures';

const units = readFileSync(
    resolve(import.meta.dirname, '../../../public/boundaries/units.json'),
    'utf8',
);
const seats = {
    ...LEADERS_SEATS,
    totals: {
        governor: { UDA: 1, ODM: 1 },
        senator: { ODM: 1 },
        woman_rep: { ODM: 1 },
        mp: { ODM: 1, JP: 1 },
        mca: { ODM: 3, UDA: 2, IND: 1 },
    },
};

function fakeFetch(url: string) {
    const body = url.includes('units.json')
        ? units
        : url.includes('seats.json')
          ? JSON.stringify(seats)
          : url.includes('towns')
            ? '{"features":[]}'
            : '{}';
    return Promise.resolve(new Response(body, { status: 200 }));
}

const NAIROBI = { level: 'county', code: 47, name: 'Nairobi City' };
const MATHARE = { level: 'constituency', code: 290, name: 'Mathare' };
const at = {
    county: { ...NAIROBI, ancestors: [] },
    constituency: { ...MATHARE, ancestors: [NAIROBI] },
    ward: {
        level: 'ward',
        code: 1448,
        name: 'Ngei',
        ancestors: [MATHARE, NAIROBI],
    },
};

async function mountPage(search: string, unit: { name: string }) {
    window.history.replaceState({}, '', `/${search}`);
    const wrapper = mount(Map, {
        props: { unit: unit as never },
        attachTo: document.body,
    });
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe(unit.name));
    await flushPromises();
    return wrapper;
}
const strip = (w: Awaited<ReturnType<typeof mountPage>>) =>
    w.findComponent(LeadersStrip);
const seatsIn = (w: Awaited<ReturnType<typeof mountPage>>) =>
    strip(w)
        .findAll('[data-leader]')
        .map((r) => r.attributes('data-leader'));

describe('the legend’s "Leaders here" strip follows the focus', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(router.push).mockClear();
        vi.stubGlobal('fetch', vi.fn(fakeFetch));
        // happy-dom has no layout: a desktop, where the legend and the strip start open.
        window.matchMedia = ((q: string) => ({
            matches: q.includes('min-width'),
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
        })) as never;
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('lists the MP and the county-wide three for a constituency', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        expect(seatsIn(w)).toEqual(['mp', 'governor', 'senator', 'woman_rep']);
        expect(strip(w).text()).toContain('Placeholder mp 290');
        expect(strip(w).text()).toContain('Placeholder governor 47');
    });

    it('drops the finer seats as the focus steps up, and goes away at Kenya', async () => {
        const w = await mountPage('?seat=mca', at.ward);
        // The legend's one bar is this ward's MCA seat, so the strip leaves the MCA row out.
        expect(seatsIn(w)).toEqual(['mp', 'governor', 'senator', 'woman_rep']);
        await w.findComponent(BackButton).get('button').trigger('click');
        await flushPromises();
        expect(w.find('h1').text()).toBe('Mathare');
        expect(seatsIn(w)).toEqual(['mp', 'governor', 'senator', 'woman_rep']);
        await w.findComponent(BackButton).get('button').trigger('click');
        await flushPromises();
        expect(w.find('h1').text()).toBe('Nairobi City');
        expect(seatsIn(w)).toEqual(['governor', 'senator', 'woman_rep']);
        await w.findComponent(BackButton).get('button').trigger('click');
        await flushPromises();
        expect(w.find('h1').text()).toBe('Kenya');
        // No President is in the data, so there is nobody to list for Kenya.
        expect(strip(w).exists()).toBe(false);
    });

    it('leaves out the seat the legend already counts when that is one holder', async () => {
        const w = await mountPage('?seat=governor', at.county);
        expect(seatsIn(w)).toEqual(['senator', 'woman_rep']);
        const mp = await mountPage('?seat=mp', at.constituency);
        expect(seatsIn(mp)).toEqual(['governor', 'senator', 'woman_rep']);
        // Several MPs are counted for a county, so nothing is left out.
        const county = await mountPage('?seat=mp', at.county);
        expect(seatsIn(county)).toEqual(['governor', 'senator', 'woman_rep']);
    });

    it('shows the person in the panel when a name is pressed, without moving the focus', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        expect(w.findComponent(UnitPanel).props('highlightSeat')).toBe(
            undefined,
        );
        await strip(w).get('[data-leader="senator"] button').trigger('click');
        await flushPromises();
        expect(w.find('h1').text()).toBe('Mathare');
        expect(w.findComponent(UnitPanel).props('highlightSeat')).toBe(
            'senator',
        );
        expect(
            w
                .findComponent(UnitPanel)
                .get('[data-highlighted="true"]')
                .text(),
        ).toContain('Placeholder senator 47');
        expect(router.push).not.toHaveBeenCalled();
        expect(w.get('[aria-live="polite"].sr-only').text()).toContain(
            'Placeholder senator 47',
        );
    });

    it('names the sources of the leaders it lists in the box’s source line, not only the counted seats’', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        // Every record here is from IEBC or the gazette archive.
        expect(w.findComponent(Legend).props('note')).toContain(
            'Source: IEBC gazette notices, as of',
        );
        w.unmount();
        // A Governor whose record comes from elsewhere is in the strip, so that site is named.
        const original = seats.holders;
        seats.holders = original.map((h) =>
            h.seat === 'governor' && h.code === 47
                ? { ...h, source_url: 'https://www.the-star.co.ke/news/x' }
                : h,
        );
        try {
            const other = await mountPage('?seat=mca', at.constituency);
            expect(other.findComponent(Legend).props('note')).toContain(
                'Source: IEBC gazette notices and the-star.co.ke, as of',
            );
        } finally {
            seats.holders = original;
        }
    });

    it('caps the legend under the search bar, the chips and the back button, so the strip never runs under them', async () => {
        // A wide desktop: the chips sit beside the search bar (64px of controls), the back button
        // (52px) under them while a unit is focused, and the legend 24px off the bottom.
        const focused = await mountPage('?seat=mca', at.constituency);
        expect(focused.findComponent(Legend).props('maxHeight')).toBe(
            'calc(100dvh - 140px)',
        );
        await focused.findComponent(BackButton).get('button').trigger('click');
        await focused.findComponent(BackButton).get('button').trigger('click');
        await flushPromises();
        expect(focused.find('h1').text()).toBe('Kenya');
        expect(focused.findComponent(Legend).props('maxHeight')).toBe(
            'calc(100dvh - 88px)',
        );
    });
});
