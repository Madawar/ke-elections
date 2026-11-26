// Small fixtures for the export tests. Every person and party here is a labelled sample,
// never a real office holder.
import type { SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';

export const UNITS: Unit[] = [
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
    {
        l: 'constituency',
        c: 290,
        n: 'Mathare',
        p: 47,
        b: [36.84, -1.27, 36.88, -1.25],
    },
    {
        l: 'constituency',
        c: 289,
        n: 'Sample constituency',
        p: 47,
        b: [36.8, -1.3, 36.84, -1.27],
    },
    {
        l: 'ward',
        c: 1447,
        n: 'Huruma',
        p: 290,
        b: [36.866, -1.26, 36.875, -1.25],
    },
    {
        l: 'ward',
        c: 1448,
        n: 'Ngei',
        p: 290,
        b: [36.868, -1.262, 36.874, -1.254],
    },
];
export const index = UnitIndex.fromRows(UNITS);
export const unit = (l: Unit['l'], c: number) => index.get(l, c)!;

export const SEATS: SeatsData = {
    as_of: '2026-11-20',
    data_as_of: '2026-03-12',
    parties: [
        {
            abbrev: 'SPA',
            name: 'Sample Party A',
            coalition_2022: null,
            colour: '#E69F00',
        },
        {
            abbrev: 'SPB',
            name: 'Sample Party B',
            coalition_2022: null,
            colour: '#56B4E9',
        },
        {
            abbrev: 'IND',
            name: 'Independent',
            coalition_2022: null,
            colour: null,
        },
    ],
    holders: [
        {
            seat: 'governor',
            level: 'county',
            code: 47,
            name: 'Sample Governor',
            party: 'SPA',
            basis: 'elected',
            started_on: '2022-08-25',
            source_url: 'https://example.org/gazette',
        },
        {
            seat: 'mp',
            level: 'constituency',
            code: 290,
            name: 'Sample Member',
            party: 'SPB',
            basis: 'elected',
            started_on: '2022-08-25',
            source_url: 'https://example.org/gazette',
        },
        {
            seat: 'mp',
            level: 'constituency',
            code: 289,
            name: 'Sample Member Two',
            party: 'SPB',
            basis: 'elected',
            started_on: '2022-08-25',
            source_url: 'https://example.org/gazette',
        },
        {
            seat: 'mca',
            level: 'ward',
            code: 1448,
            name: 'Sample Ward Rep',
            party: 'IND',
            basis: 'by_election',
            started_on: '2026-03-12',
            source_url: 'https://example.org/gazette',
        },
    ],
    totals: {},
    chambers: {
        national_assembly: { SPA: 160, SPB: 150, IND: 12 },
        senate: { SPA: 33, SPB: 30 },
    },
};
