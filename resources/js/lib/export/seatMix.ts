// The seat mix for a card: one 100% stacked bar of the parties holding a seat in the current
// scope, in the legend's order and colours, and the rows inside a focused unit: for MCAs in a
// county, each constituency's mix of wards; for MCAs in a constituency or MPs in a county, who
// holds each seat. Everything joins on IEBC codes and the rows keep code order, never party order.
import { buildLegend, shareOf } from '@/lib/legend';
import { type SeatKey, SEAT_LEVEL } from '@/lib/map/colouring';
import type { FocusSelection } from '@/lib/map/focus';
import { OTHER } from '@/lib/map/theme';
import {
    INDEPENDENT,
    type SeatsData,
    legendScope,
    partyColours,
} from '@/lib/seats';
import type { Level, UnitIndex } from '@/lib/units';

/** Parties under this share of the bar fold into "Other parties" (Independents never do). */
export const MIX_MIN_SHARE = 0.03;

export interface MixPart {
    key: string;
    label: string;
    colour: string;
    count: number;
    share: string;
}

export interface MixSegment extends MixPart {
    /** The parties a highlight would need on for this segment to count as highlighted. */
    members: string[];
    /** Parties with a colour of their own folded in for being small (named on the card). */
    includes: MixPart[];
}

export type MixRow =
    | {
          kind: 'mix';
          code: number;
          name: string;
          /** Seats in the row's unit with a holder. */
          count: number;
          /** "wards" */
          word: string;
          /** In the bar's order; `key` is the party ("other" for Other parties). */
          segments: { key: string; colour: string; count: number }[];
      }
    | {
          kind: 'holder';
          code: number;
          name: string;
          holder: {
              name: string;
              /** The abbreviation, or "Independent". */
              party: string;
              /** The party key the highlight uses. */
              key: string;
              colour: string;
          } | null;
      };

export interface SeatMix {
    total: number;
    segments: MixSegment[];
    rows: MixRow[];
    /** What the rows are ("constituencies", "wards"), or null without rows. */
    rowWord: string | null;
}

const WORD: Record<Level, string> = {
    province: 'former provinces',
    county: 'counties',
    constituency: 'constituencies',
    ward: 'wards',
};
const DEPTH: Record<Level, number> = {
    province: 0,
    county: 1,
    constituency: 2,
    ward: 3,
};

export function seatMix(
    seats: SeatsData,
    seat: SeatKey,
    focus: FocusSelection | null,
    index: UnitIndex,
    only: readonly string[] = [],
): SeatMix {
    const scope = legendScope(index, seat, focus);
    const legend = buildLegend(
        seats,
        seat,
        scope && { codes: scope.codes, unitName: scope.unit.n },
        only,
    );
    const total = legend.rows.reduce((n, r) => n + (r.count ?? 0), 0);
    const part = (
        key: string,
        label: string,
        colour: string,
        count: number,
    ) => ({
        key,
        label,
        colour,
        count,
        share: shareOf(count, total),
    });

    // The legend's rows in order; small coloured parties fold into Other parties, named in it.
    const small = (key: string, count: number) =>
        key !== 'other' &&
        key !== INDEPENDENT &&
        total > 0 &&
        count / total < MIX_MIN_SHARE;
    const segments: MixSegment[] = [];
    const folded: MixPart[] = [];
    const foldedMembers: string[] = [];
    let other: { count: number; members: string[] } | null = null;
    for (const r of legend.rows) {
        const count = r.count ?? 0;
        const members = legend.members[r.key] ?? [];
        if (r.key === 'other') other = { count, members };
        else if (small(r.key, count)) {
            folded.push(part(r.key, r.label, r.colour, count));
            foldedMembers.push(...members);
        } else
            segments.push({
                ...part(r.key, r.label, r.colour, count),
                members,
                includes: [],
            });
    }
    const otherCount =
        (other?.count ?? 0) + folded.reduce((n, p) => n + p.count, 0);
    if (otherCount > 0)
        segments.push({
            ...part('other', 'Other parties', OTHER, otherCount),
            members: [...(other?.members ?? []), ...foldedMembers],
            includes: folded,
        });

    return { total, segments, ...mixRows(seats, seat, focus, index, segments) };
}

/** Which bar segment a party falls in. */
function segmentOf(
    segments: MixSegment[],
    party: string,
): MixSegment | undefined {
    return (
        segments.find((s) => s.key === party) ??
        segments.find((s) => s.members.includes(party))
    );
}

function mixRows(
    seats: SeatsData,
    seat: SeatKey,
    focus: FocusSelection | null,
    index: UnitIndex,
    segments: MixSegment[],
): Pick<SeatMix, 'rows' | 'rowWord'> {
    const none = { rows: [], rowWord: null };
    if (!focus) return none;
    const seatLevel = SEAT_LEVEL[seat];
    const depth = DEPTH[seatLevel] - DEPTH[focus.level];
    if (depth < 1) return none;
    const byCode = <T extends { c: number }>(units: T[]) =>
        [...units].sort((a, b) => a.c - b.c);
    const children = byCode(index.children(focus.level, focus.code));
    const holderOf = (code: number) =>
        seats.holders.find(
            (h) => h.seat === seat && h.level === seatLevel && h.code === code,
        );
    const colours = partyColours(seats);

    if (depth === 1)
        return {
            rowWord: WORD[seatLevel],
            rows: children.map((u) => {
                const h = holderOf(u.c);
                return {
                    kind: 'holder' as const,
                    code: u.c,
                    name: u.n,
                    holder: h?.party
                        ? {
                              name: h.name,
                              party:
                                  h.party === INDEPENDENT
                                      ? 'Independent'
                                      : h.party,
                              key: h.party,
                              colour: colours.get(h.party) ?? OTHER,
                          }
                        : null,
                };
            }),
        };

    // Two levels down (MCAs in a county): each child's mix of its own children's seats, with
    // the parties in the bar's order and colours (small coloured parties keep their colour).
    const order = (key: string) => {
        const i = segments.findIndex((s) => s.key === key);
        return i < 0 ? segments.length : i;
    };
    return {
        rowWord: WORD[children[0]?.l ?? 'constituency'],
        rows: children.map((u) => {
            const counts = new Map<string, number>();
            let count = 0;
            for (const g of index.children(u.l, u.c)) {
                const party = holderOf(g.c)?.party;
                if (!party) continue;
                count++;
                const seg = segmentOf(segments, party);
                // A party folded into Other parties for being small keeps its own colour here.
                const key =
                    seg && seg.key !== 'other'
                        ? seg.key
                        : seg?.includes.some((p) => p.key === party)
                          ? party
                          : 'other';
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            const word = WORD[seatLevel];
            return {
                kind: 'mix' as const,
                code: u.c,
                name: u.n,
                count,
                word: count === 1 ? word.replace(/s$/, '') : word,
                segments: [...counts.entries()]
                    .map(([key, n]) => ({
                        key,
                        colour:
                            key === 'other'
                                ? OTHER
                                : (colours.get(key) ?? OTHER),
                        count: n,
                    }))
                    .sort(
                        (a, b) =>
                            orderOf(a.key, segments, order) -
                            orderOf(b.key, segments, order),
                    ),
            };
        }),
    };
}

/**
 * Bar order for a row segment: the bar's own order, a party folded for being small just before
 * the grey "Other parties", which always comes last.
 */
function orderOf(
    key: string,
    segments: MixSegment[],
    order: (key: string) => number,
): number {
    if (key === 'other') return Number.MAX_SAFE_INTEGER;
    const own = order(key);
    if (own < segments.length) return own;
    const other = segments.find((s) => s.key === 'other');
    const inside = other?.includes.findIndex((p) => p.key === key) ?? -1;
    return segments.length + (inside < 0 ? 0.99 : (inside + 1) / 100);
}
