// Layout for the "Share this view" card, one arrangement per size. Every block is a box in card
// pixels and every line of text is placed here, so the card component (and the video, which
// draws the same layout on a canvas) only draws what this returns, and tests can check that
// nothing overlaps or runs off the card.
//
// Square and portrait pick the arrangement that gives the map the most room for the shape being
// shown: Kenya (taller than wide) sits beside the chart, a wide county sits above it. Stories
// stack map, callouts and chart; X puts the map on the left and the words on the right.
import { ATTRIBUTION, SEAT_COLOURS } from '@/lib/map/theme';
import type { Box, FooterFonts, TextItem } from './layout';
import { footerBlock } from './layout';
import { type LeadersStripLayout, leadersStrip } from './leadersStrip';
import { VIEW_SIZES, type ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import {
    type HolderBlockLayout,
    type MixBarLayout,
    type MixPartInput,
    holderBlock,
    type MixFonts,
    type MixLegendLayout,
    type MixRowItem,
    mixBar,
    mixLegend,
    mixRows,
} from './viewMix';
import { type ViewState, calloutsFor, scopeLineFor } from './viewState';

export type { Box } from './layout';

/** Headlines are drawn at full width (wdth 100), about 9% wider than the text metrics. */
export const HEADLINE_STRETCH = 100 / 92;

export interface StripSegment extends Box {
    colour: string;
    current: boolean;
}

export interface RowItem {
    key: string;
    highlighted: boolean;
    colour: string;
    kind: ViewState['rows'][number]['kind'];
    label: TextItem;
    bar: Box;
    value: TextItem;
}

export interface CalloutItem {
    key: string;
    lid: Box & { colour: string };
    label: TextItem;
    number: TextItem;
    sub: TextItem;
}

export interface ViewLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    map: Box;
    calloutBox: Box;
    callouts: CalloutItem[];
    chartBox: Box;
    chartTitle: TextItem | null;
    /** The bars' common zero line. */
    axis: Box;
    rows: RowItem[];
    /** The 100% seat mix bar under the headline. */
    mixBar: MixBarLayout | null;
    /** Its legend, on cards with rows (otherwise the bar chart names the parts). */
    mixLegend: MixLegendLayout | null;
    /** The rows inside a focused unit, in code order, as many as fit. */
    mixRows: MixRowItem[];
    rowsBox: Box | null;
    /** Rows left out for room ("and N more constituencies"). */
    rowsMore: number;
    moreLine: TextItem | null;
    /** A single seat: who holds it, in place of the bar, callouts and chart. */
    holder: HolderBlockLayout | null;
    /** The leaders strip of an MCA card for a county or a constituency, above the seat mix. */
    leaders: LeadersStripLayout | null;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface Spec {
    pad: number;
    /** Room kept clear at the top and bottom (story apps draw their own controls there). */
    safeTop: number;
    safeBottom: number;
    /**
     * Room kept clear of text on the right (TikTok and Reels put their buttons there). Stories
     * keep text out of the bottom ~400 px and right ~120 px those apps cover.
     */
    insetRight?: number;
    stripH: number;
    headline: number;
    /** Lines the headline may take before it shrinks, and at the smallest size. */
    headlineLines: number;
    headlineMax: number;
    /** The smallest headline size, as a share of the base (0.78 unless set). */
    headlineMin?: number;
    scope: number;
    /** Chart rows: text size, preferred and largest row height, bar thickness. */
    row: { label: number; h: number; max: number; bar: number };
    callout: { label: number; number: number; sub: number; h: number };
    footer: FooterFonts;
    gap: number;
    /** Width of the chart column beside the map ("side"). */
    colW: number;
    /** Width of the callout column beside the map ("mapCallouts"). */
    calloutColW: number;
    arrangements: Arrangement[];
    mix: MixFonts;
    /** On cards with rows, the map's width beside the headline, as a share of the width. */
    insetMap: number;
    /**
     * The fewest rows a list keeps when the map grows (a shorter list stays whole): the rest
     * become "and N more". The taller cards keep more, so a constituency's wards stay listed.
     */
    minRows: number;
    /**
     * The leaders strip: its type size, one column or two, and whether a constituency's MP keeps
     * a line of its own above the two columns (not on the square card, the shortest of room).
     */
    leaders: { font: number; columns: 1 | 2; lead?: boolean };
}

/**
 * - side: the map, and beside it the callouts above the chart.
 * - stack: the map, and under it the callouts beside the chart.
 * - mapCallouts: the map with the callouts beside it, and the chart under both.
 * - tall: the map, the callouts, then the chart, each across the full width.
 */
type Arrangement = 'side' | 'stack' | 'mapCallouts' | 'tall';

export const SPECS: Record<ViewSize, Spec> = {
    square: {
        pad: 60,
        safeTop: 0,
        safeBottom: 0,
        stripH: 12,
        headline: 56,
        headlineLines: 2,
        headlineMax: 3,
        scope: 27,
        row: { label: 25, h: 42, max: 46, bar: 22 },
        callout: { label: 26, number: 80, sub: 21, h: 150 },
        footer: { text: 21, small: 16, url: 23 },
        gap: 32,
        colW: 456,
        calloutColW: 300,
        arrangements: ['side', 'stack'],
        mix: { bar: 44, legend: 21, row: 24, rowMin: 34, rowMax: 44 },
        insetMap: 0.3,
        minRows: 3,
        leaders: { font: 22, columns: 2, lead: false },
    },
    portrait: {
        pad: 64,
        safeTop: 0,
        safeBottom: 0,
        stripH: 14,
        headline: 62,
        headlineLines: 2,
        headlineMax: 3,
        scope: 29,
        row: { label: 28, h: 50, max: 60, bar: 26 },
        callout: { label: 29, number: 104, sub: 23, h: 184 },
        footer: { text: 22, small: 17, url: 24 },
        gap: 36,
        colW: 452,
        calloutColW: 320,
        arrangements: ['side', 'stack', 'mapCallouts'],
        mix: { bar: 46, legend: 22, row: 24, rowMin: 34, rowMax: 48 },
        insetMap: 0.32,
        minRows: 6,
        leaders: { font: 23, columns: 2 },
    },
    story: {
        pad: 72,
        safeTop: 120,
        safeBottom: 400,
        insetRight: 120,
        stripH: 16,
        headline: 74,
        headlineLines: 2,
        headlineMax: 3,
        scope: 33,
        row: { label: 28, h: 46, max: 52, bar: 26 },
        callout: { label: 32, number: 120, sub: 26, h: 206 },
        footer: { text: 23, small: 18, url: 27 },
        gap: 36,
        colW: 0,
        calloutColW: 300,
        arrangements: ['mapCallouts', 'tall'],
        mix: { bar: 46, legend: 24, row: 27, rowMin: 38, rowMax: 54 },
        insetMap: 0.34,
        minRows: 8,
        leaders: { font: 27, columns: 1 },
    },
    x: {
        pad: 56,
        safeTop: 0,
        safeBottom: 0,
        stripH: 12,
        headline: 54,
        headlineLines: 2,
        headlineMax: 3,
        scope: 27,
        row: { label: 26, h: 41, max: 44, bar: 22 },
        callout: { label: 26, number: 84, sub: 21, h: 152 },
        footer: { text: 20, small: 15, url: 22 },
        gap: 36,
        colW: 760,
        calloutColW: 270,
        arrangements: [],
        mix: { bar: 38, legend: 20, row: 23, rowMin: 32, rowMax: 42 },
        insetMap: 0,
        minRows: 3,
        leaders: { font: 21, columns: 1 },
    },
};

/** The map on every card is about this much bigger than on the first cards. */
export const MAP_GROWTH = 1.15;
/** ... and on an MCA card for a county or a constituency, about this much. */
export const MCA_MAP_GROWTH = 1.25;
/**
 * The padding and gaps the map's extra room comes from, as shares of the spec's `pad` and `gap`:
 * above the headline, under the footer, and between the blocks.
 */
const TIGHT = { top: 0.5, foot: 0.55, gap: 0.62 };
/** How close a chart's rows under the map may come to make that room. */
const CHART_TIGHT = 0.87;
/** How narrow the chart's column beside the map may get (its big numbers must still fit). */
const SIDE_TIGHT = 0.93;

export const box = (x: number, y: number, w: number, h: number): Box => ({
    x,
    y,
    w,
    h,
});

const fmt = (n: number) => n.toLocaleString('en-GB');

/** The six ballot colours across the top, the shared seat's lid drawn deeper (none: all alike). */
export function strip(
    w: number,
    h: number,
    seat?: ViewState['seat'],
): StripSegment[] {
    const keys = Object.keys(SEAT_COLOURS) as (keyof typeof SEAT_COLOURS)[];
    const segW = w / keys.length;
    return keys.map((k, i) => ({
        x: Math.round(i * segW),
        y: 0,
        w: Math.round((i + 1) * segW) - Math.round(i * segW),
        h: k === seat ? h * 2 : h,
        colour: SEAT_COLOURS[k],
        current: k === seat,
    }));
}

/**
 * Break a headline for the card: after its colon when it needs two lines ("MCA seats across
 * Kenya:" then "UDA 523, ODM 312"), and between the "party count" pairs, never inside one.
 */
export function breakHeadline(
    text: string,
    w: number,
    size: number,
    maxLines: number,
): string[] {
    const fits = (t: string) => textWidth(t, size, true) <= w;
    if (fits(text)) return [text];
    const colon = text.indexOf(': ');
    if (colon > 0 && maxLines > 1) {
        const head = text.slice(0, colon + 1);
        const chunks = text.slice(colon + 2).split(', ');
        // In a narrow column the part before the colon may itself take two lines ("MCA seats
        // in" then "Nairobi City:"), so the pairs after it still start on a line of their own.
        const headLines = fits(head)
            ? [head]
            : maxLines > 2
              ? wrapText(head, w, size, 2, true)
              : [];
        if (
            headLines.length &&
            headLines.join(' ') === head &&
            chunks.every(fits)
        ) {
            const lines = [...headLines];
            let line = '';
            chunks.forEach((chunk, i) => {
                const last = i === chunks.length - 1;
                const piece = last ? chunk : `${chunk},`;
                const next = line ? `${line} ${piece}` : piece;
                if (!line || fits(next)) line = next;
                else {
                    lines.push(line);
                    line = piece;
                }
            });
            if (line) lines.push(line);
            if (lines.length <= maxLines) return lines;
        }
    }
    return wrapText(text, w, size, maxLines, true);
}

/**
 * The largest headline size (down to 78% of the base) that keeps the whole headline, broken
 * cleanly after its colon, within the usual lines; then any size that keeps it whole; then cut.
 */
function fitHeadline(
    headline: string,
    w: number,
    spec: Spec,
): { size: number; lines: string[] } {
    const min = Math.round(spec.headline * (spec.headlineMin ?? 0.78));
    const whole = (lines: string[]) => lines.join(' ') === headline.trim();
    const clean = (lines: string[]) =>
        lines.length === 1 ||
        !headline.includes(': ') ||
        lines[0].endsWith(':');
    for (const [maxLines, ok] of [
        [spec.headlineLines, clean],
        [spec.headlineLines, () => true],
        [spec.headlineMax, clean],
        [spec.headlineMax, () => true],
    ] as const)
        for (let size = spec.headline; size >= min; size -= 2) {
            const lines = breakHeadline(headline, w, size, maxLines);
            if (whole(lines) && ok(lines)) return { size, lines };
        }
    return {
        size: min,
        lines: breakHeadline(headline, w, min, spec.headlineMax),
    };
}

/**
 * The headline's last two lines broken where they are most even, when the last is a lone word
 * ("Where UDA holds the most MP" / "seats"): the same words, size and number of lines.
 */
export function balanced(lines: TextItem[], w: number): TextItem[] {
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

/** Headline (shrinking a little before it wraps badly or cuts) and the scope line under it. */
export function titleBlock(
    x: number,
    top: number,
    w: number,
    spec: Spec,
    headline: string,
    scope: string,
) {
    const { size, lines } = fitHeadline(headline, w / HEADLINE_STRETCH, spec);
    const lead = size * 1.08;
    const items: TextItem[] = lines.map((text, i) => ({
        x,
        y: Math.round(top + size * 0.9 + i * lead),
        text,
        size,
        weight: 700,
        tone: 'ink',
    }));
    const headBottom =
        top + size * 0.9 + (lines.length - 1) * lead + size * 0.26;
    const scopeSize = fitFontSize(
        scope,
        w,
        spec.scope,
        Math.round(spec.scope * 0.8),
    );
    const scopeY = Math.round(headBottom + scopeSize * 1.45);
    return {
        headline: box(x, top, w, Math.ceil(headBottom - top)),
        headlineLines: items,
        scopeLine: {
            x,
            y: scopeY,
            text: wrapText(scope, w, scopeSize, 1)[0] ?? '',
            size: scopeSize,
            tone: 'muted' as const,
        },
        bottom: scopeY + Math.round(scopeSize * 0.35),
    };
}

/**
 * The title in a narrower column with the headline at the size it had (`least`): on its usual
 * lines if it fits them, else on up to `headlineMax` lines. Null when the headline would have to
 * shrink or be cut, so the caller keeps the wider column.
 */
function titleAtLeast(
    x: number,
    top: number,
    w: number,
    spec: Spec,
    headline: string,
    scope: string,
    least: number,
): ReturnType<typeof titleBlock> | null {
    // Whole, at the size asked for, and broken cleanly: no "party count" pair split over lines.
    const colon = headline.indexOf(': ');
    const pairs = colon > 0 ? headline.slice(colon + 2).split(', ') : [];
    const whole = (t: ReturnType<typeof titleBlock>) =>
        t.headlineLines[0].size >= least &&
        t.headlineLines.map((l) => l.text).join(' ') === headline.trim() &&
        pairs.every((p) => t.headlineLines.some((l) => l.text.includes(p)));
    const at = (lines: number) =>
        titleBlock(
            x,
            top,
            w,
            { ...spec, headline: least, headlineLines: lines, headlineMin: 1 },
            headline,
            scope,
        );
    const usual = at(spec.headlineLines);
    if (whole(usual)) return usual;
    const more = at(spec.headlineMax);
    return whole(more) ? more : null;
}

/**
 * Height the footer needs at this width (footerBlock lays it out from the top of its box), with
 * the credit the card prints: every map credit by default, less on a card that uses less.
 */
export function footerHeight(
    w: number,
    fonts: FooterFonts,
    view: Pick<ViewState, 'source' | 'asOf'>,
    url: string,
    attribution: string = ATTRIBUTION,
): number {
    const { bottom } = footerBlock(box(0, 0, w, 0), fonts, {
        source: view.source,
        asOf: view.asOf,
        attribution,
        url,
    });
    return Math.ceil(bottom);
}

/**
 * The bar chart, one scale from zero. Where the column is wide enough, each row is "label, bar,
 * count (share)" on one line from a shared zero line. In a narrow column with room to spare the
 * label and count sit on a line of their own above a bar that can use the full width, so the
 * bars stay long enough to compare.
 */
function chart(
    area: Box,
    view: ViewState,
    spec: Spec,
    withTitle: boolean,
): { title: TextItem | null; rows: RowItem[]; axis: Box; height: number } {
    const n = Math.max(1, view.rows.length);
    const titleSize = Math.round(spec.row.label * 0.86);
    const titleH = withTitle ? Math.round(titleSize * 1.9) : 0;
    // Rows open up to fill the room (to a limit), and shrink to fit before anything runs short.
    const rowH = Math.min(spec.row.max, Math.floor((area.h - titleH) / n));
    const scale = Math.min(1, rowH / spec.row.h);
    const values = view.rows.map((r) => `${fmt(r.count)} (${r.share})`);
    const widest = (texts: string[], size: number) =>
        Math.ceil(Math.max(0, ...texts.map((t) => textWidth(t, size, true))));
    const labels = view.rows.map((r) => r.label);
    const largest = Math.max(1, ...view.rows.map((r) => r.count));
    const someOn = view.rows.some((r) => r.highlighted);
    const top = area.y + titleH;
    const tone = (on: boolean): TextItem['tone'] =>
        someOn && !on ? 'muted' : 'ink';

    let size = Math.max(18, Math.round(spec.row.label * Math.max(0.82, scale)));
    // One label size for the whole chart, "Other parties" included: the label column is as
    // wide as the widest label, and where that leaves the bars too short every label shrinks
    // together (to a floor) before the rows go onto two lines (stacked).
    const inlineBarAt = (at: number) =>
        area.w -
        widest(labels, at) -
        widest(values, at) -
        Math.round(at * 1.15);
    const stacked =
        inlineBarAt(size) < area.w * 0.42 && rowH >= spec.row.label * 1.3 + 18;
    if (!stacked) while (size > 18 && inlineBarAt(size) < area.w * 0.3) size--;
    const labelCol = widest(labels, size);

    let rows: RowItem[];
    let axis: Box;
    if (stacked) {
        size = spec.row.label;
        const barH = Math.max(
            8,
            Math.min(
                Math.round(spec.row.bar * 0.75),
                Math.round(rowH - size * 1.3 - 10),
            ),
        );
        // Each label shares its line with the right-aligned count; if one is too long, every
        // label shrinks with it, so the chart keeps one label size.
        const rooms = view.rows.map(
            (_, i) =>
                area.w - textWidth(values[i], size, true) - Math.round(size),
        );
        const labelSize = Math.min(
            ...view.rows.map((r, i) =>
                fitFontSize(
                    r.label,
                    rooms[i],
                    size,
                    Math.round(size * 0.75),
                    true,
                ),
            ),
        );
        rows = view.rows.map((r, i): RowItem => {
            const rowTop = top + i * rowH;
            const baseline = Math.round(rowTop + size * 0.95);
            const on = r.highlighted;
            const room = rooms[i];
            return {
                key: r.key,
                highlighted: on,
                colour: r.colour,
                kind: r.kind,
                label: {
                    x: area.x,
                    y: baseline,
                    text: wrapText(r.label, room, labelSize, 1, true)[0] ?? '',
                    size: labelSize,
                    weight: on ? 700 : 400,
                    tone: tone(on),
                },
                bar: box(
                    area.x,
                    Math.round(baseline + size * 0.32),
                    Math.max(3, Math.round((r.count / largest) * area.w)),
                    barH,
                ),
                value: {
                    x: area.x + area.w,
                    y: baseline,
                    text: values[i],
                    size,
                    weight: on ? 700 : 400,
                    anchor: 'end',
                    tone: tone(on),
                },
            };
        });
        axis = box(area.x, top, 0, 0);
    } else {
        const barH = Math.max(10, Math.round(spec.row.bar * scale));
        const gapL = Math.round(size * 0.7);
        const gapV = Math.round(size * 0.45);
        const barX = area.x + labelCol + gapL;
        const maxBar = Math.max(
            40,
            area.x + area.w - widest(values, size) - gapV - barX,
        );
        rows = view.rows.map((r, i): RowItem => {
            const mid = top + i * rowH + rowH / 2;
            const baseline = Math.round(mid + size * 0.36);
            const barW = Math.max(3, Math.round((r.count / largest) * maxBar));
            const on = r.highlighted;
            return {
                key: r.key,
                highlighted: on,
                colour: r.colour,
                kind: r.kind,
                label: {
                    x: area.x,
                    y: baseline,
                    text: r.label,
                    size,
                    weight: on ? 700 : 400,
                    tone: tone(on),
                },
                bar: box(barX, Math.round(mid - barH / 2), barW, barH),
                value: {
                    x: barX + barW + gapV,
                    y: baseline,
                    text: values[i],
                    size,
                    weight: on ? 700 : 400,
                    tone: tone(on),
                },
            };
        });
        axis = box(
            barX - 1,
            top + Math.round(rowH * 0.12),
            2,
            n * rowH - Math.round(rowH * 0.24),
        );
    }
    return {
        title: withTitle
            ? {
                  x: area.x,
                  y: Math.round(area.y + titleSize * 0.95),
                  text: wrapText(view.title, area.w, titleSize, 1)[0] ?? '',
                  size: titleSize,
                  tone: 'muted',
              }
            : null,
        rows,
        axis,
        height: titleH + n * rowH,
    };
}

/** The big numbers: a ballot-lid bar in the party's colour, its label, count and share. */
function callouts(
    area: Box,
    view: ViewState,
    spec: Spec,
    flow: 'row' | 'column',
): CalloutItem[] {
    const items = calloutsFor(view);
    const gap = spec.gap;
    const n = Math.max(1, items.length);
    const cw = flow === 'row' ? (area.w - gap * (n - 1)) / n : area.w;
    const ch = flow === 'row' ? area.h : (area.h - gap * (n - 1)) / n;
    const f = spec.callout;
    const lidW = Math.max(8, Math.round(f.label * 0.34));
    return items.map((c, i) => {
        const x = Math.round(flow === 'row' ? area.x + i * (cw + gap) : area.x);
        const y = Math.round(flow === 'row' ? area.y : area.y + i * (ch + gap));
        const textX = x + lidW + Math.round(f.label * 0.7);
        const textW = x + cw - textX;
        const number = fmt(c.count);
        const numberSize = fitFontSize(
            number,
            textW,
            f.number,
            Math.round(f.number * 0.6),
            true,
        );
        const sub = `${c.share} of ${fmt(view.total)} ${view.total === 1 ? 'seat' : 'seats'}`;
        const subSize = fitFontSize(sub, textW, f.sub, Math.round(f.sub * 0.8));
        const labelY = y + Math.round(f.label * 0.95);
        const numberY = labelY + Math.round(numberSize * 0.98);
        // Figures have no descenders: the sub line sits just under the number's baseline.
        const subY = numberY + Math.round(subSize * 0.8 + numberSize * 0.24);
        return {
            key: c.label,
            lid: {
                x,
                y,
                w: lidW,
                h: Math.round(subY + subSize * 0.35 - y),
                colour: c.colour,
            },
            label: {
                x: textX,
                y: labelY,
                text: wrapText(c.label, textW, f.label, 1, true)[0] ?? '',
                size: f.label,
                weight: 700,
                tone: 'ink',
            },
            number: {
                x: textX,
                y: numberY,
                text: number,
                size: numberSize,
                weight: 700,
                tone: 'ink',
            },
            sub: {
                x: textX,
                y: subY,
                text: wrapText(sub, textW, subSize, 1)[0] ?? '',
                size: subSize,
                tone: 'muted',
            },
        };
    });
}

/**
 * The frame every card of this family shares: where the content starts under the ballot strip,
 * the footer at its full height, the gap between blocks, and the width that stays clear of the
 * story apps' buttons. The leaders card is laid out inside it.
 */
export function cardFrame(
    size: ViewSize,
    view: Pick<ViewState, 'source' | 'asOf'>,
    url: string,
    /** The credit the card's footer prints (CardFooter's `attribution`). */
    attribution: string = ATTRIBUTION,
) {
    const { w, h } = VIEW_SIZES[size];
    const spec = SPECS[size];
    const { pad, gap } = spec;
    const innerW =
        size === 'x' ? w - 2 * pad : w - pad - Math.max(pad, spec.insetRight ?? 0);
    const top = Math.round(
        Math.max(spec.stripH * 2 + pad * TIGHT.top, spec.safeTop),
    );
    const fh = footerHeight(innerW, spec.footer, view, url, attribution);
    const footerBox = box(
        pad,
        Math.round(h - Math.max(spec.safeBottom, pad * TIGHT.foot) - fh),
        innerW,
        fh,
    );
    return { w, h, spec, innerW, top, footerBox, tight: Math.round(gap * TIGHT.gap) };
}

/** Area of a shape with this aspect (w/h) drawn as large as fits in the box. */
export const fittedArea = (b: Box, aspect: number) => {
    if (b.w <= 0 || b.h <= 0) return 0;
    const w = Math.min(b.w, b.h * aspect);
    return w * (w / aspect);
};

export interface ViewText {
    headline: string;
    /** The deep link, as the footer prints it. */
    url: string;
    /** Width over height of the area the map shows (Kenya is about 0.82). */
    mapAspect: number;
}

interface Body {
    map: Box;
    calloutBox: Box;
    calloutFlow: 'row' | 'column';
    calloutGap: number;
    chartBox: Box;
    chartTitle: boolean;
}

const titleHeight = (spec: Spec) => Math.round(spec.row.label * 0.86 * 1.9);

/** The map with the callouts above the chart in a column beside it (null when the chart cannot fit). */
function side(b: Box, spec: Spec, rows: number): Body | null {
    const { gap } = spec;
    const chartH = titleHeight(spec) + rows * spec.row.h;
    const map = box(b.x, b.y, b.w - spec.colW - gap, b.h);
    const x = map.x + map.w + gap;
    // A long chart (a dozen parties) may tighten its rows to about three quarters; if it
    // still does not fit under the callouts, the column is the chart alone (the mix bar
    // above already gives the largest shares).
    const fits = (room: number) => room >= rows * spec.row.h * 0.72;
    const withCallouts = fits(b.h - spec.callout.h - gap);
    if (!withCallouts && !fits(b.h)) return null;
    if (!withCallouts)
        return {
            map,
            calloutBox: box(map.x + map.w + gap, b.y, spec.colW, 0),
            calloutFlow: 'row',
            calloutGap: gap,
            chartBox: box(map.x + map.w + gap, b.y, spec.colW, b.h),
            chartTitle: b.h >= chartH,
        };
    const room = b.h - spec.callout.h - gap;
    const title = room >= chartH;
    // The column is centred on the map when it needs less than the full height.
    const chartUsed = Math.min(
        room,
        (title ? titleHeight(spec) : 0) + rows * spec.row.max,
    );
    const y = Math.round(b.y + (room - chartUsed) / 2);
    const calloutBox = box(x, y, spec.colW, spec.callout.h);
    const chartY = calloutBox.y + calloutBox.h + gap;
    return {
        map,
        calloutBox,
        calloutFlow: 'row',
        calloutGap: gap,
        chartBox: box(x, chartY, spec.colW, chartUsed),
        chartTitle: title,
    };
}

/** Place map, callouts and chart in the body for one arrangement (null when it cannot fit). */
function arrange(
    kind: Arrangement,
    b: Box,
    spec: Spec,
    rows: number,
    callouts: number,
    /** Width over height of what the map shows. */
    aspect: number,
): Body | null {
    const { gap } = spec;
    // Under the map the chart's rows sit a little closer than they would like (CHART_TIGHT),
    // which is where a stacked card finds the map's extra room.
    const chartH =
        titleHeight(spec) +
        Math.round(rows * spec.row.h * (kind === 'side' ? 1 : CHART_TIGHT));
    // Under the map, a long chart (a dozen parties) takes at most about half the body and its
    // rows tighten, so the map keeps its room.
    const stackedChartH = Math.min(chartH, Math.round(b.h * 0.45));
    const colGap = Math.round(gap * 0.5);
    const calloutsColH = callouts * spec.callout.h + (callouts - 1) * colGap;
    switch (kind) {
        case 'side': {
            // A shape that is drawn as wide as its box (Kenya on a portrait card) grows by
            // taking some of the chart column's width.
            const widthBound = (b.w - spec.colW - gap) / aspect < b.h;
            return side(
                b,
                widthBound
                    ? {
                          ...spec,
                          colW: Math.round(spec.colW * SIDE_TIGHT),
                          gap: Math.round(gap * TIGHT.gap),
                      }
                    : spec,
                rows,
            );
        }
        case 'stack': {
            const lowerH = Math.max(chartH, calloutsColH);
            const map = box(b.x, b.y, b.w, b.h - lowerH - gap);
            const lowerY = map.y + map.h + gap;
            const calloutBox = box(b.x, lowerY, spec.calloutColW, calloutsColH);
            const chartX = b.x + spec.calloutColW + gap;
            return {
                map,
                calloutBox,
                calloutFlow: 'column',
                calloutGap: colGap,
                chartBox: box(chartX, lowerY, b.x + b.w - chartX, lowerH),
                chartTitle: true,
            };
        }
        case 'mapCallouts': {
            const chartBox = box(
                b.x,
                b.y + b.h - stackedChartH,
                b.w,
                stackedChartH,
            );
            const topH = chartBox.y - gap - b.y;
            const map = box(b.x, b.y, b.w - spec.calloutColW - gap, topH);
            // The callouts sit level with the middle of the map.
            const calloutBox = box(
                map.x + map.w + gap,
                Math.round(b.y + Math.max(0, (topH - calloutsColH) / 2)),
                spec.calloutColW,
                Math.min(topH, calloutsColH),
            );
            return {
                map,
                calloutBox,
                calloutFlow: 'column',
                calloutGap: colGap,
                chartBox,
                chartTitle: true,
            };
        }
        case 'tall': {
            const chartBox = box(
                b.x,
                b.y + b.h - stackedChartH,
                b.w,
                stackedChartH,
            );
            const calloutBox = box(
                b.x,
                chartBox.y - gap - spec.callout.h,
                b.w,
                spec.callout.h,
            );
            return {
                map: box(b.x, b.y, b.w, calloutBox.y - gap - b.y),
                calloutBox,
                calloutFlow: 'row',
                calloutGap: gap,
                chartBox,
                chartTitle: true,
            };
        }
    }
}

export function viewLayout(
    size: ViewSize,
    view: ViewState,
    text: ViewText,
): ViewLayout {
    const { w, h } = VIEW_SIZES[size];
    const spec = SPECS[size];
    const { pad, gap } = spec;
    const scope = scopeLineFor(view);
    const nCallouts = Math.max(1, calloutsFor(view).length);
    const nRows = Math.max(1, view.rows.length);
    const withRows = view.mix.rows.length > 0;
    // How much bigger the map is than on the first cards (owner, 2026-11-27): a quarter on an
    // MCA card for a county or a constituency, about 15% elsewhere. The room comes from the
    // padding and the gaps first (TIGHT), then from the rows, which shorten to "and N more".
    const grow =
        view.seat === 'mca' && view.focus && view.focus.level !== 'ward'
            ? MCA_MAP_GROWTH
            : MAP_GROWTH;
    // Above the chart, the bar has exactly the chart's rows, so the two never disagree.
    const chartParts: MixPartInput[] = view.rows.map((r) => ({
        key: r.key,
        colour: r.colour,
        count: r.count,
        share: r.share,
        members: r.members,
    }));
    const callout = spec.callout;
    const holderFonts = {
        label: callout.label,
        name: Math.round(callout.number * 0.5),
        sub: callout.sub,
    };
    /** One seat: the map and who holds it, instead of the bar, callouts and chart. */
    const single = (
        t: ReturnType<typeof titleBlock>,
        map: Box,
        block: HolderBlockLayout,
        footerBox: Box,
    ): ViewLayout => ({
        ...base(t, footerBox),
        map,
        calloutBox: none,
        callouts: [],
        chartBox: none,
        chartTitle: null,
        axis: box(0, 0, 0, 0),
        rows: [],
        mixBar: null,
        mixLegend: null,
        mixRows: [],
        rowsBox: null,
        rowsMore: 0,
        moreLine: null,
        holder: block,
        leaders: null,
    });
    const none = box(pad, h - 1, 0, 0);
    const base = (t: ReturnType<typeof titleBlock>, footerBox: Box) => ({
        w,
        h,
        strip: strip(w, spec.stripH, view.seat),
        headline: t.headline,
        headlineLines: t.headlineLines,
        scopeLine: t.scopeLine,
        footerBox,
        footerFonts: spec.footer,
    });
    const finish = (
        t: ReturnType<typeof titleBlock>,
        body: Body,
        footerBox: Box,
        bar: MixBarLayout,
    ): ViewLayout => {
        const c = chart(body.chartBox, view, spec, body.chartTitle);
        return {
            ...base(t, footerBox),
            map: body.map,
            calloutBox: body.calloutBox,
            callouts: body.calloutBox.h
                ? callouts(
                      body.calloutBox,
                      view,
                      { ...spec, gap: body.calloutGap },
                      body.calloutFlow,
                  )
                : [],
            chartBox: body.chartBox,
            chartTitle: c.title,
            axis: c.axis,
            rows: c.rows,
            mixBar: bar,
            mixLegend: null,
            mixRows: [],
            rowsBox: null,
            rowsMore: 0,
            moreLine: null,
            holder: null,
            leaders: null,
        };
    };
    /** The card's link as "+N more at <link>" prints it: no scheme, no query. */
    const link = text.url
        .replace(/^https?:\/\//, '')
        .replace(/[?#].*$/, '')
        .replace(/\/$/, '');
    /** Room the rows always keep: `minRows` of them (or all, if fewer) and the "more" line. */
    const minRowsH =
        Math.min(spec.minRows, view.mix.rows.length) * spec.mix.rowMin +
        (view.mix.rows.length > spec.minRows
            ? Math.round(spec.mix.row * 1.6)
            : 0) +
        // A few pixels of slack: the blocks above are placed on whole pixels.
        8;
    /** The leaders strip across `width` from `y`, in at most `maxH`; null on cards without one. */
    const stripAt = (x: number, y: number, width: number, maxH: number) =>
        leadersStrip({
            x,
            y,
            w: width,
            maxH,
            rows: view.leaders,
            font: spec.leaders.font,
            link,
            columns: spec.leaders.columns,
            lead: spec.leaders.lead,
            note: view.mpLine,
        });
    const stripGap = Math.round(gap * 0.75);
    /** Strip (if any), bar, legend and rows from `y` down to `bottom`, across `x`..`x + width`. */
    const withMixRows = (
        t: ReturnType<typeof titleBlock>,
        map: Box,
        x: number,
        width: number,
        y: number,
        bottom: number,
        footerBox: Box,
        /** The strip, when it is already placed elsewhere on the card (under the map on X). */
        placedStrip?: LeadersStripLayout | null,
    ): ViewLayout => {
        // What the bar, its legend and the fewest rows need: the strip takes the rest at most.
        const probe = mixBar(box(x, 0, width, spec.mix.bar), view);
        const fixed =
            spec.mix.bar +
            gap * 0.55 +
            mixLegend(x, 0, width, view, probe, spec.mix.legend).box.h +
            gap * 0.9 +
            minRowsH;
        const inColumn = placedStrip
            ? null
            : stripAt(x, y, width, bottom - y - stripGap - fixed + 2);
        const leaders = placedStrip ?? inColumn;
        const barY = inColumn ? inColumn.box.y + inColumn.box.h + stripGap : y;
        const bar = mixBar(box(x, barY, width, spec.mix.bar), view);
        const legend = mixLegend(
            x,
            Math.round(barY + spec.mix.bar + gap * 0.55),
            width,
            view,
            bar,
            spec.mix.legend,
        );
        const rowsTop = Math.round(legend.box.y + legend.box.h + gap * 0.9);
        const r = mixRows(
            box(x, rowsTop, width, bottom - rowsTop),
            view,
            spec.mix,
        );
        return {
            ...base(t, footerBox),
            map,
            calloutBox: none,
            callouts: [],
            chartBox: none,
            chartTitle: null,
            axis: box(0, 0, 0, 0),
            rows: [],
            mixBar: bar,
            mixLegend: legend,
            mixRows: r.rows,
            rowsBox: r.box,
            rowsMore: r.more,
            moreLine: r.moreLine,
            holder: null,
            leaders,
        };
    };

    if (size === 'x') {
        // Map on the left at full height; headline, the mix and the chart or rows on the right;
        // the footer runs under both.
        const top = Math.round(spec.stripH * 2 + pad * TIGHT.top);
        const fh = footerHeight(w - 2 * pad, spec.footer, view, text.url);
        const footerBox = box(
            pad,
            Math.round(h - pad * TIGHT.foot - fh),
            w - 2 * pad,
            fh,
        );
        const bodyBottom = Math.round(footerBox.y - gap * TIGHT.gap);
        // The map already runs the full height here, so a wide unit grows by widening the map's
        // column (a tall one, like Kenya, has no use for more width). The column of words beside
        // it narrows, but never so far that the headline has to shrink: the growth steps down
        // until the headline keeps the size it has beside the map at its first width.
        const wanted = Math.max(560, (bodyBottom - top) * text.mapAspect);
        const firstW = w - 2 * pad - spec.colW - gap * 1.5;
        const columnAt = (mapW: number) => {
            const colX = Math.round(pad + mapW + gap * 1.5);
            return { mapW, colX, colW: w - pad - colX };
        };
        const firstCol = columnAt(Math.round(Math.min(firstW, wanted)));
        const first = {
            ...firstCol,
            t: titleBlock(
                firstCol.colX,
                top,
                firstCol.colW,
                spec,
                text.headline,
                scope,
            ),
        };
        let placed = first;
        for (const g of [grow, (grow + 1) / 2]) {
            const c = columnAt(Math.round(Math.min(firstW * g, wanted)));
            const t = titleAtLeast(
                c.colX,
                top,
                c.colW,
                spec,
                text.headline,
                scope,
                first.t.headlineLines[0].size,
            );
            if (t) {
                placed = { ...c, t };
                break;
            }
        }
        const { mapW, colX, colW, t } = placed;
        let map = box(pad, top, mapW, bodyBottom - top);
        const barY = Math.round(t.bottom + gap * 0.7);
        // The leaders strip goes under the map when the shape leaves the room for it there (a
        // wide unit in a tall column); otherwise it leads the column of words.
        let under: LeadersStripLayout | null = null;
        if (withRows) {
            const probe = stripAt(pad, 0, mapW, Infinity);
            const need = probe ? probe.box.h + stripGap : 0;
            // "Leaves the room": the shape is drawn no more than 6% smaller for it.
            if (probe && map.h - need >= (mapW / text.mapAspect) * 0.94) {
                map = box(pad, top, mapW, map.h - need);
                under = stripAt(pad, map.y + map.h + stripGap, mapW, Infinity);
            }
        }
        if (view.single)
            return single(
                t,
                map,
                holderBlock(colX, barY, colW, view, holderFonts)!,
                footerBox,
            );
        if (withRows)
            return withMixRows(
                t,
                map,
                colX,
                colW,
                barY,
                bodyBottom,
                footerBox,
                under,
            );
        const bar = mixBar(
            box(colX, barY, colW, spec.mix.bar),
            view,
            chartParts,
        );
        const lowerY = Math.round(barY + spec.mix.bar + gap * 0.8);
        const chartBox = box(
            colX,
            lowerY,
            colW - spec.calloutColW - gap,
            bodyBottom - lowerY,
        );
        const colGap = Math.round(gap * 0.5);
        return finish(
            t,
            {
                map,
                calloutBox: box(
                    chartBox.x + chartBox.w + gap,
                    lowerY,
                    spec.calloutColW,
                    Math.min(
                        chartBox.h,
                        nCallouts * spec.callout.h + (nCallouts - 1) * colGap,
                    ),
                ),
                calloutFlow: 'column',
                calloutGap: colGap,
                chartBox,
                chartTitle:
                    chartBox.h >= titleHeight(spec) + nRows * spec.row.h,
            },
            footerBox,
            bar,
        );
    }

    const innerW = w - pad - Math.max(pad, spec.insetRight ?? 0);
    const top = Math.round(
        Math.max(spec.stripH * 2 + pad * TIGHT.top, spec.safeTop),
    );
    const fh = footerHeight(innerW, spec.footer, view, text.url);
    const footerBox = box(
        pad,
        Math.round(h - Math.max(spec.safeBottom, pad * TIGHT.foot) - fh),
        innerW,
        fh,
    );
    /** The gap between blocks: the spec's, tightened to give the map its extra room. */
    const tight = Math.round(gap * TIGHT.gap);

    if (view.single) {
        // The map, and beside it (a tall shape on a wide card) or under it, who holds the seat.
        const t = titleBlock(pad, top, innerW, spec, text.headline, scope);
        const bodyTop = Math.round(t.bottom + tight);
        const bodyBottom = Math.round(footerBox.y - tight);
        const side = size !== 'story' && text.mapAspect < 1.15;
        if (side) {
            const colX = pad + innerW - spec.colW;
            const probe = holderBlock(colX, 0, spec.colW, view, holderFonts)!;
            const blockY = Math.round(
                bodyTop + Math.max(0, (bodyBottom - bodyTop - probe.box.h) / 2),
            );
            return single(
                t,
                box(
                    pad,
                    bodyTop,
                    innerW - spec.colW - gap,
                    bodyBottom - bodyTop,
                ),
                holderBlock(colX, blockY, spec.colW, view, holderFonts)!,
                footerBox,
            );
        }
        const probe = holderBlock(pad, 0, innerW, view, holderFonts)!;
        const blockY = Math.round(bodyBottom - probe.box.h);
        return single(
            t,
            box(pad, bodyTop, innerW, blockY - tight - bodyTop),
            holderBlock(pad, blockY, innerW, view, holderFonts)!,
            footerBox,
        );
    }

    if (withRows) {
        const bottom = Math.round(footerBox.y - tight);
        const full = titleBlock(pad, top, innerW, spec, text.headline, scope);
        const bar = mixBar(box(pad, 0, innerW, spec.mix.bar), view);
        const legendH = mixLegend(0, 0, innerW, view, bar, spec.mix.legend).box
            .h;
        const mapTop = Math.round(full.bottom + tight);
        // The strip at its full height (it shortens only for want of room).
        const stripH = stripAt(pad, 0, innerW, Infinity)?.box.h ?? 0;
        /** The bar and its legend, with their gaps. */
        const mixH = spec.mix.bar + gap * 0.55 + legendH + gap * 0.9;
        /** What must fit under the map: the strip, the mix and the fewest rows. */
        const roomUnder = (stripH ? stripH + stripGap : 0) + mixH + minRowsH;

        // The map across the width, above the strip, the mix and the rows. Its first height is
        // what the rows leave at their roomiest (else a little tighter); it then grows, but no
        // taller than the shape drawn across the full width, and never into `roomUnder`.
        let across: Box | null = null;
        for (const rowH of [
            spec.mix.rowMax,
            Math.round((spec.mix.rowMax + spec.mix.rowMin) / 2),
        ]) {
            const firstH =
                bottom - mapTop - tight - mixH - view.mix.rows.length * rowH;
            if (firstH < h * 0.12) continue;
            const mapH = Math.round(
                Math.min(
                    firstH * grow,
                    innerW / text.mapAspect,
                    bottom - mapTop - tight - roomUnder,
                ),
            );
            if (mapH >= h * 0.1) across = box(pad, mapTop, innerW, mapH);
            break;
        }

        // The map beside the headline; the strip, the mix and the rows fill the width under
        // both. Beside the map the headline is narrower: it may shrink further, so it is never
        // cut. A tall shape stops where `roomUnder` starts.
        const insetSpec = { ...spec, headlineMin: 0.6 };
        const inset = (share: number, least?: number) => {
            const mapW = Math.round(innerW * share);
            const t =
                least === undefined
                    ? titleBlock(
                          pad,
                          top,
                          innerW - mapW - gap,
                          insetSpec,
                          text.headline,
                          scope,
                      )
                    : titleAtLeast(
                          pad,
                          top,
                          innerW - mapW - gap,
                          insetSpec,
                          text.headline,
                          scope,
                          least,
                      );
            if (!t) return null;
            const insetH = Math.round(
                Math.min(
                    mapW * 1.25,
                    Math.max(mapW / text.mapAspect, t.bottom - top),
                    bottom - top - tight - roomUnder,
                ),
            );
            return { t, map: box(pad + innerW - mapW, top, mapW, insetH) };
        };
        const firstInset = inset(spec.insetMap)!;
        // The inset grows too, as far as the headline beside it keeps its size.
        const least = firstInset.t.headlineLines[0].size;
        const beside =
            inset(spec.insetMap * grow, least) ??
            inset((spec.insetMap * (grow + 1)) / 2, least) ??
            firstInset;

        // Whichever draws the map larger.
        if (
            across &&
            fittedArea(across, text.mapAspect) >
                fittedArea(beside.map, text.mapAspect)
        )
            return withMixRows(
                full,
                across,
                pad,
                innerW,
                Math.round(across.y + across.h + tight),
                bottom,
                footerBox,
            );
        const y = Math.round(
            Math.max(beside.t.bottom, beside.map.y + beside.map.h) + tight,
        );
        return withMixRows(beside.t, beside.map, pad, innerW, y, bottom, footerBox);
    }

    const t = titleBlock(pad, top, innerW, spec, text.headline, scope);
    const barY = Math.round(t.bottom + tight * 0.8);
    const bar = mixBar(box(pad, barY, innerW, spec.mix.bar), view, chartParts);
    const bodyTop = Math.round(barY + spec.mix.bar + tight);
    const body = box(
        pad,
        bodyTop,
        innerW,
        Math.round(footerBox.y - tight) - bodyTop,
    );
    // The arrangement that draws the map's shape the largest.
    let best: Body | null = null;
    let bestArea = -1;
    for (const kind of spec.arrangements) {
        const placed = arrange(
            kind,
            body,
            spec,
            nRows,
            nCallouts,
            text.mapAspect,
        );
        // An arrangement that leaves the map less than a third of the body is no arrangement.
        const usable =
            placed && placed.map.h >= body.h / 3 && placed.map.w >= body.w / 3;
        const area = usable ? fittedArea(placed.map, text.mapAspect) : -1;
        if (usable && area > bestArea) {
            best = placed;
            bestArea = area;
        }
    }
    return finish(
        t,
        best ??
            arrange(
                spec.arrangements[spec.arrangements.length - 1],
                body,
                spec,
                nRows,
                nCallouts,
                text.mapAspect,
            )!,
        footerBox,
        bar,
    );
}
