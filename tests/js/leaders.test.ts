import { describe, expect, it } from 'vitest';
import {
    type LeaderRow,
    leaderSources,
    leadersFor,
    legendOmits,
    mcaSummary,
} from '@/lib/leaders';
import { type Unit } from '@/lib/units';
import {
    LEADERS_SEATS as seats,
    holder,
    leadersIndex as index,
} from './leadersFixtures';

const unit = (l: Unit['l'], c: number) => index.get(l, c)!;
const seatsOf = (rows: LeaderRow[]) => rows.map((r) => r.seat);

describe('leadersFor', () => {
    it('lists a ward’s MCA, its constituency’s MP, then the county-wide three, in that order', () => {
        const rows = leadersFor(unit('ward', 1448), seats, index);
        expect(seatsOf(rows)).toEqual([
            'mca',
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(rows.map((r) => r.unit)).toEqual([
            { level: 'ward', code: 1448, name: 'Ngei' },
            { level: 'constituency', code: 290, name: 'Mathare' },
            { level: 'county', code: 47, name: 'Nairobi City' },
            { level: 'county', code: 47, name: 'Nairobi City' },
            { level: 'county', code: 47, name: 'Nairobi City' },
        ]);
    });

    it('lists a constituency’s MP then the county-wide three', () => {
        const rows = leadersFor(unit('constituency', 290), seats, index);
        expect(seatsOf(rows)).toEqual([
            'mp',
            'governor',
            'senator',
            'woman_rep',
        ]);
        expect(rows[0].holder?.name).toBe('Placeholder mp 290');
    });

    it('lists a county’s Governor, Senator and Woman Rep', () => {
        const rows = leadersFor(unit('county', 47), seats, index);
        expect(seatsOf(rows)).toEqual(['governor', 'senator', 'woman_rep']);
        expect(rows.every((r) => r.above === null)).toBe(true);
    });

    it('has no rows for Kenya until a President is imported, and none for a former province', () => {
        expect(leadersFor(null, seats, index)).toEqual([]);
        expect(leadersFor(unit('province', 8), seats, index)).toEqual([]);
    });

    it('lists the President and Deputy President for Kenya once the data has them', () => {
        const withNational = {
            ...seats,
            holders: [
                ...seats.holders,
                // The data has no such seats today; these stand for a future validated import.
                holder('deputy_president' as never, 'national', 0, 'UDA'),
                holder('president' as never, 'national', 0, 'UDA'),
            ],
        };
        const rows = leadersFor(null, withNational, index);
        expect(seatsOf(rows)).toEqual(['president', 'deputy_president']);
        expect(rows[0].label).toBe('President');
        expect(rows[1].label).toBe('Deputy President');
    });

    it('keeps the seat order whatever the parties are or the order of the data', () => {
        const reversed = { ...seats, holders: [...seats.holders].reverse() };
        expect(
            seatsOf(leadersFor(unit('ward', 1448), reversed, index)),
        ).toEqual(['mca', 'mp', 'governor', 'senator', 'woman_rep']);
    });

    it('gives the name exactly as the data spells it, the party, its colour, the start date and the source', () => {
        const spelt = {
            ...seats,
            holders: seats.holders.map((h) =>
                h.seat === 'governor' && h.code === 47
                    ? { ...h, name: "  O'Placeholder  wa  TEST-case" }
                    : h,
            ),
        };
        const [governor] = leadersFor(unit('county', 47), spelt, index);
        expect(governor.holder).toEqual({
            name: "  O'Placeholder  wa  TEST-case",
            party: 'UDA',
            partyLabel: 'UDA',
            partyName: 'United Democratic Alliance',
            colour: '#e8c547',
            basis: 'elected',
            startedOn: '2022-08-09',
            sourceUrl:
                'https://archive.gazettes.africa/archive/ke/2022/sample-169.pdf',
        });
        expect(governor.label).toBe('Governor');
        expect(governor.title).toBe('Governor');
    });

    it('names independents "Independent", in the independent colour', () => {
        const [mca] = leadersFor(unit('ward', 1439), seats, index);
        expect(mca.holder?.party).toBe('IND');
        expect(mca.holder?.partyLabel).toBe('Independent');
        expect(mca.holder?.partyName).toBe('Independent');
        expect(mca.holder?.colour).toMatch(/^#/);
    });

    it('says where a seat held above the unit is held', () => {
        const rows = leadersFor(unit('ward', 1448), seats, index);
        expect(rows.map((r) => r.above)).toEqual([
            null,
            'constituency',
            'county',
            'county',
            'county',
        ]);
        expect(rows.map((r) => r.where)).toEqual([
            '',
            'Mathare constituency',
            'Nairobi City, county-wide',
            'Nairobi City, county-wide',
            'Nairobi City, county-wide',
        ]);
    });

    it('keeps a row for a seat with no approved holder, with nothing invented', () => {
        const rows = leadersFor(unit('county', 3), seats, index);
        expect(seatsOf(rows)).toEqual(['governor', 'senator', 'woman_rep']);
        expect(rows[0].holder?.name).toBe('Placeholder governor 3');
        expect(rows[1].holder).toBeNull();
        expect(rows[2].holder).toBeNull();
        const ward = leadersFor(unit('ward', 1450), seats, index);
        expect(ward[0].seat).toBe('mca');
        expect(ward[0].holder).toBeNull();
    });

    it('joins on codes and levels: a ward and a constituency with the same code do not mix', () => {
        const clash = {
            ...seats,
            holders: [
                ...seats.holders,
                holder('mca', 'ward', 290, 'JP'),
                holder('mp', 'constituency', 1448, 'JP'),
            ],
        };
        const rows = leadersFor(unit('ward', 1448), clash, index);
        expect(rows[0].holder?.name).toBe('Placeholder mca 1448');
        expect(rows[1].holder?.name).toBe('Placeholder mp 290');
    });

    it('leaves out the seats it is asked to omit, keeping the order of the rest', () => {
        expect(
            seatsOf(
                leadersFor(unit('ward', 1448), seats, index, {
                    omit: ['mca', 'senator'],
                }),
            ),
        ).toEqual(['mp', 'governor', 'woman_rep']);
    });
});

describe('legendOmits (the seat the legend already counts, when its scope is one holder)', () => {
    const focus = (level: 'county' | 'constituency' | 'ward', code: number) => ({
        level,
        code,
    });
    it('omits the Governor at a county in Governor mode', () => {
        expect(legendOmits(index, 'governor', focus('county', 47))).toEqual([
            'governor',
        ]);
        expect(
            seatsOf(
                leadersFor(unit('county', 47), seats, index, {
                    omit: legendOmits(index, 'governor', focus('county', 47)),
                }),
            ),
        ).toEqual(['senator', 'woman_rep']);
    });

    it('omits the MP at a constituency in MP mode and the MCA at a ward in MCA mode', () => {
        expect(legendOmits(index, 'mp', focus('constituency', 290))).toEqual([
            'mp',
        ]);
        expect(legendOmits(index, 'mca', focus('ward', 1448))).toEqual(['mca']);
    });

    it('omits nothing when the legend counts several seats, or no seat at all', () => {
        expect(legendOmits(index, 'mca', focus('constituency', 290))).toEqual(
            [],
        );
        expect(legendOmits(index, 'mp', focus('county', 47))).toEqual([]);
        expect(legendOmits(index, 'none', focus('county', 47))).toEqual([]);
        expect(legendOmits(index, 'province', focus('county', 47))).toEqual([]);
        expect(legendOmits(index, 'governor', null)).toEqual([]);
    });

    it('omits the county seat the legend counts from below: the Governor, seen from a ward', () => {
        expect(legendOmits(index, 'governor', focus('ward', 1448))).toEqual([
            'governor',
        ]);
    });
});

describe('mcaSummary', () => {
    it('counts a constituency’s MCAs by party, largest first, ties by abbreviation', () => {
        const s = mcaSummary(unit('constituency', 290), seats, index)!;
        expect(s.wards).toBe(6);
        expect(s.held).toBe(5);
        expect(s.parties.map((p) => [p.label, p.count])).toEqual([
            ['ODM', 3],
            ['UDA', 2],
        ]);
        expect(s.text).toBe('MCAs (6): ODM 3, UDA 2, no approved data yet 1');
    });

    it('lists the wards in code order, each with its MCA or none', () => {
        const s = mcaSummary(unit('constituency', 290), seats, index)!;
        expect(s.rows.map((r) => r.unit.code)).toEqual([
            1445, 1446, 1447, 1448, 1449, 1450,
        ]);
        expect(s.rows[3].unit.name).toBe('Ngei');
        expect(s.rows[3].holder?.name).toBe('Placeholder mca 1448');
        expect(s.rows[5].holder).toBeNull();
    });

    it('reads plainly when every ward has an MCA', () => {
        const s = mcaSummary(unit('constituency', 289), seats, index)!;
        expect(s.text).toBe('MCAs (1): Independent 1');
    });

    it('is only for a constituency', () => {
        expect(mcaSummary(unit('county', 47), seats, index)).toBeNull();
        expect(mcaSummary(unit('ward', 1448), seats, index)).toBeNull();
    });
});

describe('leaderSources', () => {
    it('gives the source links of the rows that have a holder', () => {
        const rows = leadersFor(unit('constituency', 290), seats, index);
        expect(leaderSources(rows)).toEqual([
            'https://www.iebc.or.ke/uploads/resources/sample-mp.pdf',
            'https://archive.gazettes.africa/archive/ke/2022/sample-169.pdf',
            'https://archive.gazettes.africa/archive/ke/2022/sample-170.pdf',
            'https://www.iebc.or.ke/uploads/resources/sample-woman_rep.pdf',
        ]);
        expect(
            leaderSources(leadersFor(unit('county', 3), seats, index)),
        ).toHaveLength(1);
    });
});
