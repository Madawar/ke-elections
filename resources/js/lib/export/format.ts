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

const OFFICIAL = /(^|\.)(iebc\.or\.ke|gazettes\.africa|kenyalaw\.org)$/;

/**
 * The sources for a card, from the source links of the records it shows: IEBC gazette notices
 * (IEBC and gazette archives), then any other sites by name.
 */
export function sourceParts(urls: string[]): string[] {
    const others = new Set<string>();
    let official = false;
    for (const url of urls) {
        let host: string;
        try {
            host = new URL(url).hostname.replace(/^www\./, '');
        } catch {
            continue;
        }
        if (OFFICIAL.test(host)) official = true;
        else others.add(host);
    }
    // With no records at all, the card still rests on the gazetted IEBC codes and names.
    return [
        ...(official || others.size === 0 ? ['IEBC gazette notices'] : []),
        ...[...others].sort(),
    ];
}

/** The source line for a card: its sources in one sentence ("A, B and C"). */
export function sourceLine(urls: string[]): string {
    const parts = sourceParts(urls);
    return parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
