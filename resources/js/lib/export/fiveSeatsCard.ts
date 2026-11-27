// "Kenya, five ways": the same map of Kenya five times, once per elected seat in ballot order,
// each coloured by party as the seat view colours it, with one shared key. The key's counts are
// the legend's for each seat across Kenya (buildLegend), added up over the five, so the card, the
// legend and the panel cannot disagree. Every colour the five maps draw is named in the key, and
// nothing that no map draws: parties with a colour of their own, independents, "Other parties"
// and, when a seat has no approved holder, the no-data colour.
import { SEAT_LABEL, buildLegend } from '@/lib/legend';
import { SEAT_LEVEL, type SeatKey } from '@/lib/map/colouring';
import { OTHER, THEMES, type ThemeName } from '@/lib/map/theme';
import { INDEPENDENT, type SeatsData, seatSources } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import { BALLOT_ORDER, type NumbersRow, numbersCardView } from './numbersCard';
import { type ViewMapSpec, foldParties } from './viewMap';

export const FIVE_SEATS_HEADLINE = 'Kenya’s five elected seats, by party';
export const FIVE_SEATS_KEY_TITLE = 'Party colours';
export const FIVE_SEATS_KEY_NOTE =
    'Parties in order of seats held across all five';
/**
 * The most party entries the key lists: the parties with a colour of its own, the independents and
 * "Other parties". "No approved holder yet", when a seat has none, is one more line, not counted
 * here. Past it, the parties with the fewest seats are drawn as "Other parties", on the maps and in
 * the key, and the key says how many. The layout puts "Other parties" and "No approved holder yet"
 * on lines of their own under the columns when the columns need it.
 */
export const KEY_MAX = 14;

export interface FiveSeatsMap {
    seat: SeatKey;
    /** "Governors", "Woman Reps". */
    label: string;
    /** How many such seats there are, from the unit index. */
    seats: number;
}

export interface FiveSeatsKeyEntry {
    /** A party abbreviation, IND, "other" or "none" (no approved holder). */
    key: string;
    /** "UDA", "Independent", "Other parties", "No approved holder yet". */
    label: string;
    colour: string;
    /** Seats held across all five. */
    count: number;
}

export interface FiveSeatsCardView {
    kind: 'fiveSeats';
    theme: ThemeName;
    maps: FiveSeatsMap[];
    key: FiveSeatsKeyEntry[];
    /** Parties with a colour of their own that the key folds into "Other parties". */
    folded: string[];
    /** Seats with no approved holder, across the five. */
    vacant: number;
    counties: number;
    wards: number;
    /** The five seats' rows of "By the numbers", for the caption. */
    rows: NumbersRow[];
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The national map. */
    path: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

/** Each seat's legend across Kenya: its own-colour rows and "Other parties". */
const legends = (seats: SeatsData) =>
    BALLOT_ORDER.map((seat) => buildLegend(seats, seat, null, []).rows);

/** The groups with a colour of their own on any map, by seats held across all five, ties by abbreviation. */
function groups(seats: SeatsData) {
    const rows = legends(seats).flat();
    const totals = new Map<string, { colour: string; count: number }>();
    let other = 0;
    for (const r of rows) {
        if (r.key === 'other') {
            other += r.count ?? 0;
            continue;
        }
        const t = totals.get(r.key) ?? { colour: r.colour, count: 0 };
        t.count += r.count ?? 0;
        totals.set(r.key, t);
    }
    const ranked = [...totals.entries()]
        .map(([key, t]) => ({ key, ...t }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return { ranked, other };
}

export function fiveSeatsCardView({
    seats,
    index,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    theme: ThemeName;
    sample?: boolean;
}): FiveSeatsCardView {
    const count = (level: string) => index.all().filter((u) => u.l === level).length;
    // Past KEY_MAX entries the parties with the fewest seats are folded (never the independents,
    // who are not a party), and the counts are taken again with them in "Other parties".
    let { ranked, other } = groups(seats);
    const folded: string[] = [];
    const entries = () => ranked.length + (other ? 1 : 0);
    if (entries() > KEY_MAX) {
        const foldable = ranked.filter((g) => g.key !== INDEPENDENT).reverse();
        while (ranked.length - folded.length + 1 > KEY_MAX && foldable.length)
            folded.push(foldable.shift()!.key);
        ({ ranked, other } = groups(foldParties(seats, folded)));
    }
    const maps = BALLOT_ORDER.map((seat) => ({
        seat,
        label: `${SEAT_LABEL[seat]}s`,
        seats: count(SEAT_LEVEL[seat]),
    }));
    // A seat with no approved holder: no holder of it with a party, as the legend counts them.
    const vacant = maps.reduce(
        (n, m) =>
            n +
            Math.max(
                0,
                m.seats -
                    new Set(
                        seats.holders
                            .filter((h) => h.seat === m.seat && h.party)
                            .map((h) => h.code),
                    ).size,
            ),
        0,
    );
    const urls = BALLOT_ORDER.flatMap((seat) => seatSources(seats, seat));
    return {
        kind: 'fiveSeats',
        theme,
        maps,
        key: [
            ...ranked.map((g) => ({
                key: g.key,
                label: g.key === INDEPENDENT ? 'Independent' : g.key,
                colour: g.colour,
                count: g.count,
            })),
            ...(other
                ? [{ key: 'other', label: 'Other parties', colour: OTHER, count: other }]
                : []),
            ...(vacant
                ? [
                      {
                          key: 'none',
                          label: 'No approved holder yet',
                          colour: THEMES[theme].noData,
                          count: vacant,
                      },
                  ]
                : []),
        ],
        folded,
        vacant,
        counties: count('county'),
        wards: count('ward'),
        rows: numbersCardView({ seats, index, theme }).rows,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: '/',
    };
}

/** "Who holds each seat now, from 47 counties to 1,450 wards". */
export const fiveSeatsScope = (
    card: Pick<FiveSeatsCardView, 'counties' | 'wards'>,
): string =>
    `Who holds each seat now, from ${fmt(card.counties)} counties to ${fmt(card.wards)} wards`;

/** The line under the key, and how many parties it folded when it did. */
export const fiveSeatsKeyNote = (card: Pick<FiveSeatsCardView, 'folded'>): string =>
    card.folded.length
        ? `${FIVE_SEATS_KEY_NOTE}. The ${fmt(card.folded.length)} with the fewest are drawn as Other parties.`
        : FIVE_SEATS_KEY_NOTE;

/**
 * One map's spec: the seat, all of Kenya, nothing highlighted, as the seat view draws it, with the
 * key's folded parties in the Other grey. No ward lines: at this size the MCA map is its fills.
 */
export const fiveSeatsSpec = (
    card: Pick<FiveSeatsCardView, 'folded'>,
    seat: SeatKey,
): ViewMapSpec => ({
    seat,
    only: [],
    focus: null,
    showSurroundings: false,
    wardLines: false,
    ...(card.folded.length ? { fold: card.folded } : {}),
});
