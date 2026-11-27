// Layout for the party card, one arrangement per size, built from the "Share this view" card's
// own pieces (its sizes and safe zones, the ballot-lid strip, the headline block and the footer),
// so the two kinds of card sit together. Every block and every line of text is placed here and
// the card component only draws what this returns, so tests can check that nothing overlaps or
// runs off the card.
import type { Box, FooterFonts, TextItem } from './layout';
import {
    type PartyCardView,
    TOP_COUNTIES_TITLE,
    partyMapCaption,
    partyScopeLine,
} from './partyCard';
import { VIEW_SIZES, type ViewSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';
import {
    type Spec,
    type StripSegment,
    SPECS,
    box,
    footerHeight,
    strip,
    titleBlock,
} from './viewLayout';

export interface PartyRowItem {
    key: string;
    colour: string;
    label: TextItem;
    value: TextItem;
    /** The whole seat: every holder of it, whatever their party. */
    track: Box;
    /** False for a nominated seat, which is a count only: no track, no bar (the space stays). */
    showTrack: boolean;
    /** The party's share of it. */
    bar: Box;
}

export interface PartyListLayout {
    box: Box;
    title: TextItem[];
    items: { key: number; label: TextItem; value: TextItem }[];
}

export interface PartyLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    /** Where the map of the party's MCA seats is drawn. */
    map: Box;
    /** The line under the map saying what its highlighted wards are. */
    mapCaption: TextItem;
    rowsBox: Box;
    rows: PartyRowItem[];
    /** Across Kenya: the counties where the party holds the most MCA seats. */
    list: PartyListLayout | null;
    footerBox: Box;
    footerFonts: FooterFonts;
}

export interface PartyText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
    /** Width over height of the area the map shows (Kenya is about 0.82). */
    mapAspect: number;
}

const MIN_TEXT = 18;

/**
 * The seven rows, each "label ... n of N (p%)" over a bar from the same left edge, one text size
 * for all of them. Rows take at most `maxRowH` each and shrink to fit `area`; `align` says
 * whether a block shorter than the area sits at its top or in its middle.
 */
function rowsBlock(
    area: Box,
    card: PartyCardView,
    spec: Spec,
    maxRowH: number,
    align: 'top' | 'centre',
): { rows: PartyRowItem[]; box: Box; height: number } {
    const n = Math.max(1, card.rows.length);
    const widest = (texts: string[], size: number, bold: boolean) =>
        Math.max(0, ...texts.map((t) => textWidth(t, size, bold)));
    const labels = card.rows.map((r) => r.label);
    const values = card.rows.map((r) => r.value);
    const barFor = (size: number) => Math.max(8, Math.min(18, Math.round(size * 0.5)));
    const needs = (size: number) => Math.round(size * 1.3) + barFor(size) + 10;

    let size = Math.round(spec.row.label * 1.1);
    // Label and value share a line: shrink them together until both fit, with a gap between.
    const fitsWide = (s: number) =>
        Math.ceil(widest(labels, s, false) + widest(values, s, true) + s * 1.2) <= area.w;
    const rowH = Math.min(maxRowH, Math.floor(area.h / n));
    while (size > MIN_TEXT && (!fitsWide(size) || needs(size) > rowH)) size--;
    const barH = barFor(size);
    const used = (n - 1) * rowH + Math.round(size * 0.9 + size * 0.3) + barH;
    const top = Math.round(
        align === 'centre' ? area.y + Math.max(0, (area.h - used) / 2) : area.y,
    );

    const rows = card.rows.map((r, i): PartyRowItem => {
        const baseline = Math.round(top + i * rowH + size * 0.9);
        const track = box(area.x, Math.round(baseline + size * 0.3), area.w, barH);
        const share = r.total > 0 ? r.count / r.total : 0;
        return {
            key: r.key,
            colour: card.colour,
            label: { x: area.x, y: baseline, text: r.label, size, tone: 'ink' },
            value: {
                x: area.x + area.w,
                y: baseline,
                text: r.value,
                size,
                weight: 700,
                anchor: 'end',
                tone: 'ink',
            },
            track,
            showTrack: !r.nominated,
            bar: box(
                track.x,
                track.y,
                !r.nominated && r.count > 0 ? Math.max(3, Math.round(share * track.w)) : 0,
                barH,
            ),
        };
    });
    return { rows, box: box(area.x, top, area.w, used), height: rowH * n };
}

/**
 * "Where it holds the most MCA seats": a title and up to five "county ... n of N wards" lines,
 * from the top of `area`. One text size for the lines, shrunk until the widest name and figure fit.
 */
function listBlock(area: Box, card: PartyCardView, spec: Spec): PartyListLayout | null {
    if (!card.top.length) return null;
    const size = Math.round(spec.row.label * 0.88);
    const names = card.top.map((c) => c.name);
    const values = card.top.map((c) => c.value);
    let line = size;
    const fits = (sz: number) =>
        Math.ceil(
            Math.max(...names.map((t) => textWidth(t, sz, false))) +
                Math.max(...values.map((t) => textWidth(t, sz, true))) +
                sz * 1.2,
        ) <= area.w;
    while (line > MIN_TEXT && !fits(line)) line--;
    const titleSize = fitFontSize(TOP_COUNTIES_TITLE, area.w, line, MIN_TEXT);
    const titleLines = wrapText(TOP_COUNTIES_TITLE, area.w, titleSize, 2);
    const titleLead = Math.round(titleSize * 1.3);
    const title = titleLines.map(
        (text, i): TextItem => ({
            x: area.x,
            y: Math.round(area.y + titleSize * 0.9 + i * titleLead),
            text,
            size: titleSize,
            tone: 'muted',
        }),
    );
    const lead = Math.round(line * 1.55);
    const itemsTop = Math.round(area.y + titleLines.length * titleLead + line * 0.5);
    const items = card.top.map((c, i) => {
        const baseline = Math.round(itemsTop + i * lead + line * 0.9);
        return {
            key: c.code,
            label: { x: area.x, y: baseline, text: c.name, size: line, tone: 'ink' as const },
            value: {
                x: area.x + area.w,
                y: baseline,
                text: c.value,
                size: line,
                weight: 700,
                anchor: 'end' as const,
                tone: 'ink' as const,
            },
        };
    });
    const bottom = itemsTop + (items.length - 1) * lead + Math.round(line * 1.2);
    return { box: box(area.x, area.y, area.w, bottom - area.y), title, items };
}

/** The part of `avail` a map of this shape fills, in the middle of it. */
function centred(avail: Box, aspect: number): Box {
    const w = Math.min(avail.w, avail.h * aspect);
    const h = Math.min(avail.h, w / aspect);
    return box(
        Math.round(avail.x + (avail.w - w) / 2),
        Math.round(avail.y + (avail.h - h) / 2),
        Math.round(w),
        Math.round(h),
    );
}

/** The caption's text size, and the height the map gives up to it. */
const captionSize = (spec: Spec) => Math.max(16, Math.round(spec.row.label * 0.7));
const captionHeight = (spec: Spec) => Math.round(captionSize(spec) * 1.6);

/** The caption, left-aligned under the map and shrunk (to a floor) until it fits the map's width. */
function mapCaptionFor(map: Box, card: PartyCardView, spec: Spec): TextItem {
    const text = partyMapCaption(card);
    let size = captionSize(spec);
    while (size > 12 && textWidth(text, size, false) > map.w) size--;
    return {
        x: map.x,
        y: Math.round(map.y + map.h + size * 1.15),
        text,
        size,
        tone: 'muted',
    };
}

export function partyLayout(
    size: ViewSize,
    card: PartyCardView,
    text: PartyText,
): PartyLayout {
    const { w, h } = VIEW_SIZES[size];
    const spec = SPECS[size];
    const { pad, gap } = spec;
    const scope = partyScopeLine(card);
    const lid = strip(w, spec.stripH);
    // Every map gives up this much height, under it, to its caption.
    const cap = captionHeight(spec);
    const finish = (
        t: ReturnType<typeof titleBlock>,
        map: Box,
        block: ReturnType<typeof rowsBlock>,
        footerBox: Box,
        list: PartyListLayout | null = null,
    ): PartyLayout => ({
        w,
        h,
        strip: lid,
        headline: t.headline,
        headlineLines: t.headlineLines,
        scopeLine: t.scopeLine,
        map,
        mapCaption: mapCaptionFor(map, card, spec),
        rowsBox: block.box,
        rows: block.rows,
        list,
        footerBox,
        footerFonts: spec.footer,
    });

    if (size === 'x') {
        // The map on the left at full height; headline and rows on the right; the footer under both.
        const top = Math.round(spec.stripH * 2 + pad * 0.75);
        const fh = footerHeight(w - 2 * pad, spec.footer, card, text.url);
        const footerBox = box(pad, h - pad * 0.7 - fh, w - 2 * pad, fh);
        const bodyBottom = Math.round(footerBox.y - gap * 0.75);
        const mapW = Math.round(
            Math.min(w - 2 * pad - 700 - gap * 1.5, (bodyBottom - top - cap) * text.mapAspect),
        );
        const colX = Math.round(pad + mapW + gap * 1.5);
        const colW = w - pad - colX;
        const t = titleBlock(colX, top, colW, spec, text.headline, scope);
        const rowsTop = Math.round(t.bottom + gap);
        const withList = card.top.length > 0;
        // With the top counties, the rows take the left of the column and the list the right.
        const rowsW = withList ? Math.round(colW * 0.6) : colW;
        const block = rowsBlock(
            box(colX, rowsTop, rowsW, bodyBottom - rowsTop),
            card,
            spec,
            Math.round(spec.row.max * 1.8),
            'top',
        );
        const list = withList
            ? listBlock(
                  box(colX + rowsW + gap, rowsTop, colW - rowsW - gap, bodyBottom - rowsTop),
                  card,
                  spec,
              )
            : null;
        return finish(t, box(pad, top, mapW, bodyBottom - top - cap), block, footerBox, list);
    }

    const innerW = w - pad - Math.max(pad, spec.insetRight ?? 0);
    const top = Math.round(Math.max(spec.stripH * 2 + pad * 0.8, spec.safeTop));
    const fh = footerHeight(innerW, spec.footer, card, text.url);
    const footerBox = box(
        pad,
        Math.round(h - Math.max(spec.safeBottom, pad * 0.8) - fh),
        innerW,
        fh,
    );
    const t = titleBlock(pad, top, innerW, spec, text.headline, scope);
    const bodyTop = Math.round(t.bottom + gap);
    const bodyBottom = Math.round(footerBox.y - gap);
    const body = box(pad, bodyTop, innerW, bodyBottom - bodyTop);
    const maxRowH = Math.round(spec.row.max * 1.8);

    if (size === 'story') {
        // Stories are tall: the map above (with the top counties beside it, across Kenya), the rows
        // under it, as roomy as the map can spare.
        const withList = card.top.length > 0;
        const minMap = Math.round(body.h * (withList ? 0.4 : 0.34));
        const rowH = Math.min(
            Math.round(spec.row.max * 2),
            Math.floor((body.h - minMap - gap) / Math.max(1, card.rows.length)),
        );
        const rowsH = rowH * card.rows.length;
        const block = rowsBlock(
            box(pad, bodyBottom - rowsH, innerW, rowsH),
            card,
            spec,
            rowH,
            'top',
        );
        const upper = box(pad, bodyTop, innerW, bodyBottom - rowsH - gap - bodyTop - cap);
        if (!withList) return finish(t, upper, block, footerBox);
        const listW = Math.round(innerW * 0.58);
        const list = listBlock(
            box(pad + innerW - listW, upper.y, listW, upper.h),
            card,
            spec,
        )!;
        // The list sits in the middle of the height the map has.
        const listY = Math.round(upper.y + Math.max(0, (upper.h - list.box.h) / 2));
        const placed = listBlock(
            box(pad + innerW - listW, listY, listW, upper.h),
            card,
            spec,
        );
        return finish(
            t,
            box(pad, upper.y, innerW - listW - gap, upper.h),
            block,
            footerBox,
            placed,
        );
    }

    // Square and portrait: the rows on the left, the map beside them.
    const rowsW = Math.round(innerW * 0.58);
    const block = rowsBlock(
        box(pad, bodyTop, rowsW, body.h),
        card,
        spec,
        maxRowH,
        'centre',
    );
    const column = box(pad + rowsW + gap, bodyTop, innerW - rowsW - gap, body.h);
    if (!card.top.length)
        return finish(
            t,
            centred(box(column.x, column.y, column.w, column.h - cap), text.mapAspect),
            block,
            footerBox,
        );
    // Across Kenya the column holds the map above and the top counties under it.
    const probe = listBlock(box(column.x, 0, column.w, 0), card, spec)!;
    const list = listBlock(
        box(column.x, column.y + column.h - probe.box.h, column.w, probe.box.h),
        card,
        spec,
    );
    const mapAvail = box(column.x, column.y, column.w, column.h - probe.box.h - gap - cap);
    return finish(t, centred(mapAvail, text.mapAspect), block, footerBox, list);
}
