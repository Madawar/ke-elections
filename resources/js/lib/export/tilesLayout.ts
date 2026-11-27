// Layout for "Every county the same size", portrait and story, inside the same frame as the other
// share cards (cardFrame: sizes, safe zones, the ballot-lid strip, the headline block and the
// footer). Every box and every line of text is placed here, so the card component only draws what
// this returns and tests can check that nothing overlaps, runs off the card or is cut.
//
// The grid (countyTiles.ts) is drawn as equal square tiles on one pitch, as large as the room
// allows, from the left edge under the scope line. Each tile has its county's name in the top-left,
// bold, wrapped at spaces or after a slash or hyphen inside a word, never cut and never shortened;
// one name size serves every tile, the largest at which every name fits. The key (the legend's
// rows with counts, in two columns, "No approved holder yet" on a line of its own) goes in the
// grid's empty bottom-left corner when it fits there, found from the grid's actual empty cells,
// at the card's small text or smaller, down to the footer's smallest; otherwise it goes under the grid at the card's
// small text and the tiles are made smaller to make room. With no map, the footer credits only the
// unit codes the counts are joined on.
import { COUNTY_TILES, TILE_COLUMNS, TILE_ROWS } from './countyTiles';
import type { Box, FooterFonts, TextItem } from './layout';
import type { ViewSize } from './sizes';
import { textWidth } from './text';
import { TILES_SCOPE, type TilesCardView } from './tilesCard';
import {
    type StripSegment,
    balanced,
    box,
    cardFrame,
    HEADLINE_STRETCH,
    strip,
    titleBlock,
} from './viewLayout';
import { CODES_CREDIT } from '@/lib/map/theme';

export interface TileItem {
    code: number;
    box: Box;
    colour: string;
    /** The colour the name is written in. */
    ink: string;
    /** The name's lines, top-left in the tile. */
    name: TextItem[];
}

export interface TilesKeyItem {
    key: string;
    chip: Box & { colour: string };
    /** "UDA" in ink. */
    label: TextItem;
    /** "20", muted, after the label. */
    count: TextItem;
    /** The space before the count, set after the label as the browser draws it. */
    gap: number;
}

export interface TilesLayout {
    w: number;
    h: number;
    strip: StripSegment[];
    headline: Box;
    headlineLines: TextItem[];
    scopeLine: TextItem;
    /** The grid's outer box, from the first column's left to the last column's right. */
    grid: Box;
    /** A tile's side. */
    tile: number;
    gutter: number;
    tiles: TileItem[];
    key: {
        /** In the grid's empty bottom-left corner, or under the grid. */
        inCorner: boolean;
        box: Box;
        entries: TilesKeyItem[];
    };
    footerBox: Box;
    footerFonts: FooterFonts;
    /** The footer's credit, as it was measured: the codes alone, as the card has no map. */
    attribution: string;
}

export interface TilesText {
    headline: string;
    /** The card's link, as the footer prints it. */
    url: string;
}

/** The name's largest size, and its least before the tiles' padding gives way, as shares of a tile. */
const NAME = { base: 0.16, least: 0.12 };

const gutterOf = (side: number) => Math.max(3, Math.round(side * 0.05));
const paddingOf = (side: number) => Math.max(4, Math.round(side * 0.08));

/**
 * A county's name in lines no wider than `w` at `size` (bold), broken at spaces or after a slash or
 * hyphen inside a word ("Elgeyo/" "Marakwet"); a hyphen standing alone stays with the word before
 * it ("Tharaka -" "Nithi"). Null when a piece is wider than `w`: nothing is ever cut.
 */
export function nameLines(name: string, w: number, size: number): string[] | null {
    // Pieces with the glue that joins each to the one before: a space, or nothing inside a word.
    const pieces: { text: string; glue: string }[] = [];
    for (const word of name.split(/\s+/).filter(Boolean)) {
        if (/^[-–/]$/.test(word) && pieces.length) {
            pieces[pieces.length - 1].text += ` ${word}`;
            continue;
        }
        word.split(/(?<=[^\s][/-])(?=.)/).forEach((part, i) =>
            pieces.push({ text: part, glue: i === 0 && pieces.length ? ' ' : '' }),
        );
    }
    const fits = (t: string) => textWidth(t, size, true) <= w;
    if (!pieces.every((p) => fits(p.text))) return null;
    const lines: string[] = [];
    let line = '';
    for (const p of pieces) {
        const next = line ? `${line}${p.glue}${p.text}` : p.text;
        if (line && !fits(next)) {
            lines.push(line);
            line = p.text;
        } else line = next;
    }
    if (line) lines.push(line);
    return lines;
}

/** Name lines at `size`: lead, where the first baseline sits under the tile's top, and the height. */
const nameMetrics = (size: number, pad: number) => ({
    lead: Math.round(size * 1.12),
    first: pad + Math.ceil(size * 0.8),
});

/** The largest name size at which every name fits its tile (width and height), whole. */
function nameSize(card: TilesCardView, side: number): number {
    const pad = paddingOf(side);
    const inner = side - 2 * pad;
    const fitsAll = (size: number) =>
        card.tiles.every((t) => {
            const lines = nameLines(t.name, inner, size);
            if (!lines) return false;
            const { lead, first } = nameMetrics(size, pad);
            return first + (lines.length - 1) * lead + Math.ceil(size * 0.2) <= side - pad;
        });
    // From the largest size down to the least, then on down: a name is never cut.
    for (let size = Math.round(side * NAME.base); size > 6; size--) if (fitsAll(size)) return size;
    return 6;
}

const keyMetrics = (size: number) => ({
    lead: Math.round(size * 1.32),
    chip: Math.round(size * 0.8),
    chipGap: Math.round(size * 0.4),
    colGap: Math.round(size * 1.1),
    countGap: Math.round(size * 0.3),
});

/** An entry's width: chip, gap, label, the space and its count. */
function entryW(e: TilesCardView['key'][number], size: number) {
    const m = keyMetrics(size);
    return (
        m.chip +
        m.chipGap +
        Math.ceil(textWidth(e.label, size)) +
        m.countGap +
        Math.ceil(textWidth(String(e.count), size))
    );
}

/**
 * The key at `size` from (x, y): two columns of the entries (down the first, then the second), then
 * "No approved holder yet" on a line of its own, and "Other parties" too when `otherOwnLine`.
 */
function keyAt(card: TilesCardView, x: number, y: number, size: number, otherOwnLine = false) {
    const m = keyMetrics(size);
    const own = (k: TilesCardView['key'][number]) =>
        k.key === 'none' || (otherOwnLine && k.key === 'other');
    const cols = card.key.filter((k) => !own(k));
    const lines = card.key.filter(own);
    const per = Math.ceil(cols.length / 2);
    const firstW = Math.max(0, ...cols.slice(0, per).map((k) => entryW(k, size)));
    const secondW = Math.max(0, ...cols.slice(per).map((k) => entryW(k, size)));
    const secondX = x + firstW + m.colGap;
    const top = y + Math.ceil(size * 0.8);
    const entry = (k: TilesCardView['key'][number], ex: number, baseline: number): TilesKeyItem => {
        const labelX = ex + m.chip + m.chipGap;
        return {
            key: k.key,
            chip: {
                x: ex,
                y: baseline - Math.round(size * 0.74),
                w: m.chip,
                h: m.chip,
                colour: k.colour,
            },
            label: { x: labelX, y: baseline, text: k.label, size, tone: 'ink' },
            count: {
                x: labelX + Math.ceil(textWidth(k.label, size)) + m.countGap,
                y: baseline,
                text: String(k.count),
                size,
                tone: 'muted',
            },
            gap: m.countGap,
        };
    };
    const entries = cols.map((k, i) =>
        entry(k, i < per ? x : secondX, top + (i % per) * m.lead),
    );
    let last = top + (Math.max(1, per) - 1) * m.lead;
    for (const k of lines) {
        last += m.lead;
        entries.push(entry(k, x, last));
    }
    const width = Math.max(
        cols.length > per ? secondX - x + secondW : firstW,
        ...lines.map((k) => entryW(k, size)),
    );
    return { entries, box: box(x, y, width, last + Math.ceil(size * 0.25) - y) };
}

/**
 * The grid's empty bottom-left corners: for each number of rows counted from the bottom, how many
 * columns from the left are empty in all of them. Only corners with room are kept.
 */
export function emptyCorners(): { cols: number; rows: number }[] {
    const taken = new Set(Object.values(COUNTY_TILES).map((c) => `${c.col},${c.row}`));
    const out: { cols: number; rows: number }[] = [];
    let cols = TILE_COLUMNS;
    for (let rows = 1; rows <= TILE_ROWS; rows++) {
        const row = TILE_ROWS - rows;
        let empty = 0;
        while (empty < TILE_COLUMNS && !taken.has(`${empty},${row}`)) empty++;
        cols = Math.min(cols, empty);
        if (!cols) break;
        out.push({ cols, rows });
    }
    return out;
}

/** The largest tile that lets the grid fit `w` × `h`, and its gutter. */
function tileFor(w: number, h: number) {
    let side = Math.floor(Math.min(w / TILE_COLUMNS, h / TILE_ROWS));
    while (
        side > 1 &&
        (TILE_COLUMNS * side + (TILE_COLUMNS - 1) * gutterOf(side) > w ||
            TILE_ROWS * side + (TILE_ROWS - 1) * gutterOf(side) > h)
    )
        side--;
    return { side, gutter: gutterOf(side) };
}

export function tilesLayout(
    size: ViewSize,
    card: TilesCardView,
    text: TilesText,
): TilesLayout {
    const { w, h, spec, innerW, top, footerBox, tight } = cardFrame(
        size,
        card,
        text.url,
        CODES_CREDIT,
    );
    const { pad } = spec;
    const t = titleBlock(pad, top, innerW, spec, text.headline, TILES_SCOPE);
    const bodyTop = Math.round(t.bottom + tight);
    const bodyBottom = Math.round(footerBox.y - tight);
    const keyBase = spec.callout.sub;

    // The grid as large as the body allows, and the key in an empty corner if it fits there at the
    // card's small text or a little smaller (the bigger corner first). Otherwise the key goes under
    // the grid at the card's small text, and the grid is made smaller to leave room for it.
    let { side, gutter } = tileFor(innerW, bodyBottom - bodyTop);
    // "Other parties" goes on a line of its own under the columns only when the columns fit the
    // corner at no size (as on "Five seats"): two even columns read better than a larger key.
    let corner: { x: number; y: number; size: number; otherOwnLine: boolean } | null = null;
    const pitch = () => side + gutter;
    search: for (const otherOwnLine of [false, true])
        for (let ks = keyBase; ks >= spec.footer.small; ks--)
            for (const c of [...emptyCorners()].sort((a, b) => b.cols * b.rows - a.cols * a.rows)) {
                const room = {
                    w: c.cols * pitch() - gutter - paddingOf(side),
                    h: c.rows * pitch() - gutter,
                };
                const plan = keyAt(card, 0, 0, ks, otherOwnLine);
                if (plan.box.w <= room.w && plan.box.h <= room.h) {
                    corner = {
                        x: pad,
                        y: bodyTop + (TILE_ROWS - c.rows) * pitch(),
                        size: ks,
                        otherOwnLine,
                    };
                    break search;
                }
            }
    let key: ReturnType<typeof keyAt>;
    if (corner) key = keyAt(card, corner.x, corner.y, corner.size, corner.otherOwnLine);
    else {
        const keyGap = Math.round(spec.gap * 0.6);
        const keyH = keyAt(card, 0, 0, keyBase).box.h;
        ({ side, gutter } = tileFor(innerW, bodyBottom - bodyTop - keyGap - keyH));
        key = keyAt(card, pad, bodyTop + TILE_ROWS * pitch() - gutter + keyGap, keyBase);
    }

    const grid = box(
        pad,
        bodyTop,
        TILE_COLUMNS * pitch() - gutter,
        TILE_ROWS * pitch() - gutter,
    );
    const nSize = nameSize(card, side);
    const tilePad = paddingOf(side);
    const { lead, first } = nameMetrics(nSize, tilePad);
    const tiles: TileItem[] = card.tiles.map((tile) => {
        const x = grid.x + tile.col * pitch();
        const y = grid.y + tile.row * pitch();
        const lines = nameLines(tile.name, side - 2 * tilePad, nSize) ?? [tile.name];
        return {
            code: tile.code,
            box: box(x, y, side, side),
            colour: tile.colour,
            ink: tile.ink,
            name: lines.map((line, i) => ({
                x: x + tilePad,
                y: y + first + i * lead,
                text: line,
                size: nSize,
                weight: 700,
                tone: 'ink',
            })),
        };
    });

    return {
        w,
        h,
        // The seat's lid drawn deeper: the card is about that seat.
        strip: strip(w, spec.stripH, card.seat),
        headline: t.headline,
        headlineLines: balanced(t.headlineLines, innerW / HEADLINE_STRETCH),
        scopeLine: t.scopeLine,
        grid,
        tile: side,
        gutter,
        tiles,
        key: { inCorner: !!corner, box: key.box, entries: key.entries },
        footerBox,
        footerFonts: spec.footer,
        attribution: CODES_CREDIT,
    };
}
