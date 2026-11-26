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
import { VIEW_SIZES, type ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
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
    /** A long label ("Other parties") continues on a second, smaller line. */
    label2: TextItem | null;
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
    footerBox: Box;
    footerFonts: FooterFonts;
}

interface Spec {
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
}

/**
 * - side: the map, and beside it the callouts above the chart.
 * - stack: the map, and under it the callouts beside the chart.
 * - mapCallouts: the map with the callouts beside it, and the chart under both.
 * - tall: the map, the callouts, then the chart, each across the full width.
 */
type Arrangement = 'side' | 'stack' | 'mapCallouts' | 'tall';

const SPECS: Record<ViewSize, Spec> = {
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
    },
};

const box = (x: number, y: number, w: number, h: number): Box => ({
    x,
    y,
    w,
    h,
});

const fmt = (n: number) => n.toLocaleString('en-GB');

/** The six ballot colours across the top, the shared seat's lid drawn deeper. */
function strip(w: number, h: number, seat: ViewState['seat']): StripSegment[] {
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
        if (fits(head) && chunks.every(fits)) {
            const lines = [head];
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
    const min = Math.round(spec.headline * 0.78);
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

/** Headline (shrinking a little before it wraps badly or cuts) and the scope line under it. */
function titleBlock(
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

/** Height the footer needs at this width (footerBlock lays it out from the top of its box). */
function footerHeight(
    w: number,
    fonts: FooterFonts,
    view: ViewState,
    url: string,
): number {
    const { bottom } = footerBlock(box(0, 0, w, 0), fonts, {
        source: view.source,
        asOf: view.asOf,
        attribution: ATTRIBUTION,
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
    // The label column is as wide as the one-word labels; a longer label of several words
    // ("Other parties") wraps onto two smaller lines instead of widening it.
    const small = Math.round(size * 0.82);
    const single = labels.filter((l) => !l.includes(' '));
    let labelCol = widest(single.length ? single : labels, size);
    const wrapped = labels.map((l) => {
        if (!l.includes(' ') || textWidth(l, size, true) <= labelCol)
            return null;
        const longestWord = widest(l.split(' '), small);
        const lines = wrapText(
            l,
            Math.max(labelCol, longestWord),
            small,
            2,
            true,
        );
        labelCol = Math.max(labelCol, widest(lines, small));
        return lines;
    });
    const inlineBar =
        area.w - labelCol - widest(values, size) - Math.round(size * 1.15);
    const stacked =
        inlineBar < area.w * 0.42 && rowH >= spec.row.label * 1.3 + 18;

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
        rows = view.rows.map((r, i): RowItem => {
            const rowTop = top + i * rowH;
            const baseline = Math.round(rowTop + size * 0.95);
            const on = r.highlighted;
            // The label shares its line with the right-aligned count; a long one shrinks a little.
            const room =
                area.w - textWidth(values[i], size, true) - Math.round(size);
            const labelSize = fitFontSize(
                r.label,
                room,
                size,
                Math.round(size * 0.75),
                true,
            );
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
                label2: null,
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
            const lines = wrapped[i];
            // Two lines sit either side of the bar's middle; one shorter line on it.
            const first =
                lines && lines.length > 1
                    ? Math.round(mid - small * 0.12)
                    : Math.round(mid + small * 0.36);
            return {
                key: r.key,
                highlighted: on,
                colour: r.colour,
                kind: r.kind,
                label: {
                    x: area.x,
                    y: lines ? first : baseline,
                    text: lines ? lines[0] : r.label,
                    size: lines ? small : size,
                    weight: on ? 700 : 400,
                    tone: tone(on),
                },
                label2:
                    lines && lines[1]
                        ? {
                              x: area.x,
                              y: first + Math.round(small * 1.08),
                              text: lines[1],
                              size: small,
                              weight: on ? 700 : 400,
                              tone: tone(on),
                          }
                        : null,
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
        const subY = numberY + Math.round(subSize * 1.5);
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
                text:
                    wrapText(
                        c.label === 'other parties' ? 'Other parties' : c.label,
                        textW,
                        f.label,
                        1,
                        true,
                    )[0] ?? '',
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

/** Area of a shape with this aspect (w/h) drawn as large as fits in the box. */
const fittedArea = (b: Box, aspect: number) => {
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

/** Place map, callouts and chart in the body for one arrangement (null when it cannot fit). */
function arrange(
    kind: Arrangement,
    b: Box,
    spec: Spec,
    rows: number,
    callouts: number,
): Body | null {
    const { gap } = spec;
    const chartH = titleHeight(spec) + rows * spec.row.h;
    const colGap = Math.round(gap * 0.5);
    const calloutsColH = callouts * spec.callout.h + (callouts - 1) * colGap;
    switch (kind) {
        case 'side': {
            const map = box(b.x, b.y, b.w - spec.colW - gap, b.h);
            const x = map.x + map.w + gap;
            const room = b.h - spec.callout.h - gap;
            if (room < rows * spec.row.h * 0.85) return null;
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
            const chartBox = box(b.x, b.y + b.h - chartH, b.w, chartH);
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
            const chartBox = box(b.x, b.y + b.h - chartH, b.w, chartH);
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
    const finish = (
        t: ReturnType<typeof titleBlock>,
        body: Body,
        footerBox: Box,
    ): ViewLayout => {
        const c = chart(body.chartBox, view, spec, body.chartTitle);
        return {
            w,
            h,
            strip: strip(w, spec.stripH, view.seat),
            headline: t.headline,
            headlineLines: t.headlineLines,
            scopeLine: t.scopeLine,
            map: body.map,
            calloutBox: body.calloutBox,
            callouts: callouts(
                body.calloutBox,
                view,
                { ...spec, gap: body.calloutGap },
                body.calloutFlow,
            ),
            chartBox: body.chartBox,
            chartTitle: c.title,
            axis: c.axis,
            rows: c.rows,
            footerBox,
            footerFonts: spec.footer,
        };
    };

    if (size === 'x') {
        // Map on the left at full height; headline, chart and callouts on the right; the
        // footer runs under both.
        const top = Math.round(spec.stripH * 2 + pad * 0.75);
        const fh = footerHeight(w - 2 * pad, spec.footer, view, text.url);
        const footerBox = box(pad, h - pad * 0.7 - fh, w - 2 * pad, fh);
        const bodyBottom = Math.round(footerBox.y - gap * 0.75);
        const mapW = Math.round(
            Math.min(
                w - 2 * pad - spec.colW - gap * 1.5,
                Math.max(560, (bodyBottom - top) * text.mapAspect),
            ),
        );
        const map = box(pad, top, mapW, bodyBottom - top);
        const colX = Math.round(pad + mapW + gap * 1.5);
        const colW = w - pad - colX;
        const t = titleBlock(colX, top, colW, spec, text.headline, scope);
        const lowerY = Math.round(t.bottom + gap);
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
        );
    }

    const innerW = w - pad - Math.max(pad, spec.insetRight ?? 0);
    const t = titleBlock(
        pad,
        Math.round(Math.max(spec.stripH * 2 + pad * 0.8, spec.safeTop)),
        innerW,
        spec,
        text.headline,
        scope,
    );
    const fh = footerHeight(innerW, spec.footer, view, text.url);
    const footerBox = box(
        pad,
        Math.round(h - Math.max(spec.safeBottom, pad * 0.8) - fh),
        innerW,
        fh,
    );
    const bodyTop = Math.round(t.bottom + gap);
    const body = box(
        pad,
        bodyTop,
        innerW,
        Math.round(footerBox.y - gap) - bodyTop,
    );
    // The arrangement that draws the map's shape the largest.
    let best: Body | null = null;
    let bestArea = -1;
    for (const kind of spec.arrangements) {
        const placed = arrange(kind, body, spec, nRows, nCallouts);
        const area = placed ? fittedArea(placed.map, text.mapAspect) : -1;
        if (placed && area > bestArea) {
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
            )!,
        footerBox,
    );
}
