// The first visit loads before the service worker controls the page, so the network-first
// "pages" route never sees that HTML. Saving it (and the home page, the offline fallback for
// pages never opened) once the worker is ready lets the next visit open offline.

/** Must match the runtime cache name for navigations in vite.config.ts. */
export const PAGES_CACHE = 'pages';

/** The public map pages; mirrors the "pages" route pattern in vite.config.ts. */
export const MAP_PAGE = /^\/((county|constituency|ward)\/\d+)?$/;

type PageCache = Pick<Cache, 'match' | 'add'>;

export async function warmPages(cache: PageCache, path: string): Promise<void> {
    for (const url of new Set(['/', path])) {
        if (!MAP_PAGE.test(url)) continue;
        try {
            if (!(await cache.match(url))) await cache.add(url);
        } catch {
            // Offline or a non-2xx page (cache.add rejects): nothing to save.
        }
    }
}
