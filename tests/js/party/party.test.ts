import { describe, expect, it } from 'vitest';
import { buildLegend } from '@/lib/legend';
import { findParty, partyProfile, topCounties } from '@/lib/party';
import { OTHER } from '@/lib/map/theme';
import { parsePartyPath, partyPath } from '@/lib/map/urls';
import { legendScope, chamberGroups } from '@/lib/seats';
import { UnitIndex } from '@/lib/units';
import { PARTY_SEATS, PARTIES, seatsFrom } from './partyFixtures';

const ELECTED = ['governor', 'senator', 'woman_rep', 'mp', 'mca'] as const;
const noFocus = legendScope(UnitIndex.fromRows([]), 'mp', null);

describe('partyProfile', () => {
    for (const abbrev of ['UDA', 'ODM'] as const) {
        it(`${abbrev}: each seat count is the legend's count for that seat across Kenya`, () => {
            const profile = partyProfile(PARTY_SEATS, abbrev)!;
            // The legend with no focus: legendScope gives nothing, so the counts are national.
            expect(noFocus).toBeNull();
            for (const seat of ELECTED) {
                const legend = buildLegend(PARTY_SEATS, seat, null, []);
                const row = legend.rows.find((r) => r.key === abbrev)!;
                const mine = profile.rows.find((r) => r.seat === seat)!;
                expect(mine.count, `${abbrev} ${seat}`).toBe(row.count);
                // The legend's total is the sum of all its rows (every party, "Other" included).
                const total = legend.rows.reduce((n, r) => n + (r.count ?? 0), 0);
                expect(mine.total).toBe(total);
            }
        });

        it(`${abbrev}: the nominated counts are the chamber's counts less the elected seats in it`, () => {
            const profile = partyProfile(PARTY_SEATS, abbrev)!;
            const count = (seat: string) =>
                profile.rows.find((r) => r.seat === seat)!.count;
            const na = chamberGroups(PARTY_SEATS, 'national_assembly').find(
                (g) => g.key === abbrev,
            )!.seats;
            const senate = chamberGroups(PARTY_SEATS, 'senate').find(
                (g) => g.key === abbrev,
            )!.seats;
            expect(count('nominated_mp')).toBe(
                na - count('mp') - count('woman_rep'),
            );
            expect(count('nominated_senator')).toBe(senate - count('senator'));
        });
    }

    it('lists the seats in a fixed order: the five elected seats, then nominated MPs and Senators', () => {
        const rows = partyProfile(PARTY_SEATS, 'UDA')!.rows;
        expect(rows.map((r) => r.seat)).toEqual([
            'governor',
            'senator',
            'woman_rep',
            'mp',
            'mca',
            'nominated_mp',
            'nominated_senator',
        ]);
        expect(rows.map((r) => r.label)).toEqual([
            'Governors',
            'Senators',
            'Woman Reps',
            'MPs',
            'MCAs',
            'Nominated MPs',
            'Nominated Senators',
        ]);
    });

    it('says "20 of 47" with the legend\'s rounded share, and totals the elected seats only', () => {
        const p = partyProfile(PARTY_SEATS, 'UDA')!;
        const gov = p.rows[0];
        expect([gov.count, gov.total, gov.share]).toEqual([20, 47, '43%']);
        // 20 + 22 + 21 + 119 + 517 = 699 of 47 + 47 + 47 + 290 + 1,450 = 1,881
        expect(p.elected).toEqual({ count: 699, total: 1881, share: '37%' });
        // Nominated seats are a count only: the Constitution fixes the seats, not the data's
        // current holders, so there is no "of N" or percentage to print.
        expect(p.rows.find((r) => r.seat === 'nominated_mp')).toMatchObject({
            count: 5,
            nominated: true,
            value: '5',
        });
        expect(p.rows.find((r) => r.seat === 'nominated_senator')!.value).toBe('9');
        expect(p.rows.find((r) => r.seat === 'governor')!.nominated).toBe(false);
    });

    it('only the elected seats can be shown on the map', () => {
        const p = partyProfile(PARTY_SEATS, 'UDA')!;
        expect(p.rows.map((r) => r.mapSeat)).toEqual([
            'governor',
            'senator',
            'woman_rep',
            'mp',
            'mca',
            null,
            null,
        ]);
    });

    it('carries the colour, coalition, former names and registration with its source', () => {
        const uda = partyProfile(PARTY_SEATS, 'UDA')!;
        expect(uda).toMatchObject({
            abbrev: 'UDA',
            name: 'United Democratic Alliance',
            colour: '#e8c547',
            hasOwnColour: true,
            coalition: 'Kenya Kwanza',
            formerNames: [{ abbrev: 'PDR', effectiveOn: null }],
            registration: {
                status: 'Fully registered',
                sourceUrl: 'https://orpp.or.ke/register.pdf',
                sourceName: 'orpp.or.ke',
            },
            path: '/party/uda',
        });
        expect(partyProfile(PARTY_SEATS, 'WDM-K')).toMatchObject({
            path: '/party/wdm-k',
            formerNames: [{ abbrev: 'WDM', effectiveOn: '2025-08-01' }],
        });
    });

    it('leaves out what the data does not have: no coalition, no registration', () => {
        const bare = seatsFrom([], {
            parties: [{ abbrev: 'BARE', name: 'Bare Party', coalition_2022: null, colour: null }],
        });
        const p = partyProfile(bare, 'BARE')!;
        expect(p.coalition).toBeNull();
        expect(p.registration).toBeNull();
        expect(p.formerNames).toEqual([]);
    });

    it('has no coalition without a source for it: a coalition on a party with no ORPP source is left out', () => {
        const unsourced = seatsFrom([], {
            parties: [
                { abbrev: 'UNS', name: 'Unsourced', coalition_2022: 'Some Coalition', colour: null },
            ],
        });
        expect(partyProfile(unsourced, 'UNS')!.coalition).toBeNull();
        expect(partyProfile(PARTY_SEATS, 'UDA')!.coalition).toBe('Kenya Kwanza');
    });

    it('treats a "none" coalition as unknown: the data has no source for it, so no coalition is shown', () => {
        expect(partyProfile(PARTY_SEATS, 'DP')!.coalition).toBeNull();
    });

    it('a party without a colour of its own is the grey "Other" and still has its seats', () => {
        const dp = partyProfile(PARTY_SEATS, 'DP')!;
        expect(dp.colour).toBe(OTHER);
        expect(dp.hasOwnColour).toBe(false);
        expect(dp.rows.find((r) => r.seat === 'mca')!.count).toBe(3);
    });

    it('a party with no seats has an empty profile, and keeps its registration', () => {
        const p = partyProfile(PARTY_SEATS, 'NOSEAT')!;
        expect(p.hasSeats).toBe(false);
        expect(p.elected.count).toBe(0);
        expect(p.rows.every((r) => r.count === 0)).toBe(true);
        expect(p.registration?.status).toBe('Fully registered');
        expect(partyProfile(PARTY_SEATS, 'UDA')!.hasSeats).toBe(true);
    });

    it('has the date and sources of the seats it counts', () => {
        const p = partyProfile(PARTY_SEATS, 'UDA')!;
        expect(p.asOf).toBe('2026-07-16');
        expect(p.sources).toEqual(['IEBC gazette notices']);
        expect(p.source).toBe('IEBC gazette notices');
    });

    it('is not offered for independents, "other" or a party the data does not have', () => {
        expect(partyProfile(PARTY_SEATS, 'IND')).toBeNull();
        expect(partyProfile(PARTY_SEATS, 'other')).toBeNull();
        expect(partyProfile(PARTY_SEATS, 'NOPE')).toBeNull();
    });
});

describe('findParty', () => {
    it('finds a party by the lower-case address, and never the independents', () => {
        expect(findParty(PARTY_SEATS, 'uda')?.abbrev).toBe('UDA');
        expect(findParty(PARTY_SEATS, 'wdm-k')?.abbrev).toBe('WDM-K');
        expect(findParty(PARTY_SEATS, 'ind')).toBeUndefined();
        expect(findParty(PARTY_SEATS, 'zzz')).toBeUndefined();
        expect(PARTIES.length).toBeGreaterThan(3);
    });
});

describe('party paths', () => {
    it('carries the scope as ?in=county-47 and reads it back', () => {
        const nairobi = { level: 'county', code: 47 } as const;
        const mathare = { level: 'constituency', code: 290 } as const;
        expect(partyPath('UDA', nairobi)).toBe('/party/uda?in=county-47');
        expect(partyPath('WDM-K', mathare)).toBe('/party/wdm-k?in=constituency-290');
        expect(partyPath('UDA', null)).toBe('/party/uda');
        for (const scope of [nairobi, mathare, null])
            expect(parsePartyPath(partyPath('WDM-K', scope))).toEqual({
                abbrev: 'wdm-k',
                scope,
            });
        // Anything else after ?in= is all of Kenya, not an error.
        for (const bad of ['ward-1', 'county-0', 'county-x', 'county', '', 'county-047'])
            expect(parsePartyPath(`/party/uda?in=${bad}`)).toEqual({
                abbrev: 'uda',
                scope: null,
            });
        expect(parsePartyPath('/party/uda?x=1&in=county-1')?.scope).toEqual({ level: 'county', code: 1 });
    });

    it('writes and reads /party/{abbrev} in lower case', () => {
        expect(partyPath('UDA')).toBe('/party/uda');
        expect(partyPath('WDM-K')).toBe('/party/wdm-k');
        expect(parsePartyPath('/party/uda')).toEqual({ abbrev: 'uda', scope: null });
        expect(parsePartyPath('/party/wdm-k/')).toEqual({ abbrev: 'wdm-k', scope: null });
        expect(parsePartyPath('/party/')).toBeNull();
        expect(parsePartyPath('/party/a_b')).toBeNull();
        expect(parsePartyPath('/county/47')).toBeNull();
        expect(parsePartyPath('/party/uda/extra')).toBeNull();
    });
});

// ---- scope: a county or a constituency instead of all of Kenya ----------------------------
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scopeChoices, scopeFor } from '@/lib/party';
import type { Holder } from '@/lib/seats';
import { type Unit } from '@/lib/units';
import { HOLDERS } from './partyFixtures';

const units: Unit[] = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../public/boundaries/units.json'), 'utf8'),
);
const index = UnitIndex.fromRows(units);
const NAIROBI = { level: 'county', code: 47 } as const;
const MATHARE = { level: 'constituency', code: 290 } as const;
const wardsOf = (level: 'county' | 'constituency', code: number): number[] => {
    const down = (l: string, c: number): number[] =>
        l === 'ward' ? [c] : index.children(l as 'county', c).flatMap((u) => down(u.l, u.c));
    return down(level, code);
};
const constituenciesOf = (code: number) => index.children('county', code).map((u) => u.c);

/** The sample seats, with some of Nairobi City's seats given to UDA so its numbers are not all zero. */
function seatsWithNairobi() {
    const nairobiWards = wardsOf('county', 47);
    const give = (h: Holder, party: string): Holder => ({ ...h, party });
    const holders = HOLDERS.map((h) => {
        if (h.seat === 'governor' && h.code === 47) return give(h, 'UDA');
        if (h.seat === 'mp' && constituenciesOf(47).slice(0, 5).includes(h.code)) return give(h, 'UDA');
        if (h.seat === 'mp' && h.code === 290) return give(h, 'ODM');
        if (h.seat === 'mca' && nairobiWards.slice(0, 30).includes(h.code)) return give(h, 'UDA');
        if (h.seat === 'mca' && nairobiWards.slice(30, 50).includes(h.code)) return give(h, 'ODM');
        return h;
    });
    return seatsFrom(holders);
}
const SCOPED = seatsWithNairobi();

describe('the scope of a profile', () => {
    it('is the focus: a ward counts as its constituency, a constituency or county as itself, Kenya as nothing', () => {
        const ward = units.find((u) => u.l === 'ward' && u.p === 290)!;
        expect(scopeFor(index, { level: 'ward', code: ward.c })).toEqual(MATHARE);
        expect(scopeFor(index, MATHARE)).toEqual(MATHARE);
        expect(scopeFor(index, NAIROBI)).toEqual(NAIROBI);
        expect(scopeFor(index, null)).toBeNull();
    });

    it('offers Kenya, the county and the constituency the focus is in, most general first', () => {
        const ward = units.find((u) => u.l === 'ward' && u.p === 290)!;
        expect(
            scopeChoices(index, { level: 'ward', code: ward.c }, scopeFor(index, { level: 'ward', code: ward.c })).map((c) => [c.label, c.scope]),
        ).toEqual([
            ['Across Kenya', null],
            ['In Nairobi City', NAIROBI],
            ['In Mathare', MATHARE],
        ]);
        expect(scopeChoices(index, NAIROBI, NAIROBI).map((c) => c.label)).toEqual([
            'Across Kenya',
            'In Nairobi City',
        ]);
        expect(scopeChoices(index, null, null).map((c) => c.label)).toEqual(['Across Kenya']);
        // A deep link can name a scope the map is not focused on: it is still offered.
        expect(scopeChoices(index, null, NAIROBI).map((c) => c.label)).toEqual([
            'Across Kenya',
            'In Nairobi City',
        ]);
    });

    for (const [name, scope, focusRows] of [
        ['Nairobi City', NAIROBI, ['governor', 'senator', 'woman_rep', 'mp', 'mca']],
        ['Mathare', MATHARE, ['mp', 'mca']],
    ] as const)
        for (const abbrev of ['UDA', 'ODM'])
            it(`${abbrev} in ${name}: every count and total is the legend's for that focus`, () => {
                const p = partyProfile(SCOPED, abbrev, { index, scope })!;
                expect(p.rows.map((r) => r.seat)).toEqual(focusRows);
                for (const r of p.rows) {
                    const seat = r.seat as 'governor';
                    const found = legendScope(index, seat, scope)!;
                    const legend = buildLegend(SCOPED, seat, { codes: found.codes, unitName: found.unit.n }, []);
                    const row = legend.rows.find((x) => x.key === abbrev);
                    expect(r.count, `${abbrev} ${r.seat}`).toBe(row?.count ?? 0);
                    expect(r.total).toBe(legend.rows.reduce((n, x) => n + (x.count ?? 0), 0));
                }
            });

    it('says "held" or "not held by UDA" for a seat that is one unit, and "n of N <units>" for the rest', () => {
        const p = partyProfile(SCOPED, 'UDA', { index, scope: NAIROBI })!;
        const row = (seat: string) => p.rows.find((r) => r.seat === seat)!;
        expect(row('governor')).toMatchObject({ single: true, count: 1, value: 'Held' });
        expect(row('senator')).toMatchObject({ single: true, count: 0, value: 'Not held by UDA' });
        expect(row('mp')).toMatchObject({ single: false, count: 5, total: 17, value: '5 of 17 constituencies (29%)' });
        expect(row('mca')).toMatchObject({ count: 30, total: 85, value: '30 of 85 wards (35%)' });
        const m = partyProfile(SCOPED, 'ODM', { index, scope: MATHARE })!;
        expect(m.rows[0]).toMatchObject({ seat: 'mp', single: true, value: 'Held' });
        expect(m.rows[1].value).toMatch(/^\d+ of \d+ wards \(\d+%\)$/);
        expect(partyProfile(SCOPED, 'UDA', { index, scope: MATHARE })!.rows[0].value).toBe('Not held by UDA');
    });

    it('has no nominated rows below Kenya, and totals the elected seats it lists', () => {
        const p = partyProfile(SCOPED, 'UDA', { index, scope: NAIROBI })!;
        expect(p.rows.some((r) => r.seat.startsWith('nominated'))).toBe(false);
        expect(p.elected).toMatchObject({ count: 1 + 0 + 0 + 5 + 30, total: 1 + 1 + 1 + 17 + 85 });
    });

    it('names its scope, and its address carries it', () => {
        const p = partyProfile(SCOPED, 'UDA', { index, scope: NAIROBI })!;
        expect(p.scope).toEqual({ level: 'county', code: 47, name: 'Nairobi City' });
        expect(p.path).toBe('/party/uda?in=county-47');
        const national = partyProfile(SCOPED, 'UDA', { index })!;
        expect(national.scope).toBeNull();
        expect(national.path).toBe('/party/uda');
    });

    it('a scope the units do not have is Kenya', () => {
        const p = partyProfile(SCOPED, 'UDA', { index, scope: { level: 'county', code: 99 } })!;
        expect(p.scope).toBeNull();
        expect(p.rows).toHaveLength(7);
    });

    it('a party with seats elsewhere but none in the scope says "No current seats" there', () => {
        const p = partyProfile(SCOPED, 'WDM-K', { index, scope: NAIROBI })!;
        expect(p.hasSeats).toBe(false);
        expect(p.rows.every((r) => r.count === 0)).toBe(true);
    });
});

describe('where a party holds the most MCA seats', () => {
    const counties = units.filter((u) => u.l === 'county');
    const expected = (abbrev: string) =>
        counties
            .map((c) => {
                const wards = wardsOf('county', c.c);
                const n = SCOPED.holders.filter(
                    (h) => h.seat === 'mca' && h.party === abbrev && wards.includes(h.code),
                ).length;
                return { code: c.c, name: c.n, count: n, total: wards.length };
            })
            .filter((c) => c.count > 0)
            .sort((a, b) => b.count - a.count || a.code - b.code)
            .slice(0, 5);

    for (const abbrev of ['UDA', 'ODM'])
        it(`${abbrev}: the five counties with the most of its MCA seats, ties by county code, "of N wards"`, () => {
            const p = partyProfile(SCOPED, abbrev, { index })!;
            const want = expected(abbrev);
            expect(p.topCounties.map((c) => [c.code, c.name, c.count, c.total])).toEqual(
                want.map((c) => [c.code, c.name, c.count, c.total]),
            );
            expect(p.topCounties.map((c) => c.value)).toEqual(
                want.map((c) => `${c.count} of ${c.total} wards`),
            );
            expect(p.topCounties).toHaveLength(5);
        });

    it('breaks a tie by the lower county code, and leaves out counties with none', () => {
        // Give a party exactly two wards in each of three counties (codes 5, 3, 9) and one in county 1.
        const give = (county: number, n: number) => wardsOf('county', county).slice(0, n);
        const mine = new Set([...give(5, 2), ...give(3, 2), ...give(9, 2), ...give(1, 1)]);
        const holders = HOLDERS.map((h) =>
            h.seat === 'mca' ? { ...h, party: mine.has(h.code) ? 'UDA' : 'IND' } : h,
        );
        const p = partyProfile(seatsFrom(holders), 'UDA', { index })!;
        expect(p.topCounties.map((c) => [c.code, c.count])).toEqual([
            [3, 2],
            [5, 2],
            [9, 2],
            [1, 1],
        ]);
    });

    it('is the general ranking, for MCA seats, five at most', () => {
        for (const abbrev of ['UDA', 'ODM'])
            expect(partyProfile(SCOPED, abbrev, { index })!.topCounties).toEqual(
                topCounties(SCOPED, index, { seat: 'mca', group: abbrev, limit: 5 }),
            );
    });

    it('ranks the counties for MP seats too, by constituencies, and for independents', () => {
        const constituenciesOf = (county: number) =>
            units.filter((u) => u.l === 'constituency' && u.p === county).map((u) => u.c);
        for (const group of ['UDA', 'IND']) {
            const want = counties
                .map((c) => {
                    const mine = constituenciesOf(c.c);
                    const n = SCOPED.holders.filter(
                        (h) => h.seat === 'mp' && h.party === group && mine.includes(h.code),
                    ).length;
                    return { code: c.c, count: n, total: mine.length };
                })
                .filter((c) => c.count > 0)
                .sort((a, b) => b.count - a.count || a.code - b.code);
            const got = topCounties(SCOPED, index, { seat: 'mp', group });
            expect(got.map((c) => ({ code: c.code, count: c.count, total: c.total })), group).toEqual(
                want,
            );
            if (got.length)
                expect(got[0].value).toBe(
                    `${got[0].count} of ${got[0].total} ${got[0].total === 1 ? 'constituency' : 'constituencies'}`,
                );
        }
        // Without a limit every county with any is listed; with one, the first that many.
        const all = topCounties(SCOPED, index, { seat: 'mca', group: 'UDA' });
        expect(all.length).toBeGreaterThan(10);
        expect(topCounties(SCOPED, index, { seat: 'mca', group: 'UDA', limit: 10 })).toEqual(
            all.slice(0, 10),
        );
        expect(topCounties(SCOPED, index, { seat: 'mca', group: 'NOSEAT' })).toEqual([]);
    });

    it('is a national list: none within a county or without the units', () => {
        expect(partyProfile(SCOPED, 'UDA', { index, scope: NAIROBI })!.topCounties).toEqual([]);
        expect(partyProfile(SCOPED, 'UDA')!.topCounties).toEqual([]);
        expect(partyProfile(SCOPED, 'NOSEAT', { index })!.topCounties).toEqual([]);
    });
});
