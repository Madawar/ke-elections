// A Nairobi City with its 17 constituencies (codes 274 to 290) and 85 wards (1366 to 1450, five
// per constituency), for the seat mix tests. Party abbreviations and colours are the published
// ones; the seat counts and holder names are placeholders, never real office holders.
import type { Holder, SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';
import { VIEW_SEATS } from './viewFixtures';

const CONSTITUENCIES = Array.from({ length: 17 }, (_, i) => 274 + i);

const units: Unit[] = [
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
    // Listed out of code order on purpose: rows must still come in code order.
    ...[...CONSTITUENCIES].reverse().map((c) => ({
        l: 'constituency' as const,
        c,
        n: c === 290 ? 'Mathare' : `Constituency ${c}`,
        p: 47,
        b: [36.8, -1.3, 36.9, -1.2] as Unit['b'],
    })),
    ...Array.from({ length: 85 }, (_, i) => ({
        l: 'ward' as const,
        c: 1366 + i,
        n: `Ward ${1366 + i}`,
        p: 274 + Math.floor(i / 5),
        b: [36.8, -1.3, 36.9, -1.2] as Unit['b'],
    })),
];
export const mixIndex = UnitIndex.fromRows(units);

/** MCA seats in Nairobi City: KANU (2 of 85, 2.4%) and IND (2, 2.4%) are under 3%. */
export const NAIROBI_MCA: [string, number][] = [
    ['ODM', 40],
    ['UDA', 27],
    ['JP', 8],
    ['WDM-K', 3],
    ['SP1', 3],
    ['IND', 2],
    ['KANU', 2],
];

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

// Spread the parties over the wards (every 37th ward), so constituencies get a mix.
const mcaParties = NAIROBI_MCA.flatMap(
    ([p, n]) => Array(n).fill(p) as string[],
);
const mcaHolders = mcaParties.map((p, i) =>
    holder('mca', 'ward', 1366 + ((i * 37) % 85), p),
);
const mpParties = [
    'ODM',
    'UDA',
    'ODM',
    'JP',
    'ODM',
    'UDA',
    'ODM',
    'JP',
    'ODM',
    'UDA',
    'ODM',
    'JP',
    'ODM',
    'UDA',
    'WDM-K',
    'IND',
    'ODM',
];

export const MIX_SEATS: SeatsData = {
    ...VIEW_SEATS,
    holders: [
        ...mcaHolders,
        ...CONSTITUENCIES.map((c, i) =>
            holder('mp', 'constituency', c, mpParties[i]),
        ),
        holder('governor', 'county', 47, 'UDA'),
    ],
};
