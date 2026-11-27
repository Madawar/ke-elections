// Layout of the seat mix on a "Share this view" card: the 100% stacked bar under the headline,
// its legend, and the rows inside a focused unit (each constituency's mix of wards, or who holds
// each seat). Like viewLayout, it places every box and line so the card only draws them.
//
// Dataviz rules (tall segmented bar): parts in the legend's order with a gap in the card colour
// between them, the share printed inside a part only when it fits with room to spare (white or
// near-black by the part's lightness), the legend naming the parts in bar order and giving the
// share only where the bar could not. Row bars are thin and carry no text.
import { THEMES } from '@/lib/map/theme';
import type { Box, TextItem } from './layout';
import type { MixRow } from './seatMix';
import { formatAsOf } from './format';
import { fitFontSize, textWidth, wrapText } from './text';
import type { ViewState } from './viewState';

export interface MixBarSegment extends Box {
    key: string;
    colour: string;
    label: TextItem | null;
    /** The colour of the share printed inside. */
    ink: string;
}

export interface MixBarLayout {
    box: Box;
    gap: number;
    radius: number;
    segments: MixBarSegment[];
}

export interface MixLegendLayout {
    box: Box;
    items: { swatch: (Box & { colour: string }) | null; text: TextItem }[];
}

export type MixText = TextItem & {
    role: 'name' | 'count' | 'holder' | 'party' | 'empty';
};

export interface MixRowItem {
    code: number;
    kind: MixRow['kind'];
    texts: MixText[];
    chip: (Box & { colour: string }) | null;
    bar: (Box & { colour: string })[];
}

export interface MixFonts {
    /** Height of the mix bar. */
    bar: number;
    legend: number;
    row: number;
    rowMin: number;
    rowMax: number;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Near-black or white for text on a coloured part, whichever reads better (the dataviz rule):
 * near-black on mid tones such as ODM orange, where white is only about 3:1.
 */
export function inkOn(colour: string): string {
    const dark = THEMES.light.ink;
    const light = THEMES.light.surface;
    return contrast(colour, dark) >= contrast(colour, light) ? dark : light;
}

/** Relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Highlight state: parts outside the highlight take the map's faded colour, as on the map. */
export function mixColours(view: ViewState) {
    const theme = THEMES[view.theme];
    const chosen = new Set(view.only);
    const someOn = chosen.size > 0;
    const on = (members: string[]) =>
        members.length > 0 && members.every((m) => chosen.has(m));
    return {
        theme,
        segment: (s: { colour: string; members: string[] }) =>
            someOn && !on(s.members) ? theme.faded : s.colour,
        party: (key: string, colour: string) => {
            if (!someOn) return colour;
            if (key === 'other') {
                const other = view.mix.segments.find((s) => s.key === 'other');
                return other && on(other.members) ? colour : theme.faded;
            }
            return chosen.has(key) ? colour : theme.faded;
        },
    };
}

/** Lay `parts` across `w` in proportion to their counts, with `gap` between them. */
export function spread<T extends { count: number }>(
    parts: T[],
    x: number,
    w: number,
    gap: number,
): (T & { x: number; w: number })[] {
    const shown = parts.filter((p) => p.count > 0);
    const total = shown.reduce((n, p) => n + p.count, 0) || 1;
    const room = w - gap * Math.max(0, shown.length - 1);
    let at = 0;
    return shown.map((p, i) => {
        const left = Math.round(x + (room * at) / total + gap * i);
        at += p.count;
        const right = Math.round(x + (room * at) / total + gap * i);
        return { ...p, x: left, w: Math.max(1, right - left) };
    });
}

/** A part of the bar: a legend row of the chart, or a seat mix segment. */
export interface MixPartInput {
    key: string;
    colour: string;
    count: number;
    share: string;
    members: string[];
}

/**
 * The 100% bar. On cards with the bar chart its parts are the chart's own rows (small parties
 * as thin parts the chart names), so the two never disagree; on cards with rows they are the
 * seat mix segments, with small parties folded into "Other parties".
 */
export function mixBar(
    area: Box,
    view: ViewState,
    parts: MixPartInput[] = view.mix.segments,
): MixBarLayout {
    const { segment } = mixColours(view);
    const gap = Math.max(3, Math.round(area.h * 0.08));
    const size = Math.round(area.h * 0.46);
    const pad = Math.round(size * 0.45);
    return {
        box: area,
        gap,
        radius: Math.round(area.h * 0.14),
        segments: spread(parts, area.x, area.w, gap).map((s) => {
            const colour = segment(s);
            const fits = textWidth(s.share, size, true) + size <= s.w;
            const ink = inkOn(colour);
            return {
                key: s.key,
                x: s.x,
                y: area.y,
                w: s.w,
                h: area.h,
                colour,
                ink,
                label: fits
                    ? {
                          x: s.x + pad,
                          y: Math.round(area.y + area.h / 2 + size * 0.36),
                          text: s.share,
                          size,
                          weight: 700,
                          tone: 'ink' as const,
                      }
                    : null,
            };
        }),
    };
}

/**
 * The mix legend, wrapped across the width: each part's swatch, name and count, plus its share
 * where the bar could not print it, in bar order. Parties folded into "Other parties" for being
 * small follow it on a line of their own ("of which KANU 2"), each with its own colour, so every colour on the card
 * is named.
 */
export function mixLegend(
    x: number,
    y: number,
    w: number,
    view: ViewState,
    bar: MixBarLayout,
    size: number,
): MixLegendLayout {
    const { segment } = mixColours(view);
    const printed = new Set(
        bar.segments.filter((s) => s.label).map((s) => s.key),
    );
    const entries: {
        colour: string | null;
        text: string;
        newLine?: boolean;
    }[] = [];
    for (const s of view.mix.segments) {
        entries.push({
            colour: segment(s),
            text: `${s.label} ${fmt(s.count)}${printed.has(s.key) ? '' : ` (${s.share})`}`,
        });
        if (s.includes.length) {
            // The folded parties stay together on a line of their own under Other parties,
            // by count only (their shares are under the 3% the bar folds at).
            entries.push({ colour: null, text: 'of which', newLine: true });
            for (const p of s.includes)
                entries.push({
                    colour: segment({ colour: p.colour, members: [p.key] }),
                    text: `${p.label} ${fmt(p.count)}`,
                });
        }
    }
    const sw = Math.round(size * 0.72);
    const swGap = Math.round(size * 0.35);
    const itemGap = Math.round(size * 1.1);
    const line = Math.round(size * 1.5);
    const items: MixLegendLayout['items'] = [];
    let cx = 0;
    let row = 0;
    for (const e of entries) {
        const mark = e.colour ? sw + swGap : 0;
        const width = mark + textWidth(e.text, size);
        if (cx > 0 && (e.newLine || cx + width > w)) {
            row++;
            cx = 0;
        }
        const baseline = Math.round(y + size * 0.85 + row * line);
        items.push({
            swatch: e.colour
                ? {
                      x: x + cx,
                      y: baseline - sw + Math.round(size * 0.04),
                      w: sw,
                      h: sw,
                      colour: e.colour,
                  }
                : null,
            text: {
                x: x + cx + mark,
                y: baseline,
                text: e.text,
                size,
                tone: e.colour ? 'ink' : 'muted',
            },
        });
        cx += width + (e.colour ? itemGap : Math.round(size * 0.4));
    }
    const rows = entries.length ? row + 1 : 0;
    return {
        box: {
            x,
            y,
            w,
            h: Math.ceil(rows ? (rows - 1) * line + size * 1.15 : 0),
        },
        items,
    };
}

/** Height mixLegend will take (it is laid out from the top). */
export const mixLegendHeight = (
    w: number,
    view: ViewState,
    bar: MixBarLayout,
    size: number,
) => mixLegend(0, 0, w, view, bar, size).box.h;

export interface MixRowsLayout {
    box: Box;
    rows: MixRowItem[];
    more: number;
    moreLine: TextItem | null;
}

/**
 * The rows, in code order, as many as fit (each at least `rowMin` tall), then "and N more
 * constituencies". Names are never cut mid-word: a column's type shrinks to a floor, then wraps.
 */
export function mixRows(
    area: Box,
    view: ViewState,
    f: MixFonts,
): MixRowsLayout {
    const rows = view.mix.rows;
    const word = view.mix.rowWord ?? '';
    const { party: partyColour, theme } = mixColours(view);
    const floor = Math.round(f.row * 0.8);
    const holderRows = rows.some((r) => r.kind === 'holder');

    // Columns: name, then a bar and "N wards" (mix rows) or holder and party (holder rows).
    const chip = holderRows ? Math.round(f.row * 0.75) : 0;
    const chipGap = holderRows ? Math.round(f.row * 0.5) : 0;
    const colGap = Math.round(f.row * 0.8);
    const nameCap = Math.round(area.w * (holderRows ? 0.34 : 0.36));
    const names = rows.map((r) => r.name);
    const widest = (texts: string[], size: number, bold: boolean) =>
        Math.max(0, ...texts.map((t) => textWidth(t, size, bold)));
    // One size for the whole name column: shrink to the floor, then wrap the long ones.
    let size = f.row;
    while (size > floor && widest(names, size, true) > nameCap) size--;
    const nameLines = rows.map((r) => wrapText(r.name, nameCap, size, 2, true));
    const nameW = Math.min(
        nameCap,
        Math.ceil(widest(nameLines.flat(), size, true)),
    );
    const parties = rows.map((r) =>
        r.kind === 'holder' ? (r.holder?.party ?? '') : '',
    );
    const counts = rows.map((r) =>
        r.kind === 'mix' ? `${fmt(r.count)} ${r.word}` : '',
    );
    const rightW = Math.ceil(
        widest(holderRows ? parties : counts, size, holderRows),
    );
    const midX = area.x + chip + chipGap + nameW + colGap;
    const midW = area.x + area.w - rightW - colGap - midX;
    // Holder names share one size too, wrapping onto a second line when they must.
    let hSize = size;
    const holders = rows.map((r) =>
        r.kind === 'holder' ? (r.holder?.name ?? 'No approved data yet') : '',
    );
    while (hSize > floor && widest(holders, hSize, false) > midW) hSize--;
    const holderLines = holders.map((t) => wrapText(t, midW, hSize, 2));
    const lines = Math.max(
        1,
        ...nameLines.map((l) => l.length),
        ...holderLines.map((l) => l.length),
    );
    const lead = Math.round(size * 1.12);
    const need = Math.max(f.rowMin, lines * lead + Math.round(size * 0.3));
    const moreH = Math.round(size * 1.6);
    let shown = rows.length;
    let rowH = Math.min(f.rowMax, Math.floor(area.h / Math.max(1, shown)));
    if (rowH < need) {
        shown = Math.max(1, Math.floor((area.h - moreH) / need));
        rowH = Math.min(f.rowMax, Math.floor((area.h - moreH) / shown));
    }
    const more = rows.length - shown;
    const barH = Math.max(8, Math.round(size * 0.55));
    const items = rows.slice(0, shown).map((r, i): MixRowItem => {
        const top = area.y + i * rowH;
        const mid = top + rowH / 2;
        const block = (n: number, s: number) => (n - 1) * Math.round(s * 1.12);
        const firstBaseline = (n: number, s: number) =>
            Math.round(mid - block(n, s) / 2 + s * 0.36);
        const texts: MixText[] = nameLines[i].map((t, j) => ({
            role: 'name',
            x: area.x + chip + chipGap,
            y:
                firstBaseline(nameLines[i].length, size) +
                j * Math.round(size * 1.12),
            text: t,
            size,
            weight: 600,
            tone: 'ink',
        }));
        if (r.kind === 'mix') {
            texts.push({
                role: 'count',
                x: area.x + area.w,
                y: firstBaseline(1, size),
                text: counts[i],
                size,
                anchor: 'end',
                tone: 'muted',
            });
            const gap = 2;
            return {
                code: r.code,
                kind: r.kind,
                texts,
                chip: null,
                bar: spread(r.segments, midX, midW, gap).map((s) => ({
                    x: s.x,
                    y: Math.round(mid - barH / 2),
                    w: s.w,
                    h: barH,
                    colour: partyColour(s.key, s.colour),
                })),
            };
        }
        holderLines[i].forEach((t, j) =>
            texts.push({
                role: r.holder ? 'holder' : 'empty',
                x: midX,
                y:
                    firstBaseline(holderLines[i].length, hSize) +
                    j * Math.round(hSize * 1.12),
                text: t,
                size: hSize,
                tone: r.holder ? 'ink' : 'muted',
            }),
        );
        if (r.holder)
            texts.push({
                role: 'party',
                x: area.x + area.w,
                y: firstBaseline(1, size),
                text: r.holder.party,
                size,
                weight: 600,
                anchor: 'end',
                tone: 'ink',
            });
        return {
            code: r.code,
            kind: r.kind,
            texts,
            chip: {
                x: area.x,
                y: Math.round(mid - chip / 2),
                w: chip,
                h: chip,
                colour: r.holder
                    ? partyColour(r.holder.key, r.holder.colour)
                    : theme.noData,
            },
            bar: [],
        };
    });
    const moreSize = Math.round(size * 0.9);
    return {
        box: { ...area, h: shown * rowH + (more ? moreH : 0) },
        rows: items,
        more,
        moreLine: more
            ? {
                  x: area.x,
                  y: Math.round(area.y + shown * rowH + moreSize * 1.2),
                  text: `and ${more} more ${more === 1 ? word.replace(/ies$/, 'y').replace(/s$/, '') : word}`,
                  size: fitFontSize(
                      `and ${more} more ${word}`,
                      area.w,
                      moreSize,
                      floor,
                  ),
                  tone: 'muted',
              }
            : null,
    };
}

export interface HolderBlockLayout {
    box: Box;
    /** The ballot-lid bar beside the block, in the party's colour. */
    lid: Box & { colour: string };
    chip: Box & { colour: string };
    texts: TextItem[];
}

/**
 * One seat: who holds it. The seat, the holder's name exactly as the data spells it, the party
 * with its colour, since when, and the source; or "No approved data yet" with nothing invented.
 * Laid out from `y` across `w`; `box.h` is the height it takes.
 */
export function holderBlock(
    x: number,
    y: number,
    w: number,
    view: ViewState,
    f: { label: number; name: number; sub: number },
): HolderBlockLayout | null {
    const single = view.single;
    if (!single) return null;
    const theme = THEMES[view.theme];
    const h = single.holder;
    const lidW = Math.max(8, Math.round(f.label * 0.34));
    const tx = x + lidW + Math.round(f.label * 0.8);
    const tw = x + w - tx;
    const texts: TextItem[] = [];
    let at = y;
    const line = (
        text: string,
        size: number,
        tone: TextItem['tone'],
        weight = 400,
        lead = 1.25,
        maxLines = 2,
        indent = 0,
    ) => {
        for (const t of wrapText(
            text,
            tw - indent,
            size,
            maxLines,
            weight >= 600,
        )) {
            at += Math.round(size * lead);
            texts.push({ x: tx + indent, y: at, text: t, size, weight, tone });
        }
    };
    line(single.title, f.label, 'muted', 400, 1.0);
    let chip: Box & { colour: string };
    if (h) {
        at += Math.round(f.name * 0.15);
        line(h.name, f.name, 'ink', 700, 1.12, 3);
        at += Math.round(f.label * 0.35);
        const sw = Math.round(f.label * 0.75);
        const chipTop =
            at + Math.round(f.label * 1.25) - sw + Math.round(f.label * 0.04);
        line(
            h.party,
            f.label,
            'ink',
            600,
            1.25,
            2,
            sw + Math.round(f.label * 0.45),
        );
        chip = { x: tx, y: chipTop, w: sw, h: sw, colour: h.colour };
        if (h.since) {
            const since = formatAsOf(h.since);
            if (since)
                line(`In office since ${since}`, f.sub, 'muted', 400, 1.6);
        }
        line(`Source: ${h.source}`, f.sub, 'muted', 400, 1.4);
    } else {
        at += Math.round(f.name * 0.15);
        line(
            'No approved data yet',
            Math.round(f.name * 0.8),
            'muted',
            600,
            1.2,
        );
        chip = { x: tx, y: at, w: 0, h: 0, colour: theme.noData };
        line(`Source: ${view.source}`, f.sub, 'muted', 400, 1.6);
    }
    const bottom = at + Math.round(f.sub * 0.35);
    return {
        box: { x, y, w, h: bottom - y },
        lid: {
            x,
            y,
            w: lidW,
            h: bottom - y,
            colour: h ? h.colour : theme.noData,
        },
        chip,
        texts,
    };
}
