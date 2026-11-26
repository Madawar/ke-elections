// Name search over the unit directory. Matching is on normalised name tokens; results carry
// their ancestors so the UI can show "Huruma, Mathare, Nairobi City".
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
