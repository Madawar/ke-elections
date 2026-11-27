// "Side by side": two counties on one seat, ordered by IEBC code, each half's numbers from the
// legend's own functions, the three county seats' parties from leadersFor, the "Compare with"
// choice (options, default and remembered pick), the two map slots by code, the fixed headline,
// the caption, the file name and the link. Real unit index, placeholder holders.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { versusCaption, xLength } from '@/lib/export/caption';
import { sourceLine } from '@/lib/export/format';
import {
    filenameOf,
    headlineEditable,
    headlineOf,
    mapSlotsOf,
    sizesOf,
    versusCard,
} from '@/lib/export/shareView';
import {
    VERSUS_PICK_KEY,
    VERSUS_SCOPE,
    type VersusSeat,
    readVersusPick,
    rememberVersusPick,
    versusCardView,
    versusDefault,
    versusOptions,
} from '@/lib/export/versusCard';
import { parseViewQuery } from '@/lib/export/viewState';
import { leadersFor } from '@/lib/leaders';
import { buildLegend } from '@/lib/legend';
import { THEMES } from '@/lib/map/theme';
import { type SeatsData, legendScope, seatSources } from '@/lib/seats';
import { NUMBERS_SEATS, numbersIndex as index } from './numbersFixtures';

const view = (a: number, b: number, seat: VersusSeat = 'mca', seats: SeatsData = NUMBERS_SEATS) =>
    versusCardView({ seats, index, seat, counties: [a, b], theme: 'light' });
const name = (c: number) => index.get('county', c)!.n;

describe('versusCardView', () => {
    it('orders the halves by IEBC code, whichever county was in focus', () => {
        expect(view(47, 1).halves.map((h) => h.code)).toEqual([1, 47]);
        expect(view(1, 47).halves.map((h) => h.code)).toEqual([1, 47]);
        expect(view(47, 1).halves.map((h) => h.name)).toEqual(['Mombasa', 'Nairobi City']);
    });

    it('takes each half’s counts from the legend for that county and seat, in its order, with the seats no one holds', () => {
        for (const seat of ['mca', 'mp'] as const)
            for (const [a, b] of [[47, 1], [37, 38], [28, 13]]) {
                const card = view(a, b, seat);
                for (const h of card.halves) {
                    const scope = legendScope(index, seat, { level: 'county', code: h.code })!;
                    const legend = buildLegend(NUMBERS_SEATS, seat, { codes: scope.codes, unitName: scope.unit.n }, []);
                    const own = h.key.filter((k) => k.key !== 'none');
                    expect(own).toEqual(
                        legend.rows.map((r) => ({ key: r.key, label: r.label, colour: r.colour, count: r.count })),
                    );
                    const total = h.key.reduce((n, k) => n + k.count, 0);
                    expect(total, `${seat} ${h.code}`).toBe(scope.codes.size);
                    expect(h.seats).toBe(scope.codes.size);
                }
            }
    });

    it('says how many seats each county has, from the unit index', () => {
        const constituencies = (c: number) => index.children('county', c).length;
        const wards = (c: number) =>
            index.children('county', c).flatMap((k) => index.children('constituency', k.c)).length;
        const card = view(47, 1);
        expect(card.halves[1].units).toBe(`${wards(47)} wards in ${constituencies(47)} constituencies`);
        expect(card.halves[0].units).toBe(`${wards(1)} wards in ${constituencies(1)} constituencies`);
        expect(view(47, 1, 'mp').halves[1].units).toBe(`${constituencies(47)} constituencies`);
    });

    it('counts seats with no approved holder as "No approved holder yet", last, in the no-data colour', () => {
        const scope = legendScope(index, 'mca', { level: 'county', code: 1 })!;
        const gone = [...scope.codes].slice(0, 3);
        const seats = {
            ...NUMBERS_SEATS,
            holders: NUMBERS_SEATS.holders.filter((h) => !(h.seat === 'mca' && gone.includes(h.code))),
        };
        const h = view(1, 2, 'mca', seats).halves[0];
        expect(h.key.at(-1)).toEqual({ key: 'none', label: 'No approved holder yet', colour: THEMES.light.noData, count: 3 });
        expect(view(1, 2).halves[0].key.some((k) => k.key === 'none')).toBe(false);
    });

    it('names the party of each county seat from leadersFor, no names, and "No approved data yet" for a vacancy', () => {
        const card = view(47, 1);
        for (const h of card.halves) {
            const rows = leadersFor({ l: 'county', c: h.code }, NUMBERS_SEATS, index);
            expect(h.leaders.map((l) => l.label)).toEqual(['Governor', 'Senator', 'Woman Rep']);
            for (const l of h.leaders) {
                const row = rows.find((r) => r.seat === l.seat)!;
                expect(l.party).toEqual(
                    row.holder ? { label: row.holder.partyLabel, colour: row.holder.colour } : null,
                );
            }
            expect(JSON.stringify(h)).not.toContain('Placeholder');
        }
        const seats = { ...NUMBERS_SEATS, holders: NUMBERS_SEATS.holders.filter((x) => !(x.seat === 'senator' && x.code === 1)) };
        expect(view(1, 2, 'mca', seats).halves[0].leaders[1].party).toBeNull();
        // Independents read "Independent".
        const ind = NUMBERS_SEATS.holders.find((x) => x.seat === 'governor' && x.party === 'IND')!;
        expect(view(ind.code, ind.code === 1 ? 2 : 1).halves.find((h) => h.code === ind.code)!.leaders[0].party?.label).toBe(
            'Independent',
        );
    });

    it('is sourced from both counties’ holders of that seat and of the three county seats, and links to that seat’s map', () => {
        const card = view(47, 1);
        const urls = [1, 47].flatMap((c) => [
            ...seatSources(NUMBERS_SEATS, 'mca', legendScope(index, 'mca', { level: 'county', code: c })!.codes),
            ...(['governor', 'senator', 'woman_rep'] as const).flatMap((s) => seatSources(NUMBERS_SEATS, s, new Set([c]))),
        ]);
        expect(card.source).toBe(sourceLine(urls));
        expect(card.path).toBe('/?seat=mca');
        expect(view(47, 1, 'mp').path).toBe('/?seat=mp');
        expect(parseViewQuery('?seat=mca', NUMBERS_SEATS)).toEqual({ seat: 'mca', parties: [] });
    });

    it('keeps long county names exactly as the index spells them', () => {
        const card = view(28, 13);
        expect(card.halves.map((h) => h.name)).toEqual(['Tharaka - Nithi', 'Elgeyo/Marakwet']);
        expect(headlineOf(card)).toBe('MCA seats: Tharaka - Nithi and Elgeyo/Marakwet');
    });
});

describe('the "Compare with" choice', () => {
    afterEach(() => localStorage.clear());

    it('offers every other county by name, alphabetically, valued by code', () => {
        const options = versusOptions(index, 47);
        expect(options).toHaveLength(46);
        expect(options.some((o) => o.value === '47')).toBe(false);
        const labels = options.map((o) => o.label);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
        for (const o of options) expect(name(Number(o.value))).toBe(o.label);
    });

    it('defaults to the county with the next code (after 47 comes 1), or the remembered pick while it is valid', () => {
        expect(versusDefault(index, 37, null)).toBe(38);
        expect(versusDefault(index, 47, null)).toBe(1);
        expect(versusDefault(index, 47, 22)).toBe(22);
        expect(versusDefault(index, 22, 22)).toBe(23);
        expect(versusDefault(index, 5, 99)).toBe(6);
    });

    it('remembers the pick per viewer, and works without storage', () => {
        expect(readVersusPick()).toBeNull();
        rememberVersusPick('22');
        expect(localStorage.getItem(VERSUS_PICK_KEY)).toBe('22');
        expect(readVersusPick()).toBe(22);
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
        });
        expect(readVersusPick()).toBeNull();
        expect(() => rememberVersusPick('3')).not.toThrow();
        vi.unstubAllGlobals();
    });

    it('is a card entry with its choice: the default view, make for another pick, remember called back', () => {
        const remember = vi.fn();
        const card = versusCard({ seats: NUMBERS_SEATS, index, seat: 'mca', county: 47, theme: 'light', remembered: null, remember });
        expect(card.key).toBe('versus');
        expect(card.label).toBe('Side by side');
        expect(card.choice!.label).toBe('Compare with');
        expect(card.choice!.value).toBe('1');
        expect(card.view.kind).toBe('versus');
        expect((card.view as ReturnType<typeof view>).halves.map((h) => h.code)).toEqual([1, 47]);
        const other = card.choice!.make('22') as ReturnType<typeof view>;
        expect(other.halves.map((h) => h.code)).toEqual([22, 47]);
        card.choice!.remember!('22');
        expect(remember).toHaveBeenCalledWith('22');
        const kept = versusCard({ seats: NUMBERS_SEATS, index, seat: 'mca', county: 47, theme: 'light', remembered: 22, remember });
        expect(kept.choice!.value).toBe('22');
    });
});

describe('the registry entry', () => {
    const URL = 'https://example.org/?seat=mca';

    it('comes in X and story, with a fixed headline', () => {
        const card = view(47, 1);
        expect(sizesOf(card)).toEqual(['x', 'story']);
        expect(headlineEditable(card)).toBe(false);
        expect(headlineOf(card)).toBe('MCA seats: Mombasa and Nairobi City');
        expect(headlineOf(view(32, 22, 'mp'))).toBe('MP seats: Kiambu and Nakuru');
    });

    it('names its file by the two codes, the seat and the size', () => {
        expect(filenameOf(view(47, 1), 'x')).toBe('kenya-electoral-map-side-by-side-1-47-mca-x.png');
        expect(filenameOf(view(32, 22, 'mp'), 'story')).toBe('kenya-electoral-map-side-by-side-22-32-mp-story.png');
    });

    it('draws two maps, a and b by position, each its county in focus on that seat, nothing highlighted, no MP outlines, one box size', () => {
        for (const size of ['x', 'story'] as const)
            for (const seat of ['mca', 'mp'] as const) {
                const card = view(47, 1, seat);
                const slots = mapSlotsOf(size, card, { headline: headlineOf(card), url: URL, mapAspect: 1 });
                expect(slots.map((s) => s.key)).toEqual(['a', 'b']);
                expect(slots.map((s) => s.spec.focus?.code)).toEqual([1, 47]);
                for (const s of slots) {
                    expect(s.spec.seat).toBe(seat);
                    expect(s.spec.focus?.level).toBe('county');
                    expect(s.spec.only).toEqual([]);
                    expect(s.spec.outline).toBe(false);
                    expect(s.spec.colouring).toBeUndefined();
                }
                expect([slots[0].box.w, slots[0].box.h]).toEqual([slots[1].box.w, slots[1].box.h]);
            }
    });
});

describe('versusCaption', () => {
    const URL = 'https://example.org/?seat=mca';

    it('gives both counties’ counts in the card’s order, the source, the date and the link', () => {
        const card = view(47, 1);
        for (const platform of ['instagram', 'x'] as const) {
            const text = versusCaption(card, URL, platform);
            const body = text.slice(text.indexOf('\n'));
            expect(body.indexOf('Mombasa')).toBeGreaterThan(-1);
            expect(body.indexOf('Mombasa')).toBeLessThan(body.indexOf('Nairobi City'));
            const first = card.halves[0].key[0];
            expect(text).toContain(`${first.label} ${first.count}`);
            expect(text).toContain('IEBC gazette notices');
            expect(text).toContain('16 July 2026');
            expect(text).toContain(URL);
        }
        const ig = versusCaption(card, URL, 'instagram');
        expect(ig).toContain(VERSUS_SCOPE);
        expect(ig).toContain('Governor:');
        for (const h of card.halves) for (const k of h.key) expect(ig).toContain(`${k.label} ${k.count}`);
    });

    it('stays within 280 on X for every county against its default pick, both seats', () => {
        for (const seat of ['mca', 'mp'] as const)
            for (let c = 1; c <= 47; c++) {
                const card = view(c, versusDefault(index, c, null), seat);
                const text = versusCaption(card, URL, 'x');
                expect(xLength(text), `${seat} ${c}`).toBeLessThanOrEqual(280);
                expect(text, `${seat} ${c}`).toContain(`${card.halves[0].name}:`);
                expect(text, `${seat} ${c}`).toContain(`${card.halves[1].name}:`);
            }
    });
});
