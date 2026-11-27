// "Side by side": two counties on the same seat (MP or MCA), one half each, in IEBC code order
// whichever was in focus. Each half is the county's name, how many seats it has (from the unit
// index), the mix bar and key of that seat in that county (the legend's own rows: legendScope and
// buildLegend, so the card and the legend cannot disagree), the county's map on that seat, and the
// party of each of its three county seats (leadersFor). No names: only parties. The headline is a
// fixed template, so the card cannot be steered.
import { leadersFor } from '@/lib/leaders';
import { SEAT_LABEL, buildLegend } from '@/lib/legend';
import { SEAT_COLOURS, THEMES, type ThemeName } from '@/lib/map/theme';
import { type SeatsData, legendScope, seatSources } from '@/lib/seats';
import type { Unit, UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import type { ViewMapSpec } from './viewMap';
import { viewPath } from './viewState';

/** The seats a county has more than one of. */
export type VersusSeat = 'mp' | 'mca';

export const VERSUS_SCOPE = 'Maps are not to the same scale.';
/** "No approved data yet": a county seat with no approved holder, as the leaders strip says it. */
export const VERSUS_EMPTY = 'No approved data yet';
export const VERSUS_NONE = 'No approved holder yet';

/** The county seats each half names the party of, in ballot order. */
const COUNTY_SEATS = ['governor', 'senator', 'woman_rep'] as const;

export interface VersusKeyEntry {
    /** A party abbreviation, IND, "other" or "none" (no approved holder). */
    key: string;
    /** "ODM", "Independent", "Other parties", "No approved holder yet". */
    label: string;
    colour: string;
    count: number;
}

export interface VersusLeader {
    seat: (typeof COUNTY_SEATS)[number];
    /** "Governor", "Senator", "Woman Rep". */
    label: string;
    /** The seat's ballot colour, for its tick. */
    tick: string;
    /** The holder's party as a chip shows it; null for a seat with no approved holder. */
    party: { label: string; colour: string } | null;
}

export interface VersusHalf {
    /** IEBC county code. */
    code: number;
    /** Exactly as the unit index spells it. */
    name: string;
    /** "85 wards in 17 constituencies", "17 constituencies". */
    units: string;
    /** The seats counted: the county's wards (MCA) or constituencies (MP). */
    seats: number;
    /** The legend's rows for that seat in that county, then "No approved holder yet". */
    key: VersusKeyEntry[];
    leaders: VersusLeader[];
    /** What the map frames: the county. */
    focus: { level: 'county'; code: number; name: string; b: Unit['b'] };
}

export interface VersusCardView {
    kind: 'versus';
    theme: ThemeName;
    seat: VersusSeat;
    /** Lower IEBC code first. */
    halves: [VersusHalf, VersusHalf];
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The national map on that seat. */
    path: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many: string) =>
    `${fmt(n)} ${n === 1 ? one : many}`;

const countiesOf = (index: UnitIndex) =>
    index.all().filter((u) => u.l === 'county');

function half(
    seats: SeatsData,
    index: UnitIndex,
    seat: VersusSeat,
    code: number,
    theme: ThemeName,
): VersusHalf {
    const unit = index.get('county', code);
    if (!unit) throw new Error(`No county ${code}`);
    const scope = legendScope(index, seat, { level: 'county', code })!;
    const legend = buildLegend(
        seats,
        seat,
        { codes: scope.codes, unitName: scope.unit.n },
        [],
    );
    const held = new Set(
        seats.holders
            .filter((h) => h.seat === seat && h.party && scope.codes.has(h.code))
            .map((h) => h.code),
    ).size;
    const vacant = scope.codes.size - held;
    const constituencies = index.children('county', code).length;
    const leaders = leadersFor({ l: 'county', c: code }, seats, index);
    return {
        code,
        name: unit.n,
        units:
            seat === 'mca'
                ? `${plural(scope.codes.size, 'ward', 'wards')} in ${plural(constituencies, 'constituency', 'constituencies')}`
                : plural(constituencies, 'constituency', 'constituencies'),
        seats: scope.codes.size,
        key: [
            ...legend.rows.map((r) => ({
                key: r.key,
                label: r.label,
                colour: r.colour,
                count: r.count ?? 0,
            })),
            ...(vacant > 0
                ? [
                      {
                          key: 'none',
                          label: VERSUS_NONE,
                          colour: THEMES[theme].noData,
                          count: vacant,
                      },
                  ]
                : []),
        ],
        leaders: COUNTY_SEATS.map((s) => {
            const row = leaders.find((r) => r.seat === s);
            const h = row?.holder;
            return {
                seat: s,
                label: SEAT_LABEL[s],
                tick: SEAT_COLOURS[s],
                party: h?.party ? { label: h.partyLabel, colour: h.colour } : null,
            };
        }),
        focus: { level: 'county', code, name: unit.n, b: unit.b },
    };
}

export function versusCardView({
    seats,
    index,
    seat,
    counties,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    seat: VersusSeat;
    /** The county in focus and the one picked, in either order. */
    counties: [number, number];
    theme: ThemeName;
    sample?: boolean;
}): VersusCardView {
    const [a, b] = [...counties].sort((x, y) => x - y);
    const halves: [VersusHalf, VersusHalf] = [
        half(seats, index, seat, a, theme),
        half(seats, index, seat, b, theme),
    ];
    // Both counties' holders of that seat, and of the three county seats on the leaders line.
    const urls = halves.flatMap((h) => [
        ...seatSources(seats, seat, legendScope(index, seat, { level: 'county', code: h.code })!.codes),
        ...COUNTY_SEATS.flatMap((s) => seatSources(seats, s, new Set([h.code]))),
    ]);
    return {
        kind: 'versus',
        theme,
        seat,
        halves,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: viewPath(seat, null, []),
    };
}

/** "MCA seats: Mombasa and Nairobi City". A fixed template: it cannot be edited. */
export const versusHeadline = (card: Pick<VersusCardView, 'seat' | 'halves'>): string =>
    `${SEAT_LABEL[card.seat]} seats: ${card.halves[0].name} and ${card.halves[1].name}`;

/** A half's map: the county in focus on that seat, nothing highlighted, no MP outlines. */
export const versusSpec = (card: Pick<VersusCardView, 'seat'>, h: VersusHalf): ViewMapSpec => ({
    seat: card.seat,
    only: [],
    focus: h.focus,
    showSurroundings: false,
    outline: false,
});

/** The "Compare with" options: every other county by name, alphabetically; the value is its code. */
export function versusOptions(
    index: UnitIndex,
    focus: number,
): { value: string; label: string }[] {
    return countiesOf(index)
        .filter((u) => u.c !== focus)
        .sort((x, y) => x.n.localeCompare(y.n, 'en'))
        .map((u) => ({ value: String(u.c), label: u.n }));
}

/**
 * The county to compare with: the remembered pick while it is a county and not the one in focus,
 * else the county with the next IEBC code (after the last comes the first).
 */
export function versusDefault(
    index: UnitIndex,
    focus: number,
    remembered: number | null,
): number {
    const codes = countiesOf(index)
        .map((u) => u.c)
        .sort((x, y) => x - y);
    if (remembered !== null && remembered !== focus && codes.includes(remembered))
        return remembered;
    return codes.find((c) => c > focus) ?? codes[0];
}

/** Where a viewer's last "Compare with" pick is kept (in this browser only). */
export const VERSUS_PICK_KEY = 'km.versusWith';

/** The remembered pick, or null; storage may be missing or blocked. */
export function readVersusPick(): number | null {
    try {
        const raw = localStorage.getItem(VERSUS_PICK_KEY);
        const n = raw === null ? NaN : Number(raw);
        return Number.isInteger(n) ? n : null;
    } catch {
        return null;
    }
}

export function rememberVersusPick(code: string): void {
    try {
        localStorage.setItem(VERSUS_PICK_KEY, code);
    } catch {
        // No storage: the page works without it.
    }
}
