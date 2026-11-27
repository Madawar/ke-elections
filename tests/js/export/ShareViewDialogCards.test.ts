// The share dialog with cards of more than one shape: a card with several map images, a card
// with fewer sizes and a card whose headline is fixed. No kind of card is like that until the
// later share formats, so the registry's answers for the leaders card are replaced here; the
// dialog only asks the registry, so this is what it does for any such card.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { leadersCardView } from '@/lib/export/leadersCard';
import type { ShareableView } from '@/lib/export/shareView';
import { snapshotView } from '@/lib/export/viewState';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

// Map drawing is a deferred we resolve by hand; rasterising returns a PNG at once.
const renders: {
    box: string;
    spec: unknown;
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
}[] = [];
vi.mock('@/lib/export/viewMap', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/viewMap')>()),
    renderViewMap: vi.fn(
        (
            spec: unknown,
            _c: unknown,
            _t: unknown,
            box: { w: number; h: number },
        ) =>
            new Promise<string>((resolve, reject) =>
                renders.push({
                    box: `${box.w}x${box.h}`,
                    spec,
                    resolve,
                    reject,
                }),
            ),
    ),
}));
vi.mock('@/lib/export/rasterize', async (actual) => ({
    ...(await actual<typeof import('@/lib/export/rasterize')>()),
    svgToPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
vi.mock('@/lib/export/shareView', async (actual) => {
    const real = await actual<typeof import('@/lib/export/shareView')>();
    return {
        ...real,
        mapSlotsOf: vi.fn(real.mapSlotsOf),
        componentOf: vi.fn(real.componentOf),
        sizesOf: vi.fn(real.sizesOf),
        headlineEditable: vi.fn(real.headlineEditable),
    };
});

const shareView = await import('@/lib/export/shareView');
const real = await vi.importActual<typeof import('@/lib/export/shareView')>(
    '@/lib/export/shareView',
);
const { svgToPng } = await import('@/lib/export/rasterize');
const { default: ShareViewDialog } =
    await import('@/components/export/ShareViewDialog.vue');

const view = snapshotView({
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
const context = {
    manifest: {},
    provinceOfCounty: new Map<number, number>(),
    index: viewIndex,
    seats: VIEW_SEATS,
};
const isLeaders = (v: ShareableView) => v.kind === 'leaders';
/** Three maps for the leaders card, each its own box and spec. */
const SLOTS = ['first', 'second', 'third'].map((key, i) => ({
    key,
    box: { x: 0, y: 100 * i, w: 300 + i, h: 200 + i },
    spec: { ...leaders, focus: { ...leaders.focus, code: 47 + i } },
}));

/**
 * The card the dialog draws for the mocked leaders card: one image per slot it is handed, by slot
 * key, so a test can see each slot's image reach the preview. Every set of images it is drawn
 * with is kept in `drawnWith`.
 */
const drawnWith: string[][] = [];
const SlotCard = defineComponent({
    props: {
        view: { type: Object, required: true },
        size: { type: String, required: true },
        headline: { type: String, required: true },
        mapImage: { type: String, default: null },
        mapImages: { type: Object, required: true },
        mapPlaceholder: { type: String, default: '' },
        mapAspect: { type: Number, default: 1 },
        url: { type: String, required: true },
        theme: { type: Object, required: true },
    },
    setup(props) {
        return () => {
            const images = props.mapImages as Record<string, string>;
            drawnWith.push(Object.keys(images));
            return h('svg', { viewBox: '0 0 1080 1080' }, [
                h('text', { 'data-headline': '' }, props.headline),
                ...Object.entries(images).map(([key, href]) =>
                    h('image', { 'data-slot': key, href }),
                ),
            ]);
        };
    },
});
const slotImages = () =>
    Object.fromEntries(
        [...document.querySelectorAll('[data-preview] image[data-slot]')].map(
            (i) => [i.getAttribute('data-slot'), i.getAttribute('href')],
        ),
    );
/** The one map both cards share in some tests: the same key and the same box. */
const SHARED = (v: ShareableView) => [
    {
        key: 'map',
        box: { x: 0, y: 0, w: 500, h: 400 },
        spec: v as never,
    },
];

async function settle() {
    for (let i = 0; i < 6; i++) {
        await flushPromises();
        await nextTick();
        await new Promise((r) => setTimeout(r, 0));
    }
}
const download = () =>
    [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Download PNG',
    )!;
const cardOption = (value: string) =>
    document.querySelector<HTMLInputElement>(
        `input[name="view-card"][value="${value}"]`,
    )!;
const sizeInputs = () => [
    ...document.querySelectorAll<HTMLInputElement>('input[name="view-size"]'),
];
const open = (cards: ShareableView[]) =>
    mount(ShareViewDialog, {
        props: {
            open: true,
            view: cards[0],
            cards: shareView.shareCards(cards),
            context,
        },
        attachTo: document.body,
    });

describe('ShareViewDialog: cards of other shapes', () => {
    beforeEach(() => {
        renders.length = 0;
        drawnWith.length = 0;
        vi.mocked(svgToPng).mockClear();
        vi.mocked(shareView.componentOf).mockImplementation((v) =>
            isLeaders(v) ? SlotCard : real.componentOf(v),
        );
        localStorage.setItem('km.viewSize', JSON.stringify('square'));
        vi.mocked(shareView.mapSlotsOf).mockImplementation((size, v, text) =>
            isLeaders(v) ? SLOTS : real.mapSlotsOf(size, v, text),
        );
        vi.mocked(shareView.sizesOf).mockImplementation(real.sizesOf);
        vi.mocked(shareView.headlineEditable).mockImplementation(
            real.headlineEditable,
        );
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('draws every map of a card, one at a time and in order, before it makes the PNG', async () => {
        open([leaders]);
        await settle();
        // One at a time: the second waits for the first.
        expect(renders.map((r) => r.box)).toEqual(['300x200']);
        renders[0].resolve('data:image/png;base64,A');
        await settle();
        expect(renders.map((r) => r.box)).toEqual(['300x200', '301x201']);
        expect(svgToPng).not.toHaveBeenCalled();
        expect(download().disabled).toBe(true);
        renders[1].resolve('data:image/png;base64,B');
        await settle();
        expect(svgToPng).not.toHaveBeenCalled();
        renders[2].resolve('data:image/png;base64,C');
        await settle();
        // Each map from its own spec, in the layout's order.
        expect(renders.map((r) => r.spec)).toEqual(SLOTS.map((s) => s.spec));
        expect(svgToPng).toHaveBeenCalledTimes(1);
        expect(download().disabled).toBe(false);
        // Every slot's image reaches the card in the preview, under its own key.
        expect(slotImages()).toEqual({
            first: 'data:image/png;base64,A',
            second: 'data:image/png;base64,B',
            third: 'data:image/png;base64,C',
        });
    });

    it('draws the maps a card skipped once more when the person comes back, clearing the preview once', async () => {
        open([view, leaders]);
        await settle();
        renders[0].resolve('data:image/png;base64,VIEW');
        await settle();
        cardOption('leaders').click();
        await settle();
        // The first of its three maps is drawing when the person goes back to the view.
        expect(renders).toHaveLength(2);
        cardOption('view').click();
        await settle();
        expect(download().disabled).toBe(false);
        // The first finishes; the other two are skipped, as nobody waits for them now.
        renders[1].resolve('data:image/png;base64,L1');
        await settle();
        expect(renders).toHaveLength(2);
        drawnWith.length = 0;
        cardOption('leaders').click();
        await settle();
        // Each skipped map is drawn once more, one at a time; the drawn one is not.
        expect(renders).toHaveLength(3);
        renders[2].resolve('data:image/png;base64,L2');
        await settle();
        expect(renders).toHaveLength(4);
        renders[3].resolve('data:image/png;base64,L3');
        await settle();
        expect(renders).toHaveLength(4);
        expect(renders.slice(2).map((r) => r.box)).toEqual([
            '301x201',
            '302x202',
        ]);
        expect(slotImages()).toEqual({
            first: 'data:image/png;base64,L1',
            second: 'data:image/png;base64,L2',
            third: 'data:image/png;base64,L3',
        });
        expect(download().disabled).toBe(false);
        // The preview was cleared once, when the card came back, and then only filled up.
        const firstShown = drawnWith.findIndex((k) => k.includes('first'));
        expect(firstShown).toBeGreaterThan(-1);
        expect(
            drawnWith.slice(firstShown).every((k) => k.includes('first')),
        ).toBe(true);
    });

    it('never shows another card’s map while its own, with the same slot and box, is drawing', async () => {
        vi.mocked(shareView.mapSlotsOf).mockImplementation((_size, v) =>
            SHARED(v),
        );
        open([view, leaders]);
        await settle();
        renders[0].resolve('data:image/png;base64,VIEW');
        await settle();
        cardOption('leaders').click();
        await settle();
        // Its own map, though the slot and the box are the view's.
        expect(renders).toHaveLength(2);
        expect(slotImages()).toEqual({});
        cardOption('view').click();
        await settle();
        expect(
            document
                .querySelector('[data-preview] image[data-map]')
                ?.getAttribute('href'),
        ).toBe('data:image/png;base64,VIEW');
        // Back while its map is still drawing: the view's map is not shown on it.
        cardOption('leaders').click();
        await settle();
        expect(renders).toHaveLength(2);
        expect(slotImages()).toEqual({});
        expect(download().disabled).toBe(true);
        renders[1].resolve('data:image/png;base64,LEADERS');
        await settle();
        expect(slotImages()).toEqual({ map: 'data:image/png;base64,LEADERS' });
        expect(download().disabled).toBe(false);
    });

    it('keeps each card’s maps apart in the cache, and draws none again when going back', async () => {
        open([view, leaders]);
        await settle();
        expect(renders).toHaveLength(1);
        renders[0].resolve('data:image/png;base64,VIEW');
        await settle();
        cardOption('leaders').click();
        await settle();
        for (let i = 1; i <= 3; i++) {
            expect(renders).toHaveLength(i + 1);
            renders[i].resolve(`data:image/png;base64,L${i}`);
            await settle();
        }
        expect(download().disabled).toBe(false);
        cardOption('view').click();
        await settle();
        expect(renders).toHaveLength(4);
        expect(download().disabled).toBe(false);
        expect(
            document
                .querySelector('[data-preview] image[data-map]')
                ?.getAttribute('href'),
        ).toBe('data:image/png;base64,VIEW');
        cardOption('leaders').click();
        await settle();
        expect(renders).toHaveLength(4);
        expect(download().disabled).toBe(false);
    });

    it('makes no PNG when any one of the maps fails, and says so in the dialog', async () => {
        open([leaders]);
        await settle();
        renders[0].resolve('data:image/png;base64,A');
        await settle();
        renders[1].reject(new Error('no WebGL'));
        await settle();
        expect(svgToPng).not.toHaveBeenCalled();
        expect(download().disabled).toBe(true);
        expect(document.body.textContent).toContain(
            'The map could not be drawn on this device',
        );
    });

    it('lists only the sizes a card comes in, and keeps the person’s stored size for the cards that have it', async () => {
        vi.mocked(shareView.sizesOf).mockImplementation((v) =>
            isLeaders(v)
                ? ['square', 'story']
                : ['square', 'portrait', 'story', 'x'],
        );
        // Stored as a plain string (useStorage with a string default).
        localStorage.setItem('km.viewSize', 'portrait');
        open([view, leaders]);
        await settle();
        expect(sizeInputs().map((i) => i.value)).toEqual([
            'square',
            'portrait',
            'story',
            'x',
        ]);
        expect(sizeInputs().find((i) => i.checked)?.value).toBe('portrait');
        cardOption('leaders').click();
        await settle();
        // Portrait is not one of its sizes: the first is shown, and portrait stays stored.
        expect(sizeInputs().map((i) => i.value)).toEqual(['square', 'story']);
        expect(sizeInputs().find((i) => i.checked)?.value).toBe('square');
        expect(
            document
                .querySelector('[data-preview] svg')
                ?.getAttribute('viewBox'),
        ).toBe('0 0 1080 1080');
        expect(localStorage.getItem('km.viewSize')).toBe('portrait');
        cardOption('view').click();
        await settle();
        expect(sizeInputs().find((i) => i.checked)?.value).toBe('portrait');
        // A size picked on the card is stored as usual.
        cardOption('leaders').click();
        await settle();
        sizeInputs()
            .find((i) => i.value === 'story')!
            .click();
        await settle();
        expect(localStorage.getItem('km.viewSize')).toBe('story');
    });

    it('shows a fixed headline as text, says why, and offers no input', async () => {
        vi.mocked(shareView.headlineEditable).mockImplementation(
            (v) => !isLeaders(v),
        );
        open([view, leaders]);
        await settle();
        expect(document.querySelector('#view-headline')).not.toBeNull();
        expect(document.querySelector('[data-fixed-headline]')).toBeNull();
        cardOption('leaders').click();
        await settle();
        expect(document.querySelector('#view-headline')).toBeNull();
        expect(
            document
                .querySelector('[data-fixed-headline]')
                ?.textContent?.trim(),
        ).toBe('County leaders in Nairobi City');
        expect(document.body.textContent).toContain(
            'This card’s headline is fixed, so it stays neutral.',
        );
        expect(
            [...document.querySelectorAll('[data-preview] [data-headline]')]
                .map((t) => t.textContent?.trim())
                .join(' '),
        ).toBe('County leaders in Nairobi City');
    });
});
