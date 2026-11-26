import { describe, expect, it } from 'vitest';
import {
    calloutsFor,
    headlineFor,
    parseViewQuery,
    scopeLineFor,
    snapshotView,
    viewPath,
} from '@/lib/export/viewState';
import { OTHER } from '@/lib/map/theme';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const mcaUdaOdm = () =>
    snapshotView({
        seats: VIEW_SEATS,
        index: viewIndex,
        seat: 'mca',
        focus: null,
        only: ['UDA', 'ODM'],
        showSurroundings: false,
        theme: 'dark',
    });
const nairobiMp = (only: string[] = []) =>
    snapshotView({
        seats: VIEW_SEATS,
        index: viewIndex,
        seat: 'mp',
        focus: { level: 'county', code: 47 },
        only,
        showSurroundings: true,
        theme: 'light',
    });

describe('headlineFor', () => {
    it('lists the highlighted parties with their national counts', () => {
        expect(headlineFor(mcaUdaOdm())).toBe(
            'MCA seats across Kenya: UDA 523, ODM 312',
        );
    });

    it('names the top party in the focused unit when nothing is highlighted', () => {
        expect(headlineFor(nairobiMp())).toBe(
            'MP seats in Nairobi City: ODM 8 of 17',
        );
    });

    it('reads a single seat as who holds it, and says when there is no data', () => {
        const governor = snapshotView({
            seats: VIEW_SEATS,
            index: viewIndex,
            seat: 'governor',
            focus: { level: 'constituency', code: 290 },
            only: [],
            showSurroundings: false,
            theme: 'light',
        });
        expect(headlineFor(governor)).toBe(
            'Governor seat in Nairobi City: UDA',
        );
        const senator = snapshotView({
            seats: VIEW_SEATS,
            index: viewIndex,
            seat: 'senator',
            focus: null,
            only: [],
            showSurroundings: false,
            theme: 'light',
        });
        expect(headlineFor(senator)).toBe(
            'Senator seats across Kenya: no approved data yet',
        );
    });

    it('names more than three highlighted parties by count', () => {
        const view = snapshotView({
            seats: VIEW_SEATS,
            index: viewIndex,
            seat: 'mca',
            focus: null,
            only: ['UDA', 'ODM', 'JP', 'UDM', 'IND'],
            showSurroundings: false,
            theme: 'light',
        });
        expect(headlineFor(view)).toBe(
            'MCA seats across Kenya: UDA 523, ODM 312, Independent 114 and 2 more parties',
        );
    });

    it('never describes the numbers with adjectives', () => {
        for (const view of [mcaUdaOdm(), nairobiMp(), nairobiMp(['ODM'])])
            expect(headlineFor(view)).not.toMatch(
                /dominat|sweep|landslide|wins|leads|race/i,
            );
    });
});

describe('snapshotView', () => {
    it('takes the legend rows, splitting independents out of "Other"', () => {
        const view = mcaUdaOdm();
        expect(view.kind).toBe('party');
        expect(view.total).toBe(1450);
        expect(view.rows.map((r) => [r.label, r.count, r.share])).toEqual([
            ['UDA', 523, '36%'],
            ['ODM', 312, '22%'],
            ['Independent', 114, '8%'],
            ['JP', 76, '5%'],
            ['WDM-K', 68, '5%'],
            ['UDM', 36, '2%'],
            ['FORD-K', 33, '2%'],
            ['ANC', 31, '2%'],
            ['Other', 257, '18%'],
        ]);
        const other = view.rows.at(-1)!;
        expect(other.kind).toBe('other');
        expect(other.colour).toBe(OTHER);
        // Independents get their own neutral colour, never the "Other" grey.
        const ind = view.rows[2];
        expect(ind.kind).toBe('independent');
        expect(ind.colour).not.toBe(OTHER);
        expect(
            view.rows.filter((r) => r.highlighted).map((r) => r.key),
        ).toEqual(['UDA', 'ODM']);
    });

    it('scopes the counts and the heading to the focused unit', () => {
        const view = nairobiMp();
        expect(view.scope?.name).toBe('Nairobi City');
        expect(view.title).toBe('MP seats in Nairobi City by party');
        expect(view.total).toBe(17);
        expect(view.rows.map((r) => [r.label, r.count])).toEqual([
            ['ODM', 8],
            ['UDA', 4],
            ['JP', 3],
            ['WDM-K', 1],
            ['Independent', 1],
        ]);
        expect(scopeLineFor(view)).toBe('In Nairobi City’s 17 constituencies');
        expect(scopeLineFor(mcaUdaOdm())).toBe(
            'Across Kenya, highlighting UDA and ODM',
        );
    });

    it('gives the source and the date the data describes', () => {
        const view = mcaUdaOdm();
        expect(view.source).toBe('IEBC gazette notices');
        expect(view.asOf).toBe('2026-07-16');
        expect(view.sample).toBe(false);
    });
});

describe('calloutsFor', () => {
    it('shows the highlighted parties, or the top two when none are', () => {
        expect(calloutsFor(mcaUdaOdm()).map((c) => [c.label, c.count])).toEqual(
            [
                ['UDA', 523],
                ['ODM', 312],
            ],
        );
        expect(calloutsFor(nairobiMp()).map((c) => [c.label, c.count])).toEqual(
            [
                ['ODM', 8],
                ['UDA', 4],
            ],
        );
        expect(calloutsFor(nairobiMp(['JP'])).map((c) => c.label)).toEqual([
            'JP',
        ]);
    });
});

describe('deep link', () => {
    it('encodes the seat, the highlighted parties and the focused unit', () => {
        expect(mcaUdaOdm().path).toBe('/?seat=mca&parties=uda,odm');
        expect(nairobiMp().path).toBe('/county/47?seat=mp');
        expect(viewPath('mp', null, ['WDM-K'])).toBe('/?seat=mp&parties=wdm-k');
    });

    it('restores the seat and the parties from the query', () => {
        expect(parseViewQuery('?seat=mca&parties=uda,odm', VIEW_SEATS)).toEqual(
            { seat: 'mca', parties: ['UDA', 'ODM'] },
        );
        expect(
            parseViewQuery('?seat=mp&parties=wdm-k,nope', VIEW_SEATS),
        ).toEqual({ seat: 'mp', parties: ['WDM-K'] });
        expect(parseViewQuery('?seat=president', VIEW_SEATS)).toEqual({
            seat: null,
            parties: [],
        });
        expect(parseViewQuery('', VIEW_SEATS)).toEqual({
            seat: null,
            parties: [],
        });
    });
});
