// The unit directory: every province, county, constituency and ward from public/boundaries/units.json.
// Parent codes come from the gazette via the boundary pipeline; nothing here joins on names.

export type Level = 'province' | 'county' | 'constituency' | 'ward';

/** One row of public/boundaries/units.json. */
export interface Unit {
    l: Level;
    c: number;
    n: string;
    /** Parent code one level up (ward → constituency → county → province); null for provinces. */
    p: number | null;
    /** Bounding box: [west, south, east, north]. */
    b: [number, number, number, number];
}

export type SeatKey = 'governor' | 'senator' | 'woman_rep' | 'mp' | 'mca';

export interface Seat {
    key: SeatKey;
    label: string;
}

export const LEVELS: readonly Level[] = [
    'province',
    'county',
    'constituency',
    'ward',
];

const PARENT: Record<Level, Level | null> = {
    province: null,
    county: 'province',
    constituency: 'county',
    ward: 'constituency',
};
const CHILD: Record<Level, Level | null> = {
    province: 'county',
    county: 'constituency',
    constituency: 'ward',
    ward: null,
};

const SEATS: Record<Level, Seat[]> = {
    province: [],
    county: [
        { key: 'governor', label: 'Governor' },
        { key: 'senator', label: 'Senator' },
        { key: 'woman_rep', label: 'Woman Representative' },
    ],
    constituency: [{ key: 'mp', label: 'Member of the National Assembly' }],
    ward: [{ key: 'mca', label: 'Member of County Assembly' }],
};

/** The elective seats tied to a unit at this level. Provinces have none. */
export function seatsFor(level: Level): Seat[] {
    return SEATS[level].map((s) => ({ ...s }));
}

const key = (level: Level, code: number) => `${level}:${code}`;

export class UnitIndex {
    private readonly rows: Unit[];
    private readonly byKey = new Map<string, Unit>();
    private readonly childrenByKey = new Map<string, Unit[]>();

    private constructor(rows: Unit[]) {
        this.rows = rows;
        for (const u of rows) this.byKey.set(key(u.l, u.c), u);
        for (const u of rows) {
            const parent = PARENT[u.l];
            if (parent === null || u.p === null) continue;
            const k = key(parent, u.p);
            const list = this.childrenByKey.get(k);
            if (list) list.push(u);
            else this.childrenByKey.set(k, [u]);
        }
    }

    static fromRows(rows: Unit[]): UnitIndex {
        return new UnitIndex(rows);
    }

    static async load(url: string): Promise<UnitIndex> {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Could not load ${url}: HTTP ${res.status}`);
        return new UnitIndex((await res.json()) as Unit[]);
    }

    get(level: Level, code: number): Unit | undefined {
        return this.byKey.get(key(level, code));
    }

    /** Parents nearest first, ending with the province. */
    ancestors(level: Level, code: number): Unit[] {
        const out: Unit[] = [];
        let unit = this.get(level, code);
        while (unit) {
            const parent = PARENT[unit.l];
            if (parent === null || unit.p === null) break;
            unit = this.get(parent, unit.p);
            if (unit) out.push(unit);
        }
        return out;
    }

    children(level: Level, code: number): Unit[] {
        return this.childrenByKey.get(key(level, code)) ?? [];
    }

    /** How many units sit below this one at each lower level, e.g. { constituency: 17, ward: 85 }. */
    descendantCounts(
        level: Level,
        code: number,
    ): Partial<Record<Level, number>> {
        const counts: Partial<Record<Level, number>> = {};
        let frontier = this.children(level, code);
        let childLevel = CHILD[level];
        while (childLevel && frontier.length > 0) {
            counts[childLevel] = frontier.length;
            frontier = frontier.flatMap((u) => this.children(u.l, u.c));
            childLevel = CHILD[childLevel];
        }
        return counts;
    }

    all(): Unit[] {
        return this.rows;
    }
}
