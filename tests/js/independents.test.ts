// Independents as their own group everywhere (owner decision 2026-11-26): their own row, colour
// and seating-chart group, never folded into "Other parties".
import { describe, expect, it } from 'vitest';
import { snapshotView, parseViewQuery } from '@/lib/export/viewState';
import { buildLegend, toggleParty } from '@/lib/legend';
import { OTHER, THEMES } from '@/lib/map/theme';
import {
    type SeatsData,
    chamberGroups,
    chamberHighlight,
    partyColours,
    seatColouring,
    withIndependentColour,
} from '@/lib/seats';
import { VIEW_SEATS, viewIndex } from './export/viewFixtures';

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
    const lum = (hex: string) => {
        const [r, g, bl] = [1, 3, 5].map((i) => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

describe('the independent colour token', () => {
    it('is its own neutral in both themes, apart from Other, faded and no data', () => {
        for (const theme of [THEMES.light, THEMES.dark]) {
            const ind = theme.independent;
            expect(ind).toMatch(/^#[0-9A-Fa-f]{6}$/);
            for (const other of [OTHER, theme.faded, theme.noData])
                expect(ind.toLowerCase()).not.toBe(other.toLowerCase());
            expect(contrast(ind, theme.ground)).toBeGreaterThanOrEqual(3);
            expect(contrast(ind, theme.land)).toBeGreaterThanOrEqual(3);
        }
        expect(THEMES.light.independent).not.toBe(THEMES.dark.independent);
    });
});

describe('MCA seats across Kenya', () => {
    const seats = withIndependentColour(VIEW_SEATS, THEMES.light.independent);

    it('give Independent its own row and keep "Other parties" to the uncoloured parties', () => {
        const legend = buildLegend(seats, 'mca', null, []);
        const rows = legend.rows.map((r) => [r.label, r.count]);
        expect(rows).toContainEqual(['Independent', 114]);
        expect(rows.at(-1)).toEqual(['Other parties', 257]);
        const ind = legend.rows.find((r) => r.key === 'IND')!;
        expect(ind.colour).toBe(THEMES.light.independent);
        // Sorted by count like any party: after ODM (312), before JP (76).
        expect(legend.rows.slice(0, 4).map((r) => r.key)).toEqual([
            'UDA',
            'ODM',
            'IND',
            'JP',
        ]);
        expect(legend.members.other).not.toContain('IND');
        expect(legend.members.other).toHaveLength(9);
        expect(legend.rows.at(-1)!.parties).toBe(9);
    });

    it('keep Independent apart even when the data has not been themed', () => {
        const legend = buildLegend(VIEW_SEATS, 'mca', null, []);
        expect(legend.rows.map((r) => r.key)).toContain('IND');
        expect(partyColours(VIEW_SEATS).get('IND')).not.toBe(OTHER);
    });

    it('put a card snapshot on exactly the legend rows (share "8%" and "18%")', () => {
        const view = snapshotView({
            seats,
            index: viewIndex,
            seat: 'mca',
            focus: null,
            only: [],
            showSurroundings: false,
            theme: 'light',
        });
        const legend = buildLegend(seats, 'mca', null, []);
        expect(view.rows.map((r) => [r.key, r.count, r.colour])).toEqual(
            legend.rows.map((r) => [r.key, r.count, r.colour]),
        );
        expect(view.rows.find((r) => r.key === 'IND')!.share).toBe('8%');
        expect(view.rows.at(-1)!.share).toBe('18%');
        expect(view.rows.at(-1)!.label).toBe('Other parties');
    });
});

describe('the map', () => {
    for (const name of ['light', 'dark'] as const) {
        const theme = THEMES[name];
        const seats = withIndependentColour(VIEW_SEATS, theme.independent);
        const indWard = VIEW_SEATS.holders.find(
            (h) => h.seat === 'mca' && h.party === 'IND',
        )!.code;
        const udaWard = VIEW_SEATS.holders.find(
            (h) => h.seat === 'mca' && h.party === 'UDA',
        )!.code;
        const otherWard = VIEW_SEATS.holders.find(
            (h) => h.seat === 'mca' && h.party === 'SP1',
        )!.code;

        it(`colours independent-held units with the ${name} independent token`, () => {
            const col = seatColouring(seats, 'mca', {
                noData: theme.noData,
                faded: theme.faded,
            });
            expect(col.colours.get(indWard)).toBe(theme.independent);
            expect(col.colours.get(otherWard)).toBe(OTHER);
        });

        it(`highlights Independent like any party (${name})`, () => {
            const col = seatColouring(seats, 'mca', {
                noData: theme.noData,
                faded: theme.faded,
                only: new Set(['IND']),
            });
            expect(col.colours.get(indWard)).toBe(theme.independent);
            expect(col.colours.get(udaWard)).toBe(theme.faded);
            expect(col.colours.get(otherWard)).toBe(theme.faded);
        });
    }

    it('lets the Independent legend row switch the highlight on its own', () => {
        const legend = buildLegend(VIEW_SEATS, 'mca', null, []);
        expect(toggleParty(legend.members, [], 'IND')).toEqual(['IND']);
        const on = buildLegend(VIEW_SEATS, 'mca', null, ['IND']);
        expect(on.highlighted).toEqual(['IND']);
        expect(on.showing).toEqual(['Independent']);
    });
});

describe('the seating charts', () => {
    const data: SeatsData = withIndependentColour(
        {
            ...VIEW_SEATS,
            chambers: {
                national_assembly: { UDA: 149, ODM: 86, IND: 12, SP1: 5 },
                senate: { UDA: 30, SP2: 1 },
            },
        },
        THEMES.light.independent,
    );

    it('seat Independents as their own group, and "Other parties" without them', () => {
        const groups = chamberGroups(data, 'national_assembly');
        expect(groups.map((g) => [g.key, g.label, g.seats])).toEqual([
            ['UDA', 'United Democratic Alliance (UDA)', 149],
            ['ODM', 'Orange Democratic Movement (ODM)', 86],
            ['IND', 'Independent', 12],
            ['other', 'Other parties', 5],
        ]);
        expect(groups[2].colour).toBe(THEMES.light.independent);
        expect(
            chamberHighlight(groups, data.chambers.national_assembly, 'IND'),
        ).toBe('IND');
    });
});

describe('deep links', () => {
    it('restore an Independent highlight from parties=ind', () => {
        expect(parseViewQuery('?seat=mca&parties=ind', VIEW_SEATS)).toEqual({
            seat: 'mca',
            parties: ['IND'],
        });
    });
});
