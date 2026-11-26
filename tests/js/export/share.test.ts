import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canShareFiles, shareOrDownload } from '@/lib/export/share';

const blob = () => new Blob(['png'], { type: 'image/png' });
const nav = navigator as Navigator & {
    share?: unknown;
    canShare?: unknown;
};

describe('shareOrDownload', () => {
    let clicked: HTMLAnchorElement[];

    beforeEach(() => {
        clicked = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            function (this: HTMLAnchorElement) {
                clicked.push(this);
            },
        );
        URL.createObjectURL = vi.fn(() => 'blob:fake');
        URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete nav.share;
        delete nav.canShare;
    });

    it('shares a single File named after the filename when the device can share files', async () => {
        const share = vi.fn(async () => {});
        nav.share = share;
        nav.canShare = vi.fn(() => true);

        const result = await shareOrDownload(
            blob(),
            'kenya-electoral-map-ward-1448-square.png',
            'Ngei ward',
        );

        expect(result).toBe('shared');
        expect(share).toHaveBeenCalledTimes(1);
        const data = (share.mock.calls[0] as unknown[])[0] as ShareData;
        expect(data.title).toBe('Ngei ward');
        expect(data.files).toHaveLength(1);
        expect(data.files![0]).toBeInstanceOf(File);
        expect(data.files![0].name).toBe(
            'kenya-electoral-map-ward-1448-square.png',
        );
        expect(data.files![0].type).toBe('image/png');
        expect(clicked).toHaveLength(0);
    });

    it('downloads through an anchor when the device cannot share files', async () => {
        nav.canShare = vi.fn(() => false);
        nav.share = vi.fn();

        const result = await shareOrDownload(
            blob(),
            'kenya-electoral-map-ward-1448-square.png',
            'Ngei ward',
        );

        expect(result).toBe('downloaded');
        expect(nav.share).not.toHaveBeenCalled();
        expect(clicked).toHaveLength(1);
        expect(clicked[0].download).toBe(
            'kenya-electoral-map-ward-1448-square.png',
        );
        expect(clicked[0].href).toBe('blob:fake');
    });

    it('downloads when the Web Share API is missing', async () => {
        const result = await shareOrDownload(blob(), 'a.png', 'A');
        expect(result).toBe('downloaded');
        expect(clicked[0].download).toBe('a.png');
    });

    it('does nothing more when the person cancels the share sheet', async () => {
        nav.canShare = vi.fn(() => true);
        nav.share = vi.fn(async () => {
            throw new DOMException('cancelled', 'AbortError');
        });
        const result = await shareOrDownload(blob(), 'a.png', 'A');
        expect(result).toBe('cancelled');
        expect(clicked).toHaveLength(0);
    });

    it('falls back to a download when sharing fails for another reason', async () => {
        nav.canShare = vi.fn(() => true);
        nav.share = vi.fn(async () => {
            throw new DOMException('no', 'NotAllowedError');
        });
        const result = await shareOrDownload(blob(), 'a.png', 'A');
        expect(result).toBe('downloaded');
        expect(clicked).toHaveLength(1);
    });

    it('reports whether files can be shared', () => {
        expect(canShareFiles()).toBe(false);
        nav.share = vi.fn();
        nav.canShare = vi.fn(() => true);
        expect(canShareFiles()).toBe(true);
    });
});
