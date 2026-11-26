// Small formatting helpers shared by the cards and the share buttons.

/** "2026-03-12" → "12 March 2026" (read as a calendar date, so no time-zone shift). */
export function formatAsOf(date: string | null | undefined): string | null {
    if (!date) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (!m) return date;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString(
        'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
    );
}

/**
 * The public site address. The server writes the canonical link from APP_URL, so cards name
 * the real site even when opened through another host; the page's own origin is the fallback.
 */
export function siteOrigin(): string {
    if (typeof document === 'undefined') return '';
    const href = document
        .querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.getAttribute('href');
    if (href) {
        try {
            return new URL(href, location.href).origin;
        } catch {
            // fall through
        }
    }
    return location.origin;
}

export const siteUrl = (path = '/'): string => `${siteOrigin()}${path}`;
