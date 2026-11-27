// The map page's back button, history and outside-tap hint, with a stand-in for the map itself.
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

const mapApi = vi.hoisted(() => ({ select: vi.fn(), fitKenya: vi.fn() }));
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
                fitKenya: mapApi.fitKenya,
                select: mapApi.select,
                zoomOutStep: () => {},
            });
            return () => h('div', { 'data-testid': 'map' });
        },
    }),
}));

import { router } from '@inertiajs/vue3';
import BackButton from '@/components/map/BackButton.vue';
import BottomSheet from '@/components/map/BottomSheet.vue';
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
// A small browser history behind the mocked router and history.back(): entries and a position.
let entries: string[] = ['/'];
let at = 0;
const setLocation = (path: string) => window.history.replaceState({}, '', path);
/** The browser (the phone's back gesture, forward, history.back()) moves to another entry. */
function browserGo(to: number, event = new PopStateEvent('popstate')) {
    at = to;
    setLocation(entries[at]);
    window.dispatchEvent(event);
}
async function mountPage(path = '/', unit: object | null = null) {
    entries = [path];
    at = 0;
    setLocation(path);
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
    vi.mocked(router.push).mockReset();
    vi.mocked(router.replace).mockReset();
    vi.mocked(router.push).mockImplementation((({ url }: { url: string }) => {
        entries.splice(at + 1);
        entries.push(url);
        at++;
        setLocation(url);
    }) as never);
    vi.mocked(router.replace).mockImplementation((({ url }: { url: string }) => {
        entries[at] = url;
        setLocation(url);
    }) as never);
    vi.spyOn(window.history, 'back').mockImplementation(() => {
        if (at > 0) browserGo(at - 1);
    });
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
    vi.mocked(window.history.back).mockRestore();
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

    it('goes back, not forward, when the Back button steps up to the previous entry', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        vi.mocked(router.push).mockClear();
        await back(w).trigger('click');
        await flushPromises();
        expect(router.push).not.toHaveBeenCalled();
        expect(title(w)).toBe('Nairobi City');
        expect(at).toBe(1);
        expect(entries).toEqual(['/', '/county/47', '/constituency/290']);
        // The phone's Back now reaches Kenya, and one more would leave the site.
        browserGo(0);
        await flushPromises();
        expect(title(w)).toBe('Kenya');
        expect(at).toBe(0);
        expect(window.history.back).toHaveBeenCalledTimes(1);
    });

    it('pushes the Back button’s step up when the previous entry is not the parent (a deep link)', async () => {
        const w = await mountPage('/constituency/290', {
            level: 'constituency',
            code: 290,
            name: 'Mathare',
            ancestors: [],
        });
        await back(w).trigger('click');
        await flushPromises();
        expect(visits(router.push)).toEqual(['/county/47']);
        expect(window.history.back).not.toHaveBeenCalled();
        expect(entries).toEqual(['/constituency/290', '/county/47']);
    });

    it('zooming out of a unit to the previous entry goes back, and does not move the camera', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        mapApi.select.mockClear();
        vi.mocked(router.push).mockClear();
        w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
        await flushPromises();
        expect(window.history.back).toHaveBeenCalledTimes(1);
        expect(router.push).not.toHaveBeenCalled();
        expect(title(w)).toBe('Nairobi City');
        expect(at).toBe(1);
        // Neither the zoom's step up nor the entry it went back to re-fits the camera.
        expect(mapApi.select).toHaveBeenCalled();
        for (const call of mapApi.select.mock.calls)
            expect(call[2]).toMatchObject({ fit: false });
    });

    it('replaces the current entry for a zoom-driven step up to a unit that is not the previous entry', async () => {
        const w = await mountPage();
        await pick(w, MATHARE);
        vi.mocked(router.push).mockClear();
        w.findComponent(MapView).vm.$emit('zoomOut', NAIROBI);
        await flushPromises();
        expect(router.push).not.toHaveBeenCalled();
        expect(window.history.back).not.toHaveBeenCalled();
        expect(visits(router.replace)).toEqual(['/county/47']);
        expect(entries).toEqual(['/', '/county/47']);
        // Zooming on out to Kenya is now the previous entry: Back, not [/, 47, /].
        w.findComponent(MapView).vm.$emit('zoomOut', null);
        await flushPromises();
        expect(window.history.back).toHaveBeenCalledTimes(1);
        expect(at).toBe(0);
        expect(title(w)).toBe('Kenya');
    });

    it('puts the focus back when the browser goes back, and leaves Inertia out of it', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        browserGo(1, event);
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
        expect(stop).toHaveBeenCalled();
        // Restoring is not a new choice: nothing is pushed for it.
        expect(visits(router.push)).toEqual(['/county/47', '/constituency/290']);
        browserGo(0);
        await flushPromises();
        expect(title(w)).toBe('Kenya');
        expect(back(w).exists()).toBe(false);
    });

    it('restores the unit again on forward after back', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        await back(w).trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
        browserGo(2);
        await flushPromises();
        expect(title(w)).toBe('Mathare');
        // And Back still goes back rather than pushing.
        await back(w).trigger('click');
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
        expect(window.history.back).toHaveBeenCalledTimes(2);
    });

    it('leaves a popstate to another page alone', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        entries[0] = '/dashboard';
        browserGo(0, event);
        await flushPromises();
        expect(stop).not.toHaveBeenCalled();
        expect(title(w)).toBe('Nairobi City');
    });

    it('does not keep the popstate gate after the page unmounts before its data arrived', async () => {
        let release: () => void = () => {};
        const held = new Promise<void>((r) => (release = r));
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                await held;
                return fakeFetch(url);
            }),
        );
        window.history.replaceState({}, '', '/county/47');
        const wrapper = mount(Map, { props: { unit: null }, attachTo: document.body });
        wrapper.unmount();
        release();
        await flushPromises();
        await new Promise((r) => setTimeout(r, 20));
        const later = vi.fn();
        window.addEventListener('popstate', later);
        vi.mocked(router.replace).mockClear();
        entries = ['/'];
        at = 0;
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.removeEventListener('popstate', later);
        expect(later).toHaveBeenCalledTimes(1);
        expect(router.replace).not.toHaveBeenCalled();
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

describe('where the hint sits', () => {
    const media = (desktop: boolean) =>
        (window.matchMedia = ((q: string) => ({
            matches: desktop && q.includes('min-width: 768px'),
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
        })) as never);
    const slot = (w: Wrapper) =>
        w.get('[data-testid="outside-hint-slot"]');

    it('docks above the bottom sheet on a phone, clear of the zoom controls and off the unit', async () => {
        media(false);
        const w = await mountPage();
        await pick(w, MATHARE);
        w.findComponent(BottomSheet).vm.$emit('height', 200);
        await flushPromises();
        const el = slot(w);
        // 12px above the sheet, and 72px kept free on the right for the zoom stack.
        expect(el.attributes('style')).toContain('bottom: 212px');
        expect(el.classes()).toContain('right-[72px]');
        expect(el.classes()).toContain('left-3');
        expect(el.classes()).not.toContain('top-[116px]');
    });

    it('stays beside the back button from md up', async () => {
        media(true);
        const w = await mountPage();
        await pick(w, MATHARE);
        const el = slot(w);
        expect(el.attributes('style') ?? '').not.toContain('bottom');
        expect(el.classes()).toContain('md:top-[168px]');
        expect(el.classes()).toContain('md:left-[400px]');
        expect(el.classes()).toContain('md:right-auto');
    });
});
