// The party card: a party's seats across Kenya as a social image, in the same four sizes and the
// same look as "Share this view". It is a second kind of card (`kind: 'partyCard'`) next to the
// seat view (`kind: 'party'` in viewState.ts); the numbers are the party profile's, so the card,
// the profile and the legend always agree.
import {
    type PartyProfile,
    type PartyScope,
    type TopCounty,
    partyProfile,
} from '@/lib/party';
import type { ThemeName } from '@/lib/map/theme';
import type { SeatsData } from '@/lib/seats';
import type { UnitIndex } from '@/lib/units';

export interface PartyCardRow {
    /** The seat: "governor", "nominated_mp", ... */
    key: string;
    /** "Governors", "Nominated MPs". */
    label: string;
    count: number;
    total: number;
    share: string;
    /** "20 of 47 (43%)", "5 of 17 constituencies (29%)", or "Held" for a seat that is one unit's. */
    value: string;
    single: boolean;
    /** A nominated seat: its value is a count only, with no bar. */
    nominated: boolean;
}

export interface PartyCardView {
    kind: 'partyCard';
    abbrev: string;
    name: string;
    /** The party's data colour: the bars and the map's highlight. */
    colour: string;
    theme: ThemeName;
    rows: PartyCardRow[];
    /** Across Kenya: the counties where it holds the most MCA seats. Empty inside a county. */
    top: TopCounty[];
    hasSeats: boolean;
    /** What the card covers: a county or a constituency; null for all of Kenya. */
    scope: { level: 'county' | 'constituency'; code: number; name: string } | null;
    // What the map image reads (viewMap.ts): MCA seats, only this party's highlighted, and the
    // scope as its focus (a county map with the party's wards highlighted), else all of Kenya.
    seat: 'mca';
    only: string[];
    focus:
        | (NonNullable<PartyCardView['scope']> & {
              b: [number, number, number, number];
          })
        | null;
    showSurroundings: false;
    /** "YYYY-MM-DD": the date the data describes. */
    asOf: string | null;
    source: string;
    sources: string[];
    sample: boolean;
    /** `/party/uda`: where the card's link leads. */
    path: string;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

export function partyCardFromProfile(
    profile: PartyProfile,
    theme: ThemeName,
    sample = false,
    bounds?: [number, number, number, number],
): PartyCardView {
    return {
        kind: 'partyCard',
        abbrev: profile.abbrev,
        name: profile.name,
        colour: profile.colour,
        theme,
        rows: profile.rows.map((r) => ({
            key: r.seat,
            label: r.label,
            count: r.count,
            total: r.total,
            share: r.share,
            value: r.value,
            single: r.single,
            nominated: r.nominated,
        })),
        top: profile.topCounties,
        scope: profile.scope,
        hasSeats: profile.hasSeats,
        seat: 'mca',
        only: [profile.abbrev],
        focus: profile.scope && bounds ? { ...profile.scope, b: bounds } : null,
        showSurroundings: false,
        asOf: profile.asOf,
        source: profile.source,
        sources: profile.sources,
        sample,
        path: profile.path,
    };
}

/** The card for a party, from the seats data as drawn in `theme`; null for an unknown party. */
export function partyCardView({
    seats,
    abbrev,
    theme,
    sample = false,
    index,
    scope = null,
}: {
    seats: SeatsData;
    abbrev: string;
    theme: ThemeName;
    sample?: boolean;
    /** With the units, the card can cover a county or a constituency and list the top counties. */
    index?: UnitIndex;
    scope?: PartyScope;
}): PartyCardView | null {
    const profile = partyProfile(seats, abbrev, { index, scope });
    if (!profile) return null;
    const unit =
        profile.scope && index?.get(profile.scope.level, profile.scope.code);
    return partyCardFromProfile(profile, theme, sample, unit ? unit.b : undefined);
}

/** "UDA seats across Kenya", "UDA seats in Nairobi City": the numbers' subject and nothing else. */
export const partyHeadline = (
    card: Pick<PartyCardView, 'abbrev' | 'scope'>,
): string =>
    `${card.abbrev} seats ${card.scope ? `in ${card.scope.name}` : 'across Kenya'}`;

/** The heading over the top counties. */
export const TOP_COUNTIES_TITLE = 'Where it holds the most MCA seats';

export const partyScopeLine = (
    card: Pick<PartyCardView, 'name'>,
): string => `${card.name}, seats held now`;


/** The line under the card's map: what the highlighted wards are. The same for any scope. */
export const partyMapCaption = (card: Pick<PartyCardView, 'abbrev'>): string =>
    `Wards with a ${card.abbrev} MCA`;
