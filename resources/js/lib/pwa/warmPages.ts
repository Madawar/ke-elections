// The first visit loads before the service worker controls the page, so the network-first
// "pages" route never sees that HTML. Saving it (and the home page, the offline fallback for
// pages never opened) once the worker is ready lets the next visit open offline.
//
// Only the signed-out version of a page is ever saved: pages carry the signed-in user in their
// Inertia props, so they are fetched without cookies and stored only when the server marks the
// response public (PUBLIC_PAGE_HEADER, sent to guests by the MarkPublicPage middleware).

/** Must match the runtime cache name for navigations in vite.config.ts. */
export const PAGES_CACHE = 'pages';

/** Must match App\Http\Middleware\MarkPublicPage and the cacheWillUpdate check in vite.config.ts. */
export const PUBLIC_PAGE_HEADER = 'X-Public-Page';

/** The public map pages; mirrors the "pages" route pattern in vite.config.ts. */
export const MAP_PAGE = /^\/((county|constituency|ward)\/\d+)?$/;

type PageCache = Pick<Cache, 'match' | 'put'>;
type Fetcher = (request: Request) => Promise<Response>;

export async function warmPages(
    cache: PageCache,
    path: string,
    fetcher: Fetcher = (r) => fetch(r),
): Promise<void> {
    for (const url of new Set(['/', path])) {
        if (!MAP_PAGE.test(url)) continue;
        try {
            if (await cache.match(url)) continue;
            const response = await fetcher(
                new Request(url, { credentials: 'omit' }),
            );
            if (response.ok && response.headers.get(PUBLIC_PAGE_HEADER) === '1')
                await cache.put(url, response);
        } catch {
            // Offline: nothing to save.
        }
    }
}
