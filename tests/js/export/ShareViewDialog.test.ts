import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { leadersCardView } from '@/lib/export/leadersCard';
import { partyCardView } from '@/lib/export/partyCard';
import { seatsInTheme, snapshotView } from '@/lib/export/viewState';
import { PARTY_SEATS } from '../party/partyFixtures';
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
            props: { open: true, view: county, leaders, context },
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
            props: { open: true, view: county, leaders, context },
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
            props: { open: true, view: leaders, leaders, context },
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
