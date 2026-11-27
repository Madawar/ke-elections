import { describe, expect, it } from 'vitest';
import { type TapFeature, tapTarget } from '@/lib/map/tap';

// Features as the map reports them under a finger: the unit's level and code, and its parents'
// codes (a constituency carries its county, a ward carries both).
const county = (code: number): TapFeature => ({ level: 'county', code });
const constituency = (code: number, county_code: number): TapFeature => ({
    level: 'constituency',
    code,
    county_code,
});
const ward = (
    code: number,
    constituency_code: number,
    county_code: number,
): TapFeature => ({ level: 'ward', code, constituency_code, county_code });

// Machakos is county 16; Mwala 91 is one of its constituencies; Kibwezi West 99 is in Makueni (17).
const machakos = county(16);
const mwala = constituency(91, 16);
const kibwezi = constituency(99, 17);
const muthetheni = ward(450, 91, 16);
const makueniWard = ward(480, 99, 17);

describe('tapTarget with nothing focused', () => {
    it('picks the county under the finger, whatever finer units are also drawn', () => {
        expect(tapTarget(null, [muthetheni, mwala, machakos])).toEqual({
            level: 'county',
            code: 16,
        });
    });

    it('does nothing on empty ground', () => {
        expect(tapTarget(null, [])).toBeNull();
    });

    it('ignores features that have no county on the list (nothing to pick)', () => {
        expect(tapTarget(null, [mwala])).toBeNull();
    });
});

describe('tapTarget with a county focused', () => {
    const focus = { level: 'county' as const, code: 16 };

    it('picks the constituency inside it, not the ward under it', () => {
        expect(tapTarget(focus, [muthetheni, mwala, machakos])).toEqual({
            level: 'constituency',
            code: 91,
        });
    });

    it('treats the county itself as inside, with nothing deeper to pick', () => {
        expect(tapTarget(focus, [machakos])).toBe('inside');
    });

    it('reports a tap on another county as outside', () => {
        expect(tapTarget(focus, [county(17), kibwezi, makueniWard])).toBe(
            'outside',
        );
    });

    it('reports empty ground as outside', () => {
        expect(tapTarget(focus, [])).toBe('outside');
    });
});

describe('tapTarget with a constituency focused', () => {
    const focus = { level: 'constituency' as const, code: 91 };

    it('picks the ward inside it', () => {
        expect(tapTarget(focus, [muthetheni, mwala, machakos])).toEqual({
            level: 'ward',
            code: 450,
        });
    });

    it('treats the constituency itself as inside when no ward is under the finger', () => {
        expect(tapTarget(focus, [mwala, machakos])).toBe('inside');
    });

    it('reports a sibling constituency, in the same county, as outside', () => {
        expect(tapTarget(focus, [constituency(92, 16), machakos])).toBe(
            'outside',
        );
    });

    it('reports another county as outside', () => {
        expect(tapTarget(focus, [makueniWard, kibwezi, county(17)])).toBe(
            'outside',
        );
    });
});

describe('tapTarget with a ward focused', () => {
    const focus = { level: 'ward' as const, code: 450 };

    it('does nothing for a tap inside the ward', () => {
        expect(tapTarget(focus, [muthetheni, mwala, machakos])).toBe('inside');
    });

    it('reports a neighbouring ward as outside', () => {
        expect(tapTarget(focus, [ward(451, 91, 16), mwala, machakos])).toBe(
            'outside',
        );
    });

    it('reports empty ground as outside', () => {
        expect(tapTarget(focus, [])).toBe('outside');
    });
});
