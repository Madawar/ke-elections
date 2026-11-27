import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

vi.mock('@inertiajs/vue3', () => ({
    Head: defineComponent({ render: () => null }),
    router: { replace: vi.fn(), push: vi.fn() },
}));
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
vi.mock('@/components/export/ShareViewDialog.vue', () => ({
    default: defineComponent({
        props: { view: { type: Object, required: true } },
        render() {
            const v = this.view as { outline?: boolean; onlyMp?: string[]; mpLine?: string | null };
            return h('div', {
                'data-share-outline': String(v.outline),
                'data-share-only-mp': (v.onlyMp ?? []).join(','),
                'data-share-mp-line': v.mpLine ?? '',
            });
        },
    }),
}));

import BackButton from '@/components/map/BackButton.vue';
import LayersPanel from '@/components/map/LayersPanel.vue';
import Legend from '@/components/map/Legend.vue';
import MapView from '@/components/map/MapView.vue';
import { buildLegend } from '@/lib/legend';
import { THEMES } from '@/lib/map/theme';
import { legendScope, withIndependentColour } from '@/lib/seats';
import { UnitIndex } from '@/lib/units';
import Map from '@/pages/Map.vue';
import { LEADERS_SEATS, holder } from '../leadersFixtures';

const units = readFileSync(
    resolve(import.meta.dirname, '../../../public/boundaries/units.json'),
    'utf8',
);
const seats = {
    ...LEADERS_SEATS,
    // A second MP in Nairobi City, of another party (Starehe, 289, is JP in the fixture).
    holders: [...LEADERS_SEATS.holders, holder('mp', 'constituency', 288, 'ODM')],
    totals: {
        governor: { UDA: 1, ODM: 1 },
        senator: { ODM: 1 },
        woman_rep: { ODM: 1 },
        mp: { ODM: 2, JP: 1 },
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
    ward: { level: 'ward', code: 1448, name: 'Ngei', ancestors: [MATHARE, NAIROBI] },
};
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
type Row = { key: string; count: number };
const colouringOf = (w: Page) =>
    w.findComponent(MapView).props('colouring') as {
        mode: { kind: string; seat?: string };
        colours: globalThis.Map<number, string>;
        outline?: {
            colours: globalThis.Map<number, string>;
            badges: globalThis.Map<number, string>;
        };
        names?: globalThis.Map<number, string>;
    };
const legendOf = (w: Page) => w.findComponent(Legend);
const T = THEMES.light;

describe('MP outlines over the MCA wards, on the page', () => {
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

    it('outlines each constituency in its MP’s colour in the MCA view, with the ward fills unchanged', async () => {
        const w = await mountPage('?seat=mca', at.county);
        const col = colouringOf(w);
        expect(col.mode).toEqual({ kind: 'seat', seat: 'mca' });
        expect(col.colours.get(1448)).toBe('#e07b24');
        expect(col.outline?.colours.get(290)).toBe('#e07b24');
        expect(col.outline?.colours.get(289)).toBe('#c8323c');
        expect(col.outline?.badges.get(289)).toBe('MP: JP');
    });

    it('has no outlines in any other view', async () => {
        for (const seat of ['mp', 'governor', 'county_seats']) {
            const w = await mountPage(`?seat=${seat}`, at.county);
            expect(colouringOf(w).outline, seat).toBeUndefined();
            expect(legendOf(w).props('outline'), seat).toBeFalsy();
            w.unmount();
        }
    });

    it('shows two legend lists whose counts equal the separate MP and MCA legends for the same scope', async () => {
        const w = await mountPage('?seat=mca', at.county);
        const legend = legendOf(w);
        expect(legend.props('outline').title).toBe('MPs (outline)');
        expect(legend.props('fillTitle')).toBe('MCAs (fill)');
        const index = UnitIndex.fromRows(JSON.parse(units));
        const themed = withIndependentColour(seats as never, T.independent);
        const separate = (seat: 'mp' | 'mca') => {
            const scope = legendScope(index, seat, { level: 'county', code: 47 })!;
            return buildLegend(
                themed,
                seat,
                { codes: scope.codes, unitName: scope.unit.n },
                [],
            ).rows.map((r) => [r.key, r.count]);
        };
        const rows = (list: Row[]) => list.map((r) => [r.key, r.count]);
        expect(rows(legend.props('outline').rows)).toEqual(separate('mp'));
        expect(rows(legend.props('rows'))).toEqual(separate('mca'));
        expect(rows(legend.props('outline').rows)).toEqual([
            ['ODM', 2],
            ['JP', 1],
        ]);
        // The heading still names the fills' seat and scope.
        expect(legend.props('title')).toBe('MCA seats in Nairobi City by party');
    });

    it('highlights the outlines on their own: the other parties’ outlines fade, the fills stay', async () => {
        const w = await mountPage('?seat=mca', at.county);
        legendOf(w).vm.$emit('toggleOutline', 'JP');
        await flushPromises();
        const col = colouringOf(w);
        expect(col.outline?.colours.get(289)).toBe('#c8323c');
        expect(col.outline?.colours.get(290)).toBe(T.faded);
        expect(col.colours.get(1448)).toBe('#e07b24');
        expect(legendOf(w).props('outline').highlighted).toEqual(['JP']);
        expect(legendOf(w).props('highlighted')).toEqual([]);
        // ... and the fills' rows fade the fills, leaving the outlines as they are.
        legendOf(w).vm.$emit('toggle', 'UDA');
        await flushPromises();
        expect(colouringOf(w).colours.get(1448)).toBe(T.faded);
        expect(colouringOf(w).outline?.colours.get(289)).toBe('#c8323c');
    });

    it('offers "Show all" for an outline highlight too, and clears both', async () => {
        const w = await mountPage('?seat=mca', at.county);
        expect(legendOf(w).props('filtered')).toBe(false);
        legendOf(w).vm.$emit('toggleOutline', 'JP');
        await flushPromises();
        expect(legendOf(w).props('filtered')).toBe(true);
        legendOf(w).vm.$emit('toggle', 'UDA');
        await flushPromises();
        legendOf(w).vm.$emit('clear');
        await flushPromises();
        expect(legendOf(w).props('filtered')).toBe(false);
        expect(colouringOf(w).outline?.colours.get(290)).toBe('#e07b24');
        expect(colouringOf(w).colours.get(1448)).toBe('#e07b24');
    });

    it('covers only the focused constituency’s MP, and has no outline list for a focused ward', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        expect(
            legendOf(w)
                .props('outline')
                .rows.map((r: Row) => [r.key, r.count]),
        ).toEqual([['ODM', 1]]);
        const ward = await mountPage('?seat=mca', at.ward);
        expect(colouringOf(ward).outline).toBeUndefined();
        expect(legendOf(ward).props('outline')).toBeFalsy();
        // Stepping back out to the constituency brings the outlines back.
        await ward.findComponent(BackButton).get('button').trigger('click');
        await flushPromises();
        expect(colouringOf(ward).outline?.colours.get(290)).toBe('#e07b24');
    });

    it('turns the outlines off from the map settings, and remembers it', async () => {
        const w = await mountPage('?seat=mca', at.county);
        await w
            .findAll('button')
            .find((b) => b.text().includes('Map'))!
            .trigger('click');
        await flushPromises();
        const panel = w.findComponent(LayersPanel);
        expect(panel.props('mpOutlines')).toBe(true);
        await panel.get('input[data-mp-outlines]').setValue(false);
        await flushPromises();
        expect(colouringOf(w).outline).toBeUndefined();
        expect(legendOf(w).props('outline')).toBeFalsy();
        expect(localStorage.getItem('kem.mpOutlines')).toBe('false');
        w.unmount();
        const again = await mountPage('?seat=mca', at.county);
        expect(colouringOf(again).outline).toBeUndefined();
    });

    it('gives each ward’s label its MCA’s name, exactly as the data spells it, in the MCA view only', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        const names = colouringOf(w).names!;
        expect(names.get(1448)).toBe('Placeholder mca 1448 (ODM)');
        // Kiamaiko has no approved MCA: it shows its name alone.
        expect(names.has(1450)).toBe(false);
        const mp = await mountPage('?seat=mp', at.county);
        expect(colouringOf(mp).names).toBeUndefined();
    });

    it('names a ward’s MCA in its hover tooltip, in the MCA view only', async () => {
        const w = await mountPage('?seat=mca', at.constituency);
        const tooltip = async (page: Page, code: number) => {
            page.findComponent(MapView).vm.$emit(
                'hover',
                { level: 'ward', code },
                { x: 10, y: 10 },
            );
            await flushPromises();
            return page.get('.pointer-events-none.z-30').text();
        };
        expect(await tooltip(w, 1448)).toBe(
            'Ngei ward. MCA: Placeholder mca 1448 (ODM)',
        );
        // A ward with no approved MCA shows its name alone: nothing is invented.
        expect(await tooltip(w, 1450)).toBe('Kiamaiko ward');
        const mp = await mountPage('?seat=mp', at.county);
        expect(await tooltip(mp, 1448)).toBe('Ngei ward');
    });

    it('shares the view with its outlines, their highlight and the county’s MPs line', async () => {
        const w = await mountPage('?seat=mca', at.county);
        legendOf(w).vm.$emit('toggleOutline', 'JP');
        await flushPromises();
        legendOf(w).vm.$emit('share');
        await flushPromises();
        const dialog = w.get('[data-share-outline]');
        expect(dialog.attributes('data-share-outline')).toBe('true');
        expect(dialog.attributes('data-share-only-mp')).toBe('JP');
        expect(dialog.attributes('data-share-mp-line')).toBe(
            'MPs (outlines): ODM 2, JP 1',
        );
    });
});
