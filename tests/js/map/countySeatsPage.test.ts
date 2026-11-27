import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: defineComponent({ render: () => null }),
    router: { replace: vi.fn(), push: vi.fn() },
}));
// The page without a real map: the colouring it is given is what is under test.
vi.mock('@/components/map/MapView.vue', () => ({
    default: defineComponent({
        props: { colouring: { type: Object, required: true } },
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
// The share dialog, as what it was opened with.
vi.mock('@/components/export/ShareViewDialog.vue', () => ({
    default: defineComponent({
        props: {
            view: { type: Object, required: true },
            cards: { type: Array, default: () => [] },
        },
        render() {
            const v = this.view as { kind: string; unit?: { name: string } };
            const cards = this.cards as {
                key: string;
                label: string;
                view: { unit?: { name: string } };
            }[];
            const alt = cards.find((c) => c.key === 'leaders' && c.view !== v);
            return h('div', {
                'data-share-kind': v.kind,
                'data-share-unit': v.unit?.name,
                'data-share-offers': alt?.view.unit?.name,
                'data-share-cards': cards.map((c) => c.label).join('|'),
            });
        },
    }),
}));

import Legend from '@/components/map/Legend.vue';
import MapView from '@/components/map/MapView.vue';
import UnitPanel from '@/components/map/UnitPanel.vue';
import { coloursOf } from '@/lib/map/stripes';
import { THEMES } from '@/lib/map/theme';
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
const county = { ...NAIROBI, ancestors: [] };
const constituency = { ...MATHARE, ancestors: [NAIROBI] };

async function mountPage(search = '', unit: { name: string } | null = null) {
    window.history.replaceState({}, '', `/${search}`);
    const wrapper = mount(Map, {
        props: { unit: unit as never },
        attachTo: document.body,
    });
    await vi.waitFor(() =>
        expect(wrapper.find('h1').text()).toBe(unit?.name ?? 'Kenya'),
    );
    await flushPromises();
    return wrapper;
}
type Page = Awaited<ReturnType<typeof mountPage>>;
const chip = (w: Page, label: string) =>
    w.findAll('[role="radio"]').find((r) => r.text().startsWith(label))!;
const colouringOf = (w: Page) =>
    w.findComponent(MapView).props('colouring') as {
        mode: { kind: string };
        patterns?: Map<number, string>;
    };
const T = THEMES.light;

describe('the "County seats" view on the page', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn(fakeFetch));
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

    it('stripes the counties and shows its legend when the chip is pressed', async () => {
        const w = await mountPage();
        await chip(w, 'County seats').trigger('click');
        await flushPromises();
        expect(chip(w, 'County seats').attributes('aria-checked')).toBe('true');
        const col = colouringOf(w);
        expect(col.mode.kind).toBe('county_seats');
        // Nairobi City: a UDA Governor, an ODM Senator and an ODM Woman Rep, in that order.
        expect(coloursOf(col.patterns!.get(47)!)).toEqual([
            '#e8c547',
            '#e07b24',
            '#e07b24',
        ]);
        // Kilifi: a Governor only; the other two stripes are no-data.
        expect(coloursOf(col.patterns!.get(3)!)).toEqual([
            '#e07b24',
            T.noData.toLowerCase(),
            T.noData.toLowerCase(),
        ]);
        const legend = w.findComponent(Legend);
        expect(legend.props('title')).toBe('County seats across Kenya by party');
        expect(legend.props('note')).toContain(
            'Each county is striped by its Governor, Senator and Woman Rep.',
        );
        expect(
            legend.props('rows').map((r: { key: string; count: number }) => [
                r.key,
                r.count,
            ]),
        ).toEqual([
            ['ODM', 3],
            ['UDA', 1],
        ]);
    });

    it('opens from a link, and is remembered like any other choice', async () => {
        const w = await mountPage('?seat=county_seats');
        expect(colouringOf(w).mode.kind).toBe('county_seats');
        expect(chip(w, 'County seats').attributes('aria-checked')).toBe('true');
        // A link's seat is not a choice; pressing the chip is.
        expect(localStorage.getItem('km.colour')).toBeNull();
        await chip(w, 'None').trigger('click');
        await chip(w, 'County seats').trigger('click');
        expect(localStorage.getItem('km.colour')).toBe('county_seats');
    });

    it('fades the stripes of the parties that are not highlighted', async () => {
        const w = await mountPage('?seat=county_seats');
        w.findComponent(Legend).vm.$emit('toggle', 'UDA');
        await flushPromises();
        expect(coloursOf(colouringOf(w).patterns!.get(47)!)).toEqual([
            '#e8c547',
            T.faded.toLowerCase(),
            T.faded.toLowerCase(),
        ]);
        expect(w.findComponent(Legend).props('highlighted')).toEqual(['UDA']);
    });

    it('covers the focused county in its legend, and gives way to MCA inside a constituency', async () => {
        const w = await mountPage('?seat=county_seats', county);
        expect(w.findComponent(Legend).props('title')).toBe(
            'County seats in Nairobi City by party',
        );
        expect(colouringOf(w).mode.kind).toBe('county_seats');
        const inside = await mountPage('?seat=county_seats', constituency);
        // The link's seat means nothing inside a constituency: it is refused there.
        expect(colouringOf(inside).mode.kind).not.toBe('county_seats');
        expect(chip(inside, 'County seats').attributes('data-muted')).toBe(
            'true',
        );
    });

    it('has no card for all of Kenya, and shares a county as its leaders card', async () => {
        const kenya = await mountPage('?seat=county_seats');
        expect(kenya.findComponent(Legend).props('shareable')).toBe(false);
        const w = await mountPage('?seat=county_seats', county);
        expect(w.findComponent(Legend).props('shareable')).toBe(true);
        w.findComponent(Legend).vm.$emit('share');
        await flushPromises();
        const dialog = w.get('[data-share-kind]');
        expect(dialog.attributes('data-share-kind')).toBe('leaders');
        expect(dialog.attributes('data-share-unit')).toBe('Nairobi City');
        expect(dialog.attributes('data-share-offers')).toBeUndefined();
        expect(dialog.attributes('data-share-cards')).toBe('County leaders');
    });
});

describe('sharing the leaders of a unit', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn(fakeFetch));
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

    it('offers "County leaders" beside the view whenever a county is focused, whatever the seat mode', async () => {
        for (const seat of ['governor', 'mp', 'mca']) {
            const w = await mountPage(`?seat=${seat}`, county);
            w.findComponent(Legend).vm.$emit('share');
            await flushPromises();
            const dialog = w.get('[data-share-kind]');
            expect(dialog.attributes('data-share-kind'), seat).toBe('party');
            expect(dialog.attributes('data-share-offers'), seat).toBe(
                'Nairobi City',
            );
            expect(dialog.attributes('data-share-cards'), seat).toBe(
                'This view|County leaders',
            );
            w.unmount();
        }
    });

    it('offers the leaders of a constituency too, and nothing for all of Kenya', async () => {
        const w = await mountPage('?seat=mca', constituency);
        w.findComponent(Legend).vm.$emit('share');
        await flushPromises();
        expect(w.get('[data-share-kind]').attributes('data-share-offers')).toBe(
            'Mathare',
        );
        expect(w.get('[data-share-kind]').attributes('data-share-cards')).toBe(
            'This view|Leaders',
        );
        const kenya = await mountPage('?seat=mca');
        kenya.findComponent(Legend).vm.$emit('share');
        await flushPromises();
        expect(
            kenya.get('[data-share-kind]').attributes('data-share-offers'),
        ).toBeUndefined();
        expect(
            kenya.get('[data-share-kind]').attributes('data-share-cards'),
        ).toBe('This view|By the numbers');
    });

    it('opens the leaders card straight from the panel, with no seat colouring at all', async () => {
        const w = await mountPage('', constituency);
        expect(w.findComponent(Legend).exists()).toBe(false);
        await w
            .findComponent(UnitPanel)
            .get('[data-share-leaders]')
            .trigger('click');
        await flushPromises();
        const dialog = w.get('[data-share-kind]');
        expect(dialog.attributes('data-share-kind')).toBe('leaders');
        expect(dialog.attributes('data-share-unit')).toBe('Mathare');
        expect(dialog.attributes('data-share-cards')).toBe('Leaders');
    });
});
