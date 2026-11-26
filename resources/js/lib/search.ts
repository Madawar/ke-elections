// Name search over the unit directory. Matching is on normalised name tokens; results carry
// their ancestors so the UI can show "Huruma, Mathare, Nairobi City".
import type { Holder } from './seats';
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

    const hits: { result: PersonResult; rank: number; name: string }[] = [];
    for (const holder of holders) {
        const name = normalise(holder.name);
        const rank = matchRank(name, q, queryTokens);
        if (rank === null) continue;

        let result: PersonResult;
        if (holder.level === 'national') {
            result = { holder, ancestors: [] };
        } else if (holder.seat === 'nominated_mca') {
            const county = index.get('county', holder.code);
            if (!county) continue;
            result = { holder, ancestors: [county] };
        } else {
            const unit = index.get(holder.level, holder.code);
            if (!unit) continue;
            result = {
                holder,
                unit,
                ancestors: index.ancestors(unit.l, unit.c),
            };
        }
        hits.push({ result, rank, name });
    }

    hits.sort(
        (a, b) =>
            a.rank - b.rank ||
            SEAT_ORDER.indexOf(a.result.holder.seat) -
                SEAT_ORDER.indexOf(b.result.holder.seat) ||
            a.name.localeCompare(b.name),
    );
    return hits.slice(0, limit).map((h) => h.result);
}

const SEAT_TITLE: Record<Holder['seat'], string> = {
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
