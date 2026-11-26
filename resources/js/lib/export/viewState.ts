// "Share this view": a snapshot of what the map shows (seat colouring, highlighted parties,
// focused unit, surroundings, theme) and everything the card, the caption and the deep link say
// about it. The rows come from the on-screen legend (buildLegend), so the numbers match it.
//
// Only party (seat) views exist today. A numeric view (registered voters, census) joins the
// `ViewState` union later with its own `kind`; the card and caption switch on `kind`.
import { SEAT_LABEL, buildLegend, shareOf } from '@/lib/legend';
import { type SeatKey, SEAT_LEVEL } from '@/lib/map/colouring';
import type { FocusSelection } from '@/lib/map/focus';
import { OTHER, THEMES, type ThemeName } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import {
    INDEPENDENT,
    type SeatsData,
    legendScope,
    legendTitle,
    hasOwnColour,
    partyColours,
    seatLegend,
    withIndependentColour,
} from '@/lib/seats';
import { SEAT_TITLE } from '@/lib/search';
import type { Level, UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import { type SeatMix, seatMix } from './seatMix';

export const SEAT_KEYS = Object.keys(SEAT_LABEL) as SeatKey[];

export interface ViewRow {
    /** The legend row key: a party abbreviation or "other". */
    key: string;
    /** As drawn on the card: the legend row's label ("UDA", "Independent", "Other parties"). */
    label: string;
    /** The full name as the data spells it. */
    name: string;
    colour: string;
    count: number;
    /** Share of the seats in view, as the legend shows it ("36%", "<1%"). */
    share: string;
    highlighted: boolean;
    kind: 'party' | 'other';
    /** The parties the row stands for. */
    members: string[];
}

export interface PartyView {
    kind: 'party';
    seat: SeatKey;
    seatLabel: string;
    /** The focused unit, as on the map; null for all of Kenya. */
    focus:
        | (FocusSelection & {
              name: string;
              b: [number, number, number, number];
          })
        | null;
    /** The unit the counts cover (the focus, or the one seat above it); null for all of Kenya. */
    scope: { level: Level; code: number; name: string } | null;
    /** How many of the seat's units the counts cover ("1,450 wards"); null when not known. */
    units: { count: number; word: string } | null;
    /** The seat mix bar and the rows inside the focused unit. */
    mix: SeatMix;
    /**
     * Set when the counts cover one seat (a Governor in a county, an MP in a constituency): the
     * card then shows who holds it instead of a bar, a callout and a chart.
     */
    single: SingleSeat | null;
    /** The highlighted party abbreviations, in the order they were picked. */
    only: string[];
    showSurroundings: boolean;
    theme: ThemeName;
    /** The legend heading without the highlight ("MCA seats across Kenya by party"). */
    title: string;
    rows: ViewRow[];
    total: number;
    /** What is highlighted, by display label with its count, for the headline and scope line. */
    highlights: {
        label: string;
        name: string;
        colour: string;
        count: number;
        share: string;
    }[];
    /** Every party in view with its count, largest first (for "the top party"). */
    parties: {
        label: string;
        name: string;
        colour: string;
        count: number;
        share: string;
    }[];
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    /** The same sources one by one, for text that has to stay short (the X caption). */
    sources: string[];
    sample: boolean;
    /** The deep link to this view: unit path plus `?seat=…&parties=…`. */
    path: string;
}

export interface SingleSeat {
    /** "Governor, Nairobi City" */
    title: string;
    holder: {
        /** Exactly as the data spells it. */
        name: string;
        /** "United Democratic Alliance (UDA)", or "Independent". */
        party: string;
        colour: string;
        /** "YYYY-MM-DD" */
        since: string | null;
        source: string;
    } | null;
}

export type ViewState = PartyView;

export interface SnapshotInput {
    seats: SeatsData;
    index: UnitIndex;
    seat: SeatKey;
    focus: FocusSelection | null;
    only: readonly string[];
    showSurroundings: boolean;
    theme: ThemeName;
    /** Set when the view shows sample records. */
    sample?: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const displayLabel = (abbrev: string) =>
    abbrev === INDEPENDENT ? 'Independent' : abbrev;

/** The deep link for a seat view: `/county/47?seat=mp`, `/?seat=mca&parties=uda,odm`. */
export function viewPath(
    seat: SeatKey,
    focus: FocusSelection | null,
    only: readonly string[],
    /**
     * The parties the "Other parties" row stands for and which of the chosen parties have no
     * colour of their own: with the whole row on, the link says `other` instead of listing them.
     */
    other: {
        members: readonly string[];
        uncoloured: (a: string) => boolean;
    } = {
        members: [],
        uncoloured: () => false,
    },
): string {
    const base = focus ? unitPath(focus.level, focus.code) : '/';
    const chosen = [...new Set(only)];
    const whole =
        other.members.length > 0 &&
        other.members.every((a) => chosen.includes(a));
    const tokens: string[] = [];
    for (const a of chosen) {
        if (whole && other.uncoloured(a)) {
            if (!tokens.includes('other')) tokens.push('other');
        } else tokens.push(a);
    }
    const parties = tokens.map((a) => encodeURIComponent(a.toLowerCase()));
    return `${base}?seat=${seat}${parties.length ? `&parties=${parties.join(',')}` : ''}`;
}

/** The seat and parties a shared link asks for; unknown values are dropped. */
export function parseViewQuery(
    search: string,
    seats: SeatsData,
): { seat: SeatKey | null; parties: string[] } {
    const q = new URLSearchParams(search);
    const raw = q.get('seat');
    const seat = SEAT_KEYS.includes(raw as SeatKey) ? (raw as SeatKey) : null;
    const known = new Map<string, string>();
    for (const p of seats.parties) known.set(p.abbrev.toLowerCase(), p.abbrev);
    for (const h of seats.holders)
        if (h.party) known.set(h.party.toLowerCase(), h.party);
    // `other` stands for every party holding this seat without a colour of its own.
    const uncoloured = seat
        ? seatLegend(seats, seat)
              .filter((r) => !hasOwnColour(r.abbrev, r.colour))
              .map((r) => r.abbrev)
        : [];
    const parties = (q.get('parties') ?? '').split(',').flatMap((a) => {
        const t = a.trim().toLowerCase();
        if (t === 'other') return uncoloured;
        const known_ = known.get(t);
        return known_ ? [known_] : [];
    });
    return { seat, parties: seat ? [...new Set(parties)] : [] };
}

export function snapshotView({
    seats,
    index,
    seat,
    focus,
    only,
    showSurroundings,
    theme,
    sample = false,
}: SnapshotInput): PartyView {
    const scope = legendScope(index, seat, focus);
    const legend = buildLegend(
        seats,
        seat,
        scope && { codes: scope.codes, unitName: scope.unit.n },
        only,
    );
    const perParty = seatLegend(seats, seat, scope?.codes);
    const countOf = new Map(perParty.map((r) => [r.abbrev, r.seats]));
    const total = legend.rows.reduce((n, r) => n + (r.count ?? 0), 0);
    const chosen = new Set(only);
    const names = new Map(perParty.map((r) => [r.abbrev, r.name]));

    // Exactly the legend's rows: the same parties, counts and shares, "Other parties" last.
    const rows: ViewRow[] = legend.rows.map((r) => {
        const members = legend.members[r.key] ?? [];
        const other = r.key === 'other';
        const count = r.count ?? 0;
        return {
            key: r.key,
            label: r.label,
            name: r.name ?? r.label,
            colour: r.colour,
            count,
            share: shareOf(count, total),
            highlighted:
                members.length > 0 && members.every((a) => chosen.has(a)),
            kind: other ? 'other' : 'party',
            members,
        };
    });

    const colourOf = (abbrev: string) =>
        rows.find((r) => r.key === abbrev)?.colour ?? OTHER;
    const party = (abbrev: string) => {
        const count = countOf.get(abbrev) ?? 0;
        return {
            label: displayLabel(abbrev),
            name:
                names.get(abbrev) ??
                seats.parties.find((p) => p.abbrev === abbrev)?.name ??
                abbrev,
            colour: colourOf(abbrev),
            count,
            share: shareOf(count, total),
        };
    };
    // Highlighted rows first (in the chart's order), then highlighted parties no row stands for.
    const onRows = rows.filter((r) => r.highlighted);
    const covered = new Set(onRows.flatMap((r) => r.members));
    const highlights = [
        ...onRows.map((r) =>
            r.kind === 'party'
                ? party(r.key)
                : {
                      label: r.label,
                      name: r.name,
                      colour: r.colour,
                      count: r.count,
                      share: r.share,
                  },
        ),
        ...[...chosen]
            .filter((a) => !covered.has(a))
            .map(party)
            .sort((a, b) => b.count - a.count),
    ];

    const focusUnit = focus ? index.get(focus.level, focus.code) : undefined;
    const single = singleSeat(seats, seat, scope);
    const holdersInView = seats.holders.filter(
        (h) =>
            h.seat === seat && h.party && (!scope || scope.codes.has(h.code)),
    );
    return {
        kind: 'party',
        seat,
        seatLabel: SEAT_LABEL[seat],
        focus:
            focus && focusUnit
                ? { ...focus, name: focusUnit.n, b: focusUnit.b }
                : null,
        scope: scope
            ? { level: scope.unit.l, code: scope.unit.c, name: scope.unit.n }
            : null,
        units: unitsInView(index, seat, scope?.codes),
        single,
        mix: seatMix(
            seats,
            seat,
            focus && focusUnit ? focus : null,
            index,
            only,
        ),
        only: [...new Set(only)],
        showSurroundings,
        theme,
        title: legendTitle(SEAT_LABEL[seat], scope?.unit.n),
        rows,
        total,
        highlights,
        parties: perParty.map((r) => party(r.abbrev)),
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(holdersInView.map((h) => h.source_url)),
        sources: sourceParts(holdersInView.map((h) => h.source_url)),
        sample,
        path: viewPath(seat, focus && focusUnit ? focus : null, only, {
            members: legend.members.other ?? [],
            uncoloured: (a) =>
                !hasOwnColour(a, partyColours(seats).get(a) ?? OTHER),
        }),
    };
}

/** The one seat the counts cover, with its holder (or none approved yet). */
function singleSeat(
    seats: SeatsData,
    seat: SeatKey,
    scope: ReturnType<typeof legendScope>,
): SingleSeat | null {
    if (!scope || scope.codes.size !== 1) return null;
    const [code] = [...scope.codes];
    const h = seats.holders.find(
        (x) =>
            x.seat === seat && x.level === SEAT_LEVEL[seat] && x.code === code,
    );
    const colours = partyColours(seats);
    const name = (abbrev: string) =>
        abbrev === INDEPENDENT
            ? 'Independent'
            : `${seats.parties.find((p) => p.abbrev === abbrev)?.name ?? abbrev} (${abbrev})`;
    return {
        title: `${SEAT_TITLE[seat]}, ${scope.unit.n}`,
        holder: h?.party
            ? {
                  name: h.name,
                  party: name(h.party),
                  colour: colours.get(h.party) ?? OTHER,
                  since: h.started_on || null,
                  source: sourceLine([h.source_url]),
              }
            : null,
    };
}

const UNIT_WORD = {
    county: 'counties',
    constituency: 'constituencies',
    ward: 'wards',
} as const;

/** The seat's units the view covers: those in the focus, or every one in Kenya. */
function unitsInView(
    index: UnitIndex,
    seat: SeatKey,
    codes: Set<number> | undefined,
): PartyView['units'] {
    const level = SEAT_LEVEL[seat];
    const count =
        codes?.size ?? index.all().filter((u) => u.l === level).length;
    return count > 1 ? { count, word: UNIT_WORD[level] } : null;
}

/** The seats data drawn in a theme (independents take that theme's colour). */
export const seatsInTheme = (seats: SeatsData, theme: ThemeName): SeatsData =>
    withIndependentColour(seats, THEMES[theme].independent);

/**
 * The same view in another theme: taken again from the same seats, filters and focus, so every
 * colour that depends on the theme follows it.
 */
export function withTheme(
    view: ViewState,
    theme: ThemeName,
    ctx: { seats: SeatsData; index: UnitIndex },
): ViewState {
    if (view.theme === theme) return view;
    return snapshotView({
        seats: seatsInTheme(ctx.seats, theme),
        index: ctx.index,
        seat: view.seat,
        focus: view.focus
            ? { level: view.focus.level, code: view.focus.code }
            : null,
        only: view.only,
        showSurroundings: view.showSurroundings,
        theme,
        sample: view.sample,
    });
}

const list = (items: string[]) =>
    items.length <= 1
        ? (items[0] ?? '')
        : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const LEVEL_SUFFIX: Record<Level, string> = {
    province: ' former province',
    county: ' County',
    constituency: ' constituency',
    ward: ' ward',
};

/**
 * Exactly what is counted ("1,450 wards across Kenya", "40 wards in Machakos County", "In
 * Mathare constituency" for a single seat), plus what is highlighted.
 */
export function scopeLineFor(view: ViewState): string {
    const place = view.scope
        ? `${view.scope.name}${LEVEL_SUFFIX[view.scope.level]}`
        : 'Kenya';
    const counted = view.units
        ? `${fmt(view.units.count)} ${view.units.word}`
        : '';
    const where = view.scope
        ? counted
            ? `${counted} in ${place}`
            : `In ${place}`
        : counted
          ? `${counted} across Kenya`
          : 'Across Kenya';
    const h = view.highlights;
    if (!h.length) return where;
    const what =
        h.length > 3 ? `${h.length} parties` : list(h.map((x) => x.label));
    return `${where}, highlighting ${what}`;
}

/**
 * The headline, from the numbers only: the highlighted parties with their counts, or the party
 * holding the most seats in view with the total. No adjectives, and never a two-way framing.
 */
export function headlineFor(view: ViewState): string {
    const where = view.scope ? `in ${view.scope.name}` : 'across Kenya';
    const prefix = `${view.seatLabel} seats ${where}`;
    if (view.total === 0) return `${prefix}: no approved data yet`;
    const h = view.highlights;
    if (h.length) {
        const named = h.slice(0, 3).map((x) => `${x.label} ${fmt(x.count)}`);
        const more = h.length - named.length;
        return `${prefix}: ${named.join(', ')}${more ? ` and ${more} more ${more === 1 ? 'party' : 'parties'}` : ''}`;
    }
    if (view.total === 1)
        return `${view.seatLabel} seat ${view.scope ? `in ${view.scope.name}` : 'in Kenya'}: ${view.parties[0]?.label ?? 'no approved data yet'}`;
    const top = view.parties[0];
    const tied = view.parties.filter((p) => p.count === top.count);
    if (tied.length > 1)
        return `${prefix}: ${list(tied.map((p) => p.label))}, ${fmt(top.count)} each of ${fmt(view.total)}`;
    return `${prefix}: ${top.label} ${fmt(top.count)} of ${fmt(view.total)}`;
}

/** The big-number callouts: up to two highlighted parties, or the two holding the most seats. */
export function calloutsFor(view: ViewState): ViewState['highlights'] {
    if (view.highlights.length) return view.highlights.slice(0, 2);
    return view.parties.slice(0, 2);
}
