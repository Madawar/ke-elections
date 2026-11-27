import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: defineComponent({ render: () => null }),
    router: { replace: vi.fn() },
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

import SeatChips from '@/components/map/SeatChips.vue';
import LayersPanel from '@/components/map/LayersPanel.vue';
import BottomSheet from '@/components/map/BottomSheet.vue';
import MapView from '@/components/map/MapView.vue';
import Legend from '@/components/map/Legend.vue';
import NationalOverview from '@/components/map/NationalOverview.vue';
import Map from '@/pages/Map.vue';

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
const checked = (w: Awaited<ReturnType<typeof mountPage>>) =>
    w
        .findAll('[role="radio"]')
        .filter((r) => r.attributes('aria-checked') === 'true')
        .map((r) => r.text());

describe('the seat chips and the legend share one colour mode', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn(fakeFetch));
        // happy-dom has no layout: pretend a phone, so the chips sit under the search bar.
        window.matchMedia = ((q: string) => ({
            matches: false,
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

    it('shows the chip row on first load, with None chosen and no legend', async () => {
        const w = await mountPage();
        expect(w.findComponent(SeatChips).exists()).toBe(true);
        expect(w.find('[data-onboarding="seat-chips"]').exists()).toBe(true);
        expect(w.findAll('[role="radio"]')).toHaveLength(6);
        expect(checked(w)).toEqual(['None']);
        expect(w.findComponent(Legend).exists()).toBe(false);
    });

    it('opens the legend for the seat when a chip is pressed', async () => {
        const w = await mountPage();
        await w.findAll('[role="radio"]')[4].trigger('click');
        expect(checked(w)).toEqual(['MP']);
        expect(w.findComponent(Legend).props('title')).toBe(
            'MP seats across Kenya by party',
        );
        await w.findAll('[role="radio"]')[1].trigger('click');
        expect(checked(w)).toEqual(['Governor']);
        expect(w.findComponent(Legend).props('title')).toBe(
            'Governor seats across Kenya by party',
        );
        await w.findAll('[role="radio"]')[0].trigger('click');
        expect(checked(w)).toEqual(['None']);
        expect(w.findComponent(Legend).exists()).toBe(false);
    });

    it('follows a deep link to a seat colouring', async () => {
        const w = await mountPage('?seat=governor');
        expect(checked(w)).toEqual(['Governor']);
        expect(w.findComponent(Legend).props('title')).toBe(
            'Governor seats across Kenya by party',
        );
    });

    it('follows a colour change made elsewhere, such as the national overview', async () => {
        const w = await mountPage();
        w.findComponent(NationalOverview).vm.$emit('colourBy', 'mp');
        await flushPromises();
        expect(checked(w)).toEqual(['MP']);
        expect(w.findComponent(Legend).props('title')).toBe(
            'MP seats across Kenya by party',
        );
    });

    it('follows the map settings panel, which keeps only the former-province tint', async () => {
        const w = await mountPage();
        await w
            .findAll('button')
            .find((b) => b.text().includes('Map'))!
            .trigger('click');
        await flushPromises();
        const panel = w.findComponent(LayersPanel);
        expect(panel.exists()).toBe(true);
        // The panel no longer offers any seat colouring or party highlight of its own.
        expect(panel.text()).not.toContain('Colour the map by');
        const province = panel
            .findAll('input[type="checkbox"]')
            .find((i) =>
                i.element
                    .closest('label')
                    ?.textContent?.includes('Former provinces'),
            )!;
        await province.setValue(true);
        // Provinces have no chip, so none is chosen, and the legend is the province key.
        expect(checked(w)).toEqual([]);
        expect(w.findComponent(Legend).props('title')).toMatch(/province/i);
        // Choosing a chip takes the tint off again.
        await w.findAll('[role="radio"]')[1].trigger('click');
        expect(checked(w)).toEqual(['Governor']);
        expect(
            (panel.find('input[type="checkbox"]').element as HTMLInputElement)
                .checked,
        ).toBe(false);
    });

    it('does not let a seat with no approved data be chosen', async () => {
        const w = await mountPage();
        const senator = w.findAll('[role="radio"]')[2];
        expect(senator.attributes('aria-disabled')).toBe('true');
        await senator.trigger('click');
        expect(checked(w)).toEqual(['None']);
    });

    it('hides the chip row while the sheet is at full height, and brings it back after', async () => {
        const w = await mountPage();
        w.findComponent(BottomSheet).vm.$emit('update:snap', 'full');
        await flushPromises();
        expect(w.find('[role="radiogroup"]').exists()).toBe(false);
        w.findComponent(BottomSheet).vm.$emit('update:snap', 'half');
        await flushPromises();
        expect(w.find('[role="radiogroup"]').exists()).toBe(true);
    });

    describe('the seat mode follows the focus level', () => {
        const NAIROBI = { level: 'county', code: 47 };
        const MATHARE = { level: 'constituency', code: 290 };
        const HOSPITAL = { level: 'ward', code: 1445 };
        const pick = async (
            w: Awaited<ReturnType<typeof mountPage>>,
            unit: { level: string; code: number },
        ) => {
            w.findComponent(MapView).vm.$emit('select', unit);
            await flushPromises();
        };
        const chip = (w: Awaited<ReturnType<typeof mountPage>>, name: string) =>
            w
                .findAll('[role="radio"]')
                .find((r) => r.find('[data-chip-label]').text() === name)!;
        const title = (w: Awaited<ReturnType<typeof mountPage>>) =>
            w.find('h1').text();

        it('keeps Governor at a county, switches to MCA in a constituency and mutes the county-wide chips', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, NAIROBI);
            expect(checked(w)).toEqual(['Governor']);
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MCA']);
            expect(chip(w, 'Governor').attributes('data-muted')).toBe('true');
            expect(chip(w, 'Governor').text()).toContain('County-wide');
            expect(chip(w, 'Governor').attributes('aria-label')).toBe(
                'Governor — county-wide seat; go back to Nairobi City to see it',
            );
            expect(w.findComponent(Legend).props('title')).toMatch(
                /^MCA seats/,
            );
        });

        it('shows MCA in a ward', async () => {
            const w = await mountPage();
            await pick(w, NAIROBI);
            await chip(w, 'Governor').trigger('click');
            await pick(w, MATHARE);
            await pick(w, HOSPITAL);
            expect(checked(w)).toEqual(['MCA']);
            expect(chip(w, 'MP').attributes('data-muted')).toBe('true');
        });

        it('steps up to the county and shows the seat when a muted chip is pressed', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, NAIROBI);
            await pick(w, MATHARE);
            expect(title(w)).toBe('Mathare');
            await chip(w, 'Governor').trigger('click');
            await flushPromises();
            expect(title(w)).toBe('Nairobi City');
            expect(checked(w)).toEqual(['Governor']);
            expect(w.findAll('[data-muted="true"]')).toHaveLength(0);
        });

        it('steps a ward up to its constituency for MP', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, HOSPITAL);
            expect(checked(w)).toEqual(['MCA']);
            await chip(w, 'MP').trigger('click');
            await flushPromises();
            expect(title(w)).toBe('Mathare');
            expect(checked(w)).toEqual(['MP']);
        });

        it('brings Governor back when the person steps back out', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, NAIROBI);
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MCA']);
            // Zooming out steps the focus up (the map reports it).
            w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
            await flushPromises();
            expect(checked(w)).toEqual(['Governor']);
            w.findComponent(MapView).vm.$emit('zoomOut', null);
            await flushPromises();
            expect(checked(w)).toEqual(['Governor']);
        });

        it('remembers a choice made inside a constituency', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, NAIROBI);
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MCA']);
            // MP is a seat that fits a constituency: it can be chosen, and is remembered there.
            expect(chip(w, 'MP').attributes('data-muted')).toBeUndefined();
            await chip(w, 'MP').trigger('click');
            expect(checked(w)).toEqual(['MP']);
            w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
            await flushPromises();
            expect(checked(w)).toEqual(['Governor']);
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MP']);
        });

        it('opens a constituency link with a county seat as MCA, and keeps Governor for the county', async () => {
            const w = await mountPage('?seat=governor', {
                level: 'constituency',
                code: 290,
                name: 'Mathare',
                ancestors: [
                    { level: 'county', code: 47, name: 'Nairobi City' },
                ],
            });
            expect(title(w)).toBe('Mathare');
            expect(checked(w)).toEqual(['MCA']);
            expect(w.findComponent(Legend).props('title')).toMatch(
                /^MCA seats/,
            );
            w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
            await flushPromises();
            expect(checked(w)).toEqual(['Governor']);
        });

        const openSettings = async (
            w: Awaited<ReturnType<typeof mountPage>>,
        ) => {
            await w
                .findAll('button')
                .find((b) => b.text().includes('Map'))!
                .trigger('click');
            await flushPromises();
            return w.findComponent(LayersPanel);
        };

        it('does not let the former-province tint be switched on below a county', async () => {
            const w = await mountPage();
            await pick(w, MATHARE);
            const panel = await openSettings(w);
            const label = panel
                .findAll('label')
                .find((l) => l.text().includes('Former provinces'))!;
            expect(label.find('input').attributes('disabled')).toBeDefined();
            expect(label.text()).toContain('Available for Kenya and counties');
            await label.find('input').setValue(true);
            // Still None: no province tint and no "Former provinces" legend for one constituency.
            expect(checked(w)).toEqual(['None']);
            expect(w.findComponent(Legend).exists()).toBe(false);
        });

        it('turns the tint back on for Kenya and counties', async () => {
            const w = await mountPage();
            await pick(w, NAIROBI);
            const panel = await openSettings(w);
            const box = panel
                .findAll('label')
                .find((l) => l.text().includes('Former provinces'))!
                .find('input');
            expect(box.attributes('disabled')).toBeUndefined();
            await box.setValue(true);
            expect(checked(w)).toEqual([]);
            expect(w.findComponent(Legend).props('title')).toMatch(/province/i);
        });

        it('keeps a mode that does not fit the focus from being chosen at all', async () => {
            const w = await mountPage();
            await pick(w, MATHARE);
            // The national overview and the share link can ask for any mode; the page refuses
            // the ones that mean nothing inside a constituency.
            w.findComponent(MapView).vm.$emit('zoomOut', null);
            await flushPromises();
            w.findComponent(NationalOverview).vm.$emit('colourBy', 'governor');
            await flushPromises();
            expect(checked(w)).toEqual(['Governor']);
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MCA']);
            const panel = await openSettings(w);
            // Even if the panel is driven directly, province is refused here.
            panel.vm.$emit('update:colour', 'province');
            await flushPromises();
            expect(checked(w)).toEqual(['MCA']);
        });

        it('restores the tint, when it was chosen at county level, after stepping back out', async () => {
            const w = await mountPage();
            await pick(w, NAIROBI);
            const panel = await openSettings(w);
            await panel
                .findAll('label')
                .find((l) => l.text().includes('Former provinces'))!
                .find('input')
                .setValue(true);
            await pick(w, MATHARE);
            // Inside the constituency the tint is dropped for the mode that fits.
            expect(checked(w)).toEqual(['None']);
            expect(w.findComponent(Legend).exists()).toBe(false);
            w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
            await flushPromises();
            expect(w.findComponent(Legend).props('title')).toMatch(/province/i);
        });

        it('shares the seat that fits the unit, never a county-wide seat for a constituency', async () => {
            const w = await mountPage();
            await chip(w, 'Governor').trigger('click');
            await pick(w, MATHARE);
            expect(checked(w)).toEqual(['MCA']);
            await w
                .findAll('button')
                .find((b) => b.text() === 'Share this view')!
                .trigger('click');
            await flushPromises();
            const dialog = w.find('[data-share-seat]');
            expect(dialog.attributes('data-share-seat')).toBe('mca');
            expect(dialog.attributes('data-share-scope')).toBe('Mathare');
        });
    });
});
