// The map page's back button, history and outside-tap hint, with a stand-in for the map itself.
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
        setup(_p, { expose }) {
            expose({
                ready: false,
                setFocus: () => {},
                setShowSurroundings: () => {},
                setPadding: () => {},
                clearSelection: () => {},
                fitKenya: () => {},
                select: () => {},
                zoomOutStep: () => {},
            });
            return () => h('div', { 'data-testid': 'map' });
        },
    }),
}));

import { router } from '@inertiajs/vue3';
import BackButton from '@/components/map/BackButton.vue';
import MapView from '@/components/map/MapView.vue';
import OutsideHint from '@/components/map/OutsideHint.vue';
import { installPopStateGate } from '@/lib/map/history';
import Map from '@/pages/Map.vue';

// app.ts does this before Inertia starts.
installPopStateGate();

const units = readFileSync(
    resolve(import.meta.dirname, '../../../public/boundaries/units.json'),
    'utf8',
);
const fakeFetch = (url: string) =>
    Promise.resolve(
        new Response(
            url.includes('units.json')
                ? units
                : url.includes('seats.json')
                  ? JSON.stringify({
                        as_of: '2026-11-01',
                        data_as_of: '2026-11-01',
                        parties: [],
                        holders: [],
                        totals: {},
                        chambers: { national_assembly: {}, senate: {} },
                    })
                  : url.includes('towns')
                    ? '{"features":[]}'
                    : '{}',
            { status: 200 },
        ),
    );

const NAIROBI = { level: 'county', code: 47 };
const MATHARE = { level: 'constituency', code: 290 };
const HOSPITAL = { level: 'ward', code: 1445 };

type Wrapper = Awaited<ReturnType<typeof mountPage>>;
const mounted: { unmount(): void }[] = [];
async function mountPage(path = '/', unit: object | null = null) {
    window.history.replaceState({}, '', path);
    const wrapper = mount(Map, {
        props: { unit: unit as never },
        attachTo: document.body,
    });
    const name = (unit as { name?: string } | null)?.name ?? 'Kenya';
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe(name));
    await flushPromises();
    mounted.push(wrapper);
    return wrapper;
}
const pick = async (w: Wrapper, unit: { level: string; code: number }) => {
    w.findComponent(MapView).vm.$emit('select', unit);
    await flushPromises();
};
const back = (w: Wrapper) => w.find('[data-onboarding="back"]');
const title = (w: Wrapper) => w.find('h1').text();
const visits = (fn: unknown) =>
    (fn as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => (c[0] as { url: string }).url,
    );

beforeEach(() => {
    localStorage.clear();
    vi.mocked(router.push).mockClear();
    vi.mocked(router.replace).mockClear();
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
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
    // Each page listens for the browser's back button, so none may outlive its test.
    mounted.splice(0).forEach((w) => w.unmount());
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('the back button', () => {
    it('is hidden while nothing is focused', async () => {
        const w = await mountPage();
        expect(back(w).exists()).toBe(false);
    });

    it('names the parent at each level and steps up through them', async () => {
        const w = await mountPage();
        await pick(w, HOSPITAL);
        expect(back(w).attributes('aria-label')).toBe('Back to Mathare');
        await back(w).trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Mathare');
        expect(back(w).attributes('aria-label')).toBe('Back to Nairobi City');
        await back(w).trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
        expect(back(w).attributes('aria-label')).toBe('Back to All of Kenya');
        await back(w).trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Kenya');
        expect(back(w).exists()).toBe(false);
    });
});

describe('history', () => {
    it('pushes an entry for each unit the person chooses', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        await pick(w, HOSPITAL);
        expect(visits(router.push)).toEqual([
            '/county/47',
            '/constituency/290',
            '/ward/1445',
        ]);
        expect(router.replace).not.toHaveBeenCalledWith(
            expect.objectContaining({ url: expect.stringMatching(/ward/) }),
        );
    });

    it('pushes an entry for the back button, as for any step the person makes', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        vi.mocked(router.push).mockClear();
        await back(w).trigger('click');
        await flushPromises();
        expect(visits(router.push)).toEqual(['/county/47']);
    });

    it('replaces the current entry for a zoom-driven step up', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        vi.mocked(router.push).mockClear();
        w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
        await flushPromises();
        w.findComponent(MapView).vm.$emit('zoomOut', null);
        await flushPromises();
        expect(router.push).not.toHaveBeenCalled();
        expect(visits(router.replace)).toEqual(['/county/47', '/']);
    });

    it('puts the focus back when the browser goes back, and leaves Inertia out of it', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        window.history.replaceState({}, '', '/county/47');
        window.dispatchEvent(event);
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
        expect(stop).toHaveBeenCalled();
        // Restoring is not a new choice: nothing is pushed for it.
        expect(visits(router.push)).toEqual(['/county/47', '/constituency/290']);
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flushPromises();
        expect(title(w)).toBe('Kenya');
        expect(back(w).exists()).toBe(false);
    });

    it('leaves a popstate to another page alone', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        window.history.replaceState({}, '', '/dashboard');
        window.dispatchEvent(event);
        await flushPromises();
        expect(stop).not.toHaveBeenCalled();
        expect(title(w)).toBe('Nairobi City');
    });
});

describe('taps outside the focused unit', () => {
    const outside = async (w: Wrapper) => {
        w.findComponent(MapView).vm.$emit('outsideClick');
        await flushPromises();
    };

    it('does not step up, and shows the hint', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        vi.mocked(router.push).mockClear();
        await outside(w);
        expect(title(w)).toBe('Mathare');
        expect(router.push).not.toHaveBeenCalled();
        const hint = w.findComponent(OutsideHint);
        expect(hint.text()).toContain("You're viewing Mathare.");
        expect(hint.text()).toContain('Back to Nairobi City');
        // The hint is also said through the live region.
        expect(w.find('.sr-only[aria-live="polite"]').text()).toContain(
            "You're viewing Mathare.",
        );
    });

    it('steps up from the hint, same as the back button', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        await outside(w);
        await w
            .findComponent(OutsideHint)
            .findAll('button')[0]
            .trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
    });

    it('turns the surroundings on from the hint, and never shows it again', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        await outside(w);
        await w
            .findComponent(OutsideHint)
            .findAll('button')[1]
            .trigger('click');
        await flushPromises();
        expect(localStorage.getItem('kem.showSurroundings')).toBe('true');
        expect(w.find('button[role="switch"]').attributes('aria-checked')).toBe(
            'true',
        );
        await outside(w);
        expect(w.findComponent(OutsideHint).text()).toBe('');
    });

    it('does not nudge when the surroundings are already on', async () => {
        localStorage.setItem('kem.showSurroundings', 'true');
        const w = await mountPage();
        await pick(w, MATHARE);
        await outside(w);
        expect(w.findComponent(OutsideHint).text()).toBe('');
    });

    it('closes the hint on the next map tap that picks a unit', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await outside(w);
        expect(w.findComponent(OutsideHint).text()).not.toBe('');
        await pick(w, MATHARE);
        expect(w.findComponent(OutsideHint).text()).toBe('');
    });

    it('stops nudging for good after the back button is used', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        await back(w).trigger('click');
        await flushPromises();
        await pick(w, MATHARE);
        await outside(w);
        expect(w.findComponent(OutsideHint).text()).toBe('');
        expect(w.findComponent(BackButton).exists()).toBe(true);
    });
});
