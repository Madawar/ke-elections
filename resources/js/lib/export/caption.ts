// The text that goes with a shared view: the headline, the numbers behind it, the source with
// its date, the link and the tags. Instagram and TikTok allow 2,200 characters; X allows 280.
import {
    type BallotsCardView,
    ballotRows,
    ballotsHeadline,
    ballotsScopeLines,
} from './ballotsCard';
import {
    FIVE_SEATS_HEADLINE,
    type FiveSeatsCardView,
    fiveSeatsScope,
} from './fiveSeatsCard';
import { formatAsOf } from './format';
import {
    type LeadersCardView,
    leadersHeadline,
    mcaMixLabel,
} from './leadersCard';
import {
    type NumbersCardView,
    numbersHeadline,
    numbersNote,
    numbersRowLine,
} from './numbersCard';
import { type PartyCardView, TOP_COUNTIES_TITLE, partyHeadline } from './partyCard';
import {
    type TopCountiesCardView,
    topCountiesHeadline,
    topCountiesNote,
    topCountiesRowLine,
    topCountiesScope,
} from './topCountiesCard';
import { TILES_SCOPE, type TilesCardView, tilesHeadline } from './tilesCard';
import {
    VERSUS_EMPTY,
    VERSUS_SCOPE,
    type VersusCardView,
    versusHeadline,
} from './versusCard';
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

/** What the source line needs of a card: every kind of card has it. */
type Sourced = Pick<ViewState, 'asOf' | 'source' | 'sources' | 'sample'>;

/** The sources, naming at most `max` of them and counting the rest. */
function sourcesText(view: Sourced, max = Infinity): string {
    const parts = view.sources.length ? view.sources : [view.source];
    if (parts.length <= max) return list(parts);
    const rest = parts.length - max;
    return `${parts.slice(0, max).join(', ')} and ${rest} more ${rest === 1 ? 'source' : 'sources'}`;
}

function sourceText(view: Sourced, max = Infinity): string {
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

/**
 * Every card's caption on X: the headline, then the source, link and tags. Those always fit: the
 * source names at most two sites, then one; only the headline is shortened.
 */
function xCaption(card: Sourced, url: string, headline: string): string {
    let tail = '';
    for (const max of [2, 1]) {
        tail = `\n\n${sourceText(card, max)}\n${url}\n${TAGS}`;
        if (xLength(tail) <= X_MAX - 20) break;
    }
    return `${clip(headline, Math.max(1, X_MAX - xLength(tail)))}${tail}`;
}

export function captionFor(
    view: ViewState,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = headlineFor(view),
): string {
    if (platform === 'x') return xCaption(view, url, headline);
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

/**
 * The caption for a party card: the headline, each seat's "n of N (p%)", the source with its
 * date, the link and the tags. On X the rows go: the headline, source, link and tags are what fit.
 */
export function partyCaption(
    card: PartyCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = partyHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    const lines = card.hasSeats || card.scope
        ? [
              ...card.rows.map(
                  (r) =>
                      `${r.label}: ${r.single ? r.value.charAt(0).toLowerCase() + r.value.slice(1) : r.value}`,
              ),
              ...(card.top.length
                  ? [
                        `${TOP_COUNTIES_TITLE}: ${list(card.top.map((c) => `${c.name} ${c.value}`))}`,
                    ]
                  : []),
          ]
        : [];
    return [
        clip(headline, 300),
        '',
        ...lines,
        ...(lines.length ? [''] : []),
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The caption for a leaders card: the headline, each seat with its holder exactly as the data
 * spells the name and the party in brackets (or "no approved data yet"), a constituency's MCAs by
 * party, the source with its date, the link and the tags. On X only the headline, source, link
 * and tags fit.
 */
export function leadersCaption(
    card: LeadersCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = leadersHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    const lines = card.rows.map((r) => {
        const seat = `${r.title}${r.where ? ` (${r.where})` : ''}`;
        if (!r.holder) return `${seat}: no approved data yet`;
        return `${seat}: ${r.holder.name}${r.holder.partyLabel ? ` (${r.holder.partyLabel})` : ''}`;
    });
    if (card.mcas) lines.push(mcaMixLabel(card));
    return [
        clip(headline, 300),
        '',
        ...lines,
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The caption for "By the numbers": the headline, one line per seat with its count and the groups
 * holding the most, the card's note, the source with its date, the link and the tags. On X only
 * the headline, source, link and tags fit.
 */
export function numbersCaption(
    card: NumbersCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = numbersHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    return [
        clip(headline, 300),
        '',
        ...card.rows.map(numbersRowLine),
        '',
        numbersNote(card),
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The caption for "Top 10 counties": the fixed headline, the scope, one line per county, the
 * card's note, the source with its date, the link and the tags. On X only the headline, source,
 * link and tags fit.
 */
export function topCountiesCaption(
    card: TopCountiesCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = topCountiesHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    const scope = topCountiesScope(card);
    const note = topCountiesNote(card);
    return [
        clip(headline, 300),
        '',
        `${scope.lead} ${scope.list}`,
        ...card.rows.map(topCountiesRowLine),
        ...(note ? ['', note] : []),
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The caption for "Who represents this ward": the headline, where the ward is, one line per seat in
 * ballot order ("Governor (Kakamega County): <name> (ODM, Orange Democratic Movement). Elected in
 * August 2022."), the source with its date, the link and the tags. On X only the headline, source,
 * link and tags fit.
 */
export function ballotsCaption(
    card: BallotsCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = ballotsHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    const lines = ballotRows(card).map((r) => {
        const seat = `${r.label} (${r.place})`;
        if (r.name === null) return `${seat}: no approved data yet.`;
        return `${seat}: ${r.name}${r.party ? ` (${r.party.line})` : ''}.${r.since ? ` ${r.since}.` : ''}`;
    });
    return [
        clip(headline, 300),
        '',
        `${ballotsScopeLines(card)[0]}.`,
        ...lines,
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The key in words: the party colours in their order, the parties folded into "Other parties" (as
 * the card's note says), and the seats with no approved holder, which are not a party colour.
 */
function fiveSeatsKeyLine(card: FiveSeatsCardView): string {
    const parties = card.key.filter((k) => k.key !== 'none').map((k) => k.label);
    const n = card.folded.length;
    return [
        `Party colours, in order of seats held across all five: ${parties.join(', ')}.`,
        n ? `The ${n.toLocaleString('en-GB')} with the fewest are drawn as Other parties.` : '',
        card.vacant
            ? `No approved holder yet for ${card.vacant.toLocaleString('en-GB')} ${card.vacant === 1 ? 'seat' : 'seats'}.`
            : '',
    ]
        .filter(Boolean)
        .join(' ');
}

/**
 * The caption for "Kenya, five ways": the headline, the scope, one line per seat (as "By the
 * numbers" writes it), the key in its order, the source with its date, the link and the tags. On X
 * only the headline, source, link and tags fit.
 */
export function fiveSeatsCaption(
    card: FiveSeatsCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = FIVE_SEATS_HEADLINE,
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    return [
        clip(headline, 300),
        '',
        `${fiveSeatsScope(card)}.`,
        ...card.rows.map(numbersRowLine),
        '',
        fiveSeatsKeyLine(card),
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/**
 * The caption for "Every county the same size": the headline, the scope, one line per key entry in
 * the key's order with its counties by IEBC code ("UDA 20: Kwale, Kilifi, …."), so the image is
 * readable in words, the source with its date, the link and the tags. On X only the headline,
 * source, link and tags fit.
 */
export function tilesCaption(
    card: TilesCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = tilesHeadline(card),
): string {
    if (platform === 'x') return xCaption(card, url, headline);
    return [
        clip(headline, 300),
        '',
        `${TILES_SCOPE}.`,
        ...card.key.map(
            (k) =>
                `${k.label} ${fmt(k.count)}: ${card.tiles
                    .filter((t) => t.group === k.key)
                    .map((t) => t.name)
                    .join(', ')}.`,
        ),
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}

/** "Mombasa: ODM 23, UDA 4, Independent 2, WDM-K 1." with at most `max` entries named. */
function versusCounts(h: VersusCardView['halves'][number], max = Infinity): string {
    const named = h.key.slice(0, max).map((k) => `${k.label} ${fmt(k.count)}`);
    const rest = h.key.length - named.length;
    return `${h.name}: ${named.join(', ')}${rest ? ` and ${rest} more` : ''}.`;
}

/**
 * The caption for "Side by side": the headline, both counties' counts in the card's order (lower
 * code first), for Instagram also each county's seat count and the party of its three county
 * seats, then the source with its date, the link and the tags. On X it stays within 280: the
 * counts name fewer parties ("and 3 more") until it fits.
 */
export function versusCaption(
    card: VersusCardView,
    url: string,
    platform: CaptionPlatform = 'instagram',
    headline = versusHeadline(card),
): string {
    if (platform === 'x') {
        const most = Math.max(...card.halves.map((h) => h.key.length));
        for (const sourcesMax of [2, 1])
            for (let max = most; max >= 1; max--) {
                const text = [
                    headline,
                    '',
                    ...card.halves.map((h) => versusCounts(h, max)),
                    '',
                    sourceText(card, sourcesMax),
                    url,
                    TAGS,
                ].join('\n');
                if (xLength(text) <= X_MAX) return text;
            }
        return xCaption(card, url, headline);
    }
    return [
        clip(headline, 300),
        '',
        VERSUS_SCOPE,
        ...card.halves.flatMap((h) => [
            '',
            `${h.name} (${h.units}):`,
            versusCounts(h).slice(h.name.length + 2),
            `${h.leaders
                .map((l) => `${l.label}: ${l.party ? l.party.label : VERSUS_EMPTY.toLowerCase()}`)
                .join('. ')}.`,
        ]),
        '',
        sourceText(card, 10),
        url,
        '',
        TAGS,
    ].join('\n');
}
