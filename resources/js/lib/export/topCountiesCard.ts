// "Top 10 counties for a group": the counties where one group, a party or the independents, holds
// the most MP or MCA seats, as a ranked bar chart beside a map of Kenya. The group is always the
// person's own pick and the headline is a fixed template, so the card stays neutral. The counts
// are the legend's for each county (`topCounties` in lib/party.ts, through legendScope and
// seatLegend); ties go by IEBC county code and the card says so wherever a tie decided something.
import { SEAT_LABEL } from '@/lib/legend';
import type { Colouring } from '@/lib/map/colouring';
import { type MapTheme, OTHER, type ThemeName } from '@/lib/map/theme';
import { type RankedSeat, topCounties } from '@/lib/party';
import { INDEPENDENT, type SeatsData, partyColours } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import { viewPath } from './viewState';

/** How many counties the card lists. */
export const TOP_N = 10;

const SEAT_UNIT = { mp: 'constituency', mca: 'ward' } as const;
const UNIT_WORDS: Record<RankedSeat, [string, string]> = {
    mp: ['constituency', 'constituencies'],
    mca: ['ward', 'wards'],
};

export interface TopCountiesRow {
    /** 1, 2, 3, ... in the listed order (a tie keeps its own rank, ordered by county code). */
    rank: number;
    /** IEBC county code. */
    code: number;
    /** The county's name, exactly as the unit index spells it. */
    name: string;
    count: number;
    /** The county's seats of that kind (its wards, or its constituencies). */
    total: number;
    /** "of 40 wards", "of 6 constituencies". */
    of: string;
}

export interface TopCountiesCardView {
    kind: 'topCounties';
    theme: ThemeName;
    seat: RankedSeat;
    /** The party abbreviation, or IND. */
    group: string;
    /** "independents", "UDA". */
    groupLabel: string;
    /** The group's data colour, as the legend draws it. */
    colour: string;
    /** The group's seats of that kind across Kenya. */
    held: number;
    /** Every seat of that kind, from the unit index (1,450 MCAs, 290 MPs). */
    seats: number;
    /** Every county with any, before the cut. */
    counties: number;
    /** The listed counties, ten at most. */
    rows: TopCountiesRow[];
    /** Counties left out that have as many as the tenth. */
    tiedOut: number;
    /** A tie decided an order in the list or who is left out. */
    tieDecided: boolean;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The national map with the seat shown and the group highlighted. */
    path: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

export function topCountiesCardView({
    seats,
    index,
    seat,
    group,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    seat: RankedSeat;
    group: string;
    theme: ThemeName;
    sample?: boolean;
}): TopCountiesCardView {
    const all = topCounties(seats, index, { seat, group });
    const listed = all.slice(0, TOP_N);
    const last = listed.at(-1)?.count;
    const tiedOut = all.slice(TOP_N).filter((c) => c.count === last).length;
    const counts = listed.map((c) => c.count);
    const tieInside = counts.some((n, i) => i > 0 && n === counts[i - 1]);
    const [one, many] = UNIT_WORDS[seat];
    const held = seats.holders.filter(
        (h) => h.seat === seat && h.party === group,
    );
    // The holders behind the counts; with none, the seat's holders (the card says none hold it).
    const urls = (
        held.length
            ? held
            : seats.holders.filter((h) => h.seat === seat && h.party)
    ).map((h) => h.source_url);
    return {
        kind: 'topCounties',
        theme,
        seat,
        group,
        groupLabel: group === INDEPENDENT ? 'independents' : group,
        colour: partyColours(seats).get(group) ?? OTHER,
        held: held.length,
        seats: index.all().filter((u) => u.l === SEAT_UNIT[seat]).length,
        counties: all.length,
        rows: listed.map((c, i) => ({
            rank: i + 1,
            code: c.code,
            name: c.name,
            count: c.count,
            total: c.total,
            of: `of ${fmt(c.total)} ${c.total === 1 ? one : many}`,
        })),
        tiedOut,
        tieDecided: tieInside || tiedOut > 0,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: viewPath(seat, null, [group]),
    };
}

/** "Where independents hold the most MCA seats", "Where UDA holds the most MP seats". Fixed. */
export const topCountiesHeadline = (
    card: Pick<TopCountiesCardView, 'group' | 'groupLabel' | 'seat'>,
): string =>
    `Where ${card.groupLabel} ${card.group === INDEPENDENT ? 'hold' : 'holds'} the most ${SEAT_LABEL[card.seat]} seats`;

/**
 * The scope, in two sentences: how many the group holds across Kenya, then what the list is.
 * "114 of 1,450 MCAs nationally are independents." "The 10 counties with the most:" ("with any"
 * when the list holds every county the group has any in).
 */
export function topCountiesScope(
    card: Pick<
        TopCountiesCardView,
        'held' | 'seats' | 'seat' | 'group' | 'groupLabel' | 'rows' | 'counties'
    >,
): { lead: string; list: string } {
    const n = card.rows.length;
    const ind = card.group === INDEPENDENT;
    const who =
        card.held === 1
            ? `is ${ind ? 'an independent' : card.groupLabel}`
            : `are ${card.groupLabel}`;
    return {
        lead: `${fmt(card.held)} of ${fmt(card.seats)} ${SEAT_LABEL[card.seat]}s nationally ${who}.`,
        list:
            n === 0
                ? 'No county has any.'
                : n === 1
                  ? 'The one county with any:'
                  : // Every county with any is listed (ten or fewer): the list is not a cut.
                    card.counties <= n
                    ? `The ${n} counties with any:`
                    : `The ${n} counties with the most:`,
    };
}

/** The note under the rows: counties tied with the tenth, and that ties go by county code. */
export function topCountiesNote(
    card: Pick<TopCountiesCardView, 'tiedOut' | 'tieDecided' | 'rows'>,
): string {
    const lines: string[] = [];
    const last = card.rows.at(-1)?.count ?? 0;
    if (card.tiedOut === 1) lines.push(`One more county also has ${fmt(last)}.`);
    else if (card.tiedOut > 1)
        lines.push(`${fmt(card.tiedOut)} more counties also have ${fmt(last)}.`);
    if (card.tieDecided) lines.push('Ties are listed by IEBC county code.');
    return lines.join(' ');
}

/** "The 10 counties shaded", under the map. */
export function topCountiesMapCaption(card: Pick<TopCountiesCardView, 'rows'>): string {
    const n = card.rows.length;
    return n === 0
        ? 'No county shaded'
        : n === 1
          ? 'The one county shaded'
          : `The ${n} counties shaded`;
}

/**
 * The map's colouring: the listed counties, by IEBC code, flat in the group's data colour (the
 * bars' colour, so the map and the bars read as one thing); every other county in the no-data
 * colour. It colours county fills, so the map spec that carries it names a seat held at the county
 * (see `colouring` in lib/export/viewMap.ts).
 */
export function topCountiesColouring(
    card: Pick<TopCountiesCardView, 'rows' | 'colour'>,
    theme: MapTheme,
): Colouring {
    return {
        mode: { kind: 'seat', seat: 'governor' },
        colours: new Map(card.rows.map((r) => [r.code, card.colour])),
        fallback: theme.noData,
    };
}

/** One caption line per county: "1. Kitui: 9 of 40 wards". */
export const topCountiesRowLine = (r: TopCountiesRow): string =>
    `${r.rank}. ${r.name}: ${fmt(r.count)} ${r.of}`;
