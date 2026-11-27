// Who represents a unit: the holders of every elective seat that covers it, in a fixed order by
// seat (the unit's own seat first, then the seats held above it), never by party. The panel's
// "Who represents" section, the legend's "Leaders here" strip and the leaders rows on the cards
// are all built from `leadersFor`, so they cannot disagree. Everything joins on IEBC codes.
import { SEAT_LABEL } from './legend';
import { type ColourKey, type SeatKey, SEAT_LEVEL } from './map/colouring';
import type { MapLevel } from './map/levels';
import { OTHER, SEAT_COLOURS } from './map/theme';
import {
    type Holder,
    INDEPENDENT,
    type SeatsData,
    legendScope,
    partyColours,
} from './seats';
import { type Unit, type UnitIndex, seatsFor } from './units';

/** National seats are not in the data yet; their rows appear once a validated import adds them. */
export type LeaderSeat = SeatKey | 'president' | 'deputy_president';

export interface LeaderHolder {
    /** Exactly as the data spells it. */
    name: string;
    /** The party's abbreviation; null when the record names none. */
    party: string | null;
    /** As shown on a chip: the abbreviation, or "Independent". */
    partyLabel: string;
    /** The party's full name as the data spells it. */
    partyName: string;
    colour: string;
    basis: string;
    /** "YYYY-MM-DD" */
    startedOn: string;
    sourceUrl: string;
}

export interface LeaderRow {
    seat: LeaderSeat;
    /** The short seat name: "Governor", "Woman Rep", "MP", "MCA". */
    label: string;
    /** The seat's full title: "Member of the National Assembly". */
    title: string;
    /** The unit that holds the seat. */
    unit: { level: MapLevel; code: number; name: string };
    /** The level the seat is held at when that is above the unit asked about; null for its own. */
    above: 'county' | 'constituency' | null;
    /** Where a seat held above the unit is held: "Nairobi City, county-wide"; "" for its own. */
    where: string;
    /** Null when the seat has no approved holder: nothing is invented. */
    holder: LeaderHolder | null;
}

/** How a holder came to the seat, as the panel and the cards say it: "Elected", "By-election", "Succeeded". */
export const basisLabel = (basis: string): string =>
    basis === 'by_election'
        ? 'By-election'
        : basis === 'succession'
          ? 'Succeeded'
          : 'Elected';

/** The seat's ballot colour; the Deputy President is elected on the President's ballot. */
export const leaderColour = (seat: LeaderSeat): string =>
    SEAT_COLOURS[seat === 'deputy_president' ? 'president' : seat];

/** Seat order, coarsest last: a unit's own seat leads, then the seats above it. */
const BY_LEVEL: Record<MapLevel, SeatKey[]> = {
    ward: ['mca'],
    constituency: ['mp'],
    county: ['governor', 'senator', 'woman_rep'],
};
const NATIONAL: { seat: LeaderSeat; label: string }[] = [
    { seat: 'president', label: 'President' },
    { seat: 'deputy_president', label: 'Deputy President' },
];
const TITLE = Object.fromEntries(
    (['county', 'constituency', 'ward'] as const).flatMap((level) =>
        seatsFor(level).map((s) => [s.key, s.label]),
    ),
) as Record<SeatKey, string>;

const isMapLevel = (l: Unit['l']): l is MapLevel => l !== 'province';

function holderOf(
    seats: SeatsData,
    colours: Map<string, string>,
    names: Map<string, string>,
    h: Holder | undefined,
): LeaderHolder | null {
    if (!h) return null;
    const independent = h.party === INDEPENDENT;
    return {
        name: h.name,
        party: h.party,
        partyLabel: independent ? 'Independent' : (h.party ?? ''),
        partyName: independent
            ? 'Independent'
            : ((h.party && names.get(h.party)) ?? h.party ?? ''),
        colour: (h.party && colours.get(h.party)) || OTHER,
        basis: h.basis,
        startedOn: h.started_on,
        sourceUrl: h.source_url,
    };
}

/**
 * The leaders of a unit, in seat order: a ward's MCA, its constituency's MP, then the county's
 * Governor, Senator and Woman Rep; a constituency starts at its MP and a county at its Governor.
 * For Kenya (null) the rows are the President and Deputy President, and only once the data has
 * them: there are none today, so the list is empty. `omit` leaves seats out.
 */
export function leadersFor(
    unit: Pick<Unit, 'l' | 'c'> | null,
    seats: SeatsData,
    index: UnitIndex,
    { omit = [] }: { omit?: readonly LeaderSeat[] } = {},
): LeaderRow[] {
    const colours = partyColours(seats);
    const names = new Map(seats.parties.map((p) => [p.abbrev, p.name]));
    const find = (seat: string, level: string, code?: number) =>
        seats.holders.find(
            (h) =>
                (h.seat as string) === seat &&
                h.level === level &&
                (code === undefined || h.code === code),
        );
    if (!unit) {
        const rows: LeaderRow[] = [];
        for (const { seat, label } of NATIONAL) {
            const h = find(seat, 'national');
            if (!h || omit.includes(seat)) continue;
            rows.push({
                seat,
                label,
                title: label,
                // National seats belong to no unit; the county level stands in for "Kenya".
                unit: { level: 'county', code: 0, name: 'Kenya' },
                above: null,
                where: '',
                holder: holderOf(seats, colours, names, h),
            });
        }
        return rows;
    }
    if (!isMapLevel(unit.l)) return [];
    const self = index.get(unit.l, unit.c);
    if (!self) return [];
    const chain = [self, ...index.ancestors(unit.l, unit.c)].filter(
        (u): u is Unit & { l: MapLevel } => isMapLevel(u.l),
    );
    return chain.flatMap((u) =>
        BY_LEVEL[u.l]
            .filter((seat) => !omit.includes(seat))
            .map((seat): LeaderRow => {
                const above = u.l === unit.l ? null : u.l;
                return {
                    seat,
                    label: SEAT_LABEL[seat],
                    title: TITLE[seat],
                    unit: { level: u.l, code: u.c, name: u.n },
                    above: above as LeaderRow['above'],
                    where:
                        above === 'county'
                            ? `${u.n}, county-wide`
                            : above === 'constituency'
                              ? `${u.n} constituency`
                              : '',
                    holder: holderOf(
                        seats,
                        colours,
                        names,
                        find(seat, u.l, u.c),
                    ),
                };
            }),
    );
}

/**
 * The seat the legend is already counting, when its counts cover exactly one holder (a Governor
 * while a county is focused): the legend's "Leaders here" strip leaves that row out.
 */
export function legendOmits(
    index: UnitIndex,
    mode: ColourKey | string,
    focus: { level: MapLevel; code: number } | null,
): LeaderSeat[] {
    if (!(mode in SEAT_LEVEL)) return [];
    const seat = mode as SeatKey;
    return legendScope(index, seat, focus)?.codes.size === 1 ? [seat] : [];
}

export interface McaSummary {
    /** How many wards the constituency has. */
    wards: number;
    /** How many of them have an approved MCA. */
    held: number;
    /** Largest first, ties by abbreviation: by count or by code, never by preference. */
    parties: { key: string; label: string; colour: string; count: number }[];
    /** "MCAs (6): ODM 3, UDA 3" */
    text: string;
    /** Every ward in code order, with its MCA (or none approved yet). */
    rows: LeaderRow[];
}

/** A constituency's MCAs: the party counts in one line, and the wards behind them. */
export function mcaSummary(
    unit: Pick<Unit, 'l' | 'c'>,
    seats: SeatsData,
    index: UnitIndex,
): McaSummary | null {
    if (unit.l !== 'constituency') return null;
    const wards = [...index.children('constituency', unit.c)].sort(
        (a, b) => a.c - b.c,
    );
    const rows = wards.map((w) => leadersFor(w, seats, index)[0]);
    const counts = new Map<
        string,
        { key: string; label: string; colour: string; count: number }
    >();
    for (const { holder } of rows) {
        if (!holder) continue;
        const key = holder.party ?? '';
        const row = counts.get(key) ?? {
            key,
            label: holder.partyLabel || 'No party named',
            colour: holder.colour,
            count: 0,
        };
        row.count++;
        counts.set(key, row);
    }
    const parties = [...counts.values()].sort(
        (a, b) => b.count - a.count || a.key.localeCompare(b.key),
    );
    const held = rows.filter((r) => r.holder).length;
    const parts = parties.map((p) => `${p.label} ${p.count}`);
    if (held < wards.length)
        parts.push(`no approved data yet ${wards.length - held}`);
    return {
        wards: wards.length,
        held,
        parties,
        text: `MCAs (${wards.length})${parts.length ? `: ${parts.join(', ')}` : ''}`,
        rows,
    };
}

/** The source links behind the rows, for a card's source line. */
export const leaderSources = (rows: LeaderRow[]): string[] =>
    rows.flatMap((r) => (r.holder ? [r.holder.sourceUrl] : []));
