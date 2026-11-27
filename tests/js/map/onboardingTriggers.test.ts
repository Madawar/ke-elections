import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: defineComponent({ render: () => null }),
    router: { replace: vi.fn(), push: vi.fn() },
}));
// The page, without a real map: it is the chips, the legend and the colour state that are under test.
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

vi.mock('@/components/export/ShareViewDialog.vue', () => ({
    default: defineComponent({
        props: { view: { type: Object, required: true } },
        render() {
            const v = this.view as {
                seat: string;
                scope: { name: string } | null;
            };
            return h('div', {
                'data-share-seat': v.seat,
                'data-share-scope': v.scope?.name,
            });
        },
    }),
}));

import Legend from '@/components/map/Legend.vue';
import MapControls from '@/components/map/MapControls.vue';
import SearchBox from '@/components/map/SearchBox.vue';
import Map from '@/pages/Map.vue';
import {
    TOUR_KEY,
    resetOnboardingState,
    setFlag,
    state,
    tipKey,
} from '@/lib/onboarding';

const units = readFileSync(
    resolve(import.meta.dirname, '../../../public/boundaries/units.json'),
    'utf8',
);
const holder = (seat: string, level: string, code: number, party: string) => ({
    seat,
    level,
    code,
    name: 'X',
    party,
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: 'https://example.org',
});
// Governor, MP and MCA seats have approved holders; the Senator and Woman Rep seats have none.
const seats = {
    as_of: '2026-11-01',
    data_as_of: '2026-11-01',
    parties: [
        {
            abbrev: 'AAA',
            name: 'Alpha',
            coalition_2022: null,
            colour: '#E69F00',
        },
        {
            abbrev: 'BBB',
            name: 'Beta',
            coalition_2022: null,
            colour: '#56B4E9',
        },
    ],
    holders: [
        holder('governor', 'county', 1, 'AAA'),
        holder('governor', 'county', 2, 'BBB'),
        holder('mp', 'constituency', 1, 'AAA'),
        holder('mp', 'constituency', 2, 'AAA'),
        holder('mp', 'constituency', 3, 'BBB'),
        holder('mca', 'ward', 1445, 'AAA'),
    ],
    totals: {
        governor: { AAA: 1, BBB: 1 },
        mp: { AAA: 2, BBB: 1 },
        mca: { AAA: 1 },
    },
    chambers: { national_assembly: { AAA: 2, BBB: 1 }, senate: {} },
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

async function mountPage(search = '', unit: object | null = null) {
    window.history.replaceState({}, '', `/${search}`);
    const wrapper = mount(Map, {
        props: { unit: unit as never },
        attachTo: document.body,
    });
    const name = (unit as { name?: string } | null)?.name ?? 'Kenya';
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe(name));
    await flushPromises();
    return wrapper;
}

const unitRow = (level: string, code: number) =>
    (JSON.parse(units) as { l: string; c: number }[]).find(
        (u) => u.l === level && u.c === code,
    )!;
const popover = () =>
    document.body.querySelector<HTMLElement>('[data-onboarding-popover]');
const tipText = async () => {
    await vi.waitFor(() => expect(popover()).not.toBeNull(), { timeout: 3000 });
    return popover()!.textContent ?? '';
};
/** Long enough for a tip that should have come to have come. */
const quiet = () => new Promise((r) => setTimeout(r, 700));

describe('the contextual tips are triggered by what the person does', () => {
    beforeEach(() => {
        localStorage.clear();
        resetOnboardingState();
        // The tour has been seen; the tips are what is under test.
        setFlag(TOUR_KEY);
        vi.stubGlobal('fetch', vi.fn(fakeFetch));
        window.matchMedia = ((q: string) => ({
            matches: false,
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
        })) as never;
        // No layout engine: every control with an onboarding anchor counts as on screen.
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
            function (this: Element) {
                const o = this.hasAttribute('data-onboarding');
                return {
                    left: 20,
                    top: 60,
                    width: o ? 100 : 0,
                    height: o ? 44 : 0,
                    right: 120,
                    bottom: 104,
                    x: 20,
                    y: 60,
                    toJSON: () => ({}),
                } as DOMRect;
            },
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('points at Share this view the first time a place is picked, once ever', async () => {
        const w = await mountPage('?seat=mp');
        w.findComponent(SearchBox).vm.$emit('pick', unitRow('county', 1));
        expect(await tipText()).toContain(
            'Share this view makes an image of exactly this. Sources included.',
        );
        expect(localStorage.getItem(tipKey('unit'))).toBe('1');
        // Closed, and a new session: the tip does not come back.
        (
            document.querySelector(
                '[data-onboarding-popover] button',
            ) as HTMLElement
        ).click();
        await flushPromises();
        state.tipShown = false;
        w.findComponent(SearchBox).vm.$emit('pick', unitRow('county', 2));
        await quiet();
        expect(popover()).toBeNull();
    });

    it('stays quiet for a link that opens on a unit, and until the tour is done', async () => {
        const w = await mountPage('?seat=mp', {
            level: 'county',
            code: 1,
            name: 'Mombasa',
            ancestors: [],
        });
        await quiet();
        expect(popover()).toBeNull();
        localStorage.removeItem(TOUR_KEY);
        resetOnboardingState();
        w.findComponent(SearchBox).vm.$emit('pick', unitRow('county', 2));
        await quiet();
        expect(popover()).toBeNull();
        expect(localStorage.getItem(tipKey('unit'))).toBeNull();
    });

    it('says how to clear the first party highlight', async () => {
        const w = await mountPage('?seat=mp');
        w.findComponent(Legend).vm.$emit('toggle', 'AAA');
        expect(await tipText()).toContain(
            'Showing only AAA. Tap again or Show all to clear.',
        );
    });

    it('explains the muted chips the first time a constituency is shown', async () => {
        setFlag(tipKey('unit'));
        const w = await mountPage('?seat=mp');
        w.findComponent(SearchBox).vm.$emit('pick', unitRow('constituency', 1));
        const text = await tipText();
        expect(text).toContain(
            'Governor, Senator and Woman Rep cover the whole county. Tap one to go back to ',
        );
        expect(localStorage.getItem(tipKey('muted-chip'))).toBe('1');
    });

    it('gives a fix-it line when location is denied, and when it fails', async () => {
        vi.stubGlobal('navigator', {
            ...navigator,
            geolocation: {
                getCurrentPosition: (_ok: unknown, fail: (e: object) => void) =>
                    fail({ code: 1, PERMISSION_DENIED: 1 }),
            },
        });
        const w = await mountPage();
        w.findComponent(MapControls).vm.$emit('locate');
        expect(await tipText()).toContain(
            'Location is off for this site. You can still search for your ward.',
        );
        expect(localStorage.getItem(tipKey('locate'))).toBe('1');
    });

    it('does not show a tip while the outside-tap hint is open', async () => {
        const w = await mountPage('?seat=mp');
        state.hintOpen = true;
        w.findComponent(Legend).vm.$emit('toggle', 'AAA');
        await quiet();
        expect(popover()).toBeNull();
        expect(localStorage.getItem(tipKey('party'))).toBeNull();
    });
});
