// Fixtures for the "Share this view" tests. Party abbreviations, names and colours are the
// published registry values; the seat counts mirror the published totals so the headlines read
// like the real ones. Holder names are placeholders, never real office holders.
import type { Holder, Party, SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

const PARTIES: Party[] = [
    ['UDA', 'United Democratic Alliance', '#e8c547'],
    ['ODM', 'Orange Democratic Movement', '#e07b24'],
    ['JP', 'Jubilee Party', '#c8323c'],
    ['WDM-K', 'Wiper Patriotic Front', '#2f5fa7'],
    ['UDM', 'United Democratic Movement', '#3ba39c'],
    ['FORD-K', 'Forum for Restoration of Democracy-Kenya', '#8e6bb0'],
    ['ANC', 'Amani National Congress', '#3fae49'],
    ['DAP-K', 'Democratic Action Party-Kenya', '#6db3e0'],
    ['KANU', 'Kenya African National Union', '#8a5a2b'],
    ['MCCP', 'Maendeleo Chap Chap', '#b5508f'],
    ['IND', 'Independent', null],
    ...Array.from({ length: 9 }, (_, i) => [
        `SP${i + 1}`,
        `Sample party ${i + 1}`,
        null,
    ]),
].map(([abbrev, name, colour]) => ({
    abbrev: abbrev as string,
    name: name as string,
    coalition_2022: null,
    colour: colour as string | null,
}));

const holder = (
    seat: Holder['seat'],
    level: Holder['level'],
    code: number,
    party: string,
): Holder => ({
    seat,
    level,
    code,
    name: `Placeholder ${seat} ${code}`,
    party,
    basis: 'elected',
    started_on: '2022-08-25',
    source_url: 'https://www.iebc.or.ke/uploads/resources/sample.pdf',
});

/**
 * MCA seats per party: 1,450 wards in all. Ten parties have a colour of their own (more than a
 * legend of seven rows would show), as in the published data; SP1 to SP9 are placeholders for the
 * parties without a colour, which are all that "Other parties" may hold.
 */
export const MCA_COUNTS: [string, number][] = [
    ['UDA', 523],
    ['ODM', 312],
    ['IND', 114],
    ['JP', 76],
    ['WDM-K', 68],
    ['UDM', 36],
    ['FORD-K', 33],
    ['ANC', 31],
    ['DAP-K', 28],
    ['KANU', 27],
    ['MCCP', 19],
    // 183 seats among the parties without a colour (placeholders here).
    ...Array.from({ length: 9 }, (_, i): [string, number] => [
        `SP${i + 1}`,
        i < 8 ? 20 : 23,
    ]),
];
/** MP seats in Nairobi City's 17 constituencies (codes 274 to 290). */
export const NAIROBI_MP: [string, number][] = [
    ['ODM', 8],
    ['UDA', 4],
    ['JP', 3],
    ['WDM-K', 1],
    ['IND', 1],
];

function seatHolders(
    seat: Holder['seat'],
    level: Holder['level'],
    first: number,
    counts: [string, number][],
): Holder[] {
    let code = first;
    return counts.flatMap(([party, n]) =>
        Array.from({ length: n }, () => holder(seat, level, code++, party)),
    );
}

export const VIEW_SEATS: SeatsData = {
    as_of: '2026-11-26',
    data_as_of: '2026-07-16',
    parties: PARTIES,
    holders: [
        ...seatHolders('mca', 'ward', 1, MCA_COUNTS),
        ...seatHolders('mp', 'constituency', 274, NAIROBI_MP),
        holder('governor', 'county', 47, 'UDA'),
    ],
    totals: {},
    chambers: { national_assembly: {}, senate: {} },
};

const NAIROBI: Unit[] = [
    {
        l: 'province',
        c: 8,
        n: 'Nairobi',
        p: null,
        b: [36.66, -1.44, 37.1, -1.16],
    },
    {
        l: 'county',
        c: 47,
        n: 'Nairobi City',
        p: 8,
        b: [36.66, -1.44, 37.1, -1.16],
    },
    ...Array.from({ length: 17 }, (_, i) => ({
        l: 'constituency' as const,
        c: 274 + i,
        n: i === 16 ? 'Mathare' : `Constituency ${274 + i}`,
        p: 47,
        b: [36.8, -1.3, 36.9, -1.2] as Unit['b'],
    })),
];
export const viewIndex = UnitIndex.fromRows(NAIROBI);
