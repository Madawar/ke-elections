import { describe, expect, it } from 'vitest';
import type { SeatKey } from '@/lib/map/colouring';
import { viewLayout } from '@/lib/export/viewLayout';
import { mixBar, mixLegend } from '@/lib/export/viewMix';
import { headlineFor, snapshotView } from '@/lib/export/viewState';
import { THEMES } from '@/lib/map/theme';
import { type SeatsData, withIndependentColour } from '@/lib/seats';
import { MIX_SEATS, mixIndex } from './mixFixtures';

const URL = 'https://example.org/county/47?seat=mca';
const themed = (data: SeatsData) =>
    withIndependentColour(data, THEMES.dark.independent);
const view = (
    data: SeatsData,
    seat: SeatKey,
    focus: { level: 'county' | 'constituency'; code: number } | null,
) =>
    snapshotView({
        seats: themed(data),
        index: mixIndex,
        seat,
        focus,
        only: [],
        showSurroundings: false,
        theme: 'dark',
    });
const layout = (
    v: ReturnType<typeof view>,
    size: 'square' | 'portrait' | 'story' | 'x',
) =>
    viewLayout(size, v, { headline: headlineFor(v), url: URL, mapAspect: 1.5 });

// Two coloured parties under 3% (KANU 1, MCCP 1 of 85), as in Busia's MCA seats.
let kanu = 0;
const TWO_FOLDED: SeatsData = {
    ...MIX_SEATS,
    holders: MIX_SEATS.holders.map((h) =>
        h.seat === 'mca' && h.party === 'KANU' && kanu++ === 0
            ? { ...h, party: 'MCCP' }
            : h,
    ),
};
const nairobi = { level: 'county' as const, code: 47 };

describe('the mix bar on cards with the chart', () => {
    it('has exactly the chart’s rows, small parties included, so the two never disagree', () => {
        const kenya = view(MIX_SEATS, 'mca', null);
        expect(kenya.mix.rows).toEqual([]);
        for (const size of ['square', 'portrait', 'story', 'x'] as const) {
            const l = layout(kenya, size);
            expect(l.rows.length).toBeGreaterThan(0);
            expect(l.mixBar!.segments.map((s) => s.key)).toEqual(
                kenya.rows.filter((r) => r.count > 0).map((r) => r.key),
            );
        }
    });
});

describe('the mix legend', () => {
    const v = view(TWO_FOLDED, 'mca', nairobi);

    it('keeps the folded parties together on their own line under Other parties, without a share', () => {
        expect(v.mix.segments.at(-1)!.includes.map((p) => p.label)).toEqual([
            'KANU',
            'MCCP',
        ]);
        for (const size of ['square', 'portrait', 'story', 'x'] as const) {
            const items = layout(v, size).mixLegend!.items;
            const ofWhich = items.findIndex((i) => i.text.text === 'of which');
            expect(ofWhich, size).toBeGreaterThan(0);
            const other = items.find((i) =>
                i.text.text.startsWith('Other parties'),
            )!;
            // A line of its own, starting at the legend's left edge.
            expect(items[ofWhich].text.x, size).toBe(items[0].swatch!.x);
            expect(items[ofWhich].text.y, size).toBeGreaterThan(other.text.y);
            const folded = items.slice(ofWhich + 1);
            expect(folded.map((i) => i.text.text)).toEqual([
                'KANU 1',
                'MCCP 1',
            ]);
            for (const i of folded)
                expect(i.text.y).toBe(items[ofWhich].text.y);
        }
    });
});

describe('text inside the bar', () => {
    it('takes whichever ink gives at least 4.5:1 on the part (dark on ODM orange)', () => {
        const v = view(MIX_SEATS, 'mca', nairobi);
        const bar = mixBar({ x: 0, y: 0, w: 900, h: 48 }, v);
        const odm = bar.segments.find((s) => s.key === 'ODM')!;
        expect(odm.ink).toBe(THEMES.light.ink);
        const wdm = bar.segments.find((s) => s.key === 'WDM-K')!;
        expect(wdm.ink).toBe(THEMES.light.surface);
        // The legend lays out from the same bar.
        expect(mixLegend(0, 60, 900, v, bar, 22).items.length).toBeGreaterThan(
            0,
        );
    });
});

describe('row bars', () => {
    it('put the grey Other parties part last in every row', () => {
        const v = view(TWO_FOLDED, 'mca', nairobi);
        for (const row of v.mix.rows) {
            if (row.kind !== 'mix') continue;
            const keys = row.segments.map((s) => s.key);
            if (keys.includes('other')) expect(keys.at(-1)).toBe('other');
        }
    });
});

describe('a single seat', () => {
    it('shows who holds it instead of a bar, a callout and a chart', () => {
        const governor = view(MIX_SEATS, 'governor', nairobi);
        for (const size of ['square', 'portrait', 'story', 'x'] as const) {
            const l = layout(governor, size);
            expect(l.mixBar, size).toBeNull();
            expect(l.callouts).toEqual([]);
            expect(l.rows).toEqual([]);
            const block = l.holder!;
            expect(block.chip.colour).toBe('#e8c547');
            const text = block.texts.map((t) => t.text).join(' | ');
            expect(text).toContain('Governor, Nairobi City');
            expect(text).toContain('Placeholder governor 47');
            expect(text).toContain('United Democratic Alliance (UDA)');
            expect(text).toContain('In office since 25 August 2022');
            expect(text).toContain('Source: IEBC gazette notices');
        }
    });

    it('says when no holder is approved yet, and invents nothing', () => {
        const senator = view(MIX_SEATS, 'senator', nairobi);
        const l = layout(senator, 'portrait');
        const text = l.holder!.texts.map((t) => t.text).join(' | ');
        expect(text).toContain('No approved data yet');
        expect(text).not.toContain('In office');
    });
});

describe('a story with a handful of rows', () => {
    it('gives the room to a full-width map instead of leaving it empty', () => {
        const v = view(MIX_SEATS, 'mca', nairobi);
        const eight = { ...v, mix: { ...v.mix, rows: v.mix.rows.slice(0, 8) } };
        const l = layout(eight, 'story');
        expect(l.map.w).toBeGreaterThan(l.w * 0.7);
        expect(l.mixRows).toHaveLength(8);
        // What is left under the last row is small.
        expect(l.footerBox.y - (l.rowsBox!.y + l.rowsBox!.h)).toBeLessThan(120);
    });
});
