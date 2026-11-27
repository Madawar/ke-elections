// Layout for "Kenya, five ways", square and story, inside the same frame as the other share cards
// (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the footer). Every
// box and every line of text is placed here, so the card component only draws what this returns
// and tests can check that nothing overlaps, runs off the card or is cut.
//
// Six cells in a grid, three across and two down on the square, two across and three down on the
// story: the five maps in ballot order, then the key. Each map cell is a rule in the seat's ballot
// colour, "Governors" (bold) and "47 seats", then the map. Every map box is the same size and the
// boxes line up by row and column, so the five maps are drawn at one scale. The key cell is a grey
// rule, "Party colours", the entries in two columns (down the first, then the second) and the line
// that says how they are ordered. The key never goes below the card's small text: if it needs more
// height than a map cell, its row is made taller and the maps a little smaller.
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

const GRID: Record<ViewSize, { across: number; down: number }> = {
    square: { across: 3, down: 2 },
    portrait: { across: 3, down: 2 },
    story: { across: 2, down: 3 },
    x: { across: 3, down: 2 },
};

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

/** "Governors" bold, then "47 seats", on one line no wider than `w`. */
function title(
    x: number,
    baseline: number,
    w: number,
    size: number,
    label: string,
    seats: number,
): TextItem[] {
    const count = `${seats.toLocaleString('en-GB')} seats`;
    const space = Math.round(size * 0.15);
    const widthAt = (s: number) =>
        textWidth(label, s, true) + Math.round(s * 0.15) + textWidth(count, s);
    let s = size;
    while (s > Math.round(size * 0.8) && widthAt(s) > w) s--;
    return [
        { x, y: baseline, text: label, size: s, weight: 700, tone: 'ink' },
        {
            x: x + Math.ceil(textWidth(label, s, true)) + space,
            y: baseline,
            text: count,
            size: s,
            tone: 'muted',
        },
    ];
}

interface KeyPlan {
    entries: FiveSeatsKeyItem[];
    note: TextItem[];
    /** From the top of the key's content to the foot of its note. */
    height: number;
}

/** The key's entries in two columns from (x, y), then the note under them. */
function keyAt(
    card: FiveSeatsCardView,
    x: number,
    y: number,
    w: number,
    size: number,
    noteSize: number,
): KeyPlan {
    const lead = Math.round(size * 1.32);
    const chip = Math.round(size * 0.8);
    const chipGap = Math.round(size * 0.4);
    const colGap = Math.round(size * 1.1);
    const columns = card.key.filter((k) => k.key !== 'none');
    const none = card.key.find((k) => k.key === 'none');
    const perCol = Math.ceil(columns.length / 2);
    const first = columns.slice(0, perCol);
    const firstW = Math.max(
        0,
        ...first.map((k) => chip + chipGap + Math.ceil(textWidth(k.label, size))),
    );
    // The second column starts after the widest of the first, or at half the width if that is
    // further along, so the two read as columns.
    const secondX = x + Math.max(firstW + colGap, Math.round(w / 2));
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
        entry(
            k,
            i < perCol ? x : secondX,
            top + (i < perCol ? i : i - perCol) * lead,
        ),
    );
    let bottom = top + (perCol - 1) * lead;
    if (none) {
        bottom += lead;
        entries.push(entry(none, x, bottom));
    }
    const noteLines = evenLines(fiveSeatsKeyNote(card), w, noteSize);
    const noteLead = Math.round(noteSize * 1.35);
    const firstNote = bottom + Math.round(noteSize * 1.75);
    const note: TextItem[] = noteLines.map((text, i) => ({
        x,
        y: firstNote + i * noteLead,
        text,
        size: noteSize,
        tone: 'muted',
    }));
    const foot = (note.at(-1)?.y ?? bottom) + Math.round(noteSize * 0.3);
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
    const { across, down } = GRID[size];
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

    // The key's height decides whether its row must be taller than a map cell.
    const keyPlan = keyAt(card, 0, 0, cellW, keySize, noteSize);
    const keyH = headerH + keyPlan.height;
    const room = bodyBottom - bodyTop - (down - 1) * rowGap;
    const even = Math.floor(room / down);
    const cellH =
        keyH > even ? Math.floor((room - keyH) / (down - 1)) : even;

    const aspect = viewMapAspect({ focus: null } as never);
    const mapRoomH = cellH - headerH;
    const mapW = Math.max(0, Math.min(cellW, Math.floor(mapRoomH * aspect)));
    const mapH = Math.floor(mapW / aspect);

    const rowY = (r: number) => bodyTop + r * (cellH + rowGap);
    const maps: FiveSeatsMapItem[] = card.maps.map((m, i) => {
        const r = Math.floor(i / across);
        const x = cellX(i % across);
        const hd = header(x, rowY(r), cellW, ruleH, titleSize);
        return {
            seat: m.seat,
            rule: { ...hd.rule, colour: SEAT_COLOURS[m.seat] },
            title: title(x, hd.baseline, cellW, titleSize, m.label, m.seats),
            box: box(
                x + Math.floor((cellW - mapW) / 2),
                hd.under,
                mapW,
                mapH,
            ),
        };
    });

    const keyX = cellX(across - 1);
    const kh = header(keyX, rowY(down - 1), cellW, ruleH, titleSize);
    const titleText = FIVE_SEATS_KEY_TITLE;
    const key = keyAt(card, keyX, kh.under, cellW, keySize, noteSize);

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
            rule: kh.rule,
            title: [
                {
                    x: keyX,
                    y: kh.baseline,
                    text: titleText,
                    size: fitFontSize(titleText, cellW, titleSize, Math.round(titleSize * 0.8), true),
                    weight: 700,
                    tone: 'ink',
                },
            ],
            entries: key.entries,
            note: key.note,
        },
        footerBox,
        footerFonts: spec.footer,
    };
}
