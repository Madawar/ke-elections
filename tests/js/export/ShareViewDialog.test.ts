import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { leadersCardView } from '@/lib/export/leadersCard';
import { numbersCardView } from '@/lib/export/numbersCard';
import { partyCardView } from '@/lib/export/partyCard';
import { shareCards } from '@/lib/export/shareView';
import { seatsInTheme, snapshotView } from '@/lib/export/viewState';
import { PARTY_SEATS } from '../party/partyFixtures';
import { NUMBERS_SEATS, numbersIndex } from './numbersFixtures';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

// Map drawing is a deferred we resolve by hand; rasterising returns a PNG at once.
const renders: {
    size: string;
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
}[] = [];
vi.mock('@/lib/export/viewMap', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/viewMap')>()),
    renderViewMap: vi.fn(
        (
            _v: unknown,
            _c: unknown,
            _t: unknown,
            box: { w: number; h: number },
        ) =>
            new Promise<string>((resolve, reject) =>
                renders.push({ size: `${box.w}x${box.h}`, resolve, reject }),
            ),
    ),
}));
vi.mock('@/lib/export/rasterize', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/rasterize')>()),
    svgToPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const { default: ShareViewDialog } =
    await import('@/components/export/ShareViewDialog.vue');

const view = snapshotView({
    seats: VIEW_SEATS,
    index: viewIndex,
    seat: 'mca',
    focus: null,
    only: ['UDA'],
    showSurroundings: false,
    theme: 'dark',
});
const context = {
    manifest: {},
    provinceOfCounty: new Map<number, number>(),
    index: viewIndex,
    seats: VIEW_SEATS,
};

async function settle() {
    for (let i = 0; i < 6; i++) {
        await flushPromises();
        await nextTick();
        await new Promise((r) => setTimeout(r, 0));
    }
}
const pick = async (size: string) => {
    const input = document.querySelector<HTMLInputElement>(
        `input[name="view-size"][value="${size}"]`,
    )!;
    input.click();
    await nextTick();
};
const download = () =>
    [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Download PNG',
    )!;

describe('ShareViewDialog', () => {
    beforeEach(() => {
        renders.length = 0;
        localStorage.setItem('km.viewSize', JSON.stringify('square'));
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('ends ready after quick size switches while the first map is still drawing', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view, context, open: true },
            attachTo: document.body,
        });
        await settle();
        expect(renders).toHaveLength(1); // square, still drawing
        await pick('portrait');
        await pick('x');
        await pick('portrait');
        await settle();
        // The first map finishes; the queue then draws what is still wanted.
        renders[0].resolve('data:image/png;base64,SQ');
        await settle();
        for (const r of renders.slice(1)) r.resolve('data:image/png;base64,PT');
        await settle();
        for (const r of renders.slice(1)) r.resolve('data:image/png;base64,PT');
        await settle();
        expect(download().disabled).toBe(false);
        expect(document.body.textContent).not.toContain('Drawing the card');
        wrapper.unmount();
    });

    it('keeps a failed map off the image: export is blocked with a message in the dialog', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view, context, open: true },
            attachTo: document.body,
        });
        await settle();
        renders[0].reject(new Error('no WebGL'));
        await settle();
        expect(download().disabled).toBe(true);
        const svgText =
            document.querySelector('[data-preview] svg')?.textContent ?? '';
        expect(svgText).not.toContain('could not be drawn');
        expect(document.body.textContent).toContain(
            'The map could not be drawn on this device',
        );
        wrapper.unmount();
    });
});

describe('ShareViewDialog with a party card', () => {
    const card = partyCardView({
        seats: seatsInTheme(PARTY_SEATS, 'dark'),
        abbrev: 'UDA',
        theme: 'dark',
    })!;
    const partyContext = { ...context, seats: PARTY_SEATS };
    const textarea = () =>
        document.querySelector<HTMLTextAreaElement>('#view-caption')!;

    beforeEach(() => {
        renders.length = 0;
        localStorage.setItem('km.viewSize', JSON.stringify('square'));
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('is the same dialog, titled for the party card, with the party card drawn in it', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view: card, context: partyContext, open: true },
            attachTo: document.body,
        });
        await settle();
        expect(document.body.textContent).toContain('Share party card');
        const svg = document.querySelector('[data-preview] svg')!;
        expect(svg.textContent).toContain('UDA seats across Kenya');
        expect(svg.querySelectorAll('[data-row]')).toHaveLength(7);
        // The map of the party's MCA seats is drawn at the size of its box on the card.
        expect(renders).toHaveLength(1);
        expect(renders[0].size).toMatch(/^\d+x\d+$/);
        renders[0].resolve('data:image/png;base64,SQ');
        await settle();
        expect(download().disabled).toBe(false);
        wrapper.unmount();
    });

    it('writes the caption with the numbers, source, link and tags', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view: card, context: partyContext, open: true },
            attachTo: document.body,
        });
        await settle();
        const t = textarea().value;
        expect(t).toContain('UDA seats across Kenya');
        expect(t).toContain('Governors: 20 of 47 (43%)');
        expect(t).toContain('/party/uda');
        expect(t).toContain('#Kenya2027');
        wrapper.unmount();
    });

    it('offers every size and both themes, and redraws the card for a size', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view: card, context: partyContext, open: true },
            attachTo: document.body,
        });
        await settle();
        renders[0].resolve('data:image/png;base64,SQ');
        await settle();
        await pick('story');
        await settle();
        expect(document.querySelector('[data-preview] svg')?.getAttribute('viewBox')).toBe('0 0 1080 1920');
        expect(document.querySelectorAll('input[name="view-size"]')).toHaveLength(4);
        expect(document.querySelectorAll('input[name="view-theme"]')).toHaveLength(2);
        wrapper.unmount();
    });

    it('does not offer the seat view\'s "rows" hint', async () => {
        const wrapper = mount(ShareViewDialog, {
            props: { view: card, context: partyContext, open: true },
            attachTo: document.body,
        });
        await settle();
        expect(document.querySelector('[data-rows-hint]')).toBeNull();
        wrapper.unmount();
    });
    it('says once which size is for what, after the tour, and never again', async () => {
        const { TOUR_KEY, resetOnboardingState, setFlag, state } =
            await import('@/lib/onboarding');
        const open = async () => {
            const w = mount(ShareViewDialog, {
                props: { view, context, open: true },
                attachTo: document.body,
            });
            await settle();
            const tip = document.querySelector('[data-onboarding-tip]');
            w.unmount();
            document.body.innerHTML = '';
            return tip?.textContent ?? null;
        };
        localStorage.clear();
        resetOnboardingState();
        // Before the tour is done, or during it, there is no tip.
        expect(await open()).toBeNull();
        setFlag(TOUR_KEY);
        state.tourActive = true;
        expect(await open()).toBeNull();
        state.tourActive = false;
        expect(await open()).toContain(
            'Pick a size: square for feeds, story for TikTok and Reels, wide for X.',
        );
        state.tipShown = false;
        expect(await open()).toBeNull();
        resetOnboardingState();
        localStorage.clear();
    });
});

describe('ShareViewDialog: the leaders card beside the view', () => {
    const county = snapshotView({
        seats: VIEW_SEATS,
        index: viewIndex,
        seat: 'mp',
        focus: { level: 'county', code: 47 },
        only: [],
        showSurroundings: false,
        theme: 'dark',
    });
    const leaders = leadersCardView({
        seats: VIEW_SEATS,
        index: viewIndex,
        focus: { level: 'county', code: 47 },
        theme: 'dark',
    })!;
    const cards = shareCards([county, leaders]);
    const cardOption = (value: string) =>
        document.querySelector<HTMLInputElement>(
            `input[name="view-card"][value="${value}"]`,
        );
    const headlineInput = () =>
        document.querySelector<HTMLInputElement>('#view-headline')!;
    beforeEach(() => {
        renders.length = 0;
        localStorage.setItem('km.viewSize', JSON.stringify('square'));
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('offers "This view" and "County leaders", and starts on the view', async () => {
        mount(ShareViewDialog, {
            props: { open: true, view: county, cards, context },
            attachTo: document.body,
        });
        await settle();
        expect(cardOption('view')?.checked).toBe(true);
        expect(
            cardOption('leaders')?.closest('label')?.textContent?.trim(),
        ).toBe('County leaders');
        expect(headlineInput().value).toContain('MP seats in Nairobi City');
        expect(document.querySelector('[data-leader]')).toBeNull();
    });

    it('switches to the leaders card, with its own headline, caption and file', async () => {
        mount(ShareViewDialog, {
            props: { open: true, view: county, cards, context },
            attachTo: document.body,
        });
        await settle();
        cardOption('leaders')!.click();
        await settle();
        expect(headlineInput().value).toBe('County leaders in Nairobi City');
        expect(
            [...document.querySelectorAll('[data-preview] [data-leader]')].map(
                (g) => g.getAttribute('data-leader'),
            ),
        ).toEqual(['governor', 'senator', 'woman_rep']);
        expect(
            document.querySelector<HTMLTextAreaElement>('#view-caption')!.value,
        ).toContain('Governor: Placeholder governor 47 (UDA)');
        // Back again: the view's own headline returns.
        cardOption('view')!.click();
        await settle();
        expect(headlineInput().value).toContain('MP seats in Nairobi City');
        expect(document.querySelector('[data-preview] [data-leader]')).toBeNull();
    });

    it('puts the new card’s own headline on it at once, never the other card’s for a moment', async () => {
        mount(ShareViewDialog, {
            props: { open: true, view: county, cards, context },
            attachTo: document.body,
        });
        await settle();
        cardOption('leaders')!.click();
        // No waiting for the typing pause: the very next render has the leaders headline.
        await nextTick();
        await nextTick();
        expect(
            [...document.querySelectorAll('[data-preview] [data-headline]')]
                .map((t) => t.textContent?.trim())
                .join(' '),
        ).toBe('County leaders in Nairobi City');
    });

    it('keeps the new card’s headline even when the person had just been typing on the other', async () => {
        mount(ShareViewDialog, {
            props: { open: true, view: county, cards, context },
            attachTo: document.body,
        });
        await settle();
        // Typing, then switching card before the typing pause is over.
        const input = headlineInput();
        input.value = 'Typed on the first card';
        input.dispatchEvent(new Event('input'));
        cardOption('leaders')!.click();
        await nextTick();
        await nextTick();
        const shown = () =>
            [...document.querySelectorAll('[data-preview] [data-headline]')]
                .map((t) => t.textContent?.trim())
                .join(' ');
        expect(shown()).toBe('County leaders in Nairobi City');
        // ... and after the pause has run out, it is still the leaders card's own.
        await new Promise((r) => setTimeout(r, 420));
        await settle();
        expect(shown()).toBe('County leaders in Nairobi City');
        expect(headlineInput().value).toBe('County leaders in Nairobi City');
    });

    it('has no card choice without a leaders card, or when it was opened for one', async () => {
        const plain = mount(ShareViewDialog, {
            props: { open: true, view: county, context },
            attachTo: document.body,
        });
        await settle();
        expect(cardOption('leaders')).toBeNull();
        plain.unmount();
        document.body.innerHTML = '';
        mount(ShareViewDialog, {
            props: { open: true, view: leaders, cards: shareCards([leaders]), context },
            attachTo: document.body,
        });
        await settle();
        expect(cardOption('leaders')).toBeNull();
        expect(document.body.textContent).toContain('Share leaders card');
        expect(
            document.querySelectorAll('[data-preview] [data-leader]'),
        ).toHaveLength(3);
    });
});

describe('ShareViewDialog: "By the numbers" beside the national view', () => {
    const numbersContext = { ...context, index: numbersIndex, seats: NUMBERS_SEATS };
    const kenya = snapshotView({
        seats: NUMBERS_SEATS,
        index: numbersIndex,
        seat: 'mca',
        focus: null,
        only: [],
        showSurroundings: false,
        theme: 'dark',
    });
    const numbers = numbersCardView({
        seats: seatsInTheme(NUMBERS_SEATS, 'dark'),
        index: numbersIndex,
        theme: 'dark',
    });
    beforeEach(() => {
        renders.length = 0;
        localStorage.setItem('km.viewSize', 'portrait');
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('offers it as a card, made with no map, in square and story', async () => {
        mount(ShareViewDialog, {
            props: {
                open: true,
                view: kenya,
                cards: shareCards([kenya, numbers]),
                context: numbersContext,
            },
            attachTo: document.body,
        });
        await settle();
        const option = document.querySelector<HTMLInputElement>(
            'input[name="view-card"][value="numbers"]',
        )!;
        expect(option.closest('label')?.textContent?.trim()).toBe('By the numbers');
        expect(renders).toHaveLength(1); // the view's map
        option.click();
        await settle();
        expect(renders).toHaveLength(1); // none for the numbers
        expect(
            [...document.querySelectorAll<HTMLInputElement>('input[name="view-size"]')].map(
                (i) => i.value,
            ),
        ).toEqual(['square', 'story']);
        expect(document.querySelectorAll('[data-preview] [data-seat]')).toHaveLength(5);
        expect(
            document.querySelector('[data-preview] svg')?.getAttribute('viewBox'),
        ).toBe('0 0 1080 1080');
        expect(
            document.querySelector<HTMLInputElement>('#view-headline')!.value,
        ).toBe('1,881 elected seats below the President');
        expect(
            document.querySelector<HTMLTextAreaElement>('#view-caption')!.value,
        ).toContain('MCAs: 1,450 seats. Most held: UDA 523, ODM 312, Independent 114.');
        expect(download().disabled).toBe(false);
        expect(document.body.textContent).toContain('Share by the numbers');
    });

    it('gives every card the same props, and none of them falls through onto the card as an attribute', async () => {
        const leaders = leadersCardView({
            seats: VIEW_SEATS,
            index: viewIndex,
            focus: { level: 'county', code: 47 },
            theme: 'dark',
        })!;
        const party = partyCardView({
            seats: seatsInTheme(PARTY_SEATS, 'dark'),
            abbrev: 'UDA',
            theme: 'dark',
        })!;
        for (const card of [kenya, numbers, leaders, party]) {
            const w = mount(ShareViewDialog, {
                props: { open: true, view: card, context: numbersContext },
                attachTo: document.body,
            });
            await settle();
            const svg = document.querySelector('[data-preview] > svg')!;
            expect(
                [...svg.attributes].map((a) => a.name).sort(),
                card.kind,
            ).toEqual(
                ['aria-label', 'height', 'role', 'viewBox', 'width', 'xmlns'].sort(),
            );
            w.unmount();
            document.body.innerHTML = '';
        }
    });
});
