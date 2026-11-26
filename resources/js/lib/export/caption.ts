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

/** Length as X counts it: every link is shortened to a 23-character t.co link. */
export const xLength = (text: string): number =>
    text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;

const list = (items: string[]) =>
    items.length <= 1
        ? (items[0] ?? '')
        : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The sources, naming at most `max` of them and counting the rest. */
function sourcesText(view: ViewState, max = Infinity): string {
    const parts = view.sources.length ? view.sources : [view.source];
    if (parts.length <= max) return list(parts);
    const rest = parts.length - max;
    return `${parts.slice(0, max).join(', ')} and ${rest} more ${rest === 1 ? 'source' : 'sources'}`;
}

function sourceText(view: ViewState, max = Infinity): string {
    const asOf = formatAsOf(view.asOf);
    return `Source: ${sourcesText(view, max)}${asOf ? `, data as of ${asOf}` : ''}.${view.sample ? ' Sample data, not real records.' : ''}`;
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
    if (platform === 'x') {
        // The source, link and tags always fit: the source names at most two sites, then one;
        // only the headline is shortened.
        let tail = '';
        for (const max of [2, 1]) {
            tail = `\n\n${sourceText(view, max)}\n${url}\n${TAGS}`;
            if (xLength(tail) <= X_MAX - 20) break;
        }
        return `${clip(headline, Math.max(1, X_MAX - xLength(tail)))}${tail}`;
    }
    // The source, link and tags always go in; party lines are dropped from the end to make room.
    const head = clip(headline, 300);
    const tail = [sourceText(view, 10), url, '', TAGS].join('\n');
    const shown = view.highlights.length
        ? view.highlights
        : view.parties.slice(0, 3);
    let lines = view.total
        ? shown.slice(0, MAX_LINES).map((p) => partyLine(view, p))
        : [];
    const build = (body: string[], more: number) =>
        [
            head,
            '',
            ...body,
            ...(more
                ? [`And ${more} more ${more === 1 ? 'party' : 'parties'}.`]
                : []),
            ...(body.length || more ? [''] : []),
            tail,
        ].join('\n');
    let text = build(lines, view.total ? shown.length - lines.length : 0);
    while (text.length > INSTAGRAM_MAX && lines.length) {
        lines = lines.slice(0, -1);
        text = build(lines, shown.length - lines.length);
    }
    return text.length > INSTAGRAM_MAX
        ? `${clip(head, Math.max(1, INSTAGRAM_MAX - tail.length - 2))}\n\n${tail}`
        : text;
}
