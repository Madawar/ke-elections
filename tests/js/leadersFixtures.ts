// Fixtures for the leaders tests: Nairobi City (47) with Mathare (290) and its six wards, and
// Starehe (289) with one ward. Codes, unit names and party abbreviations are the published ones;
// holder names are placeholders, never real office holders.
import type { Holder, Party, SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

const b: Unit['b'] = [36.8, -1.3, 36.9, -1.2];

export const MATHARE_WARDS: [number, string][] = [
    [1445, 'Hospital'],
    [1446, 'Mabatini'],
    [1447, 'Huruma'],
    [1448, 'Ngei'],
    [1449, 'Mlango Kubwa'],
    [1450, 'Kiamaiko'],
];

export const leadersIndex = UnitIndex.fromRows([
    { l: 'province', c: 1, n: 'Coast', p: null, b },
    { l: 'province', c: 8, n: 'Nairobi', p: null, b },
    { l: 'county', c: 47, n: 'Nairobi City', p: 8, b },
    { l: 'county', c: 3, n: 'Kilifi', p: 1, b },
    { l: 'constituency', c: 290, n: 'Mathare', p: 47, b },
    { l: 'constituency', c: 289, n: 'Starehe', p: 47, b },
    // Listed out of code order on purpose: rows must still come in code order.
    ...[...MATHARE_WARDS]
        .reverse()
        .map(([c, n]): Unit => ({ l: 'ward', c, n, p: 290, b })),
    { l: 'ward', c: 1439, n: 'Nairobi Central', p: 289, b },
]);

const PARTIES: Party[] = [
    ['UDA', 'United Democratic Alliance', '#e8c547'],
    ['ODM', 'Orange Democratic Movement', '#e07b24'],
    ['JP', 'Jubilee Party', '#c8323c'],
    ['IND', 'Independent', null],
].map(([abbrev, name, colour]) => ({
    abbrev: abbrev as string,
    name: name as string,
    coalition_2022: null,
    colour,
}));

export const holder = (
    seat: Holder['seat'],
    level: Holder['level'],
    code: number,
    party: string | null,
    over: Partial<Holder> = {},
): Holder => ({
    seat,
    level,
    code,
    name: `Placeholder ${seat} ${code}`,
    party,
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: `https://www.iebc.or.ke/uploads/resources/sample-${seat}.pdf`,
    ...over,
});

/** Mathare's MCAs: ODM 3, UDA 2, and one ward (Kiamaiko) with no approved holder. */
export const MATHARE_MCA: [number, string][] = [
    [1445, 'ODM'],
    [1446, 'UDA'],
    [1447, 'ODM'],
    [1448, 'ODM'],
    [1449, 'UDA'],
];

export const LEADERS_SEATS: SeatsData = {
    as_of: '2026-11-27',
    data_as_of: '2026-07-16',
    parties: PARTIES,
    holders: [
        // Out of seat order on purpose: the rows are ordered by seat, never by the data's order.
        holder('woman_rep', 'county', 47, 'ODM'),
        holder('senator', 'county', 47, 'ODM', {
            source_url:
                'https://archive.gazettes.africa/archive/ke/2022/sample-170.pdf',
        }),
        holder('governor', 'county', 47, 'UDA', {
            source_url:
                'https://archive.gazettes.africa/archive/ke/2022/sample-169.pdf',
        }),
        holder('mp', 'constituency', 290, 'ODM'),
        holder('mp', 'constituency', 289, 'JP'),
        ...MATHARE_MCA.map(([code, party]) =>
            holder('mca', 'ward', code, party),
        ),
        holder('mca', 'ward', 1439, 'IND'),
        // Kilifi: a governor only, so its senator and woman rep rows are vacancies.
        holder('governor', 'county', 3, 'ODM'),
    ],
    totals: {},
    chambers: { national_assembly: {}, senate: {} },
};
