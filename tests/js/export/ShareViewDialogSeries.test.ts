// The share dialog's general ability for a card in its list to be a series of slides (Task H1):
// a "Slide" stepper under the "Card" choice, the sizes every slide has, "2 of 4" in each slide's
// footer, fixed headlines, each slide's maps kept apart in the cache, "Download PNG" for the
// current slide and "Download all" for every slide in turn. The slides here are mocks of other
// kinds (a seat view, a leaders card); the dialog only knows "this entry has slides".
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { siteUrl } from '@/lib/export/format';
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
/** Every dialog mounted by a test, unmounted after it so no run of one test reaches the next. */
const mounted: { unmount(): void }[] = [];
const open = (cards: ShareCard[]) => {
    const w = mount(ShareViewDialog, {
        props: { open: true, view: cards[0].view, cards, context },
        attachTo: document.body,
    });
    mounted.push(w);
    return w;
};
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
        for (const w of mounted.splice(0)) w.unmount();
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

    it('steps with real buttons named in words, 44px, keyboard reachable, marked disabled at the ends', async () => {
        open([series()]);
        await settle();
        for (const b of [prev()!, next()!]) {
            expect(b.tagName).toBe('BUTTON');
            expect(b.getAttribute('type')).toBe('button');
            expect(b.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
            expect(b.className).toMatch(/focus-visible:outline/);
            // Words, never an arrow character, for the name and the text.
            expect(b.textContent).not.toMatch(/[→←<>‹›]/);
            // Never the disabled attribute, which would drop the keyboard focus.
            expect(b.disabled).toBe(false);
        }
        expect(prev()!.getAttribute('aria-disabled')).toBe('true');
        expect(next()!.getAttribute('aria-disabled')).toBe('false');
        next()!.focus();
        expect(document.activeElement).toBe(next());
        for (const want of ['2 of 4', '3 of 4', '4 of 4']) {
            next()!.click();
            await settle();
            expect(place()).toBe(want);
        }
        expect(next()!.getAttribute('aria-disabled')).toBe('true');
        expect(prev()!.getAttribute('aria-disabled')).toBe('false');
        prev()!.click();
        await settle();
        expect(place()).toBe('3 of 4');
    });

    it('keeps the keyboard focus on "Next slide" when it reaches the last slide, and a further press does nothing', async () => {
        open([series()]);
        await settle();
        next()!.focus();
        for (let i = 0; i < 3; i++) {
            next()!.click();
            await settle();
        }
        expect(place()).toBe('4 of 4');
        expect(document.activeElement).toBe(next());
        expect(next()!.getAttribute('aria-disabled')).toBe('true');
        expect(next()!.className).toMatch(/aria-disabled:opacity-40/);
        next()!.click();
        await settle();
        expect(place()).toBe('4 of 4');
        expect(document.activeElement).toBe(next());
        // The same at the start for "Previous slide".
        for (let i = 0; i < 3; i++) {
            prev()!.click();
            await settle();
        }
        prev()!.focus();
        prev()!.click();
        await settle();
        expect(place()).toBe('1 of 4');
        expect(document.activeElement).toBe(prev());
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

    it('gives every slide the series’ link, the first slide’s, so every footer shows the same line', async () => {
        open([series()]);
        await settle();
        const link = siteUrl(SLIDES[0].path).replace(/^https?:\/\//, '');
        const feet: string[] = [];
        for (let i = 0; i < 4; i++) {
            if (i) {
                next()!.click();
                await settle();
            }
            const el = document.querySelector('[data-preview] [data-link]')!;
            expect(el.textContent).toBe(`${i + 1} of 4${link}`);
            const brand = [...document.querySelectorAll('[data-preview] [data-footer] text')].some((t) => t.textContent === 'Kenya Electoral Map');
            feet.push(JSON.stringify([el.getAttribute('x'), el.getAttribute('font-size'), el.getAttribute('text-anchor'), brand]));
        }
        expect(new Set(feet).size).toBe(1);
        // The slides' own links differ: the series' link is not any slide's own but the first's.
        expect(new Set(SLIDES.map((v) => v.path)).size).toBe(4);
    });

    it('a card outside a series keeps its own link', async () => {
        open([plain, series()]);
        await settle();
        expect(document.querySelector('[data-preview] [data-link]')).toBeNull();
        const texts = [...document.querySelectorAll('[data-preview] [data-footer] text')].map((t) => t.textContent);
        expect(texts.at(-1)).toBe(siteUrl(plain.view.path).replace(/^https?:\/\//, ''));
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

    it('keeps the focus on "Download all 4" while it runs, ignores a second press, and has one live region speak', async () => {
        open([series()]);
        await drawAll();
        const all = button('Download all 4')!;
        all.focus();
        all.click();
        await settle();
        expect(document.activeElement).toBe(all);
        expect(all.disabled).toBe(false);
        expect(all.getAttribute('aria-disabled')).toBe('true');
        // On the second slide, "Download all" and the stepper are pressed: nothing changes.
        for (let round = 0; round < 40 && status() !== 'Drawing 2 of 4…'; round++) {
            await settle();
            const waiting = renders.find((r) => !(r as { done?: boolean }).done);
            if (waiting) {
                (waiting as { done?: boolean }).done = true;
                waiting.resolve('data:image/png;base64,ALL');
            }
        }
        expect(status()).toBe('Drawing 2 of 4…');
        // Every line the progress region shows from here on.
        const lines: string[] = [];
        const region = document.querySelector('[aria-live="polite"]')!;
        const watch = new MutationObserver(() => lines.push(region.textContent?.trim() ?? ''));
        watch.observe(region, { childList: true, subtree: true, characterData: true });
        all.click();
        prev()!.click();
        await settle();
        expect(place()).toBe('2 of 4');
        next()!.click();
        await settle();
        expect(place()).toBe('2 of 4');
        expect(status()).toBe('Drawing 2 of 4…');
        all.focus();
        const speaking = () =>
            [...document.querySelectorAll('[role="dialog"] [aria-live], [role="dialog"] [role="status"]')]
                .filter((el) => el.getAttribute('aria-live') !== 'off' && /of 4/.test(el.textContent ?? ''))
                .map((el) => el.textContent?.trim());
        const seen: string[][] = [];
        for (let round = 0; round < 20 && !vi.mocked(share.downloadBlob).mock.calls.length; round++) {
            await settle();
            if (status().startsWith('Drawing')) seen.push(speaking());
            // Never back to the first slide: the second press started nothing.
            expect(status()).not.toBe('Drawing 1 of 4…');
            expect(document.activeElement).toBe(all);
            await drawAll('ALL');
        }
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        watch.disconnect();
        // The second press started no run of its own: never back to the first slide.
        expect(lines).not.toContain('Drawing 1 of 4…');
        expect([...new Set(lines.filter((l) => /^Drawing \d/.test(l)))]).toEqual(['Drawing 3 of 4…', 'Drawing 4 of 4…']);
        expect(seen.length).toBeGreaterThan(0);
        for (const s of seen) {
            expect(s).toHaveLength(1);
            expect(s[0]).toMatch(/^Drawing [1-4] of 4/);
        }
        expect(share.downloadBlob).toHaveBeenCalledTimes(4);
        expect(document.activeElement).toBe(all);
        expect(all.getAttribute('aria-disabled')).toBe('false');
        // Out of a run the slide's place is a status again.
        expect(document.querySelector('[data-slide-place]')!.getAttribute('aria-live')).not.toBe('off');
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

    /** Press "Download all 4" (or "Share all 4") and draw every map until `done()`. */
    async function runAll(name: string, done: () => boolean, tag = 'ALL') {
        button(name)!.click();
        for (let round = 0; round < 25 && !done(); round++) await drawAll(tag);
    }
    const saved = () => vi.mocked(share.downloadBlob).mock.calls;

    it('saves nothing more when the dialog is closed while the files are being saved', async () => {
        const w = open([series()]);
        await drawAll();
        await runAll('Download all 4', () => saved().length > 0);
        // The first file is saved; the next three are 250 ms apart.
        expect(saved()).toHaveLength(1);
        await w.setProps({ open: false });
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(saved()).toHaveLength(1);
    });

    it('saves nothing when the dialog is closed and opened again while the slides are drawn', async () => {
        const w = open([series()]);
        await drawAll();
        button('Download all 4')!.click();
        // One map at a time, until the run is on the second slide.
        for (let round = 0; round < 40 && !/^Drawing [2-4]/.test(status()); round++) {
            await settle();
            const waiting = renders.find((r) => !(r as { done?: boolean }).done);
            if (waiting) {
                (waiting as { done?: boolean }).done = true;
                waiting.resolve('data:image/png;base64,ALL');
            }
        }
        expect(status()).toMatch(/^Drawing [2-4] of 4/);
        // Closed and opened again before the run reaches its saving: that run is over.
        await w.setProps({ open: false });
        await w.setProps({ open: true });
        await drawAll('AGAIN');
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(saved()).toHaveLength(0);
    });

    it('a second "Download all" in the same size and colours reuses the images made the first time', async () => {
        open([series()]);
        await drawAll();
        await runAll('Download all 4', () => saved().length === 4);
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        const first = saved().map((c) => c[0]);
        const made = vi.mocked(svgToPng).mock.calls.length;
        await runAll('Download all 4', () => saved().length === 8);
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(saved().slice(4).map((c) => c[0])).toEqual(first);
        expect(vi.mocked(svgToPng).mock.calls.length).toBe(made);
    });

    for (const [what, pick] of [
        ['size', () => document.querySelector<HTMLInputElement>('input[name="view-size"][value="portrait"]')!.click()],
        ['colours', () => document.querySelector<HTMLInputElement>('input[name="view-theme"][value="light"]')!.click()],
    ] as const)
        it(`makes the images again when the ${what} changed between two "Download all"`, async () => {
            open([series()]);
            await drawAll();
            await runAll('Download all 4', () => saved().length === 4);
            await new Promise((r) => setTimeout(r, 1200));
            await settle();
            const first = saved().map((c) => c[0]);
            pick();
            await drawAll('OTHER');
            await runAll('Download all 4', () => saved().length === 8);
            await new Promise((r) => setTimeout(r, 1200));
            await settle();
            const second = saved().slice(4);
            expect(second).toHaveLength(4);
            for (const [blob] of second) expect(first).not.toContain(blob);
            if (what === 'size') for (const [, name] of second) expect(name).toMatch(/-portrait-\d-of-4\.png$/);
        });

    it('when the browser blocks the share (the tap was too long ago), says to tap again, and the second tap shares the same images', async () => {
        vi.mocked(share.canShareFiles).mockReturnValue(true);
        vi.mocked(share.shareFiles).mockResolvedValueOnce('blocked');
        open([series()]);
        await drawAll();
        await runAll('Share all 4', () => vi.mocked(share.shareFiles).mock.calls.length > 0, 'SHARE');
        await settle();
        expect(status()).toBe('The 4 images are ready. Tap Share all 4 again to send them.');
        const made = vi.mocked(svgToPng).mock.calls.length;
        button('Share all 4')!.click();
        await settle();
        expect(share.shareFiles).toHaveBeenCalledTimes(2);
        const [a, b] = vi.mocked(share.shareFiles).mock.calls;
        expect(b[0]).toEqual(a[0]);
        expect(vi.mocked(svgToPng).mock.calls.length).toBe(made);
        expect(share.downloadBlob).not.toHaveBeenCalled();
    });

    it('saves the four files where the device cannot share them all', async () => {
        vi.mocked(share.canShareFiles).mockReturnValue(true);
        vi.mocked(share.shareFiles).mockResolvedValueOnce('unavailable');
        open([series()]);
        await drawAll();
        await runAll('Share all 4', () => vi.mocked(share.shareFiles).mock.calls.length > 0, 'SHARE');
        await new Promise((r) => setTimeout(r, 1200));
        await settle();
        expect(saved().map((c) => c[1])).toEqual(
            SLIDES.map((v, i) => real.filenameOf(v, 'square').replace(/\.png$/, `-${i + 1}-of-4.png`)),
        );
        expect(status()).toMatch(/^Saved 4 images/);
    });

    it('orders a series’ buttons with the primary one first', async () => {
        open([series()]);
        await settle();
        const names = () => [...document.querySelectorAll('[data-series-actions] button')].map((b) => b.textContent?.trim());
        expect(names()).toEqual(['Download all 4', 'Download PNG', 'Copy caption']);
        for (const w of mounted.splice(0)) w.unmount();
        vi.mocked(share.canShareFiles).mockReturnValue(true);
        open([series()]);
        await settle();
        expect(names()).toEqual(['Share all 4', 'Download PNG', 'Download all 4', 'Copy caption']);
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
