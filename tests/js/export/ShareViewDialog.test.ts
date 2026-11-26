import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { snapshotView } from '@/lib/export/viewState';
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
