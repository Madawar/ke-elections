// Layout for "Top 10 counties for a group", square and story, inside the same frame as the other
// share cards (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the
// footer). Every box and every line of text is placed here, so the card component only draws what
// this returns and tests can check that nothing overlaps, runs off the card or is cut.
//
// Square: the ranked rows on the left, the map of Kenya on the right with its caption under it.
// Story: the rows across the width, and under them the map, centred, with its caption under it.
// Each row is rank, county name (bold), a bar on one scale from zero, the count (bold) right after
// the bar, and "of 40 wards" in a column of its own, with a hairline under the row. The rows' type
// and height come from the room there is; a long "of 12 constituencies" narrows its own column's
// type and the bars' track, never the rows.
import type { Box, FooterFonts, TextItem } from './layout';
import type { ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import {
    type TopCountiesCardView,
    topCountiesMapCaption,
    topCountiesNote,
    topCountiesScope,
} from './topCountiesCard';
import {
    HEADLINE_STRETCH,
    type StripSegment,
    box,
    cardFrame,
    strip,
    titleBlock,
} from './viewLayout';
import { viewMapAspect } from './viewMap';

export interface TopCountiesRowItem {
    code: number;
    box: Box;
    rank: TextItem;
    /** The county's name: one line, or two when it is too long for one (never cut). */
    name: TextItem[];
    bar: Box & { colour: string };
    /** The count, bold, just after the bar's end. */
    count: TextItem;
    /** "of 40 wards". */
    of: TextItem;
    /** The hairline under the row. */
    rule: Box;
}

export interface TopCountiesLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    /** "The 10 counties with the most:" on a line of its own, when it is not on the scope line. */
    lead: TextItem | null;
    rows: TopCountiesRowItem[];
    note: TextItem[];
    map: Box;
    /** "The 10 counties shaded", centred under the map. */
    mapCaption: TextItem;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface TopCountiesText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');
/** Row type sizes tried, as shares of the spec's row label size, largest first. */
const SCALES = [1.08, 1, 0.94, 0.88, 0.82, 0.76, 0.7];
/** A row's height for its type size (a story's rows sit a little closer), and the most it may open up to. */
const ROW_H = { square: 1.9, story: 1.75 } as Record<ViewSize, number>;
const ROW_MAX = 2.1;
/** The bars keep at least this share of the rows' width, while the right-hand column can narrow. */
const BAR_MIN = 0.28;
/** The least the bars' track may then shrink to, before the rows' type would have to. */
const BAR_FLOOR = 0.2;
/** The right-hand column's type may narrow to this share of the rows' (not below the card's small text). */
const OF_MIN = 0.75;
/** The story's map, under the rows, is at least this share of the width tall. */
const STORY_MAP_MIN = 0.42;
/** A name takes at most this share of the rows' width before it shrinks, then wraps. */
const NAME_MAX = 0.36;

interface Columns {
    size: number;
    /** The right-hand column's type size ("of 40 wards"): the rows' size, or narrower. */
    ofSize: number;
    rankW: number;
    nameX: number;
    nameW: number;
    barX: number;
    /** The longest bar: the rest of the room keeps the widest count after it. */
    barMax: number;
    countGap: number;
    ofX: number;
}

/**
 * Where a row's parts go at one type size, or null when the bars would be too short. A long
 * right-hand column first narrows its own type (to OF_MIN, not below `small`), then the bars'
 * track shortens (to BAR_FLOOR): the rank, name and count keep the rows' size.
 */
function columnsAt(
    card: TopCountiesCardView,
    x: number,
    w: number,
    size: number,
    small: number,
): Columns | null {
    const gap = Math.round(size * 0.6);
    const rankW = Math.ceil(
        Math.max(0, ...card.rows.map((r) => textWidth(String(r.rank), size))),
    );
    const widestName = Math.ceil(
        Math.max(0, ...card.rows.map((r) => textWidth(r.name, size, true))),
    );
    const nameW = Math.min(widestName, Math.floor(w * NAME_MAX));
    const countW = Math.ceil(
        Math.max(
            0,
            ...card.rows.map((r) => textWidth(fmt(r.count), size, true)),
        ),
    );
    const nameX = x + rankW + Math.round(size * 0.45);
    const barX = nameX + nameW + gap;
    const countGap = Math.round(size * 0.35);
    const at = (ofSize: number) => {
        const ofW = Math.ceil(
            Math.max(0, ...card.rows.map((r) => textWidth(r.of, ofSize))),
        );
        const ofX = x + w - ofW;
        const barMax = ofX - gap - countW - countGap - barX;
        return { size, ofSize, rankW, nameX, nameW, barX, barMax, countGap, ofX };
    };
    const least = Math.min(size, Math.max(small, Math.round(size * OF_MIN)));
    for (let ofSize = size; ofSize >= least; ofSize--) {
        const cols = at(ofSize);
        if (cols.barMax >= w * BAR_MIN) return cols;
    }
    const cols = at(least);
    return cols.barMax >= w * BAR_FLOOR ? cols : null;
}

/** A name at the row's size, or a little smaller, or on two lines: never cut. */
function nameLines(name: string, cols: Columns): { size: number; lines: string[] } {
    const fit = fitFontSize(
        name,
        cols.nameW,
        cols.size,
        Math.round(cols.size * 0.82),
        true,
    );
    if (textWidth(name, fit, true) <= cols.nameW) return { size: fit, lines: [name] };
    const size = Math.round(cols.size * 0.82);
    const lines = wrapText(name, cols.nameW, size, 2, true);
    // A name with no space to break at shrinks until it fits on one line.
    if (lines.length === 1 || lines.some((l) => l.endsWith('…')))
        return {
            size: Math.floor((size * cols.nameW) / textWidth(name, size, true)),
            lines: [name],
        };
    return { size, lines };
}

function rowAt(
    card: TopCountiesCardView,
    i: number,
    y: number,
    h: number,
    cols: Columns,
    x: number,
    w: number,
): TopCountiesRowItem {
    const r = card.rows[i];
    const { size } = cols;
    const largest = Math.max(1, ...card.rows.map((row) => row.count));
    const baseline = Math.round(y + h / 2 + size * 0.34);
    const barH = Math.round(Math.min(h * 0.56, size * 1.08));
    const barW = Math.max(2, Math.round((cols.barMax * r.count) / largest));
    const name = nameLines(r.name, cols);
    const lead = Math.round(name.size * 1.02);
    const nameTop = baseline - ((name.lines.length - 1) * lead) / 2;
    return {
        code: r.code,
        box: box(x, y, w, h),
        rank: {
            x,
            y: baseline,
            text: String(r.rank),
            size,
            tone: 'muted',
        },
        name: name.lines.map((text, j) => ({
            x: cols.nameX,
            y: Math.round(nameTop + j * lead),
            text,
            size: name.size,
            weight: 700,
            tone: 'ink',
        })),
        bar: {
            x: cols.barX,
            y: Math.round(y + (h - barH) / 2),
            w: barW,
            h: barH,
            colour: card.colour,
        },
        count: {
            x: cols.barX + barW + cols.countGap,
            y: baseline,
            text: fmt(r.count),
            size,
            weight: 700,
            tone: 'ink',
        },
        of: {
            x: cols.ofX,
            y: baseline,
            text: r.of,
            size: cols.ofSize,
            tone: 'muted',
        },
        rule: box(x, y + h - 1, w, 1),
    };
}

/** The type size and row height for the rows to fit in `room`; the smallest if none does. */
function rowsFit(
    card: TopCountiesCardView,
    x: number,
    w: number,
    base: number,
    room: number,
    pitch: number,
    small: number,
): { cols: Columns; h: number } {
    const n = Math.max(1, card.rows.length);
    let last: { cols: Columns; h: number } | null = null;
    for (const scale of SCALES) {
        const size = Math.round(base * scale);
        const cols = columnsAt(card, x, w, size, small);
        if (!cols) continue;
        const h = Math.round(size * pitch);
        last = { cols, h };
        if (n * h <= room)
            return {
                cols,
                h: Math.min(Math.round(size * ROW_MAX), Math.floor(room / n)),
            };
    }
    const size = Math.round(base * SCALES[SCALES.length - 1]);
    return (
        last ?? {
            cols: columnsAt(card, x, w, size, small) ?? {
                size,
                ofSize: size,
                rankW: 0,
                nameX: x,
                nameW: Math.floor(w * NAME_MAX),
                barX: x + Math.floor(w * NAME_MAX),
                barMax: Math.floor(w * BAR_MIN),
                countGap: 4,
                ofX: x + w,
            },
            h: Math.round(size * pitch),
        }
    );
}

/**
 * The headline's last two lines broken where they are most even, when the last is a lone word
 * ("Where UDA holds the most MP" / "seats"): the same words, size and number of lines.
 */
function balanced(lines: TextItem[], w: number): TextItem[] {
    if (lines.length < 2 || lines[lines.length - 1].text.includes(' '))
        return lines;
    const [a, b] = lines.slice(-2);
    const words = `${a.text} ${b.text}`.split(' ');
    const width = (t: string) => textWidth(t, a.size, true);
    let best: [string, string] | null = null;
    for (let k = 1; k < words.length; k++) {
        const pair: [string, string] = [
            words.slice(0, k).join(' '),
            words.slice(k).join(' '),
        ];
        if (pair.some((t) => width(t) > w)) continue;
        if (!best || Math.max(...pair.map(width)) < Math.max(...best.map(width)))
            best = pair;
    }
    if (!best) return lines;
    return [
        ...lines.slice(0, -2),
        { ...a, text: best[0] },
        { ...b, text: best[1] },
    ];
}

/** "The 10 counties shaded", centred directly under the map, at most `w` wide. */
function mapCaption(
    card: TopCountiesCardView,
    map: Box,
    w: number,
    size: number,
): TextItem {
    const text = topCountiesMapCaption(card);
    const fitted = fitFontSize(text, w, size, Math.round(size * 0.8));
    return {
        x: Math.round(map.x + map.w / 2 - textWidth(text, fitted) / 2),
        y: Math.round(map.y + map.h + fitted * 1.15),
        text,
        size: fitted,
        tone: 'muted',
    };
}

/** The caption's height under the map, from the map's foot to the caption's foot. */
const captionH = (size: number) => Math.round(size * 1.45);

export function topCountiesLayout(
    size: ViewSize,
    card: TopCountiesCardView,
    text: TopCountiesText,
): TopCountiesLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(
        size,
        card,
        text.url,
    );
    const { pad, gap } = spec;
    // The scope and the list's lead on one line when they fit at a readable size, else two.
    const scope = topCountiesScope(card);
    const whole = `${scope.lead} ${scope.list}`;
    const oneLine =
        textWidth(whole, Math.round(spec.scope * 0.86)) <= innerW;
    const t = titleBlock(
        pad,
        top,
        innerW,
        spec,
        text.headline,
        oneLine ? whole : scope.lead,
    );
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);
    const aspect = viewMapAspect({ focus: null } as never);
    const small = spec.callout.sub;

    const story = size === 'story';
    // Square: rows on the left, the map on the right. Story: rows across, the map under them.
    const mapColW = story ? 0 : Math.round(innerW * 0.31);
    const rowsW = story ? innerW : innerW - mapColW - gap;

    let y = bodyTop;
    let lead: TextItem | null = null;
    if (!oneLine) {
        const leadSize = fitFontSize(scope.list, rowsW, spec.scope, Math.round(spec.scope * 0.8));
        lead = {
            x: pad,
            y: Math.round(y + leadSize * 0.85),
            text: scope.list,
            size: leadSize,
            tone: 'muted',
        };
        y = Math.round(lead.y + leadSize * 0.6);
    }
    const noteText = topCountiesNote(card);
    const noteAt = (width: number, size: number) =>
        noteText ? wrapText(noteText, width, size) : [];
    const noteH = (lines: number) =>
        lines ? Math.round(small * 0.6 + lines * small * 1.4) : 0;

    // The story's map block under the rows: its least height, so the rows leave room for it.
    const storyMapMin = story ? Math.round(innerW * STORY_MAP_MIN) : 0;
    // On the square the note runs the full width under the map's caption whenever the rows
    // reach below it (as they do with more than a handful), so that is the room it takes.
    const mapBlockH = Math.round(mapColW / aspect) + captionH(small);
    const noteFull = !story && bodyBottom - y - noteH(1) > mapBlockH + small * 2;
    const rowsRoom =
        bodyBottom -
        y -
        noteH(noteAt(noteFull ? innerW : rowsW, small).length) -
        (story ? storyMapMin + tight : 0);
    const fit = rowsFit(
        card,
        pad,
        rowsW,
        spec.row.label,
        rowsRoom,
        ROW_H[size] ?? ROW_H.square,
        small,
    );
    const rows = card.rows.map((_, i) =>
        rowAt(card, i, y + i * fit.h, fit.h, fit.cols, pad, rowsW),
    );
    y += rows.length * fit.h;
    // The note and the map's words are no larger than the rows' type.
    const noteSize = Math.min(small, card.rows.length ? fit.cols.size : small);
    const firstNoteY = Math.round(y + noteSize * 1.45);

    let map: Box;
    let caption: TextItem;
    let noteW = rowsW;
    if (story) {
        // Under the rows and the note: the map as tall as the room before the footer allows,
        // centred in the content width, with its caption directly under it.
        const noteBottom = noteText
            ? firstNoteY +
              Math.round((noteAt(rowsW, noteSize).length - 1) * noteSize * 1.4) +
              Math.round(noteSize * 0.4)
            : y;
        const blockTop = Math.round(noteBottom + tight);
        const mapH = Math.max(0, bodyBottom - blockTop - captionH(noteSize));
        const mapW = Math.min(innerW, Math.round(mapH * aspect));
        map = box(
            pad + Math.round((innerW - mapW) / 2),
            blockTop,
            mapW,
            Math.round(mapW / aspect),
        );
        caption = mapCaption(card, map, innerW, noteSize);
    } else {
        // Beside the rows, from the first row down, with its caption under it.
        const x = pad + rowsW + gap;
        const firstRow = rows[0]?.box.y ?? bodyTop;
        const mapH = Math.min(
            Math.round(mapColW / aspect),
            bodyBottom - firstRow - captionH(noteSize),
        );
        const mapW = Math.min(mapColW, Math.round(mapH * aspect));
        map = box(
            x + Math.round((mapColW - mapW) / 2),
            firstRow,
            mapW,
            Math.round(mapW / aspect),
        );
        caption = mapCaption(card, map, mapColW, noteSize);
        // Under the map's caption, the note may run the card's full width.
        if (firstNoteY - noteSize > caption.y + noteSize) noteW = innerW;
    }
    const note: TextItem[] = noteAt(noteW, noteSize).map((line, i) => ({
        x: pad,
        y: firstNoteY + Math.round(i * noteSize * 1.4),
        text: line,
        size: noteSize,
        tone: 'muted',
    }));

    return {
        w,
        h,
        // The ranked seat's lid is drawn deeper, as on the seat views.
        strip: strip(w, spec.stripH, card.seat),
        headline: t.headline,
        headlineLines: balanced(t.headlineLines, innerW / HEADLINE_STRETCH),
        scopeLine: t.scopeLine,
        lead,
        rows,
        note,
        map,
        mapCaption: caption,
        footerBox,
        footerFonts: spec.footer,
    };
}
