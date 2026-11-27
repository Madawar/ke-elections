// The leaders card: who represents a unit, as a social image in the same four sizes and the same
// look as "Share this view". It is a third kind of card (`kind: 'leaders'`) beside the seat view
// and the party card. A county's card is "County leaders in <county>": its map striped by its
// Governor, Senator and Woman Rep. A constituency's and a ward's are "Leaders of <unit>": the
// map coloured by MCA, then the MP (or the MCA, then the MP) and the county-wide three. Every
// row comes from leadersFor (lib/leaders.ts), in seat order, so the card, the panel and the
// legend strip cannot disagree; a seat with no holder says so and nothing is invented.
import {
    type LeaderRow,
    type McaSummary,
    leaderSources,
    leadersFor,
    mcaSummary,
} from '@/lib/leaders';
import { COUNTY_SEATS } from '@/lib/map/colouring';
import type { FocusSelection } from '@/lib/map/focus';
import type { MapLevel } from '@/lib/map/levels';
import type { ThemeName } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';

export interface LeadersCardView {
    kind: 'leaders';
    unit: { level: MapLevel; code: number; name: string };
    /** "Constituency in Nairobi City County": where the unit is. */
    place: string;
    /** In seat order: the unit's own seat first, then the seats held above it. */
    rows: LeaderRow[];
    /** A constituency's MCAs by party, "of N wards"; null for a county or a ward. */
    mcas: McaSummary | null;
    theme: ThemeName;
    // What the map image reads (viewMap.ts): a county is striped by its three seats; a
    // constituency and a ward are coloured by MCA. Nothing is highlighted.
    seat: 'mca';
    stripes: boolean;
    /** A constituency's map is outlined in its MP's party colour, over its wards. */
    outline: boolean;
    only: string[];
    focus: FocusSelection & {
        name: string;
        b: [number, number, number, number];
    };
    showSurroundings: false;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The deep link: the unit, with the view its map shows. */
    path: string;
}

/** A county's Governor, Senator and Woman Rep, in that order, each with its source. */
export const countyLeaders = (
    seats: SeatsData,
    index: UnitIndex,
    countyCode: number,
): LeaderRow[] => leadersFor({ l: 'county', c: countyCode }, seats, index);

const LEVEL_WORD: Record<MapLevel, string> = {
    county: 'County',
    constituency: 'Constituency',
    ward: 'Ward',
};

/** The leaders card of a unit; null for a unit the directory does not have. */
export function leadersCardView({
    seats,
    index,
    focus,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    focus: FocusSelection;
    theme: ThemeName;
    sample?: boolean;
}): LeadersCardView | null {
    const unit = index.get(focus.level, focus.code);
    if (!unit) return null;
    const rows = leadersFor(unit, seats, index);
    const mcas = mcaSummary(unit, seats, index);
    const above = index
        .ancestors(focus.level, focus.code)
        .filter((a) => a.l !== 'province');
    const county = above.find((a) => a.l === 'county');
    const constituency = above.find((a) => a.l === 'constituency');
    const place =
        focus.level === 'county'
            ? 'County'
            : `${LEVEL_WORD[focus.level]} in ${[
                  constituency && `${constituency.n} constituency`,
                  county && `${county.n} County`,
              ]
                  .filter(Boolean)
                  .join(', ')}`;
    // The wards' MCAs are on a constituency's card too (its map and its mix bar).
    const urls = [
        ...leaderSources(rows),
        ...(mcas ? leaderSources(mcas.rows) : []),
    ];
    const stripes = focus.level === 'county';
    return {
        kind: 'leaders',
        unit: { level: focus.level, code: focus.code, name: unit.n },
        place,
        rows,
        mcas,
        theme,
        seat: 'mca',
        stripes,
        outline: focus.level === 'constituency',
        only: [],
        focus: { ...focus, name: unit.n, b: unit.b },
        showSurroundings: false,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: `${unitPath(focus.level, focus.code)}?seat=${stripes ? COUNTY_SEATS : 'mca'}`,
    };
}

/** "County leaders in Nairobi City", "Leaders of Mathare": the subject, and nothing else. */
export const leadersHeadline = (
    card: Pick<LeadersCardView, 'unit'>,
): string =>
    card.unit.level === 'county'
        ? `County leaders in ${card.unit.name}`
        : `Leaders of ${card.unit.name}`;

/**
 * The line under the headline, longest first: what the map shows for a county (its stripes),
 * where a constituency or a ward is. The layout takes the first that fits its line, so the line
 * is never cut.
 */
export function leadersScopeLines(
    card: Pick<LeadersCardView, 'unit' | 'place' | 'stripes'>,
): string[] {
    if (card.stripes)
        return [
            'Striped by the parties of its Governor, Senator and Woman Rep',
            'Governor, Senator and Woman Rep',
            'County',
        ];
    // "Ward in Mathare constituency, Nairobi City County", then without the constituency.
    const short = card.place.replace(/ in .*, /, ' in ');
    return [...new Set([card.place, short, card.place.split(' ')[0]])];
}

/** The line as written when there is room for all of it. */
export const leadersScopeLine = (
    card: Pick<LeadersCardView, 'unit' | 'place' | 'stripes'>,
): string => leadersScopeLines(card)[0];

/** "MCAs in 6 wards: ODM 3, UDA 3", from the same counts as the panel's summary. */
export function mcaMixLabel(card: Pick<LeadersCardView, 'mcas'>): string {
    const m = card.mcas;
    if (!m) return '';
    const parts = m.parties.map((p) => `${p.label} ${p.count}`);
    if (m.held < m.wards) parts.push(`no approved data yet ${m.wards - m.held}`);
    return `MCAs in ${m.wards} ${m.wards === 1 ? 'ward' : 'wards'}${parts.length ? `: ${parts.join(', ')}` : ''}`;
}
