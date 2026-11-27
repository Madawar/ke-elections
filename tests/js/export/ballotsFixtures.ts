// Fixtures for the "Who represents this ward" tests: the real unit index (codes and names from
// public/boundaries/units.json) and the five seats above Isukha West ward (1046: Shinyalu
// constituency, Kakamega County) and Ngei ward (1448: Mathare, Nairobi City). Party abbreviations
// and names are the published registry values; holder names are placeholders, never real office
// holders.
import type { Holder, Party, SeatsData } from '@/lib/seats';
import { numbersIndex as index } from './numbersFixtures';

export { index };

export const ISUKHA_WEST = 1046;
export const NGEI = 1448;

const ward = (code: number) => index.get('ward', code)!;
const parentOf = (level: 'ward' | 'constituency', code: number) =>
    index.get(level === 'ward' ? 'constituency' : 'county', index.get(level, code)!.p!)!;

export const placesOf = (wardCode: number) => {
    const w = ward(wardCode);
    const constituency = parentOf('ward', wardCode);
    const county = parentOf('constituency', constituency.c);
    return { ward: w, constituency, county };
};

const PARTIES: Party[] = [
    ['UDA', 'United Democratic Alliance', '#e8c547'],
    ['ODM', 'Orange Democratic Movement', '#e07b24'],
    ['ANC', 'Amani National Congress', '#3fae49'],
    ['DAP-K', 'Democratic Action Party-Kenya', '#6cb4e4'],
    ['IND', 'Independent', null],
    // A long registered name, to test that a party line is never cut.
    [
        'NLP',
        'National Liberation and Reconstruction Party of the Republic of Kenya',
        null,
    ],
    // The longest registered names among the parties that hold a seat (published values).
    ['FORD-K', 'Forum for Restoration of Democracy-Kenya', null],
    ['NOPEU', 'National Ordinary People Empowerment Union', null],
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
    started_on: '2022-08-25',
    source_url: `https://www.iebc.or.ke/uploads/resources/sample-${seat}.pdf`,
    ...over,
});

/** The five seats of a ward, listed in the data out of ballot order (MCA first, Governor last). */
export function wardSeats(
    wardCode: number,
    parties: Partial<Record<Holder['seat'], string | null>> = {},
    over: Partial<Record<Holder['seat'], Partial<Holder> | null>> = {},
): Holder[] {
    const p = placesOf(wardCode);
    const rows: [Holder['seat'], Holder['level'], number, string | null][] = [
        ['mca', 'ward', p.ward.c, 'DAP-K'],
        ['woman_rep', 'county', p.county.c, 'ODM'],
        ['mp', 'constituency', p.constituency.c, 'ANC'],
        ['senator', 'county', p.county.c, 'UDA'],
        ['governor', 'county', p.county.c, 'ODM'],
    ];
    return rows.flatMap(([seat, level, code, party]) =>
        over[seat] === null
            ? []
            : [
                  holder(
                      seat,
                      level,
                      code,
                      seat in parties ? (parties[seat] ?? null) : party,
                      over[seat] ?? {},
                  ),
              ],
    );
}

export const seatsWith = (holders: Holder[]): SeatsData => ({
    as_of: '2026-11-27',
    data_as_of: '2026-07-16',
    parties: PARTIES,
    holders,
});

export const BALLOT_SEATS = seatsWith([
    ...wardSeats(ISUKHA_WEST),
    ...wardSeats(NGEI),
]);

/** 45 characters, as the data might spell a long name. */
export const LONG_NAME = 'Placeholder Firstname Middlename Longsurnames';

/** 38 characters in five words: as long as the longest MP's name in the data. */
export const MP_NAME_38 = 'Placeholder Mamesu Mamesu Mamesu Mames';

/** Mukuyuni ward (Bungoma), where the real FORD-K papers ran into the footer on the story. */
export const MUKUYUNI = 1088;
/** Shinoyi-Shikomari-Esumeyia ward: one word wider than the story's headline line. */
export const SHINOYI = 1016;

/**
 * The longest name per seat in the seeded data (characters, words), read from the data and kept
 * here as numbers only: the sweep builds placeholder names this long, never the real ones.
 */
export const LONGEST_NAMES: Record<'governor' | 'senator' | 'woman_rep' | 'mp' | 'mca', [number, number]> = {
    governor: [36, 4],
    senator: [33, 4],
    woman_rep: [29, 4],
    mp: [38, 5],
    mca: [36, 5],
};

/**
 * A placeholder name `length` characters long in `words` words: "Placeholder Mamesu Mames…",
 * with a wide letter in every word, so it measures at least as wide as a real name that long.
 */
export function placeholderName(length: number, words: number): string {
    const rest = length - 'Placeholder'.length - (words - 1);
    const out = ['Placeholder'];
    for (let i = 0; i < words - 1; i++) {
        const n = Math.floor(rest / (words - 1)) + (i < rest % (words - 1) ? 1 : 0);
        out.push('Mamesurnamesurnamesurname'.slice(0, n));
    }
    return out.join(' ');
}
