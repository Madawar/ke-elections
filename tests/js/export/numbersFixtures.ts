// Fixtures for the "By the numbers" tests: the real unit index (47 counties, 290 constituencies,
// 1,450 wards, from public/boundaries/units.json) and every elected seat filled with placeholder
// holders. Party abbreviations, names and colours are the published registry values; the counts
// mirror the published totals so the card reads like the real one. Holder names are
// placeholders, never real office holders.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Holder, SeatsData } from '@/lib/seats';
import { type Unit, UnitIndex } from '@/lib/units';
import { MCA_COUNTS, VIEW_SEATS } from './viewFixtures';

const units: Unit[] = JSON.parse(
    readFileSync(
        resolve(import.meta.dirname, '../../../public/boundaries/units.json'),
        'utf8',
    ),
);
export const numbersIndex = UnitIndex.fromRows(units);

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

/** One holder per seat, codes 1, 2, 3, ... in the order of the counts. */
export function seatHolders(
    seat: Holder['seat'],
    level: Holder['level'],
    counts: [string, number][],
): Holder[] {
    let code = 1;
    return counts.flatMap(([party, n]) =>
        Array.from({ length: n }, () => holder(seat, level, code++, party)),
    );
}

export const GOVERNORS: [string, number][] = [
    ['UDA', 20],
    ['ODM', 15],
    ['WDM-K', 3],
    ['JP', 2],
    ['UDM', 2],
    ['ANC', 1],
    ['DAP-K', 1],
    ['FORD-K', 1],
    ['IND', 1],
    ['SP1', 1],
];
export const SENATORS: [string, number][] = [
    ['UDA', 22],
    ['ODM', 13],
    ['JP', 4],
    ['WDM-K', 3],
    ['UDM', 2],
    ['FORD-K', 1],
    ['SP2', 2],
];
export const WOMAN_REPS: [string, number][] = [
    ['UDA', 21],
    ['ODM', 10],
    ['WDM-K', 4],
    ['IND', 3],
    ['JP', 3],
    ['ANC', 1],
    ['FORD-K', 1],
    ['KANU', 1],
    ['SP3', 3],
];
export const MPS: [string, number][] = [
    ['UDA', 123],
    ['ODM', 73],
    ['JP', 22],
    ['WDM-K', 20],
    ['IND', 9],
    ['ANC', 5],
    ['DAP-K', 5],
    ['FORD-K', 5],
    ['SP4', 10],
    ['SP5', 9],
    ['SP6', 9],
];

const nominated = (seat: Holder['seat'], n: number) =>
    Array.from({ length: n }, (_, i) => ({
        ...holder(seat, 'national', i + 1, 'UDA'),
        basis: 'nominated',
        source_url: 'https://www.parliament.go.ke/sample',
    }));

export const NUMBERS_SEATS: SeatsData = {
    ...VIEW_SEATS,
    holders: [
        ...seatHolders('governor', 'county', GOVERNORS),
        ...seatHolders('senator', 'county', SENATORS),
        ...seatHolders('woman_rep', 'county', WOMAN_REPS),
        ...seatHolders('mp', 'constituency', MPS),
        ...seatHolders('mca', 'ward', MCA_COUNTS),
        ...nominated('nominated_mp', 11),
        ...nominated('nominated_senator', 20),
    ],
};
