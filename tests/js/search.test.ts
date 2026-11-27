import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    describePerson,
    normalise,
    searchParties,
    searchPeople,
    searchUnits,
} from '@/lib/search';
import type { Holder } from '@/lib/seats';
import { UnitIndex, type Unit } from '@/lib/units';

const rows: Unit[] = JSON.parse(
    readFileSync(
        resolve(import.meta.dirname, '../../public/boundaries/units.json'),
        'utf8',
    ),
);
const index = UnitIndex.fromRows(rows);

describe('normalise', () => {
    it('lower-cases, strips diacritics and apostrophes, and splits on / and -', () => {
        expect(normalise("Cherang'any/Chebororwa")).toBe(
            'cherangany chebororwa',
        );
        expect(normalise('Tharaka - Nithi')).toBe('tharaka nithi');
        expect(normalise('Ziwa La Ng’ombe')).toBe('ziwa la ngombe');
        expect(normalise('Mérü')).toBe('meru');
    });
});

describe('searchUnits', () => {
    it('finds both Huruma wards', () => {
        const wards = searchUnits(index, 'huruma').filter(
            (r) => r.unit.l === 'ward',
        );
        expect(wards).toHaveLength(2);
        expect(wards.map((r) => r.ancestors[0].n).sort()).toEqual([
            'Mathare',
            'Turbo',
        ]);
    });

    it('matches across apostrophes', () => {
        expect(
            searchUnits(index, 'cherangany').some(
                (r) => r.unit.l === 'ward' && r.unit.c === 737,
            ),
        ).toBe(true);
    });

    it('matches names split by a slash', () => {
        expect(
            searchUnits(index, 'embobut').some(
                (r) => r.unit.l === 'ward' && r.unit.c === 734,
            ),
        ).toBe(true);
    });

    it('ranks the exact county first', () => {
        const [first] = searchUnits(index, 'kisumu');
        expect(first.unit).toMatchObject({ l: 'county', c: 42 });
        expect(first.ancestors.map((u) => u.n)).toEqual(['Nyanza']);
    });

    it('needs every token to prefix-match', () => {
        const results = searchUnits(index, 'kisumu ea');
        expect(results.map((r) => r.unit.n)).toEqual(['Kisumu East']);
    });

    it('returns nothing for an empty query', () => {
        expect(searchUnits(index, '')).toEqual([]);
        expect(searchUnits(index, '   ')).toEqual([]);
    });

    it('respects the limit', () => {
        expect(searchUnits(index, 'k').length).toBeLessThanOrEqual(8);
        expect(searchUnits(index, 'k', 3)).toHaveLength(3);
    });

    it('leaves out provinces', () => {
        expect(
            searchUnits(index, 'nairobi').some((r) => r.unit.l === 'province'),
        ).toBe(false);
        expect(searchUnits(index, 'coast')).toEqual([]);
    });
});

// Synthetic people on real unit codes: no real names in fixtures.
const person = (
    h: Partial<Holder> & Pick<Holder, 'seat' | 'name'>,
): Holder => ({
    level: 'county',
    code: 1,
    party: 'ODM',
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: 'https://example.test/gazette',
    ...h,
});
const holders: Holder[] = [
    person({ seat: 'governor', name: 'Test Person One', code: 1 }),
    person({ seat: 'senator', name: 'Test Person One', code: 47 }),
    person({ seat: 'woman_rep', name: 'Test Person Two', code: 1 }),
    person({
        seat: 'mp',
        level: 'constituency',
        code: 290,
        name: 'Test Person Three',
    }),
    person({
        seat: 'mca',
        level: 'ward',
        code: 1,
        name: 'Test Person Four',
    }),
    person({
        seat: 'mca',
        level: 'ward',
        code: 1447,
        name: "Test Pérson Fi've",
    }),
    person({
        seat: 'mca',
        level: 'ward',
        code: 713,
        name: 'Test Person Six',
        party: null,
    }),
    person({
        seat: 'mca',
        level: 'ward',
        code: 1447,
        name: 'Test Person Six',
        party: 'UDA',
    }),
    person({
        seat: 'nominated_mp',
        level: 'national',
        code: 0,
        name: 'Test Person Seven',
        basis: 'nominated',
    }),
    person({
        seat: 'nominated_mca',
        level: 'county',
        code: 1,
        name: 'Test Person Eight',
        basis: 'nominated',
    }),
];

describe('searchPeople', () => {
    it('matches name tokens in any order', () => {
        const found = searchPeople(holders, index, 'one person test');
        expect(found.map((r) => r.holder.name)).toEqual([
            'Test Person One',
            'Test Person One',
        ]);
    });

    it('ignores diacritics and apostrophes', () => {
        const found = searchPeople(holders, index, 'person five');
        expect(found.map((r) => r.holder.name)).toEqual(["Test Pérson Fi've"]);
        expect(searchPeople(holders, index, 'persón fiv')).toHaveLength(1);
    });

    it('needs every query token to prefix-match', () => {
        expect(searchPeople(holders, index, 'test zzz')).toEqual([]);
        expect(searchPeople(holders, index, 'ers')).toEqual([]);
    });

    it('ranks an exact name first, then names starting with the query', () => {
        const rows = [
            person({ seat: 'mp', name: 'Test Person' }),
            person({ seat: 'governor', name: 'Other Test Person' }),
            person({ seat: 'senator', name: 'Test Person Longer' }),
        ];
        expect(
            searchPeople(rows, index, 'test person').map((r) => r.holder.name),
        ).toEqual(['Test Person', 'Test Person Longer', 'Other Test Person']);
    });

    it('breaks ties by seat order, then name', () => {
        const found = searchPeople(holders, index, 'test person one');
        expect(found.map((r) => r.holder.seat)).toEqual([
            'governor',
            'senator',
        ]);
        const all = searchPeople(holders, index, 'test', 20);
        const seats = all.map((r) => r.holder.seat);
        expect(seats[0]).toBe('governor');
        expect(seats.indexOf('woman_rep')).toBeLessThan(seats.indexOf('mp'));
        expect(seats.indexOf('mca')).toBeLessThan(
            seats.indexOf('nominated_mp'),
        );
        expect(seats.indexOf('nominated_mp')).toBeLessThan(
            seats.indexOf('nominated_mca'),
        );
    });

    it('returns the unit and its ancestors, and no unit for nominated members', () => {
        const [mp] = searchPeople(holders, index, 'three');
        expect(mp.unit).toMatchObject({ l: 'constituency', c: 290 });
        expect(mp.ancestors.map((u) => u.n)[0]).toBe('Nairobi City');
        const [nominated] = searchPeople(holders, index, 'seven');
        expect(nominated.unit).toBeUndefined();
        expect(nominated.ancestors).toEqual([]);
    });

    it('respects the limit and returns nothing for an empty query', () => {
        expect(searchPeople(holders, index, 'test', 3)).toHaveLength(3);
        expect(searchPeople(holders, index, 'test')).toHaveLength(6);
        expect(searchPeople(holders, index, '')).toEqual([]);
        expect(searchPeople(holders, index, '   ')).toEqual([]);
        expect(searchPeople(holders, index, 'test', 0)).toEqual([]);
    });

    it('works out ancestors only for the people it returns', () => {
        const spy = vi.spyOn(index, 'ancestors');
        try {
            expect(searchPeople(holders, index, 'test', 2)).toHaveLength(2);
            expect(spy).toHaveBeenCalledTimes(2);
        } finally {
            spy.mockRestore();
        }
    });

    it('does not let a person whose unit is missing take a place in the results', () => {
        const lost = person({ seat: 'governor', name: 'Test Aaa', code: 999 });
        const found = searchPeople([lost, ...holders], index, 'test', 3);
        expect(found).toHaveLength(3);
        expect(found.every((r) => r.holder !== lost)).toBe(true);
    });

    it('skips people whose unit is not in the index', () => {
        const lost = [
            person({ seat: 'governor', name: 'Test Person Nine', code: 999 }),
        ];
        expect(searchPeople(lost, index, 'nine')).toEqual([]);
    });

    it('returns both people who share a name, with different area lines', () => {
        const found = searchPeople(holders, index, 'person six');
        expect(found).toHaveLength(2);
        expect(found.map((r) => describePerson(r)).sort()).toEqual([
            'MCA, Huruma ward, Mathare, Nairobi City (UDA)',
            'MCA, Huruma ward, Turbo, Uasin Gishu',
        ]);
    });
});

describe('describePerson', () => {
    const describeOf = (query: string) =>
        searchPeople(holders, index, query).map((r) => describePerson(r));

    it('describes county seats', () => {
        expect(describeOf('person two')).toEqual([
            'Woman Representative, Mombasa County (ODM)',
        ]);
        expect(describeOf('person one')).toEqual([
            'Governor, Mombasa County (ODM)',
            'Senator, Nairobi City County (ODM)',
        ]);
    });

    it('describes an MP and an MCA', () => {
        expect(describeOf('three')).toEqual([
            'MP, Mathare, Nairobi City (ODM)',
        ]);
        expect(describeOf('four')).toEqual([
            'MCA, Port Reitz ward, Changamwe, Mombasa (ODM)',
        ]);
    });

    it('describes nominated members', () => {
        expect(describeOf('seven')).toEqual(['Nominated MP (ODM)']);
        expect(describeOf('eight')).toEqual(['Nominated MCA, Mombasa (ODM)']);
        const senator = person({
            seat: 'nominated_senator',
            level: 'national',
            code: 0,
            name: 'Test Person Ten',
        });
        expect(describePerson({ holder: senator, ancestors: [] })).toBe(
            'Nominated Senator (ODM)',
        );
    });

    it('leaves out the parenthesis when there is no party', () => {
        const row = searchPeople(holders, index, 'person six').find(
            (r) => r.holder.party === null,
        )!;
        expect(describePerson(row)).toBe(
            'MCA, Huruma ward, Turbo, Uasin Gishu',
        );
    });

    it('spells out independents', () => {
        const ind = person({
            seat: 'governor',
            name: 'Test Person Eleven',
            party: 'IND',
        });
        const [r] = searchPeople([ind], index, 'eleven');
        expect(describePerson(r)).toBe(
            'Governor, Mombasa County (Independent)',
        );
        expect(describePerson(r, () => 'Independent candidate')).toBe(
            'Governor, Mombasa County (Independent candidate)',
        );
    });
});

describe('searchParties', () => {
    const parties = [
        {
            abbrev: 'UDA',
            name: 'United Democratic Alliance',
            former_names: [{ abbrev: 'PDR', effective_on: null }],
        },
        { abbrev: 'UDM', name: 'United Democratic Movement' },
        { abbrev: 'ODM', name: 'Orange Democratic Movement' },
        {
            abbrev: 'WDM-K',
            name: 'Wiper Patriotic Front',
            former_names: [{ abbrev: 'WDM', effective_on: '2025-08-01' }],
        },
        { abbrev: 'DAP-K', name: 'Democratic Action Party-Kenya' },
        { abbrev: 'IND', name: 'Independent' },
    ].map((p) => ({
        coalition_2022: null,
        colour: null,
        former_names: [],
        ...p,
    }));

    it('matches the abbreviation, in any case, ahead of names', () => {
        expect(searchParties(parties, 'uda').map((r) => r.party.abbrev)).toEqual(['UDA']);
        expect(searchParties(parties, 'ODM').map((r) => r.party.abbrev)).toEqual(['ODM']);
        // "ud" starts both UDA and UDM abbreviations; the names (United) come after
        expect(searchParties(parties, 'ud').map((r) => r.party.abbrev)).toEqual(['UDA', 'UDM']);
    });

    it('matches a hyphenated abbreviation however it is typed', () => {
        expect(searchParties(parties, 'wdm-k')[0].party.abbrev).toBe('WDM-K');
        expect(searchParties(parties, 'wdm k')[0].party.abbrev).toBe('WDM-K');
        expect(searchParties(parties, 'dap')[0].party.abbrev).toBe('DAP-K');
    });

    it('matches the name by word starts', () => {
        expect(searchParties(parties, 'patriotic').map((r) => r.party.abbrev)).toEqual(['WDM-K']);
        expect(searchParties(parties, 'democratic mov').map((r) => r.party.abbrev)).toEqual(['ODM', 'UDM']);
    });

    it('matches a former name and says which one matched', () => {
        const [hit] = searchParties(parties, 'pdr');
        expect(hit.party.abbrev).toBe('UDA');
        expect(hit.formerName).toBe('PDR');
        const [wdm] = searchParties(parties, 'wdm');
        expect(wdm.party.abbrev).toBe('WDM-K');
        // WDM-K matches by its own abbreviation first, so no former name is reported
        expect(wdm.formerName).toBeNull();
        expect(searchParties(parties, 'uda')[0].formerName).toBeNull();
    });

    it('never offers the independents', () => {
        expect(searchParties(parties, 'ind')).toEqual([]);
        expect(searchParties(parties, 'independent')).toEqual([]);
    });

    it('returns nothing for an empty query and honours the limit', () => {
        expect(searchParties(parties, '  ')).toEqual([]);
        expect(searchParties(parties, 'd', 2)).toHaveLength(2);
        expect(searchParties(parties, 'd', 0)).toEqual([]);
    });
});
