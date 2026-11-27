// "By the numbers": every elected seat below the President, in ballot order, with how many there
// are and who holds them now. A card with no map, so it reads at thumbnail size. Its counts are
// the legend's for each seat across Kenya (seatLegend and buildLegend), so the card, the legend
// and the panel cannot disagree; the number of seats comes from the unit index, and a seat with
// no approved holder is counted as such, never filled in.
import { SEAT_LABEL, buildLegend } from '@/lib/legend';
import { SEAT_LEVEL, type SeatKey } from '@/lib/map/colouring';
import { THEMES, type ThemeName } from '@/lib/map/theme';
import {
    INDEPENDENT,
    type SeatsData,
    seatLegend,
    seatSources,
} from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';

/** The five elected seats below the President, in ballot order. */
export const BALLOT_ORDER: readonly SeatKey[] = [
    'governor',
    'senator',
    'woman_rep',
    'mp',
    'mca',
];
/** How many groups a row names as holding the most. */
const MOST = 3;
const NOMINATED = ['nominated_mp', 'nominated_senator'];

export const NUMBERS_SCOPE = 'Who holds them now, seat by seat';

export interface NumbersGroup {
    /** The party abbreviation, or IND. */
    key: string;
    /** "UDA", "Independent". */
    label: string;
    colour: string;
    count: number;
}

export interface NumbersRow {
    seat: SeatKey;
    /** "Governors", "Woman Reps". */
    label: string;
    /** How many such seats there are. */
    seats: number;
    /** The groups holding the most, up to three, largest first (ties by abbreviation). */
    most: NumbersGroup[];
    /** The third place was tied with a group left out, so the abbreviation decided who is listed. */
    tieAtCut: boolean;
    /** The mix bar: the legend's rows in its order, then the seats with no approved holder. */
    parts: { key: string; colour: string; count: number }[];
    /** Seats with no approved holder. */
    vacant: number;
}

export interface NumbersCardView {
    kind: 'numbers';
    theme: ThemeName;
    /** Every elected seat below the President. */
    total: number;
    rows: NumbersRow[];
    /** Nominated MPs and senators in office. */
    nominated: number;
    /** ... of whom nominated MPs and nominated senators. */
    nominatedMps: number;
    nominatedSenators: number;
    /** Seats with no approved holder, across the five. */
    vacant: number;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The national map. */
    path: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

function row(
    seats: SeatsData,
    index: UnitIndex,
    seat: SeatKey,
    theme: ThemeName,
): NumbersRow {
    const level = SEAT_LEVEL[seat];
    const total = index.all().filter((u) => u.l === level).length;
    // Held: a holder with a party, as the legend counts them (an independent's party is IND), so
    // the bar, the groups and the note cannot disagree.
    const held = new Set(
        seats.holders
            .filter((h) => h.seat === seat && h.party)
            .map((h) => h.code),
    ).size;
    const vacant = Math.max(0, total - held);
    const ranked = seatLegend(seats, seat);
    const legend = buildLegend(seats, seat, null, []);
    return {
        seat,
        label: `${SEAT_LABEL[seat]}s`,
        seats: total,
        most: ranked.slice(0, MOST).map((r) => ({
            key: r.abbrev,
            label: r.abbrev === INDEPENDENT ? 'Independent' : r.abbrev,
            colour: r.colour,
            count: r.seats,
        })),
        tieAtCut:
            ranked.length > MOST &&
            ranked[MOST].seats === ranked[MOST - 1].seats,
        parts: [
            ...legend.rows.map((r) => ({
                key: r.key,
                colour: r.colour,
                count: r.count ?? 0,
            })),
            ...(vacant
                ? [{ key: 'none', colour: THEMES[theme].noData, count: vacant }]
                : []),
        ],
        vacant,
    };
}

export function numbersCardView({
    seats,
    index,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    theme: ThemeName;
    sample?: boolean;
}): NumbersCardView {
    const rows = BALLOT_ORDER.map((seat) => row(seats, index, seat, theme));
    const nominated = seats.holders.filter((h) => NOMINATED.includes(h.seat));
    // The holders behind every number on the card: the five seats, and the nominated members
    // the note counts.
    const urls = [
        ...BALLOT_ORDER.flatMap((seat) => seatSources(seats, seat)),
        ...nominated.map((h) => h.source_url),
    ];
    return {
        kind: 'numbers',
        theme,
        total: rows.reduce((n, r) => n + r.seats, 0),
        rows,
        nominated: nominated.length,
        nominatedMps: nominated.filter((h) => h.seat === 'nominated_mp').length,
        nominatedSenators: nominated.filter(
            (h) => h.seat === 'nominated_senator',
        ).length,
        vacant: rows.reduce((n, r) => n + r.vacant, 0),
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: '/',
    };
}

/** "1,881 elected seats below the President": the number, and nothing else. */
export const numbersHeadline = (card: Pick<NumbersCardView, 'total'>): string =>
    `${fmt(card.total)} elected seats below the President`;

/** "nominated MPs", "nominated senator", "nominated MPs and senators": what the data has. */
function nominatedWords(
    card: Pick<NumbersCardView, 'nominatedMps' | 'nominatedSenators'>,
    n: number,
): string {
    const s = n === 1 ? '' : 's';
    if (!card.nominatedSenators) return `nominated MP${s}`;
    if (!card.nominatedMps) return `nominated senator${s}`;
    return 'nominated MPs and senators';
}

/** The note under the rows: the sixth ballot, then what the data adds, in plain sentences. */
export function numbersNote(
    card: Pick<
        NumbersCardView,
        'nominated' | 'nominatedMps' | 'nominatedSenators' | 'vacant' | 'rows'
    >,
): string {
    const lines = ['The President is elected on a sixth ballot.'];
    if (card.nominated)
        lines.push(
            `Parliament also has ${fmt(card.nominated)} ${nominatedWords(card, card.nominated)} in office.`,
        );
    if (card.vacant)
        lines.push(
            card.vacant === 1
                ? '1 seat has no approved holder yet.'
                : `${fmt(card.vacant)} seats have no approved holder yet.`,
        );
    if (card.rows.some((r) => r.tieAtCut))
        lines.push('Ties are listed by party abbreviation.');
    return lines.join(' ');
}

/** "Governors: 47 seats. Most held: UDA 20, ODM 15, WDM-K 3." */
export const numbersRowLine = (r: NumbersRow): string =>
    `${r.label}: ${fmt(r.seats)} seats. ${
        r.most.length
            ? `Most held: ${r.most.map((m) => `${m.label} ${fmt(m.count)}`).join(', ')}.`
            : 'No approved holder yet.'
    }`;
