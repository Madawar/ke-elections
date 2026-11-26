// The text that goes with a shared view: the headline, the numbers behind it, the source with
// its date, the link and the tags. Instagram and TikTok allow 2,200 characters; X allows 280.
import { formatAsOf } from './format';
import { type ViewState, headlineFor } from './viewState';

export type CaptionPlatform = 'instagram' | 'x';

const TAGS = '#Kenya2027 #KenyaDecides';
const INSTAGRAM_MAX = 2199;
const X_MAX = 279;
/** Past this many highlighted parties the caption names the rest by count. */
const MAX_LINES = 12;

const fmt = (n: number) => n.toLocaleString('en-GB');

function sourceText(view: ViewState): string {
    const asOf = formatAsOf(view.asOf);
    return `Source: ${view.source}${asOf ? `, data as of ${asOf}` : ''}.${view.sample ? ' Sample data, not real records.' : ''}`;
}

/** "UDA (United Democratic Alliance): 523 of 1,450 seats, 36%" */
function partyLine(
    view: ViewState,
    p: ViewState['highlights'][number],
): string {
    const who =
        p.name && p.name !== p.label
            ? `${p.label} (${p.name})`
            : p.name || p.label;
    const label = who.charAt(0).toUpperCase() + who.slice(1);
    // A single seat needs no count: the line names who holds it.
    if (view.total === 1) return label;
    return `${label}: ${fmt(p.count)} of ${fmt(view.total)} seats, ${p.share}`;
}

const clip = (text: string, max: number) =>
    text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export function captionFor(
    view: ViewState,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = headlineFor(view),
): string {
    const source = sourceText(view);
    if (platform === 'x') {
        // Headline first; it is shortened, never the source, link or tags.
        const tail = `\n\n${source}\n${url}\n${TAGS}`;
        return `${clip(headline, Math.max(20, X_MAX - tail.length))}${tail}`;
    }
    const shown = view.highlights.length
        ? view.highlights
        : view.parties.slice(0, 3);
    const lines = shown.slice(0, MAX_LINES).map((p) => partyLine(view, p));
    if (shown.length > MAX_LINES)
        lines.push(`And ${shown.length - MAX_LINES} more parties.`);
    const text = [
        clip(headline, 300),
        '',
        ...(view.total ? lines : []),
        ...(view.total ? [''] : []),
        source,
        url,
        '',
        TAGS,
    ].join('\n');
    return clip(text, INSTAGRAM_MAX);
}
