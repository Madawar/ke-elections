import { describe, expect, it } from 'vitest';
import {
    type RememberedModes,
    chipStepUp,
    modeForFocus,
    validSeatModes,
} from '@/lib/map/seatMode';

describe('validSeatModes', () => {
    it('offers every mode with nothing focused or a county focused', () => {
        const all = ['none', 'governor', 'senator', 'woman_rep', 'mp', 'mca'];
        for (const level of [null, 'county'] as const)
            expect(validSeatModes(level)).toEqual(
                expect.arrayContaining([...all, 'province']),
            );
    });

    it('offers None, MP and MCA inside a constituency', () => {
        expect(validSeatModes('constituency')).toEqual(['none', 'mp', 'mca']);
    });

    it('offers None and MCA inside a ward', () => {
        expect(validSeatModes('ward')).toEqual(['none', 'mca']);
    });
});

describe('modeForFocus', () => {
    it('keeps the mode when it is valid for the focus', () => {
        expect(modeForFocus('county', 'governor', {})).toBe('governor');
        expect(modeForFocus(null, 'senator', {})).toBe('senator');
        expect(modeForFocus('constituency', 'mca', {})).toBe('mca');
        // MP is a valid choice inside a constituency, and stays.
        expect(modeForFocus('constituency', 'mp', {})).toBe('mp');
        expect(modeForFocus('constituency', 'none', {})).toBe('none');
    });

    it('turns a county-wide seat into MCA inside a constituency, so its wards are coloured', () => {
        for (const mode of ['governor', 'senator', 'woman_rep'] as const)
            expect(modeForFocus('constituency', mode, {})).toBe('mca');
    });

    it('turns a county-wide seat or MP into MCA inside a ward', () => {
        for (const mode of ['governor', 'senator', 'woman_rep', 'mp'] as const)
            expect(modeForFocus('ward', mode, {})).toBe('mca');
    });

    it('turns the province tint into None below a county', () => {
        expect(modeForFocus('constituency', 'province', {})).toBe('none');
        expect(modeForFocus('ward', 'province', {})).toBe('none');
    });

    it('restores what the person chose at that level when they come back', () => {
        // Governor at county level, into a constituency (MP), back out again.
        const remembered: RememberedModes = { county: 'governor' };
        expect(modeForFocus('constituency', 'governor', remembered)).toBe(
            'mca',
        );
        expect(modeForFocus('county', 'mp', remembered)).toBe('governor');
        // Kenya shares the county level's choice.
        expect(modeForFocus(null, 'mp', remembered)).toBe('governor');
    });

    it('prefers a choice made at the level over the current mode', () => {
        expect(
            modeForFocus('constituency', 'governor', { constituency: 'mca' }),
        ).toBe('mca');
        expect(modeForFocus('ward', 'mp', { ward: 'none' })).toBe('none');
    });

    it('ignores a remembered mode that is not valid at the level', () => {
        expect(
            modeForFocus('constituency', 'governor', {
                constituency: 'senator',
            }),
        ).toBe('mca');
    });
});

describe('chipStepUp', () => {
    it('is null for a chip that shows at the focus level', () => {
        expect(chipStepUp(null, 'governor')).toBeNull();
        expect(chipStepUp('county', 'governor')).toBeNull();
        expect(chipStepUp('county', 'mp')).toBeNull();
        expect(chipStepUp('constituency', 'mp')).toBeNull();
        expect(chipStepUp('constituency', 'mca')).toBeNull();
        expect(chipStepUp('ward', 'mca')).toBeNull();
        expect(chipStepUp('ward', 'none')).toBeNull();
    });

    it('sends a county-wide seat up to the county from a constituency or a ward', () => {
        for (const level of ['constituency', 'ward'] as const)
            for (const seat of ['governor', 'senator', 'woman_rep'] as const)
                expect(chipStepUp(level, seat)).toBe('county');
    });

    it('sends MP up to the constituency from a ward', () => {
        expect(chipStepUp('ward', 'mp')).toBe('constituency');
    });
});

describe('the "County seats" mode', () => {
    it('shows with nothing focused or a county focused, and nowhere below', () => {
        expect(validSeatModes(null)).toContain('county_seats');
        expect(validSeatModes('county')).toContain('county_seats');
        expect(validSeatModes('constituency')).not.toContain('county_seats');
        expect(validSeatModes('ward')).not.toContain('county_seats');
    });

    it('gives way to MCA inside a constituency or a ward, and comes back at the county', () => {
        expect(modeForFocus('constituency', 'county_seats', {})).toBe('mca');
        expect(modeForFocus('ward', 'county_seats', {})).toBe('mca');
        const remembered: RememberedModes = { county: 'county_seats' };
        expect(modeForFocus('county', 'mca', remembered)).toBe('county_seats');
        expect(modeForFocus(null, 'mca', remembered)).toBe('county_seats');
    });

    it('steps up to the county from below, like the three seats it shows', () => {
        expect(chipStepUp('constituency', 'county_seats')).toBe('county');
        expect(chipStepUp('ward', 'county_seats')).toBe('county');
        expect(chipStepUp('county', 'county_seats')).toBeNull();
        expect(chipStepUp(null, 'county_seats')).toBeNull();
    });
});
