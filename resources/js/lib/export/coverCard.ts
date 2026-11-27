// The cover of the county carousel: the county's name, "Who holds Kakamega’s 75 elected seats",
// the seats spelled out ("1 governor, 1 senator, 1 woman rep, 12 MPs and 60 MCAs. Swipe for
// each."), and the county's wards coloured by the MCA's party. The numbers are counted from the
// unit index by IEBC code (3 county seats, one MP per constituency, one MCA per ward), so they do
// not depend on who holds the seats; the map is the MCA seat as the seat view draws it, nothing
// highlighted. No names: the slides after it carry the holders.
import { buildLegend } from '@/lib/legend';
import type { ThemeName } from '@/lib/map/theme';
import { unitPath } from '@/lib/map/urls';
import { type SeatsData, legendScope, seatSources } from '@/lib/seats';
import type { Unit, UnitIndex } from '@/lib/units';
import { sourceLine, sourceParts } from './format';
import type { ViewMapSpec } from './viewMap';

/** Under the cover's map. */
export const COVER_NOTE = 'Wards coloured by the MCA’s party';

export interface CoverCardView {
    kind: 'cover';
    theme: ThemeName;
    county: { code: number; name: string };
    /** From the unit index: its constituencies, its wards, and 3 + both. */
    counts: { constituencies: number; wards: number; total: number };
    /** The legend's MCA rows for the county (for the caption: the map shows them). */
    mcas: { label: string; count: number }[];
    // What the map image reads (viewMap.ts): the county on the MCA seat, nothing highlighted.
    seat: 'mca';
    only: string[];
    focus: { level: 'county'; code: number; name: string; b: Unit['b'] };
    showSurroundings: false;
    outline: false;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** The county's page. */
    path: string;
}

export function coverCardView({
    seats,
    index,
    county,
    theme,
    sample = false,
}: {
    seats: SeatsData;
    index: UnitIndex;
    county: number;
    theme: ThemeName;
    sample?: boolean;
}): CoverCardView | null {
    const unit = index.get('county', county);
    if (!unit || unit.l !== 'county') return null;
    const constituencies = index.children('county', county);
    const wards = constituencies.flatMap((k) => index.children('constituency', k.c));
    const scope = legendScope(index, 'mca', { level: 'county', code: county });
    const codes = scope?.codes ?? new Set(wards.map((w) => w.c));
    const legend = buildLegend(seats, 'mca', { codes, unitName: unit.n }, []);
    // The map draws the county's MCAs; the counts come from the unit index and name no holder.
    const urls = seatSources(seats, 'mca', codes);
    return {
        kind: 'cover',
        theme,
        county: { code: county, name: unit.n },
        counts: {
            constituencies: constituencies.length,
            wards: wards.length,
            total: 3 + constituencies.length + wards.length,
        },
        mcas: legend.rows.map((r) => ({ label: r.label, count: r.count ?? 0 })),
        seat: 'mca',
        only: [],
        focus: { level: 'county', code: county, name: unit.n, b: unit.b },
        showSurroundings: false,
        outline: false,
        asOf: seats.data_as_of ?? seats.as_of ?? null,
        source: sourceLine(urls),
        sources: sourceParts(urls),
        sample,
        path: unitPath('county', county),
    };
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const count = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

/** "Who holds Kakamega’s 75 elected seats": every name takes "’s", whatever its last letter. */
export const coverHeadline = (card: Pick<CoverCardView, 'county' | 'counts'>): string =>
    `Who holds ${card.county.name}’s ${fmt(card.counts.total)} elected seats`;

/** "Kakamega County", above the headline. */
export const coverKicker = (card: Pick<CoverCardView, 'county'>): string =>
    `${card.county.name} County`;

/** "1 governor, 1 senator, 1 woman rep, 12 MPs and 60 MCAs. Swipe for each." */
export const coverScope = (card: Pick<CoverCardView, 'counts'>): string =>
    `1 governor, 1 senator, 1 woman rep, ${count(card.counts.constituencies, 'MP', 'MPs')} and ${count(card.counts.wards, 'MCA', 'MCAs')}. Swipe for each.`;

/** The cover's map: the county on the MCA seat, nothing highlighted, no MP outlines. */
export const coverSpec = (card: CoverCardView): ViewMapSpec => ({
    seat: 'mca',
    only: [],
    focus: card.focus,
    showSurroundings: false,
    outline: false,
});
