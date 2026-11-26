// The map legend as data: the rows, what each row stands for, which parties are highlighted and
// how the heading and chip describe that. The page only wires this to the legend and the map.
import type { SeatKey } from './map/colouring';
import { OTHER, PROVINCE_TINTS } from './map/theme';
import { legendTitle, seatLegend, type SeatsData } from './seats';

export interface LegendRow {
    key: string;
    /** What the row shows: a party abbreviation, or a province name. */
    label: string;
    /** The full name, read out by assistive technology (defaults to the label). */
    name?: string;
    colour: string;
    count?: number;
    /** Sorts after every other row whatever its count ("Other and independent"). */
    last?: boolean;
}

export const SEAT_LABEL: Record<SeatKey, string> = {
    governor: 'Governor',
    senator: 'Senator',
    woman_rep: 'Woman Rep',
    mp: 'MP',
    mca: 'MCA',
};

/** A share of the seats in view, in whole percent; "<1%" for a share under one half. */
export function shareOf(count: number, total: number): string {
    const p = (count / (total || 1)) * 100;
    return count > 0 && p < 0.5 ? '<1%' : `${Math.round(p)}%`;
}

/** The most party rows the legend shows; every other party is folded into "Other". */
export const MAX_PARTY_ROWS = 7;

export interface LegendModel {
    title: string;
    /** The collapsed chip says what is highlighted, so a phone shows it with the legend closed. */
    chipLabel: string;
    rows: LegendRow[];
    /** The parties each row stands for ("other" is every party folded into it). */
    members: Record<string, string[]>;
    /** The keys of the rows that are on: every party they stand for is highlighted. */
    highlighted: string[];
    /** What the person pressed, by row label, plus highlighted parties no row shows. */
    showing: string[];
    /** Some highlight is on (even one no row stands for). */
    filtered: boolean;
    note?: string;
}

/**
 * The legend for a seat. `scope` limits the counts to the seats inside a focused unit (and names
 * it in the heading); without it the counts are national. `only` is the set of highlighted parties.
 */
export function buildLegend(
    seats: SeatsData,
    seat: SeatKey,
    scope: { codes: Set<number>; unitName: string } | null,
    only: readonly string[],
    asOf: string | null = '',
): LegendModel {
    const rows = seatLegend(seats, seat, scope?.codes);
    const shown = rows
        .filter((r) => r.colour !== OTHER)
        .slice(0, MAX_PARTY_ROWS);
    const folded = rows.filter((r) => !shown.includes(r));
    const other = folded.reduce((n, r) => n + r.seats, 0);
    const mapped: LegendRow[] = shown.map((r) => ({
        key: r.abbrev,
        label: r.abbrev,
        name: r.name,
        colour: r.colour,
        count: r.seats,
    }));
    if (other)
        mapped.push({
            key: 'other',
            label: 'Other',
            name: 'Other and independent',
            colour: OTHER,
            count: other,
            last: true,
        });
    // A row is on when every party it stands for is highlighted.
    const members: Record<string, string[]> = Object.fromEntries(
        shown.map((r) => [r.abbrev, [r.abbrev]]),
    );
    if (other) members.other = folded.map((r) => r.abbrev);
    const chosen = new Set(only);
    const on = mapped.filter((r) => members[r.key].every((a) => chosen.has(a)));
    const covered = new Set(on.flatMap((r) => members[r.key]));
    const showing = [
        ...on.map((r) => r.label),
        ...[...chosen].filter((a) => !covered.has(a)),
    ];
    return {
        title: legendTitle(SEAT_LABEL[seat], scope?.unitName, showing),
        chipLabel: `${SEAT_LABEL[seat]} seats${showing.length ? `: ${showing.length > 3 ? `${showing.length} parties` : showing.join(', ')}` : ''}`,
        rows: mapped,
        members,
        highlighted: on.map((r) => r.key),
        showing,
        filtered: chosen.size > 0,
        note: `${mapped.length ? '' : 'No approved holder for this seat yet. '}Elected 2022, with changes since. Source: IEBC gazette notices${asOf ? `, as of ${asOf}` : ''}`,
    };
}

/**
 * A row was pressed: the highlighted parties after switching on or off every party the row stands
 * for. "Other" is one press for all the parties folded into it.
 */
export function toggleParty(
    members: Record<string, string[]>,
    only: readonly string[],
    key: string,
): string[] {
    const parties = members[key];
    if (!parties?.length) return [...only];
    const next = new Set(only);
    const allOn = parties.every((a) => next.has(a));
    for (const a of parties) {
        if (allOn) next.delete(a);
        else next.add(a);
    }
    return [...next];
}

/** A different seat keeps the highlighted parties that hold it nationally and drops the rest. */
export function pruneParties(
    seats: SeatsData,
    seat: SeatKey | 'none' | 'province',
    only: readonly string[],
): string[] {
    if (!only.length) return [...only];
    const present =
        seat === 'none' || seat === 'province'
            ? new Set<string>()
            : new Set(seatLegend(seats, seat).map((r) => r.abbrev));
    return only.filter((a) => present.has(a));
}

/** The former-provinces key: a plain list of colours, with nothing to highlight or count. */
export function buildProvinceLegend(
    provinces: { c: number; n: string }[],
): LegendModel {
    return {
        title: 'Former provinces',
        chipLabel: 'Former provinces',
        rows: [...provinces]
            .sort((a, b) => a.c - b.c)
            .map((p) => ({
                key: String(p.c),
                label: p.n,
                colour: PROVINCE_TINTS[(p.c - 1) % PROVINCE_TINTS.length],
            })),
        members: {},
        highlighted: [],
        showing: [],
        filtered: false,
    };
}

/**
 * The badge on the map settings button: one for a colouring, plus one for each legend row the
 * person pressed. "Other" is one press however many parties are folded into it.
 */
export const settingsCount = (
    colour: string,
    legend: Pick<LegendModel, 'showing'> | null,
): number => (colour !== 'none' ? 1 : 0) + (legend?.showing.length ?? 0);

/**
 * Whether the legend box is open after the selection changes. Focusing a unit from Kenya
 * collapses it to its chip so it never covers the unit; going back to all of Kenya opens it on
 * desktop (phones keep it collapsed); moving between units leaves it as the person set it.
 */
export function legendOpenAfterSelect(
    open: boolean,
    {
        desktop,
        wasFocused,
        focusing,
    }: {
        desktop: boolean;
        wasFocused: boolean;
        focusing: boolean;
    },
): boolean {
    if (focusing) return wasFocused ? open : false;
    return desktop;
}
