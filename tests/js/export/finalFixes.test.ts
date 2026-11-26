// Final whole-branch review fixes: compact deep links for "Other parties", footer and X caption
// fit with long links, and small copy fixes.
import { describe, expect, it } from 'vitest';
import { captionFor, xLength } from '@/lib/export/caption';
import { footerBlock } from '@/lib/export/layout';
import { textWidth } from '@/lib/export/text';
import { viewLayout } from '@/lib/export/viewLayout';
import { inkOn } from '@/lib/export/viewMix';
import {
    headlineFor,
    parseViewQuery,
    snapshotView,
} from '@/lib/export/viewState';
import { buildLegend, toggleParty } from '@/lib/legend';
import { ATTRIBUTION, OTHER, THEMES } from '@/lib/map/theme';
import { hasOwnColour, withIndependentColour } from '@/lib/seats';
import { VIEW_SEATS, viewIndex } from './viewFixtures';

const seats = withIndependentColour(VIEW_SEATS, THEMES.dark.independent);
const legend = buildLegend(seats, 'mca', null, []);
const otherOn = toggleParty(legend.members, ['UDA'], 'other');
const view = snapshotView({
    seats,
    index: viewIndex,
    seat: 'mca',
    focus: null,
    only: otherOn,
    showSurroundings: false,
    theme: 'dark',
});
const ORIGIN = 'https://kenyaelectoralmap.example';

describe('deep links with Other parties highlighted', () => {
    it('name the whole group with one token and restore it', () => {
        expect(otherOn.length).toBeGreaterThan(5);
        expect(view.path).toBe('/?seat=mca&parties=uda,other');
        const back = parseViewQuery('?seat=mca&parties=uda,other', seats);
        expect(back.seat).toBe('mca');
        const restored = buildLegend(seats, 'mca', null, back.parties);
        expect(restored.highlighted.sort()).toEqual(['UDA', 'other'].sort());
    });

    it('keep the footer link on the card and the X caption within 280', () => {
        const url = `${ORIGIN}${view.path}`;
        for (const size of ['square', 'portrait', 'story', 'x'] as const) {
            const l = viewLayout(size, view, {
                headline: headlineFor(view),
                url,
                mapAspect: 0.82,
            });
            const f = footerBlock(l.footerBox, l.footerFonts, {
                source: view.source,
                asOf: '16 July 2026',
                attribution: ATTRIBUTION,
                url,
            });
            for (const t of f.lines) {
                const w = textWidth(
                    t.text.trimEnd(),
                    t.size,
                    (t.weight ?? 400) >= 600,
                );
                const right = t.anchor === 'end' ? t.x : t.x + w;
                expect(right, `${size} ${t.text}`).toBeLessThanOrEqual(
                    l.footerBox.x + l.footerBox.w + 0.5,
                );
            }
        }
        const x = captionFor(view, url, 'x');
        expect(xLength(x)).toBeLessThanOrEqual(279);
        expect(x.startsWith(headlineFor(view))).toBe(true);
    });

    it('fall back to the plain unit path in the footer when even the floor size is too wide', () => {
        const long = `${ORIGIN}/county/47?seat=mca&parties=${'abc,'.repeat(60)}xyz`;
        const f = footerBlock(
            { x: 0, y: 0, w: 900, h: 0 },
            { text: 22, small: 17, url: 24 },
            { source: 'IEBC', asOf: null, attribution: 'A', url: long },
        );
        expect(f.lines.at(-1)!.text).toBe(
            'kenyaelectoralmap.example/county/47',
        );
    });
});

describe('X caption length', () => {
    it('counts each link as the 23 characters X gives it', () => {
        expect(xLength(`a ${ORIGIN}/${'x'.repeat(200)} b`)).toBe(2 + 23 + 2);
    });
});

describe('copy', () => {
    it('says "1 more party", singular', () => {
        const all = seats.parties.map((p) => p.abbrev);
        const many = snapshotView({
            seats,
            index: viewIndex,
            seat: 'mca',
            focus: null,
            only: all,
            showSurroundings: false,
            theme: 'dark',
        });
        const thirteen = {
            ...many,
            highlights: Array.from({ length: 13 }, (_, i) => ({
                ...many.highlights[0],
                label: `P${i}`,
                name: `Party ${i}`,
            })),
        };
        const text = captionFor(thirteen, `${ORIGIN}/`);
        expect(text).toContain('And 1 more party.');
        expect(text).not.toContain('1 more parties');
    });
});

describe('one rule for "has its own colour"', () => {
    it('keeps independents and coloured parties apart from the Other grey', () => {
        expect(hasOwnColour('IND', OTHER)).toBe(true);
        expect(hasOwnColour('UDA', '#e8c547')).toBe(true);
        expect(hasOwnColour('SP1', OTHER)).toBe(false);
    });
});

describe('ink inside the bar', () => {
    it('picks the better of the two inks, which is at least 3:1 (large bold text) on every party colour', () => {
        const lum = (hex: string) => {
            const [r, g, b] = [1, 3, 5].map((i) => {
                const c = parseInt(hex.slice(i, i + 2), 16) / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a: string, b: string) => {
            const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };
        const colours = [
            ...seats.parties
                .map((p) => p.colour)
                .filter((c): c is string => !!c),
            OTHER,
            THEMES.light.independent,
            THEMES.dark.independent,
        ];
        for (const c of colours) {
            const ink = inkOn(c);
            const other =
                ink === THEMES.light.ink
                    ? THEMES.light.surface
                    : THEMES.light.ink;
            expect(ratio(c, ink)).toBeGreaterThanOrEqual(ratio(c, other));
            expect(ratio(c, ink), c).toBeGreaterThanOrEqual(3);
        }
    });
});
