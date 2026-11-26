// Current office holders and parties from /data/seats.json (imported from cited CSVs),
// turned into party colours, map colouring and per-unit seat rows.
import { type Colouring, type SeatKey, SEAT_LEVEL } from './map/colouring';
import { CATEGORICAL, OTHER } from './map/theme';

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
/** Palette size before "Other": Okabe-Ito minus black, which disappears on the dark theme. */
const PALETTE = CATEGORICAL.slice(0, 7);

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

/**
 * A display colour for every party. Admin colours win; the rest take the palette in order of
 * seats held, and everything after the palette (and independents) is grey "Other".
 */
export function partyColours(data: SeatsData): Map<string, string> {
    const byAbbrev = new Map(data.parties.map((p) => [p.abbrev, p]));
    const out = new Map<string, string>();
    const used = new Set(
        data.parties.map((p) => p.colour).filter(Boolean) as string[],
    );
    const free = PALETTE.filter((c) => !used.has(c));
    for (const { abbrev } of partyRanking(data)) {
        const admin = byAbbrev.get(abbrev)?.colour;
        if (admin) out.set(abbrev, admin);
        else if (abbrev !== INDEPENDENT && free.length)
            out.set(abbrev, free.shift()!);
        else out.set(abbrev, OTHER);
    }
    for (const p of data.parties)
        if (!out.has(p.abbrev)) out.set(p.abbrev, p.colour ?? OTHER);
    return out;
}

export const currentHolder = (data: SeatsData, seat: SeatKey, code: number) =>
    data.holders.find((h) => h.seat === seat && h.code === code);

/** Colour the seat's units by the holder's party; `only` limits colour to those parties (others go faded). */
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
        map.set(h.code, show ? (colours.get(h.party) ?? OTHER) : opts.faded);
    }
    return {
        mode: { kind: 'seat', seat },
        colours: map,
        fallback: opts.noData,
    };
}

/** Legend rows for a seat: parties holding it, largest first. */
export function seatLegend(
    data: SeatsData,
    seat: SeatKey,
): { abbrev: string; name: string; seats: number; colour: string }[] {
    const colours = partyColours(data);
    const names = new Map(data.parties.map((p) => [p.abbrev, p.name]));
    const counts = new Map<string, number>();
    for (const h of data.holders)
        if (h.seat === seat && h.party)
            counts.set(h.party, (counts.get(h.party) ?? 0) + 1);
    return [...counts.entries()]
        .map(([abbrev, seats]) => ({
            abbrev,
            name:
                abbrev === INDEPENDENT
                    ? 'Independent'
                    : (names.get(abbrev) ?? abbrev),
            seats,
            colour: colours.get(abbrev) ?? OTHER,
        }))
        .sort((a, b) => b.seats - a.seats || a.abbrev.localeCompare(b.abbrev));
}

/** Hemicycle groups for a chamber, largest party first, with "Other" merged at the end. */
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
            colour: colours.get(abbrev) ?? OTHER,
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
                  label: 'Other parties and independents',
                  seats: other,
                  colour: OTHER,
              },
          ]
        : named;
}
