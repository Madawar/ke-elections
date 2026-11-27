// Seats for the party profile tests: five parties (two with a colour of their own, one without,
// one renamed, one with no seats) and independents. Names and counts are sample values; holder
// names are placeholders, never real office holders.
import type { Holder, Party, SeatsData } from '@/lib/seats';

export const PARTIES: Party[] = [
    {
        abbrev: 'UDA',
        name: 'United Democratic Alliance',
        coalition_2022: 'Kenya Kwanza',
        colour: '#e8c547',
        status: 'fully registered',
        source_url: 'https://orpp.or.ke/register.pdf',
        former_names: [{ abbrev: 'PDR', effective_on: null }],
    },
    {
        abbrev: 'ODM',
        name: 'Orange Democratic Movement',
        coalition_2022: 'Azimio',
        colour: '#e07b24',
        status: 'fully registered',
        source_url: 'https://orpp.or.ke/register.pdf',
        former_names: [],
    },
    {
        abbrev: 'WDM-K',
        name: 'Wiper Patriotic Front',
        coalition_2022: 'Azimio',
        colour: '#2f5fa7',
        status: 'fully registered',
        source_url: 'https://orpp.or.ke/register.pdf',
        former_names: [{ abbrev: 'WDM', effective_on: '2025-08-01' }],
    },
    {
        abbrev: 'DP',
        name: 'Democratic Party of Kenya',
        coalition_2022: 'none',
        colour: null,
        status: 'fully registered',
        source_url: 'https://orpp.or.ke/register.pdf',
        former_names: [],
    },
    {
        abbrev: 'NOSEAT',
        name: 'No Seats Party',
        coalition_2022: null,
        colour: null,
        status: 'fully registered',
        source_url: 'https://orpp.or.ke/register.pdf',
        former_names: [],
    },
    {
        abbrev: 'IND',
        name: 'Independent',
        coalition_2022: null,
        colour: null,
    },
];

const holder = (
    seat: Holder['seat'],
    level: Holder['level'],
    code: number,
    party: string,
    source = 'https://www.iebc.or.ke/uploads/resources/gazette.pdf',
): Holder => ({
    seat,
    level,
    code,
    name: `Placeholder ${seat} ${code}`,
    party,
    basis: 'elected',
    started_on: '2022-08-25',
    source_url: source,
});

const run = (
    seat: Holder['seat'],
    level: Holder['level'],
    first: number,
    counts: [string, number][],
) => {
    let code = first;
    return counts.flatMap(([party, n]) =>
        Array.from({ length: n }, () => holder(seat, level, code++, party)),
    );
};

export const HOLDERS: Holder[] = [
    ...run('governor', 'county', 1, [
        ['UDA', 20],
        ['ODM', 15],
        ['WDM-K', 3],
        ['DP', 0],
        ['IND', 9],
    ]),
    ...run('senator', 'county', 1, [
        ['UDA', 22],
        ['ODM', 13],
        ['WDM-K', 3],
        ['DP', 1],
        ['IND', 8],
    ]),
    ...run('woman_rep', 'county', 1, [
        ['UDA', 21],
        ['ODM', 10],
        ['WDM-K', 4],
        ['IND', 12],
    ]),
    ...run('mp', 'constituency', 1, [
        ['UDA', 119],
        ['ODM', 73],
        ['WDM-K', 21],
        ['DP', 1],
        ['IND', 76],
    ]),
    ...run('mca', 'ward', 1, [
        ['UDA', 517],
        ['ODM', 313],
        ['WDM-K', 69],
        ['DP', 3],
        ['IND', 548],
    ]),
    ...run('nominated_mp', 'national', 0, [
        ['UDA', 5],
        ['ODM', 4],
        ['IND', 2],
    ]),
    ...run('nominated_senator', 'national', 0, [
        ['UDA', 9],
        ['ODM', 7],
        ['WDM-K', 4],
    ]),
];

/** Per-seat totals and the two chambers, worked out as the server does. */
export function seatsFrom(
    holders: Holder[],
    over: Partial<SeatsData> = {},
): SeatsData {
    const totals: SeatsData['totals'] = {};
    for (const h of holders)
        if (h.party) {
            totals[h.seat] ??= {};
            totals[h.seat][h.party] = (totals[h.seat][h.party] ?? 0) + 1;
        }
    const sum = (seats: Holder['seat'][]) => {
        const out: Record<string, number> = {};
        for (const s of seats)
            for (const [p, n] of Object.entries(totals[s] ?? {}))
                out[p] = (out[p] ?? 0) + n;
        return out;
    };
    return {
        as_of: '2026-11-26',
        data_as_of: '2026-07-16',
        parties: PARTIES,
        holders,
        totals,
        chambers: {
            national_assembly: sum(['mp', 'woman_rep', 'nominated_mp']),
            senate: sum(['senator', 'nominated_senator']),
        },
        ...over,
    };
}

export const PARTY_SEATS = seatsFrom(HOLDERS);
