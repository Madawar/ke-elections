// Current office holders and parties from /data/seats.json (imported from cited CSVs),
// turned into party colours, map colouring and per-unit seat rows.
import { type Colouring, type SeatKey, SEAT_LEVEL } from './map/colouring';
import type { MapLevel } from './map/levels';
import { OTHER, THEMES } from './map/theme';
import type { Unit, UnitIndex } from './units';

export interface Party {
    abbrev: string;
    name: string;
    coalition_2022: string | null;
    colour: string | null;
}

export interface Holder {
    seat: SeatKey | 'nominated_mp' | 'nominated_senator' | 'nominated_mca';
    level: 'county' | 'constituency' | 'ward' | 'national';
    code: number;
    name: string;
    party: string | null;
    basis: string;
    started_on: string;
    source_url: string;
    confidence?: string;
}

export interface SeatsData {
    as_of: string | null;
    /** Latest start or end date among the holders: the date the data describes. */
    data_as_of?: string | null;
    parties: Party[];
    holders: Holder[];
    totals: Record<string, Record<string, number>>;
    chambers: {
        national_assembly: Record<string, number>;
        senate: Record<string, number>;
    };
}

export const EMPTY_SEATS: SeatsData = {
    as_of: null,
    parties: [],
    holders: [],
    totals: {},
    chambers: { national_assembly: {}, senate: {} },
};

export async function loadSeats(url = '/data/seats.json'): Promise<SeatsData> {
    try {
        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return EMPTY_SEATS;
        return { ...EMPTY_SEATS, ...(await res.json()) };
    } catch {
        return EMPTY_SEATS;
    }
}

export const INDEPENDENT = 'IND';

/** Seats held per party across every current holder, largest first (ties by abbreviation). */
export function partyRanking(
    data: SeatsData,
): { abbrev: string; seats: number }[] {
    const counts = new Map<string, number>();
    for (const h of data.holders)
        if (h.party) counts.set(h.party, (counts.get(h.party) ?? 0) + 1);
    return [...counts.entries()]
        .map(([abbrev, seats]) => ({ abbrev, seats }))
        .sort((a, b) => b.seats - a.seats || a.abbrev.localeCompare(b.abbrev));
}

/** The colour of a party with none set: the independent token for independents, else "Other". */
const fallback = (abbrev: string) =>
    abbrev === INDEPENDENT ? THEMES.light.independent : OTHER;

/**
 * A display colour for every party: the colour set in data/sources/party_colours.csv (defaults
 * derived from each party's ORPP-registered colours, adjusted to stay distinct and legible), else
 * the neutral grey "Other". Independents are never "Other": they take the theme's `independent`
 * token (set per theme by withIndependentColour; the light token when the data is unthemed).
 * Colours never depend on seat counts, so they don't shift as data changes.
 */
export function partyColours(data: SeatsData): Map<string, string> {
    const out = new Map<string, string>();
    for (const p of data.parties)
        out.set(p.abbrev, p.colour ?? fallback(p.abbrev));
    for (const h of data.holders)
        if (h.party && !out.has(h.party)) out.set(h.party, fallback(h.party));
    return out;
}

/**
 * The seats data with independents drawn in this theme's `independent` colour. Everything that
 * reads party colours (map, legend, seating charts, cards) then shows them as their own group.
 */
export function withIndependentColour(
    data: SeatsData,
    colour: string,
): SeatsData {
    const own = data.parties.find((p) => p.abbrev === INDEPENDENT);
    return {
        ...data,
        parties: [
            ...data.parties.filter((p) => p.abbrev !== INDEPENDENT),
            {
                abbrev: INDEPENDENT,
                name: own?.name ?? 'Independent',
                coalition_2022: own?.coalition_2022 ?? null,
                colour,
            },
        ],
    };
}

export const currentHolder = (data: SeatsData, seat: SeatKey, code: number) =>
    data.holders.find((h) => h.seat === seat && h.code === code);

/**
 * Colour the seat's units by the holder's party. `only` is the set of highlighted party
 * abbreviations: those keep their colour and every other holder's unit goes to `faded`. Below the
 * seat level the colours are carried down by ancestor (colouring.ts), so the highlight follows.
 */
export function seatColouring(
    data: SeatsData,
    seat: SeatKey,
    opts: { noData: string; faded: string; only?: Set<string> },
): Colouring {
    const colours = partyColours(data);
    const map = new Map<number, string>();
    const level = SEAT_LEVEL[seat];
    for (const h of data.holders) {
        if (h.seat !== seat || h.level !== level || !h.party) continue;
        const show =
            !opts.only || opts.only.size === 0 || opts.only.has(h.party);
        map.set(
            h.code,
            show ? (colours.get(h.party) ?? fallback(h.party)) : opts.faded,
        );
    }
    return {
        mode: { kind: 'seat', seat },
        colours: map,
        fallback: opts.noData,
    };
}

/**
 * The seats a legend counts while a unit is focused: the codes of the seat's units that sit inside
 * the focus (the 17 constituencies of Nairobi City, for MPs), or the one unit that holds the seat
 * when the seat is coarser than the focus (the county, for a Governor while a ward is focused).
 * `unit` is the unit those codes belong to, for the legend's heading. Null while nothing is focused.
 */
export function legendScope(
    index: UnitIndex,
    seat: SeatKey,
    focus: { level: MapLevel; code: number } | null,
): { codes: Set<number>; unit: Unit } | null {
    const self = focus && index.get(focus.level, focus.code);
    if (!focus || !self) return null;
    const seatLevel = SEAT_LEVEL[seat];
    if (seatLevel === focus.level)
        return { codes: new Set([focus.code]), unit: self };
    const holder = index
        .ancestors(focus.level, focus.code)
        .find((a) => a.l === seatLevel);
    if (holder) return { codes: new Set([holder.c]), unit: holder };
    const within = (unit: Unit): Unit[] =>
        unit.l === seatLevel
            ? [unit]
            : index.children(unit.l, unit.c).flatMap(within);
    return { codes: new Set(within(self).map((u) => u.c)), unit: self };
}

/**
 * The legend heading: it always says what the counts cover, all of Kenya or the focused unit, and
 * which parties are highlighted (their abbreviations, or a count beyond three).
 */
export const legendTitle = (
    seatLabel: string,
    unitName?: string | null,
    showing: string[] = [],
) => {
    const base = unitName
        ? `${seatLabel} seats in ${unitName} by party`
        : `${seatLabel} seats across Kenya by party`;
    if (showing.length === 0) return base;
    return `${base}: showing ${showing.length > 3 ? `${showing.length} parties` : showing.join(', ')}`;
};

/**
 * Legend rows for a seat: parties holding it, largest first. With `scope`, only the seats whose
 * unit code is in it are counted; without, the national totals.
 */
export function seatLegend(
    data: SeatsData,
    seat: SeatKey,
    scope?: Set<number> | null,
): { abbrev: string; name: string; seats: number; colour: string }[] {
    const colours = partyColours(data);
    const names = new Map(data.parties.map((p) => [p.abbrev, p.name]));
    const counts = new Map<string, number>();
    for (const h of data.holders)
        if (h.seat === seat && h.party && (!scope || scope.has(h.code)))
            counts.set(h.party, (counts.get(h.party) ?? 0) + 1);
    return [...counts.entries()]
        .map(([abbrev, seats]) => ({
            abbrev,
            name:
                abbrev === INDEPENDENT
                    ? 'Independent'
                    : (names.get(abbrev) ?? abbrev),
            seats,
            colour: colours.get(abbrev) ?? fallback(abbrev),
        }))
        .sort((a, b) => b.seats - a.seats || a.abbrev.localeCompare(b.abbrev));
}

/**
 * Hemicycle groups for a chamber, largest party first; independents are a group of their own and
 * the parties without a colour are merged into "Other parties" at the end.
 */
export function chamberGroups(
    data: SeatsData,
    chamber: 'national_assembly' | 'senate',
) {
    const colours = partyColours(data);
    const names = new Map(data.parties.map((p) => [p.abbrev, p.name]));
    const rows = Object.entries(data.chambers[chamber] ?? {}).map(
        ([abbrev, seats]) => ({
            key: abbrev,
            label:
                abbrev === INDEPENDENT
                    ? 'Independent'
                    : names.get(abbrev)
                      ? `${names.get(abbrev)} (${abbrev})`
                      : abbrev,
            seats,
            colour: colours.get(abbrev) ?? fallback(abbrev),
        }),
    );
    rows.sort((a, b) => b.seats - a.seats || a.key.localeCompare(b.key));
    const named = rows.filter((r) => r.colour !== OTHER);
    const other = rows
        .filter((r) => r.colour === OTHER)
        .reduce((n, r) => n + r.seats, 0);
    return other > 0
        ? [
              ...named,
              {
                  key: 'other',
                  label: 'Other parties',
                  seats: other,
                  colour: OTHER,
              },
          ]
        : named;
}

/**
 * Which hemicycle group to emphasise for a picked party in one chamber: the party's own group, or
 * the merged "other" group when the party holds seats there but has no colour of its own. A party
 * with no seats in the chamber highlights nothing.
 */
export function chamberHighlight(
    groups: { key: string }[],
    chamberSeats: Record<string, number>,
    party: string | undefined,
): string | undefined {
    if (!party) return undefined;
    if (groups.some((g) => g.key === party)) return party;
    if ((chamberSeats[party] ?? 0) > 0)
        return groups.find((g) => g.key === 'other')?.key;
    return undefined;
}
