// Layout for "Kenya, five ways", square and story, inside the same frame as the other share cards
// (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the footer). Every
// box and every line of text is placed here, so the card component only draws what this returns
// and tests can check that nothing overlaps, runs off the card or is cut.
//
// Six cells in a grid, three across and two down, in both sizes: the five maps in ballot order, then
// the key. Each map cell is a rule in the seat's ballot colour, "Governors" (bold) and "47 seats",
// then the map. Every map box is the same size and the boxes line up by row and column, so the five
// maps are drawn at one scale. The key cell is a grey rule, "Party colours", the entries in two
// columns (down the first, then the second) and the line that says how they are ordered. The key
// never goes below the card's small text: if it needs more height than a map cell, its row is made
// taller and the maps a little smaller. When its two columns do not fit in the sixth cell at that
// size (the story), the sixth cell is left empty and the key goes across the full width under the
// grid, in four columns (three if four do not fit), with its note at the right of its title line
// when there is room for it there.
import {
    FIVE_SEATS_KEY_TITLE,
    type FiveSeatsCardView,
    fiveSeatsKeyNote,
    fiveSeatsScope,
} from './fiveSeatsCard';
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

export interface FiveSeatsMapItem {
    seat: SeatKey;
    /** The seat's ballot colour across the top of its cell. */
    rule: Box & { colour: string };
    /** "Governors" (bold), then "47 seats". */
    title: TextItem[];
    /** The space between the name and the count, set after the name as the browser draws it. */
    titleGap: number;
    /** The map's box: the same size for all five. */
    box: Box;
}

export interface FiveSeatsKeyItem {
    key: string;
    chip: Box & { colour: string };
    label: TextItem;
}

export interface FiveSeatsLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    maps: FiveSeatsMapItem[];
    key: {
        /** The key runs across the full width under the grid, not in the sixth cell. */
        across: boolean;
        /** The grey rule across the top of the key's cell (drawn in the theme's hairline). */
        rule: Box;
        title: TextItem[];
        entries: FiveSeatsKeyItem[];
        /** "Parties in order of seats held across all five". */
        note: TextItem[];
    };
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface FiveSeatsText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
}

/** Three across and two down in every size: five maps, then the key or an empty cell. */
const GRID = { across: 3, down: 2 };

/** The headline on one line when it fits at this share of the usual size or more. */
const ONE_LINE = 0.84;

/** Lines no wider than `w`, as many as `wrapText` makes, as even as they can be (no lone last word). */
function evenLines(text: string, w: number, size: number): string[] {
    const lines = wrapText(text, w, size);
    let best = lines;
    for (let ww = w - 4; ww > w / 2; ww -= 4) {
        const next = wrapText(text, ww, size);
        if (next.length !== lines.length || next.some((l) => l.endsWith('…'))) break;
        best = next;
    }
    return best;
}

/** A cell's rule, title and the room under it, laid out from the cell's top. */
function header(x: number, y: number, w: number, ruleH: number, size: number) {
    const baseline = y + ruleH + Math.round(size * 1.25);
    return {
        rule: box(x, y, w, ruleH),
        baseline,
        /** Where the cell's content starts. */
        under: baseline + Math.round(size * 0.55),
    };
}

/** The size at which "Governors" bold, then "47 seats", fits on one line no wider than `w`. */
function titleFit(w: number, size: number, label: string, seats: number): number {
    const count = `${seats.toLocaleString('en-GB')} seats`;
    const widthAt = (s: number) =>
        textWidth(label, s, true) + titleGapAt(s) + textWidth(count, s);
    let s = size;
    while (s > Math.round(size * 0.8) && widthAt(s) > w) s--;
    return s;
}

/** A cell's title at `size` (see `titleSize`): "Governors" bold, then "47 seats". */
function title(
    x: number,
    baseline: number,
    s: number,
    label: string,
    seats: number,
): { items: TextItem[]; gap: number } {
    const count = `${seats.toLocaleString('en-GB')} seats`;
    const gap = titleGapAt(s);
    // The count's x is the measured estimate, for the layout's checks; the card draws the count as
    // a span right after the name with this gap, so the browser sets it from the real name.
    return {
        items: [
            { x, y: baseline, text: label, size: s, weight: 700, tone: 'ink' },
            {
                x: x + Math.ceil(textWidth(label, s, true)) + gap,
                y: baseline,
                text: count,
                size: s,
                tone: 'muted',
            },
        ],
        gap,
    };
}

/** The space between a title's name and its count: about a word space and a bit. */
const titleGapAt = (size: number) => Math.round(size * 0.3);

interface KeyPlan {
    entries: FiveSeatsKeyItem[];
    note: TextItem[];
    /** From the top of the key's content to the foot of its note. */
    height: number;
}

const keyMetrics = (size: number) => ({
    lead: Math.round(size * 1.32),
    chip: Math.round(size * 0.8),
    chipGap: Math.round(size * 0.4),
    colGap: Math.round(size * 1.1),
});

/** An entry's width: its chip, the gap and its label. */
const entryW = (label: string, size: number) => {
    const m = keyMetrics(size);
    return m.chip + m.chipGap + Math.ceil(textWidth(label, size));
};

/**
 * The entries that go in the columns. "No approved holder yet" always goes on a line of its own
 * under them; so does "Other parties" when `otherOwnLine` (both are last in the key's order).
 */
const columnEntries = (card: FiveSeatsCardView, otherOwnLine = false) =>
    card.key.filter((k) => k.key !== 'none' && !(otherOwnLine && k.key === 'other'));

/** The key's entries fit in two columns `w` wide at this size, nothing cut. */
function twoColumnsFit(
    card: FiveSeatsCardView,
    w: number,
    size: number,
    otherOwnLine: boolean,
): boolean {
    const { colGap } = keyMetrics(size);
    const entries = columnEntries(card, otherOwnLine);
    const perCol = Math.ceil(entries.length / 2);
    const widest = (list: FiveSeatsCardView['key']) =>
        Math.max(0, ...list.map((k) => entryW(k.label, size)));
    const firstW = widest(entries.slice(0, perCol));
    const secondW = widest(entries.slice(perCol));
    const lines = card.key.filter((k) => !entries.includes(k));
    return (
        Math.max(firstW + colGap, Math.round(w / 2)) + secondW <= w && widest(lines) <= w
    );
}

/** The most columns, four or three, in which the key fits across `w`; null if neither does. */
function acrossColumns(card: FiveSeatsCardView, w: number, size: number): number | null {
    const { colGap } = keyMetrics(size);
    const widest = Math.max(0, ...card.key.map((k) => entryW(k.label, size)));
    for (const n of [4, 3]) if (widest + colGap <= Math.floor(w / n)) return n;
    return null;
}

/**
 * The key's entries from (x, y), down each column then the next, then the note under them. Two
 * columns: the second starts after the widest of the first, or at half the width if that is further
 * along, so the two read as columns. More columns: each starts at its share of the width. With
 * `noteAbove`, the note is not placed here (the caller puts it on the title line).
 */
function keyAt(
    card: FiveSeatsCardView,
    x: number,
    y: number,
    w: number,
    size: number,
    noteSize: number,
    cols = 2,
    noteAbove = false,
    otherOwnLine = false,
): KeyPlan {
    const { lead, chip, chipGap, colGap } = keyMetrics(size);
    const columns = columnEntries(card, otherOwnLine);
    const lines = card.key.filter((k) => !columns.includes(k));
    const perCol = Math.ceil(columns.length / cols);
    const first = columns.slice(0, perCol);
    const firstW = Math.max(
        0,
        ...first.map((k) => chip + chipGap + Math.ceil(textWidth(k.label, size))),
    );
    const colX = (c: number) =>
        cols === 2
            ? c === 0
                ? x
                : x + Math.max(firstW + colGap, Math.round(w / 2))
            : x + c * Math.floor(w / cols);
    const entry = (
        k: FiveSeatsCardView['key'][number],
        ex: number,
        baseline: number,
    ): FiveSeatsKeyItem => ({
        key: k.key,
        chip: {
            x: ex,
            y: baseline - Math.round(size * 0.78),
            w: chip,
            h: chip,
            colour: k.colour,
        },
        label: {
            x: ex + chip + chipGap,
            y: baseline,
            text: k.label,
            size,
            tone: 'ink',
        },
    });
    const top = y + Math.round(size * 0.95);
    const entries = columns.map((k, i) =>
        entry(k, colX(Math.floor(i / perCol)), top + (i % perCol) * lead),
    );
    let bottom = top + (perCol - 1) * lead;
    for (const k of lines) {
        bottom += lead;
        entries.push(entry(k, x, bottom));
    }
    const noteLines = noteAbove ? [] : evenLines(fiveSeatsKeyNote(card), w, noteSize);
    const noteLead = Math.round(noteSize * 1.35);
    const firstNote = bottom + Math.round(noteSize * 1.75);
    const note: TextItem[] = noteLines.map((text, i) => ({
        x,
        y: firstNote + i * noteLead,
        text,
        size: noteSize,
        tone: 'muted',
    }));
    const foot = note.length
        ? note.at(-1)!.y + Math.round(noteSize * 0.3)
        : bottom + Math.round(size * 0.3);
    return { entries, note, height: foot - y };
}

export function fiveSeatsLayout(
    size: ViewSize,
    card: FiveSeatsCardView,
    text: FiveSeatsText,
): FiveSeatsLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(
        size,
        card,
        text.url,
    );
    const { pad } = spec;
    // One line when the headline fits on one at ONE_LINE of its size or more; else the usual
    // lines, with no word alone on the last.
    const headW = innerW / HEADLINE_STRETCH;
    let one = spec.headline;
    while (one > spec.headline * ONE_LINE && textWidth(text.headline, one, true) > headW)
        one -= 2;
    const t = titleBlock(
        pad,
        top,
        innerW,
        textWidth(text.headline, one, true) <= headW
            ? { ...spec, headline: one, headlineLines: 1 }
            : spec,
        text.headline,
        fiveSeatsScope(card),
    );
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);
    const { across, down } = GRID;
    const colGap = spec.gap;
    const rowGap = Math.round(spec.gap * 0.7);
    const cellW = Math.floor((innerW - (across - 1) * colGap) / across);
    const cellX = (c: number) =>
        c === across - 1 ? pad + innerW - cellW : pad + c * (cellW + colGap);
    const ruleH = Math.max(6, Math.round(spec.stripH * 0.5));
    const titleSize = Math.round(spec.callout.label * 0.9);
    const keySize = spec.callout.sub;
    const noteSize = Math.min(keySize, spec.footer.text);
    const headerH = header(0, 0, cellW, ruleH, titleSize).under;
    const titleText = FIVE_SEATS_KEY_TITLE;
    const keyTitleSize = (w: number) =>
        fitFontSize(titleText, w, titleSize, Math.round(titleSize * 0.8), true);

    // The key goes in the sixth cell when its two columns fit there; otherwise across the full
    // width under the grid, with its note at the right of the title line when it fits there.
    // "Other parties" goes on a line of its own under the columns when that is what lets the two
    // columns fit in the cell.
    const otherOwnLine =
        !twoColumnsFit(card, cellW, keySize, false) &&
        twoColumnsFit(card, cellW, keySize, true);
    const inCell = otherOwnLine || twoColumnsFit(card, cellW, keySize, false);
    const cols = inCell ? 2 : (acrossColumns(card, innerW, keySize) ?? 3);
    const noteText = fiveSeatsKeyNote(card);
    const noteAbove =
        !inCell &&
        textWidth(titleText, keyTitleSize(innerW), true) +
            Math.round(titleSize * 1.2) +
            textWidth(noteText, noteSize) <=
            innerW;
    const keyW = inCell ? cellW : innerW;
    const keyPlan = keyAt(card, 0, 0, keyW, keySize, noteSize, cols, noteAbove, otherOwnLine);
    const keyH = headerH + keyPlan.height;
    let cellH: number;
    if (inCell) {
        // The key's height decides whether its row must be taller than a map cell.
        const room = bodyBottom - bodyTop - (down - 1) * rowGap;
        const even = Math.floor(room / down);
        cellH = keyH > even ? Math.floor((room - keyH) / (down - 1)) : even;
    } else {
        const room = bodyBottom - bodyTop - down * rowGap - keyH;
        cellH = Math.floor(room / down);
    }

    const aspect = viewMapAspect({ focus: null } as never);
    const mapRoomH = cellH - headerH;
    const mapW = Math.max(0, Math.min(cellW, Math.floor(mapRoomH * aspect)));
    const mapH = Math.floor(mapW / aspect);
    // A row is no taller than its maps need (a map narrower than its cell leaves no gap below).
    if (!inCell) cellH = Math.min(cellH, headerH + mapH);

    const rowY = (r: number) => bodyTop + r * (cellH + rowGap);
    // One title size for all five, the largest at which every one fits its cell.
    const titleAt = Math.min(
        ...card.maps.map((m) => titleFit(cellW, titleSize, m.label, m.seats)),
    );
    const maps: FiveSeatsMapItem[] = card.maps.map((m, i) => {
        const r = Math.floor(i / across);
        const x = cellX(i % across);
        const hd = header(x, rowY(r), cellW, ruleH, titleSize);
        const t = title(x, hd.baseline, titleAt, m.label, m.seats);
        return {
            seat: m.seat,
            rule: { ...hd.rule, colour: SEAT_COLOURS[m.seat] },
            title: t.items,
            titleGap: t.gap,
            box: box(
                x + Math.floor((cellW - mapW) / 2),
                hd.under,
                mapW,
                mapH,
            ),
        };
    });

    const keyX = inCell ? cellX(across - 1) : pad;
    const kh = header(keyX, inCell ? rowY(down - 1) : rowY(down), keyW, ruleH, titleSize);
    const key = keyAt(card, keyX, kh.under, keyW, keySize, noteSize, cols, noteAbove, otherOwnLine);
    const note: TextItem[] = noteAbove
        ? [
              {
                  x: keyX + keyW,
                  y: kh.baseline,
                  text: noteText,
                  size: noteSize,
                  anchor: 'end',
                  tone: 'muted',
              },
          ]
        : key.note;

    return {
        w,
        h,
        // No one seat's lid stands out: the card is about all five.
        strip: strip(w, spec.stripH),
        headline: t.headline,
        headlineLines: balanced(t.headlineLines, headW),
        scopeLine: t.scopeLine,
        maps,
        key: {
            across: !inCell,
            rule: kh.rule,
            title: [
                {
                    x: keyX,
                    y: kh.baseline,
                    text: titleText,
                    size: keyTitleSize(keyW),
                    weight: 700,
                    tone: 'ink',
                },
            ],
            entries: key.entries,
            note,
        },
        footerBox,
        footerFonts: spec.footer,
    };
}
