import { describe, expect, it } from 'vitest';
import {
    buildLegend,
    buildProvinceLegend,
    legendOpenAfterSelect,
    pruneParties,
    settingsCount,
    toggleParty,
} from '@/lib/legend';
import { OTHER } from '@/lib/map/theme';
import { type SeatsData, EMPTY_SEATS } from '@/lib/seats';

const holder = (seat: string, code: number, party: string) => ({
    seat,
    level: seat === 'governor' ? 'county' : 'constituency',
    code,
    name: 'X',
    party,
    basis: 'elected',
    started_on: '2022-08-09',
    source_url: 'https://example.org',
});

// Nine coloured parties (A1 holds the most seats), more than the seven the legend once capped at,
// and two without a colour (Z1, Z2): every coloured party gets a row, and only the uncoloured
// ones fold into "Other parties".
const coloured = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
const parties = [
    ...coloured.map((abbrev, i) => ({
        abbrev,
        name: `Party ${abbrev}`,
        coalition_2022: null,
        colour: `#0${i + 1}0000`,
    })),
    { abbrev: 'Z1', name: 'Zed one', coalition_2022: null, colour: null },
    { abbrev: 'Z2', name: 'Zed two', coalition_2022: null, colour: null },
];
let code = 0;
const holders: ReturnType<typeof holder>[] = [];
// A1 holds 9 MP seats, A2 8, ... A9 1; Z1 holds 2 and Z2 holds 1.
coloured.forEach((abbrev, i) => {
    for (let n = 0; n < 9 - i; n++) holders.push(holder('mp', ++code, abbrev));
});
holders.push(holder('mp', ++code, 'Z1'), holder('mp', ++code, 'Z1'));
holders.push(holder('mp', ++code, 'Z2'));
holders.push(holder('governor', 1, 'A9'));
const seats: SeatsData = {
    ...EMPTY_SEATS,
    parties,
    holders: holders as SeatsData['holders'],
};

describe('buildLegend', () => {
    const legend = buildLegend(seats, 'mp', null, []);

    it('gives every coloured party a row, however many, and folds only the uncoloured into Other parties, last', () => {
        const keys = legend.rows.map((r) => r.key);
        expect(keys).toEqual([...coloured, 'other']);
        const other = legend.rows.at(-1)!;
        expect(other.last).toBe(true);
        expect(other.colour).toBe(OTHER);
        // Z1 (2) + Z2 (1)
        expect(other.count).toBe(3);
        expect(other.parties).toBe(2);
    });

    it('lists only uncoloured parties as the members of Other parties, and one party per other row', () => {
        expect(legend.members.other.sort()).toEqual(['Z1', 'Z2']);
        // No party drawn in its own colour on the map hides in the grey row.
        const colourOf = new Map(parties.map((p) => [p.abbrev, p.colour]));
        for (const a of legend.members.other)
            expect(colourOf.get(a)).toBeNull();
        expect(legend.members.A1).toEqual(['A1']);
    });

    it('has no Other row when every party fits', () => {
        const small = buildLegend(
            { ...seats, holders: holders.slice(0, 3) as SeatsData['holders'] },
            'mp',
            null,
            [],
        );
        expect(small.rows.map((r) => r.key)).toEqual(['A1']);
        expect(small.members.other).toBeUndefined();
    });

    it('marks the rows that have a party profile: named parties, not Other parties or independents', () => {
        const withIndependents = buildLegend(
            {
                ...seats,
                holders: [...holders, holder('mp', 900, 'IND')] as SeatsData['holders'],
            },
            'mp',
            null,
            [],
        );
        const profiled = (key: string) =>
            withIndependents.rows.find((r) => r.key === key)?.party;
        expect(profiled('A1')).toBe('A1');
        expect(profiled('A9')).toBe('A9');
        expect(profiled('other')).toBeUndefined();
        expect(profiled('IND')).toBeUndefined();
    });

    it('says nothing is highlighted by default', () => {
        expect(legend.showing).toEqual([]);
        expect(legend.highlighted).toEqual([]);
        expect(legend.filtered).toBe(false);
        expect(legend.title).toBe('MP seats across Kenya by party');
        expect(legend.chipLabel).toBe('MP seats');
    });

    it('words the heading and chip for one, two and four parties', () => {
        const one = buildLegend(seats, 'mp', null, ['A1']);
        expect(one.showing).toEqual(['A1']);
        expect(one.title).toBe('MP seats across Kenya by party: showing A1');
        expect(one.chipLabel).toBe('MP seats: A1');

        const two = buildLegend(seats, 'mp', null, ['A1', 'A2']);
        expect(two.title).toBe(
            'MP seats across Kenya by party: showing A1, A2',
        );
        expect(two.chipLabel).toBe('MP seats: A1, A2');

        const four = buildLegend(seats, 'mp', null, ['A1', 'A2', 'A3', 'A4']);
        expect(four.title).toBe(
            'MP seats across Kenya by party: showing 4 parties',
        );
        expect(four.chipLabel).toBe('MP seats: 4 parties');
    });

    it('turns Other on only when every folded party is highlighted, and counts it once', () => {
        const some = buildLegend(seats, 'mp', null, ['Z1']);
        expect(some.highlighted).toEqual([]);
        // Parties that no single row stands for are still listed, and still count.
        expect(some.showing).toEqual(['Z1']);
        expect(some.filtered).toBe(true);

        const all = buildLegend(seats, 'mp', null, ['Z1', 'Z2']);
        expect(all.highlighted).toEqual(['other']);
        expect(all.showing).toEqual(['Other parties']);
        expect(all.title).toBe(
            'MP seats across Kenya by party: showing Other parties',
        );
    });

    it('counts only the seats in scope and names the unit', () => {
        const scoped = buildLegend(
            seats,
            'mp',
            { codes: new Set([1, 2, 3]), unitName: 'Nairobi City' },
            [],
        );
        // Codes 1 to 3 are all A1.
        expect(scoped.rows.map((r) => [r.key, r.count])).toEqual([['A1', 3]]);
        expect(scoped.title).toBe('MP seats in Nairobi City by party');
    });

    it('keeps a highlighted party that has no seats in scope in "showing"', () => {
        const scoped = buildLegend(
            seats,
            'mp',
            { codes: new Set([1]), unitName: 'Kisumu' },
            ['A9'],
        );
        expect(scoped.highlighted).toEqual([]);
        expect(scoped.showing).toEqual(['A9']);
        expect(scoped.filtered).toBe(true);
    });

    it('cites the source and the as-of date, and says when a seat has no holder yet', () => {
        expect(buildLegend(seats, 'mp', null, [], '9 August 2022').note).toBe(
            'Elected 2022, with changes since. Source: IEBC gazette notices, as of 9 August 2022',
        );
        expect(buildLegend(seats, 'mp', null, []).note).not.toContain('as of');
        expect(buildLegend(seats, 'senator', null, []).note).toMatch(
            /^No approved holder for this seat yet\. /,
        );
    });
});

describe('toggleParty', () => {
    const { members } = buildLegend(seats, 'mp', null, []);

    it('switches one party on and off, each independently', () => {
        let only = toggleParty(members, [], 'A1');
        expect(only).toEqual(['A1']);
        only = toggleParty(members, only, 'A2');
        expect(only).toEqual(['A1', 'A2']);
        only = toggleParty(members, only, 'A1');
        expect(only).toEqual(['A2']);
    });

    it('switches Other on as one unit: every folded party at once', () => {
        const only = toggleParty(members, ['A1'], 'other');
        expect(only.sort()).toEqual(['A1', 'Z1', 'Z2']);
        const model = buildLegend(seats, 'mp', null, only);
        expect(model.highlighted.sort()).toEqual(['A1', 'other']);
        // The person pressed two rows: A1 and Other.
        expect(model.showing).toEqual(['A1', 'Other parties']);
    });

    it('switches Other off as one unit, leaving the other highlights alone', () => {
        const on = toggleParty(members, ['A1'], 'other');
        expect(toggleParty(members, on, 'other')).toEqual(['A1']);
    });

    it('completes a partly highlighted Other instead of clearing it', () => {
        const only = toggleParty(members, ['Z1'], 'other');
        expect(only.sort()).toEqual(['Z1', 'Z2']);
    });

    it('ignores a row that does not exist', () => {
        expect(toggleParty(members, ['A1'], 'nope')).toEqual(['A1']);
    });
});

describe('pruneParties', () => {
    it('keeps the parties that hold the new seat and drops the rest', () => {
        // Only A9 holds a governor seat.
        expect(pruneParties(seats, 'governor', ['A1', 'A9'])).toEqual(['A9']);
        expect(pruneParties(seats, 'mp', ['A1', 'A9'])).toEqual(['A1', 'A9']);
    });

    it('clears every highlight when the map goes back to no seat colouring', () => {
        expect(pruneParties(seats, 'none', ['A1'])).toEqual([]);
        expect(pruneParties(seats, 'province', ['A1'])).toEqual([]);
    });

    it('leaves an empty selection alone', () => {
        expect(pruneParties(seats, 'senator', [])).toEqual([]);
    });
});

describe('buildProvinceLegend', () => {
    it('is a plain key in province order with nothing to press or count', () => {
        const legend = buildProvinceLegend([
            { c: 2, n: 'Coast' },
            { c: 1, n: 'Nairobi' },
        ]);
        expect(legend.rows.map((r) => r.label)).toEqual(['Nairobi', 'Coast']);
        expect(legend.rows.every((r) => r.count === undefined)).toBe(true);
        expect(legend.showing).toEqual([]);
        expect(legend.filtered).toBe(false);
    });
});

describe('settingsCount (the layers button badge)', () => {
    const { members } = buildLegend(seats, 'mp', null, []);

    it('counts the colouring and each pressed row, with Other as one press', () => {
        expect(settingsCount('none', null)).toBe(0);
        expect(settingsCount('mp', buildLegend(seats, 'mp', null, []))).toBe(1);
        const other = toggleParty(members, [], 'other');
        // Two parties are folded into Other parties, but the person pressed one row.
        expect(other).toHaveLength(2);
        expect(settingsCount('mp', buildLegend(seats, 'mp', null, other))).toBe(
            2,
        );
        const two = toggleParty(members, other, 'A1');
        expect(settingsCount('mp', buildLegend(seats, 'mp', null, two))).toBe(
            3,
        );
    });
});

describe('legendOpenAfterSelect', () => {
    const from = (
        open: boolean,
        desktop: boolean,
        wasFocused: boolean,
        focusing: boolean,
    ) => legendOpenAfterSelect(open, { desktop, wasFocused, focusing });

    it('keeps the legend as it is, open by default, when a unit is first focused on desktop', () => {
        expect(from(true, true, false, true)).toBe(true);
        // ... and respects a person who collapsed it.
        expect(from(false, true, false, true)).toBe(false);
    });

    it('collapses the legend to its chip when a unit is first focused on a phone', () => {
        expect(from(true, false, false, true)).toBe(false);
    });

    it('leaves it as the person set it while moving between units', () => {
        expect(from(true, true, true, true)).toBe(true);
        expect(from(false, true, true, true)).toBe(false);
    });

    it('opens it on desktop, and keeps it collapsed on a phone, back at all of Kenya', () => {
        expect(from(false, true, true, false)).toBe(true);
        expect(from(false, false, true, false)).toBe(false);
    });
});
