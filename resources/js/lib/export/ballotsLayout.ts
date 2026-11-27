// Layout for "Who represents this ward", portrait and story, inside the same frame as the other
// share cards (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the
// footer). Every box and every line of text is placed here, so the card component only draws what
// this returns and tests can check that nothing overlaps, runs off the card or is cut.
//
// Three papers down the card, each a surface panel with a hairline border: the county's Governor,
// Senator and Woman Rep (a hairline between them), the MP, the MCA. Each seat has its ballot
// colour as the paper's left edge beside it, then "Governor" (bold) and "Kakamega County" on one
// line, the name large and bold, the party's chip and line, and how the holder came to the seat.
// A small map sits at the right of each paper, as tall as the paper allows. A name is never cut
// or shortened: it steps down to NAME_FLOOR of its size, then wraps, and its paper grows. All
// five seats use one type scale, the largest at which the papers fit the room; the room left over
// pads every seat alike, up to PAD_MAX, so the papers stay evenly padded.
import {
    type BallotPaperKey,
    type BallotRow,
    type BallotsCardView,
    ballotsScopeLines,
} from './ballotsCard';
import type { Box, FooterFonts, TextItem } from './layout';
import type { ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import {
    HEADLINE_STRETCH,
    type StripSegment,
    balanced,
    box,
    cardFrame,
    strip,
    titleBlock,
} from './viewLayout';
import { viewMapAspect } from './viewMap';
import type { SeatKey } from '@/lib/map/colouring';
import { SEAT_COLOURS } from '@/lib/map/theme';

/** A party line: `strong` is the abbreviation at its start, drawn in the ink colour. */
export type PartyLine = TextItem & { strong?: string };

export interface BallotSeatItem {
    seat: SeatKey;
    /** The seat's ballot colour down the paper's left edge, beside this seat. */
    edge: Box & { colour: string };
    /** "Governor" (bold), then "Kakamega County"; on one line when `titleInline`. */
    title: TextItem[];
    /** True: the place is drawn as a span after the seat, `titleGap` after it. */
    titleInline: boolean;
    titleGap: number;
    /** The name, on one line or more (never cut); "No approved data yet" for a vacant seat. */
    name: TextItem[];
    /** The party's chip; null when the record names no party. */
    chip: (Box & { colour: string }) | null;
    party: PartyLine[];
    since: TextItem | null;
    vacant: boolean;
}

export interface BallotPaperItem {
    key: BallotPaperKey;
    box: Box;
    seats: BallotSeatItem[];
    /** Hairlines between the seats on one paper. */
    rules: Box[];
    /** The map's box, in the paper's right-hand column. */
    map: Box;
}

export interface BallotsLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    papers: BallotPaperItem[];
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface BallotsText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
}

export const VACANT = 'No approved data yet';

/** The type scales tried, largest first: every seat on the card uses the same one. */
const SCALES = [1.12, 1.08, 1.04, 1, 0.96, 0.92, 0.88, 0.84, 0.8];
/** A name steps down to this share of its size before it wraps. */
export const NAME_FLOOR = 0.85;
/** The least and most room above and below each seat, as shares of the seat-label size. */
const PAD_MIN = 0.7;
const PAD_MAX = 1.5;
/** The map column's share of the paper's width. */
const MAP_COL = 0.25;

interface Fonts {
    label: number;
    name: number;
    party: number;
    since: number;
    /** No word smaller than this (the footer's text). */
    min: number;
}

function fontsAt(size: ViewSize, scale: number, floor: number): Fonts {
    // Portrait: label 23, name 36, party 23, since 20 at scale 1 (the mock-up's proportions).
    const story = size === 'story';
    const at = (n: number) => Math.max(floor, Math.round(n * scale));
    return {
        label: at(story ? 27 : 23),
        name: at(story ? 42 : 36),
        party: at(story ? 27 : 23),
        since: at(story ? 23 : 20),
        min: floor,
    };
}

/** One seat's words from `y` (the top of its text) across `w` from `x`: never cut. */
function seatAt(
    row: BallotRow,
    x: number,
    y: number,
    w: number,
    f: Fonts,
): { items: Omit<BallotSeatItem, 'seat' | 'edge'>; bottom: number } {
    // "Governor  Kakamega County" on one line, a little smaller if it must; else two lines.
    const gap = Math.round(f.label * 0.45);
    const titleW = (s: number) =>
        textWidth(row.label, s, true) + gap + textWidth(row.place, s);
    let ts = f.label;
    while (ts > Math.max(f.min, Math.round(f.label * 0.9)) && titleW(ts) > w) ts--;
    const inline = titleW(ts) <= w;
    let at = y + Math.round(ts * 0.8);
    const title: TextItem[] = [
        { x, y: at, text: row.label, size: ts, weight: 700, tone: 'ink' },
    ];
    if (inline)
        title.push({
            x: x + Math.ceil(textWidth(row.label, ts, true)) + Math.round(ts * 0.3),
            y: at,
            text: row.place,
            size: ts,
            tone: 'muted',
        });
    else {
        for (const line of wrapText(row.place, w, ts)) {
            at += Math.round(ts * 1.2);
            title.push({ x, y: at, text: line, size: ts, tone: 'muted' });
        }
    }

    const name: TextItem[] = [];
    if (row.name === null) {
        for (const line of wrapText(VACANT, w, f.party)) {
            at += Math.round(f.party * 1.5);
            name.push({ x, y: at, text: line, size: f.party, tone: 'muted' });
        }
        return {
            items: {
                title,
                titleInline: inline,
                titleGap: Math.round(ts * 0.3),
                name,
                chip: null,
                party: [],
                since: null,
                vacant: true,
            },
            bottom: at + Math.round(f.party * 0.25),
        };
    }
    const floor = Math.round(f.name * NAME_FLOOR);
    const ns = fitFontSize(row.name, w, f.name, floor, true);
    const nameLines =
        textWidth(row.name, ns, true) <= w ? [row.name] : wrapText(row.name, w, floor, Infinity, true);
    const nameSize = nameLines.length > 1 ? floor : ns;
    at += Math.round(nameSize * 1.22);
    nameLines.forEach((text, i) => {
        if (i) at += Math.round(nameSize * 1.08);
        name.push({ x, y: at, text, size: nameSize, weight: 700, tone: 'ink' });
    });

    let chip: BallotSeatItem['chip'] = null;
    const party: PartyLine[] = [];
    if (row.party) {
        const c = Math.round(f.party * 0.72);
        const px = x + c + Math.round(f.party * 0.4);
        const pw = x + w - px;
        const least = Math.max(f.min, Math.round(f.party * 0.9));
        const ps = fitFontSize(row.party.line, pw, f.party, least);
        const lines =
            textWidth(row.party.line, ps) <= pw
                ? [row.party.line]
                : wrapText(row.party.line, pw, least);
        const size = lines.length > 1 ? least : ps;
        lines.forEach((text, i) => {
            at += Math.round(size * (i ? 1.2 : 1.45));
            party.push({
                x: px,
                y: at,
                text,
                size,
                tone: 'muted',
                ...(i === 0 && row.party!.abbrev ? { strong: row.party!.abbrev } : {}),
            });
        });
        chip = {
            x,
            y: party[0].y - Math.round(size * 0.72),
            w: c,
            h: c,
            colour: row.party.colour,
        };
    }
    let since: TextItem | null = null;
    if (row.since) {
        const ss = fitFontSize(row.since, w, f.since, Math.max(f.min, Math.round(f.since * 0.9)));
        at += Math.round(ss * (party.length ? 1.35 : 1.5));
        since = { x, y: at, text: row.since, size: ss, tone: 'muted' };
    }
    const last = since ?? party.at(-1) ?? name.at(-1)!;
    return {
        items: {
            title,
            titleInline: inline,
            titleGap: Math.round(ts * 0.3),
            name,
            chip,
            party,
            since,
            vacant: false,
        },
        bottom: at + Math.round(last.size * 0.25),
    };
}

/** The papers laid out at one type scale and padding, from `top`. */
function papersAt(
    card: BallotsCardView,
    size: ViewSize,
    x: number,
    w: number,
    top: number,
    f: Fonts,
    pad: number,
    paperGap: number,
): { papers: BallotPaperItem[]; bottom: number } {
    const edgeW = Math.round(f.label * 0.9);
    const inset = Math.round(f.label * 0.95);
    const mapColW = Math.round(w * MAP_COL);
    const textX = x + edgeW + inset;
    const textW = x + w - inset - mapColW - inset - textX;
    const papers: BallotPaperItem[] = [];
    let y = top;
    for (const paper of card.papers) {
        const seats: BallotSeatItem[] = [];
        const rules: Box[] = [];
        let at = y;
        paper.rows.forEach((row, i) => {
            const seatTop = at;
            const s = seatAt(row, textX, at + pad, textW, f);
            at = s.bottom + pad;
            seats.push({
                seat: row.seat,
                edge: { ...box(x, seatTop, edgeW, at - seatTop), colour: SEAT_COLOURS[row.seat] },
                ...s.items,
            });
            if (i < paper.rows.length - 1) rules.push(box(textX, at, textX + textW - textX, 1));
        });
        const h = at - y;
        // The map: its frame's shape, as large as the paper's right-hand column allows.
        const aspect = viewMapAspect({ focus: { b: paper.map.frame.b } } as never);
        const roomW = mapColW;
        const roomH = Math.max(0, h - 2 * inset);
        const mw = Math.max(0, Math.floor(Math.min(roomW, roomH * aspect)));
        const mh = Math.floor(mw / aspect);
        const map = box(
            x + w - inset - mapColW + Math.floor((mapColW - mw) / 2),
            y + Math.floor((h - mh) / 2),
            mw,
            mh,
        );
        papers.push({ key: paper.key, box: box(x, y, w, h), seats, rules, map });
        y += h + paperGap;
    }
    return { papers, bottom: y - paperGap };
}

const LEAD = 'Who represents ';

/**
 * The default headline on two lines keeps the ward's name whole: "Who represents" / "Isukha West
 * ward" when the second fits at the same size, rather than breaking inside the name. Any other
 * headline (an edited one) is left as it is.
 */
function placeWhole(lines: TextItem[], w: number): TextItem[] {
    if (lines.length !== 2 || !lines[0].text.startsWith(LEAD.trim())) return lines;
    const all = `${lines[0].text} ${lines[1].text}`;
    if (!all.startsWith(LEAD)) return lines;
    const rest = all.slice(LEAD.length);
    if (textWidth(rest, lines[1].size, true) > w) return lines;
    return [
        { ...lines[0], text: LEAD.trim() },
        { ...lines[1], text: rest },
    ];
}

export function ballotsLayout(
    size: ViewSize,
    card: BallotsCardView,
    text: BallotsText,
): BallotsLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(size, card, text.url);
    const { pad } = spec;
    // The longest scope line that fits on its line at no less than the title block's least size.
    const lines = ballotsScopeLines(card);
    const scope =
        lines.find((l) => textWidth(l, Math.round(spec.scope * 0.8)) <= innerW) ?? lines.at(-1)!;
    const t = titleBlock(pad, top, innerW, spec, text.headline, scope);
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);
    const room = bodyBottom - bodyTop;
    const paperGap = Math.round(spec.gap * 0.5);
    // No word on a paper smaller than the footer's text.
    const floor = spec.footer.text;

    let chosen: { f: Fonts; pad: number } | null = null;
    for (const scale of SCALES) {
        const f = fontsAt(size, scale, floor);
        const p = Math.round(f.label * PAD_MIN);
        if (papersAt(card, size, pad, innerW, bodyTop, f, p, paperGap).bottom <= bodyBottom) {
            chosen = { f, pad: p };
            break;
        }
    }
    const f = chosen?.f ?? fontsAt(size, SCALES.at(-1)!, floor);
    let seatPad = chosen?.pad ?? Math.round(f.label * PAD_MIN);
    // The room left over pads every seat alike (above and below), up to PAD_MAX.
    const natural = papersAt(card, size, pad, innerW, bodyTop, f, seatPad, paperGap).bottom - bodyTop;
    const seats = card.papers.reduce((n, p) => n + p.rows.length, 0);
    const extra = Math.max(0, room - natural);
    seatPad = Math.min(Math.round(f.label * PAD_MAX), seatPad + Math.floor(extra / (2 * seats)));
    const { papers } = papersAt(card, size, pad, innerW, bodyTop, f, seatPad, paperGap);

    return {
        w,
        h,
        // No one seat's lid stands out: the card is about all five.
        strip: strip(w, spec.stripH),
        headline: t.headline,
        headlineLines: placeWhole(
            balanced(t.headlineLines, innerW / HEADLINE_STRETCH),
            innerW / HEADLINE_STRETCH,
        ),
        scopeLine: t.scopeLine,
        papers,
        footerBox,
        footerFonts: spec.footer,
    };
}
