// "Make the map a bit bigger" (owner, 2026-11-27): about 15% on every card and about 25% on MCA
// cards for a county or a constituency. BEFORE holds each card's map box and headline size as
// they were at v0.2.0, measured with these same fixtures, so the growth is checked against what
// the owner was looking at. The room comes from padding and gaps first, then from the rows.
import { describe, expect, it } from 'vitest';
import { footerBlock } from '@/lib/export/layout';
import { VIEW_SIZES, type ViewSize } from '@/lib/export/sizes';
import { footerHeight, SPECS, viewLayout } from '@/lib/export/viewLayout';
import { headlineFor, snapshotView } from '@/lib/export/viewState';
import type { SeatKey } from '@/lib/map/colouring';
import { ATTRIBUTION, THEMES } from '@/lib/map/theme';
import { withIndependentColour } from '@/lib/seats';
import { MIX_SEATS, mixIndex } from './mixFixtures';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const SIZES = Object.keys(VIEW_SIZES) as ViewSize[];
const seats = withIndependentColour(MIX_SEATS, THEMES.dark.independent);
const URL = 'https://example.org/county/47?seat=mca';
const view = (
    seat: SeatKey,
    focus: { level: 'county' | 'constituency'; code: number } | null,
) =>
    snapshotView({
        seats,
        index: mixIndex,
        seat,
        focus,
        only: [],
        showSurroundings: false,
        theme: 'dark',
    });
const NAIROBI = { level: 'county', code: 47 } as const;
const MATHARE = { level: 'constituency', code: 290 } as const;
/** Each card, the width over height of what its map shows, and its boxes at v0.2.0. */
const CASES = {
    nairobiMca: { view: view('mca', NAIROBI), aspect: 1.57, mca: true },
    mathareMca: { view: view('mca', MATHARE), aspect: 2.23, mca: true },
    kenyaMca: { view: view('mca', null), aspect: 0.82, mca: false },
    nairobiMp: { view: view('mp', NAIROBI), aspect: 1.57, mca: false },
    nairobiGovernor: {
        view: view('governor', NAIROBI),
        aspect: 1.57,
        mca: false,
    },
    mathareMp: { view: view('mp', MATHARE), aspect: 2.23, mca: false },
};
type Case = keyof typeof CASES;
const BEFORE: Record<
    Case,
    Record<ViewSize, { w: number; h: number; head: number }>
> = {
    nairobiMca: {
        square: { w: 288, h: 183, head: 44 },
        portrait: { w: 305, h: 194, head: 42 },
        story: { w: 302, h: 192, head: 48 },
        x: { w: 674, h: 657, head: 54 },
    },
    mathareMca: {
        square: { w: 960, h: 222, head: 56 },
        portrait: { w: 952, h: 419, head: 62 },
        story: { w: 888, h: 519, head: 64 },
        x: { w: 674, h: 657, head: 54 },
    },
    kenyaMca: {
        square: { w: 472, h: 517, head: 56 },
        portrait: { w: 464, h: 741, head: 62 },
        story: { w: 552, h: 469, head: 64 },
        x: { w: 560, h: 657, head: 54 },
    },
    nairobiMp: {
        square: { w: 288, h: 183, head: 48 },
        portrait: { w: 305, h: 194, head: 46 },
        story: { w: 302, h: 192, head: 52 },
        x: { w: 674, h: 657, head: 54 },
    },
    nairobiGovernor: {
        square: { w: 960, h: 362, head: 56 },
        portrait: { w: 952, h: 563, head: 60 },
        story: { w: 888, h: 639, head: 74 },
        x: { w: 674, h: 657, head: 48 },
    },
    mathareMp: {
        square: { w: 960, h: 423, head: 56 },
        portrait: { w: 952, h: 625, head: 62 },
        story: { w: 888, h: 639, head: 74 },
        x: { w: 674, h: 657, head: 54 },
    },
};
const layoutOf = (name: Case, size: ViewSize) => {
    const c = CASES[name];
    return viewLayout(size, c.view, {
        headline: headlineFor(c.view),
        url: URL,
        mapAspect: c.aspect,
    });
};
/** The height the shape is drawn at inside its box. */
const drawn = (b: { w: number; h: number }, aspect: number) =>
    Math.min(b.h, b.w / aspect);
const NAMES = Object.keys(CASES) as Case[];
const TALL = ['square', 'portrait', 'story'] as const;

/** The shape is drawn right across its box, and the box right across the card: no wider to go. */
const fullWidth = (name: Case, size: ViewSize) => {
    const { map, w } = layoutOf(name, size);
    // "Right across": within 5% of the height that the full width would draw it at.
    return map.w / CASES[name].aspect <= map.h * 1.05 && map.w > w * 0.8;
};
/** How much taller the shape is drawn than at v0.2.0. */
const growth = (name: Case, size: ViewSize) => {
    const aspect = CASES[name].aspect;
    return (
        drawn(layoutOf(name, size).map, aspect) /
        drawn(BEFORE[name][size], aspect)
    );
};

describe('bigger card maps', () => {
    it('draws the map of an MCA card for a county or a constituency about a quarter bigger', () => {
        for (const name of NAMES.filter((n) => CASES[n].mca))
            for (const size of TALL) {
                // A wide constituency already spans the card: it has no room to grow into.
                if (fullWidth(name, size)) continue;
                expect(growth(name, size), `${name} ${size}`).toBeGreaterThanOrEqual(
                    1.2,
                );
                expect(growth(name, size), `${name} ${size}`).toBeLessThanOrEqual(
                    1.3,
                );
            }
        // The cases that do grow: the county on every size, the constituency on the square.
        expect(growth('nairobiMca', 'square')).toBeCloseTo(1.25, 1);
        expect(growth('nairobiMca', 'portrait')).toBeCloseTo(1.25, 1);
        expect(growth('nairobiMca', 'story')).toBeCloseTo(1.25, 1);
        expect(growth('mathareMca', 'square')).toBeGreaterThanOrEqual(1.2);
    });

    it('draws the map of every other card about 15% bigger, as far as padding and gaps allow', () => {
        for (const name of NAMES.filter((n) => !CASES[n].mca))
            for (const size of TALL) {
                if (fullWidth(name, size)) continue;
                // 8% at the least: Kenya beside its chart on a portrait card, where the chart's
                // column can only give up so much width before its big numbers are cut.
                expect(growth(name, size), `${name} ${size}`).toBeGreaterThanOrEqual(
                    1.08,
                );
                expect(growth(name, size), `${name} ${size}`).toBeLessThanOrEqual(
                    1.22,
                );
            }
        expect(growth('nairobiMp', 'square')).toBeCloseTo(1.15, 1);
        expect(growth('kenyaMca', 'story')).toBeCloseTo(1.15, 1);
    });

    it('never draws a shape smaller than before, on any card or size', () => {
        for (const name of NAMES)
            for (const size of SIZES)
                expect(growth(name, size), `${name} ${size}`).toBeGreaterThan(
                    0.995,
                );
    });

    it('on X, where the map already runs the full height, widens the map for wide units', () => {
        for (const name of NAMES) {
            // Kenya is taller than wide: more width is no use to it, so it gains only the
            // padding (about 4%). A wide unit gains at least 12%: the full growth when the
            // headline still breaks cleanly in the narrower column beside it, else half of it.
            expect(growth(name, 'x'), name).toBeGreaterThanOrEqual(
                name === 'kenyaMca' ? 1.03 : 1.12,
            );
        }
        expect(growth('nairobiMca', 'x')).toBeCloseTo(1.25, 1);
    });

    it('never shrinks the headline to make the room', () => {
        for (const name of NAMES)
            for (const size of SIZES) {
                const l = layoutOf(name, size);
                expect(
                    l.headlineLines[0].size,
                    `${name} ${size}`,
                ).toBeGreaterThanOrEqual(BEFORE[name][size].head);
                expect(
                    l.headlineLines.map((t) => t.text).join(' '),
                    `${name} ${size}`,
                ).toBe(headlineFor(CASES[name].view));
            }
    });

    it('keeps the footer whole: source, date, attribution and link at their full size, inside the card', () => {
        for (const name of NAMES)
            for (const size of SIZES) {
                const l = layoutOf(name, size);
                const v = CASES[name].view;
                expect(l.footerFonts).toEqual(SPECS[size].footer);
                expect(l.footerBox.h, `${name} ${size}`).toBe(
                    footerHeight(l.footerBox.w, l.footerFonts, v, URL),
                );
                const { bottom, lines } = footerBlock(l.footerBox, l.footerFonts, {
                    source: v.source,
                    asOf: '16 July 2026',
                    attribution: ATTRIBUTION,
                    url: URL,
                });
                expect(bottom, `${name} ${size}`).toBeLessThanOrEqual(l.h);
                expect(lines.map((t) => t.text).join(' ')).toContain(
                    'example.org/county/47?seat=mca',
                );
                // The map and everything above the footer stop short of it.
                expect(l.map.y + l.map.h).toBeLessThan(l.footerBox.y);
            }
    });

    it('keeps the story safe zones: nothing below 1520 or right of 960', () => {
        for (const name of NAMES) {
            const l = layoutOf(name, 'story');
            expect(l.footerBox.y + l.footerBox.h, name).toBeLessThanOrEqual(1520);
            expect(l.footerBox.x + l.footerBox.w, name).toBeLessThanOrEqual(960);
            expect(l.map.x + l.map.w, name).toBeLessThanOrEqual(960);
            expect(l.headline.y, name).toBeGreaterThanOrEqual(120);
        }
    });

    it('trims a long list to its first rows plus "and N more": never fewer than three, and more on the taller cards', () => {
        expect(SIZES.map((s) => SPECS[s].minRows)).toEqual([3, 6, 8, 3]);
        for (const name of ['nairobiMca', 'mathareMca', 'nairobiMp'] as const)
            for (const size of SIZES) {
                const l = layoutOf(name, size);
                const all = CASES[name].view.mix.rows;
                expect(l.mixRows.length, `${name} ${size}`).toBeGreaterThanOrEqual(
                    Math.min(SPECS[size].minRows, all.length),
                );
                expect(l.rowsMore).toBe(all.length - l.mixRows.length);
                if (l.rowsMore) expect(l.moreLine?.text).toMatch(/^and \d+ more /);
                expect(l.mixRows.map((r) => r.code)).toEqual(
                    all.slice(0, l.mixRows.length).map((r) => r.code),
                );
            }
    });

    it('keeps a constituency’s wards all listed on portrait and story, whatever its shape', () => {
        for (const aspect of [0.7, 1, 1.5, 2.23])
            for (const size of ['portrait', 'story'] as const) {
                const v = CASES.mathareMca.view;
                const l = viewLayout(size, v, {
                    headline: headlineFor(v),
                    url: URL,
                    mapAspect: aspect,
                });
                expect(l.mixRows, `${size} ${aspect}`).toHaveLength(
                    v.mix.rows.length,
                );
                expect(l.leaders?.rows, `${size} ${aspect}`).toHaveLength(4);
                expect(l.leaders?.more).toBeNull();
            }
    });

    it('never cuts the big numbers’ lines to widen the map beside them', () => {
        // The national MCA card with the published totals: "36% of 1,450 seats".
        const v = snapshotView({
            seats: VIEW_SEATS,
            index: viewIndex,
            seat: 'mca',
            focus: null,
            only: [],
            showSurroundings: false,
            theme: 'dark',
        });
        for (const size of SIZES) {
            const l = viewLayout(size, v, {
                headline: headlineFor(v),
                url: URL,
                mapAspect: 0.82,
            });
            for (const c of l.callouts)
                for (const t of [c.label, c.number, c.sub])
                    expect(t.text, `${size} ${t.text}`).not.toContain('…');
        }
    });
});
