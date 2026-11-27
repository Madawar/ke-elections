// Layout for "By the numbers", square and story, inside the same frame as the other share cards
// (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the footer). Every
// box and every line of text is placed here, so the card component only draws what this returns
// and tests can check that nothing overlaps, runs off the card or is cut.
//
// One row per seat, in ballot order: the seat's ballot colour as a bar at the left edge, the
// number of seats large and right-aligned in its column, then the seat's name, "Most held:" with
// the three groups holding the most, and a thin mix bar. The rows take the largest type that fits
// the card; a "Most held:" line that does not fit goes on to a second line between groups, never
// inside one. The note sits under a rule after the rows.
import type { Box, FooterFonts, TextItem } from './layout';
import {
    type NumbersCardView,
    type NumbersRow,
    NUMBERS_SCOPE,
    numbersNote,
} from './numbersCard';
import type { ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import { spread } from './viewMix';
import {
    type Spec,
    type StripSegment,
    box,
    cardFrame,
    strip,
    titleBlock,
} from './viewLayout';
import type { SeatKey } from '@/lib/map/colouring';
import { SEAT_COLOURS } from '@/lib/map/theme';

export interface NumbersRowItem {
    seat: SeatKey;
    box: Box;
    /** The seat's ballot colour, at the left edge of the row. */
    lid: Box & { colour: string };
    /** The number of seats, right-aligned (`anchor: 'end'`) at the column's edge. */
    number: TextItem;
    /** "Governors". */
    label: TextItem;
    /** "Most held:", then one text per group ("UDA 20"); or "No approved holder yet". */
    most: TextItem[];
    /** Each group's colour, before its text. */
    chips: (Box & { colour: string })[];
    /** The thin mix bar, its parts in the legend's order with a gap between them. */
    bar: (Box & { colour: string; key: string })[];
}

export interface NumbersLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    rows: NumbersRowItem[];
    /** The hairline between the rows and the note. */
    rule: Box;
    noteBox: Box;
    note: TextItem[];
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface NumbersText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
}

interface Fonts {
    number: number;
    label: number;
    sub: number;
}

/** Where a row's parts start and end across the card. */
interface Columns {
    x: number;
    lidW: number;
    /** The right edge of the numbers. */
    numberRight: number;
    textX: number;
    right: number;
}

/** The big numbers are drawn heavier than the bold the text metrics assume. */
const NUMBER_WIDE = 1.04;
/** The number column takes at most this share of the width, so the words keep theirs. */
const NUMBER_COLUMN = 0.3;
const SCALES = [1.2, 1.1, 1, 0.94, 0.88, 0.82, 0.76, 0.7];
/** Below this scale the type is not made smaller just to keep a "Most held:" line whole. */
const MIN_SCALE = 0.88;

const fmt = (n: number) => n.toLocaleString('en-GB');
const numberWidth = (text: string, size: number) =>
    Math.ceil(textWidth(text, size, true) * NUMBER_WIDE);

/** The type at a scale: the number shrinks further if its column would be too wide. */
function fontsAt(
    spec: Spec,
    scale: number,
    card: NumbersCardView,
    innerW: number,
): Fonts {
    // The widest number's width per pixel of type.
    const perPx = Math.max(
        ...card.rows.map((r) => textWidth(fmt(r.seats), 1, true) * NUMBER_WIDE),
    );
    const wanted = Math.round(spec.callout.number * 1.15 * scale);
    const room = Math.floor((innerW * NUMBER_COLUMN) / perPx);
    return {
        number: Math.min(wanted, room),
        label: Math.round(spec.callout.label * 1.15 * scale),
        sub: Math.round(spec.callout.sub * scale),
    };
}

/** How a "Most held:" line breaks: not at all, after "Most held:", or between groups. */
type Wrap = 0 | 1 | 2;

/**
 * One row from `y`: its height is the larger of its words and its number. `wrap` is the break
 * the row needs; `mode` the one the card uses, so every row breaks its line the same way.
 */
function rowAt(
    y: number,
    row: NumbersRow,
    f: Fonts,
    cols: Columns,
    mode?: Wrap,
): { item: NumbersRowItem; wrap: Wrap } {
    const textW = cols.right - cols.textX;
    const labelSize = fitFontSize(
        row.label,
        textW,
        f.label,
        Math.round(f.label * 0.8),
        true,
    );
    // The words, laid out from 0 and moved down later to sit in the middle of the row.
    const labelY = Math.round(labelSize * 0.92);
    const lead = Math.round(f.sub * 1.4);
    let line = labelY + Math.round(f.sub * 1.5);
    const most: TextItem[] = [];
    const chips: NumbersRowItem['chips'] = [];
    const sw = Math.round(f.sub * 0.74);
    const chipGap = Math.round(f.sub * 0.34);
    const sep = Math.round(f.sub * 0.9);
    const groups = row.most.map((g) => {
        const text = `${g.label} ${fmt(g.count)}`;
        return { g, text, w: sw + chipGap + Math.ceil(textWidth(text, f.sub)) };
    });
    const prefix = 'Most held:';
    const afterPrefix = Math.round(f.sub * 0.6);
    const groupsW =
        groups.reduce((n, g) => n + g.w, 0) +
        sep * Math.max(0, groups.length - 1);
    // One line if it fits; else the groups together on the line after "Most held:"; else they
    // wrap between groups. A group is never split.
    const wrap: Wrap = !groups.length
        ? 0
        : Math.ceil(textWidth(prefix, f.sub)) + afterPrefix + groupsW <= textW
          ? 0
          : groupsW <= textW
            ? 1
            : 2;
    let x = cols.textX;
    const put = (text: string, tone: TextItem['tone']) => {
        most.push({ x, y: line, text, size: f.sub, tone });
        x += Math.ceil(textWidth(text, f.sub));
    };
    if (!groups.length) put('No approved holder yet', 'muted');
    else {
        put(prefix, 'muted');
        groups.forEach(({ g, text, w }, i) => {
            const space = i === 0 ? afterPrefix : sep;
            if (
                (i === 0 && (mode ?? wrap) === 1) ||
                x + space + w > cols.right
            ) {
                line += lead;
                x = cols.textX;
            } else x += space;
            chips.push({
                x,
                y: line - Math.round(f.sub * 0.7),
                w: sw,
                h: sw,
                colour: g.colour,
            });
            x += sw + chipGap;
            put(text, 'ink');
        });
    }
    const barY = line + Math.round(f.sub * 0.55);
    const barH = Math.max(6, Math.round(f.sub * 0.42));
    const words = barY + barH;
    // The number's whole em must sit in the row, so it is never clipped by the next.
    const height = Math.max(words, f.number);
    const dy = y + Math.round((height - words) / 2);
    const gap = Math.max(2, Math.round(barH * 0.3));
    const bar = spread(row.parts, cols.textX, textW, gap).map((p) => ({
        key: p.key,
        colour: p.colour,
        x: p.x,
        y: dy + barY,
        w: p.w,
        h: barH,
    }));
    const item: NumbersRowItem = {
        seat: row.seat,
        box: box(cols.x, y, cols.right - cols.x, height),
        lid: {
            x: cols.x,
            y,
            w: cols.lidW,
            h: height,
            colour: SEAT_COLOURS[row.seat],
        },
        number: {
            x: cols.numberRight,
            y: y + Math.round(f.number * 0.8 + (height - f.number) / 2),
            text: fmt(row.seats),
            size: f.number,
            weight: 800,
            anchor: 'end',
            tone: 'ink',
        },
        label: {
            x: cols.textX,
            y: dy + labelY,
            text: row.label,
            size: labelSize,
            weight: 700,
            tone: 'ink',
        },
        most: most.map((t) => ({ ...t, y: t.y + dy })),
        chips: chips.map((c) => ({ ...c, y: c.y + dy })),
        bar,
    };
    return { item, wrap };
}

export function numbersLayout(
    size: ViewSize,
    card: NumbersCardView,
    text: NumbersText,
): NumbersLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(
        size,
        card,
        text.url,
    );
    const { pad } = spec;
    const t = titleBlock(pad, top, innerW, spec, text.headline, NUMBERS_SCOPE);
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);

    // The note: a rule, then its sentences across the width.
    const noteSize = spec.callout.sub;
    const noteLines = wrapText(numbersNote(card), innerW, noteSize);
    const ruleGap = Math.round(spec.gap * 0.5);
    const noteH =
        ruleGap +
        1 +
        Math.round(noteSize * 1.6) +
        Math.round((noteLines.length - 1) * noteSize * 1.4) +
        Math.round(noteSize * 0.3);

    // The rows keep at least this much room between them.
    const minGap = Math.round(spec.gap * 0.4);
    const columns = (f: Fonts): Columns => {
        const lidW = Math.max(10, Math.round(f.label * 0.4));
        const widest = Math.max(
            ...card.rows.map((r) => numberWidth(fmt(r.seats), f.number)),
        );
        const numberRight = pad + lidW + Math.round(f.label * 0.6) + widest;
        return {
            x: pad,
            lidW,
            numberRight,
            textX: numberRight + Math.round(f.label * 0.7),
            right: pad + innerW,
        };
    };
    // The rows and note must fit between the headline and the footer. The best break first
    // (none, then after "Most held:", then between groups), and within it the largest type that
    // fits; the type is not made smaller than MIN_SCALE for a better break.
    const height = (f: Fonts, mode: Wrap) => {
        const laid = card.rows.map((r) => rowAt(0, r, f, columns(f), mode));
        return {
            wrap: Math.max(...laid.map((r) => r.wrap)),
            h:
                laid.reduce((n, r) => n + r.item.box.h, 0) +
                minGap * (laid.length - 1) +
                noteH,
        };
    };
    let fonts = fontsAt(spec, SCALES[SCALES.length - 1], card, innerW);
    let mode: Wrap = 2;
    search: for (const worst of [0, 1, 2] as const)
        for (const scale of SCALES) {
            if (worst < 2 && scale < MIN_SCALE) continue;
            const f = fontsAt(spec, scale, card, innerW);
            const laid = height(f, worst);
            if (laid.wrap <= worst && laid.h <= bodyBottom - bodyTop) {
                fonts = f;
                mode = worst;
                break search;
            }
        }
    const cols = columns(fonts);
    const items = card.rows.map((r) => rowAt(0, r, fonts, cols, mode).item);
    // Spare room opens the rows up a little; the rest stays above the footer.
    const rowsH = items.reduce((n, r) => n + r.box.h, 0);
    const spare = bodyBottom - bodyTop - noteH - rowsH;
    const gap = Math.max(
        minGap,
        Math.min(
            Math.round(fonts.label * 0.9),
            Math.floor(spare / Math.max(1, items.length - 1)),
        ),
    );
    const rows: NumbersRowItem[] = [];
    let y = bodyTop;
    for (const r of card.rows) {
        const { item } = rowAt(y, r, fonts, cols, mode);
        rows.push(item);
        y += item.box.h + gap;
    }
    y -= gap;
    const rule = box(pad, y + ruleGap, innerW, 1);
    let lineY = rule.y + 1 + Math.round(noteSize * 1.6);
    const note: TextItem[] = noteLines.map((line, i) => {
        if (i) lineY += Math.round(noteSize * 1.4);
        return { x: pad, y: lineY, text: line, size: noteSize, tone: 'muted' };
    });
    const noteTop = rule.y + 1 + Math.round(noteSize * 0.6);
    return {
        w,
        h,
        // No one seat's lid stands out: the card is about all five.
        strip: strip(w, spec.stripH),
        headline: t.headline,
        headlineLines: t.headlineLines,
        scopeLine: t.scopeLine,
        rows,
        rule,
        noteBox: box(
            pad,
            noteTop,
            innerW,
            lineY + Math.round(noteSize * 0.3) - noteTop,
        ),
        note,
        footerBox,
        footerFonts: spec.footer,
    };
}
