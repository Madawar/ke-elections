// The share dialog's general ability for a card in its list to be a series of slides (Task H1):
// a "Slide" stepper under the "Card" choice, the sizes every slide has, "2 of 4" in each slide's
// footer, fixed headlines, each slide's maps kept apart in the cache, "Download PNG" for the
// current slide and "Download all" for every slide in turn. The slides here are mocks of other
// kinds (a seat view, a leaders card); the dialog only knows "this entry has slides".
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { leadersCardView } from '@/lib/export/leadersCard';
import type { ShareCard, ShareableView } from '@/lib/export/shareView';
import { snapshotView } from '@/lib/export/viewState';
import type { SeatKey } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex } from './numbersFixtures';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

// Map drawing is a deferred we resolve by hand; rasterising returns a PNG at once.
const renders: {
    spec: { seat?: string; stripes?: boolean };
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
}[] = [];
vi.mock('@/lib/export/viewMap', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/viewMap')>()),
    renderViewMap: vi.fn(
        (spec: { seat?: string }) =>
            new Promise<string>((resolve, reject) => renders.push({ spec, resolve, reject })),
    ),
}));
let pngs = 0;
vi.mock('@/lib/export/rasterize', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/rasterize')>()),
    svgToPng: vi.fn(async () => new Blob([`png${++pngs}`], { type: 'image/png' })),
}));
vi.mock('@/lib/export/share', async (actual) => {
    const real = await actual<typeof import('@/lib/export/share')>();
    return {
        ...real,
        canShareFiles: vi.fn(() => false),
        downloadBlob: vi.fn(),
        shareFiles: vi.fn(async () => 'shared'),
    };
});
vi.mock('@/lib/export/shareView', async (actual) => {
    const real = await actual<typeof import('@/lib/export/shareView')>();
    return { ...real, mapSlotsOf: vi.fn(real.mapSlotsOf), sizesOf: vi.fn(real.sizesOf) };
});

const shareView = await import('@/lib/export/shareView');
const real = await vi.importActual<typeof import('@/lib/export/shareView')>('@/lib/export/shareView');
const share = await import('@/lib/export/share');
const { svgToPng } = await import('@/lib/export/rasterize');
const { default: ShareViewDialog } = await import('@/components/export/ShareViewDialog.vue');

const seatView = (seat: SeatKey) =>
    snapshotView({
        seats: VIEW_SEATS,
        index: viewIndex,
        seat,
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
const context = {
    manifest: {},
    provinceOfCounty: new Map<number, number>(),
    index: viewIndex,
    seats: VIEW_SEATS,
};

/** Every slide's one map has the same key and box: only the cache key can keep them apart. */
const SHARED = (v: ShareableView) => [{ key: 'map', box: { x: 0, y: 0, w: 500, h: 400 }, spec: v as never }];

const SLIDES: ShareableView[] = [seatView('governor'), leaders, seatView('mp'), seatView('mca')];
const plain: ShareCard = { key: 'view', label: 'This view', view: seatView('mca') };
const series = (): ShareCard => shareView.seriesCard('carousel', 'Carousel', SLIDES);

async function settle() {
    for (let i = 0; i < 6; i++) {
        await flushPromises();
        await nextTick();
        await new Promise((r) => setTimeout(r, 0));
    }
}
const button = (name: string) =>
    [...document.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
    ) ?? null;
const next = () => button('Next slide');
const prev = () => button('Previous slide');
const place = () => document.querySelector('[data-slide-place]')?.textContent?.trim() ?? null;
const cardOption = (value: string) =>
    document.querySelector<HTMLInputElement>(`input[name="view-card"][value="${value}"]`)!;
const previewMap = () =>
    document.querySelector('[data-preview] image[data-map]')?.getAttribute('href') ?? null;
const previewHeadline = () =>
    [...document.querySelectorAll('[data-preview] [data-headline]')].map((t) => t.textContent?.trim()).join(' ');
const pageText = () => document.querySelector('[data-preview] [data-page]')?.textContent?.trim() ?? null;
const caption = () => document.querySelector<HTMLTextAreaElement>('#view-caption')!.value;
const status = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '';
const sizes = () =>
    [...document.querySelectorAll<HTMLInputElement>('input[name="view-size"]')].map((i) => i.value);
const open = (cards: ShareCard[]) =>
    mount(ShareViewDialog, {
        props: { open: true, view: cards[0].view, cards, context },
        attachTo: document.body,
    });
/** Resolve every map drawn so far that is still waiting, with a name for each. */
async function drawAll(tag = 'MAP') {
    for (let round = 0; round < 12; round++) {
        await settle();
        const waiting = renders.filter((r) => !(r as { done?: boolean }).done);
        if (!waiting.length) return;
        for (const r of waiting) {
            (r as { done?: boolean }).done = true;
            r.resolve(`data:image/png;base64,${tag}-${r.spec.stripes ? 'stripes' : r.spec.seat}`);
        }
    }
}

describe('ShareViewDialog: a card that is a series of slides', () => {
    beforeEach(() => {
        renders.length = 0;
        pngs = 0;
        vi.mocked(svgToPng).mockClear();
        vi.mocked(share.downloadBlob).mockClear();
        vi.mocked(share.shareFiles).mockClear();
        vi.mocked(share.canShareFiles).mockReturnValue(false);
        vi.mocked(shareView.mapSlotsOf).mockImplementation((_s, v) => SHARED(v));
        vi.mocked(shareView.sizesOf).mockImplementation(real.sizesOf);
        try {
            localStorage.removeItem('km.viewSize');
        } catch {
            // no storage
        }
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('a series entry carries its slides, and the slide the dialog opens on as its view', () => {
        const card = series();
        expect(card.slides).toEqual(SLIDES);
        expect(card.view).toBe(SLIDES[0]);
        expect(card.key).toBe('carousel');
        expect(card.label).toBe('Carousel');
    });

    it('shows a "Slide" stepper only while the series is picked, under the "Card" choice', async () => {
        open([plain, series()]);
        await settle();
        expect(next()).toBeNull();
        expect(place()).toBeNull();
        cardOption('carousel').click();
        await settle();
        expect(place()).toBe('1 of 4');
        const group = document.querySelector('[data-slide-stepper]')!;
        expect(group.getAttribute('role')).toBe('group');
        const label = document.getElementById(group.getAttribute('aria-labelledby')!);
        expect(label?.textContent?.trim()).toBe('Slide');
        const cards = cardOption('carousel').closest('fieldset')!;
        const size = document.querySelector('input[name="view-size"]')!;
        expect(cards.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(group.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        cardOption('view').click();
        await settle();
        expect(place()).toBeNull();
    });

    it('steps with real buttons named in words, 44px, keyboard reachable, disabled at the ends', async () => {
        open([series()]);
        await settle();
        for (const b of [prev()!, next()!]) {
            expect(b.tagName).toBe('BUTTON');
            expect(b.getAttribute('type')).toBe('button');
            expect(b.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
            expect(b.className).toMatch(/focus-visible:outline/);
            // Words, never an arrow character, for the name and the text.
            expect(b.textContent).not.toMatch(/[→←<>‹›]/);
        }
        expect(prev()!.disabled).toBe(true);
        expect(next()!.disabled).toBe(false);
        next()!.focus();
        expect(document.activeElement).toBe(next());
        for (const want of ['2 of 4', '3 of 4', '4 of 4']) {
            next()!.click();
            await settle();
            expect(place()).toBe(want);
        }
        expect(next()!.disabled).toBe(true);
        expect(prev()!.disabled).toBe(false);
        prev()!.click();
        await settle();
        expect(place()).toBe('3 of 4');
    });

    it('shows the current slide, each with its place in its footer, and its own fixed headline', async () => {
        open([series()]);
        await settle();
        const expected = ['Governor seat in Nairobi City', 'County leaders in Nairobi City', 'MP seats in Nairobi City', 'MCA seats in Nairobi City'];
        for (let i = 0; i < 4; i++) {
            if (i) {
                next()!.click();
                await settle();
            }
            expect(pageText()).toBe(`${i + 1} of 4`);
            expect(previewHeadline()).toContain(expected[i]);
            expect(document.querySelector('#view-headline')).toBeNull();
            expect(document.querySelector('[data-fixed-headline]')?.textContent?.trim()).toBe(real.headlineOf(SLIDES[i]));
            expect(document.body.textContent).toContain('This card’s headline is fixed, so it stays neutral.');
        }
    });

    it('a card outside a series has no page text', async () => {
        open([plain, series()]);
        await settle();
        expect(pageText()).toBeNull();
    });

    it('offers only the sizes every slide has, in the first slide’s order', async () => {
        vi.mocked(shareView.sizesOf).mockImplementation((v) =>
            v.kind === 'leaders' ? ['story', 'portrait'] : real.sizesOf(v),
        );
        open([series()]);
        await settle();
        expect(sizes()).toEqual(['portrait', 'story']);
        // The same on every slide: the sizes are the series', not the slide's.
        next()!.click();
        await settle();
        expect(sizes()).toEqual(['portrait', 'story']);
    });

    it('keeps each slide’s maps apart in the cache, though their slot and box are the same', async () => {
        open([series()]);
        await settle();
        expect(renders).toHaveLength(1);
        renders[0].resolve('data:image/png;base64,ONE');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,ONE');
        next()!.click();
        await settle();
        // Not the first slide's map: its own is drawn.
        expect(renders).toHaveLength(2);
        expect(previewMap()).toBeNull();
        renders[1].resolve('data:image/png;base64,TWO');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,TWO');
        // Back to the first: from the cache, drawn once.
        prev()!.click();
        await settle();
        expect(renders).toHaveLength(2);
        expect(previewMap()).toBe('data:image/png;base64,ONE');
    });

    it('never shows another slide’s map when it steps while a map is drawing', async () => {
        open([series()]);
        await settle();
        next()!.click();
        await settle();
        renders[0].resolve('data:image/png;base64,ONE');
        await settle();
        expect(previewMap()).toBeNull();
        expect(svgToPng).not.toHaveBeenCalled();
        const second = renders.at(-1)!;
        expect(second).not.toBe(renders[0]);
        second.resolve('data:image/png;base64,TWO');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,TWO');
        expect(svgToPng).toHaveBeenCalledTimes(1);
    });

    it('gives the first slide’s caption on every slide', async () => {
        open([series()]);
        await drawAll();
        const first = caption();
        expect(first).toContain('Governor');
        next()!.click();
        next()!.click();
        await drawAll();
        expect(caption()).toBe(first);
    });

    it('"Download PNG" saves the current slide, named with its place', async () => {
        open([series()]);
        await drawAll();
        next()!.click();
        await drawAll();
        button('Download PNG')!.click();
        await settle();
        expect(share.downloadBlob).toHaveBeenCalledTimes(1);
        const name = vi.mocked(share.downloadBlob).mock.calls[0][1];
        expect(name).toBe(real.filenameOf(SLIDES[1], 'square').replace(/\.png$/, '-2-of-4.png'));
        expect(status()).toBe(`Saved ${name}`);
    });

    it('"Download all 4" draws every slide in turn, saying which, and saves four files in order', async () => {
        open([series()]);
        await drawAll();
        next()!.click();
        await drawAll();
        const all = button('Download all 4')!;
        expect(all).not.toBeNull();
        all.click();
        const seen: string[] = [];
        for (let round = 0; round < 20 && !vi.mocked(share.downloadBlob).mock.calls.length; round++) {
            await settle();
            seen.push(status());
            await drawAll('ALL');
        }
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(seen.some((s) => /^Drawing [1-4] of 4/.test(s))).toBe(true);
        const names = vi.mocked(share.downloadBlob).mock.calls.map((c) => c[1]);
        expect(names).toEqual(
            SLIDES.map((s, i) => real.filenameOf(s, 'square').replace(/\.png$/, `-${i + 1}-of-4.png`)),
        );
        // Each file is its own slide's image.
        const blobs = vi.mocked(share.downloadBlob).mock.calls.map((c) => c[0]);
        expect(new Set(blobs).size).toBe(4);
        expect(status()).toMatch(/^Saved 4 images/);
        // The person is back on the slide they were looking at.
        expect(place()).toBe('2 of 4');
    });

    it('stops "Download all" when the dialog is closed, and saves nothing', async () => {
        const w = open([series()]);
        await drawAll();
        button('Download all 4')!.click();
        await settle();
        await w.setProps({ open: false });
        await drawAll('LATE');
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(share.downloadBlob).not.toHaveBeenCalled();
    });

    it('a slide that cannot be drawn gives the usual error and saves nothing', async () => {
        open([series()]);
        await drawAll();
        button('Download all 4')!.click();
        for (let round = 0; round < 10; round++) {
            await settle();
            const waiting = renders.filter((r) => !(r as { done?: boolean }).done);
            for (const r of waiting) {
                (r as { done?: boolean }).done = true;
                // The third slide's map fails.
                if (r.spec.seat === 'mp') r.reject(new Error('no WebGL'));
                else r.resolve('data:image/png;base64,OK');
            }
        }
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(share.downloadBlob).not.toHaveBeenCalled();
        expect(status()).toContain('The map could not be drawn on this device');
        expect(status()).not.toMatch(/Saved/);
    });

    it('shares every slide’s file in one call where the device shares files', async () => {
        vi.mocked(share.canShareFiles).mockReturnValue(true);
        open([series()]);
        await drawAll();
        const shareAll = button('Share all 4')!;
        expect(shareAll).not.toBeNull();
        shareAll.click();
        for (let round = 0; round < 20 && !vi.mocked(share.shareFiles).mock.calls.length; round++)
            await drawAll('SHARE');
        await settle();
        expect(share.shareFiles).toHaveBeenCalledTimes(1);
        const [files] = vi.mocked(share.shareFiles).mock.calls[0];
        expect(files.map((f) => f.filename)).toEqual(
            SLIDES.map((s, i) => real.filenameOf(s, 'square').replace(/\.png$/, `-${i + 1}-of-4.png`)),
        );
        expect(share.downloadBlob).not.toHaveBeenCalled();
    });

    it('makes the county carousel’s four files, cover first, in portrait by default', async () => {
        const card = shareView.carouselCard({ seats: NUMBERS_SEATS, index: numbersIndex, county: 37, theme: 'light' })!;
        mount(ShareViewDialog, {
            props: { open: true, view: card.view, cards: [card], context: { ...context, index: numbersIndex, seats: NUMBERS_SEATS } },
            attachTo: document.body,
        });
        await drawAll();
        expect(sizes()).toEqual(['portrait', 'story']);
        expect(document.querySelector('[data-fixed-headline]')?.textContent?.trim()).toBe('Who holds Kakamega’s 75 elected seats');
        expect(pageText()).toBe('1 of 4');
        button('Download all 4')!.click();
        for (let round = 0; round < 20 && !vi.mocked(share.downloadBlob).mock.calls.length; round++) await drawAll('ALL');
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(vi.mocked(share.downloadBlob).mock.calls.map((c) => c[1])).toEqual([
            'kenya-electoral-map-county-37-cover-portrait-1-of-4.png',
            'kenya-electoral-map-leaders-county-37-portrait-2-of-4.png',
            'kenya-electoral-map-mp-county-37-portrait-3-of-4.png',
            'kenya-electoral-map-mca-county-37-portrait-4-of-4.png',
        ]);
    });
});
