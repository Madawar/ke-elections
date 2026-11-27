// Fixtures for the "Top 10 counties" tests: the real unit index and the seats of
// `numbersFixtures.ts`, with one group's MCA (or MP) seats placed county by county so a test can
// say exactly how many each county has. Holder names are placeholders, never real office holders.
import type { Holder, SeatsData } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

export { index };

const SEAT_UNIT = { mca: 'ward', mp: 'constituency' } as const;

/** The seats of one kind in a county, by code: its wards (MCA) or its constituencies (MP). */
export function unitsOf(seat: 'mp' | 'mca', county: number): number[] {
    const down = (level: string, code: number): number[] =>
        level === SEAT_UNIT[seat]
            ? [code]
            : index
                  .children(level as 'county', code)
                  .flatMap((u) => down(u.l, u.c));
    return down('county', county);
}

/**
 * The seats with `group` holding exactly `counts[county]` seats of the kind in each county named
 * (the county's first ones, by code) and none elsewhere; every other seat of the kind is held by
 * one of two other parties, in turn.
 */
export function placed(
    seat: 'mp' | 'mca',
    group: string,
    counts: Record<number, number>,
    data: SeatsData = NUMBERS_SEATS,
): SeatsData {
    const mine = new Set(
        Object.entries(counts).flatMap(([county, n]) =>
            unitsOf(seat, Number(county)).slice(0, n),
        ),
    );
    let turn = 0;
    const holders: Holder[] = index
        .all()
        .filter((u) => u.l === SEAT_UNIT[seat])
        .map((u) => ({
            seat,
            level: SEAT_UNIT[seat],
            code: u.c,
            name: `Placeholder ${seat} ${u.c}`,
            party: mine.has(u.c)
                ? group
                : turn++ % 2
                  ? 'ODM'
                  : 'UDA',
            basis: 'elected',
            started_on: '2022-08-25',
            source_url: 'https://www.iebc.or.ke/uploads/resources/sample.pdf',
        }));
    return {
        ...data,
        holders: [...data.holders.filter((h) => h.seat !== seat), ...holders],
    };
}
