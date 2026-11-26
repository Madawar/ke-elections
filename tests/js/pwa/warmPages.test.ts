import { describe, expect, it, vi } from 'vitest';
import { warmPages } from '@/lib/pwa/warmPages';

function fakeCache(present: string[]) {
    const stored = new Set(present);
    return {
        stored,
        match: vi.fn(async (url: string) =>
            stored.has(url) ? new Response('') : undefined,
        ),
        add: vi.fn(async (url: string) => {
            stored.add(url);
        }),
    };
}

describe('warmPages', () => {
    it('saves the current page and the home page when they are not cached yet', async () => {
        const cache = fakeCache([]);
        await warmPages(cache, '/ward/1448');
        expect([...cache.stored].sort()).toEqual(['/', '/ward/1448']);
    });

    it('does not fetch pages that are already cached', async () => {
        const cache = fakeCache(['/']);
        await warmPages(cache, '/');
        expect(cache.add).not.toHaveBeenCalled();
    });

    it('never saves admin, account or login pages', async () => {
        const cache = fakeCache([]);
        await warmPages(cache, '/settings/profile');
        await warmPages(cache, '/ward/abc');
        expect([...cache.stored]).toEqual(['/']);
    });

    it('keeps going when one page cannot be fetched', async () => {
        const cache = fakeCache([]);
        cache.add.mockImplementationOnce(async () => {
            throw new TypeError('Request failed');
        });
        await expect(warmPages(cache, '/county/47')).resolves.toBeUndefined();
        expect(cache.stored.has('/county/47')).toBe(true);
    });
});
