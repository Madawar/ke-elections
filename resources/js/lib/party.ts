// A party's profile: what the party holds now, seat by seat, with the registration facts we have
// and their sources. The counts come from the legend's own function (seatLegend, national) so a
// profile always agrees with the legend, the seating charts and the cards.
import { shareOf } from './legend';
import { sourceLine, sourceParts } from './export/format';
import type { SeatKey } from './map/colouring';
import type { FocusSelection } from './map/focus';
import { validSeatModes } from './map/seatMode';
import { type PartyScope, partyPath } from './map/urls';
import {
    INDEPENDENT,
    type Holder,
    type SeatsData,
    hasOwnColour,
    legendScope,
    partyColours,
    seatLegend,
} from './seats';
import type { UnitIndex } from './units';

export type { PartyScope };

export type PartySeat = Holder['seat'];

export interface PartySeatRow {
    seat: PartySeat;
    /** "Governors", "Nominated MPs". */
    label: string;
    count: number;
    /** All the holders of this seat in the data, whatever their party (the legend's total). */
    total: number;
    /** "43%", "<1%". */
    share: string;
    /** The seat to colour the map by; null for the nominated seats, which have no area. */
    mapSeat: SeatKey | null;
    /** The seat is one unit's (a governor in a county): the row says held or not held. */
    single: boolean;
    /**
     * A nominated seat: a count only. The Constitution fixes the number of nominated seats
     * (Art. 97(1)(c), 98(1)(b)-(d)) and the data's current holders are not that number, so there
     * is no "of N", no percentage and no bar to print.
     */
    nominated: boolean;
    /** The row as the panel and the card print it: "20 of 47 (43%)", "5 of 17 constituencies (29%)", "Held", "5". */
    value: string;
}

/** The place a profile's numbers cover; null is all of Kenya. */
export interface ProfileScope {
    level: 'county' | 'constituency';
    code: number;
    name: string;
}

export interface TopCounty {
    code: number;
    name: string;
    count: number;
    /** Wards in the county. */
    total: number;
    /** "85 of 85 wards" */
    value: string;
}

export interface PartyProfile {
    abbrev: string;
    name: string;
    /** The party's data colour: its own, or the neutral grey "Other". */
    colour: string;
    hasOwnColour: boolean;
    /**
     * The 2022 coalition (ORPP); null when the data has none (or only "none", which is unknown), or has no ORPP source for the party
     * (every number shows its source). The coalition has no source column of its own yet, so the
     * party's ORPP source stands for it until one is added.
     */
    coalition: string | null;
    /** Former abbreviations from renames, oldest first. */
    formerNames: { abbrev: string; effectiveOn: string | null }[];
    /** The ORPP registration and where it comes from; null when the data has neither. */
    registration: {
        status: string;
        sourceUrl: string | null;
        sourceName: string | null;
    } | null;
    /** What the numbers cover: a county or a constituency; null for all of Kenya. */
    scope: ProfileScope | null;
    /**
     * Governors, Senators, Woman Reps, MPs, MCAs, then nominated MPs and nominated Senators across
     * Kenya; inside a county the first five (one seat each for the first three); inside a
     * constituency the MP seat and its MCAs.
     */
    rows: PartySeatRow[];
    /** Across Kenya only: the counties where the party holds the most MCA seats. */
    topCounties: TopCounty[];
    /** The five elected seats together. */
    elected: { count: number; total: number; share: string };
    /** The party holds seats in the scope. */
    hasSeats: boolean;
    /** The party holds seats anywhere in Kenya (a scope may have none of them). */
    heldAnywhere: boolean;
    /** "YYYY-MM-DD": the date the seats data describes. */
    asOf: string | null;
    /** The sources of the seats, one by one and as one phrase. */
    sources: string[];
    source: string;
    /** `/party/uda`, or `/party/uda?in=county-47` for a scope. */
    path: string;
}

/**
 * The scope for a focus: the focused county or constituency itself, a ward's constituency (one
 * ward says little about a party), and all of Kenya for no focus.
 */
export function scopeFor(index: UnitIndex, focus: FocusSelection | null): PartyScope {
    if (!focus) return null;
    if (focus.level === 'county' || focus.level === 'constituency')
        return { level: focus.level, code: focus.code };
    const constituency = index
        .ancestors(focus.level, focus.code)
        .find((a) => a.l === 'constituency');
    return constituency ? { level: 'constituency', code: constituency.c } : null;
}

/**
 * The scopes the profile can switch between: Kenya, then the county and the constituency the focus
 * is in, plus the current scope when a link named one the focus is not in.
 */
export function scopeChoices(
    index: UnitIndex,
    focus: FocusSelection | null,
    current: PartyScope,
): { key: string; label: string; scope: PartyScope }[] {
    const choices: { key: string; label: string; scope: PartyScope }[] = [
        { key: 'kenya', label: 'Across Kenya', scope: null },
    ];
    const add = (scope: PartyScope) => {
        const unit = scope && index.get(scope.level, scope.code);
        const key = scope ? `${scope.level}-${scope.code}` : 'kenya';
        if (scope && unit && !choices.some((c) => c.key === key))
            choices.push({ key, label: `In ${unit.n}`, scope });
    };
    if (focus) {
        for (const a of [
            ...index.ancestors(focus.level, focus.code).reverse(),
            index.get(focus.level, focus.code),
        ])
            if (a && (a.l === 'county' || a.l === 'constituency'))
                add({ level: a.l, code: a.c });
    }
    add(current);
    return choices;
}

const ROWS: { seat: PartySeat; label: string; mapSeat: SeatKey | null }[] = [
    { seat: 'governor', label: 'Governors', mapSeat: 'governor' },
    { seat: 'senator', label: 'Senators', mapSeat: 'senator' },
    { seat: 'woman_rep', label: 'Woman Reps', mapSeat: 'woman_rep' },
    { seat: 'mp', label: 'MPs', mapSeat: 'mp' },
    { seat: 'mca', label: 'MCAs', mapSeat: 'mca' },
    { seat: 'nominated_mp', label: 'Nominated MPs', mapSeat: null },
    { seat: 'nominated_senator', label: 'Nominated Senators', mapSeat: null },
];

/** The party an address names (`uda`, `wdm-k`), in any case. Independents are not a party. */
export function findParty(data: SeatsData, slug: string) {
    const key = slug.toLowerCase();
    if (key === INDEPENDENT.toLowerCase()) return undefined;
    return data.parties.find((p) => p.abbrev.toLowerCase() === key);
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

const fmt = (n: number) => n.toLocaleString('en-GB');
const WORD = { constituency: 'constituencies', ward: 'wards' } as const;

export function partyProfile(
    data: SeatsData,
    abbrev: string,
    opts: { index?: UnitIndex; scope?: PartyScope } = {},
): PartyProfile | null {
    const party = findParty(data, abbrev);
    if (!party) return null;
    const key = party.abbrev;
    const colour = partyColours(data).get(key) ?? '';

    const { index } = opts;
    const unit = index && opts.scope && index.get(opts.scope.level, opts.scope.code);
    const scope: ProfileScope | null =
        opts.scope && unit && (unit.l === 'county' || unit.l === 'constituency')
            ? { level: unit.l, code: unit.c, name: unit.n }
            : null;
    const scopeFocus = scope ? { level: scope.level, code: scope.code } : null;
    // Seats held at the scope's level or finer: a constituency says nothing of governors.
    const fits = new Set<string>(validSeatModes(scope?.level ?? null));

    const rows = ROWS.filter(({ seat, mapSeat }) =>
        scope ? mapSeat !== null && fits.has(seat) : true,
    ).map(({ seat, label, mapSeat }): PartySeatRow => {
        const found =
            scope && index && mapSeat
                ? legendScope(index, mapSeat, scopeFocus)
                : null;
        const legend = seatLegend(data, seat, found?.codes);
        const count = legend.find((r) => r.abbrev === key)?.seats ?? 0;
        const total = legend.reduce((n, r) => n + r.seats, 0);
        const single = found !== null && found.codes.size === 1;
        const unitWord = mapSeat && scope ? WORD[mapSeat === 'mca' ? 'ward' : 'constituency'] : null;
        return {
            seat,
            label: single ? label.replace(/s$/, '') : label,
            count,
            total,
            share: shareOf(count, total),
            mapSeat,
            single,
            nominated: mapSeat === null,
            value: mapSeat === null
                ? fmt(count)
                : single
                ? count > 0
                    ? 'Held'
                    : `Not held by ${key}`
                : `${fmt(count)} of ${fmt(total)}${unitWord ? ` ${unitWord}` : ''} (${shareOf(count, total)})`,
        };
    });
    const elected = rows.filter((r) => r.mapSeat !== null);
    const electedCount = elected.reduce((n, r) => n + r.count, 0);
    const electedTotal = elected.reduce((n, r) => n + r.total, 0);

    const status = party.status?.trim();
    const sourceUrl = party.source_url || null;
    // "none" is the data's filler for a coalition nobody recorded, not a sourced finding: unknown.
    const named = party.coalition_2022?.trim();
    const coalition = sourceUrl && named && named.toLowerCase() !== 'none' ? named : null;
    const held = data.holders.filter((h) => h.party === key);
    const urls = held.map((h) => h.source_url);

    return {
        abbrev: key,
        name: party.name,
        colour,
        hasOwnColour: hasOwnColour(key, colour),
        coalition,
        formerNames: (party.former_names ?? []).map((f) => ({
            abbrev: f.abbrev,
            effectiveOn: f.effective_on,
        })),
        registration: status
            ? {
                  status: capital(status),
                  sourceUrl,
                  sourceName: sourceUrl ? hostOf(sourceUrl) : null,
              }
            : null,
        scope,
        rows,
        topCounties: !scope && index ? topCounties(data, index, key) : [],
        elected: {
            count: electedCount,
            total: electedTotal,
            share: shareOf(electedCount, electedTotal),
        },
        hasSeats: rows.some((r) => r.count > 0),
        heldAnywhere: held.length > 0,
        asOf: data.data_as_of ?? data.as_of ?? null,
        sources: sourceParts(urls),
        source: sourceLine(urls),
        path: partyPath(key, scope && { level: scope.level, code: scope.code }),
    };
}

const TOP = 5;

/**
 * The counties where the party holds the most MCA seats: five at most, the most first and ties by
 * county code, counties with none left out. Each county's wards are counted with the legend's own
 * functions (legendScope, seatLegend).
 */
function topCounties(data: SeatsData, index: UnitIndex, abbrev: string): TopCounty[] {
    const out: TopCounty[] = [];
    for (const county of index.all()) {
        if (county.l !== 'county') continue;
        const found = legendScope(index, 'mca', { level: 'county', code: county.c });
        if (!found) continue;
        const count =
            seatLegend(data, 'mca', found.codes).find((r) => r.abbrev === abbrev)
                ?.seats ?? 0;
        if (count > 0)
            out.push({
                code: county.c,
                name: county.n,
                count,
                total: found.codes.size,
                value: `${fmt(count)} of ${fmt(found.codes.size)} wards`,
            });
    }
    return out
        .sort((a, b) => b.count - a.count || a.code - b.code)
        .slice(0, TOP);
}
