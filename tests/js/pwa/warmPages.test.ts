import { describe, expect, it, vi } from 'vitest';
import { PUBLIC_PAGE_HEADER, warmPages } from '@/lib/pwa/warmPages';

function fakeCache(present: string[]) {
    const stored = new Set(present);
    return {
        stored,
        match: vi.fn(async (url: string) =>
            stored.has(url) ? new Response('') : undefined,
        ),
        put: vi.fn(async (url: string) => {
            stored.add(url);
        }),
    };
}
const publicPage = () =>
    new Response('<html>', { headers: { [PUBLIC_PAGE_HEADER]: '1' } });

describe('warmPages', () => {
    it('saves the current page and the home page when they are not cached yet', async () => {
        const cache = fakeCache([]);
        await warmPages(cache, '/ward/1448', async () => publicPage());
        expect([...cache.stored].sort()).toEqual(['/', '/ward/1448']);
    });

    it('fetches without cookies, so a signed-in session never reaches the cache', async () => {
        const cache = fakeCache([]);
        const fetcher = vi.fn(async () => publicPage());
        await warmPages(cache, '/', fetcher);
        expect(
            (fetcher.mock.calls[0] as unknown as [Request])[0].credentials,
        ).toBe('omit');
    });

    it('does not save a page the server did not mark public', async () => {
        const cache = fakeCache([]);
        await warmPages(
            cache,
            '/county/47',
            async () => new Response('<html>'),
        );
        expect(cache.put).not.toHaveBeenCalled();
    });

    it('does not fetch pages that are already cached', async () => {
        const cache = fakeCache(['/']);
        const fetcher = vi.fn(async () => publicPage());
        await warmPages(cache, '/', fetcher);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('never saves admin, account or login pages', async () => {
        const cache = fakeCache([]);
        await warmPages(cache, '/settings/profile', async () => publicPage());
        await warmPages(cache, '/ward/abc', async () => publicPage());
        expect([...cache.stored]).toEqual(['/']);
    });

    it('keeps going when one page cannot be fetched', async () => {
        const cache = fakeCache([]);
        let first = true;
        const fetcher = async () => {
            if (first) {
                first = false;
                throw new TypeError('Request failed');
            }
            return publicPage();
        };
        await expect(
            warmPages(cache, '/county/47', fetcher),
        ).resolves.toBeUndefined();
        expect(cache.stored.has('/county/47')).toBe(true);
    });
});

describe('party pages', () => {
    it('are map pages: saved for offline like a unit page', async () => {
        const cache = fakeCache([]);
        await warmPages(cache, '/party/wdm-k', async () => publicPage());
        expect([...cache.stored].sort()).toEqual(['/', '/party/wdm-k']);
        const other = fakeCache([]);
        await warmPages(other, '/party/a_b', async () => publicPage());
        expect([...other.stored]).toEqual(['/']);
    });
});
