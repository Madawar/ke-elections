// The share dialog's general ability for a card to carry one choice of its own (Task G1): a
// labelled native select under the "Card" choice while that card is picked, and `make(value)`
// replacing the card's view when it changes. The card here is a mock: its choice picks a seat,
// but the dialog only sees values, labels and views, so this is what it does for any choice.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { ShareCard, ShareableView } from '@/lib/export/shareView';
import { snapshotView } from '@/lib/export/viewState';
import type { SeatKey } from '@/lib/seats';
import { VIEW_SEATS, viewIndex } from './viewFixtures';
import { NUMBERS_SEATS, numbersIndex } from './numbersFixtures';

// Map drawing is a deferred we resolve by hand; rasterising returns a PNG at once.
const renders: {
    spec: { seat?: string };
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
}[] = [];
vi.mock('@/lib/export/viewMap', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/viewMap')>()),
    renderViewMap: vi.fn(
        (spec: { seat?: string }) =>
            new Promise<string>((resolve, reject) =>
                renders.push({ spec, resolve, reject }),
            ),
    ),
}));
vi.mock('@/lib/export/rasterize', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/rasterize')>()),
    svgToPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
vi.mock('@/lib/export/shareView', async (actual) => {
    const real = await actual<typeof import('@/lib/export/shareView')>();
    return { ...real, mapSlotsOf: vi.fn(real.mapSlotsOf) };
});

const shareView = await import('@/lib/export/shareView');
const { svgToPng } = await import('@/lib/export/rasterize');
const { default: ShareViewDialog } =
    await import('@/components/export/ShareViewDialog.vue');

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
const context = {
    manifest: {},
    provinceOfCounty: new Map<number, number>(),
    index: viewIndex,
    seats: VIEW_SEATS,
};

/** Every view's one map has the same key and box: only the cache key can keep them apart. */
const SHARED = (v: ShareableView) => [
    { key: 'map', box: { x: 0, y: 0, w: 500, h: 400 }, spec: v as never },
];

const make = vi.fn((value: string) => seatView(value as SeatKey));
const remember = vi.fn();
const plain: ShareCard = { key: 'view', label: 'This view', view: seatView('mp') };
const choosing = (value = 'mca'): ShareCard => ({
    key: 'chosen',
    label: 'Chosen',
    view: seatView(value as SeatKey),
    choice: {
        label: 'Compare with',
        options: [
            { value: 'mca', label: 'The first' },
            { value: 'governor', label: 'The second' },
        ],
        value,
        make,
        remember,
    },
});

async function settle() {
    for (let i = 0; i < 6; i++) {
        await flushPromises();
        await nextTick();
        await new Promise((r) => setTimeout(r, 0));
    }
}
const select = () =>
    document.querySelector<HTMLSelectElement>('select[data-card-choice]');
const pick = async (value: string) => {
    const s = select()!;
    s.value = value;
    s.dispatchEvent(new Event('change'));
    await settle();
};
const cardOption = (value: string) =>
    document.querySelector<HTMLInputElement>(
        `input[name="view-card"][value="${value}"]`,
    )!;
const download = () =>
    [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Download PNG',
    )!;
const previewMap = () =>
    document.querySelector('[data-preview] image[data-map]')?.getAttribute('href') ??
    null;
const headlineInput = () =>
    document.querySelector<HTMLInputElement>('#view-headline')!;
const caption = () =>
    document.querySelector<HTMLTextAreaElement>('#view-caption')!.value;
const open = (cards: ShareCard[]) =>
    mount(ShareViewDialog, {
        props: { open: true, view: cards[0].view, cards, context },
        attachTo: document.body,
    });

describe('ShareViewDialog: a card with a choice of its own', () => {
    beforeEach(() => {
        renders.length = 0;
        make.mockClear();
        remember.mockClear();
        vi.mocked(svgToPng).mockClear();
        vi.mocked(shareView.mapSlotsOf).mockImplementation((_s, v) => SHARED(v));
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('shows a labelled select under the "Card" choice only while a card with a choice is picked', async () => {
        open([plain, choosing()]);
        await settle();
        expect(select()).toBeNull();
        cardOption('chosen').click();
        await settle();
        const s = select()!;
        expect(s).not.toBeNull();
        // Its options in the order given, by value and label; the card's value is selected.
        expect([...s.options].map((o) => [o.value, o.textContent?.trim()])).toEqual([
            ['mca', 'The first'],
            ['governor', 'The second'],
        ]);
        expect(s.value).toBe('mca');
        // A visible label tied to it.
        const label = document.querySelector(`label[for="${s.id}"]`);
        expect(s.id).not.toBe('');
        expect(label?.textContent?.trim()).toBe('Compare with');
        expect(label?.classList.contains('sr-only')).toBe(false);
        // Under the "Card" choice, before the sizes.
        const cards = cardOption('chosen').closest('fieldset')!;
        const sizes = document.querySelector('input[name="view-size"]')!;
        expect(cards.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(s.compareDocumentPosition(sizes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        cardOption('view').click();
        await settle();
        expect(select()).toBeNull();
    });

    it('is a native select reached by keyboard, with a target 44px high', async () => {
        open([choosing()]);
        await settle();
        const s = select()!;
        expect(s.tagName).toBe('SELECT');
        expect(s.disabled).toBe(false);
        expect(s.tabIndex).toBe(0);
        s.focus();
        expect(document.activeElement).toBe(s);
        // h-11 is 44px; the label sits above it, not inside the target.
        expect(s.className.split(/\s+/)).toContain('h-11');
        expect(s.className).toMatch(/focus-visible:outline/);
    });

    it('shows the select for a card that is alone in the list too', async () => {
        open([choosing()]);
        await settle();
        expect(document.querySelector('input[name="view-card"]')).toBeNull();
        expect(select()?.value).toBe('mca');
    });

    it('rebuilds the preview with the view `make` gives, resets the headline and calls back with the value', async () => {
        open([choosing()]);
        await settle();
        expect(make).not.toHaveBeenCalled();
        expect(renders.map((r) => r.spec.seat)).toEqual(['mca']);
        renders[0].resolve('data:image/png;base64,FIRST');
        await settle();
        expect(headlineInput().value).toContain('MCA seats in Nairobi City');
        const input = headlineInput();
        input.value = 'An edited headline';
        input.dispatchEvent(new Event('input'));
        await settle();
        await pick('governor');
        expect(make).toHaveBeenCalledWith('governor');
        expect(remember).toHaveBeenCalledWith('governor');
        // The new view's map is drawn, its own headline is back, and the caption follows.
        expect(renders.map((r) => r.spec.seat)).toEqual(['mca', 'governor']);
        expect(headlineInput().value).toContain('Governor seat in Nairobi City');
        expect(caption()).not.toContain('MCA seats');
        expect(
            [...document.querySelectorAll('[data-preview] [data-headline]')]
                .map((t) => t.textContent?.trim())
                .join(' '),
        ).not.toContain('MCA');
        expect(download().disabled).toBe(true);
        renders[1].resolve('data:image/png;base64,SECOND');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,SECOND');
        expect(download().disabled).toBe(false);
    });

    it('keeps the two picks’ maps apart in the cache, though their slot and box are the same', async () => {
        open([choosing()]);
        await settle();
        renders[0].resolve('data:image/png;base64,FIRST');
        await settle();
        await pick('governor');
        // Not the first pick's map: its own is drawn.
        expect(renders).toHaveLength(2);
        expect(previewMap()).toBeNull();
        renders[1].resolve('data:image/png;base64,SECOND');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,SECOND');
        // Back to the first: its map comes from the cache, drawn once.
        await pick('mca');
        expect(renders).toHaveLength(2);
        expect(previewMap()).toBe('data:image/png;base64,FIRST');
        expect(download().disabled).toBe(false);
    });

    it('never shows the other pick’s map when the pick changes while a map is drawing', async () => {
        open([choosing()]);
        await settle();
        expect(renders).toHaveLength(1);
        // Changed while the first pick's map is still drawing.
        await pick('governor');
        renders[0].resolve('data:image/png;base64,FIRST');
        await settle();
        expect(previewMap()).toBeNull();
        expect(svgToPng).not.toHaveBeenCalled();
        expect(renders).toHaveLength(2);
        renders[1].resolve('data:image/png;base64,SECOND');
        await settle();
        expect(previewMap()).toBe('data:image/png;base64,SECOND');
        expect(svgToPng).toHaveBeenCalledTimes(1);
    });

    it('keeps the pick while the person looks at another card, and starts again from the card’s value when opened anew', async () => {
        const w = open([plain, choosing()]);
        await settle();
        cardOption('chosen').click();
        await settle();
        await pick('governor');
        cardOption('view').click();
        await settle();
        cardOption('chosen').click();
        await settle();
        expect(select()!.value).toBe('governor');
        expect(headlineInput().value).toContain('Governor seat in');
        // New cards from the page: the card's own value again.
        await w.setProps({ cards: [plain, choosing('mca')], view: plain.view });
        await settle();
        cardOption('chosen').click();
        await settle();
        expect(select()!.value).toBe('mca');
        expect(headlineInput().value).toContain('MCA seats');
    });

    it('keeps the pick when `remember` throws', async () => {
        const card = choosing();
        card.choice!.remember = () => {
            throw new Error('storage full');
        };
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        open([card]);
        await settle();
        await pick('governor');
        expect(make).toHaveBeenCalledWith('governor');
        expect(select()!.value).toBe('governor');
        expect(headlineInput().value).toContain('Governor seat in');
        errors.mockRestore();
    });

    it('shows no select for a choice with no options, and the card still works', async () => {
        const card = choosing();
        card.choice = { ...card.choice!, options: [] };
        open([card]);
        await settle();
        expect(select()).toBeNull();
        expect(document.querySelector('label[for="view-card-choice"]')).toBeNull();
        renders[0].resolve('data:image/png;base64,FIRST');
        await settle();
        expect(download().disabled).toBe(false);
    });

    it('works with no `remember` at all', async () => {
        const card = choosing();
        delete card.choice!.remember;
        open([card]);
        await settle();
        await pick('governor');
        expect(make).toHaveBeenCalledWith('governor');
        expect(headlineInput().value).toContain('Governor seat in');
    });

    it('makes "Side by side" with its "Compare with" choice: the fixed headline follows the pick', async () => {
        const remember = vi.fn();
        const card = shareView.versusCard({
            seats: NUMBERS_SEATS,
            index: numbersIndex,
            seat: 'mca',
            county: 47,
            theme: 'light',
            remembered: null,
            remember,
        });
        mount(ShareViewDialog, {
            props: {
                open: true,
                view: card.view,
                cards: [card],
                context: { ...context, index: numbersIndex, seats: NUMBERS_SEATS },
            },
            attachTo: document.body,
        });
        await settle();
        const fixed = () => document.querySelector('[data-fixed-headline]')?.textContent?.trim();
        expect(fixed()).toBe('MCA seats: Mombasa and Nairobi City');
        expect(document.querySelector('label[for="view-card-choice"]')?.textContent?.trim()).toBe('Compare with');
        expect(select()!.options).toHaveLength(46);
        expect(select()!.value).toBe('1');
        await pick('22');
        expect(fixed()).toBe('MCA seats: Kiambu and Nairobi City');
        expect(remember).toHaveBeenCalledWith('22');
        expect(document.body.textContent).toContain('This card’s headline is fixed, so it stays neutral.');
    });
});
