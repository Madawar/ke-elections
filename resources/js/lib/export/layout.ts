// Fixed layouts for the social cards, one per size. Every block is a box in card pixels; the
// card components only draw what these functions place, so tests can check that nothing
// overlaps or runs off the card.
import { CARD_SIZES, type CardSize } from './sizes';
import { fitFontSize, textWidth, wrapText } from './text';

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FooterFonts {
    text: number;
    small: number;
    url: number;
}

export interface LocatorLayout {
    w: number;
    h: number;
    header: Box;
    /** Small map of Kenya with the unit marked, beside the title. */
    inset: Box;
    fonts: { kicker: number; title: number; crumb: number };
    map: Box;
    seats: Box;
    /** 'rows' stacks the seats; 'columns' sets them side by side. */
    seatFlow: 'rows' | 'columns';
    seatFonts: { label: number; name: number; party: number };
    nameLines: number;
    /** Text size of the legend drawn over the bottom-left corner of the map. */
    legendText: number;
    footer: Box;
    footerFonts: FooterFonts;
}

const box = (x: number, y: number, w: number, h: number): Box => ({
    x,
    y,
    w,
    h,
});

/** Kenya is a little taller than wide on the map (≈ 0.82:1). */
const insetBox = (right: number, y: number, h: number) => {
    const w = Math.round(h * 0.82);
    return box(right - w, y, w, h);
};

export function locatorLayout(
    size: CardSize,
    seatCount: number,
): LocatorLayout {
    const { w, h } = CARD_SIZES[size];
    const n = Math.max(1, seatCount);
    switch (size) {
        case 'square': {
            const inset = insetBox(w - 56, 56, 150);
            return {
                w,
                h,
                header: box(56, 56, inset.x - 24 - 56, 150),
                inset,
                fonts: { kicker: 26, title: 64, crumb: 28 },
                map: box(56, 234, 572, 612),
                seats: box(56 + 572 + 36, 234, w - 56 - (56 + 572 + 36), 612),
                seatFlow: 'rows',
                seatFonts: { label: 22, name: 30, party: 22 },
                nameLines: 2,
                legendText: 19,
                footer: box(56, 874, w - 112, 150),
                footerFonts: { text: 22, small: 18, url: 24 },
            };
        }
        case 'portrait': {
            const inset = insetBox(w - 56, 56, 150);
            return {
                w,
                h,
                header: box(56, 56, inset.x - 24 - 56, 150),
                inset,
                fonts: { kicker: 26, title: 64, crumb: 28 },
                map: box(56, 234, w - 112, 664),
                seats: box(56, 926, w - 112, 190),
                seatFlow: 'columns',
                seatFonts: { label: 22, name: 28, party: 22 },
                nameLines: 2,
                legendText: 20,
                footer: box(56, 1144, w - 112, 150),
                footerFonts: { text: 22, small: 18, url: 24 },
            };
        }
        case 'story': {
            // Stories put the app's own controls over the top and bottom, so keep clear of them.
            const inset = insetBox(w - 72, 168, 180);
            const seatsH = n * 136;
            const footer = box(72, 1580, w - 144, 200);
            const seatsY = footer.y - 32 - seatsH;
            const mapY = 168 + 180 + 32;
            return {
                w,
                h,
                header: box(72, 168, inset.x - 24 - 72, 180),
                inset,
                fonts: { kicker: 30, title: 76, crumb: 32 },
                map: box(72, mapY, w - 144, seatsY - 32 - mapY),
                seats: box(72, seatsY, w - 144, seatsH),
                seatFlow: 'rows',
                seatFonts: { label: 24, name: 34, party: 24 },
                nameLines: 1,
                legendText: 22,
                footer,
                footerFonts: { text: 24, small: 20, url: 28 },
            };
        }
        case 'landscape': {
            const inset = insetBox(w - 40, 40, 104);
            const col = 572;
            return {
                w,
                h,
                header: box(col, 40, inset.x - 16 - col, 104),
                inset,
                fonts: { kicker: 17, title: 40, crumb: 19 },
                map: box(40, 40, 500, h - 80),
                seats: box(col, 164, w - 40 - col, 278),
                seatFlow: 'rows',
                seatFonts: { label: 15, name: 22, party: 15 },
                nameLines: 1,
                legendText: 15,
                footer: box(col, 462, w - 40 - col, 128),
                footerFonts: { text: 15, small: 13, url: 17 },
            };
        }
    }
}

// ---- in power now ----------------------------------------------------------------------

export interface ChamberLayout {
    heading: Box;
    headingText: number;
    statText: number;
    /** The hemicycle: always twice as wide as tall. */
    chart: Box;
    legend: Box;
    legendCols: number;
    legendText: number;
}

export interface InPowerLayout {
    w: number;
    h: number;
    header: Box;
    fonts: { title: number; sub: number };
    subLines: number;
    chambers: [ChamberLayout, ChamberLayout];
    footer: Box;
    footerFonts: FooterFonts;
}

export function inPowerLayout(size: CardSize): InPowerLayout {
    const { w, h } = CARD_SIZES[size];
    switch (size) {
        case 'square':
        case 'portrait': {
            const pad = 56;
            const header = box(pad, pad, w - 2 * pad, 140);
            const footer = box(pad, h - pad - 150, w - 2 * pad, 150);
            const top = header.y + header.h + 24;
            const bottom = footer.y - 24;
            const blockH = Math.floor((bottom - top - 24) / 2);
            const chartW = size === 'square' ? 510 : 600;
            const block = (y: number): ChamberLayout => {
                const chart = box(pad, y + 52, chartW, chartW / 2);
                const legendX = pad + chartW + 32;
                return {
                    heading: box(pad, y, w - 2 * pad, 44),
                    headingText: 30,
                    statText: 22,
                    chart,
                    legend: box(
                        legendX,
                        chart.y,
                        w - pad - legendX,
                        Math.min(blockH - 52, size === 'square' ? 250 : 300),
                    ),
                    legendCols: 2,
                    legendText: 21,
                };
            };
            return {
                w,
                h,
                header,
                fonts: { title: 60, sub: 24 },
                subLines: 2,
                chambers: [block(top), block(top + blockH + 24)],
                footer,
                footerFonts: { text: 22, small: 18, url: 24 },
            };
        }
        case 'story': {
            const padX = 72;
            const header = box(padX, 168, w - 2 * padX, 170);
            const footer = box(padX, 1580, w - 2 * padX, 200);
            const top = header.y + header.h + 32;
            const blockH = Math.floor((footer.y - 32 - top - 24) / 2);
            const block = (y: number): ChamberLayout => {
                const chart = box((w - 760) / 2, y + 64, 760, 380);
                const legendY = chart.y + chart.h + 20;
                return {
                    heading: box(padX, y, w - 2 * padX, 52),
                    headingText: 36,
                    statText: 26,
                    chart,
                    legend: box(
                        padX,
                        legendY,
                        w - 2 * padX,
                        y + blockH - legendY,
                    ),
                    legendCols: 3,
                    legendText: 22,
                };
            };
            return {
                w,
                h,
                header,
                fonts: { title: 76, sub: 30 },
                subLines: 2,
                chambers: [block(top), block(top + blockH + 24)],
                footer,
                footerFonts: { text: 24, small: 20, url: 28 },
            };
        }
        case 'landscape': {
            const pad = 36;
            const header = box(pad, pad, w - 2 * pad, 70);
            const footer = box(pad, h - pad - 124, w - 2 * pad, 124);
            const top = header.y + header.h + 16;
            const colW = (w - 2 * pad - 40) / 2;
            const block = (x: number): ChamberLayout => {
                const chart = box(x + (colW - 340) / 2, top + 38, 340, 170);
                const legendY = chart.y + chart.h + 12;
                return {
                    heading: box(x, top, colW, 30),
                    headingText: 20,
                    statText: 15,
                    chart,
                    legend: box(x, legendY, colW, footer.y - 14 - legendY),
                    legendCols: 3,
                    legendText: 15,
                };
            };
            return {
                w,
                h,
                header,
                fonts: { title: 36, sub: 16 },
                subLines: 1,
                chambers: [block(pad), block(pad + colW + 40)],
                footer,
                footerFonts: { text: 15, small: 13, url: 17 },
            };
        }
    }
}

// ---- shared pieces ---------------------------------------------------------------------

export interface TextItem {
    x: number;
    y: number; // baseline
    text: string;
    size: number;
    weight?: number;
    anchor?: 'start' | 'end';
    tone: 'ink' | 'muted';
}

export interface FooterInput {
    source: string;
    asOf: string | null; // already formatted
    attribution: string;
    url: string; // shown without the protocol
    /** A slide's place in its series ("2 of 4"), on the link's line; none outside a series. */
    page?: string;
    /**
     * The widest page text of the series ("4 of 4"), which the line is measured with in place of
     * `page`, so every slide of a series (each given the series' link) decides alike.
     */
    pageWidest?: string;
}

const BRAND = 'Kenya Electoral Map';

/**
 * A slide's page text in the footer. It sits just before the link and is drawn in the link's own
 * text element, `gap` apart, so the space between them is the renderer's and not an estimate of
 * the link's width; its `x` (where its end is, `anchor: 'end'`) is where the estimate puts it,
 * for the layout's checks.
 */
export interface FooterPage extends TextItem {
    gap: number;
}

/** The footer's lines: source and date, the attribution, then the site name and deep link. */
export function footerBlock(
    area: Box,
    fonts: FooterFonts,
    input: FooterInput,
): { rule: number; lines: TextItem[]; page: FooterPage | null; bottom: number } {
    const lines: TextItem[] = [];
    const lead = (s: number) => s * 1.35;
    let y = area.y + Math.round(fonts.text * 0.7);
    const source = `Source: ${input.source}.${input.asOf ? ` Data as of ${input.asOf}.` : ''}`;
    for (const text of wrapText(source, area.w, fonts.text, 2)) {
        y += lead(fonts.text);
        lines.push({ x: area.x, y, text, size: fonts.text, tone: 'ink' });
    }
    y += fonts.small * 0.3;
    // Keep each line's trailing space so the text content still reads as one sentence.
    const attribution = wrapText(input.attribution, area.w, fonts.small, 3);
    attribution.forEach((text, i) => {
        y += lead(fonts.small);
        lines.push({
            x: area.x,
            y,
            text: i < attribution.length - 1 ? `${text} ` : text,
            size: fonts.small,
            tone: 'muted',
        });
    });
    y += fonts.url * 0.45 + lead(fonts.url);
    // A deep link is never cut: a long one shrinks further than other text, and when even the
    // floor size is too wide the footer shows the plain page address without the query.
    const floor = Math.round(fonts.small * 0.75);
    const bare = (u: string) => u.replace(/[?#].*$/, '').replace(/\/$/, '');
    let url = input.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (textWidth(url, floor, true) > area.w) url = bare(url);
    const urlSize = fitFontSize(
        url,
        area.w,
        fonts.url,
        floor,
        true, // drawn at weight 600
    );
    const brandW = textWidth(BRAND, fonts.url, true);
    let showBrand =
        brandW + textWidth(url, urlSize, true) + fonts.url * 1.5 <= area.w;
    let linkText = url;
    let linkSize = urlSize;
    let linkAtEnd = showBrand;
    // A slide's page text sits on this line too, so the footer is no taller for it: just before
    // the link, which ends at the footer's right edge. The line is measured with the series'
    // widest page text, so every slide (all with the series' link) decides alike: the brand at
    // the left where the three fit, else no brand; only where the page text and the link alone
    // do not fit does the link shrink (down to its floor, then without its query). A card
    // outside a series takes none of these steps.
    let page: FooterPage | null = null;
    if (input.page) {
        const gap = Math.round(fonts.url * 0.6);
        const pageW = Math.max(
            textWidth(input.page, urlSize, false),
            input.pageWidest ? textWidth(input.pageWidest, urlSize, false) : 0,
        );
        let urlW = textWidth(url, urlSize, true);
        if (pageW + gap + urlW <= area.w) {
            showBrand = brandW + fonts.url * 1.5 + pageW + gap + urlW <= area.w;
        } else {
            showBrand = false;
            const room = area.w - pageW - gap;
            linkSize = fitFontSize(url, room, urlSize, floor, true);
            if (textWidth(url, linkSize, true) > room) {
                linkText = bare(url);
                linkSize = fitFontSize(linkText, room, urlSize, floor, true);
            }
            urlW = textWidth(linkText, linkSize, true);
        }
        linkAtEnd = true;
        page = {
            x: Math.round(area.x + area.w - urlW - gap),
            y,
            text: input.page,
            size: linkSize,
            weight: 400,
            anchor: 'end',
            tone: 'muted',
            gap,
        };
    }
    if (showBrand)
        lines.push({
            x: area.x,
            y,
            text: BRAND,
            size: fonts.url,
            weight: 600,
            tone: 'ink',
        });
    lines.push({
        x: linkAtEnd ? area.x + area.w : area.x,
        y,
        text: linkText,
        size: linkSize,
        weight: 600,
        anchor: linkAtEnd ? 'end' : 'start',
        tone: 'ink',
    });
    return { rule: area.y, lines, page, bottom: y + fonts.url * 0.25 };
}

// ---- locator: seats and map legend -----------------------------------------------------

export interface SeatBlock {
    key: string;
    lid: Box;
    swatch: (Box & { colour: string }) | null;
    lines: TextItem[];
    bottom: number;
}

/** Positions the seat rows (or columns): seat label, holder name, party with its swatch. */
export function seatBlocks(
    layout: LocatorLayout,
    rows: {
        key: string;
        label: string;
        holder: {
            name: string;
            party: string;
            abbrev: string;
            colour: string;
        } | null;
    }[],
): SeatBlock[] {
    const { seats, seatFonts: f, nameLines } = layout;
    const n = Math.max(1, rows.length);
    const gap = layout.seatFlow === 'columns' ? 24 : 0;
    const colW =
        layout.seatFlow === 'columns' ? (seats.w - gap * (n - 1)) / n : seats.w;
    const rowH =
        layout.seatFlow === 'columns'
            ? seats.h
            : Math.min(seats.h / n, f.name * 2 * nameLines + f.label * 3);
    const lidW = Math.max(6, Math.round(f.label * 0.34));
    return rows.map((row, i) => {
        const x =
            layout.seatFlow === 'columns'
                ? seats.x + i * (colW + gap)
                : seats.x;
        const top =
            layout.seatFlow === 'columns' ? seats.y : seats.y + i * rowH;
        const textX = x + lidW + Math.round(f.label * 0.7);
        const textW = x + colW - textX;
        const lines: TextItem[] = [];
        let y = top + f.label * 0.85;
        // Long seat names ("Member of the National Assembly") shrink a little before they cut.
        const labelSize = fitFontSize(
            row.label,
            textW,
            f.label,
            Math.round(f.label * 0.8),
        );
        lines.push({
            x: textX,
            y,
            text: wrapText(row.label, textW, labelSize, 1)[0] ?? '',
            size: labelSize,
            tone: 'muted',
        });
        let swatch: SeatBlock['swatch'] = null;
        if (row.holder) {
            const names = wrapText(
                row.holder.name,
                textW,
                f.name,
                nameLines,
                true,
            );
            names.forEach((text, j) => {
                y += j === 0 ? f.name * 1.25 : f.name * 1.15;
                lines.push({
                    x: textX,
                    y,
                    text,
                    size: f.name,
                    weight: 600,
                    tone: 'ink',
                });
            });
            y += f.party * 1.4;
            const sw = Math.round(f.party * 0.72);
            const partyX = textX + sw + Math.round(f.party * 0.4);
            const partyW = x + colW - partyX;
            const party =
                textWidth(row.holder.party, f.party) <= partyW
                    ? row.holder.party
                    : (wrapText(
                          row.holder.abbrev || row.holder.party,
                          partyW,
                          f.party,
                          1,
                      )[0] ?? '');
            swatch = {
                x: textX,
                y: y - sw + Math.round(f.party * 0.04),
                w: sw,
                h: sw,
                colour: row.holder.colour,
            };
            lines.push({
                x: partyX,
                y,
                text: party,
                size: f.party,
                tone: 'ink',
            });
        } else {
            y += f.name * 1.25;
            lines.push({
                x: textX,
                y,
                text: 'No approved data yet',
                size: Math.round(f.name * 0.85),
                tone: 'muted',
            });
        }
        const bottom = y + f.party * 0.3;
        return {
            key: row.key,
            lid: { x, y: top, w: lidW, h: bottom - top },
            swatch,
            lines,
            bottom,
        };
    });
}

export interface LegendBlock {
    panel: Box;
    title: TextItem;
    items: { swatch: (Box & { colour: string }) | null; label: TextItem }[];
}

/** The map legend: a small panel over the bottom-left corner of the map. */
export function legendBlock(
    map: Box,
    size: number,
    legend: {
        title: string;
        rows: { label: string; colour: string | null; count: number }[];
    },
): LegendBlock {
    const margin = Math.round(size * 0.7);
    const pad = Math.round(size * 0.6);
    const maxW = map.w - 2 * margin;
    const innerW = maxW - 2 * pad;
    const sw = Math.round(size * 0.72);
    const line = size * 1.5;
    const title = wrapText(legend.title, innerW, size, 1)[0] ?? '';
    let cx = 0;
    let row = 0;
    let widest = textWidth(title, size);
    const placed = legend.rows.map((r) => {
        const text = `${r.label} ${r.count}`;
        const mark = r.colour ? sw + size * 0.35 : 0;
        const w = mark + textWidth(text, size);
        if (cx > 0 && cx + w > innerW) {
            row++;
            cx = 0;
        }
        const at = { cx, row, text, colour: r.colour, mark };
        cx += w + size;
        widest = Math.max(widest, cx - size);
        return at;
    });
    const rows = legend.rows.length ? row + 1 : 0;
    const panelW = Math.min(maxW, Math.ceil(widest + 2 * pad));
    const panelH = Math.ceil(pad * 2 + size * 1.1 + rows * line);
    const panel = box(
        map.x + margin,
        map.y + map.h - margin - panelH,
        panelW,
        panelH,
    );
    const left = panel.x + pad;
    const firstBaseline = panel.y + pad + size * 0.85;
    return {
        panel,
        title: { x: left, y: firstBaseline, text: title, size, tone: 'muted' },
        items: placed.map((p) => {
            const baseline = firstBaseline + (p.row + 1) * line;
            return {
                swatch: p.colour
                    ? {
                          x: left + p.cx,
                          y: baseline - sw + Math.round(size * 0.04),
                          w: sw,
                          h: sw,
                          colour: p.colour,
                      }
                    : null,
                label: {
                    x: left + p.cx + p.mark,
                    y: baseline,
                    text: p.text,
                    size,
                    tone: 'ink' as const,
                },
            };
        }),
    };
}
