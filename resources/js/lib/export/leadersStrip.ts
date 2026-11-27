// The leaders strip on a card: one compact row per leader (lib/leaders.ts), in seat order. Each
// row is the seat's ballot-colour bar, the seat, the holder's name exactly as the data spells it,
// and the party's chip with its abbreviation. Like the other card layouts it places every box and
// line, so the card only draws them and tests can check that nothing overlaps.
import { type LeaderRow, type LeaderSeat, leaderColour } from '@/lib/leaders';
import type { Box, TextItem } from './layout';
import { textWidth, wrapText } from './text';

export type StripText = TextItem & {
    role: 'seat' | 'name' | 'party' | 'since' | 'empty';
};

export interface StripRowItem {
    seat: LeaderSeat;
    /** The ballot-lid bar, in the seat's colour. */
    lid: Box & { colour: string };
    /** The party's colour; none for a seat with no holder (or no party named). */
    chip: (Box & { colour: string }) | null;
    texts: StripText[];
}

export interface LeadersStripLayout {
    box: Box;
    columns: 1 | 2;
    rows: StripRowItem[];
    /** "+1 more at <link>", when there was no room for every row. */
    more: TextItem | null;
    /**
     * A county's MCA card: "MPs (outlines): ODM 8, UDA 4", under the rows. It is the key to the
     * outlines on the card's map, so it is always printed whole, on as many lines as it needs.
     */
    note: TextItem[];
}

export interface LeadersStripInput {
    x: number;
    y: number;
    w: number;
    /** The most height the strip may take. */
    maxH: number;
    rows: LeaderRow[];
    font: number;
    /** The card's link, as "+N more at <link>" prints it. */
    link: string;
    /** Two columns halve the height; one column is used when a name does not fit half the width. */
    columns: 1 | 2;
    /**
     * In two columns, give a constituency's MP a line of its own across the width (the default).
     * Without it the MP shares the columns, and says since when only if that fits its cell.
     */
    lead?: boolean;
    /** A line under the rows: the county's MPs by party, which its map shows as outlines. */
    note?: string | null;
}

const EMPTY = 'No approved data yet';
/** The smallest the names shrink to before the strip gives up on two columns. */
const NAME_FLOOR = 0.72;

/** "since 2022": only the MP row of a constituency's card says since when. */
const sinceOf = (row: LeaderRow) =>
    row.seat === 'mp' && row.holder?.startedOn
        ? `since ${row.holder.startedOn.slice(0, 4)}`
        : '';

/**
 * Wrap "MPs (outlines): ODM 8, UDA 4, JP 3" between its pairs, never inside one: "ODM 8" and its
 * comma stay together, and the first pair stays with the label. A pair wider than a line (which
 * no real party makes) falls back to wrapping on spaces.
 */
export function wrapPairs(text: string, maxWidth: number, size: number): string[] {
    const tokens = text.split(', ').map((t, i, all) => (i < all.length - 1 ? `${t},` : t));
    if (tokens.some((t) => textWidth(t, size) > maxWidth))
        return wrapText(text, maxWidth, size);
    const lines: string[] = [];
    let line = '';
    for (const token of tokens) {
        const next = line ? `${line} ${token}` : token;
        if (!line || textWidth(next, size) <= maxWidth) line = next;
        else {
            lines.push(line);
            line = token;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export function leadersStrip({
    x,
    y,
    w,
    maxH,
    rows,
    font,
    link,
    columns,
    lead: leadLine = true,
    note = null,
}: LeadersStripInput): LeadersStripLayout | null {
    if (!rows.length) return null;
    const rowH = Math.round(font * 1.5);
    const lidW = Math.max(5, Math.round(font * 0.26));
    const gap = Math.round(font * 0.5);
    const small = Math.round(font * 0.88);
    const chipS = Math.round(font * 0.62);
    const seatCol = Math.ceil(
        Math.max(...rows.map((r) => textWidth(r.label, small))),
    );
    const nameX = lidW + gap + seatCol + gap;
    /** The room a row's name has in a column this wide, once its party and date are placed. */
    const tail = (r: LeaderRow, since: boolean) =>
        r.holder?.party
            ? gap +
              chipS +
              Math.round(font * 0.3) +
              textWidth(r.holder.partyLabel, small, true) +
              (since && sinceOf(r)
                  ? gap * 0.7 + textWidth(sinceOf(r), small)
                  : 0)
            : 0;
    const nameOf = (r: LeaderRow) => r.holder?.name ?? EMPTY;
    const colGap = Math.round(font * 1.4);
    const widthOf = (cols: number) =>
        cols === 2 ? Math.floor((w - colGap) / 2) : w;
    /**
     * Where each row goes. In two columns a constituency's MP (with its "since") keeps a line of
     * its own across the width, and the county-wide rows fill the lines under it, left to right.
     */
    const place = (shown: LeaderRow[], cols: 1 | 2) => {
        const lead = leadLine && cols === 2 && shown[0]?.seat === 'mp' ? 1 : 0;
        const perCol = Math.ceil((shown.length - lead) / cols);
        return {
            lines: lead + perCol,
            cells: shown.map((r, i) =>
                i < lead
                    ? { r, col: 0, line: 0, width: w }
                    : {
                          r,
                          col: (i - lead) % cols,
                          line: lead + Math.floor((i - lead) / cols),
                          width: widthOf(cols),
                      },
            ),
        };
    };
    /** The one size every name is set at so each row fits its cell; null under the floor. */
    const fit = (shown: LeaderRow[], cols: 1 | 2, since = true) => {
        const placed = place(shown, cols);
        let size = font;
        for (const { r, width } of placed.cells) {
            const room = width - nameX - tail(r, since);
            const at = textWidth(nameOf(r), font, !!r.holder);
            if (at > room) size = Math.min(size, Math.floor((font * room) / at));
        }
        return size >= Math.round(font * NAME_FLOOR)
            ? { ...placed, size, cols, since }
            : null;
    };
    /** Two columns if every name fits them, else one. */
    const arrange = (shown: LeaderRow[]) =>
        (columns === 2 ? (fit(shown, 2) ?? fit(shown, 2, false)) : null) ??
        fit(shown, 1) ?? {
            // A name too long even for the full width still goes in whole, at the floor.
            ...place(shown, 1),
            size: Math.round(font * NAME_FLOOR),
            cols: 1 as const,
            since: true,
        };

    // Every row; with no room for that, the first two and a count of the rest.
    // The note is the key to the map's outlines: it is never dropped and never cut. It wraps
    // between its "party count" pairs, and its height comes out of the rows' room, not the other
    // way round.
    const noteSize = Math.round(small * 0.94);
    const noteLead = Math.round(noteSize * 1.35);
    const noteLines = note ? wrapPairs(note, w - lidW - gap, noteSize) : [];
    const noteH = noteLines.length
        ? noteLines.length * noteLead + Math.round(small * 0.2)
        : 0;
    let layout = arrange(rows);
    let more = 0;
    if (layout.lines * rowH + noteH > maxH && rows.length > 2) {
        layout = arrange(rows.slice(0, 2));
        more = rows.length - 2;
    }
    const type = layout.size;
    const cols = layout.cols;
    const items = layout.cells.map(({ r, col, line, width }): StripRowItem => {
        const left = x + col * (width + colGap);
        const top = y + line * rowH;
        const mid = top + rowH / 2;
        const baseline = (s: number) => Math.round(mid + s * 0.36);
        const texts: StripText[] = [
            {
                role: 'seat',
                x: left + lidW + gap,
                y: baseline(small),
                text: r.label,
                size: small,
                tone: 'muted',
            },
            {
                role: r.holder ? 'name' : 'empty',
                x: left + nameX,
                y: baseline(type),
                text: nameOf(r),
                size: type,
                weight: r.holder ? 600 : 400,
                tone: r.holder ? 'ink' : 'muted',
            },
        ];
        let chip: StripRowItem['chip'] = null;
        if (r.holder?.party) {
            const chipX = Math.round(
                left + nameX + textWidth(r.holder.name, type, true) + gap,
            );
            chip = {
                x: chipX,
                y: Math.round(mid - chipS / 2),
                w: chipS,
                h: chipS,
                colour: r.holder.colour,
            };
            const partyX = chipX + chipS + Math.round(font * 0.3);
            texts.push({
                role: 'party',
                x: partyX,
                y: baseline(small),
                text: r.holder.partyLabel,
                size: small,
                weight: 600,
                tone: 'ink',
            });
            const since = layout.since ? sinceOf(r) : '';
            if (since)
                texts.push({
                    role: 'since',
                    x: Math.round(
                        partyX +
                            textWidth(r.holder.partyLabel, small, true) +
                            gap * 0.7,
                    ),
                    y: baseline(small),
                    text: since,
                    size: small,
                    tone: 'muted',
                });
        }
        return {
            seat: r.seat,
            lid: {
                x: left,
                y: Math.round(mid - font * 0.55),
                w: lidW,
                h: Math.round(font * 1.1),
                colour: leaderColour(r.seat),
            },
            chip,
            texts,
        };
    });
    const rowsH = layout.lines * rowH;
    const moreH = more ? Math.round(small * 1.5) : 0;
    return {
        box: { x, y, w, h: rowsH + moreH + noteH },
        columns: cols,
        rows: items,
        note: noteLines.map((text, i) => ({
            x: x + lidW + gap,
            y: Math.round(y + rowsH + moreH + noteSize * 0.95 + i * noteLead),
            text,
            size: noteSize,
            tone: 'muted' as const,
        })),
        more: more
            ? {
                  x: x + lidW + gap,
                  y: Math.round(y + rowsH + small * 1.05),
                  text: `+${more} more at ${link}`,
                  size: small,
                  tone: 'muted',
              }
            : null,
    };
}
