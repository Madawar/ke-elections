// "Who represents this ward": the five people elected for one ward, as five ballot papers on
// three sheets (the county's three seats, the MP, the MCA), each sheet with a small map that
// shows where the seat is. It replaces the ward's "Leaders of <ward>" card; a county and a
// constituency keep theirs. The rows are `leadersFor(ward)` (lib/leaders.ts), regrouped by the
// level each seat is held at and drawn in ballot order, so the card, the panel and the legend
// strip cannot disagree; a seat with no approved holder keeps its place and says so. Names and
// parties are exactly as the data spells them, and every map is framed and marked by IEBC code.
import { type LeaderRow, basisLabel, leaderSources, leadersFor } from '@/lib/leaders';
import type { SeatKey } from '@/lib/map/colouring';
import type { ThemeName } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import { BALLOT_ORDER } from './numbersCard';

export type BallotPaperKey = 'county' | 'constituency' | 'ward';

export interface BallotRow {
    seat: SeatKey;
    /** "Governor", "Woman Rep", "MP", "MCA". */
    label: string;
    /** "Kakamega County", "Shinyalu constituency", "Isukha West ward". */
    place: string;
    /** The unit that holds the seat. */
    unit: { level: BallotPaperKey; code: number };
    /** Exactly as the data spells it; null when the seat has no approved holder. */
    name: string | null;
    /**
     * "ODM, Orange Democratic Movement" (abbreviation `ODM`), or "Independent" (no abbreviation);
     * null when the record names no party or there is no holder: no chip, no invented party.
     */
    party: { line: string; abbrev: string | null; colour: string } | null;
    /** "Elected in August 2022", "By-election in November 2025"; null with no holder. */
    since: string | null;
    sourceUrl: string | null;
}

export interface BallotMap {
    /** The unit the map shows: the county, or the constituency. */
    frame: {
        level: 'county' | 'constituency';
        code: number;
        name: string;
        b: [number, number, number, number];
    };
    /** The unit marked inside it in the ink colour. */
    mark: { level: 'constituency' | 'ward'; code: number };
}

export interface BallotPaper {
    key: BallotPaperKey;
    rows: BallotRow[];
    map: BallotMap;
}

export interface BallotsCardView {
    kind: 'ballots';
    theme: ThemeName;
    ward: { code: number; name: string };
    constituency: { code: number; name: string };
    county: { code: number; name: string };
    /** The county's three seats, the MP, the MCA. */
    papers: BallotPaper[];
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** `/ward/1046`. */
    path: string;
}

const PAPERS: BallotPaperKey[] = ['county', 'constituency', 'ward'];

const monthYear = (date: string): string | null => {
    const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime())
        ? null
        : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * "Elected in August 2022", "By-election in November 2025", "Succeeded in March 2024": the
 * panel's word for the basis (`basisLabel`), then the month the holder started. Just the word when
 * the record has no date.
 */
export function holderSince(h: { basis: string; startedOn: string }): string {
    const when = h.startedOn ? monthYear(h.startedOn) : null;
    return when ? `${basisLabel(h.basis)} in ${when}` : basisLabel(h.basis);
}

function rowOf(r: LeaderRow): BallotRow {
    const level = r.unit.level as BallotPaperKey;
    const place =
        level === 'county'
            ? `${r.unit.name} County`
            : `${r.unit.name} ${level === 'constituency' ? 'constituency' : 'ward'}`;
    const h = r.holder;
    let party: BallotRow['party'] = null;
    if (h?.party) {
        const independent = h.partyLabel === 'Independent';
        party = independent
            ? { line: 'Independent', abbrev: null, colour: h.colour }
            : {
                  line:
                      h.partyName && h.partyName !== h.partyLabel
                          ? `${h.partyLabel}, ${h.partyName}`
                          : h.partyLabel,
                  abbrev: h.partyLabel,
                  colour: h.colour,
              };
    }
    return {
        seat: r.seat as SeatKey,
        label: r.label,
        place,
        unit: { level, code: r.unit.code },
        name: h ? h.name : null,
        party,
        since: h ? holderSince(h) : null,
        sourceUrl: h ? h.sourceUrl : null,
    };
}

/** The ward card of a ward, by its IEBC code; null when the code is not a ward of the index. */
export function ballotsCardView({
    seats,
    index,
    ward,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    ward: number;
    theme: ThemeName;
    sample?: boolean;
}): BallotsCardView | null {
    const w = index.get('ward', ward);
    const constituency = w?.p != null ? index.get('constituency', w.p) : undefined;
    const county = constituency?.p != null ? index.get('county', constituency.p) : undefined;
    if (!w || !constituency || !county) return null;
    const leaders = leadersFor(w, seats, index);
    const byLevel = (level: BallotPaperKey) =>
        leaders
            .filter((r) => r.unit.level === level)
            .sort(
                (a, b) =>
                    BALLOT_ORDER.indexOf(a.seat as SeatKey) -
                    BALLOT_ORDER.indexOf(b.seat as SeatKey),
            )
            .map(rowOf);
    const maps: Record<BallotPaperKey, BallotMap> = {
        county: {
            frame: { level: 'county', code: county.c, name: county.n, b: county.b },
            mark: { level: 'ward', code: w.c },
        },
        constituency: {
            frame: { level: 'county', code: county.c, name: county.n, b: county.b },
            mark: { level: 'constituency', code: constituency.c },
        },
        ward: {
            frame: {
                level: 'constituency',
                code: constituency.c,
                name: constituency.n,
                b: constituency.b,
            },
            mark: { level: 'ward', code: w.c },
        },
    };
    const papers = PAPERS.map((key) => ({ key, rows: byLevel(key), map: maps[key] }));
    const urls = leaderSources(leaders);
    return {
        kind: 'ballots',
        theme,
        ward: { code: w.c, name: w.n },
        constituency: { code: constituency.c, name: constituency.n },
        county: { code: county.c, name: county.n },
        papers,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: unitPath('ward', w.c),
    };
}

/** "Who represents Isukha West ward". */
export const ballotsHeadline = (card: Pick<BallotsCardView, 'ward'>): string =>
    `Who represents ${card.ward.name} ward`;

/** The line under the headline, longest first; the layout takes the first that fits its line. */
export const ballotsScopeLines = (
    card: Pick<BallotsCardView, 'ward' | 'constituency' | 'county'>,
): string[] => [
    `${card.ward.name} ward is in ${card.constituency.name} constituency, ${card.county.name} County`,
    `In ${card.constituency.name} constituency, ${card.county.name} County`,
    `In ${card.county.name} County`,
];

/** Every seat of the card in ballot order. */
export const ballotRows = (card: Pick<BallotsCardView, 'papers'>): BallotRow[] =>
    card.papers.flatMap((p) => p.rows);
