// A party's profile on the map page: opened from the legend, a seat row, the overview or search,
// shown in the panel like a unit, and a state of the page's history (/party/uda).
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
import Legend from '@/components/map/Legend.vue';
import MapView from '@/components/map/MapView.vue';
import NationalOverview from '@/components/map/NationalOverview.vue';
import PartyPanel from '@/components/map/PartyPanel.vue';
import SearchBox from '@/components/map/SearchBox.vue';
import UnitPanel from '@/components/map/UnitPanel.vue';
import { installPopStateGate } from '@/lib/map/history';
import Map from '@/pages/Map.vue';
import { PARTY_SEATS } from '../party/partyFixtures';

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
                  ? JSON.stringify(PARTY_SEATS)
                  : url.includes('towns')
                    ? '{"features":[]}'
                    : '{}',
            { status: 200 },
        ),
    );

const NAIROBI = { level: 'county', code: 47 };
const MOMBASA = { level: 'county', code: 1 };
const MATHARE = { level: 'constituency', code: 290 };
const UDA = { abbrev: 'UDA', name: 'United Democratic Alliance' };

type Wrapper = Awaited<ReturnType<typeof mountPage>>;
const mounted: { unmount(): void }[] = [];
let entries: string[] = ['/'];
let at = 0;
const setLocation = (path: string) => window.history.replaceState({}, '', path);
function browserGo(to: number, event = new PopStateEvent('popstate')) {
    at = to;
    setLocation(entries[at]);
    window.dispatchEvent(event);
}
const desktop = (on: boolean) =>
    (window.matchMedia = ((q: string) => ({
        matches: on && q.includes('min-width: 768px'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    })) as never);

async function mountPage(
    path = '/',
    unit: object | null = null,
    party: object | null = null,
) {
    entries = [path];
    at = 0;
    setLocation(path);
    const wrapper = mount(Map, {
        props: { unit, party } as never,
        attachTo: document.body,
    });
    await vi.waitFor(() => expect(wrapper.findComponent(UnitPanel).exists() || wrapper.findComponent(NationalOverview).exists() || wrapper.findComponent(PartyPanel).exists()).toBe(true));
    await flushPromises();
    mounted.push(wrapper);
    return wrapper;
}
const pick = async (w: Wrapper, unit: { level: string; code: number }) => {
    w.findComponent(MapView).vm.$emit('select', unit);
    await flushPromises();
};
const title = (w: Wrapper) => w.find('h1').text();
const visits = (fn: unknown) =>
    (fn as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => (c[0] as { url: string }).url,
    );
const profile = (w: Wrapper) => w.findComponent(PartyPanel);
const stored = (key: string) => localStorage.getItem(key);
const pressed = (w: Wrapper, key: string) =>
    w
        .get(`[data-key="${key}"] [aria-pressed]`)
        .attributes('aria-pressed');

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
    desktop(true);
});
afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount());
    vi.mocked(window.history.back).mockRestore();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

/** The map coloured by MP seats, so the legend has its rows. */
const withLegend = () => localStorage.setItem('km.colour', 'mp');

describe('opening a profile', () => {
    it('from a legend row\'s "Party details" button: the panel shows the party, the URL is /party/uda', async () => {
        withLegend();
        const w = await mountPage();
        await w
            .get('[aria-label="United Democratic Alliance: all seats"]')
            .trigger('click');
        await flushPromises();
        expect(profile(w).exists()).toBe(true);
        expect(title(w)).toBe('United Democratic Alliance');
        expect(visits(router.push)).toEqual(['/party/uda']);
        expect(document.title).toBe('United Democratic Alliance (UDA) — Kenya Electoral Map');
        // The highlight toggle did not change.
        expect(pressed(w, 'UDA')).toBe('false');
    });

    it('from a party name in a unit\'s seat rows', async () => {
        const w = await mountPage();
        await pick(w, MOMBASA);
        // Mombasa's governor, senator and woman rep: the sample data gives them all to UDA.
        await w.get('button[data-party]').trigger('click');
        await flushPromises();
        expect(profile(w).exists()).toBe(true);
        expect(title(w)).toBe('United Democratic Alliance');
        expect(visits(router.push)).toEqual(['/county/1', '/party/uda?in=county-1']);
    });

    it('from a governing party in the national overview', async () => {
        const w = await mountPage();
        await w.findComponent(NationalOverview).get('button[data-party]').trigger('click');
        await flushPromises();
        expect(profile(w).exists()).toBe(true);
        expect(visits(router.push)[0]).toMatch(/^\/party\//);
    });

    it('from a search result', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'ODM');
        await flushPromises();
        expect(title(w)).toBe('Orange Democratic Movement');
        expect(visits(router.push)).toEqual(['/party/odm']);
    });

    it('from a deep link, with no unit focused', async () => {
        const w = await mountPage('/party/uda', null, UDA);
        expect(profile(w).exists()).toBe(true);
        expect(title(w)).toBe('United Democratic Alliance');
        expect(w.find('[data-onboarding="back"]').exists()).toBe(false);
        // Nothing is pushed for the page the person arrived on.
        expect(router.push).not.toHaveBeenCalled();
    });

    it('a deep link to a party the data does not have shows the map as usual', async () => {
        const w = await mountPage('/party/zzz', null, { abbrev: 'ZZZ', name: 'Zzz' });
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Kenya');
    });

    it('keeps the unit focused behind the profile', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        expect(mapApi.select).toHaveBeenLastCalledWith('county', 47, expect.anything());
        expect(w.findComponent(UnitPanel).exists()).toBe(false);
    });
});

describe('history', () => {
    it('the browser Back closes the profile and shows the unit it was opened over', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        expect(entries).toEqual(['/', '/county/47', '/party/uda?in=county-47']);
        browserGo(1);
        await flushPromises();
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Nairobi City');
        // Forward opens it again.
        browserGo(2);
        await flushPromises();
        expect(title(w)).toBe('United Democratic Alliance');
        expect(profile(w).exists()).toBe(true);
    });

    it('the Done button closes it the same way, without moving the camera', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        mapApi.select.mockClear();
        await w
            .findAll('button')
            .find((b) => b.text() === 'Done')!
            .trigger('click');
        await flushPromises();
        expect(window.history.back).toHaveBeenCalledTimes(1);
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Nairobi City');
        for (const call of mapApi.select.mock.calls)
            expect(call[2]).toMatchObject({ fit: false });
    });

    it('closing a deep-linked profile shows Kenya, and Back leaves nothing broken', async () => {
        const w = await mountPage('/party/uda', null, UDA);
        await w
            .findAll('button')
            .find((b) => b.text() === 'Done')!
            .trigger('click');
        await flushPromises();
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Kenya');
        expect(visits(router.push)).toEqual(['/']);
    });

    it('picking a unit on the map closes the profile', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await pick(w, MATHARE);
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Mathare');
        expect(entries).toEqual(['/', '/party/uda', '/constituency/290']);
    });

    it('leaves a popstate to another page alone while a profile is open', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        entries[at] = '/dashboard';
        browserGo(at, event);
        await flushPromises();
        expect(stop).not.toHaveBeenCalled();
        expect(profile(w).exists()).toBe(true);
    });

    it('takes a popstate to a party page for the map, so Inertia does not rebuild it', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        const event = new PopStateEvent('popstate');
        const stop = vi.spyOn(event, 'stopImmediatePropagation');
        browserGo(at, event);
        await flushPromises();
        expect(stop).toHaveBeenCalled();
        expect(profile(w).exists()).toBe(true);
    });
});

describe('"Show on map"', () => {
    // The profile opens over the focus (UDA holds nothing in Nairobi in this data); look at Kenya.
    const acrossKenya = async (w: Wrapper) => {
        await w.get('[data-scope="kenya"]').trigger('click');
        await flushPromises();
    };
    const showMp = async (w: Wrapper) => {
        await acrossKenya(w);
        await w.get('[data-show-on-map="mp"]').trigger('click');
    };

    it('colours the map by that seat and highlights the party, leaving the focus alone', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await showMp(w);
        await flushPromises();
        expect(stored('km.colour')).toBe('mp');
        expect(JSON.parse(stored('km.only')!)).toEqual(['UDA']);
        expect(profile(w).exists()).toBe(false);
        expect(title(w)).toBe('Nairobi City');
        // The legend (a chip beside a focused unit) now says UDA is what is shown.
        expect(w.findComponent(Legend).props('chipLabel')).toBe('MP seats: UDA');
    });

    it('works from all of Kenya', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'ODM');
        await flushPromises();
        await w.get('[data-show-on-map="mca"]').trigger('click');
        await flushPromises();
        expect(stored('km.colour')).toBe('mca');
        expect(JSON.parse(stored('km.only')!)).toEqual(['ODM']);
        expect(title(w)).toBe('Kenya');
    });

    it('steps up like the seat chips when the seat is held above the focus', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        await pick(w, MATHARE);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await acrossKenya(w);
        await w.get('[data-show-on-map="governor"]').trigger('click');
        await flushPromises();
        // A governor means nothing inside a constituency: up to the county that holds the seat.
        expect(title(w)).toBe('Nairobi City');
        expect(stored('km.colour')).toBe('governor');
        expect(JSON.parse(stored('km.only')!)).toEqual(['UDA']);
        expect(profile(w).exists()).toBe(false);
    });

    it('does not offer a seat the party does not hold', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'DP');
        await flushPromises();
        expect(w.find('[data-show-on-map="governor"]').exists()).toBe(false);
    });
});

describe('the party card', () => {
    it('opens the share dialog for the party', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await w.get('[data-share-card]').trigger('click');
        await flushPromises();
        expect(document.body.textContent).toContain('Share party card');
    });

    const cardChoices = () =>
        [
            ...document.querySelectorAll<HTMLInputElement>(
                'input[name="view-card"]',
            ),
        ].map((i) => `${i.value}:${i.closest('label')?.textContent?.trim()}`);

    it('offers the party’s top 10 counties for MCA seats beside the party card, across Kenya', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await w.get('[data-share-card]').trigger('click');
        await flushPromises();
        expect(cardChoices()).toEqual([
            'partyCard:Party card',
            'topCounties:Top 10 counties',
        ]);
        document
            .querySelector<HTMLInputElement>(
                'input[name="view-card"][value="topCounties"]',
            )!
            .click();
        await flushPromises();
        expect(
            document.querySelector('[data-fixed-headline]')?.textContent?.trim(),
        ).toBe('Where UDA holds the most MCA seats');
        expect(document.body.textContent).toContain(
            'This card’s headline is fixed, so it stays neutral.',
        );
    });

    it('does not offer it for a party profile within a county, or for a party with no MCA', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await w.get('[data-share-card]').trigger('click');
        await flushPromises();
        expect(document.body.textContent).toContain('Share party card');
        expect(cardChoices()).toEqual([]);
        w.unmount();
        document.body.innerHTML = '';

        // DP's MCA seats given to another party: it still holds seats, but no MCA.
        const noMca = {
            ...PARTY_SEATS,
            holders: PARTY_SEATS.holders.map((h) =>
                h.seat === 'mca' && h.party === 'DP' ? { ...h, party: 'UDA' } : h,
            ),
        };
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url.includes('seats.json')
                    ? Promise.resolve(new Response(JSON.stringify(noMca), { status: 200 }))
                    : fakeFetch(url),
            ),
        );
        const d = await mountPage();
        d.findComponent(SearchBox).vm.$emit('pickParty', 'DP');
        await flushPromises();
        await d.get('[data-share-card]').trigger('click');
        await flushPromises();
        expect(document.body.textContent).toContain('Share party card');
        expect(cardChoices()).toEqual([]);
    });
});

describe('the legend while a profile is open', () => {
    it('still toggles a highlight, apart from the details button', async () => {
        withLegend();
        const w = await mountPage();
        await w.get('[data-key="UDA"] [aria-pressed]').trigger('click');
        expect(pressed(w, 'UDA')).toBe('true');
        expect(w.findComponent(Legend).emitted('party')).toBeUndefined();
        expect(profile(w).exists()).toBe(false);
    });
});


describe('scope', () => {
    const scopeButtons = (w: Wrapper) =>
        w.findAll('[data-scope]').map((b) => [b.text(), b.attributes('aria-pressed')]);

    it('opens over the focus: a county shows that county, in the address too', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        expect(entries.at(-1)).toBe('/party/uda?in=county-47');
        expect(scopeButtons(w)).toEqual([
            ['Across Kenya', 'false'],
            ['In Nairobi City', 'true'],
        ]);
        expect(document.title).toBe('United Democratic Alliance (UDA) in Nairobi City — Kenya Electoral Map');
        expect(w.text()).toContain('Governor');
    });

    it('opens over all of Kenya when nothing is focused', async () => {
        const w = await mountPage();
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        expect(entries.at(-1)).toBe('/party/uda');
        expect(w.find('[data-scope-switch]').exists()).toBe(false);
    });

    it('a ward focus is its constituency', async () => {
        const w = await mountPage();
        await pick(w, { level: 'ward', code: 1445 });
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        expect(entries.at(-1)).toBe('/party/uda?in=constituency-290');
        expect(scopeButtons(w).map((b) => b[0])).toEqual([
            'Across Kenya',
            'In Nairobi City',
            'In Mathare',
        ]);
    });

    it('switching the scope replaces the entry (no new one), and Back still returns to the unit', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        vi.mocked(router.push).mockClear();
        await w.get('[data-scope="kenya"]').trigger('click');
        await flushPromises();
        expect(router.push).not.toHaveBeenCalled();
        expect(entries).toEqual(['/', '/county/47', '/party/uda']);
        expect(scopeButtons(w)[0]).toEqual(['Across Kenya', 'true']);
        expect(document.title).toBe('United Democratic Alliance (UDA) — Kenya Electoral Map');
        browserGo(1);
        await flushPromises();
        expect(title(w)).toBe('Nairobi City');
    });

    it('a deep link with a scope focuses the map on it: the scope is always the focus or above it', async () => {
        const w = await mountPage('/party/uda?in=county-47', null, UDA);
        expect(profile(w).props('scope')).toEqual({ level: 'county', code: 47 });
        expect(profile(w).props('focus')).toEqual({ level: 'county', code: 47 });
        expect(title(w)).toBe('United Democratic Alliance');
        // Opening is not choosing: nothing is highlighted until "Show on map".
        expect(JSON.parse(stored('km.only') ?? '[]')).toEqual([]);
        const m = await mountPage('/party/uda?in=constituency-290', null, UDA);
        expect(profile(m).props('focus')).toEqual({ level: 'constituency', code: 290 });
    });

    it('Show on map from a scoped deep link colours that focus', async () => {
        const w = await mountPage('/party/uda?in=county-47', null, UDA);
        await w.get('[data-scope="kenya"]').trigger('click');
        await w.get('[data-show-on-map="mp"]').trigger('click');
        await flushPromises();
        expect(stored('km.colour')).toBe('mp');
        expect(JSON.parse(stored('km.only')!)).toEqual(['UDA']);
        expect(title(w)).toBe('Nairobi City');
        expect(w.findComponent(Legend).props('title')).toContain('Nairobi City');
    });

    it('Back onto a scoped deep link reproduces its focus and its profile', async () => {
        const w = await mountPage('/party/uda?in=county-47', null, UDA);
        await pick(w, MATHARE);
        expect(title(w)).toBe('Mathare');
        browserGo(0);
        await flushPromises();
        expect(title(w)).toBe('United Democratic Alliance');
        expect(profile(w).props('scope')).toEqual({ level: 'county', code: 47 });
        expect(profile(w).props('focus')).toEqual({ level: 'county', code: 47 });
    });

    it('a deep link with a scope restores it, and so do Back and Forward', async () => {
        const w = await mountPage('/party/uda?in=county-47', null, UDA);
        expect(profile(w).props('scope')).toEqual({ level: 'county', code: 47 });
        expect(scopeButtons(w)[1]).toEqual(['In Nairobi City', 'true']);
        // A link that names no unit of ours is all of Kenya.
        const bad = await mountPage('/party/uda?in=county-999', null, UDA);
        expect(profile(bad).props('scope')).toBeNull();
    });

    it('Back and Forward restore the scope the entry had', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        browserGo(1);
        await flushPromises();
        browserGo(2);
        await flushPromises();
        expect(profile(w).props('scope')).toEqual({ level: 'county', code: 47 });
    });

    it('the party card follows the scope: headline, link, file', async () => {
        const w = await mountPage();
        await pick(w, NAIROBI);
        w.findComponent(SearchBox).vm.$emit('pickParty', 'UDA');
        await flushPromises();
        await w.get('[data-share-card]').trigger('click');
        await flushPromises();
        const svg = document.querySelector('[data-preview] svg')!;
        expect(svg.textContent).toContain('UDA seats in Nairobi City');
        expect(svg.textContent).toContain('/party/uda?in=county-47');
    });
});
