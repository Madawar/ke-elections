import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AboutSheet from '@/components/map/AboutSheet.vue';
import OutsideHint from '@/components/map/OutsideHint.vue';
import Onboarding from '@/components/map/Onboarding.vue';
import {
    TOUR_KEY,
    TOUR_STEPS,
    isSet,
    resetOnboardingState,
    setFlag,
    state,
} from '@/lib/onboarding';

const NAMES = [
    'search',
    'map',
    'seat-chips',
    'legend',
    'locate',
    'share-view',
] as const;

/** Anchors on a page with no layout engine: each gets a box, so it counts as on screen. */
function addAnchors(names: readonly string[] = NAMES) {
    for (const [i, name] of names.entries()) {
        const el = document.createElement('button');
        el.setAttribute('data-onboarding', name);
        el.textContent = name;
        el.style.cssText = `top:${20 + i * 60}px`;
        document.body.appendChild(el);
    }
}
beforeEach(() => {
    localStorage.clear();
    resetOnboardingState();
    vi.useFakeTimers();
    window.innerWidth = 390;
    window.innerHeight = 844;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: Element) {
            const o = this.hasAttribute('data-onboarding');
            return {
                left: 20,
                top: o ? Number.parseInt((this as HTMLElement).style.top) : 0,
                width: o ? 100 : 0,
                height: o ? 44 : 0,
                right: 120,
                bottom: 0,
                x: 20,
                y: 0,
                toJSON: () => ({}),
            } as DOMRect;
        },
    );
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

const mountTour = (props = {}) =>
    mount(Onboarding, {
        props: { settleMs: 0, ...props },
        attachTo: document.body,
    });
type Tour = ReturnType<typeof mountTour>;
type Api = {
    startTour: () => boolean;
    restartTour: () => boolean;
    showTip: (id: string, ctx?: object) => Promise<boolean>;
    busy: () => boolean;
};
const api = (w: Tour) => w.vm as unknown as Api;
const popover = () =>
    document.body.querySelector<HTMLElement>('[role="dialog"]');
const button = (label: string) =>
    [...(popover()?.querySelectorAll('button') ?? [])].find(
        (b) => b.textContent?.trim() === label,
    );
const press = async (label: string) => {
    button(label)!.click();
    await flushPromises();
};
const text = () => popover()?.textContent ?? '';

describe('the first-visit tour', () => {
    it('opens on a first visit, non-modal, on step 1 of 6, with focus inside', async () => {
        addAnchors();
        const w = mountTour();
        expect(api(w).startTour()).toBe(true);
        await flushPromises();
        const p = popover()!;
        expect(p.getAttribute('aria-modal')).toBe('false');
        expect(text()).toContain(
            'Find any county, constituency, ward, politician or party by name.',
        );
        expect(text()).toContain('1 of 6');
        expect(p.contains(document.activeElement)).toBe(true);
        expect(button('Next')).toBeTruthy();
        expect(button('Skip')).toBeTruthy();
        w.unmount();
    });

    it('walks the six steps in order and ends with Done, which sets the flag', async () => {
        addAnchors();
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        const seen: string[] = [];
        for (let i = 0; i < 5; i++) {
            seen.push(text());
            expect(text()).toContain(`${i + 1} of 6`);
            await press('Next');
        }
        seen.push(text());
        expect(text()).toContain('6 of 6');
        expect(button('Next')).toBeUndefined();
        expect(seen[0]).toContain('Find any county');
        expect(seen[1]).toContain('Tap a county, then tap again');
        expect(seen[2]).toContain('Colour the map by who holds each seat');
        expect(seen[3]).toContain('Tap a party to show only its seats');
        expect(seen[4]).toContain("See the ward you're in.");
        expect(seen[4]).toContain('Your location stays on your phone.');
        expect(seen[5]).toContain('Share what you see as an image');
        expect(isSet(TOUR_KEY)).toBe(false);
        await press('Done');
        expect(popover()).toBeNull();
        expect(localStorage.getItem(TOUR_KEY)).toBe('1');
        w.unmount();
    });

    it('is skipped for good with Skip', async () => {
        addAnchors();
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        await press('Skip');
        expect(popover()).toBeNull();
        expect(localStorage.getItem(TOUR_KEY)).toBe('1');
        expect(api(w).startTour()).toBe(false);
        w.unmount();
    });

    it('closes on Escape, and the focus goes back to the control', async () => {
        addAnchors();
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flushPromises();
        expect(popover()).toBeNull();
        expect(localStorage.getItem(TOUR_KEY)).toBe('1');
        expect(document.activeElement).toBe(
            document.querySelector('[data-onboarding="search"]'),
        );
        w.unmount();
    });

    it('does not show once the flag is set', async () => {
        addAnchors();
        setFlag(TOUR_KEY);
        const w = mountTour();
        expect(api(w).startTour()).toBe(false);
        await flushPromises();
        expect(popover()).toBeNull();
        w.unmount();
    });

    it('"Show tips again" starts it over', async () => {
        addAnchors();
        setFlag(TOUR_KEY);
        const w = mountTour();
        expect(api(w).restartTour()).toBe(true);
        await flushPromises();
        expect(text()).toContain('1 of 6');
        expect(localStorage.getItem(TOUR_KEY)).toBeNull();
        w.unmount();
    });

    it('with storage blocked, shows once per page load', async () => {
        addAnchors();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const w = mountTour();
        expect(api(w).startTour()).toBe(true);
        await flushPromises();
        await press('Skip');
        expect(api(w).startTour()).toBe(false);
        w.unmount();
        const again = mountTour();
        expect(api(again).startTour()).toBe(false);
        again.unmount();
    });

    it('skips a step whose control is absent, and counts only the steps it shows', async () => {
        addAnchors(['search', 'seat-chips', 'locate']);
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        expect(text()).toContain('1 of ');
        const shown: string[] = [text()];
        while (button('Next')) {
            await press('Next');
            shown.push(text());
        }
        // No map and no share control: those two steps are not shown. The legend step, with no
        // legend, points at the chips instead.
        expect(shown.some((s) => s.includes('Tap a county'))).toBe(false);
        expect(shown.some((s) => s.includes('Share what you see'))).toBe(false);
        expect(shown.some((s) => s.includes('Pick a seat above'))).toBe(true);
        const total = shown.length;
        expect(shown.map((s, i) => s.includes(`${i + 1} of ${total}`))).toEqual(
            shown.map(() => true),
        );
        w.unmount();
    });

    it('shows nothing when no control is on screen', async () => {
        const w = mountTour();
        expect(api(w).startTour()).toBe(false);
        expect(popover()).toBeNull();
        w.unmount();
    });

    it('has the six steps and the outside-tap hint is kept from opening during it', async () => {
        expect(TOUR_STEPS).toHaveLength(6);
        addAnchors();
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        expect(api(w).busy()).toBe(true);
        w.unmount();
        expect(state.tourActive).toBe(false);
    });
});

describe('contextual tips', () => {
    const afterTour = () => setFlag(TOUR_KEY);

    it('never show during the tour', async () => {
        addAnchors();
        const w = mountTour();
        api(w).startTour();
        await flushPromises();
        expect(await api(w).showTip('unit')).toBe(false);
        await press('Skip');
        expect(await api(w).showTip('unit')).toBe(true);
        w.unmount();
    });

    it('show once ever, with the owner’s words, and close with Got it', async () => {
        addAnchors();
        afterTour();
        const w = mountTour();
        expect(await api(w).showTip('unit')).toBe(true);
        await flushPromises();
        expect(text()).toContain(
            'Share this view makes an image of exactly this. Sources included.',
        );
        expect(button('Next')).toBeUndefined();
        await press('Got it');
        expect(popover()).toBeNull();
        expect(localStorage.getItem('kem.tip.unit')).toBe('1');
        state.tipShown = false;
        expect(await api(w).showTip('unit')).toBe(false);
        w.unmount();
    });

    it('allow one tip per session; the held one is not used up', async () => {
        addAnchors();
        afterTour();
        const w = mountTour();
        expect(await api(w).showTip('unit')).toBe(true);
        await press('Got it');
        expect(await api(w).showTip('party', { party: 'UDA' })).toBe(false);
        expect(localStorage.getItem('kem.tip.party')).toBeNull();
        state.tipShown = false;
        expect(await api(w).showTip('party', { party: 'UDA' })).toBe(true);
        await flushPromises();
        expect(text()).toContain('Showing only UDA.');
        w.unmount();
    });

    it('are not shown when the control is absent, and are not used up', async () => {
        addAnchors(['search']);
        afterTour();
        const w = mountTour();
        expect(await api(w).showTip('unit')).toBe(false);
        expect(localStorage.getItem('kem.tip.unit')).toBeNull();
        expect(state.tipShown).toBe(false);
        w.unmount();
    });

    it('close on Escape and on a tap elsewhere', async () => {
        addAnchors();
        afterTour();
        const w = mountTour();
        await api(w).showTip('locate', { reason: 'denied' });
        await flushPromises();
        expect(text()).toContain('Location is off for this site.');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flushPromises();
        expect(popover()).toBeNull();
        state.tipShown = false;
        await api(w).showTip('muted-chip', { county: 'Kisumu' });
        await flushPromises();
        expect(text()).toContain('go back to Kisumu.');
        document.body.dispatchEvent(
            new Event('pointerdown', { bubbles: true }),
        );
        await flushPromises();
        expect(popover()).toBeNull();
        w.unmount();
    });

    it('with storage blocked, show once per page load', async () => {
        addAnchors();
        afterTour();
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const w = mountTour();
        expect(await api(w).showTip('unit')).toBe(true);
        await press('Got it');
        state.tipShown = false;
        expect(await api(w).showTip('unit')).toBe(false);
        w.unmount();
    });

    it('never open beside the outside-tap hint, and it does not open beside a tip', async () => {
        addAnchors();
        afterTour();
        const hint = mount(OutsideHint, {
            props: { unit: 'Mathare', parent: 'Nairobi City' },
            attachTo: document.body,
        });
        (hint.vm as unknown as { nudge: () => boolean }).nudge();
        expect(state.hintOpen).toBe(true);
        const w = mountTour();
        expect(await api(w).showTip('unit')).toBe(false);
        (hint.vm as unknown as { dismiss: () => void }).dismiss();
        expect(state.hintOpen).toBe(false);
        expect(await api(w).showTip('unit')).toBe(true);
        expect(api(w).busy()).toBe(true);
        w.unmount();
        hint.unmount();
    });
});

describe('the locate step’s promise', () => {
    // The page's own code is the evidence: the position is read, compared in the page with the
    // ward shapes, and nothing more. If this fails, the second line of the locate step is wrong.
    const page = readFileSync(
        resolve(import.meta.dirname, '../../../resources/js/pages/Map.vue'),
        'utf8',
    );
    const body = page.slice(
        page.indexOf('async function locate()'),
        page.indexOf('// ---- hover tooltip'),
    );

    it('says the location stays on the phone', () => {
        expect(TOUR_STEPS.find((s) => s.id === 'locate')?.detail).toBe(
            'Your location stays on your phone.',
        );
    });
    it('is true: the coordinates only reach the in-page ward lookup', () => {
        expect(body.length).toBeGreaterThan(200);
        // The one request is for the ward shapes, a static file, with nothing from the position.
        expect(body.match(/fetch\(/g)).toHaveLength(1);
        expect(body).toContain(
            "fetch(fileUrl(manifest.value!, 'wards.geojson'))",
        );
        // The coordinates are used once, to look up the ward in this page.
        const uses = body.match(/coords\.\w+/g) ?? [];
        expect(uses).toEqual(['coords.longitude', 'coords.latitude']);
        expect(body).toMatch(
            /findContaining\(wards\.features, \[\s*coords\.longitude,\s*coords\.latitude,?\s*\]\)/,
        );
        // Nothing is sent, stored or put in the address.
        expect(body).not.toMatch(
            /sendBeacon|XMLHttpRequest|WebSocket|localStorage|sessionStorage|URLSearchParams|history\.|router\.|navigator\.share/,
        );
    });
});

describe('the About sheet help', () => {
    it('lists how to use the map, the same six steps', () => {
        const w = mount(AboutSheet);
        expect(w.text()).toContain('How to use this map');
        const items = w.findAll('[data-help-step]');
        expect(items).toHaveLength(6);
        for (const [i, step] of TOUR_STEPS.entries())
            expect(items[i].text()).toContain(step.text);
        expect(items[4].text()).toContain('Your location stays on your phone.');
    });
    it('asks for the tips again', async () => {
        const w = mount(AboutSheet);
        const b = w
            .findAll('button')
            .find((b) => b.text() === 'Show tips again');
        expect(b).toBeTruthy();
        await b!.trigger('click');
        expect(w.emitted('showTips')).toHaveLength(1);
    });
});
