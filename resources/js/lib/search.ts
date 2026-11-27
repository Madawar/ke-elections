// Name search over the unit directory. Matching is on normalised name tokens; results carry
// their ancestors so the UI can show "Huruma, Mathare, Nairobi City".
import { INDEPENDENT, type Holder, type Party } from './seats';
import type { Level, Unit, UnitIndex } from './units';

export interface SearchResult {
    unit: Unit;
    ancestors: Unit[];
}

/** Lower-case, strip diacritics and apostrophes, turn / and - into spaces, collapse whitespace. */
export function normalise(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/['‘’ʼ`]/g, '')
        .replace(/[/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const LEVEL_RANK: Record<Level, number> = {
    province: 0,
    county: 1,
    constituency: 2,
    ward: 3,
};

// Rank 0: exact name, 1: name starts with the query, 2: every token prefix-matches somewhere.
function matchRank(
    name: string,
    query: string,
    queryTokens: string[],
): number | null {
    const tokens = name.split(' ');
    if (!queryTokens.every((q) => tokens.some((t) => t.startsWith(q))))
        return null;
    if (name === query) return 0;
    if (name.startsWith(query)) return 1;
    return 2;
}

export function searchUnits(
    index: UnitIndex,
    query: string,
    limit = 8,
): SearchResult[] {
    const q = normalise(query);
    if (q === '' || limit <= 0) return [];
    const queryTokens = q.split(' ');

    const hits: { unit: Unit; rank: number; name: string }[] = [];
    for (const unit of index.all()) {
        if (unit.l === 'province') continue;
        const name = normalise(unit.n);
        const rank = matchRank(name, q, queryTokens);
        if (rank !== null) hits.push({ unit, rank, name });
    }

    hits.sort(
        (a, b) =>
            a.rank - b.rank ||
            LEVEL_RANK[a.unit.l] - LEVEL_RANK[b.unit.l] ||
            a.name.localeCompare(b.name) ||
            a.unit.c - b.unit.c,
    );

    return hits.slice(0, limit).map(({ unit }) => ({
        unit,
        ancestors: index.ancestors(unit.l, unit.c),
    }));
}

export interface PartyResult {
    party: Party;
    /** The former abbreviation that matched, when the party was found by it rather than by its own. */
    formerName: string | null;
}

/** Every token of the query starts some token of the text. */
const tokensMatch = (text: string, queryTokens: string[]) => {
    const tokens = text.split(' ');
    return queryTokens.every((q) => tokens.some((t) => t.startsWith(q)));
};

/**
 * Parties by abbreviation, then by a former abbreviation (a rename), then by name. The abbreviation
 * ranks first so "uda" finds UDA, not every "United Democratic ..." party. Independents are not a
 * party and are never offered.
 */
export function searchParties(
    parties: Party[],
    query: string,
    limit = 6,
): PartyResult[] {
    const q = normalise(query);
    if (q === '' || limit <= 0) return [];
    const queryTokens = q.split(' ');

    const hits: (PartyResult & { rank: number; name: string })[] = [];
    for (const party of parties) {
        if (party.abbrev === INDEPENDENT) continue;
        const abbrev = normalise(party.abbrev);
        const name = normalise(party.name);
        const former = (party.former_names ?? []).find((f) =>
            tokensMatch(normalise(f.abbrev), queryTokens),
        );
        let rank: number | null = null;
        let formerName: string | null = null;
        if (abbrev === q) rank = 0;
        else if (abbrev.startsWith(q) || tokensMatch(abbrev, queryTokens)) rank = 1;
        else if (former) {
            rank = 2;
            formerName = former.abbrev;
        } else if (name.startsWith(q)) rank = 3;
        else if (tokensMatch(name, queryTokens)) rank = 4;
        if (rank !== null) hits.push({ party, formerName, rank, name });
    }
    hits.sort(
        (a, b) =>
            a.rank - b.rank ||
            a.name.localeCompare(b.name) ||
            a.party.abbrev.localeCompare(b.party.abbrev),
    );
    return hits.slice(0, limit).map(({ party, formerName }) => ({ party, formerName }));
}

export interface PersonResult {
    holder: Holder;
    /** The unit the seat belongs to. Absent for nominated members. */
    unit?: Unit;
    /** The unit's ancestors, nearest first. A nominated MCA carries just their county. */
    ancestors: Unit[];
}

const SEAT_ORDER: Holder['seat'][] = [
    'governor',
    'senator',
    'woman_rep',
    'mp',
    'mca',
    'nominated_senator',
    'nominated_mp',
    'nominated_mca',
];

// Normalised names, worked out once per holders array instead of on every keystroke.
const normalisedNames = new WeakMap<Holder[], string[]>();
function namesOf(holders: Holder[]): string[] {
    let names = normalisedNames.get(holders);
    if (!names || names.length !== holders.length) {
        names = holders.map((h) => normalise(h.name));
        normalisedNames.set(holders, names);
    }
    return names;
}

/** Current office holders whose name matches the query, as in searchUnits: every token prefix-matches. */
export function searchPeople(
    holders: Holder[],
    index: UnitIndex,
    query: string,
    limit = 6,
): PersonResult[] {
    const q = normalise(query);
    if (q === '' || limit <= 0) return [];
    const queryTokens = q.split(' ');
    const names = namesOf(holders);

    const hits: {
        holder: Holder;
        /** Absent for national members; a nominated MCA's is their county. */
        unit?: Unit;
        rank: number;
        name: string;
    }[] = [];
    holders.forEach((holder, i) => {
        const name = names[i];
        const rank = matchRank(name, q, queryTokens);
        if (rank === null) return;
        if (holder.level === 'national') {
            hits.push({ holder, rank, name });
            return;
        }
        const unit =
            holder.seat === 'nominated_mca'
                ? index.get('county', holder.code)
                : index.get(holder.level, holder.code);
        if (unit) hits.push({ holder, unit, rank, name });
    });

    hits.sort(
        (a, b) =>
            a.rank - b.rank ||
            SEAT_ORDER.indexOf(a.holder.seat) -
                SEAT_ORDER.indexOf(b.holder.seat) ||
            a.name.localeCompare(b.name),
    );
    // Ancestors are worked out only for the few rows that are shown.
    return hits.slice(0, limit).map(({ holder, unit }) => {
        if (!unit) return { holder, ancestors: [] };
        if (holder.seat === 'nominated_mca')
            return { holder, ancestors: [unit] };
        return {
            holder,
            unit,
            ancestors: index.ancestors(unit.l, unit.c),
        };
    });
}

export const SEAT_TITLE: Record<Holder['seat'], string> = {
    governor: 'Governor',
    senator: 'Senator',
    woman_rep: 'Woman Representative',
    mp: 'MP',
    mca: 'MCA',
    nominated_senator: 'Nominated Senator',
    nominated_mp: 'Nominated MP',
    nominated_mca: 'Nominated MCA',
};

/**
 * The second line of a person row, such as "MP, Mathare, Nairobi City (ODM)". The party shows as its
 * abbreviation; `partyName` is only asked to spell out independents.
 */
export function describePerson(
    r: PersonResult,
    partyName?: (abbrev: string) => string | undefined,
): string {
    const { holder, unit, ancestors } = r;
    const party = holder.party
        ? ` (${holder.party === 'IND' ? (partyName?.('IND') ?? 'Independent') : holder.party})`
        : '';
    const title = SEAT_TITLE[holder.seat];
    const county = ancestors.find((a) => a.l === 'county');

    switch (holder.seat) {
        case 'governor':
        case 'senator':
        case 'woman_rep':
            return `${title}, ${unit?.n} County${party}`;
        case 'mp':
            return `${title}, ${unit?.n}, ${county?.n}${party}`;
        case 'mca': {
            const constituency = ancestors.find((a) => a.l === 'constituency');
            return `${title}, ${unit?.n} ward, ${constituency?.n}, ${county?.n}${party}`;
        }
        case 'nominated_mca':
            return `${title}, ${county?.n}${party}`;
        default:
            return `${title}${party}`;
    }
}
